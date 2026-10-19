'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { browserVisitId, visitSession } from '@/lib/visit-activity';

/** First-party page activity; invitation tokens never leave this origin. */
export function VisitTracker({enabled}:{enabled:boolean}) {
  const path=usePathname();
  useEffect(()=>{
    if(!enabled || navigator.doNotTrack==='1' || (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl) return;
    const match=path.match(/^\/(?:invite|hari-h)\/([A-Za-z0-9_-]{24,160})(?:\/(gifts|mark))?\/?$/);
    const page=match ? match[2]==='gifts'?'gifts':match[2]==='mark'?'postcard':'invitation' : path==='/'||path==='/hari-h'?'home':/^\/archive(?:\/[^/]+)?$/.test(path)?'archive':path==='/gifts'?'gifts':null;
    if(!page) return;
    let sent=false;
    const send=()=>{
      if(sent || document.visibilityState!=='visible') return;
      sent=true;
      let identity={session:crypto.randomUUID() as string,token:match?.[1]??''};
      let device:string|null=null;
      try {
        identity=visitSession(sessionStorage,identity.token,Date.now(),()=>crypto.randomUUID());
      } catch {/* storage is optional */}
      try { device=browserVisitId(localStorage,()=>crypto.randomUUID()); } catch {/* storage is optional */}
      void fetch('/api/visits',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...identity,page,device}),keepalive:true}).catch(()=>{});
    };
    send(); document.addEventListener('visibilitychange',send);
    return ()=>document.removeEventListener('visibilitychange',send);
  },[path,enabled]);
  return null;
}
