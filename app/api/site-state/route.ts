import { db } from "@/lib/server";

export async function GET() {
  let phase = "pre-wedding";
  try {
    const setting = await db().prepare("SELECT value FROM settings WHERE key = 'site_phase' LIMIT 1").first<{ value: string }>();
    if (setting && ["pre-wedding", "wedding-day", "post-wedding"].includes(setting.value)) phase = setting.value;
  } catch { /* Keep the safe pre-wedding default. */ }
  return Response.json({ phase });
}
