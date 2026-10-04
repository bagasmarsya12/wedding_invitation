import { cache } from 'react';
import { db } from './server';
import { loadLandingContent } from './landing-content';
import { defaultWebsiteBlocks, WEBSITE_DEFAULTS, validateWebsiteBlocks, validateWebsiteConfig } from './website-content';

export const loadWebsite = cache(async () => {
  const content=await loadLandingContent();
  let config={...WEBSITE_DEFAULTS}, blocks=defaultWebsiteBlocks(content.values);
  try {
    const rows=await db().prepare("SELECT key,value FROM settings WHERE key IN ('cms.website','cms.blocks')").all<{key:string;value:string}>();
    for(const row of rows.results) {
      try {
        if(row.key==='cms.website') config=validateWebsiteConfig(JSON.parse(row.value)) ?? config;
        if(row.key==='cms.blocks') blocks=validateWebsiteBlocks(JSON.parse(row.value)) ?? blocks;
      } catch {/* invalid legacy setting falls back to authored content */}
    }
  } catch {/* keep the invitation available when storage is unavailable */}
  return {config,blocks};
});
