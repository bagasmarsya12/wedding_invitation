import test from "node:test";
import assert from "node:assert/strict";
import { invitationClock } from "../lib/invitation-clock.ts";
import { hasPublicContent, PROFILE_ENABLED, USEFUL_BITS, BEYOND_DESTINATIONS, THE_MARK_PROCESS_MATERIALS } from "../lib/public-content.ts";

test("countdown updates at Jakarta midnight and uses sentence case", () => {
  assert.equal(invitationClock(new Date("2026-09-30T17:00:00Z")).countdown, "31 days away.");
  assert.equal(invitationClock(new Date("2026-10-01T16:59:59Z")).countdown, "31 days away.");
  assert.equal(invitationClock(new Date("2026-10-01T17:00:00Z")).countdown, "30 days away.");
  assert.equal(invitationClock(new Date("2026-10-01T17:00:00Z"), undefined, "id").countdown, "30 hari lagi.");
});

test("countdown handles tomorrow, today, the past and existing phase overrides", () => {
  assert.equal(invitationClock(new Date("2026-10-30T17:00:00Z")).countdown, "tomorrow.");
  assert.equal(invitationClock(new Date("2026-10-31T17:00:00Z")).countdown, "today.");
  assert.equal(invitationClock(new Date("2026-11-01T17:00:00Z")).countdown, "we’re married.");
  assert.equal(invitationClock(new Date("2026-10-01"), "wedding-day").state, "today");
  assert.equal(invitationClock(new Date("2026-10-01"), "post-wedding").state, "past");
});

test("public content guard rejects empty and unfinished content", () => {
  for (const value of [null, undefined, "", "  ", "To be added", "Coming soon", "Coming later", "Details to follow", "Still choosing", "The story is coming", "Story coming", "Photograph to come", "Original sketches and iterations can be added here later."]) assert.equal(hasPublicContent(value), false, String(value));
  assert.equal(hasPublicContent("A B embracing a bending I."), true);
  assert.equal(hasPublicContent("Jl. Sirnarasa No.11, Cibabat."), true);
});

test("approved profile templates stay enabled and unfinished collections stay hidden", () => {
  assert.equal(PROFILE_ENABLED, true);
  assert.equal(USEFUL_BITS.length, 5);
  assert.deepEqual(USEFUL_BITS.filter(item => item.confirmed && hasPublicContent(item.body)).map(item => item.title), ["Address and entrance"]);
  assert.deepEqual(BEYOND_DESTINATIONS.filter(item => item.available).map(item => item.href), ["/archive"]);
  assert.equal(THE_MARK_PROCESS_MATERIALS.length, 0);
});
