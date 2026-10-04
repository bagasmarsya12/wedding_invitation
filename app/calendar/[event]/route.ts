import { weddingCalendarEvent, weddingCalendarFile } from "@/lib/wedding-calendar";

import { loadWebsite } from "@/lib/website-server";

export async function GET(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const {config}=await loadWebsite();
  const event = weddingCalendarEvent((await params).event,config);
  if (!event) return new Response("Calendar event not found.", { status: 404 });
  const language = new URL(request.url).searchParams.get("lang") === "id" ? "id" : "en";
  return new Response(weddingCalendarFile(event, language,new Date(),config), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bagas-iga-${event.key}.ics"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
