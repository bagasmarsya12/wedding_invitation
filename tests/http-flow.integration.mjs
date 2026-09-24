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
  for (const file of ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql"]) migrate(file);
  const [a, b] = [randomInviteToken(), randomInviteToken()];
  sql(`INSERT INTO guests (id, token_hash, display_name, party_limit) VALUES
    ('fixture-a','${await sha256(a)}','Fixture A',2),('fixture-b','${await sha256(b)}','Fixture B',1);
    INSERT INTO gifts (id,title,recipient_category,shipping_required) VALUES
    ('fixture-gift','Fixture Gift','home',0),('fixture-shipping','Fixture Shipping','home',1);
    INSERT INTO settings (key,value) VALUES ('shipping_instructions','PRIVATE FIXTURE ADDRESS');`);
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

    const mark = await response(base, `/api/invite/${a}/marks`, "POST", { message: "Fixture mark", visibility: "public" });
    assert.equal(mark.status, 201);
    assert.equal((await response(base, "/api/marks")).data.marks.length, 0);
    sql("UPDATE guest_marks SET moderation_status = 'approved' WHERE guest_id = 'fixture-a';");
    assert.equal((await response(base, "/api/marks")).data.marks.length, 1);
    console.log("pending mark and public moderation filter: OK");

    sql("INSERT INTO settings (key,value) VALUES ('site_phase','post-wedding') ON CONFLICT(key) DO UPDATE SET value='post-wedding';");
    assert.equal((await response(base, "/api/site-state")).data.phase, "post-wedding");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 403);
    sql("INSERT INTO settings (key,value) VALUES ('rsvp_enabled','on') ON CONFLICT(key) DO UPDATE SET value='on';");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 200);
    console.log("post-wedding RSVP closure and admin override: OK");
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
