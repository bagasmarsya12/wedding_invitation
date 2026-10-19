import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../lib/production.ts';

/** Isolated local database only; called by the admin integration harness. */
export async function verifyVisitActivity(base,cookie,executeLocal) {
  async function request(path,body,{auth=true,origin=base,headers={},method=body?'POST':'GET'}={}) {
    const response=await fetch(base+path,{method,headers:{...(auth?{cookie}:{}),...(body?{'content-type':'application/json',origin}:{}),...headers},body:body?JSON.stringify(body):undefined});
    const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{data=null;}
    return {status:response.status,data,raw,headers:response.headers};
  }
  const makeGuest=async name=>{
    const result=await request('/api/admin/state',{op:'create_guest',displayName:name,partyLimit:1});
    assert.equal(result.status,201,result.raw);
    return {id:result.data.guestId,token:result.data.inviteUrl.split('/').at(-1)};
  };
  const a=await makeGuest('Activity Fixture A'),b=await makeGuest('Activity Fixture B'),unopened=await makeGuest('Activity Fixture Unopened');
  const browser1=randomUUID(),browser2=randomUUID(),session=randomUUID();
  const visit=(guest,extra={},options={})=>request('/api/visits',{token:guest.token,page:'invitation',session:randomUUID(),device:browser1,...extra},{auth:false,...options});
  assert.equal((await request('/api/admin/activity',null,{auth:false})).status,403);
  assert.equal((await request('/api/admin/activity?export=csv',null,{auth:false})).status,403);
  assert.equal((await visit(a,{device:'not-a-random-id'})).status,400);
  assert.equal((await visit(a,{session:'-'.repeat(36)})).status,400);
  assert.equal((await visit(a,{}, {origin:'https://elsewhere.example'})).status,403);
  assert.equal((await visit(a,{token:'invalid-token'})).status,404);
  for(const headers of [{dnt:'1'},{'sec-gpc':'1'}]){
    const ignored=await visit(a,{}, {headers});assert.equal(ignored.status,200);assert.equal(ignored.data.recorded,false);
  }
  assert.equal((await visit(a,{session})).data.recorded,true);
  assert.equal((await visit(a,{session})).data.recorded,false,'Immediate duplicate must not inflate opens');
  assert.equal((await visit(a,{session,page:'archive'})).data.recorded,true);
  assert.equal((await visit(a)).data.recorded,true,'A new session from the same browser is another opening, not another browser');
  assert.equal((await visit(a,{device:browser2})).data.recorded,true);
  const legacyClient=await request('/api/visits',{token:a.token,page:'invitation',session:randomUUID()},{auth:false});
  assert.equal(legacyClient.status,200);assert.equal(legacyClient.data.recorded,true);
  assert.equal((await visit(b)).data.recorded,true,'The same browser may visit two invitations, each attributed to its owner');
  executeLocal(`INSERT INTO page_visits(id,guest_id,session_hash,page,views,first_at,last_at) VALUES('activity-legacy','${a.id}','legacy-unknown-session','invitation',3,'2026-10-01 01:00:00','2026-10-01 02:00:00')`);
  const report=await request('/api/admin/activity');
  assert.equal(report.status,200,report.raw);assert.match(report.headers.get('cache-control'),/no-store/);
  const row=report.data.guests.find(r=>r.id===a.id);
  assert.equal(row.link_opens,7);assert.equal(row.views,8);assert.equal(row.sessions,5);assert.equal(row.devices,2);assert.equal(row.unidentified_sessions,2);
  assert.equal(row.first_at,'2026-10-01 01:00:00');
  const other=report.data.guests.find(r=>r.id===b.id);assert.equal(other.devices,1);assert.equal(other.link_opens,1);
  const empty=report.data.guests.find(r=>r.id===unopened.id);assert.equal(empty.sessions,0);assert.equal(empty.devices,0);assert.equal(empty.link_opens,0);
  const directory=(await request('/api/admin/state')).data.guests.find(r=>r.id===a.id);
  for(const key of ['devices','link_opens','sessions','unidentified_sessions','last_at'])assert.equal(directory[key],row[key],`Directory/report ${key} must agree`);
  const csv=await request('/api/admin/activity?export=csv');assert.equal(csv.status,200);assert.match(csv.raw,/Invitation opens/);assert.match(csv.raw,/Detected browsers \(minimum\)/);assert.match(csv.raw,/Activity Fixture A/);
  const backup=(await request('/api/admin/state?export=backup')).data.pageVisits.filter(r=>r.guest_id===a.id);
  const encoded=await sha256(`page-device:v1:${browser1}`);
  assert.ok(backup.some(r=>r.device_hash===encoded));
  assert.ok(!JSON.stringify(backup).includes(browser1));
  assert.ok(!report.raw.includes(encoded),'Public-facing admin counts need no browser identifier list');
  assert.ok(backup.filter(r=>r.id==='activity-legacy').every(r=>r.device_hash===null&&r.views===3));

  const website=(await request('/api/admin/website')).data;
  const disabled=await request('/api/admin/website',{config:{...website.config,trackingEnabled:false},blocks:website.blocks},{method:'PUT'});
  assert.equal(disabled.status,200,disabled.raw);
  assert.equal((await visit(a)).data.recorded,false);
  assert.equal((await request('/api/admin/activity')).data.trackingEnabled,false);
  assert.equal((await request('/api/admin/website',{config:website.config,blocks:website.blocks},{method:'PUT'})).status,200);
  assert.equal((await request('/api/admin/state',{op:'update_guest',id:b.id,displayName:'Activity Fixture B',partyLimit:1,status:'revoked'})).status,200);
  assert.equal((await visit(b)).status,404);
  console.log('Link activity: auth, origin, privacy signals, deduplication, repeat sessions, unique browsers, historical unknowns, directory/CSV consistency and hashed storage: OK');
}
