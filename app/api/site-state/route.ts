import { phaseForDate } from "@/lib/production";
import { featureEnabled, logFailure, privateJson, sitePhase } from "@/lib/server";

export async function GET() {
  try {
    const [phase, rsvpEnabled, giftsEnabled, marksEnabled] = await Promise.all([
      sitePhase(), featureEnabled("rsvp"), featureEnabled("gifts"), featureEnabled("marks"),
    ]);
    return privateJson({ phase, rsvpEnabled, giftsEnabled, marksEnabled });
  } catch (error) {
    logFailure("site_state", error);
    return privateJson({ phase: phaseForDate(new Date()), rsvpEnabled: false, giftsEnabled: false, marksEnabled: false });
  }
}
