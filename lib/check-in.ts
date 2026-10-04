import { db } from "./server";
export type Arrival = { partySize: number; at: string; by: string; method: "qr" | "name" };
export type CheckInGuest = { code: string | null; guestId: string; name: string; group: string; partyLimit: number; attendance: string | null; expectedParty: number | null; arrival: Arrival | null };
export type GuestSearchHit = Pick<CheckInGuest, "guestId" | "name" | "group" | "partyLimit"> & { arrived: boolean };
export type ArrivalSummary = {
  activeInvitations: number; expectedPeople: number; arrivedInvitations: number; arrivedPeople: number; pendingInvitations: number;
  updatedAt: string; recent: { guestId: string; name: string; partySize: number; at: string; method: string }[];
};
const guestSelect = `SELECT p.id AS code, g.id, g.display_name, g.guest_group, g.party_limit, r.attendance, r.party_size AS expected_party,
  c.party_size AS arrived_party, c.checked_in_at, c.checked_in_by, c.checkin_method FROM guests g
  LEFT JOIN guest_passes p ON p.guest_id = g.id AND p.token_hash = g.token_hash
  LEFT JOIN rsvps r ON r.guest_id = g.id LEFT JOIN guest_checkins c ON c.guest_id = g.id`;
type GuestRow = { code: string | null; id: string; display_name: string; guest_group: string; party_limit: number; attendance: string | null; expected_party: number | null; arrived_party: number | null; checked_in_at: string | null; checked_in_by: string | null; checkin_method: "qr" | "name" | null };
async function loadGuest(where: string, value: string): Promise<CheckInGuest | null> {
  const row = await db().prepare(`${guestSelect} WHERE g.status = 'active' AND ${where} LIMIT 1`).bind(value).first<GuestRow>();
  return row ? { code: row.code, guestId: row.id, name: row.display_name, group: row.guest_group, partyLimit: row.party_limit,
    attendance: row.attendance, expectedParty: row.expected_party,
    arrival: row.checked_in_at ? { partySize: row.arrived_party!, at: row.checked_in_at, by: row.checked_in_by!, method: row.checkin_method || "qr" } : null } : null;
}
export const loadCheckInGuest = (code: string) => loadGuest("p.id = ?", code);
export const loadCheckInGuestById = (id: string) => loadGuest("g.id = ?", id);
export async function searchCheckInGuests(query: string, filter: string): Promise<{ guests: GuestSearchHit[]; limited: boolean }> {
  const pattern = `%${query.replace(/[\\%_]/g, character => `\\${character}`)}%`;
  const condition = filter === "pending" ? "AND c.guest_id IS NULL" : filter === "arrived" ? "AND c.guest_id IS NOT NULL" : "";
  const result = await db().prepare(`SELECT g.id, g.display_name, g.guest_group, g.party_limit, c.guest_id AS arrived
    FROM guests g LEFT JOIN guest_checkins c ON c.guest_id = g.id
    WHERE g.status = 'active' AND g.display_name LIKE ? ESCAPE '\\' ${condition}
    ORDER BY g.display_name COLLATE NOCASE, g.id LIMIT 26`).bind(pattern).all<{ id: string; display_name: string; guest_group: string; party_limit: number; arrived: string | null }>();
  return { guests: result.results.slice(0, 25).map(row => ({ guestId: row.id, name: row.display_name, group: row.guest_group, partyLimit: row.party_limit, arrived: Boolean(row.arrived) })), limited: result.results.length > 25 };
}
export async function arrivalSummary(): Promise<ArrivalSummary> {
  const [invited, arrived, recent] = await Promise.all([
    db().prepare(`SELECT COUNT(*) AS active, COALESCE(SUM(CASE WHEN r.attendance = 'yes' THEN r.party_size ELSE 0 END), 0) AS expected,
      COALESCE(SUM(CASE WHEN c.guest_id IS NULL THEN 1 ELSE 0 END), 0) AS pending
      FROM guests g LEFT JOIN rsvps r ON r.guest_id = g.id LEFT JOIN guest_checkins c ON c.guest_id = g.id WHERE g.status = 'active'`)
      .first<{ active: number; expected: number; pending: number }>(),
    db().prepare("SELECT COUNT(*) AS invitations, COALESCE(SUM(party_size), 0) AS people FROM guest_checkins").first<{ invitations: number; people: number }>(),
    db().prepare(`SELECT c.guest_id, g.display_name, c.party_size, c.checked_in_at, c.checkin_method
      FROM guest_checkins c JOIN guests g ON g.id = c.guest_id ORDER BY c.checked_in_at DESC, c.guest_id LIMIT 12`)
      .all<{ guest_id: string; display_name: string; party_size: number; checked_in_at: string; checkin_method: string }>(),
  ]);
  return { activeInvitations: invited?.active || 0, expectedPeople: invited?.expected || 0, pendingInvitations: invited?.pending || 0,
    arrivedInvitations: arrived?.invitations || 0, arrivedPeople: arrived?.people || 0, updatedAt: new Date().toISOString(),
    recent: recent.results.map(row => ({ guestId: row.guest_id, name: row.display_name, partySize: row.party_size, at: row.checked_in_at, method: row.checkin_method })) };
}
