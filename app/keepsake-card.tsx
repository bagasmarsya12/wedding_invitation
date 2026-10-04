"use client";
import {ArrowUpRight} from 'lucide-react';
import {T} from './language';
export function KeepsakeCard({token=''}:{token?:string}) {
  return <a className="v2-keepsake-trigger" href={token?`/invite/${token}/keepsake`:'/keepsake'}><T>Open your keepsake</T><ArrowUpRight size={14} strokeWidth={1.4} aria-hidden="true" /></a>;
}
