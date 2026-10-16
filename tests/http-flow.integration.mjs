// Runs only against an isolated local Wrangler database. Requires `npm run build` first.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
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
  for (const file of (await readdir(join(root, 'drizzle'))).filter(file=>/^\d+.*\.sql$/.test(file)).sort()) migrate(file);
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
    const stakkResponse=await fetch(base+'/api/stakk',{headers:{origin:'https://stakk.iganyabagas.com'}});
    assert.equal(stakkResponse.status,200);assert.equal(stakkResponse.headers.get('access-control-allow-origin'),'https://stakk.iganyabagas.com');
    assert.equal(stakkResponse.headers.get('access-control-allow-credentials'),null);
    const stakkCopy=await stakkResponse.json();assert.equal(stakkCopy.languages.id.cta,'Buka kamera');assert.deepEqual(Object.keys(stakkCopy).sort(),['languages','version']);
    assert.equal((await fetch(base+'/api/stakk',{method:'OPTIONS',headers:{origin:'https://stakk.iganyabagas.com'}})).status,204);
    assert.equal((await fetch(base+'/api/stakk',{headers:{origin:'https://evil.example'}})).status,403);
    console.log('Compiled Stakk copy API: cross-origin allowlist, public defaults and no credentials: OK');

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

    sql(`INSERT INTO archive_entries (id,slug,type,title,excerpt,story,visibility,published,featured) VALUES
      ('content-real','content-real','note','REAL_CONTENT_SENTINEL','A confirmed original note.','A confirmed original story.','public',1,1),
      ('content-empty','content-empty','note','INCOMPLETE_CONTENT_SENTINEL','Photograph to come',NULL,'public',1,1),
      ('content-private','content-private','note','PRIVATE_CONTENT_SENTINEL','A private note.','A private story.','guests',1,1),
      ('content-draft','content-draft','note','DRAFT_CONTENT_SENTINEL','An unpublished note.','An unpublished story.','public',0,1);`);
    const homeHtml = await (await fetch(new URL("/", base))).text();
    const archiveHtml = await (await fetch(new URL("/archive", base))).text();
    for (const html of [homeHtml, archiveHtml]) {
      assert.ok(html.includes("REAL_CONTENT_SENTINEL"));
      for (const sentinel of ["INCOMPLETE_CONTENT_SENTINEL", "PRIVATE_CONTENT_SENTINEL", "DRAFT_CONTENT_SENTINEL"]) assert.ok(!html.includes(sentinel), sentinel);
    }
    assert.ok(homeHtml.includes("Fixture Gift"), "Real gift preview data reaches the homepage");
    assert.ok(!homeHtml.includes("PRIVATE FIXTURE ADDRESS"), "Public preview excludes private shipping data");
    assert.equal((await fetch(new URL("/archive/content-real", base))).status, 200);
    for (const slug of ["content-empty", "content-private", "content-draft"]) assert.equal((await fetch(new URL(`/archive/${slug}`, base))).status, 404, slug);
    const markHtml = await (await fetch(new URL("/archive/the-mark", base))).text();
    // CMS dictionaries may contain unused literals in the hydration payload. Check rendered markup.
    const markMarkup = markHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    assert.ok(!markMarkup.includes("Original sketches and iterations can be added here later."));
    sql("DELETE FROM archive_entries WHERE id IN ('content-real','content-empty','content-private','content-draft');");
    console.log("public content readiness, published Archive routes and gift preview privacy: OK");

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

    sql("INSERT INTO settings (key,value) VALUES ('site_phase','pre-wedding') ON CONFLICT(key) DO UPDATE SET value='pre-wedding';");
    assert.equal((await response(base,`/hari-h/${a}`)).headers.get('location'),`/invite/${a}?view=full`);
    assert.equal((await response(base,'/hari-h')).headers.get('location'),'/?view=full');
    sql("UPDATE settings SET value='wedding-day' WHERE key='site_phase';");
    for(const [path,destination] of [['/','/hari-h'],[`/invite/${a}`,`/hari-h/${a}`]]){
      const moved=await response(base,path);assert.equal(moved.status,307);assert.equal(moved.headers.get('location'),destination);
    }
    const quick=await fetch(base+`/hari-h/${a}`,{redirect:'manual'});
    assert.equal(quick.status,200);assert.match(quick.headers.get('cache-control'),/no-store/);assert.match(quick.headers.get('x-robots-tag'),/noindex/);
    const quickMarkup=(await quick.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    assert.ok(quickMarkup.includes('Hari ini Kami Menikah.'));
    assert.ok(quickMarkup.includes(`href="/invite/${a}?view=full"`));
    for(const id of ['profiles','details','archive','gifts','beyond','closing-title'])assert.ok(!quickMarkup.includes(`id="${id}"`),`Compact page must not render ${id}`);
    for(const path of ['/?view=full',`/invite/${a}?view=full`]){
      const full=await fetch(base+path,{redirect:'manual'});assert.equal(full.status,200);
      const markup=(await full.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
      assert.ok(markup.includes('v2-grand-day'));assert.ok(markup.includes('id="profiles"'));assert.ok(!markup.includes('class="wedding-day"'));
    }
    assert.equal((await response(base,'/hari-h/invalid-token')).status,404);
    const publicQuick=await fetch(base+'/hari-h');assert.equal(publicQuick.status,200);
    const publicQuickMarkup=(await publicQuick.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    assert.ok(publicQuickMarkup.includes('QR check-in tersedia lewat tautan undangan personalmu.'));assert.ok(!publicQuickMarkup.includes('id="guest-pass"'));
    sql("UPDATE settings SET value='post-wedding' WHERE key='site_phase';");
    assert.equal((await response(base,`/hari-h/${a}`)).headers.get('location'),`/invite/${a}?view=full`);
    console.log('Wedding-day routes: automatic private redirect, one-section page, full-view escape, before/after phases, public and invalid links: OK');
    assert.equal((await response(base, "/api/site-state")).data.phase, "post-wedding");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 403);
    sql("INSERT INTO settings (key,value) VALUES ('rsvp_enabled','on') ON CONFLICT(key) DO UPDATE SET value='on';");
    assert.equal((await response(base, `/api/invite/${a}/rsvp`, "POST", { attendance: "yes", partySize: 1 })).status, 200);
    console.log("post-wedding RSVP closure and admin override: OK");
    // Exercise the compiled Worker, separate from the Vite admin integration.
    sql("INSERT INTO archive_entries (id,slug,type,title,excerpt,media_url,visibility,published) VALUES ('compiled-photo','compiled-photo','photograph','Compiled fixture photo','Local fixture caption.','/assets/og-image.jpg','public',1);");
    async function commentsRequest(path,body,cookie='',method=body?'POST':'GET'){
      const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json',origin:base}:{})},body:body?JSON.stringify(body):undefined});
      return {status:r.status,data:await r.json(),headers:r.headers};
    }
    const guestSession=await commentsRequest('/api/guest/session',{token:a});assert.equal(guestSession.status,200);
    const guestCookie=guestSession.headers.get('set-cookie').split(';')[0];
    const comment=await commentsRequest('/api/photo-comments',{photo:'archive:compiled-photo',message:'Compiled Worker comment.'},guestCookie);assert.equal(comment.status,201);assert.equal(comment.data.comment.name,'Fixture A');assert.equal(comment.data.comment.status,'pending');
    const photoPath='/api/photo-comments?photo=archive:compiled-photo';
    assert.equal((await commentsRequest(photoPath)).data.comments.length,0);
    assert.equal((await commentsRequest(photoPath,null,guestCookie)).data.comments.length,1);
    const overviewPath='/api/photo-comments/overview?photo=archive:compiled-photo';
    assert.equal((await commentsRequest(overviewPath)).data.photos['archive:compiled-photo'].total,0);
    assert.equal((await commentsRequest(overviewPath,null,guestCookie)).data.photos['archive:compiled-photo'].total,1);
    sql(`UPDATE photo_comments SET moderation_status='approved' WHERE id='${comment.data.comment.id}';`);
    const heart=await commentsRequest('/api/photo-comments/'+comment.data.comment.id+'/heart',{liked:true},guestCookie,'PUT');assert.equal(heart.status,200);assert.equal(heart.data.hearts,1);
    assert.equal((await commentsRequest(photoPath)).data.comments[0].hearts,1);
    assert.equal((await commentsRequest(overviewPath)).data.photos['archive:compiled-photo'].total,1);
    console.log('compiled Worker photo comments: session, identity, pending privacy, approved read, heart and card counts: OK');
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
