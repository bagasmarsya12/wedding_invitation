// Isolated local admin flow using the starter's loopback-only mock sign-in.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { emptyGiftTransfers } from '../lib/gift-transfers.ts';
import { verifyPhotoCommentFlows } from './photo-comments.integration.mjs';
import { verifyEditorialFlows } from './cms-editorial.integration.mjs';
import { verifyVisitActivity } from './visit-activity.integration.mjs';
import { verifyAdminRsvp } from './admin-rsvp.integration.mjs';
import { verifyManualGiftBooking } from './manual-gift-booking.integration.mjs';

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
  for (const file of (await readdir(join(root, 'drizzle'))).filter(file=>/^\d+.*\.sql$/.test(file)).sort()) migrate(file);
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
    await verifyEditorialFlows(base,cookie);

    // A real download can contain AAC/MP4 despite its .mp3 filename.
    const audioBytes=new Uint8Array(Buffer.from('0000001866747970646173680000000069736f366d703431','hex'));
    const audioForm=new FormData();audioForm.set('file',new File([audioBytes],'Misnamed download.mp3',{type:'audio/mpeg'}));
    const deniedAudio=await fetch(base+'/api/admin/jukebox/audio',{method:'POST',headers:{origin:base},body:audioForm});
    assert.equal(deniedAudio.status,403);
    const audioUpload=await fetch(base+'/api/admin/jukebox/audio',{method:'POST',headers:{cookie,origin:base},body:audioForm});
    assert.equal(audioUpload.status,201);
    const uploadedAudio=await audioUpload.json();
    const streamedAudio=await fetch(base+uploadedAudio.src,{headers:{range:'bytes=0-15'}});
    assert.equal(streamedAudio.status,206);assert.equal(streamedAudio.headers.get('content-type'),'audio/mp4');
    assert.deepEqual(new Uint8Array(await streamedAudio.arrayBuffer()),audioBytes.slice(0,16));
    console.log('Jukebox uploads: misnamed AAC container, authorized upload, correct MIME and byte ranges: OK');

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

    const extraLinks=[];
    for(let offset=0;offset<51;offset+=25){
      const rows=Array.from({length:Math.min(25,51-offset)},(_,index)=>`Bulk Fixture ${offset+index+1},1,,bulk-${offset+index+1}`);
      const result=await api(base,'/api/admin/state',cookie,{op:'import_guests',csv:`displayName,partyLimit,email,reference\n${rows.join('\n')}\n`});
      assert.equal(result.status,201,JSON.stringify(result.body));extraLinks.push(...result.body.links);
    }
    const guestId=first.body.links[0].guestId;
    const bulkIds=[guestId,...extraLinks.map(link=>link.guestId)];
    const bulk={op:'update_guests_bulk',ids:bulkIds,field:'sent',value:true};
    assert.equal((await api(base,'/api/admin/state','',bulk)).status,403);
    const badOrigin=await fetch(new URL('/api/admin/state',base),{method:'POST',headers:{cookie,origin:'https://other.example','content-type':'application/json'},body:JSON.stringify(bulk)});
    assert.equal(badOrigin.status,403);
    for(const invalid of [{...bulk,ids:[]},{...bulk,ids:[guestId,guestId]},{...bulk,ids:[guestId,{}]},{...bulk,ids:Array.from({length:1001},(_,i)=>`guest_invalid_${i}`)},{...bulk,value:'true'},{...bulk,field:'group',value:'invalid'},{...bulk,field:'status',value:'revoked'}])
      assert.equal((await api(base,'/api/admin/state',cookie,invalid)).status,400);
    assert.equal((await api(base,'/api/admin/state',cookie,{...bulk,ids:[guestId,'guest_missing_fixture']})).status,409);
    assert.equal((await api(base,'/api/admin/state',cookie)).body.guests.find(row=>row.id===guestId).invitation_sent_at,null);
    const marked=await api(base,'/api/admin/state',cookie,bulk);
    assert.equal(marked.status,200);assert.equal(marked.body.updated,52);
    const sentAt=(await api(base,'/api/admin/state',cookie)).body.guests.find(row=>row.id===guestId).invitation_sent_at;
    assert.ok(sentAt);
    assert.equal((await api(base,'/api/admin/state',cookie,{op:'mark_invitation_sent',id:guestId,sent:true})).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie,bulk)).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie)).body.guests.find(row=>row.id===guestId).invitation_sent_at,sentAt);
    assert.equal((await api(base,'/api/admin/state',cookie,{...bulk,field:'group',value:'family'})).status,200);
    const grouped=(await api(base,'/api/admin/state',cookie)).body.guests;
    assert.equal(grouped.filter(row=>bulkIds.includes(row.id)&&row.guest_group==='family').length,52);
    assert.ok(grouped.every(row=>row.status==='active'&&row.has_saved_link));
    assert.equal((await api(base,`/api/invite/${token}/rsvp`,'')).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie,{...bulk,value:false})).status,200);
    assert.ok((await api(base,'/api/admin/state',cookie)).body.guests.every(row=>row.invitation_sent_at===null));
    console.log('bulk guest operations: auth, origin, validation, no partial invalid selection, 52-row batch, idempotent sent time, unchanged links: OK');

    const family = await api(base, '/api/admin/state', cookie, {op:'create_guest',displayName:'Large Family Fixture',partyLimit:100,guestGroup:'family'});
    assert.equal(family.status,201,JSON.stringify(family.body));
    const familyToken = family.body.inviteUrl.split('/').at(-1);
    assert.equal((await api(base,`/api/invite/${familyToken}/rsvp`,'',{attendance:'yes',partySize:100})).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie,{op:'update_guest',id:family.body.guestId,displayName:'Large Family Fixture',partyLimit:50,status:'active',guestGroup:'family'})).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie,{op:'create_guest',displayName:'Over Limit Fixture',partyLimit:101})).status,400);
    assert.equal((await api(base,'/api/admin/state',cookie,{op:'update_guest',id:family.body.guestId,displayName:'Large Family Fixture',partyLimit:101,status:'active',guestGroup:'family'})).status,400);
    const familyImport = await api(base,'/api/admin/state',cookie,{op:'import_guests',csv:'displayName,partyLimit,reference,group\nFamily Import Fixture,100,family-large,family\n'});
    assert.equal(familyImport.status,201,JSON.stringify(familyImport.body));
    assert.equal(familyImport.body.links.length,1);
    assert.equal((await api(base,'/api/admin/state',cookie,{op:'import_guests',csv:'displayName,partyLimit\nOver Limit Import Fixture,101\n'})).status,400);
    assert.equal((await api(base,'/api/admin/state',cookie)).body.guests.find(row=>row.id===family.body.guestId).party_limit,50);
    console.log('family allocations: create, edit, import and RSVP support 100 places; values above 100 rejected: OK');

    assert.equal((await api(base,'/api/admin/state',cookie,{op:'set_setting',key:'shipping_instructions',value:'Fixture shipping instructions to preserve.'})).status,200);
    const lifecycle={op:'set_lifecycle',phase:'wedding-day',rsvp:'off',gifts:'auto',marks:'on'};
    assert.equal((await api(base,'/api/admin/state','',lifecycle)).status,403);
    for(const invalid of [{...lifecycle,phase:'invalid'},{...lifecycle,phase:['auto']},{...lifecycle,rsvp:true},{...lifecycle,gifts:'invalid'}])
      assert.equal((await api(base,'/api/admin/state',cookie,invalid)).status,400);
    assert.equal((await api(base,'/api/admin/state',cookie,lifecycle)).status,200);
    assert.equal((await api(base,'/api/admin/state',cookie)).body.settings.find(row=>row.key==='shipping_instructions').value,'Fixture shipping instructions to preserve.');
    assert.deepEqual((await api(base,'/api/site-state','')).body,{phase:'wedding-day',rsvpEnabled:false,giftsEnabled:true,marksEnabled:true});
    const beforeInvalid=(await api(base,'/api/admin/state',cookie)).body.settings;
    assert.equal((await api(base,'/api/admin/state',cookie,{...lifecycle,phase:'post-wedding',gifts:'invalid'})).status,400);
    assert.deepEqual((await api(base,'/api/admin/state',cookie)).body.settings,beforeInvalid);
    assert.equal((await api(base,'/api/admin/state',cookie,{...lifecycle,phase:'post-wedding',rsvp:'auto',gifts:'off',marks:'off'})).status,200);
    assert.deepEqual((await api(base,'/api/site-state','')).body,{phase:'post-wedding',rsvpEnabled:false,giftsEnabled:false,marksEnabled:false});
    assert.equal((await api(base,'/api/admin/state',cookie,{...lifecycle,phase:'auto',rsvp:'auto',gifts:'auto',marks:'auto'})).status,200);
    console.log('plain-language lifecycle settings: authorized atomic save, invalid values preserve settings, manual and automatic feature behavior: OK');

    const gift = await api(base, "/api/admin/state", cookie, { op: "create_gift", title: "Fixture Gift", category: "home", published: true });
    assert.equal(gift.status, 201);
    const catalogue = await api(base, `/api/invite/${token}/gifts`, "");
    assert.equal(catalogue.body.gifts.length, 1);
    assert.equal((await api(base, `/api/invite/${token}/gifts`, "", { action: "reserve", giftId: catalogue.body.gifts[0].id })).status, 200);
    assert.equal((await api(base, "/api/admin/state", cookie, { op: "admin_release_gift", id: catalogue.body.gifts[0].id })).status, 200);
    assert.equal((await api(base, `/api/invite/${token}/gifts`, "")).body.gifts[0].status, "available");
    console.log("admin gift reservation control: OK");

    const methods = emptyGiftTransfers();
    methods.bca = { enabled: true, recipient: 'Fixture Only', destination: '0012345678', cta: { id: 'Salin nomor fixture', en: 'Copy fixture account' } };
    methods.dana = { enabled: true, recipient: 'Fixture Only', destination: 'https://example.test/fixture-dana', phone:'081395746085', cta: { id: '', en: '' } };
    const setting = { op: 'set_setting', key: 'gift_transfer_methods', value: JSON.stringify(methods) };
    assert.equal((await api(base, '/api/admin/state', '', setting)).status, 403);
    const unsafe = structuredClone(methods); unsafe.dana.destination = 'javascript:alert(1)';
    assert.equal((await api(base, '/api/admin/state', cookie, { ...setting, value: JSON.stringify(unsafe) })).status, 400);
    assert.equal((await api(base, '/api/admin/state', cookie, setting)).status, 200);
    const options = await api(base, `/api/invite/${token}/gift-options`, '');
    assert.equal(options.status, 200); assert.match(options.headers.get('cache-control'), /no-store/);
    assert.deepEqual(options.body.methods.map(row=>row.id), ['bca','dana']);
    assert.equal(options.body.methods[0].destination, '0012345678');
    assert.equal(options.body.methods[0].cta.id, 'Salin nomor fixture');
    assert.equal(options.body.methods[1].phone, '081395746085');
    assert.equal(options.body.methods[1].destination, 'https://example.test/fixture-dana');
    assert.equal(options.body.legacyDetails, null);
    const publicOptions = await api(base, '/api/gift-options', '');
    assert.equal(publicOptions.status, 200);
    assert.match(publicOptions.headers.get('cache-control'), /no-store/);
    const {gifts:publicGiftList,...publicPaymentOptions}=publicOptions.body;
    assert.deepEqual(publicPaymentOptions, options.body);
    assert.equal(publicGiftList.length,1);
    assert.equal(publicGiftList[0].id,catalogue.body.gifts[0].id);
    assert.equal(publicGiftList[0].reservedByName,null);
    assert.equal((await api(base, '/api/invite/invalid-token/gift-options', '')).status, 404);
    assert.equal((await api(base, `/api/invite/${token}/gifts`, '')).body.transferMethods.length, 2);
    assert.equal((await api(base, '/api/admin/state', cookie, { op:'set_setting',key:'gifts_enabled',value:'off' })).status, 200);
    const disabled = await api(base, `/api/invite/${token}/gift-options`, '');
    assert.deepEqual(disabled.body.methods, []); assert.equal(disabled.body.legacyDetails, null);
    const publicDisabled = await api(base, '/api/gift-options', '');
    assert.equal(publicDisabled.status, 200);
    assert.deepEqual(publicDisabled.body.methods, []);
    assert.equal(publicDisabled.body.legacyDetails, null);
    assert.equal((await api(base, '/api/admin/state', cookie, { op:'set_setting',key:'gifts_enabled',value:'on' })).status, 200);
    console.log('structured gifts: admin validation, public payment display, private guest routes, leading zeros, hidden methods and feature switch: OK');

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
    await verifyPhotoCommentFlows(base,cookie,sql=>execFileSync(process.execPath,[wrangler,"d1","execute","DB","--command",sql,"--local","--config",config,"--persist-to",state],{cwd:root,timeout:20_000,stdio:["ignore","pipe","pipe"]}));
    await verifyVisitActivity(base,cookie,sql=>execFileSync(process.execPath,[wrangler,"d1","execute","DB","--command",sql,"--local","--config",config,"--persist-to",state],{cwd:root,timeout:20_000,stdio:["ignore","pipe","pipe"]}));
    await verifyManualGiftBooking(base,cookie,token);
    await verifyAdminRsvp(base,cookie);
  } catch (error) { console.error(log); throw error; }
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolve => server.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  if (state.startsWith(join(tmpdir(), "bagas-iga-admin-integration-"))) await rm(state, { recursive: true, force: true });
}
