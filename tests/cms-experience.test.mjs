import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const hook = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(url)) return next(url.href, context);
    }
    throw error;
  }
} });
const { contentEditorSections } = await import('../lib/content-editor-sections.ts');
const { visibleEditorFields, groupEditorFields, defaultEditorMode, directSaveMode } = await import('../lib/cms-field-guide.ts');
const { publishSectionChanges } = await import('../lib/cms-publish-workflow.ts');
const { copyKey } = await import('../lib/copy-registry.ts');
hook.deregister();

test('profile editor hides removed captions and duplicate labels without deleting historical fields', () => {
  const section = contentEditorSections().find(section => section.id === 'profil');
  const all = section.fields.map(field => field.key);
  const shown = visibleEditorFields(section).map(field => field.key);
  for (const key of ['profil.kicker', 'profil.b_cap', 'profil.i_cap', copyKey('As observed by Iga'), copyKey('As observed by Bagas')]) {
    assert.ok(all.includes(key), 'Retain the stored revision contract');
    assert.ok(!shown.includes(key), `Unused control must be hidden: ${key}`);
  }
  for (const key of ['profil.head', 'profil.nama1', 'profil.i_nama', 'profil.b_family', 'profil.i_family', 'profil.b_known', 'profil.i_known', 'profil.quote1', 'profil.quote2']) assert.ok(shown.includes(key));
});

test('arrival and closing editors hide wording already removed from the invitation', () => {
  const fields = contentEditorSections().flatMap(section => visibleEditorFields(section)).map(field => field.key);
  for (const key of ['guest.dress', 'guest.guide', 'guest.help', 'guest.contactPending', 'useful.head', 'useful.sub', 'footer.edisi']) assert.ok(!fields.includes(key), key);
  for (const key of ['guest.arrival', 'guest.faq', 'guest.contact', 'guest.access', 'guest.transport', 'keepsake.hashtag']) assert.ok(fields.includes(key), key);
});

test('profile forms follow the two public profiles, with labels in an optional group', () => {
  const section = contentEditorSections().find(section => section.id === 'profil');
  const groups = groupEditorFields(section);
  assert.deepEqual(groups.filter(group => !group.advanced).map(group => group.title), ['Judul section', 'Bagas', 'Iga']);
  assert.deepEqual(groups.find(group => group.title === 'Bagas').fields.map(field => field.key), ['profil.nama1', 'profil.b_family', 'profil.b_known', 'profil.quote1']);
  assert.deepEqual(groups.find(group => group.title === 'Iga').fields.map(field => field.key), ['profil.i_nama', 'profil.i_family', 'profil.i_known', 'profil.quote2']);
  assert.equal(groups.find(group => group.advanced).fields.length, 5);
  assert.equal(new Set(groups.flatMap(group => group.fields.map(field => field.key))).size, visibleEditorFields(section).length);
  const searched = groupEditorFields(section, 'My special sentence', { 'id.profil.quote2': 'My special sentence' });
  assert.deepEqual(searched.flatMap(group => group.fields.map(field => field.key)), ['profil.quote2']);
});

test('structured sections open their relevant forms and jukebox copy does not inherit direct-save rules', () => {
  for (const [section, mode] of Object.entries({details:'event', story:'story', archive:'photos', gift:'gifts', jukebox:'jukebox', seo:'event', profil:'copy'})) assert.equal(defaultEditorMode(section), mode);
  for (const mode of ['gifts', 'transfers', 'jukebox', 'entries', 'comments']) assert.equal(directSaveMode(mode), true);
  for (const mode of ['copy', 'photos', 'event', 'portraits', 'arrival']) assert.equal(directSaveMode(mode), false);
});

const snapshot = {copy:{'id.profil.head':'Published'}, config:{}, blocks:{}, media:{}};
const liveState = () => ({section:'profil', live:snapshot, liveHash:'live-hash', document:{version:'before-save',draft:null,draftBaseHash:null}});
test('one-click publication uses the version returned by saving and preserves the complete section', async () => {
  const state = liveState(), edit = {...snapshot, copy:{...snapshot.copy,'id.profil.head':'Updated'}};
  const calls = [];
  const result = await publishSectionChanges(state, edit, async (op, current, supplied) => {
    calls.push([op,current.document.version,supplied]);
    if (op==='save') return {...state,document:{version:'after-save',draft:supplied,draftBaseHash:state.liveHash}};
    assert.equal(current.document.version,'after-save');
    return {...state,live:edit,document:{version:'after-publish',draft:null}};
  });
  assert.deepEqual(calls.map(([op,version])=>[op,version]),[['save','before-save'],['publish','after-save']]);
  assert.equal(calls[0][2],edit);
  assert.equal(result.live.copy['id.profil.head'],'Updated');
  assert.equal(state.live.copy['id.profil.head'],'Published');
});

test('failed saves and stale drafts cannot be auto-published', async () => {
  const state = liveState(), edit = {...snapshot, copy:{'id.profil.head':'Updated'}};
  const calls = [];
  await assert.rejects(publishSectionChanges(state, edit, async op => {calls.push(op);throw new Error('Save conflict');}), /Save conflict/);
  assert.deepEqual(calls,['save']);
  const stale = {...state,document:{...state.document,draft:edit,draftBaseHash:'other-hash'}};
  await assert.rejects(publishSectionChanges(stale,edit,async()=>{throw new Error('Must not call');}),/Konten website berubah/);
});
