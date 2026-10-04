"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef} from 'react';
import {Download} from 'lucide-react';
import type {GuestKeepsakePayload} from '@/lib/guest-keepsake';

export function AtelierKeepsake({content}:{content:GuestKeepsakePayload}) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let stopped=false,dispose:(()=>void)|undefined;
    const modulePath='/atelier/guest-view.js?v=7';
    import(/* @vite-ignore */ modulePath).then(module=>{if(!stopped&&root.current)dispose=module.mountKeepsake(root.current,content);}).catch(()=>{if(root.current)root.current.querySelector('#loading')!.textContent=content.ui.loadFailed;});
    return()=>{stopped=true;dispose?.();};
  },[content]);
  return <div ref={root} className="atelier-keepsake-page">
    <main className="keepsake-view" aria-label={content.ui.pageTitle}>
      <div id="stage" className="stage" role="button" tabIndex={0} aria-pressed="false" aria-label={content.ui.frontAria.replace('{name}',content.recipient||content.card.genericRecipient).replace('{hint}',content.ui.hintFront)}>
        <img id="fallback" hidden alt="" />
        <p id="loading" role="status">{content.ui.loading}</p>
      </div>
      <p id="card-hint" className="card-hint">{content.ui.hintFront}</p>
      <section className="downloads" aria-label={content.ui.downloadsAria}>
        <button id="save-front" type="button" disabled>{content.ui.downloadFront}</button>
        <button id="save-back" type="button" disabled>{content.ui.downloadBack}</button>
        <button id="save-video" type="button" className="video-download" disabled><Download size={15} strokeWidth={1.2} aria-hidden="true"/><span>{content.ui.downloadVideo}</span></button>
        <a id="download-video" className="video-download" hidden>{content.ui.downloadVideoReady}</a>
        <div id="export-progress" className="export-progress" hidden><progress id="progress" max="100" value="0" aria-label={content.ui.progressAria} /><button id="cancel-export" type="button">{content.ui.cancel}</button></div>
        <p id="status" className="download-status" role="status" aria-live="polite" />
      </section>
    </main>
  </div>;
}
