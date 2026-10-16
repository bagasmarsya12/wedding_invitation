export const INVITATION_OPEN_EVENT = 'wedding:open-invitation';

/** Dispatch synchronously from the opening click, while browser user activation is valid. */
export function requestInvitationAudio() {
  window.dispatchEvent(new Event(INVITATION_OPEN_EVENT));
}

export function shouldStartInvitationAudio(stored: string | null): boolean {
  if (!stored) return true;
  try {
    const preference = JSON.parse(stored);
    // Legacy wantedPlaying=false also meant "never played". Only an explicit pause is a preference.
    return preference?.autoplayPaused !== true;
  } catch { return true; }
}
