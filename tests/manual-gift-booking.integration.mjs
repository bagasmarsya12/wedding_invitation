import assert from 'node:assert/strict';
export async function verifyManualGiftBooking(base,cookie,guestToken){
  async function request(path,body,{auth=true,origin=base}={}){
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(auth?{cookie}:{}),...(body?{origin,'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=null;}return {status:r.status,data,raw};
  }
  const state=async()=>{const r=await request('/api/admin/state');assert.equal(r.status,200,r.raw);return r.data;};
  const create=async(title,published=true)=>{const r=await request('/api/admin/state',{op:'create_gift',title,category:'home',published});assert.equal(r.status,201,r.raw);return r.data.giftId;};
  const row=async id=>(await state()).gifts.find(g=>g.id===id);
  const book=async(id,name,anonymous,extra={},options={})=>request('/api/admin/state',{op:'set_gift_booking',id,name,anonymous,expectedUpdatedAt:(await row(id)).updated_at,...extra},options);
  const release=async(id,extra={})=>request('/api/admin/state',{op:'admin_release_gift',id,expectedUpdatedAt:(await row(id)).updated_at,...extra});
  const id=await create('Manual booking fixture'),draft=await create('Private booking fixture',false);
  const guestCount=(await state()).guests.length;
  assert.equal((await book(id,'Raka',false,{}, {auth:false})).status,403);
  assert.equal((await book(id,'Raka',false,{}, {origin:'https://other.example'})).status,403);
  for(const [name,anonymous]of [['',false],['x'.repeat(121),false],['Bad\nName',false],['Raka','true']])assert.equal((await book(id,name,anonymous)).status,400);
  assert.equal((await book(id,'Raka',false,{expectedUpdatedAt:'stale'})).status,409);
  assert.equal((await row(id)).status,'available');
  assert.equal((await book(id,'Keluarga Raka',false)).status,200);
  assert.equal((await row(id)).reserved_by_guest_id,null);
  assert.equal((await row(id)).status,'reserved');
  const surfaces=async()=>{
    const paths=['/api/gift-options',`/api/invite/${guestToken}/gifts`,'/','/admin/gifts/preview'];
    const results=await Promise.all(paths.map(path=>request(path,null,{auth:path.startsWith('/admin')})));
    for(const r of results)assert.equal(r.status,200,r.raw.slice(0,200));
    return results;
  };
  let views=await surfaces();
  for(const r of views)assert.ok(r.raw.includes('Keluarga Raka'));
  for(const r of views.slice(0,2))assert.equal(r.data.gifts.find(g=>g.id===id).reservedByName,'Keluarga Raka');
  // The homepage defers its sections until the envelope opens. The CMS preview
  // renders the same booking button immediately, so inspect that server markup.
  assert.ok((views[3].raw.match(/<button\b[^>]*>/g)||[]).some(tag=>tag.includes('gift-booked-state')&&/\bdisabled(?:=|\s|>)/.test(tag)),'Booked preview button must be disabled');
  assert.equal((await request(`/api/invite/${guestToken}/gifts`,{action:'reserve',giftId:id},{auth:false})).status,409);
  assert.equal((await request(`/api/invite/${guestToken}/gifts`,{action:'release',giftId:id},{auth:false})).status,409);
  const secret='PRIVATE_BOOKER_SHOULD_NOT_LEAK';
  assert.equal((await book(id,secret,true)).status,200);
  views=await surfaces();
  for(const r of views)assert.ok(!r.raw.includes(secret),'Anonymous name leaked through a guest-facing response');
  for(const r of views.slice(0,2)){const gift=r.data.gifts.find(g=>g.id===id);assert.equal(gift.reservedByName,null);assert.equal(gift.bookingAnonymous,true);assert.equal(gift.booking_name,undefined);}
  assert.equal((await row(id)).booking_name,secret,'Internal note stays available in authenticated CMS');
  assert.equal((await release(id,{expectedUpdatedAt:'stale'})).status,409);
  assert.equal((await row(id)).status,'reserved');
  assert.equal((await release(id)).status,200);
  assert.equal((await row(id)).booking_name,null);assert.equal((await row(id)).booking_anonymous,0);
  assert.equal((await row(id)).status,'available');
  assert.equal((await book(id,'',true)).status,200,'Anonymous booking need not store a name');
  assert.equal((await release(id)).status,200);
  const version=(await row(id)).updated_at;
  const raced=await Promise.all(['Winner A','Winner B'].map(name=>book(id,name,false,{expectedUpdatedAt:version})));
  assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
  assert.ok(['Winner A','Winner B'].includes((await row(id)).booking_name));
  assert.equal((await book(draft,'Private draft booker',false)).status,200);
  assert.ok(!(await request('/api/gift-options',null,{auth:false})).raw.includes('Private draft booker'));
  assert.equal((await request('/api/admin/state',{op:'update_gift',id:draft,title:'Private booking fixture',category:'home',published:false,shippingRequired:false})).status,200,'A booked draft can still be edited privately');
  assert.equal((await request('/api/admin/state',{op:'update_gift',id,title:'Manual booking fixture',category:'home',published:false,shippingRequired:false})).status,409,'A published booking stays visible until cancelled');
  assert.equal((await state()).guests.length,guestCount,'Manual labels must never create guest records');
  // Existing guest-owned reservations retain their owner/history when CMS changes the display label.
  const legacy=await create('Legacy owner fixture');
  assert.equal((await request(`/api/invite/${guestToken}/gifts`,{action:'reserve',giftId:legacy},{auth:false})).status,200);
  const owner=(await row(legacy)).reserved_by_guest_id;
  assert.equal((await book(legacy,'Private legacy owner',true)).status,200);
  assert.equal((await row(legacy)).reserved_by_guest_id,owner);
  assert.ok(!(await request('/api/gift-options',null,{auth:false})).raw.includes('Private legacy owner'));
  assert.equal((await request(`/api/invite/${guestToken}/gifts`,{action:'purchased',giftId:legacy},{auth:false})).status,200);
  assert.equal((await release(legacy)).status,409);
  assert.equal((await row(legacy)).status,'purchased');
  console.log('Manual gift bookings: named/anonymous labels, public privacy, disabled state, authenticated editing, cancellation/rebooking, stale-write races, private drafts and legacy ownership: OK');
}
