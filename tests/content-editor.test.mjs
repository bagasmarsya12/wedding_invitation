import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
const hook=registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')){const url=new URL(`${specifier}.ts`,context.parentURL);if(existsSync(url))return next(url.href,context);}throw error;}}});
const {CONTENT_ALIASES,resolveContentAliases,replacedContentAliases}=await import('../lib/content-aliases.ts');
const {contentEditorSections}=await import('../lib/content-editor-sections.ts');
const {sectionCopyKeys,validateSectionSnapshot}=await import('../lib/cms-editorial.ts');
const {groupEditorFields,sectionWebsiteTarget}=await import('../lib/cms-field-guide.ts');
const {WEBSITE_DEFAULTS,defaultWebsiteBlocks}=await import('../lib/website-content.ts');
const {CONTENT_DEFAULTS}=await import('../lib/content-defaults.ts');
const {copyKey}=await import('../lib/copy-registry.ts');
const {invitationMessage,invitationToken,DEFAULT_INVITATION_MESSAGE,validInvitationTemplate}=await import('../lib/invitation-message.ts');
const {publicStakkContent,stakkCorsHeaders}=await import('../lib/stakk-content.ts');
hook.deregister();

test('section editor exposes live bilingual fields and collection tools without duplicate keys',()=>{
  const sections=contentEditorSections(),keys=sections.flatMap(section=>section.fields.map(field=>field.key));
  assert.equal(new Set(keys).size,keys.length);
  for(const section of sections)for(const field of section.fields){assert.equal(typeof CONTENT_DEFAULTS[field.key],'string');assert.equal(typeof CONTENT_DEFAULTS[`id.${field.key}`],'string');}
  for(const section of ['hero','details','profil','story','archive','rsvp','gift','keepsake','footer','navigation','seo'])assert.ok(sections.some(value=>value.id===section));
  assert.deepEqual(sections.find(section=>section.id==='details').tools,['event','arrival','faq']);
  assert.ok(!sections.some(section=>['arrival','useful'].includes(section.id)));
  for(const key of ['details.head','guest.arrival','guest.faq','guest.contact'])assert.ok(sections.find(section=>section.id==='details').fields.some(field=>field.key===key),key);
  assert.deepEqual(sections.find(section=>section.id==='archive').tools,['photos','entries','comments']);
  assert.ok(sections.find(section=>section.id==='gift').tools.includes('gifts'));
});

test('guest actions and Story export states all have CMS controls',()=>{
  const keys=new Set(contentEditorSections().flatMap(section=>section.fields.map(field=>field.key)));
  for(const literal of ['Open the invitation','Skip opening','Open directions','Open your keepsake','Save digital keepsake','Save front as image','Save back as image','Save guest pass','Enlarge QR','Close guest pass','Copy pass code','Book this gift','Open purchase link','Read more','Save my reply','Send my postcard','Send card','Try again','Gift reservations are currently closed.','Write or draw something first.'])assert.ok(keys.has(copyKey(literal))||contentEditorSections().some(section=>section.fields.some(field=>field.value===literal)),literal);
  for(const field of ['title','format','video','videoAgain','front','back','frontAgain','backAgain','preparingVideo','preparingImage','wait','cancel','ready','error','progress','videoPreview','imagePreview'])assert.ok(keys.has(`storyDownload.${field}`),field);
  assert.ok(keys.has('keepsake.hashtag'));assert.ok(CONTENT_DEFAULTS['id.countdown.days'].includes('{{days}}'));
});

test('gift item labels, transfer actions and empty/error states are editable in the gift CMS section',()=>{
  const section = contentEditorSections().find(section=>section.id==='gift');
  const keys = new Set(section.fields.map(field=>field.key));
  for (const literal of ['Gift an object','For Iga & Bagas','Cash gift','Open DANA','Copy phone number','Copy account number','Opening the gift options…','Gift options are temporarily unavailable. Please try again.','Your presence is already a gift.','Send a little love via DANA.','Phone number','Account number']) assert.ok(keys.has(copyKey(literal)),literal);
  for (const key of ['gift.head','gift.desc','gift.cta','gift.kosong']) assert.ok(keys.has(key),key);
});

test('reviewed invitation message fills owner-editable template with the existing private link',()=>{
  assert.ok(validInvitationTemplate(DEFAULT_INVITATION_MESSAGE));
  const url='https://example.test/invite/private_fixture_1234567890';
  const value=invitationMessage(DEFAULT_INVITATION_MESSAGE,'Tamu & Keluarga',url);
  assert.ok(value.includes('Tamu & Keluarga'));assert.ok(value.includes(url));assert.ok(value.includes('Iga & Bagas'));assert.ok(!value.includes('{{'));
});

test('CMS can reuse existing private links across the two production origins without accepting foreign links',()=>{
  const origins=['https://iganyabagas.com','https://bagas-iga-wedding.bagasmarsya.workers.dev'];
  const token='private_fixture_123456789012345678';
  for(const current of origins)for(const source of origins)assert.equal(invitationToken(`${source}/invite/${token}`,current),token);
  for(const current of origins)for(const value of [
    `https://example.com/invite/${token}`,`http://iganyabagas.com/invite/${token}`,
    `https://iganyabagas.com.example.com/invite/${token}`,`https://user:secret@iganyabagas.com/invite/${token}`,
    `https://iganyabagas.com/invite/${token}?guest=someone`,`https://iganyabagas.com/invite/${token}#guest`,
    'https://iganyabagas.com/invite/invalid',`http://localhost:5214/invite/${token}`,
  ])assert.equal(invitationToken(value,current),null);
  assert.equal(invitationToken(`https://iganyabagas.com/invite/${token}`,'http://localhost:5214'),null);
});

test('legacy wording aliases remain editable and a reset clears the same-language predecessor',()=>{
 const pair=CONTENT_ALIASES.find(pair=>pair.key==='hero.hero head');
 assert.ok(pair);const stored={['id.'+pair.alias]:'Kalimat lama dari CMS'};
 const values=resolveContentAliases({...CONTENT_DEFAULTS},stored);
 assert.equal(values['id.'+pair.key],stored['id.'+pair.alias]);
 assert.deepEqual(replacedContentAliases(['id.'+pair.key]),['id.'+pair.alias]);
 assert.ok(!replacedContentAliases(['id.'+pair.key]).includes(pair.alias));
});

test('photo comment copy and actions are editable inside the Archive section',()=>{
 const archive=contentEditorSections().find(s=>s.id==='archive');
 for(const field of ['title','count','countOne','placeholder','send','reply','sendReply','like','pendingSent','signIn','delete','moreReplies'])assert.ok(archive.fields.some(f=>f.key===`photoComments.${field}`),field);
 for(const field of ['count','countOne'])for(const prefix of ['','id.'])assert.ok(CONTENT_DEFAULTS[prefix+'photoComments.'+field].includes('{{count}}'));
});

test('Stakk controls are bilingual and old footer revisions retain all existing copy and links',()=>{
 const footer=contentEditorSections().find(section=>section.id==='footer');
 const group=groupEditorFields(footer).find(group=>group.title.startsWith('Stakk'));
 const added=group.fields.flatMap(field=>[field.key,`id.${field.key}`]);
 assert.equal(added.length,6);
 assert.ok(!group.fields.some(field=>field.key==='footer.stakkHint'));
 for(const key of added)assert.ok(CONTENT_DEFAULTS[key]);
 const blocks=defaultWebsiteBlocks(),copy=Object.fromEntries(sectionCopyKeys('footer').filter(key=>!added.includes(key)).map(key=>[key,CONTENT_DEFAULTS[key]]));
 copy['beyond.head']='Kalimat pemilik yang harus tetap ada';
 const old={copy,config:{},blocks:{links:blocks.links},media:{}};
 const restored=validateSectionSnapshot('footer',old,{config:WEBSITE_DEFAULTS,blocks});
 assert.ok(restored);
 assert.equal(restored.copy['beyond.head'],copy['beyond.head']);
 assert.deepEqual(restored.blocks.links,old.blocks.links);
 for(const key of added)assert.equal(restored.copy[key],'');
 assert.deepEqual(old.copy,copy,'Backfill must not mutate the stored revision');
});

test('Stakk has its own bilingual CMS section and only public landing copy crosses origins',()=>{
 const section=contentEditorSections().find(section=>section.id==='stakk');
 assert.equal(groupEditorFields(section)[0].fields.length,5);
 assert.equal(sectionCopyKeys('stakk').length,10);
 assert.equal(sectionWebsiteTarget('stakk'),'https://stakk.iganyabagas.com/');
 const copy=Object.fromEntries(sectionCopyKeys('stakk').map(key=>[key,CONTENT_DEFAULTS[key]]));
 const snapshot=validateSectionSnapshot('stakk',{copy,config:{},blocks:{},media:{}},{config:WEBSITE_DEFAULTS,blocks:defaultWebsiteBlocks()});
 assert.ok(snapshot);assert.equal(snapshot.copy['id.stakk.cta'],'Buka kamera');
 const response=publicStakkContent({...CONTENT_DEFAULTS,'id.stakk.title':'Owner copy','admin.secret':'do not expose','id.stakk.cta':''});
 assert.equal(response.languages.id.title,'Owner copy');assert.equal(response.languages.id.cta,'Buka kamera');
 assert.deepEqual(Object.keys(response.languages.id),['eyebrow','title','description','cta','hint']);
 assert.ok(!JSON.stringify(response).includes('do not expose'));
 assert.equal(stakkCorsHeaders('https://evil.example'),null);
 assert.equal(stakkCorsHeaders('https://stakk.iganyabagas.com')['Access-Control-Allow-Origin'],'https://stakk.iganyabagas.com');
 assert.equal(stakkCorsHeaders(null)['Access-Control-Allow-Origin'],undefined);
});
