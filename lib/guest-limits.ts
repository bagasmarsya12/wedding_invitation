// Household and family invitations can allocate up to 100 places.
export const MAX_GUEST_PARTY_LIMIT = 100;

export function validGuestPartyLimit(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_GUEST_PARTY_LIMIT;
}
