/** Random first-party identifiers, never a hardware fingerprint. */
export const VISIT_BROWSER_KEY = 'bagas-iga:browser:v1';
export const VISIT_SESSION_KEY = 'bagas-iga:visit:v1';
const sessionLifetime = 30 * 60_000;
type VisitStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function validVisitId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}

export function browserVisitId(storage: VisitStorage, createId: () => string): string | null {
  try {
    const saved = storage.getItem(VISIT_BROWSER_KEY);
    if (validVisitId(saved)) return saved;
    const id = createId();
    storage.setItem(VISIT_BROWSER_KEY, id);
    // A denied or non-persistent store must not turn every visit into a new device.
    return storage.getItem(VISIT_BROWSER_KEY) === id ? id : null;
  } catch { return null; }
}

export function visitSession(storage: VisitStorage, token: string, now: number, createId: () => string) {
  let id = createId();
  try {
    let saved;
    try { saved = JSON.parse(storage.getItem(VISIT_SESSION_KEY) || 'null'); } catch { saved = null; }
    if (validVisitId(saved?.id) && typeof saved.at === 'number' && now >= saved.at && now - saved.at < sessionLifetime) {
      id = saved.id;
      if (!token && typeof saved.token === 'string') token = saved.token;
    }
    storage.setItem(VISIT_SESSION_KEY, JSON.stringify({id, at: now, token}));
  } catch { /* Session attribution is optional when storage is blocked. */ }
  return {session: id, token};
}

export function deviceCountLabel(row: Record<string, unknown>): string {
  if (!Number(row.sessions)) return '0';
  if (!Number(row.devices)) return 'Belum tercatat';
  return `${Number(row.unidentified_sessions) ? '≥ ' : ''}${Number(row.devices)}`;
}

/** Shared by the directory, activity report and CSV so their counts agree. */
export const guestVisitSummarySql = `SELECT guest_id, MIN(first_at) first_at, MAX(last_at) last_at,
  COUNT(DISTINCT session_hash) sessions, SUM(views) views,
  SUM(CASE WHEN page = 'invitation' THEN views ELSE 0 END) link_opens,
  COUNT(DISTINCT device_hash) devices,
  COUNT(DISTINCT CASE WHEN device_hash IS NULL THEN session_hash END) unidentified_sessions
  FROM page_visits WHERE guest_id IS NOT NULL GROUP BY guest_id`;
