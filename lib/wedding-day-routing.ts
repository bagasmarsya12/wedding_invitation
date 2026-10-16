/** Preserve the invitation credential when switching between the two experiences. */
export function weddingDayPath(token = '') {
  return token ? `/hari-h/${encodeURIComponent(token)}` : '/hari-h';
}

export function fullInvitationPath(token = '') {
  return `${token ? `/invite/${encodeURIComponent(token)}` : '/'}?view=full`;
}

export function weddingDayRedirect(phase: string | undefined, view: unknown, token = '') {
  return phase === 'wedding-day' && view !== 'full' ? weddingDayPath(token) : null;
}
