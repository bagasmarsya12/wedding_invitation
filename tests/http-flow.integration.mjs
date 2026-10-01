// Runs only against an isolated local Wrangler database. Requires `npm run build` first.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { randomInviteToken, sha256 } from "../lib/production.ts";

const root = new URL("..", import.meta.url).pathname;
const wrangler = join(root, "node_modules/wrangler/bin/wrangler.js");
const config = join(root, "dist/server/wrangler.json");
const state = await mkdtemp(join(tmpdir(), "bagas-iga-integration-"));
let server;

function wranglerCommand(...args) {
  return execFileSync(process.execPath, [wrangler, ...args, "--local", "--config", config, "--persist-to", state], { cwd: root, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
}

function sql(command) { return wranglerCommand("d1", "execute", "DB", "--command", command); }
function migrate(file) { return wranglerCommand("d1", "execute", "DB", "--file", join(root, "drizzle", file)); }
async function port() {
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const value = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return value;
}
async function response(base, path, method = "GET", body) {
  const result = await fetch(new URL(path, base), { method, redirect: "manual", headers: body ? { "content-type": "application/json", origin: base } : undefined, body: body ? JSON.stringify(body) : undefined });
  let data;
  try { data = await result.json(); } catch { data = null; }
  return { status: result.status, headers: result.headers, data };
}
async function waitFor(base) {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Local Worker exited with ${server.exitCode}`);
    try { if ((await fetch(new URL("/api/site-state", base))).ok) return; } catch { /* Startup in progress. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Local Worker did not start in time.");
}

try {
  for (const file of ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql", "0003_guest_mark_style.sql", "0004_guest_mark_font.sql"]) migrate(file);
  const [a, b] = [randomInviteToken(), randomInviteToken()];
  sql(`INSERT INTO guests (id, token_hash, display_name, party_limit) VALUES
    ('fixture-a','${await sha256(a)}','Fixture A',2),('fixture-b','${await sha256(b)}','Fixture B',1);
    INSERT INTO gifts (id,title,recipient_category,shipping_required) VALUES
    ('fixture-gift','Fixture Gift','home',0),('fixture-shipping','Fixture Shipping','home',1);
    INSERT INTO settings (key,value) VALUES ('shipping_instructions','PRIVATE FIXTURE ADDRESS');`);
  if (process.env.ARCHIVE_BROWSER_QA === "1") {
    const longExcerpt = "Browser fixture excerpt for native reading scroll. ".repeat(45);
    const paragraphs = Array.from({ length:18 }, (_, index) => `Original fixture paragraph ${index + 1}. This text exists only in the ephemeral test database.`).join("\n");
    sql(`INSERT INTO archive_entries (id,slug,type,title,excerpt,story,media_url,visibility,published) VALUES
      ('archive-photo','fixture-photo','photograph','Browser fixture photograph','Original fixture caption.','Original fixture photograph story.','/assets/botanicals/melastoma/branch-short.webp','public',1),
      ('archive-object','fixture-object','object','Browser fixture object',NULL,NULL,NULL,'public',1),
      ('archive-note','fixture-note','note','Browser fixture with a deliberately long title to check reading layout','${longExcerpt}','${paragraphs}',NULL,'public',1),
      ('archive-conversation','fixture-conversation','conversation','Browser fixture conversation','Original fixture excerpt.','Original fixture conversation text.','/archive-fixture-missing.webp','public',1),
      ('archive-audio','fixture-audio','audio','Browser fixture audio','Audio fixture only.',NULL,'/archive-fixture-audio.wav','public',1),
      ('archive-secret','fixture-secret','note','SECRET ARCHIVE FIXTURE',NULL,'Secret fixture text.',NULL,'guests',1),
      ('archive-draft','fixture-draft','note','SECRET ARCHIVE FIXTURE DRAFT',NULL,'Draft fixture text.',NULL,'public',0);`);
  }
  const listenPort = await port();
  const base = `http://127.0.0.1:${listenPort}`;
  server = spawn(process.execPath, [wrangler, "dev", "--config", config, "--local", "--persist-to", state, "--ip", "127.0.0.1", "--port", String(listenPort), "--inspector-port", "0"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let serverLog = "";
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { serverLog = (serverLog + chunk.toString()).slice(-10_000); });
  try {
    await waitFor(base);
    assert.equal((await response(base, "/api/admin/state")).status, 403);
    assert.equal((await response(base, "/api/invite/invalid-token/rsvp")).status, 404);
    const invite = await fetch(new URL(`/invite/${a}`, base));
    assert.equal(invite.status, 200);
    assert.match(invite.headers.get("cache-control") || "", /no-store/);
    assert.match(invite.headers.get("x-robots-tag") || "", /noindex/);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 3 })).status, 400);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 2 })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`)).data.rsvp.party_size, 2);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "no", partySize: 0 })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`)).data.rsvp.attendance, "no");
    assert.equal((await response(base, `/api/invite/${b}/rsvp`)).data.rsvp, null);
    // Attendance-only replies preserve private legacy notes and an existing
    // explicit count. New answers use only the server-owned party allocation.
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance:"yes",partySize:1,guestNames:"Private fixture names",dietary:"Private fixture needs",message:"Private RSVP note" })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance:"yes" })).status, 200);
    const preserved = (await response(base, `/api/invite/${a}/rsvp`)).data.rsvp;
    assert.equal(preserved.party_size, 1);
    assert.equal(preserved.guest_names, "Private fixture names");
    assert.equal(preserved.dietary, "Private fixture needs");
    assert.equal(preserved.message, "Private RSVP note");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance:"no" })).status, 200);
    const declined = (await response(base, `/api/invite/${a}/rsvp`)).data.rsvp;
    assert.equal(declined.party_size, 0);
    assert.equal(declined.dietary, "Private fixture needs");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance:"yes" })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/rsvp`)).data.rsvp.party_size, 2);
    assert.equal((await response(base, `/api/invite/${b}/rsvp`, "POST", { attendance:"yes" })).status, 200);
    assert.equal((await response(base, `/api/invite/${b}/rsvp`)).data.rsvp.party_size, 1);
    assert.match((await response(base, `/api/invite/${a}/rsvp`)).headers.get("cache-control"), /private.*no-store/);
    console.log("guest identity and RSVP: OK");

    const race = await Promise.all([a, b].map(token => response(base, `/api/invite/${token}/gifts`, "POST", { action: "reserve", giftId: "fixture-gift" })));
    assert.deepEqual(race.map(item => item.status).sort(), [200, 409]);
    const winner = race[0].status === 200 ? a : b;
    const loser = winner === a ? b : a;
    assert.equal((await response(base, `/api/invite/${winner}/gifts`)).data.shippingInstructions, null);
    assert.equal((await response(base, `/api/invite/${loser}/gifts`)).data.gifts[0].reservedByYou, false);
    assert.equal((await response(base, `/api/invite/${winner}/gifts`, "POST", { action: "release", giftId: "fixture-gift" })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/gifts`, "POST", { action: "reserve", giftId: "fixture-shipping" })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/gifts`)).data.shippingInstructions, "PRIVATE FIXTURE ADDRESS");
    assert.equal((await response(base, `/api/invite/${b}/gifts`)).data.shippingInstructions, null);
    assert.equal((await response(base, `/api/invite/${a}/gifts`, "POST", { action: "purchased", giftId: "fixture-shipping" })).status, 200);
    assert.equal((await response(base, `/api/invite/${a}/gifts`)).data.shippingInstructions, "PRIVATE FIXTURE ADDRESS");
    console.log("exclusive gift reservation and shipping privacy: OK");

    const drawing = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=";
    const mark = await response(base, `/api/invite/${a}/marks`, "POST", { message: "Fixture mark", drawing });
    assert.equal(mark.status, 201);
    assert.equal((await response(base, "/api/marks")).data.marks.length, 0);
    const ownMark = (await response(base, `/api/invite/${a}/marks`)).data.marks[0];
    assert.ok(ownMark.drawing.startsWith(`/api/invite/${a}/marks/`));
    assert.ok(!ownMark.drawing.startsWith("data:"), "Own drawings must not inflate the JSON response");
    const ownImage = await fetch(new URL(ownMark.drawing, base));
    assert.equal(ownImage.status, 200);
    assert.match(ownImage.headers.get("cache-control"), /private.*no-store/);
    assert.equal(ownImage.headers.get("content-type"), "image/png");
    assert.equal((await fetch(new URL(ownMark.drawing.replace(a, b), base))).status, 404);
    assert.equal((await fetch(new URL(`/api/marks/${ownMark.id}/image`, base))).status, 404);
    sql("UPDATE guest_marks SET moderation_status = 'approved' WHERE guest_id = 'fixture-a';");
    assert.equal((await response(base, "/api/marks")).data.marks.length, 1);
    assert.equal((await fetch(new URL(`/api/marks/${ownMark.id}/image`, base))).status, 200);
    console.log("pending mark, owner-only drawing URLs and public moderation filter: OK");

    // Equal timestamps exercise the id tie-breaker. Approved fixture rows are
    // inserted only into this test's isolated database, never the user's data.
    sql(`INSERT INTO guests (id,token_hash,display_name,party_limit) VALUES
      ('fixture-c','pagination-c','Fixture C',1),('fixture-d','pagination-d','Fixture D',1);
      INSERT INTO guest_marks (id,guest_id,author_name,message,visibility,moderation_status,created_at,updated_at) VALUES
      ('mark_page1','fixture-c','Fixture C','One','public','approved','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'),
      ('mark_page2','fixture-c','Fixture C','Two','public','approved','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'),
      ('mark_page3','fixture-c','Fixture C','Three','public','approved','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'),
      ('mark_page4','fixture-d','Fixture D','Four','public','approved','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z'),
      ('mark_page5','fixture-d','Fixture D','Five','public','approved','2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z');`);
    const ids = [];
    let cursor = null;
    do {
      const page = await response(base, `/api/marks?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      assert.equal(page.status, 200);
      ids.push(...page.data.marks.map(item => item.id));
      cursor = page.data.nextCursor;
      assert.ok(ids.length <= 6, "Pagination must terminate without repeating a page");
    } while (cursor);
    assert.equal(ids.length, 6);
    assert.equal(new Set(ids).size, 6);
    assert.equal((await response(base, "/api/marks?cursor=invalid")).status, 400);
    console.log("public wall pagination: all approved cards, no duplicates or omissions: OK");

    sql("INSERT INTO settings (key,value) VALUES ('site_phase','post-wedding') ON CONFLICT(key) DO UPDATE SET value='post-wedding';");
    assert.equal((await response(base, "/api/site-state")).data.phase, "post-wedding");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 403);
    sql("INSERT INTO settings (key,value) VALUES ('rsvp_enabled','on') ON CONFLICT(key) DO UPDATE SET value='on';");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 200);
    console.log("post-wedding RSVP closure and admin override: OK");
    if (process.env.ARCHIVE_BROWSER_QA === "1") {
      assert.equal((await fetch(new URL("/archive/fixture-secret",base))).status,404);
      assert.equal((await fetch(new URL("/archive/fixture-draft",base))).status,404);
      const output = execFileSync(process.env.ARCHIVE_QA_PYTHON || "python3", ["tests/archive-room-qa.py"], {
        cwd:root, timeout:180_000, encoding:"utf8",
        env:{ ...process.env, GARDEN_QA_URL:base, ARCHIVE_FIXTURE:"1" },
      });
      console.log(output.trim());
    }
    if (process.env.REPLY_BROWSER_QA === "1") {
      sql("UPDATE settings SET value='pre-wedding' WHERE key='site_phase';");
      const output = execFileSync(process.env.REPLY_QA_PYTHON || "python3", ["tests/reply-studio-qa.py"], {
        cwd:root, timeout:180_000, encoding:"utf8",
        env:{ ...process.env, GARDEN_QA_URL:base, REPLY_QA_TOKEN:b },
      });
      console.log(output.trim());
    }
    if (process.env.GIFT_BROWSER_QA === "1") {
      sql("UPDATE settings SET value='pre-wedding' WHERE key='site_phase';");
      const output = execFileSync(process.env.GIFT_QA_PYTHON || "python3", ["tests/gifts-scene-qa.py"], {
        cwd:root, timeout:180_000, encoding:"utf8",
        env:{ ...process.env, GARDEN_QA_URL:base, GIFT_QA_TOKEN:b },
      });
      console.log(output.trim());
    }
    if (process.env.CLOSING_BROWSER_QA === "1") {
      sql("UPDATE settings SET value='pre-wedding' WHERE key='site_phase';");
      const output = execFileSync(process.env.CLOSING_QA_PYTHON || "python3", ["tests/closing-performance-qa.py"], {
        cwd:root, timeout:180_000, encoding:"utf8", env:{ ...process.env, GARDEN_QA_URL:base },
      });
      console.log(output.trim());
    }
  } catch (error) {
    console.error(serverLog);
    throw error;
  }
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (state.startsWith(join(tmpdir(), "bagas-iga-integration-"))) await rm(state, { recursive: true, force: true });
}
