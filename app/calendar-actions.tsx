"use client";

import { ArrowUpRight, CalendarDays, ChevronDown, Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { googleCalendarUrl, weddingCalendarEvent, type WeddingEventKey } from "@/lib/wedding-calendar";
import { T, useLanguage } from "./language";

export function CalendarActions({ eventKey }: { eventKey: WeddingEventKey }) {
  const details = useRef<HTMLDetailsElement>(null);
  const { language, t, website } = useLanguage();
  const event = weddingCalendarEvent(eventKey,website)!;
  const label = event.label[language];
  const summaryLabel = t(eventKey === "akad" ? "Add Akad to calendar" : "Add Reception to calendar");

  useEffect(() => {
    const element = details.current;
    if (!element) return;
    const dismissOutside = (event: Event) => {
      if (element.open && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, []);

  return <details ref={details} className={`v2-calendar v2-calendar-${eventKey}`} name="wedding-calendar" onKeyDown={e => {
    if (e.key === "Escape" && e.currentTarget.open) {
      e.preventDefault();
      e.currentTarget.open = false;
      e.currentTarget.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label={summaryLabel}>
      <CalendarDays size={14} strokeWidth={1.4} aria-hidden="true" />
      <span><T>Add to calendar</T></span>
      <ChevronDown size={12} strokeWidth={1.4} aria-hidden="true" />
    </summary>
    <div className="v2-calendar-options" role="group" aria-label={summaryLabel}>
      <strong>{label} · {event.time}<T>WIB</T></strong>
      <a href={googleCalendarUrl(event, language,website)} target="_blank" rel="noopener noreferrer" aria-label={`${t("Open Google Calendar for")} ${label}`}>
        <span><T>Google Calendar</T></span><ArrowUpRight size={15} strokeWidth={1.4} aria-hidden="true" />
      </a>
      <a href={`/calendar/${eventKey}?lang=${language}`} download={`bagas-iga-${eventKey}.ics`} aria-label={`${t("Download calendar file for")} ${label}`}>
        <span><T>Apple / Outlook (.ics)</T></span><Download size={15} strokeWidth={1.4} aria-hidden="true" />
      </a>
      {!event.endsAt && <p><T>Start-time reminder. End time to be confirmed.</T></p>}
    </div>
  </details>;
}
