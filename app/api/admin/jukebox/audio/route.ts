import { allowMutation, apiError, bucket, db, privateJson, requireAdmin, sameOriginMutation } from '@/lib/server';
import { MAX_AUDIO_BYTES } from '@/lib/jukebox-playlist';
import { audioKind } from '@/lib/jukebox-media';

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) return apiError('This request could not be verified.', 403);
  const admin = await requireAdmin();
  if (!admin) return apiError('Admin access is required.', 403);
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_AUDIO_BYTES + 64 * 1024) return apiError('Audio maksimal 20 MB per lagu.', 413);
  if (!await allowMutation('jukebox-upload', admin.userId, 30, 60_000)) return apiError('Tunggu sebentar sebelum upload lagi.', 429);
  let form: FormData;
  try { form = await request.formData(); }
  catch { return apiError('Upload harus berisi file audio.'); }
  const file = form.get('file');
  if (!(file instanceof File)) return apiError('Pilih file MP3 atau M4A.');
  if (file.size > MAX_AUDIO_BYTES) return apiError('Audio maksimal 20 MB per lagu.', 413);
  const kind = audioKind(file.name, new Uint8Array(await file.slice(0, 64).arrayBuffer()), file.size);
  if (!kind) return apiError('Gunakan file MP3 atau M4A yang valid.', 415);
  const id = crypto.randomUUID(), key = `jukebox/audio/${id}.${kind.ext}`;
  try {
    await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: kind.type, cacheControl: 'public, max-age=31536000, immutable' } });
    await db().prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)')
      .bind(`jukebox.audio.${id}`, JSON.stringify({ key, type: kind.type, size: file.size, name: file.name.slice(0, 180) })).run();
    return privateJson({ ok: true, id, src: `/api/jukebox/audio/${id}`, size: file.size, name: file.name.slice(0, 180) }, 201);
  } catch {
    return apiError('Audio gagal diunggah. Coba lagi.', 500);
  }
}
