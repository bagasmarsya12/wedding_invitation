'use client';
/* eslint-disable @next/next/no-img-element -- The viewer renders the existing full-size CMS image without transformations. */
import { useEffect,useRef } from 'react';
import dynamic from 'next/dynamic';
import { T,useLanguage } from './language';
const Comments=dynamic(()=>import('./photo-comments').then(module=>module.PhotoComments),{loading:()=>null});
export type ViewerPhoto={key:string;src:string;caption:string};
export function PhotoViewer({photo,onClose,onPrevious,onNext}:{photo:ViewerPhoto|null;onClose:()=>void;onPrevious?:()=>void;onNext?:()=>void}) {
  const {t}=useLanguage();const dialog=useRef<HTMLDialogElement>(null),open=!!photo;
  useEffect(()=>{if(!open)return;const node=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;node?.showModal();document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=overflow;previous?.focus({preventScroll:true});};},[open]);
  return <dialog ref={dialog} className="moment-viewer moment-conversation" aria-label={t('Photograph viewer')} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,[contenteditable="true"]'))return;if(event.key==='ArrowRight')onNext?.();if(event.key==='ArrowLeft')onPrevious?.();}}>
    <header><span>{photo?.caption}</span><button type="button" autoFocus onClick={onClose}><T>Close</T></button></header>
    {photo&&<><div className="moment-photo-stage"><img src={photo.src} alt={photo.caption}/>{onPrevious&&onNext&&<nav aria-label={t('Photographs')}><button type="button" onClick={onPrevious}><T>Previous photograph</T></button><button type="button" onClick={onNext}><T>Next photograph</T></button></nav>}</div><Comments key={photo.key} photoKey={photo.key}/></>}
  </dialog>;
}
