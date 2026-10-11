import { db, featureEnabled } from './server';
import { readGiftTransfers, visibleGiftTransfers, GIFT_TRANSFER_SETTING } from './gift-transfers';

// CMS-enabled payment methods are displayed on the public invitation too.
// Guest identity, reservations and shipping details use separate private routes.
export async function loadGuestGiftOptions() {
  const [rows, enabled] = await Promise.all([
    db().prepare('SELECT key,value FROM settings WHERE key IN (?, ?)').bind(GIFT_TRANSFER_SETTING, 'cash_gift_details').all<{ key: string; value: string }>(),
    featureEnabled('gifts'),
  ]);
  const configured = rows.results.find(row => row.key === GIFT_TRANSFER_SETTING);
  return {
    enabled,
    methods: enabled ? visibleGiftTransfers(readGiftTransfers(configured?.value)) : [],
    // Existing cash details remain available until the structured CMS settings are saved.
    legacyDetails: enabled && !configured ? rows.results.find(row => row.key === 'cash_gift_details')?.value || null : null,
  };
}
