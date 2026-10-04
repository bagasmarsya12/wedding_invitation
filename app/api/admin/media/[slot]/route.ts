import { bucket, db, requireAdmin, sameOriginMutation, privateJson, allowMutation } from "@/lib/server";

export const runtime = "nodejs";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Admin-only image upload to R2. The R2 object key is fixed per slot
 * (`content/<slot>.<ext>`) and the setting `media.<slot>` records the key,
 * so consumers always read /api/admin/media/<slot> — the etag query busts caches.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  if (!sameOriginMutation(request)) return privateJson({ error: "This request could not be verified." }, 403);
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Admin access is required." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Upload must be multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  const slot = (await params).slot.trim();
  if (!(file instanceof File)) return Response.json({ error: "Field 'file' is required." }, { status: 400 });
  if (!/^[a-z0-9-]{1,60}$/.test(slot)) return Response.json({ error: "Field 'slot' must be a slug (a-z, 0-9, -)." }, { status: 400 });
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return Response.json({ error: "Only JPEG, PNG, WebP, or AVIF images are allowed." }, { status: 415 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Image is larger than 5 MB." }, { status: 413 });
  if (!(await allowMutation("media", admin.userId, 30, 60_000))) return privateJson({ error: "Please slow down and try again shortly." }, 429);

  try {
    const body = await file.arrayBuffer();
    const key = `content/${slot}.${ext}`;
    const put = await bucket().put(key, body, {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=3600" },
    });
    const etag = (put as { etag?: string }).etag ?? String(Date.now());
    const url = `/api/admin/media/${slot}?v=${encodeURIComponent(etag)}`;
    await db().prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    ).bind(`media.${slot}`, key, new Date().toISOString()).run();
    return Response.json({ ok: true, key, url });
  } catch (error) {
    console.error(JSON.stringify({ action: "admin_media_upload", error: error instanceof Error ? error.name : "Unknown" }));
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}

/** Public read of an uploaded slot image (kept keyed off the private bucket). */
export async function DELETE(request:Request,{params}:{params:Promise<{slot:string}>}) {
  if(!sameOriginMutation(request)) return privateJson({error:'This request could not be verified.'},403);
  const admin=await requireAdmin();
  if(!admin) return privateJson({error:'Admin access is required.'},403);
  const {slot}=await params;
  if(!/^[a-z0-9-]{1,60}$/.test(slot)) return privateJson({error:'Invalid photo slot.'},400);
  if(!await allowMutation('media',admin.userId,30,60_000)) return privateJson({error:'Please wait before updating another image.'},429);
  // Keep the old R2 object for recovery; clearing its mapping restores the placeholder.
  await db().prepare('DELETE FROM settings WHERE key=?').bind(`media.${slot}`).run();
  return privateJson({ok:true});
}

export async function GET(request: Request) {
  const slot = (new URL(request.url).pathname.split("/").pop() ?? "").replace(/[^a-z0-9-]/g, "");
  if (!slot) return new Response("Not found", { status: 404 });
  const setting = await db().prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").bind(`media.${slot}`).first<{ value: string }>();
  if (!setting?.value) return new Response("Not found", { status: 404 });
  const object = await bucket().get(setting.value);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/webp",
      "cache-control": "public, max-age=300",
    },
  });
}
