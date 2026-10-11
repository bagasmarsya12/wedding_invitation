import { apiError, logFailure, privateJson } from '@/lib/server';
import { loadGuestGiftOptions } from '@/lib/gift-transfers-server';

export async function GET() {
  try {
    return privateJson(await loadGuestGiftOptions());
  } catch (error) {
    logFailure('public_gift_options_read', error);
    return apiError('Gift options are temporarily unavailable. Please try again.', 503);
  }
}
