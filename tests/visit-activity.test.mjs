import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { browserVisitId, visitSession, validVisitId, deviceCountLabel, guestVisitSummarySql, VISIT_BROWSER_KEY, VISIT_SESSION_KEY } from '../lib/visit-activity.ts';

const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
function storage() {const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}

test('browser identity survives separate visits and sessions; unavailable storage stays unknown',()=>{
  const local=storage();
  assert.equal(browserVisitId(local,()=>first),first);
  assert.equal(browserVisitId(local,()=>second),first);
  assert.equal(browserVisitId(storage(),()=>second),second);
  for(const blocked of [{getItem(){throw Error('blocked');},setItem(){}},{getItem:()=>null,setItem(){}}])assert.equal(browserVisitId(blocked,()=>first),null);
  local.setItem(VISIT_BROWSER_KEY,'corrupted');
  assert.equal(browserVisitId(local,()=>second),second);
});

test('sessions keep invitation attribution for 30 minutes without extending the device identity',()=>{
  const tab=storage(),now=1000;
  assert.deepEqual(visitSession(tab,'guest-a-token',now,()=>first),{session:first,token:'guest-a-token'});
  assert.deepEqual(visitSession(tab,'',now+1000,()=>second),{session:first,token:'guest-a-token'});
  assert.deepEqual(visitSession(tab,'guest-b-token',now+2000,()=>second),{session:first,token:'guest-b-token'});
  assert.deepEqual(visitSession(tab,'',now+2000+30*60_000,()=>second),{session:second,token:''});
  tab.setItem(VISIT_SESSION_KEY,'broken JSON');
  assert.equal(visitSession(tab,'',now,()=>first).session,first);
  assert.equal(visitSession(tab,'',now+1000,()=>second).session,first);
});

test('device labels distinguish no visits, historical unknowns and incomplete counts',()=>{
  assert.equal(deviceCountLabel({sessions:0,devices:0}),'0');
  assert.equal(deviceCountLabel({sessions:3,devices:0,unidentified_sessions:3}),'Belum tercatat');
  assert.equal(deviceCountLabel({sessions:3,devices:2,unidentified_sessions:0}),'2');
  assert.equal(deviceCountLabel({sessions:4,devices:2,unidentified_sessions:1}),'≥ 2');
  for(const value of ['a'.repeat(36),'../device',null,{},''])assert.equal(validVisitId(value),false);
  assert.equal(validVisitId(first),true);
});

test('additive migration preserves historical visits and SQL counts browsers independently of sessions/pages',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON; CREATE TABLE guests(id TEXT PRIMARY KEY); INSERT INTO guests VALUES (\'guest-a\'),(\'guest-b\');');
    db.exec(readFileSync(new URL('../drizzle/0008_cms_workspace.sql',import.meta.url),'utf8'));
    db.exec("INSERT INTO page_visits(id,guest_id,session_hash,page,views,first_at,last_at) VALUES('legacy','guest-a','old-session','invitation',3,'2026-10-01 01:00:00','2026-10-01 02:00:00')");
    const before={...db.prepare('SELECT * FROM page_visits').get()};
    db.exec(readFileSync(new URL('../drizzle/0010_visit_devices.sql',import.meta.url),'utf8'));
    const after={...db.prepare('SELECT * FROM page_visits').get()};
    assert.equal(after.device_hash,null);delete after.device_hash;assert.deepEqual(after,before);
    const insert=db.prepare('INSERT INTO page_visits(id,guest_id,session_hash,page,views,device_hash) VALUES(?,?,?,?,?,?)');
    insert.run('a1','guest-a','session-1','invitation',2,'browser-1');
    insert.run('a2','guest-a','session-1','archive',1,'browser-1');
    insert.run('a3','guest-a','session-2','invitation',1,'browser-1');
    insert.run('a4','guest-a','session-3','invitation',1,'browser-2');
    insert.run('b1','guest-b','session-1','invitation',1,'browser-1');
    const rows=db.prepare(guestVisitSummarySql).all();
    const a=rows.find(r=>r.guest_id==='guest-a'),b=rows.find(r=>r.guest_id==='guest-b');
    assert.equal(a.sessions,4);assert.equal(a.devices,2);assert.equal(a.link_opens,7);assert.equal(a.views,8);assert.equal(a.unidentified_sessions,1);
    assert.equal(b.devices,1);assert.equal(b.link_opens,1);
  } finally {db.close();}
});
