export const INVITATION_OPEN_EVENT = 'wedding:open-invitation';

/** Dispatch synchronously from the opening click, while browser user activation is valid. */
export function requestInvitationAudio() {
  window.dispatchEvent(new Event(INVITATION_OPEN_EVENT));
}

export function shouldStartInvitationAudio(stored: string | null): boolean {
  if (!stored) return true;
  try {
    const preference = JSON.parse(stored);
    // Respect a pause made earlier in this browser session.
    return typeof preference?.wantedPlaying !== 'boolean' || preference.wantedPlaying;
  } catch { return true; }
}
