import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
const hook = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch(error) {
    if (specifier.startsWith('.')) { const url = new URL(`${specifier}.ts`, context.parentURL); if (existsSync(url)) return next(url.href, context); }
    throw error;
  }
} });
const { RICH_TEXT_PREFIX, richTextDocument, serializeRichText, richTextPlain, validRichText, isRichTextField } = await import('../lib/rich-text.ts');
const { validateSectionSnapshot, sectionCopyKeys } = await import('../lib/cms-editorial.ts');
const { WEBSITE_DEFAULTS, defaultWebsiteBlocks, validateWebsiteBlocks } = await import('../lib/website-content.ts');
hook.deregister();

const document = {type:'doc',content:[
  {type:'paragraph',attrs:{spaceAfter:'airy'},content:[{type:'text',text:'Sayang ',marks:[{type:'bold'}]},{type:'text',text:'yang sederhana.',marks:[{type:'italic'}]}]},
  {type:'paragraph',content:[{type:'text',text:'Tetap dekat.'},{type:'hardBreak'},{type:'text',text:'Selalu.'}]},
]};
test('legacy paragraph breaks, line breaks and spaces survive editor and public round trips',()=>{
  const plain = 'Baris pertama.\nBaris kedua.\n\n  Paragraf berikut.\n\n\n\nTerakhir.';
  assert.equal(richTextPlain(serializeRichText(richTextDocument(plain))), plain);
  assert.equal(richTextPlain(plain), plain);
});
test('only bold, italic, paragraph spacing and breaks are stored',()=>{
  const value=serializeRichText(document);
  assert.ok(value.startsWith(RICH_TEXT_PREFIX));
  assert.deepEqual(richTextDocument(value),document);
  assert.equal(richTextPlain(value),'Sayang yang sederhana.\n\nTetap dekat.\nSelalu.');
  for (const node of [
    {type:'paragraph',attrs:{style:'color:red'},content:[]},
    {type:'paragraph',attrs:{spaceAfter:'99px'},content:[]},
    {type:'paragraph',attrs:{spaceAfter:['airy']},content:[]},
    {type:'paragraph',content:[{type:'image',attrs:{src:'https://example.com'}}]},
    {type:'paragraph',content:[{type:'text',text:'Bad',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},
    {type:'paragraph',content:[{type:'text',text:'Bad',marks:[{type:['bold']}]}]},
  ]) assert.equal(validRichText(RICH_TEXT_PREFIX+JSON.stringify({type:'doc',content:[node]}),2000),false);
  assert.equal(validRichText(RICH_TEXT_PREFIX+'invalid',2000),false);
  assert.equal(validRichText('<img src=x onerror=alert(1)>',2000),true,'Plain input remains escaped text, never HTML');
});
test('formatting overhead does not consume the visible text limit, empty editor uses fallback',()=>{
  const value=serializeRichText({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'a'.repeat(2000),marks:[{type:'bold'}]}]}]});
  assert.equal(validRichText(value,2000),true);
  assert.equal(validRichText(value,1999),false);
  assert.equal(serializeRichText({type:'doc',content:[{type:'paragraph'}]}),'');
  assert.equal(isRichTextField('id.profil.i_known'),true);
  for (const key of ['profil.i_nama','profil.i_known_label','keepsake.note1','guest.party']) assert.equal(isRichTextField(key),false,key);
});
test('editor snapshots and FAQ bodies preserve formatting but titles stay plain',()=>{
  const formatted=serializeRichText(document), blocks=defaultWebsiteBlocks();
  const snapshot={copy:Object.fromEntries(sectionCopyKeys('profil').map(key=>[key,''])),config:{},blocks:{},media:{}};
  snapshot.copy['id.profil.i_known']=formatted;
  assert.equal(validateSectionSnapshot('profil',snapshot,{config:WEBSITE_DEFAULTS,blocks}).copy['id.profil.i_known'],formatted);
  snapshot.copy['id.profil.i_known']=RICH_TEXT_PREFIX+'invalid';
  assert.equal(validateSectionSnapshot('profil',snapshot,{config:WEBSITE_DEFAULTS,blocks}),null);
  blocks.faq[0].body.id=formatted;
  assert.equal(validateWebsiteBlocks(blocks).faq[0].body.id,formatted);
  blocks.faq[0].title.id=formatted;
  assert.equal(validateWebsiteBlocks(blocks),null);
});
test('older keepsake revisions can still be restored after the CTA hint is introduced',()=>{
  const copy=Object.fromEntries(sectionCopyKeys('keepsake').filter(key=>!key.endsWith('keepsake.openHint')).map(key=>[key,'']));
  const restored=validateSectionSnapshot('keepsake',{copy,config:{},blocks:{},media:{}},{config:WEBSITE_DEFAULTS,blocks:defaultWebsiteBlocks()});
  assert.ok(restored);
  assert.equal(restored.copy['id.keepsake.openHint'],'');
});
