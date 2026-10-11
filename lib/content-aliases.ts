import {CONTENT_DEFAULTS, CONTENT_SECTIONS} from './content-defaults';
import {ACTIVE_CONTENT_KEYS} from './content-usage';
import {copyKey} from './copy-registry';

const active=new Set<string>(ACTIVE_CONTENT_KEYS);
/** Old semantic keys and later literal keys can address the same authored sentence. */
export const CONTENT_ALIASES=CONTENT_SECTIONS.filter(section=>section.id!=='copy').flatMap(section=>section.fields.flatMap(field=>{
  const key=`${section.id}.${field.key}`,alias=copyKey(field.value);
  return active.has(key)&&alias in CONTENT_DEFAULTS?[{key,alias}]:[];
}));
export function resolveContentAliases(values:Record<string,string>,stored:Record<string,string>) {
  for(const {key,alias} of CONTENT_ALIASES)for(const prefix of ['', 'id.'])if(!(prefix+key in stored)&&prefix+alias in stored)values[prefix+key]=stored[prefix+alias];
  return values;
}
/** A save replaces the old alias in the same language; resetting restores both defaults. */
export function replacedContentAliases(keys:string[]) {
  return [...new Set(keys.flatMap(key=>{const prefix=key.startsWith('id.')?'id.':'',base=key.slice(prefix.length);return CONTENT_ALIASES.flatMap(pair=>pair.key===base?[prefix+pair.alias]:pair.alias===base?[prefix+pair.key]:[]);} ))].filter(key=>!keys.includes(key));
}
