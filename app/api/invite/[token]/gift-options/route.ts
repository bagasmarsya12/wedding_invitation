import { apiError, guestFromToken, logFailure, privateJson } from '@/lib/server';
import { loadGuestGiftOptions } from '@/lib/gift-transfers-server';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!await guestFromToken((await params).token)) return apiError('Invitation not found.', 404);
    return privateJson(await loadGuestGiftOptions());
  } catch (error) { logFailure('gift_options_read', error); return apiError('Gift options are temporarily unavailable. Please try again.', 503); }
}
