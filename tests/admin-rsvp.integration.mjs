import assert from 'node:assert/strict';
import {parseCsv} from '../lib/production.ts';

export async function verifyAdminRsvp(base,cookie) {
  async function api(path,data,auth=cookie,origin=base){
    const response=await fetch(base+path,{method:data?'POST':'GET',headers:{...(auth?{cookie:auth}:{}),...(data?{'content-type':'application/json',origin}:{})},body:data?JSON.stringify(data):undefined});
    const raw=await response.text();
    let body;try{body=JSON.parse(raw);}catch{body=null;}
    return {status:response.status,body};
  }
  const state=async()=>(await api('/api/admin/state')).body;
  const created=await api('/api/admin/state',{op:'create_guest',displayName:'Manual RSVP Fixture',partyLimit:3});
  assert.equal(created.status,201);
  const id=created.body.guestId,token=created.body.inviteUrl.split('/').at(-1);
  const reply=async()=>(await state()).rsvps.find(row=>row.guest_id===id);
  const guestReply=async()=>(await api(`/api/invite/${token}/rsvp`,undefined,'')).body.rsvp;
  const initialState=await state(),initialGuest=initialState.guests.find(g=>g.id===id);
  const baseChange={op:'set_guest_rsvp',id,attendance:'yes',partySize:2,expectedUpdatedAt:null};
  assert.equal((await api('/api/admin/state',baseChange,'')).status,403);
  assert.equal((await api('/api/admin/state',baseChange,cookie,'https://other.example')).status,403);
  for(const invalid of [{...baseChange,attendance:'maybe'},{...baseChange,partySize:0},{...baseChange,partySize:4},{...baseChange,partySize:1.5},{...baseChange,partySize:'2'},{...baseChange,partySize:null},{...baseChange,expectedUpdatedAt:undefined},{...baseChange,expectedUpdatedAt:''}])
    assert.equal((await api('/api/admin/state',invalid)).status,400);
  assert.equal((await api('/api/admin/state',{...baseChange,id:'guest_missing'})).status,404);
  assert.equal(await reply(),undefined);

  // Manual answers remain possible when the public RSVP window is closed.
  const originalSwitch=initialState.settings.find(row=>row.key==='rsvp_enabled')?.value||'auto';
  assert.equal((await api('/api/admin/state',{op:'set_setting',key:'rsvp_enabled',value:'off'})).status,200);
  assert.equal((await api('/api/admin/state',{...baseChange,attendance:'no',partySize:0})).status,200);
  let current=await reply();
  assert.equal(current.attendance,'no');assert.equal(current.party_size,0);
  const rsvpId=current.id,createdAt=current.created_at;
  assert.equal((await api('/api/admin/state',baseChange)).status,409,'A stale empty form must not replace an answer');
  assert.equal((await api('/api/admin/state',{...baseChange,expectedUpdatedAt:current.updated_at})).status,200);
  current=await reply();assert.equal(current.attendance,'yes');assert.equal(current.party_size,2);
  assert.equal((await api('/api/admin/state',{op:'set_setting',key:'rsvp_enabled',value:'on'})).status,200);

  const staleTimestamp=current.updated_at;
  assert.equal((await api(`/api/invite/${token}/rsvp`,{attendance:'yes',partySize:1,guestNames:'Fixture household',dietary:'Fixture meal note',message:'Fixture private message'},'')).status,200);
  current=await reply();
  assert.equal((await api('/api/admin/state',{...baseChange,attendance:'no',partySize:0,expectedUpdatedAt:staleTimestamp})).status,409,'Do not silently overwrite a newer guest response');
  assert.equal((await api('/api/admin/state',{...baseChange,attendance:'no',partySize:0,expectedUpdatedAt:current.updated_at})).status,200);
  current=await reply();assert.equal(current.attendance,'no');assert.equal(current.party_size,0);
  assert.equal(current.id,rsvpId);assert.equal(current.created_at,createdAt);
  for(const [field,value] of Object.entries({guest_names:'Fixture household',dietary:'Fixture meal note',message:'Fixture private message'}))assert.equal(current[field],value,'Retain guest notes');
  assert.equal((await guestReply()).attendance,'no','Personal invitation reads the manual answer');

  const concurrent=await Promise.all([2,3].map(size=>api('/api/admin/state',{...baseChange,partySize:size,expectedUpdatedAt:current.updated_at})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  current=await reply();assert.equal(current.attendance,'yes');assert.ok([2,3].includes(current.party_size));
  assert.equal((await api(`/api/invite/${token}/rsvp`,{attendance:'yes',partySize:2},'')).status,200,'Guest can revise a manual RSVP');
  current=await reply();assert.equal(current.party_size,2);assert.equal(current.id,rsvpId);
  const after=await state();
  assert.equal(after.rsvps.filter(row=>row.guest_id===id).length,1);
  assert.deepEqual(after.guests.find(g=>g.id===id),initialGuest,'Guest identity, link and allocation stay unchanged');
  for(const field of ['checkins','marks','gifts','reservations'])assert.deepEqual(after[field],initialState[field],field+' must not change');
  const exported=await fetch(base+'/api/admin/state?export=rsvps',{headers:{cookie}});
  assert.equal(exported.status,200);
  const exportedRow=parseCsv(await exported.text()).find(row=>row[0]==='Manual RSVP Fixture');
  assert.deepEqual(exportedRow.slice(0,8),['Manual RSVP Fixture','','3','yes','2','Fixture household','Fixture meal note','Fixture private message']);

  assert.equal((await api('/api/admin/state',{op:'update_guest',id,displayName:'Manual RSVP Fixture',partyLimit:3,guestGroup:'unassigned',status:'revoked'})).status,200);
  assert.equal((await api('/api/admin/state',{...baseChange,expectedUpdatedAt:current.updated_at})).status,409);
  assert.deepEqual(await reply(),current,'Revoked guest RSVP stays unchanged');
  assert.equal((await api('/api/admin/state',{op:'set_setting',key:'rsvp_enabled',value:originalSwitch})).status,200);
  console.log('manual admin RSVP: authorization, origin, validation, closed window, synced public reply/CSV, stale and concurrent writes, retained notes and independent check-ins: OK');
}
