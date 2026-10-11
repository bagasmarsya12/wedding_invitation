import { validRichText, validPlainText } from './rich-text';
import type { Localized } from './website-content';

export const ARRIVAL_STEP_IDS = ['parking', 'entrance', 'checkin', 'celebration'] as const;
export type ArrivalStepId = typeof ARRIVAL_STEP_IDS[number];
export type ArrivalStep = { id: ArrivalStepId; title: Localized; body: Localized };
export type ArrivalPhotos = { map: string | null; parking: string | null; entrance: string | null };
export const EMPTY_ARRIVAL_PHOTOS: ArrivalPhotos = { map: null, parking: null, entrance: null };
export type ArrivalContent = {
  enabled: boolean; isExample: boolean; contactPhone: string;
  title: Localized; intro: Localized; sampleNote: Localized; mapCaption: Localized; mapAlt: Localized;
  parkingCaption: Localized; entranceCaption: Localized; dressCode: Localized;
  accessibility: Localized; transport: Localized; contactName: Localized; contactMessage: Localized;
  steps: ArrivalStep[];
};
const text = (id: string, en: string): Localized => ({ id, en });
export const ARRIVAL_DEFAULTS: ArrivalContent = {
  enabled: true, isExample: true, contactPhone: '',
  title: text('Datang dengan tenang, pulang membawa kenangan.', 'Arrive with a little ease.'),
  intro: text('Dari langkah pertama sampai pelukan pertama. Panduan kecil agar perjalananmu menuju kami terasa ringan.', 'From parking to saying hello. A little guidance so you can enjoy the day from your first step.'),
  sampleNote: text('Panduan contoh · detail kedatangan akan dikonfirmasi.', 'Sample guide · arrival details will be confirmed.'),
  mapCaption: text('Parkir, pintu masuk, lalu meja penerima tamu. Denah ilustratif, tidak berskala.', 'Parking, entrance, then the welcome desk. An illustrative plan, not to scale.'),
  mapAlt: text('Ilustrasi rute dari parkir ke pintu masuk, meja penerima tamu, dan area acara.', 'Illustrated route from parking to the entrance, welcome desk, and celebration.'),
  parkingCaption: text('Area parkir · foto patokan akan dipasang di sini.', 'Parking area · a landmark photograph will be added here.'),
  entranceCaption: text('Pintu masuk tamu · foto patokan akan dipasang di sini.', 'Guest entrance · a landmark photograph will be added here.'),
  dressCode: text('Semi-formal dalam nuansa ivory, sage, atau earth tone. Pilih alas kaki yang nyaman untuk berjalan dan menikmati acara.', 'Semi-formal in ivory, sage, or earth tones. Choose comfortable shoes for walking and enjoying the celebration.'),
  accessibility: text('Untuk tamu lansia atau yang memerlukan bantuan mobilitas, gunakan area drop-off dekat pintu masuk. Sampaikan kebutuhan pendampingan kepada panitia sebelum datang.', 'For older guests or anyone needing mobility assistance, use the drop-off near the entrance. Let the team know about any assistance you need before arriving.'),
  transport: text('Untuk taksi atau transportasi online, gunakan nama venue sebagai tujuan. Simpan QR pass sebelum berangkat dan siapkan beberapa menit untuk berjalan dari drop-off.', 'For a taxi or ride-hailing service, use the venue name as your destination. Save your QR pass before leaving and allow a few minutes to walk from the drop-off.'),
  contactName: text('Tim acara Iga & Bagas', 'Iga & Bagas’s wedding team'),
  contactMessage: text('Halo, saya {{name}}. Saya ingin bertanya tentang kedatangan ke acara Iga & Bagas.', 'Hello, I’m {{name}}. I have a question about arriving at Iga & Bagas’s wedding.'),
  steps: [
    { id: 'parking', title: text('Parkir & drop-off', 'Parking & drop-off'), body: text('Ikuti petunjuk petugas ke area parkir tamu. Jika diantar, turun di titik drop-off lalu lanjutkan menuju pintu masuk.', 'Follow the attendants to guest parking. If you are being dropped off, continue from the drop-off point to the entrance.') },
    { id: 'entrance', title: text('Pintu masuk tamu', 'Guest entrance'), body: text('Masuk melalui pintu utama dan ikuti papan petunjuk acara.', 'Use the main entrance and follow the wedding signs.') },
    { id: 'checkin', title: text('Tunjukkan QR pass', 'Show your QR pass'), body: text('Siapkan QR dari undangan personalmu di meja penerima tamu. Jika kesulitan membuka QR, sebutkan nama yang tertera di undangan kepada petugas.', 'Have the QR from your personal invitation ready at the welcome desk. If you cannot open it, tell an attendant the name on your invitation.') },
    { id: 'celebration', title: text('Selamat datang', 'Welcome to the celebration'), body: text('Setelah check-in, petugas akan mengantarmu ke area acara. Tarik napas, nikmati suasananya. Kami senang akhirnya kamu ada di sini.', 'After check-in, an attendant will point you toward the celebration. Take a moment to settle in; we’re happy you’re here.') },
  ],
};

export function whatsappPhone(value: string): string | null {
  let phone = value.replace(/[\s()+-]/g, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function validateArrivalContent(input: unknown): ArrivalContent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (typeof row.enabled !== 'boolean' || typeof row.isExample !== 'boolean') return null;
  if (typeof row.contactPhone !== 'string' || row.contactPhone.length > 40 || (row.contactPhone.trim() && !whatsappPhone(row.contactPhone))) return null;
  const localized = (value: unknown, max: number, rich = false): value is Localized => Boolean(value && typeof value === 'object' && !Array.isArray(value) && ['id', 'en'].every(key => (rich ? validRichText : validPlainText)((value as Record<string, unknown>)[key], max)));
  const shortFields = ['title', 'contactName', 'parkingCaption', 'entranceCaption', 'mapAlt'] as const;
  const longFields = ['intro', 'sampleNote', 'mapCaption', 'dressCode', 'accessibility', 'transport', 'contactMessage'] as const;
  for (const key of shortFields) if (!localized(row[key], 300)) return null;
  for (const key of longFields) if (!localized(row[key], 2000, ['intro','mapCaption','accessibility','transport'].includes(key))) return null;
  if (!Array.isArray(row.steps) || row.steps.length !== ARRIVAL_STEP_IDS.length) return null;
  const steps: ArrivalStep[] = [];
  for (const [index, raw] of row.steps.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const step = raw as Record<string, unknown>;
    if (step.id !== ARRIVAL_STEP_IDS[index] || !localized(step.title, 200) || !localized(step.body, 2000, true)) return null;
    steps.push({ id: ARRIVAL_STEP_IDS[index], title: { ...step.title }, body: { ...step.body } });
  }
  return { enabled: row.enabled, isExample: row.isExample, contactPhone: row.contactPhone.trim(), ...Object.fromEntries([...shortFields, ...longFields].map(key => [key, { ...(row[key] as Localized) }])), steps } as ArrivalContent;
}
