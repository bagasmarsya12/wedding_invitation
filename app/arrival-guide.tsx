'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { T, useLanguage } from './language';
import { EMPTY_ARRIVAL_PHOTOS, whatsappPhone, type ArrivalPhotos } from '@/lib/arrival-content';
import type { TextBlock } from '@/lib/website-content';

/** Practical information shares the event spread; each panel opens one answer at a time. */
export function ArrivalGuide({ photos = EMPTY_ARRIVAL_PHOTOS, guestName = '', faq = [] }: {
  photos?: ArrivalPhotos; guestName?: string; faq?: TextBlock[];
}) {
  const { arrival, language, t, tField } = useLanguage();
  const [tab, setTab] = useState<'arrival' | 'faq'>(arrival.enabled ? 'arrival' : 'faq');
  const [openGuide, setOpenGuide] = useState('route'), [openFaq, setOpenFaq] = useState(() => faq[0]?.id || '');
  const [mapFailed, setMapFailed] = useState(false);
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const followAnchor = () => {
      if (location.hash === '#useful-bits' && faq.length) setTab('faq');
      else if (location.hash === '#arrival-guide' && arrival.enabled) setTab('arrival');
    };
    followAnchor(); window.addEventListener('hashchange', followAnchor);
    return () => window.removeEventListener('hashchange', followAnchor);
  }, [arrival.enabled, faq.length]);
  if (!arrival.enabled && !faq.length) return null;
  const active = tab === 'arrival' && !arrival.enabled ? 'faq' : tab === 'faq' && !faq.length ? 'arrival' : tab;
  const phone = whatsappPhone(arrival.contactPhone);
  const message = arrival.contactMessage[language].replaceAll('{{name}}', guestName || t('a wedding guest'));
  function guideItem(id: string, title: ReactNode, body: ReactNode) {
    return <details className="arrival-compact-item" key={id} open={openGuide === id}
      onToggle={event => { const opened = event.currentTarget.open; setOpenGuide(current => opened ? id : current === id ? '' : current); }}>
      <summary>{title}<span aria-hidden="true">+</span></summary><div className="arrival-compact-answer">{body}</div>
    </details>;
  }
  return <div className="arrival-compact" id="arrival-guide" role="region" aria-label={tField('guest.arrival')}>
    <span id="useful-bits" className="arrival-legacy-anchor" aria-hidden="true" />
    <div className="arrival-compact-tabs" role="tablist" aria-label={tField('guest.practical')} ref={tabs}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const available = [arrival.enabled && 'arrival', faq.length > 0 && 'faq'].filter(Boolean) as ('arrival' | 'faq')[];
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (available.indexOf(active) + 1) % available.length;
        event.preventDefault(); setTab(available[index]); tabs.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
      }}>
      {arrival.enabled && <button id="arrival-guide-tab" type="button" role="tab" aria-selected={active === 'arrival'} aria-controls="arrival-guide-panel" tabIndex={active === 'arrival' ? 0 : -1} onClick={() => setTab('arrival')}><T field="guest.arrival" /></button>}
      {faq.length > 0 && <button id="arrival-faq-tab" type="button" role="tab" aria-selected={active === 'faq'} aria-controls="arrival-faq-panel" tabIndex={active === 'faq' ? 0 : -1} onClick={() => setTab('faq')}><T field="guest.faq" /></button>}
    </div>
    {arrival.enabled && <div className="arrival-compact-panel" id="arrival-guide-panel" role="tabpanel" aria-labelledby="arrival-guide-tab" hidden={active !== 'arrival'}>
      <div className="arrival-compact-list">
        {guideItem('route', arrival.title[language], <>
          <p>{arrival.intro[language]}</p>
          <ol className="arrival-compact-steps" aria-label={tField('guest.route')}>{arrival.steps.map((step, index) => <li id={`arrival-step-${step.id}`} key={step.id}><span aria-hidden="true">{index + 1}</span><div><h3>{step.title[language]}</h3><p>{step.body[language].replace(' Foto patokan di bawah bisa membantu mengenali pintunya.', '').replace(' The landmark photograph below will help you recognize the entrance.', '')}</p></div></li>)}</ol>
          {photos.map && !mapFailed && <figure className="arrival-compact-map"><img src={photos.map} alt={arrival.mapAlt[language]} loading="lazy" decoding="async" onError={() => setMapFailed(true)} /><figcaption>{arrival.mapCaption[language]}</figcaption></figure>}
        </>)}
        {guideItem('access', <T field="guest.access" />, <p>{arrival.accessibility[language]}</p>)}
        {guideItem('transport', <T field="guest.transport" />, <p>{arrival.transport[language]}</p>)}
      </div>
    </div>}
    {faq.length > 0 && <div className="arrival-compact-panel" id="arrival-faq-panel" role="tabpanel" aria-labelledby="arrival-faq-tab" hidden={active !== 'faq'}>
      <div className="arrival-compact-list">{faq.map(item => <details className="arrival-compact-item" key={item.id} open={openFaq === item.id}
        onToggle={event => { const opened = event.currentTarget.open; setOpenFaq(current => opened ? item.id : current === item.id ? '' : current); }}>
        <summary>{item.title[language]}<span aria-hidden="true">+</span></summary><div className="arrival-compact-answer"><p>{item.body[language]}</p></div>
      </details>)}</div>
    </div>}
    {arrival.enabled && phone && <aside className="arrival-compact-help" id="arrival-help"><p>{arrival.contactName[language]}</p><a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><T field="guest.contact" /><ArrowUpRight size={16} aria-hidden="true" /></a></aside>}
  </div>;
}
