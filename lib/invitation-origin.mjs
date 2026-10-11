const productionOrigins = new Set([
  'https://iganyabagas.com',
  'https://bagas-iga-wedding.bagasmarsya.workers.dev',
]);

/**
 * Existing invitations and QR passes can cross the two hosts of the same Worker.
 * Preview/local deployments still accept only their own origin.
 * @param {string} candidate
 * @param {string} current
 * @returns {boolean}
 */
export function isInvitationOrigin(candidate, current) {
  return candidate === current || (productionOrigins.has(current) && productionOrigins.has(candidate));
}
