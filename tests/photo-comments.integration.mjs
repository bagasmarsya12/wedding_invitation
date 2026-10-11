import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyPhotoCommentFlows(base,adminCookie,execute){
  async function request(path,body,{cookie='',method=body?'POST':'GET',origin=base}={}){
    const response=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(['POST','PUT','DELETE'].includes(method)?{origin}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}return {status:response.status,data,text,headers:response.headers};
  }
  const admin=(body)=>request('/api/admin/photo-comments',body,{cookie:adminCookie});
  const state=(body)=>request('/api/admin/state',body,{cookie:adminCookie});
  const created=await state({op:'import_guests',csv:'displayName,partyLimit,email,reference\nTamu Komentar A,1,,comment-a\nTamu Komentar B,1,,comment-b\n'});
  assert.equal(created.status,201,created.text);
  const [a,b]=created.data.links;
  async function session(link){const r=await request('/api/guest/session',{token:link.invitationUrl.split('/').at(-1)});assert.equal(r.status,200,r.text);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Lax/);assert.ok(!r.text.includes('token'));return r.headers.get('set-cookie').split(';')[0];}
  const cookieA=await session(a),cookieB=await session(b);
  assert.equal((await request('/api/guest/session',{token:a.invitationUrl.split('/').at(-1)},{origin:'https://foreign.example'})).status,403);
  assert.equal((await request('/api/guest/session',{token:'not-valid'})).status,401);
  for(let i=0;i<40;i++)await request('/api/guest/session',{token:'not-valid'});
  assert.equal((await request('/api/guest/session',{token:'not-valid'})).status,429);
  assert.equal((await request('/api/guest/session',{token:b.invitationUrl.split('/').at(-1)})).status,200,'Guests sharing an IP have separate valid invitation quotas');
  assert.equal((await request('/api/admin/photo-comments')).status,403);
  assert.equal((await request('/api/admin/photo-comments',{op:'config',enabled:false,moderation:false},{cookie:cookieA})).status,403);
  const media='https://iganyabagas.com/assets/og-image.jpg';
  for(const [slug,published] of [['comments-live',true],['comments-draft',false],['comments-pages',true]]){
    assert.equal((await state({op:'create_archive',slug,title:'Pratinjau '+slug,type:'photograph',excerpt:'Fixture untuk pengujian komentar.',mediaUrl:media,visibility:'public',published})).status,201);
  }
  const archive=(await state()).data.archive;
  const live=archive.find(p=>p.slug==='comments-live'),draft=archive.find(p=>p.slug==='comments-draft'),pages=archive.find(p=>p.slug==='comments-pages');
  const key='archive:'+live.id,path='/api/photo-comments?photo='+key;
  const overview='/api/photo-comments/overview?'+new URLSearchParams([['photo',key],['photo','archive:'+draft.id],['photo','archive:'+pages.id],['photo','archive:missing']]);
  async function count(expected,cookie='') {
    const result=await request(overview,null,{cookie});assert.equal(result.status,200,result.text);assert.match(result.headers.get('cache-control'),/no-store/);
    assert.equal(result.data.photos[key].total,expected);assert.equal(result.data.photos['archive:'+pages.id].total,0);
    assert.ok(!('archive:'+draft.id in result.data.photos));assert.ok(!('archive:missing' in result.data.photos));
    assert.ok(!result.text.includes('guest_id'));assert.ok(!result.text.includes('token_hash'));assert.ok(!result.text.includes('author_name'));return result.data;
  }
  assert.equal((await request('/api/photo-comments/overview')).status,400);
  assert.equal((await request('/api/photo-comments/overview?photo=invalid')).status,400);
  assert.equal((await request('/api/photo-comments/overview?'+new URLSearchParams(Array.from({length:41},()=>['photo',key])))).status,400);
  await count(0);
  const post=(message,extra={},cookie=cookieA)=>request('/api/photo-comments',{photo:key,message,...extra},{cookie});
  let r=await request(path);assert.equal(r.status,200,r.text);assert.equal(r.data.viewer,null);assert.match(r.headers.get('cache-control'),/no-store/);
  assert.equal((await request('/api/photo-comments?photo=archive:'+draft.id)).status,404);
  assert.equal((await post('Anonymous',{},'')).status,401);
  assert.equal((await post('x'.repeat(601))).status,400);
  assert.equal((await post('Invalid parent',{parentId:''})).status,400);
  assert.equal((await request('/api/photo-comments',{photo:key,message:'Foreign'},{cookie:cookieA,origin:'https://foreign.example'})).status,403);
  r=await post('Komentar A',{author_name:'Impostor',name:'Impostor'});assert.equal(r.status,201,r.text);const root=r.data.comment;
  assert.equal(root.name,'Tamu Komentar A');assert.equal(root.status,'pending');assert.equal(root.mine,true);
  assert.equal((await request(path,null,{cookie:cookieA})).data.comments.length,1);
  assert.equal((await request(path,null,{cookie:cookieB})).data.comments.length,0);
  assert.equal((await request(path)).data.comments.length,0);
  await count(0);await count(1,cookieA);await count(0,cookieB);
  assert.equal((await post('Premature reply',{parentId:root.id},cookieB)).status,409);
  assert.equal((await admin({op:'moderate',id:root.id,status:'approved'})).status,200);
  await count(1);
  r=await request(path);assert.equal(r.data.comments[0].name,'Tamu Komentar A');assert.ok(!r.text.includes('guest_id'));assert.ok(!r.text.includes('token_hash'));
  const heart='/api/photo-comments/'+root.id+'/heart';
  assert.equal((await request(heart,{liked:true},{method:'PUT'})).status,401);
  for(let i=0;i<2;i++){r=await request(heart,{liked:true},{cookie:cookieB,method:'PUT'});assert.equal(r.status,200,r.text);assert.equal(r.data.hearts,1);}
  assert.equal((await request(heart,{liked:false},{cookie:cookieB,method:'PUT'})).data.hearts,0);
  const replied=await post('Balasan B',{parentId:root.id},cookieB);assert.equal(replied.status,201,replied.text);const reply=replied.data.comment;
  assert.equal((await post('Too deep',{parentId:reply.id},cookieA)).status,409);
  assert.equal((await request('/api/photo-comments',{photo:'archive:'+pages.id,message:'Cross photo',parentId:root.id},{cookie:cookieB})).status,409);
  assert.equal((await request(path)).data.comments[0].replies.length,0);
  await count(1);await count(2,cookieB);await count(1,cookieA);
  assert.equal((await admin({op:'moderate',id:reply.id,status:'approved'})).status,200);
  assert.equal((await admin({op:'reply',id:root.id,message:'Dari Iga & Bagas.'})).status,200);
  await count(3);
  r=await request(path);assert.equal(r.data.comments[0].replies.length,2);assert.ok(r.data.comments[0].replies.some(p=>p.name==='Iga & Bagas'&&p.kind==='couple'));
  assert.equal((await admin({op:'moderate',id:root.id,status:'hidden'})).status,200);
  assert.equal((await request(path,null,{cookie:cookieB})).data.comments.length,0);
  await count(0,cookieB);
  assert.equal((await request(heart,{liked:true},{cookie:cookieB,method:'PUT'})).status,404);
  assert.equal((await admin({op:'moderate',id:root.id,status:'approved'})).status,200);
  assert.equal((await admin({op:'photo',photo:key,enabled:false})).status,200);
  assert.equal((await post('Closed')).status,403);assert.equal((await request(path)).data.enabled,false);
  assert.equal((await count(3)).photos[key].enabled,false);
  assert.equal((await admin({op:'photo',photo:key,enabled:true})).status,200);
  assert.equal((await admin({op:'config',enabled:true,moderation:false})).status,200);
  const immediate=await post('Langsung tampil');assert.equal(immediate.status,201);assert.equal(immediate.data.comment.status,'approved');
  assert.equal((await request('/api/photo-comments/'+immediate.data.comment.id,null,{cookie:cookieB,method:'DELETE'})).status,404);
  assert.equal((await request('/api/photo-comments/'+immediate.data.comment.id,null,{cookie:cookieA,method:'DELETE'})).status,200);
  assert.equal((await admin({op:'moderate',id:immediate.data.comment.id,status:'approved'})).status,409);
  assert.equal((await admin({op:'config',enabled:false,moderation:true})).status,200);
  assert.equal((await post('Globally closed')).status,403);
  assert.equal((await admin({op:'config',enabled:true,moderation:true})).status,200);
  assert.equal((await request('/api/photo-comments/'+root.id,null,{cookie:cookieA,method:'DELETE'})).status,200);
  assert.equal((await request(path)).data.comments.length,0,'Deleting a root conceals its replies');
  await count(0);
  assert.equal((await state({op:'regenerate_token',id:a.guestId})).status,200);
  assert.equal((await request(path,null,{cookie:cookieA})).data.viewer,null,'Rotating an invitation revokes its old comment session');
  assert.equal((await post('Old session')).status,401);
  assert.equal((await state({op:'archive_entry',id:live.id})).status,200);
  assert.equal((await request(path)).status,404,'Unpublishing also hides its conversations');
  assert.ok(!(key in (await request(overview)).data.photos));

  // Gallery conversations follow the stable block id across reordering and media replacement.
  const website=(await request('/api/admin/website',null,{cookie:adminCookie})).data;
  const block=website.blocks.photos[0],galleryKey='gallery:'+block.id;
  async function uploadGallery(){const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'fixture.png');const result=await fetch(base+'/api/admin/media/'+block.slot,{method:'POST',headers:{cookie:adminCookie,origin:base},body:form});assert.equal(result.status,200,await result.text());}
  await uploadGallery();
  r=await request('/api/photo-comments',{photo:galleryKey,message:'Tetap pada foto yang sama.'},{cookie:cookieB});assert.equal(r.status,201,r.text);const galleryComment=r.data.comment.id;
  assert.equal((await admin({op:'moderate',id:galleryComment,status:'approved'})).status,200);
  let editor=(await request('/api/admin/editor?section=archive',null,{cookie:adminCookie})).data;
  const snapshot=structuredClone(editor.live);snapshot.blocks.photos.reverse();
  r=await request('/api/admin/editor',{section:'archive',op:'save',version:editor.document.version,snapshot},{cookie:adminCookie});assert.equal(r.status,200,r.text);editor=r.data;
  r=await request('/api/admin/editor',{section:'archive',op:'publish',version:editor.document.version},{cookie:adminCookie});assert.equal(r.status,200,r.text);
  await uploadGallery();
  r=await request('/api/photo-comments?photo='+galleryKey);assert.equal(r.data.comments[0].id,galleryComment);
  r=await request('/api/photo-comments/overview?photo='+galleryKey);assert.equal(r.data.photos[galleryKey].total,1);
  assert.equal((await admin({op:'photo',photo:galleryKey,enabled:false})).status,200);
  assert.equal((await request('/api/photo-comments',{photo:galleryKey,message:'Closed gallery'},{cookie:cookieB})).status,403);

  // Fixed timestamps exercise keyset tie-breaking and reply preview pagination.
  const pagedKey='archive:'+pages.id,ids=Array.from({length:18},()=>`pc_${randomUUID()}`).sort();
  const sqlQuote=value=>"'"+value.replaceAll("'","''")+"'";
  execute(ids.map((id,i)=>`INSERT INTO photo_comments(id,photo_key,guest_id,author_kind,author_name,message,moderation_status,created_at) VALUES (${sqlQuote(id)},${sqlQuote(pagedKey)},${sqlQuote(b.guestId)},'guest','Tamu Komentar B','Root ${i}','approved','2026-10-08 00:00:00');`).join('\n'));
  const replyIds=Array.from({length:18},()=>`pc_${randomUUID()}`).sort(),parent=ids.at(-1);
  execute(replyIds.map((id,i)=>`INSERT INTO photo_comments(id,photo_key,parent_id,guest_id,author_kind,author_name,message,moderation_status,created_at) VALUES (${sqlQuote(id)},${sqlQuote(pagedKey)},${sqlQuote(parent)},${sqlQuote(b.guestId)},'guest','Tamu Komentar B','Reply ${i}','approved','2026-10-08 00:00:01');`).join('\n'));
  const first=(await request('/api/photo-comments?photo='+pagedKey)).data;assert.equal(first.comments.length,15);assert.equal(first.hasMore,true);
  r=await request('/api/photo-comments/overview?photo='+pagedKey);assert.equal(r.data.photos[pagedKey].total,36,'Counts include every visible root and reply, beyond the first page');
  const next=(await request('/api/photo-comments?photo='+pagedKey+'&after='+first.nextCursor)).data;assert.equal(next.comments.length,3);assert.equal(next.hasMore,false);
  assert.equal(new Set([...first.comments,...next.comments].map(c=>c.id)).size,18);
  const thread=first.comments.find(c=>c.id===parent);assert.equal(thread.replyCount,18);assert.equal(thread.replies.length,3);assert.equal(thread.replyCursor,replyIds[2]);
  const rest=(await request('/api/photo-comments?photo='+pagedKey+'&parent='+parent+'&after='+thread.replyCursor)).data;
  assert.equal(rest.comments.length,15);assert.deepEqual([...thread.replies,...rest.comments].map(c=>c.id),replyIds);
  r=await request('/api/admin/photo-comments?status=all&q=Tamu%20Komentar%20B&page=0',null,{cookie:adminCookie});assert.equal(r.status,200);assert.equal(r.data.comments.length,25);assert.ok(r.data.total>25);
  const backup=(await state()).data;assert.ok(backup.guests);
  const fullBackup=(await request('/api/admin/state?export=backup',null,{cookie:adminCookie})).data;
  assert.ok(fullBackup.photoComments.some(c=>c.id===galleryComment));assert.ok(fullBackup.photoCommentSettings.some(p=>p.photo_key===galleryKey));assert.ok(Array.isArray(fullBackup.photoCommentHearts));
  console.log('Photo comments: signed identities, pending isolation, moderation, one-level replies, couple replies, idempotent hearts, closing, removal/revocation, draft privacy and keyset pagination: OK');
}
