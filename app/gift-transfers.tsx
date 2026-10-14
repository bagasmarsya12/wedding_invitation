'use client';
import { useState } from 'react';
import { ArrowUpRight, Copy } from 'lucide-react';
import { T, useLanguage } from './language';
import type { GuestGiftTransfer } from '@/lib/gift-transfers';

export function GiftTransfers({ methods, legacyDetails = null }: { methods: GuestGiftTransfer[]; legacyDetails?: string | null }) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(''), [error, setError] = useState('');
  async function copy(value: string, id: string) {
    setError('');
    try { await navigator.clipboard.writeText(value); setCopied(id); }
    catch { setError('Copy unavailable. Select the details above to copy them.'); }
  }
  if (!methods.length && !legacyDetails) return null;
  const groups = [['bca', 'gopay'], ['mandiri', 'dana']]
    .map(ids => ids.flatMap(id => methods.filter(method => method.id === id)))
    .filter(group => group.length);
  return <div className="gift-transfers">
    <div className="gift-transfer-list">{groups.map(group => <div className="gift-transfer-group" key={group[0].id}>{group.map(method => {
      const cta = method.cta[language] || t(method.id === 'dana' ? 'Open DANA' : method.id === 'gopay' ? 'Copy phone number' : 'Copy account number');
      return <article className={`gift-transfer-method gift-transfer-${method.id}`} key={method.id}>
        <div><h3>{method.label}</h3><p className="gift-transfer-recipient">{method.recipient}</p></div>
        <div className="gift-transfer-destination">{method.id === 'dana' && !method.phone ? <p><T>Send a little love via DANA.</T></p> : <p><span><T>{method.id === 'gopay' || method.id === 'dana' ? 'Phone number' : 'Account number'}</T></span><strong dir="ltr">{method.id === 'dana' ? method.phone : method.destination}</strong></p>}</div>
        {method.id === 'dana' ? <a className="gift-transfer-action" href={method.destination} target="_blank" rel="noopener noreferrer">{cta}<ArrowUpRight size={15} aria-hidden="true" /></a> : <button className="gift-transfer-action" type="button" onClick={() => void copy(method.destination, method.id)}>{copied === method.id ? t('Copied.') : cta}<Copy size={14} aria-hidden="true" /></button>}
      </article>;
    })}</div>)}</div>
    {legacyDetails && <div className="gift-transfer-legacy"><pre>{legacyDetails}</pre><button className="gift-transfer-action" type="button" onClick={() => void copy(legacyDetails, 'legacy')}><T>{copied === 'legacy' ? 'Copied.' : 'Copy details'}</T></button></div>}
    <p className="gift-transfer-status" role="status">{error ? t(error) : copied ? t('Copied.') : ''}</p>
  </div>;
}
