import { apiError, logFailure, privateJson } from '@/lib/server';
import { loadGuestGiftOptions } from '@/lib/gift-transfers-server';
import { loadPublicGifts } from '@/lib/public-gifts-server';

export async function GET() {
  try {
    const [options,gifts]=await Promise.all([loadGuestGiftOptions(),loadPublicGifts()]);
    return privateJson({...options,gifts});
  } catch (error) {
    logFailure('public_gift_options_read', error);
    return apiError('Gift options are temporarily unavailable. Please try again.', 503);
  }
}
