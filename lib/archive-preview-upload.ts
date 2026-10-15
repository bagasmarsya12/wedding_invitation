import { decodePhoto, encodePhoto } from './cms-photo-upload';
import { previewDimensions } from './archive-media';

export type ArchivePreviews = { card: Blob; large: Blob; motion?: Blob };
async function stillPreviews(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d'); if (!context) throw new Error('Preview belum bisa disiapkan.');
    const render = async (edge: number, quality: number) => {
      Object.assign(canvas, previewDimensions(width, height, edge));
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return encodePhoto(canvas, 'image/webp', quality);
    };
    const card = await render(640, .78), large = await render(1280, .82);
    return { card, large };
  } finally { canvas.width = canvas.height = 0; }
}

/** Decode one patch at a time; never retain a whole GIF as RGBA frames. */
async function gifPreviews(file: File): Promise<ArchivePreviews> {
  const { parseGIF, decompressFrame } = await import('gifuct-js');
  const gif = parseGIF(await file.arrayBuffer());
  const { width, height } = gif.lsd;
  if (width * height > 12_000_000) {
    const image = await decodePhoto(file);
    try { return await stillPreviews(image.source, image.width, image.height); }
    finally { image.close(); }
  }
  const frames = gif.frames.filter((f): f is Parameters<typeof decompressFrame>[0] => 'image' in f);
  if (!frames.length) throw new Error('GIF tidak berisi foto.');
  const composite = document.createElement('canvas'), patch = document.createElement('canvas'), video = document.createElement('canvas');
  composite.width = width; composite.height = height;
  const context = composite.getContext('2d', { willReadFrequently: true })!, patchContext = patch.getContext('2d')!, videoContext = video.getContext('2d')!;
  if (!context || !patchContext || !videoContext) throw new Error('Preview belum bisa disiapkan.');
  const background = gif.gct?.[gif.lsd.backgroundColorIndex];
  if (!frames[0].gce?.extras.transparentColorGiven && background) {
    context.fillStyle = `rgb(${background.join(',')})`; context.fillRect(0, 0, width, height);
  }
  Object.assign(video, previewDimensions(width, height, 640, true));
  let previews: ArchivePreviews | undefined, previous: ReturnType<typeof decompressFrame> | undefined, restore: ImageData | undefined;
  let output: any, source: any, failed = false;
  const totalSeconds = frames.reduce((sum, f) => sum + (f.gce?.delay || 10) / 100, 0);
  try {
    if ('VideoEncoder' in window && frames.length <= 600 && totalSeconds <= 120) {
      try {
        const path = '/atelier/vendor/mediabunny.mjs';
        const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import(/* @vite-ignore */ path);
        output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
        source = new CanvasSource(video, { codec: 'avc', bitrate: 1_500_000, keyFrameInterval: 2 });
        output.addVideoTrack(source);
        await output.start();
      } catch { failed = true; await output?.cancel().catch(() => {}); }
    }
    let timestamp = 0;
    for (let index = 0; index < frames.length; index++) {
      if (previous?.disposalType === 2) {
        context.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
        if (previous.transparentIndex === undefined && background) { context.fillStyle = `rgb(${background.join(',')})`; context.fillRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height); }
      }
      else if (previous?.disposalType === 3 && restore) context.putImageData(restore, 0, 0);
      const frame = decompressFrame(frames[index], gif.gct, true);
      restore = frame.disposalType === 3 ? context.getImageData(0, 0, width, height) : undefined;
      patch.width = frame.dims.width; patch.height = frame.dims.height;
      const image = patchContext.createImageData(patch.width, patch.height); image.data.set(frame.patch); patchContext.putImageData(image, 0, 0);
      context.drawImage(patch, frame.dims.left, frame.dims.top);
      if (!previews) previews = await stillPreviews(composite, width, height);
      if (!source || failed) break;
      videoContext.fillStyle = '#f3eee5'; videoContext.fillRect(0, 0, video.width, video.height);
      videoContext.drawImage(composite, 0, 0, video.width, video.height);
      const duration = (frames[index].gce?.delay || 10) / 100;
      try { await source.add(timestamp, duration); } catch { failed = true; break; }
      timestamp += duration; previous = frame;
      if (index % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (source && !failed) {
      try {
        source.close(); await output.finalize();
        const buffer = output.target.buffer;
        if (buffer?.byteLength && buffer.byteLength <= 8 * 1024 * 1024) previews!.motion = new Blob([buffer], { type: 'video/mp4' });
      } catch { failed = true; }
    }
    if (!previews) throw new Error('Preview GIF belum bisa disiapkan.');
    return previews;
  } finally {
    source?.close();
    if (output && (failed || !previews?.motion)) await output.cancel().catch(() => {});
    composite.width = composite.height = patch.width = patch.height = video.width = video.height = 0;
  }
}

export async function prepareArchivePreviews(file: File): Promise<ArchivePreviews> {
  if (file.type === 'image/gif') return gifPreviews(file);
  const image = await decodePhoto(file);
  try { return await stillPreviews(image.source, image.width, image.height); }
  finally { image.close(); }
}
