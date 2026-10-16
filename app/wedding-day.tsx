'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, MapPin, MessageCircle, Sun, Sunset } from 'lucide-react';
import { weddingDisplay } from '@/lib/website-content';
import { whatsappPhone } from '@/lib/arrival-content';
import { T, useLanguage, LanguageSwitch } from './language';
import { AtelierFloralAccent } from './atelier-flowers';
import { GuestPass } from './guest-pass';
import { fullInvitationPath } from '@/lib/wedding-day-routing';
import { useSiteState } from './use-site-state';
import { GuestArchiveSession } from './guest-archive-session';

function WeddingDay({ token, guestName, preview }: { token: string; guestName: string; preview: boolean }) {
  const { website, arrival, language, t } = useLanguage();
  const display = weddingDisplay(website, language);
  const phone = whatsappPhone(arrival.contactPhone);
  const message = arrival.contactMessage[language].replaceAll('{{name}}', guestName || t('a wedding guest'));
  // This practical panel uses the existing flat floral art, outside the 3D garden chapters.
  return <section className="wedding-day" id="the-day" data-light="day" aria-labelledby="day-title">
    <div className="wedding-day-garden" aria-hidden="true">
      <AtelierFloralAccent corner="top-right" className="wedding-day-flower-top" />
      <AtelierFloralAccent corner="bottom-left" className="wedding-day-flower-bottom" />
    </div>
    <div className={`wedding-day-paper ${token ? 'has-pass' : ''}`}>
      <header className="wedding-day-heading">
        <p className="wedding-day-couple">{display.names}</p>
        <h1 id="day-title" tabIndex={-1}><T field="dayOf.title" /></h1>
        <p className="wedding-day-intro"><T field="dayOf.intro" /></p>
        <time dateTime={website.weddingDate}>{display.day}, {display.date}</time>
      </header>
      <div className="wedding-day-schedule" aria-label={t('Wedding schedule')}>
        <div><Sun size={19} strokeWidth={1.3} aria-hidden="true" /><span><T>Akad</T><time dateTime={`${website.weddingDate}T${website.akadTime}:00+07:00`}>{website.akadTime} <T>WIB</T></time></span></div>
        <div><Sunset size={19} strokeWidth={1.3} aria-hidden="true" /><span><T>Reception</T><time dateTime={`${website.weddingDate}T${website.receptionTime}:00+07:00`}>{website.receptionTime} <T>WIB</T></time></span></div>
      </div>
      <div className="wedding-day-arrival">
        <p className="wedding-day-venue"><MapPin size={17} strokeWidth={1.4} aria-hidden="true" /><span><strong>{display.venue}</strong><span>{website.venueAddress}</span></span></p>
        <nav className="wedding-day-actions" aria-label={t('Practical wedding links')}>
          <a className="wedding-day-directions" href={website.mapsUrl} target="_blank" rel="noopener noreferrer"><T field="guest.directions" /><ArrowUpRight size={16} aria-hidden="true" /></a>
          {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" /><T field="guest.contact" /></a>}
        </nav>
      </div>
      {token ? <div id="guest-pass" className="wedding-day-pass"><GuestPass token={token} compact /></div> : <p className="wedding-day-public-note"><T field="dayOf.personalLinkHint" /></p>}
      <a className="wedding-day-continue" href={fullInvitationPath(token)} target={preview ? '_blank' : undefined} rel={preview ? 'noopener noreferrer' : undefined}><T field="dayOf.fullInvitation" /><ArrowUpRight size={15} aria-hidden="true" /></a>
    </div>
  </section>;
}

export function WeddingDayView({ token = '', guestName = '', preview = false }: { token?: string; guestName?: string; preview?: boolean }) {
  const router = useRouter();
  const { siteState } = useSiteState(!preview);
  useEffect(() => {
    if (!preview && siteState?.phase && siteState.phase !== 'wedding-day') router.replace(fullInvitationPath(token));
  }, [preview, siteState?.phase, token, router]);
  useEffect(() => {
    document.body.classList.add('wedding-v2-body');
    return () => document.body.classList.remove('wedding-v2-body');
  }, []);
  return <div className="v2-world wedding-v2-body has-entered wedding-day-view">
    {!preview && token && <GuestArchiveSession token={token} />}
    <header className="wedding-day-toolbar"><LanguageSwitch /></header>
    <main><WeddingDay token={token} guestName={guestName} preview={preview} /></main>
  </div>;
}
