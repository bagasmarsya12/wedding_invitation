'use client';

import { useEffect, useState } from 'react';

export type SiteState = { phase?: string; rsvpEnabled?: boolean; giftsEnabled?: boolean; marksEnabled?: boolean };

/** Refresh on the minute and on return from a background tab, including midnight. */
export function useSiteState(enabled = true) {
  const [siteState, setSiteState] = useState<SiteState | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let fetching = false;
    const refresh = async () => {
      setNow(new Date());
      if (fetching) return;
      fetching = true;
      try {
        const response = await fetch('/api/site-state', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Site state unavailable');
        const state = await response.json() as SiteState;
        if (!controller.signal.aborted) setSiteState(state);
      } catch {
        if (!controller.signal.aborted) setSiteState({ rsvpEnabled: false, giftsEnabled: false, marksEnabled: false });
      } finally { fetching = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [enabled]);
  return { siteState, now };
}
