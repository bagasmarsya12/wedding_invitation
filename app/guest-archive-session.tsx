'use client';
import { useEffect } from 'react';
let pending:Promise<void>|null=null;
let currentToken='';
export function waitForArchiveGuest(){return pending??Promise.resolve();}
function establish(token:string) {
  if(currentToken===token&&pending)return pending;
  currentToken=token;
  pending=fetch('/api/guest/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}).then(()=>{}).catch(()=>{});
  return pending;
}
export function GuestArchiveSession({token}:{token:string}) {
  useEffect(()=>{if(token)void establish(token);},[token]);
  return null;
}
