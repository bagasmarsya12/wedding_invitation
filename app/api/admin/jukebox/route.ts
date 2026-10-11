import { allowMutation, apiError, db, privateJson, readJsonBody, requireAdmin, sameOriginMutation } from '@/lib/server';
import { loadJukebox } from '@/lib/jukebox-server';
import { JUKEBOX_SETTING, uploadedAudioId, validateJukeboxConfig } from '@/lib/jukebox-playlist';

export async function GET() {
  if (!await requireAdmin()) return apiError('Admin access is required.', 403);
  return privateJson({ config: await loadJukebox() });
}
export async function PUT(request: Request) {
  if (!sameOriginMutation(request)) return apiError('This request could not be verified.', 403);
  const admin = await requireAdmin();
  if (!admin) return apiError('Admin access is required.', 403);
  const body = await readJsonBody(request, 80_000);
  const config = validateJukeboxConfig(body?.config);
  if (!config) return apiError('Periksa judul, urutan, file audio, volume, dan teks jukebox. Maksimal 20 lagu.');
  const audioIds = [...new Set(config.tracks.map(track => uploadedAudioId(track.src)).filter((id): id is string => !!id))];
  if (audioIds.length) {
    const found = await db().prepare(`SELECT key FROM settings WHERE key IN (${audioIds.map(() => '?').join(',')})`)
      .bind(...audioIds.map(id => `jukebox.audio.${id}`)).all<{ key: string }>();
    if (found.results.length !== audioIds.length) return apiError('Ada file audio yang belum terunggah. Upload file sebelum menyimpan playlist.');
  }
  if (!await allowMutation('jukebox-config', admin.userId, 30, 60_000)) return apiError('Tunggu sebentar sebelum menyimpan lagi.', 429);
  await db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP')
    .bind(JUKEBOX_SETTING, JSON.stringify(config)).run();
  return privateJson({ ok: true, config });
}
