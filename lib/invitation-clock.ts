const EVENT_DATE_UTC = Date.UTC(2026, 10, 1);
export function invitationClock(now: Date, phase?: string, language = "en", weddingDate = "2026-11-01") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const date = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
  const days = Math.round((Date.parse(`${weddingDate}T00:00:00Z`) - date) / 86_400_000);
  const state = phase === "post-wedding" || days < 0 ? "past" : phase === "wedding-day" || days === 0 ? "today" : days === 1 ? "tomorrow" : "countdown";
  const countdown = language === "id"
    ? state === "past" ? "kami sudah menikah." : state === "today" ? "hari ini." : state === "tomorrow" ? "besok." : `${Math.max(days, 0)} hari lagi.`
    : state === "past" ? "we’re married." : state === "today" ? "today." : state === "tomorrow" ? "tomorrow." : `${Math.max(days, 0)} days away.`;
  return { state, countdown };
}
