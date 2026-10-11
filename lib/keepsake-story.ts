import type { KeepsakeData, KeepsakeFace } from './keepsake-design';
import { prepareAtelierKeepsake, type AtelierDesign } from './atelier-keepsake';

type StoryExporter = {
  exportImage: (design: AtelierDesign, back: boolean) => Promise<Blob>;
  exportVideo: (design: AtelierDesign, options: { signal: AbortSignal; onProgress: (value: number) => void }) => Promise<Blob>;
};
export async function createKeepsakeStory(data: KeepsakeData, options: {
  kind: 'image' | 'video'; face: KeepsakeFace; signal: AbortSignal; onProgress: (value: number) => void;
}): Promise<Blob> {
  options.signal.throwIfAborted();
  const modulePath = '/atelier/story-export.js?v=11';
  const [design, exporter] = await Promise.all([
    prepareAtelierKeepsake(data, { storyAccents: true }), import(/* @vite-ignore */ modulePath) as Promise<StoryExporter>,
  ]);
  options.signal.throwIfAborted();
  const blob = options.kind === 'video'
    ? await exporter.exportVideo(design, options)
    : await exporter.exportImage(design, options.face === 'back');
  options.signal.throwIfAborted();
  if (!blob.size || (options.kind === 'video' && blob.type !== 'video/mp4')) throw new Error('Story export unavailable');
  return blob;
}
