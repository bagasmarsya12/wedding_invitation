import { cache } from 'react';
import { db, sha256 } from './server';
import { loadWebsite } from './website-server';
import type { Localized } from './website-content';

export type GalleryPhoto = { id: string; caption: Localized; src: string };

/** The complete published album, independent of the homepage selection. */
export const loadGalleryPhotos = cache(async (): Promise<GalleryPhoto[]> => {
  const { blocks } = await loadWebsite();
  try {
    const media = await db().prepare("SELECT key,value FROM settings WHERE key LIKE 'media.%'").all<{key:string;value:string}>();
    const sources = new Map(media.results.map(row => [row.key, row.value]));
    const photos = await Promise.all(blocks.photos.map(async photo => {
      const source = sources.get(`media.${photo.slot}`);
      return source ? { id:photo.id, caption:photo.caption, src:`/api/admin/media/${photo.slot}?v=${await sha256(source)}${/\.gif$/i.test(source)?'&motion=1':''}` } : null;
    }));
    return photos.filter((photo):photo is GalleryPhoto => photo!==null);
  } catch { return []; }
});
