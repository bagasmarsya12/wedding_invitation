import QRCode from "qrcode";
import { apiError, db, guestFromToken, logFailure, privateJson, sha256 } from "@/lib/server";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const guest = await guestFromToken(token);
    if (!guest) return apiError("Invitation not found.", 404);
    const hash = await sha256(token);
    let pass = await db().prepare("SELECT id FROM guest_passes WHERE guest_id = ? AND token_hash = ?").bind(guest.id, hash).first<{ id: string }>();
    if (!pass) {
      const id = crypto.randomUUID().replace(/-/g, "");
      await db().prepare(`INSERT INTO guest_passes (id, guest_id, token_hash) VALUES (?, ?, ?)
        ON CONFLICT(guest_id) DO UPDATE SET id = excluded.id, token_hash = excluded.token_hash, updated_at = CURRENT_TIMESTAMP
        WHERE guest_passes.token_hash <> excluded.token_hash`)
        .bind(id, guest.id, hash).run();
      pass = await db().prepare("SELECT id FROM guest_passes WHERE guest_id = ? AND token_hash = ?").bind(guest.id, hash).first<{ id: string }>();
    }
    if (!pass) throw new Error("Guest pass unavailable");
    const passUrl = new URL(`/check-in/${pass.id}`, request.url).toString();
    const svg = await QRCode.toString(passUrl, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 512, color: { dark: "#16271d", light: "#ffffff" } });
    return privateJson({ code: pass.id, guestName: guest.display_name, partyLimit: guest.party_limit, passUrl, qrData: `data:image/svg+xml;base64,${btoa(svg)}` });
  } catch (error) { logFailure("guest_pass", error); return apiError("Guest pass is temporarily unavailable. Please try again.", 503); }
}
