import { WEBSITE_DEFAULTS, weddingDisplay, type WebsiteConfig } from "./website-content";

export const GUEST_GROUPS = [
  {key: 'unassigned', label: 'Belum diatur'},
  {key: 'bagas', label: 'Bagas'}, {key: 'iga', label: 'Iga'},
  {key: 'family', label: 'Keluarga'}, {key: 'other', label: 'Lainnya'},
] as const;
export function validGuestGroup(value: unknown): value is typeof GUEST_GROUPS[number]['key'] {
  return GUEST_GROUPS.some(group => group.key === value);
}
export const DEFAULT_INVITATION_MESSAGE = `Yth. {{nama}},

Kami mengundang Bapak/Ibu/Saudara/i untuk hadir di pernikahan Bagas & Iga pada {{tanggal}}, di {{lokasi}}.

Detail acara dan konfirmasi kehadiran tersedia melalui undangan pribadi berikut:
{{link}}

Terima kasih. Kami menantikan kehadiran Anda.
Bagas & Iga`;
const variables = ['nama', 'link', 'tanggal', 'lokasi'];
export function validInvitationTemplate(template: string) {
  return template.length > 0 && template.length <= 2000 && template.includes('{{nama}}') && template.includes('{{link}}') &&
    [...template.matchAll(/\{\{([^}]+)\}\}/g)].every(match => variables.includes(match[1]));
}
export function invitationMessage(template: string, name: string, link: string, config:WebsiteConfig=WEBSITE_DEFAULTS) {
  const values: Record<string,string> = {nama: name, link, tanggal:`${weddingDisplay(config,'id').day}, ${weddingDisplay(config,'id').date}`, lokasi:weddingDisplay(config,'id').venue};
  return template.replace(/\{\{(nama|link|tanggal|lokasi)\}\}/g, (_, key: string) => values[key]);
}
export function invitationToken(value: string, origin: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash) return null;
    return /^\/invite\/([A-Za-z0-9_-]{24,160})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}
