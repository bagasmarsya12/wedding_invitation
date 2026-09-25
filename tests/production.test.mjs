import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { csvCell, parseCsv, phaseForDate, pngDimensions, randomInviteToken, safeExternalUrl, safeMediaUrl, sha256, toCsv, validateRsvp } from "../lib/production.ts";

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql", "0003_guest_mark_style.sql"]) {
    for (const statement of readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) db.exec(statement);
    }
  }
  return db;
}

function guest(db, id) {
  db.prepare("INSERT INTO guests (id, token_hash, display_name) VALUES (?, ?, ?)").run(id, id.padEnd(64, "x"), id);
}

test("invitation token is opaque, unique, and only its hash need be stored", async () => {
  const tokens = Array.from({ length: 200 }, randomInviteToken);
  assert.equal(new Set(tokens).size, tokens.length);
  assert.ok(tokens.every(token => /^[A-Za-z0-9_-]{32}$/.test(token)));
  assert.equal((await sha256(tokens[0])).length, 64);
  assert.notEqual(await sha256(tokens[0]), tokens[0]);
});

test("Jakarta lifecycle respects local date boundary and admin override", () => {
  assert.equal(phaseForDate(new Date("2026-10-31T16:59:59Z")), "pre-wedding");
  assert.equal(phaseForDate(new Date("2026-10-31T17:00:00Z")), "wedding-day");
  assert.equal(phaseForDate(new Date("2026-11-01T17:00:00Z")), "post-wedding");
  assert.equal(phaseForDate(new Date("2026-12-01T00:00:00Z"), "pre-wedding"), "pre-wedding");
  assert.equal(phaseForDate(new Date("2026-12-01T00:00:00Z"), "auto"), "post-wedding");
});

test("RSVP validation rejects over-limit and noninteger parties", () => {
  assert.deepEqual(validateRsvp("yes", 2, 2), { attendance: "yes", partySize: 2 });
  assert.deepEqual(validateRsvp("no", 99, 2), { attendance: "no", partySize: 0 });
  assert.equal(validateRsvp("yes", 3, 2), null);
  assert.equal(validateRsvp("yes", 1.5, 2), null);
  assert.equal(validateRsvp("yes", "2", 2), null);
  assert.equal(validateRsvp("unknown", 1, 2), null);
});

test("RSVP remains one authoritative record per invitation", () => {
  const db = database();
  guest(db, "guest-a");
  db.prepare("INSERT INTO rsvps (id, guest_id, attendance, party_size) VALUES (?, ?, ?, ?)").run("r1", "guest-a", "yes", 2);
  db.prepare("INSERT INTO rsvps (id, guest_id, attendance, party_size) VALUES (?, ?, ?, ?) ON CONFLICT(guest_id) DO UPDATE SET attendance = excluded.attendance, party_size = excluded.party_size").run("r2", "guest-a", "no", 0);
  assert.deepEqual({ ...db.prepare("SELECT attendance, party_size FROM rsvps WHERE guest_id = ?").get("guest-a") }, { attendance: "no", party_size: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rsvps").get().count, 1);
  db.close();
});

test("gift conditional reservation excludes a racing second guest and unique active history", () => {
  const db = database();
  guest(db, "guest-a"); guest(db, "guest-b");
  db.prepare("INSERT INTO gifts (id, title, recipient_category) VALUES (?, ?, ?)").run("gift-a", "Fixture", "home");
  const claim = db.prepare("UPDATE gifts SET status = 'reserved', reserved_by_guest_id = ? WHERE id = ? AND status = 'available'");
  assert.equal(claim.run("guest-a", "gift-a").changes, 1);
  assert.equal(claim.run("guest-b", "gift-a").changes, 0);
  db.prepare("INSERT INTO gift_reservations (id, gift_id, guest_id) VALUES (?, ?, ?)").run("r1", "gift-a", "guest-a");
  assert.throws(() => db.prepare("INSERT INTO gift_reservations (id, gift_id, guest_id) VALUES (?, ?, ?)").run("r2", "gift-a", "guest-b"));
  db.prepare("UPDATE gift_reservations SET status = 'released' WHERE id = ?").run("r1");
  db.prepare("INSERT INTO gift_reservations (id, gift_id, guest_id) VALUES (?, ?, ?)").run("r2", "gift-a", "guest-b");
  db.close();
});

test("mark quota and moderation constraint are enforced in the database", () => {
  const db = database();
  guest(db, "guest-a");
  const insert = db.prepare("INSERT INTO guest_marks (id, guest_id, author_name, moderation_status) VALUES (?, ?, ?, ?)");
  for (let i = 1; i <= 3; i++) insert.run(`m${i}`, "guest-a", "Fixture", "pending");
  assert.throws(() => insert.run("m4", "guest-a", "Fixture", "pending"), /active mark limit/);
  insert.run("m4", "guest-a", "Fixture", "rejected");
  assert.throws(() => db.prepare("UPDATE guest_marks SET moderation_status = 'approved' WHERE id = 'm4'").run(), /active mark limit/);
  db.close();
});

test("PNG validation checks bytes and canvas dimensions, not only a data URL label", () => {
  const png = new Uint8Array(33);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(8, 13);
  png.set([73, 72, 68, 82], 12);
  new DataView(png.buffer).setUint32(16, 1200);
  new DataView(png.buffer).setUint32(20, 800);
  assert.deepEqual(pngDimensions(png), { width: 1200, height: 800 });
  new DataView(png.buffer).setUint32(16, 3000);
  assert.equal(pngDimensions(png), null);
  png[0] = 0;
  assert.equal(pngDimensions(png), null);
});

test("CSV import parser handles quoting, formula escaping, and bound limits", () => {
  assert.deepEqual(parseCsv('displayName,partyLimit\r\n"Bagas, Family",3\r\n'), [["displayName", "partyLimit"], ["Bagas, Family", "3"]]);
  assert.equal(parseCsv('displayName,partyLimit\n"unclosed,2'), null);
  assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.ok(toCsv([["Guest", "Link"], ["Name", "https://example.test"]]).startsWith("\uFEFF"));
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("http://example.test"), null);
  assert.equal(safeExternalUrl("https://example.test/a"), "https://example.test/a");
  assert.equal(safeMediaUrl("/assets/botanicals/combretum/flower.webp"), "/assets/botanicals/combretum/flower.webp");
  assert.equal(safeMediaUrl("/assets/../../private"), null);
});
