const formatter = new Intl.DateTimeFormat('id-ID', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'});

export function formatAdminTime(value: unknown): string {
  if (!value) return '—';
  const raw = String(value).trim().replace(' ','T');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(date.getTime()) ? '—' : `${formatter.format(date)} WIB`;
}
