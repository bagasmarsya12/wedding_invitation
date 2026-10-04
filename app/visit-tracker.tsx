'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** First-party page activity; invitation tokens never leave this origin. */
export function VisitTracker({enabled}:{enabled:boolean}) {
  const path=usePathname();
  useEffect(()=>{
    if(!enabled || navigator.doNotTrack==='1' || (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl) return;
    const match=path.match(/^\/invite\/([A-Za-z0-9_-]{24,160})(?:\/(gifts|mark))?\/?$/);
    const page=match ? match[2]==='gifts'?'gifts':match[2]==='mark'?'postcard':'invitation' : path==='/'?'home':/^\/archive(?:\/[^/]+)?$/.test(path)?'archive':path==='/gifts'?'gifts':null;
    if(!page) return;
    let sent=false;
    const send=()=>{
      if(sent || document.visibilityState!=='visible') return;
      sent=true;
      let session=crypto.randomUUID();
      let token=match?.[1]??'';
      try {
        const stored=JSON.parse(sessionStorage.getItem('bagas-iga:visit:v1') || 'null') as {id?:string;at?:number;token?:string}|null;
        if(stored?.id && stored.at && Date.now()-stored.at<30*60_000) {
          session=stored.id as typeof session;
          if(!token)token=stored.token??'';
        }
        sessionStorage.setItem('bagas-iga:visit:v1',JSON.stringify({id:session,at:Date.now(),token}));
      } catch {/* storage is optional */}
      void fetch('/api/visits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session,page,token}),keepalive:true}).catch(()=>{});
    };
    send(); document.addEventListener('visibilitychange',send);
    return ()=>document.removeEventListener('visibilitychange',send);
  },[path,enabled]);
  return null;
}
