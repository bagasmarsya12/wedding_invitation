"use client";
import { useEffect, useState } from 'react';
import { GiftCatalogue } from './invite/[token]/gifts/gift-client';
import { GiftTransfers } from './gift-transfers';
import { AtelierFloralAccent } from './atelier-flowers';
import { T } from './language';
import { GiftBookingLink } from './gift-booking-link';
import type { HomepageGift } from '@/lib/public-content';
import type { GuestGiftTransfer } from '@/lib/gift-transfers';

type Options = { methods: GuestGiftTransfer[]; legacyDetails: string | null; enabled: boolean };
export function GiftSection({ token, guestName = '', gifts }: { token?: string; guestName?: string; gifts: HomepageGift[] }) {
  const [options, setOptions] = useState<Options | null>(null), [error, setError] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(()=>{if(!controller.signal.aborted){setOptions(null);setError(false);}});
    const endpoint = token ? `/api/invite/${encodeURIComponent(token)}/gift-options` : '/api/gift-options';
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Unavailable'); return await response.json() as Options; })
      .then(data => { if (!controller.signal.aborted) setOptions(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [token, revision]);
  return <section className="v2-gifts v2-scene gift-options-section" id="gifts" data-light="late" aria-labelledby="gifts-title">
    <div className="gift-options-folio">
      <div className="gift-options-flowers" aria-hidden="true"><AtelierFloralAccent corner="top-left" className="gift-options-flower-top" /><AtelierFloralAccent corner="bottom-right" className="gift-options-flower-bottom" /></div>
      <header className="gift-options-heading"><h2 id="gifts-title" tabIndex={-1}><T field="gift.head" /></h2><p><T field="gift.desc" rich /></p></header>
      <div className="gift-options-transfer" aria-labelledby="gift-transfer-title" aria-busy={!options && !error}>
        <h3 id="gift-transfer-title" className="gift-options-subtitle"><T>Cash gift</T></h3>
        {!options && !error && <p role="status"><T>Opening the gift options…</T></p>}
        {error && <div className="gift-options-empty"><p role="status"><T>Gift options are temporarily unavailable. Please try again.</T></p><button className="gift-transfer-action" type="button" onClick={() => setRevision(value => value + 1)}><T>Try again</T></button></div>}
        {options && (options.methods.length || options.legacyDetails ? <GiftTransfers methods={options.methods} legacyDetails={options.legacyDetails} /> : <p className="gift-options-empty"><T>Your presence is already a gift.</T></p>)}
      </div>
      <div className="gift-options-items" aria-labelledby="gift-items-title">
        <h3 id="gift-items-title" className="gift-options-subtitle"><T>Gift an object</T></h3>
        {token ? <GiftCatalogue token={token} guestName={guestName} inline /> : gifts.length ? <div className="gift-grid">{gifts.map(gift => <article className="gift-card is-text-only" key={gift.id}>
          <div className="gift-card-caption"><p className="gift-recipient"><T>{gift.category === 'home' ? 'For Iga & Bagas' : gift.category === 'iga' ? 'For Iga' : 'For Bagas'}</T></p><h4>{gift.title}</h4><p className="gift-reason">{gift.description}</p>{gift.priceLabel && <small>{gift.priceLabel}</small>}<div className="gift-actions">{gift.status === 'available' ? <GiftBookingLink title={gift.title} disabled={!options?.enabled} /> : <button type="button" disabled><T>Already booked</T></button>}</div></div>
        </article>)}</div> : <p className="gift-options-empty"><T field="gift.kosong" /></p>}
      </div>
    </div>
  </section>;
}
