import { cache } from 'react';
import { db } from './server';
import { JUKEBOX_DEFAULTS, JUKEBOX_SETTING, validateJukeboxConfig } from './jukebox-playlist';

export const loadJukebox = cache(async () => {
  try {
    const row = await db().prepare('SELECT value FROM settings WHERE key=? LIMIT 1').bind(JUKEBOX_SETTING).first<{ value: string }>();
    if (row) return validateJukeboxConfig(JSON.parse(row.value)) ?? JUKEBOX_DEFAULTS;
  } catch { /* Optional music must never make the invitation unavailable. */ }
  return JUKEBOX_DEFAULTS;
});
