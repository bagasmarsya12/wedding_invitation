import { WEBSITE_DEFAULTS, weddingDisplay, type WebsiteConfig } from "./website-content";

export type WeddingEventKey = "akad" | "reception";
export type CalendarLanguage = "en" | "id";
export type WeddingCalendarEvent = {
  key: WeddingEventKey;
  label: Record<CalendarLanguage, string>;
  time: string;
  startsAt: string;
  endsAt?: string;
};

export const WEDDING_VENUE = {
  name: "Pandiga, Cimahi",
  address: "Pandiga, Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513",
  mapsUrl: "https://maps.app.goo.gl/JFL3wrzj7qsBXbz56",
};

// The published invitation supplies start times. Add endsAt only when confirmed.
export const WEDDING_EVENTS: Record<WeddingEventKey, WeddingCalendarEvent> = {
  akad: { key: "akad", label: { en: "Akad", id: "Akad" }, time: "14:00", startsAt: "2026-11-01T14:00:00+07:00" },
  reception: { key: "reception", label: { en: "Reception", id: "Resepsi" }, time: "18:00", startsAt: "2026-11-01T18:00:00+07:00" },
};

export function weddingCalendarEvent(key: string, config: WebsiteConfig = WEBSITE_DEFAULTS): WeddingCalendarEvent | null {
  if (key !== "akad" && key !== "reception") return null;
  const time = key === "akad" ? config.akadTime : config.receptionTime;
  return { ...WEDDING_EVENTS[key], time, startsAt: `${config.weddingDate}T${time}:00+07:00` };
}

function calendarTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function title(event: WeddingCalendarEvent, language: CalendarLanguage, config: WebsiteConfig = WEBSITE_DEFAULTS): string {
  return `${weddingDisplay(config,language).names} — ${event.label[language]}`;
}

function description(event: WeddingCalendarEvent, language: CalendarLanguage, config: WebsiteConfig = WEBSITE_DEFAULTS): string {
  const display=weddingDisplay(config,language);
  const start = language === "id"
    ? `${event.label.id} ${display.names} dimulai pukul ${event.time} WIB pada ${display.date}.`
    : `${display.names} ${event.label.en} starts at ${event.time} WIB on ${display.date}.`;
  const timing = event.endsAt ? "" : language === "id"
    ? "Pengingat jam mulai. Jam selesai belum dikonfirmasi."
    : "Start-time reminder. End time to be confirmed.";
  return [start, timing, `${display.venue}\n${config.mapsUrl}`].filter(Boolean).join("\n\n");
}

export function googleCalendarUrl(event: WeddingCalendarEvent, language: CalendarLanguage, config: WebsiteConfig = WEBSITE_DEFAULTS): string {
  // Google documents eventedit TEMPLATE links. A start-time reminder has no
  // invented duration; the guest can edit the end time in their calendar.
  const start = calendarTimestamp(event.startsAt);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title(event, language, config),
    dates: `${start}/${event.endsAt ? calendarTimestamp(event.endsAt) : start}`,
    stz: "Asia/Jakarta",
    etz: "Asia/Jakarta",
    details: description(event, language, config),
    location: config.venueAddress,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function foldLine(value: string): string {
  // RFC 5545: CRLF + one space, at most 75 UTF-8 octets per physical line.
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function weddingCalendarFile(event: WeddingCalendarEvent, language: CalendarLanguage, now = new Date(), config: WebsiteConfig = WEBSITE_DEFAULTS): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bagas Iga//Wedding Invitation//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:bagas-iga-20261101-${event.key}@bagas-iga-wedding`,
    `DTSTAMP:${calendarTimestamp(now.toISOString())}`,
    `DTSTART:${calendarTimestamp(event.startsAt)}`,
    // A DATE-TIME without DTEND/DURATION is a start-time reminder (RFC 5545).
    ...(event.endsAt ? [`DTEND:${calendarTimestamp(event.endsAt)}`] : []),
    `SUMMARY:${escapeText(title(event, language, config))}`,
    `DESCRIPTION:${escapeText(description(event, language, config))}`,
    `LOCATION:${escapeText(config.venueAddress)}`,
    `URL:${config.mapsUrl}`,
    "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
