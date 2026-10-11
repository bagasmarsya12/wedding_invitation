"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { Download, Film, X } from 'lucide-react';
import { useLanguage } from './language';
import { keepsakeText } from '@/lib/keepsake-design';
import { downloadKeepsake } from '@/lib/download-keepsake';
import type { KeepsakeData, KeepsakeFace } from '@/lib/keepsake-design';

type Asset = { key: string; url: string };
type Job = { key: string; dataKey: string; kind: 'image' | 'video'; progress: number; error?: string };

export function KeepsakeStoryDownloads({ data, face }: { data: KeepsakeData; face: KeepsakeFace }) {
  const titleId = useId();
  const {tField}=useLanguage(); const c=(key:string)=>tField(`storyDownload.${key}`);
  const videoKey = JSON.stringify(data), imageKey = JSON.stringify([data, face]);
  const [video, setVideo] = useState<Asset | null>(null), [image, setImage] = useState<Asset | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const controller = useRef<AbortController | null>(null), generation = useRef(0);
  const validJob = job && job.dataKey === videoKey ? job : null;
  const busy = Boolean(validJob && !validJob.error);
  const videoUrl = video?.key === videoKey ? video.url : '', imageUrl = image?.key === imageKey ? image.url : '';

  useEffect(() => () => { generation.current++; controller.current?.abort(); controller.current = null; }, [videoKey]);
  useEffect(() => () => { if (video?.url) URL.revokeObjectURL(video.url); }, [video]);
  useEffect(() => () => { if (image?.url) URL.revokeObjectURL(image.url); }, [image]);

  async function prepare(kind: 'image' | 'video') {
    if (controller.current) return;
    const current = ++generation.current, abort = new AbortController(); controller.current = abort;
    const key = kind === 'video' ? videoKey : imageKey;
    setJob({ key, dataKey: videoKey, kind, progress: 0 });
    try {
      const exporter = await import('@/lib/keepsake-story');
      const blob = await exporter.createKeepsakeStory(data, { kind, face, signal: abort.signal,
        onProgress: progress => { if (generation.current === current) setJob({ key, dataKey: videoKey, kind, progress }); },
      });
      if (generation.current !== current || abort.signal.aborted) return;
      const asset = { key, url: URL.createObjectURL(blob) };
      if (kind === 'video') setVideo(asset); else setImage(asset);
      setJob(null);
      downloadKeepsake(asset.url, kind === 'video' ? `iga-bagas-story-${data.language}.mp4` : `iga-bagas-story-${face}-${data.language}.png`);
    } catch {
      if (generation.current === current && !abort.signal.aborted) setJob({ key, dataKey: videoKey, kind, progress: 0,
        error: c('error'),
      });
    } finally { if (generation.current === current) controller.current = null; }
  }
  function cancel() { generation.current++; controller.current?.abort(); controller.current = null; setJob(null); }

  return <section className="keepsake-story-downloads" aria-labelledby={titleId}>
    <h4 id={titleId}>{c('title')}</h4>
    <p>{c('format').replaceAll('{{hashtag}}',keepsakeText(data).hashtag)}</p>
    <div className="keepsake-story-actions">
      {videoUrl ? <a className="v2-keepsake-save" href={videoUrl} download={`iga-bagas-story-${data.language}.mp4`}><Download size={15} aria-hidden="true" />{c('videoAgain')}</a>
        : <button className="v2-keepsake-save" type="button" disabled={busy} onClick={() => void prepare('video')}><Film size={15} aria-hidden="true" />{c('video')}</button>}
      {imageUrl ? <a className="v2-keepsake-save" href={imageUrl} download={`iga-bagas-story-${face}-${data.language}.png`}><Download size={15} aria-hidden="true" />{c(face==='front'?'frontAgain':'backAgain')}</a>
        : <button className="v2-keepsake-save" type="button" disabled={busy} onClick={() => void prepare('image')}><Download size={15} aria-hidden="true" />{c(face)}</button>}
    </div>
    {busy && <div className="keepsake-story-progress"><p role="status">{c(validJob?.kind==='video'?'preparingVideo':'preparingImage')} {validJob?.progress}%</p><progress aria-label={c('progress')} max={100} value={validJob?.progress || 0} /><p>{c('wait')}</p><button type="button" onClick={cancel}><X size={14} aria-hidden="true" />{c('cancel')}</button></div>}
    {validJob?.error && <p role="alert">{validJob.error}</p>}
    {!busy && (videoUrl || imageUrl) && <p role="status">{c('ready')}</p>}
    {videoUrl && <video className="keepsake-story-preview" controls playsInline preload="metadata" src={videoUrl} aria-label={c('videoPreview')} />}
    {imageUrl && <a className="keepsake-story-image-preview" href={imageUrl} target="_blank" rel="noopener noreferrer">{c('imagePreview')}</a>}
  </section>;
}
