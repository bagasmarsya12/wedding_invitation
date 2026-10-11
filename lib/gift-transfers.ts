import type { Localized } from './website-content';

export const GIFT_TRANSFER_IDS = ['bca', 'mandiri', 'dana', 'gopay'] as const;
export type GiftTransferId = typeof GIFT_TRANSFER_IDS[number];
export type GiftTransferMethod = { enabled: boolean; recipient: string; destination: string; cta: Localized };
export type GiftTransferConfig = Record<GiftTransferId, GiftTransferMethod>;
export type GuestGiftTransfer = GiftTransferMethod & { id: GiftTransferId; label: string };
export const GIFT_TRANSFER_LABELS: Record<GiftTransferId, string> = { bca: 'BCA', mandiri: 'Mandiri', dana: 'DANA', gopay: 'GoPay' };
export const GIFT_TRANSFER_SETTING = 'gift_transfer_methods';

export function emptyGiftTransfers(): GiftTransferConfig {
  return Object.fromEntries(GIFT_TRANSFER_IDS.map(id => [id, { enabled: false, recipient: '', destination: '', cta: { en: '', id: '' } }])) as GiftTransferConfig;
}

function validDestination(id: GiftTransferId, value: string) {
  if (id === 'dana') {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  }
  if (id === 'gopay') return /^\+?[\d\s()-]+$/.test(value) && /^\d{8,15}$/.test(value.replace(/\D/g, ''));
  return /^\d{6,34}$/.test(value);
}

export function validateGiftTransfers(input: unknown): GiftTransferConfig | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = emptyGiftTransfers(), values = input as Record<string, unknown>;
  for (const id of GIFT_TRANSFER_IDS) {
    const raw = values[id];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>, cta = row.cta as Record<string, unknown> | undefined;
    if (typeof row.enabled !== 'boolean' || typeof row.recipient !== 'string' || row.recipient.length > 120 || typeof row.destination !== 'string' || row.destination.length > (id === 'dana' ? 1000 : 40)) return null;
    if (!cta || typeof cta !== 'object' || Array.isArray(cta) || !['id', 'en'].every(lang => typeof cta[lang] === 'string' && (cta[lang] as string).length <= 100)) return null;
    const recipient = row.recipient.trim(), destination = row.destination.trim();
    if ((destination && !validDestination(id, destination)) || (row.enabled && (!recipient || !destination))) return null;
    result[id] = { enabled: row.enabled, recipient, destination, cta: { en: (cta.en as string).trim(), id: (cta.id as string).trim() } };
  }
  return result;
}

export function readGiftTransfers(value: string | null | undefined): GiftTransferConfig {
  try { return validateGiftTransfers(JSON.parse(value || 'null')) ?? emptyGiftTransfers(); } catch { return emptyGiftTransfers(); }
}

export function visibleGiftTransfers(config: GiftTransferConfig): GuestGiftTransfer[] {
  return GIFT_TRANSFER_IDS.filter(id => config[id].enabled && config[id].recipient && config[id].destination)
    .map(id => ({ ...config[id], id, label: GIFT_TRANSFER_LABELS[id] }));
}
