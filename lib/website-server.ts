import { normalizeCoupleWording } from './couple-wording';
import { cache } from 'react';
import { db } from './server';
import { loadLandingContent } from './landing-content';
import { defaultWebsiteBlocks, WEBSITE_DEFAULTS, validateWebsiteBlocks, validateWebsiteConfig } from './website-content';
import { ARRIVAL_DEFAULTS, validateArrivalContent } from './arrival-content';

export const loadWebsite = cache(async () => {
  const content=await loadLandingContent();
  let config={...WEBSITE_DEFAULTS}, blocks=defaultWebsiteBlocks(content.values);
  let arrival = ARRIVAL_DEFAULTS;
  try {
    const rows=await db().prepare("SELECT key,value FROM settings WHERE key IN ('cms.website','cms.blocks','cms.arrival')").all<{key:string;value:string}>();
    for(const row of rows.results) {
      try {
        if(row.key==='cms.website') config=validateWebsiteConfig(JSON.parse(row.value)) ?? config;
        if(row.key==='cms.blocks') blocks=validateWebsiteBlocks(JSON.parse(row.value)) ?? blocks;
        if(row.key==='cms.arrival') arrival=validateArrivalContent(JSON.parse(row.value)) ?? arrival;
      } catch {/* invalid legacy setting falls back to authored content */}
    }
  } catch {/* keep the invitation available when storage is unavailable */}
  // Normalize prose from older CMS entries without changing stored data or profile identity.
  const prose = <T,>(value: T): T => {
    if (typeof value === 'string') return normalizeCoupleWording(value) as T;
    if (Array.isArray(value)) return value.map(prose) as T;
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,prose(item)])) as T;
    return value;
  };
  return {config:{...config,metaTitle:normalizeCoupleWording(config.metaTitle),metaDescription:normalizeCoupleWording(config.metaDescription)},blocks:prose(blocks),arrival:prose(arrival)};
});
