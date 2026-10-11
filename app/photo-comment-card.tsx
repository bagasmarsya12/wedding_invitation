'use client';
import { useEffect,useState } from 'react';
import { T,useLanguage } from './language';
import { waitForArchiveGuest } from './guest-archive-session';
import { COMMENT_OVERVIEW_LIMIT,type PhotoCommentOverview } from '@/lib/photo-comments';

const CHANGE_EVENT='photo-comments-changed';
export function notifyPhotoCommentsChanged(photoKey:string) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT,{detail:photoKey}));
}

// Fetch one lightweight batch for the album, rather than every comment thread.
export function usePhotoCommentCards(photoKeys:string[]) {
  const keys=[...new Set(photoKeys)].sort().join('|');
  const [data,setData]=useState<PhotoCommentOverview|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    const list=keys.split('|').filter(Boolean);if(!list.length)return;
    let controller:AbortController;
    async function load() {
      controller?.abort();const active=new AbortController();controller=active;
      try {
        await waitForArchiveGuest();
        const batches=Array.from({length:Math.ceil(list.length/COMMENT_OVERVIEW_LIMIT)},(_,index)=>list.slice(index*COMMENT_OVERVIEW_LIMIT,(index+1)*COMMENT_OVERVIEW_LIMIT));
        const results=await Promise.all(batches.map(async batch=>{
          const response=await fetch('/api/photo-comments/overview?'+new URLSearchParams(batch.map(key=>['photo',key])),{cache:'no-store',signal:active.signal});
          if(!response.ok)throw new Error('Comments unavailable');return await response.json() as PhotoCommentOverview;
        }));
        if(!active.signal.aborted){setData({...results[0],photos:Object.assign({},...results.map(result=>result.photos))});setError(false);}
      }catch{if(!active.signal.aborted)setError(true);}
    }
    function changed(event:Event){if(list.includes((event as CustomEvent<string>).detail))void load();}
    void load();window.addEventListener(CHANGE_EVENT,changed);
    return()=>{controller?.abort();window.removeEventListener(CHANGE_EVENT,changed);};
  },[keys]);
  return {data,error};
}

export function PhotoCommentCard({photoKey,overview,error,onRead}:{photoKey:string;overview:PhotoCommentOverview|null;error:boolean;onRead:()=>void}) {
  const {tField,language}=useLanguage();
  const photo=overview?.photos[photoKey];
  const count=photo?new Intl.NumberFormat(language==='id'?'id-ID':'en-US').format(photo.total):'—';
  return <section className="photo-comment-card" aria-label={tField('photoComments.title')}>
    <button className="photo-comment-count" type="button" onClick={onRead}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z"/><path d="M7 8h9M7 12h6"/></svg>{tField(photo?.total===1?'photoComments.countOne':'photoComments.count').replaceAll('{{count}}',count)}<span aria-hidden="true">↗</span></button>
    {error&&<button className="photo-comment-card-retry" type="button" onClick={()=>notifyPhotoCommentsChanged(photoKey)}><T field="photoComments.retry"/></button>}
  </section>;
}
