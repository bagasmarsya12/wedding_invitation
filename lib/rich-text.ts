// The stored value is still a string, so existing revisions need no migration.
// A small, closed document schema keeps font/color/HTML out of public content.
export const RICH_TEXT_PREFIX = '::wedding-prose:v1::';
export type ParagraphSpace = 'tight' | 'normal' | 'airy';
export type ProseInline = {type:'hardBreak'} | {type:'text';text:string;marks?:{type:'bold'|'italic'}[]};
export type ProseParagraph = {type:'paragraph';attrs?:{spaceAfter:ParagraphSpace};content?:ProseInline[]};
export type ProseDocument = {type:'doc';content:ProseParagraph[]};
const proseFields = new Set([
  'hero.hero sub', 'details.sub', 'details.akad', 'details.resepsi',
  'profil.b_family', 'profil.i_family', 'profil.b_known', 'profil.i_known', 'profil.quote1', 'profil.quote2',
  'archive.desc', 'mark.desc', 'gift.desc',
]);
export const isRichTextField = (key:string) => proseFields.has(key.replace(/^id\./,''));
const record = (value:unknown):value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value));
const only = (value:Record<string,unknown>, keys:string[]) => Object.keys(value).every(key=>keys.includes(key));
export function parseProseDocument(input:unknown):ProseDocument|null {
  if (!record(input)||input.type!=='doc'||!only(input,['type','content'])||!Array.isArray(input.content)||!input.content.length||input.content.length>2001) return null;
  const content:ProseParagraph[]=[]; let nodes=0;
  for (const paragraph of input.content) {
    if (!record(paragraph)||paragraph.type!=='paragraph'||!only(paragraph,['type','attrs','content'])) return null;
    let attrs:ProseParagraph['attrs'];
    if (paragraph.attrs!==undefined) {
      if (!record(paragraph.attrs)||!only(paragraph.attrs,['spaceAfter'])) return null;
      const space=paragraph.attrs.spaceAfter;
      if (space!=null && (typeof space!=='string'||!['tight','normal','airy'].includes(space))) return null;
      if (space!=null) attrs={spaceAfter:space as ParagraphSpace};
    }
    if (paragraph.content!==undefined&&!Array.isArray(paragraph.content)) return null;
    const inline:ProseInline[]=[];
    for (const node of (paragraph.content??[]) as unknown[]) {
      if (++nodes>6000||!record(node)) return null;
      if (node.type==='hardBreak'&&only(node,['type'])) { inline.push({type:'hardBreak'}); continue; }
      if (node.type!=='text'||!only(node,['type','text','marks'])||typeof node.text!=='string'||!node.text.length) return null;
      if (node.marks!==undefined&&(!Array.isArray(node.marks)||node.marks.length>2)) return null;
      const marks:{type:'bold'|'italic'}[]=[];
      for (const mark of (node.marks??[]) as unknown[]) {
        if (!record(mark)||!only(mark,['type'])||typeof mark.type!=='string'||!['bold','italic'].includes(mark.type)||marks.some(m=>m.type===mark.type)) return null;
        marks.push({type:mark.type as 'bold'|'italic'});
      }
      inline.push({type:'text',text:node.text,...(marks.length?{marks}: {})});
    }
    content.push({type:'paragraph',...(attrs?{attrs}:{}),...(inline.length?{content:inline}:{})});
  }
  return {type:'doc',content};
}
function decode(value:string):ProseDocument|null {
  if (!value.startsWith(RICH_TEXT_PREFIX)||value.length>200_000) return null;
  try { return parseProseDocument(JSON.parse(value.slice(RICH_TEXT_PREFIX.length))); } catch { return null; }
}
export function richTextDocument(value:string):ProseDocument {
  const stored=decode(value); if (stored) return stored;
  return {type:'doc',content:value.replace(/\r\n?/g,'\n').split('\n\n').map(paragraph=>{
    const content:ProseInline[]=[];
    paragraph.split('\n').forEach((line,index)=>{if(index)content.push({type:'hardBreak'});if(line)content.push({type:'text',text:line});});
    return {type:'paragraph',...(content.length?{content}: {})};
  })};
}
export function prosePlain(document:ProseDocument):string {
  return document.content.map(p=>(p.content??[]).map(n=>n.type==='text'?n.text:'\n').join('')).join('\n\n');
}
export function richTextPlain(value:string):string { const doc=decode(value);return doc?prosePlain(doc):value; }
export function serializeRichText(input:unknown):string {
  const document=parseProseDocument(input);
  if (!document) throw new Error('Format teks tidak didukung.');
  return prosePlain(document).trim() ? RICH_TEXT_PREFIX+JSON.stringify(document) : '';
}
export function validRichText(value:unknown,max:number):value is string {
  if (typeof value!=='string') return false;
  if (!value.startsWith(RICH_TEXT_PREFIX)) return value.length<=max;
  const doc=decode(value);
  return Boolean(doc && value.length<=Math.min(200_000,max*80+1024) && prosePlain(doc).length<=max);
}
export const validPlainText=(value:unknown,max:number):value is string => typeof value==='string'&&!value.startsWith(RICH_TEXT_PREFIX)&&value.length<=max;
