import assert from 'node:assert/strict';
import { serializeRichText, RICH_TEXT_PREFIX } from '../lib/rich-text.ts';
export async function verifyEditorialFlows(base,cookie){
  async function request(path,body,{method=body?'POST':'GET',auth=true,origin=base}={}){
    const response=await fetch(base+path,{method,redirect:'manual',headers:{...(auth?{cookie}:{}),...(body?{'content-type':'application/json',origin}:{})},body:body?JSON.stringify(body):undefined});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}return {status:response.status,data,text,headers:response.headers};
  }
  const read=id=>request(`/api/admin/editor?section=${id}`);
  const act=(id,state,op,extra={})=>request('/api/admin/editor',{section:id,version:state.document.version,op,...extra});
  assert.equal((await request('/api/admin/editor?section=hero',null,{auth:false})).status,403);
  assert.equal((await request('/api/admin/editor?section=unknown')).status,400);
  // Stakk uses the existing draft/publish contract; its public endpoint never exposes drafts.
  let stakk=(await read('stakk')).data;
  assert.ok(stakk.live.copy['id.stakk.title']);
  const stakkOriginal=structuredClone(stakk.live),stakkDraft=structuredClone(stakk.live);
  stakkDraft.copy['id.stakk.title']='PRIVATE_STAKK_DRAFT';stakkDraft.copy['stakk.cta']='Camera fixture CTA';
  let stakkResponse=await act('stakk',stakk,'save',{snapshot:stakkDraft});assert.equal(stakkResponse.status,200,stakkResponse.text);stakk=stakkResponse.data;
  assert.ok(!(await request('/api/stakk',null,{auth:false})).text.includes('PRIVATE_STAKK_DRAFT'));
  assert.ok((await request('/admin/content-preview?section=stakk')).text.includes('PRIVATE_STAKK_DRAFT'));
  stakkResponse=await act('stakk',stakk,'publish');assert.equal(stakkResponse.status,200,stakkResponse.text);stakk=stakkResponse.data;
  const publicStakk=await fetch(base+'/api/stakk');
  assert.equal(publicStakk.status,200);assert.match(publicStakk.headers.get('cache-control'),/no-store/);
  const publicCopy=await publicStakk.json();assert.equal(publicCopy.languages.id.title,'PRIVATE_STAKK_DRAFT');assert.equal(publicCopy.languages.en.cta,'Camera fixture CTA');
  assert.deepEqual(Object.keys(publicCopy).sort(),['languages','version']);assert.deepEqual(Object.keys(publicCopy.languages.id).sort(),['cta','description','eyebrow','hint','title']);
  assert.equal((await fetch(base+'/api/stakk',{headers:{origin:'https://evil.example'}})).status,403);

  stakkResponse=await act('stakk',stakk,'save',{snapshot:stakkOriginal});assert.equal(stakkResponse.status,200);stakk=stakkResponse.data;
  assert.equal((await act('stakk',stakk,'publish')).status,200);
  console.log('Stakk CMS: private draft/preview, public bilingual publication, exact copy allowlist and CORS: OK');
  let hero=(await read('hero')).data;
  const key=Object.keys(hero.live.copy).find(k=>k.startsWith('id.'));
  assert.ok(key);const original=structuredClone(hero.live);
  const draft=structuredClone(original);draft.copy[key]='PRIVATE_EDITOR_DRAFT_SENTINEL';
  assert.equal((await request('/api/admin/editor',{section:'hero',version:hero.document.version,op:'save',snapshot:draft},{auth:false})).status,403);
  assert.equal((await request('/api/admin/editor',{section:'hero',version:hero.document.version,op:'save',snapshot:draft},{origin:'https://other.example'})).status,403);
  for(const invalid of [{...draft,copy:{...draft.copy,'id.profil.head':'foreign'}},{...draft,config:{venueName:'foreign'}},{...draft,copy:{...draft.copy,[key]:'x'.repeat(2001)}},{...draft,media:{bagas:'content/bagas.png'}},{...draft,unknown:true}])assert.equal((await act('hero',hero,'save',{snapshot:invalid})).status,400);
  let response=await act('hero',hero,'save',{snapshot:draft});assert.equal(response.status,200,response.text);hero=response.data;
  assert.equal(hero.document.history.length,2);assert.equal(hero.document.draft.copy[key],draft.copy[key]);
  assert.ok(!(await request('/')).text.includes(draft.copy[key]));
  const preview=await request('/admin/content-preview?section=hero');assert.equal(preview.status,200);assert.ok(preview.text.includes(draft.copy[key]));
  const anonymous=await request('/admin/content-preview?section=hero',null,{auth:false});assert.ok([302,307].includes(anonymous.status));assert.ok(!anonymous.text.includes(draft.copy[key]));
  assert.equal((await act('hero',{document:{version:'initial'}},'publish')).status,409);
  response=await act('hero',hero,'publish');assert.equal(response.status,200,response.text);hero=response.data;
  assert.equal(hero.document.draft,null);assert.ok((await request('/')).text.includes(draft.copy[key]));
  const publishedId=hero.document.publishedId;
  assert.equal((await request(`/api/admin/editor?section=hero&revision=${publishedId}`)).data.revision.copy[key],draft.copy[key]);
  assert.match((await read('hero')).headers.get('cache-control'),/no-store/);
  assert.ok(!(await request('/api/admin/state')).data.settings.some(s=>s.key.startsWith('cms.editor.')));
  assert.ok((await request('/api/admin/state?export=backup')).data.settings.some(s=>s.key.startsWith('cms.editor.')));
  let details=(await read('details')).data;const detailsDraft=structuredClone(details.live);detailsDraft.config.venueName='DRAFT_VENUE_SENTINEL';detailsDraft.blocks.faq=[{id:'fixture-faq',title:{id:'Pertanyaan draf',en:'Draft question'},body:{id:'Jawaban draf',en:'Draft answer'}}];
  const websiteBefore=(await request('/api/admin/website')).data.config;
  response=await act('details',details,'save',{snapshot:detailsDraft});assert.equal(response.status,200,response.text);details=response.data;
  assert.equal((await request('/api/admin/website')).data.config.venueName,websiteBefore.venueName);
  assert.ok((await request('/admin/content-preview?section=details')).text.includes('DRAFT_VENUE_SENTINEL'));
  response=await act('details',details,'publish');assert.equal(response.status,200,response.text);details=response.data;
  const site=(await request('/api/admin/website')).data;assert.equal(site.config.venueName,'DRAFT_VENUE_SENTINEL');assert.equal(site.config.metaTitle,websiteBefore.metaTitle);assert.equal(site.blocks.faq[0].id,'fixture-faq');
  assert.ok((await request('/')).text.includes(draft.copy[key]),'Other section copy is preserved');
  const baseline=hero.document.history.find(r=>r.kind==='baseline');
  response=await act('hero',hero,'restore',{revision:baseline.id});assert.equal(response.status,200,response.text);hero=response.data;
  assert.deepEqual(hero.document.draft,original);assert.ok((await request('/')).text.includes(draft.copy[key]),'Restore does not publish');
  response=await act('hero',hero,'publish');assert.equal(response.status,200,response.text);hero=response.data;
  assert.ok(!(await request('/')).text.includes(draft.copy[key]));
  const reset=structuredClone(hero.live);reset.copy[key]='';response=await act('hero',hero,'save',{snapshot:reset});assert.equal(response.status,200);hero=response.data;
  response=await act('hero',hero,'publish');assert.equal(response.status,200);hero=response.data;assert.equal(hero.live.copy[key],original.copy[key]);
  // A legacy authoring endpoint still works, records history, and makes old drafts stale.
  response=await act('hero',hero,'save',{snapshot:draft});assert.equal(response.status,200);hero=response.data;
  assert.equal((await request('/api/admin/content',{values:{[key]:'LEGACY_PUBLISHED_SENTINEL'}},{method:'PUT'})).status,200);
  assert.equal((await act('hero',hero,'publish')).status,409);
  hero=(await read('hero')).data;assert.notEqual(hero.document.draftBaseHash,hero.liveHash);
  assert.equal((await act('hero',hero,'publish')).status,409,'Stale draft requires explicit review/save');
  response=await act('hero',hero,'save',{snapshot:draft});assert.equal(response.status,200);hero=response.data;
  response=await act('hero',hero,'publish');assert.equal(response.status,200);hero=response.data;
  assert.equal((await act('hero',hero,'restore',{revision:'missing'})).status,400);
  // Same-version concurrent requests produce one winner and no partially persisted loser.
  const a=structuredClone(hero.live),b=structuredClone(hero.live);a.copy[key]='RACE_A';b.copy[key]='RACE_B';
  const raced=await Promise.all([act('hero',hero,'save',{snapshot:a}),act('hero',hero,'save',{snapshot:b})]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
  hero=(await read('hero')).data;const winner=hero.document.draft.copy[key];assert.ok(['RACE_A','RACE_B'].includes(winner));
  const historyDrafts=await Promise.all(hero.document.history.filter(r=>r.kind==='draft').map(r=>request(`/api/admin/editor?section=hero&revision=${r.id}`)));assert.ok(!historyDrafts.some(r=>r.data.revision.copy[key]===(winner==='RACE_A'?'RACE_B':'RACE_A')));
  // Rich text survives private drafts, publication, reload and historical restoration.
  let proseState=(await read('profil')).data;
  const proseOriginal=structuredClone(proseState.live);
  const proseDraft=structuredClone(proseOriginal);
  const prose=serializeRichText({type:'doc',content:[{type:'paragraph',attrs:{spaceAfter:'airy'},content:[{type:'text',text:'RICH_PROSE_FIXTURE',marks:[{type:'bold'}]}]},{type:'paragraph',content:[{type:'text',text:'Italic fixture',marks:[{type:'italic'}]},{type:'hardBreak'},{type:'text',text:'Next line'}]}]});
  proseDraft.copy['id.profil.i_known']=prose;
  response=await act('profil',proseState,'save',{snapshot:proseDraft});assert.equal(response.status,200,response.text);proseState=response.data;
  assert.ok(!(await request('/')).text.includes('RICH_PROSE_FIXTURE'));
  const prosePreview=await request('/admin/content-preview?section=profil');
  assert.ok(prosePreview.text.includes('<strong>RICH_PROSE_FIXTURE</strong>'));
  assert.ok(prosePreview.text.includes('data-space="airy"'));
  response=await act('profil',proseState,'publish');assert.equal(response.status,200,response.text);proseState=response.data;
  assert.equal((await read('profil')).data.live.copy['id.profil.i_known'],prose);
  assert.ok((await request('/')).text.includes('<em>Italic fixture</em>'));
  const malformed=structuredClone(proseDraft);malformed.copy['id.profil.i_known']=RICH_TEXT_PREFIX+'{"type":"script"}';
  assert.equal((await act('profil',proseState,'save',{snapshot:malformed})).status,400);
  const titleInjection=structuredClone(proseDraft);titleInjection.copy['id.profil.i_nama']=prose;
  assert.equal((await act('profil',proseState,'save',{snapshot:titleInjection})).status,400);
  const proseBaseline=proseState.document.history.find(r=>r.kind==='baseline');
  response=await act('profil',proseState,'restore',{revision:proseBaseline.id});assert.equal(response.status,200,response.text);proseState=response.data;
  assert.deepEqual(proseState.document.draft,proseOriginal);
  response=await act('profil',proseState,'publish');assert.equal(response.status,200,response.text);
  assert.ok(!(await request('/')).text.includes('RICH_PROSE_FIXTURE'));
  // Draft media stays private and immutable, and only publication changes a live slot.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xAAAAABJRU5ErkJggg==','base64');
  async function upload(){const form=new FormData();form.set('file',new Blob([png],{type:'image/png'}),'fixture.png');const r=await fetch(base+'/api/admin/editor/media/bagas?section=profil',{method:'POST',headers:{cookie,origin:base},body:form});return {status:r.status,data:await r.json()};}
  const firstPhoto=await upload();assert.equal(firstPhoto.status,200);assert.equal((await request(firstPhoto.data.url,null,{auth:false})).status,403);assert.equal((await request('/api/admin/media/bagas',null,{auth:false})).status,404);
  let profile=(await read('profil')).data;const photoDraft=structuredClone(profile.live);photoDraft.media.bagas=firstPhoto.data.key;
  response=await act('profil',profile,'save',{snapshot:photoDraft});assert.equal(response.status,200,response.text);profile=response.data;
  assert.equal((await request('/api/admin/media/bagas',null,{auth:false})).status,404);
  response=await act('profil',profile,'publish');assert.equal(response.status,200);profile=response.data;
  const publicPhoto=await fetch(base+'/api/admin/media/bagas');assert.equal(publicPhoto.status,200);assert.deepEqual(Buffer.from(await publicPhoto.arrayBuffer()),png);
  const secondPhoto=await upload();assert.equal(secondPhoto.status,200);assert.notEqual(secondPhoto.data.key,firstPhoto.data.key);assert.equal((await request(firstPhoto.data.url)).status,200,'Older image object remains recoverable');
  // GIF bytes remain animated through private upload, draft, publish and recovery.
  const gif=Buffer.from('R0lGODlhBAADAIEAACFDMQAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQIEgAAACwAAAAABAADAAAICAABCBxIUGBAACH5BAgqAAAALAAAAAAEAAMAgeiqwAAAAAAAAAAAAAgIAAEIHEhQYEAAIfkECEgAAAAsAAAAAAQAAwCBuphYAAAAAAAAAAAACAgAAQgcSFBgQAA7','base64');
  let album=(await read('archive')).data;const gifSlot=album.live.blocks.photos[0].slot,publicGifPath=`/api/admin/media/${gifSlot}`;
  const motionFixture=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(24)]);
  async function uploadGif(section,slot,bytes=gif,{auth=true,origin=base,type='image/gif',previews=false}={}){
    const form=new FormData();form.set('file',new Blob([bytes],{type}),'animated.gif');
    if(previews){form.set('card',new Blob([png],{type:'image/png'}),'card.png');form.set('large',new Blob([png],{type:'image/png'}),'large.png');form.set('motion',new Blob([motionFixture],{type:'video/mp4'}),'motion.mp4');}
    const r=await fetch(`${base}/api/admin/editor/media/${slot}?section=${section}`,{method:'POST',headers:{...(auth?{cookie}:{}),origin},body:form});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=null;}return {status:r.status,data};
  }
  assert.equal((await uploadGif('archive',gifSlot,gif,{auth:false})).status,403);
  assert.equal((await uploadGif('archive',gifSlot,gif,{origin:'https://other.example'})).status,403);
  assert.equal((await uploadGif('profil','bagas')).status,400);
  assert.equal((await uploadGif('archive',gifSlot,Buffer.from('not a GIF'))).status,400);
  assert.equal((await uploadGif('archive',gifSlot,Buffer.alloc(20*1024*1024+1))).status,413);
  assert.equal((await uploadGif('archive',gifSlot,Buffer.alloc(5*1024*1024+1),{type:'image/png'})).status,413,'Still photos retain their server upload limit');
  const maximumGif=Buffer.alloc(20*1024*1024);gif.copy(maximumGif);
  assert.equal((await uploadGif('archive',gifSlot,maximumGif)).status,200,'The full advertised GIF limit passes the multipart preflight');
  const gifUpload=await uploadGif('archive',gifSlot,gif,{previews:true});assert.equal(gifUpload.status,200);assert.match(gifUpload.data.key,/\.gif$/);assert.equal(gifUpload.data.previewMode,'motion');
  assert.equal((await request(gifUpload.data.url,null,{auth:false})).status,403);
  const privateGif=await fetch(base+gifUpload.data.url,{headers:{cookie}});assert.equal(privateGif.status,200);assert.equal(privateGif.headers.get('content-type'),'image/gif');assert.deepEqual(Buffer.from(await privateGif.arrayBuffer()),gif);
  const privatePreviewUrl=gifUpload.data.url+'&preview=card';
  assert.equal((await request(privatePreviewUrl,null,{auth:false})).status,403);
  const privatePreview=await fetch(base+privatePreviewUrl,{headers:{cookie}});assert.equal(privatePreview.status,200);assert.match(privatePreview.headers.get('cache-control'),/private.*no-store/);assert.deepEqual(Buffer.from(await privatePreview.arrayBuffer()),png);
  assert.equal((await request(publicGifPath+'?preview=card',null,{auth:false})).status,404,'A stored draft preview is not public');
  const albumOriginal=structuredClone(album.live),albumDraft=structuredClone(album.live);albumDraft.media[gifSlot]=gifUpload.data.key;
  response=await act('archive',album,'save',{snapshot:albumDraft});assert.equal(response.status,200,response.text);album=response.data;
  assert.equal((await read('archive')).data.document.draft.media[gifSlot],gifUpload.data.key);
  assert.equal((await request(publicGifPath,null,{auth:false})).status,404);
  assert.equal((await request('/admin/content-preview?section=archive')).status,200);
  response=await act('archive',album,'publish');assert.equal(response.status,200,response.text);album=response.data;
  const publicGif=await fetch(base+publicGifPath);assert.equal(publicGif.status,200);assert.equal(publicGif.headers.get('content-type'),'image/gif');assert.deepEqual(Buffer.from(await publicGif.arrayBuffer()),gif);
  const publicCard=await fetch(base+publicGifPath+'?preview=card');assert.equal(publicCard.status,200);assert.equal(publicCard.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await publicCard.arrayBuffer()),png);
  const etag=publicCard.headers.get('etag');assert.ok(etag);assert.equal((await fetch(base+publicGifPath+'?preview=card',{headers:{'if-none-match':etag}})).status,304);
  const probe=await fetch(base+publicGifPath+'?preview=motion',{headers:{range:'bytes=0-1'}});assert.equal(probe.status,206);assert.equal(probe.headers.get('content-range'),`bytes 0-1/${motionFixture.length}`);assert.deepEqual(Buffer.from(await probe.arrayBuffer()),motionFixture.subarray(0,2));
  assert.equal((await fetch(base+publicGifPath+'?preview=motion',{headers:{range:'bytes=99999-'}})).status,416);
  assert.ok((await request('/')).text.includes(publicGifPath),'GIF reaches the homepage album');
  // A new archive-only photo is public in the full album, but cannot expand the homepage.
  const extraSlot='gallery-extra-fixture',extraUpload=await uploadGif('archive',extraSlot);
  assert.equal(extraUpload.status,200);
  const extended=structuredClone(album.live);
  extended.blocks.photos.push({id:'archive-only-fixture',slot:extraSlot,caption:{id:'ARCHIVE_ONLY_SENTINEL',en:'ARCHIVE_ONLY_SENTINEL'},homepage:false});
  extended.media[extraSlot]=extraUpload.data.key;
  response=await act('archive',album,'save',{snapshot:extended});assert.equal(response.status,200,response.text);album=response.data;
  assert.ok(!(await request('/archive')).text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').includes('ARCHIVE_ONLY_SENTINEL'));
  response=await act('archive',album,'publish');assert.equal(response.status,200,response.text);album=response.data;
  const markup=text=>text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  assert.ok(!markup((await request('/')).text).includes('ARCHIVE_ONLY_SENTINEL'));
  const albumMarkup=markup((await request('/archive')).text);
  assert.ok(albumMarkup.includes('ARCHIVE_ONLY_SENTINEL'));
  assert.ok(!albumMarkup.includes('/archive/photo-archive-only-fixture'),'Gallery captions do not link to a nonexistent story route');
  const featured=structuredClone(album.live);featured.blocks.photos.at(-1).homepage=true;
  response=await act('archive',album,'save',{snapshot:featured});assert.equal(response.status,200,response.text);album=response.data;
  response=await act('archive',album,'publish');assert.equal(response.status,200,response.text);album=response.data;
  assert.ok(markup((await request('/')).text).includes('ARCHIVE_ONLY_SENTINEL'));
  console.log('Album publication: archive-only default, fixed homepage selection, explicit featuring and real photo viewer links: OK');
  const albumBaseline=album.document.history.find(r=>r.kind==='baseline');
  response=await act('archive',album,'restore',{revision:albumBaseline.id});assert.equal(response.status,200);album=response.data;assert.deepEqual(album.document.draft,albumOriginal);
  response=await act('archive',album,'publish');assert.equal(response.status,200);assert.equal((await request(publicGifPath,null,{auth:false})).status,404);assert.equal((await request(publicGifPath+'?preview=card',null,{auth:false})).status,404,'An old edge cache cannot bypass the current publication mapping');assert.equal((await request(gifUpload.data.url)).status,200,'Original GIF remains recoverable');
  console.log('Archive GIF upload: unchanged animation bytes, scoped formats/limits, draft privacy, publish to the album and restore: OK');
  // Histories are bounded, while the current live version is preserved for recovery.
  for(let i=0;i<33;i++){const edit=structuredClone(hero.document.draft??hero.live);edit.copy[key]=`Retention fixture ${i}`;response=await act('hero',hero,'save',{snapshot:edit});assert.equal(response.status,200,response.text);hero=response.data;}
  assert.equal(hero.document.history.length,30);assert.ok(hero.document.history.some(r=>r.id===hero.document.publishedId));
  response=await act('hero',hero,'discard');assert.equal(response.status,200);assert.equal(response.data.document.draft,null);
  console.log('CMS editorial: private drafts/preview/media, atomic publish, section isolation, history/restore/reset, legacy compatibility, concurrent save rejection and bounded recovery: OK');
}
