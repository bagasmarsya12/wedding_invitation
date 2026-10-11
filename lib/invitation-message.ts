import { WEBSITE_DEFAULTS, weddingDisplay, type WebsiteConfig } from "./website-content";
import { isInvitationOrigin } from './invitation-origin.mjs';

export const GUEST_GROUPS = [
  {key: 'unassigned', label: 'Belum diatur'},
  {key: 'bagas', label: 'Bagas'}, {key: 'iga', label: 'Iga'},
  {key: 'family', label: 'Keluarga'}, {key: 'other', label: 'Lainnya'},
] as const;
export function validGuestGroup(value: unknown): value is typeof GUEST_GROUPS[number]['key'] {
  return GUEST_GROUPS.some(group => group.key === value);
}
export const DEFAULT_INVITATION_MESSAGE = `Untuk {{nama}},

Ada satu hari yang ingin kami bagi dengan orang-orang tersayang. Dengan penuh sukacita, kami mengundangmu ke pernikahan Iga & Bagas pada {{tanggal}}, di {{lokasi}}.

Detail acara, konfirmasi kehadiran, dan QR masuk tersedia di undangan personalmu:
{{link}}

Kehadiranmu membuat hari kami lebih utuh. Cerita panjangnya, nanti kita sambung saat bertemu.

Dengan sayang,
Iga & Bagas`;
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
    if (!isInvitationOrigin(url.origin, origin) || url.username || url.password || url.search || url.hash) return null;
    return /^\/invite\/([A-Za-z0-9_-]{24,160})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}
