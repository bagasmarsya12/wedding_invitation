// Isolated local admin flow using the starter's loopback-only mock sign-in.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const root = new URL("..", import.meta.url).pathname;
const wrangler = join(root, "node_modules/wrangler/bin/wrangler.js");
const config = join(root, "dist/server/wrangler.json");
const state = await mkdtemp(join(tmpdir(), "bagas-iga-admin-integration-"));
let server;

function migrate(file) {
  execFileSync(process.execPath, [wrangler, "d1", "execute", "DB", "--file", join(root, "drizzle", file), "--local", "--config", config, "--persist-to", state], { cwd: root, timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
}
async function port() {
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
  const value = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return value;
}
async function waitFor(base) {
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(`Vite exited with ${server.exitCode}`);
    try { if ((await fetch(new URL("/api/site-state", base))).ok) return; } catch { /* Startup in progress. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Local Vite server did not start in time.");
}
async function api(base, path, cookie, data) {
  const response = await fetch(new URL(path, base), { method: data ? "POST" : "GET", redirect: "manual", headers: { ...(cookie ? { cookie } : {}), ...(data ? { "content-type": "application/json", origin: base } : {}) }, body: data ? JSON.stringify(data) : undefined });
  let body;
  try { body = await response.json(); } catch { body = null; }
  return { status: response.status, body, headers: response.headers };
}

try {
  for (const file of ["0000_cooing_anthem.sql", "0001_flat_mephistopheles.sql", "0002_brainy_robbie_robertson.sql", "0003_guest_mark_style.sql"]) migrate(file);
  const listenPort = await port();
  const base = `http://127.0.0.1:${listenPort}`;
  // Direct Vite avoids vinext's single-server lock while a designer preview runs.
  server = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(listenPort)], {
    cwd: root, env: { ...process.env, SITE_TEST_PERSIST_PATH: state, ADMIN_USER_IDS: "local_seedy" }, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { log = (log + chunk.toString()).slice(-10_000); });
  try {
    await waitFor(base);
    assert.equal((await api(base, "/api/admin/state", "")).status, 403);
    const login = await fetch(new URL("/signin-with-chatgpt?return_to=/admin", base), { redirect: "manual" });
    assert.equal(login.status, 302);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.equal(cookie, "__sites_local_auth=1");
    assert.equal((await api(base, "/api/admin/state", cookie)).status, 200);
    console.log("admin authentication and server authorization: OK");

    const csv = "displayName,partyLimit,email,reference\nFixture Household,2,,household-001\n";
    const first = await api(base, "/api/admin/state", cookie, { op: "import_guests", csv });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.links.length, 1);
    const second = await api(base, "/api/admin/state", cookie, { op: "import_guests", csv });
    assert.equal(second.status, 201);
    assert.equal(second.body.links.length, 0);
    assert.equal(second.body.skipped, 1);
    const token = first.body.links[0].invitationUrl.split("/").at(-1);
    assert.equal((await api(base, `/api/invite/${token}/rsvp`, "", { attendance: "yes", partySize: 2 })).status, 200);
    const exportResponse = await fetch(new URL("/api/admin/state?export=rsvps", base), { headers: { cookie } });
    assert.equal(exportResponse.status, 200);
    assert.match(await exportResponse.text(), /Fixture Household/);
    const backup = await api(base, "/api/admin/state?export=backup", cookie);
    assert.equal(backup.status, 200);
    assert.equal(backup.body.guests.length, 1);
    console.log("idempotent guest import, invite, RSVP export, backup: OK");

    const gift = await api(base, "/api/admin/state", cookie, { op: "create_gift", title: "Fixture Gift", category: "home" });
    assert.equal(gift.status, 201);
    const catalogue = await api(base, `/api/invite/${token}/gifts`, "");
    assert.equal(catalogue.body.gifts.length, 1);
    assert.equal((await api(base, `/api/invite/${token}/gifts`, "", { action: "reserve", giftId: catalogue.body.gifts[0].id })).status, 200);
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "admin_release_gift", id: catalogue.body.gifts[0].id })).status, 200);
    assert.equal((await api(base, `/api/invite/${token}/gifts`, "")).body.gifts[0].status, "available");
    console.log("admin gift reservation control: OK");

    const created = await api(base, "/api/admin/state", cookie, { op: "create_archive", title: "Fixture Story", slug: "fixture-story", type: "note", excerpt: "Fixture only", visibility: "guests", published: false });
    assert.equal(created.status, 201);
    assert.equal((await api(base, "/api/archive", "")).body.entries.length, 0);
    const stateResult = await api(base, "/api/admin/state", cookie);
    const entryId = stateResult.body.archive[0].id;
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "update_archive", id: entryId, title: "Fixture Story", slug: "fixture-story", type: "note", excerpt: "Fixture only", visibility: "public", published: true, featured: true, featuredOrder: 1 })).status, 200);
    assert.equal((await api(base, "/api/archive?featured=1", "")).body.entries.length, 1);
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "archive_entry", id: entryId })).status, 200);
    assert.equal((await api(base, "/api/archive", "")).body.entries.length, 0);
    console.log("archive draft, publish, feature, and unpublish: OK");

    assert.equal((await api(base, `/api/invite/${token}/marks`, "", { message: "Fixture mark", visibility: "public" })).status, 201);
    assert.equal((await api(base, "/api/marks", "")).body.marks.length, 0);
    const pending = await api(base, "/api/admin/state", cookie);
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "moderate_mark", id: pending.body.marks[0].id, status: "approved" })).status, 200);
    assert.equal((await api(base, "/api/marks", "")).body.marks.length, 1);
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "set_setting", key: "site_phase", value: "post-wedding" })).status, 200);
    assert.equal((await api(base, "/api/site-state", "")).body.phase, "post-wedding");
    console.log("mark moderation and lifecycle admin control: OK");
  } catch (error) { console.error(log); throw error; }
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (state.startsWith(join(tmpdir(), "bagas-iga-admin-integration-"))) await rm(state, { recursive: true, force: true });
}
