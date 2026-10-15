import { loadWebsite } from "./website-server";
import { db, sha256 } from "./server";
import { hasPublicContent, THE_MARK_TEASER, PHOTO_SLOTS, type LandingPhotos, type HomepageArchiveItem, type GiftCollectionPreview, type HomepageGift } from "./public-content";
import { giftCollection } from "./gift-collections";

/** Public presentation only. Guest identity, reservations and RSVP stay private. */
export async function loadHomepageContent() {
  const {blocks}=await loadWebsite();
  const [archive, gifts, media] = await Promise.allSettled([
    (async () => db().prepare("SELECT slug, type, title, excerpt, story, media_url FROM archive_entries WHERE published = 1 AND visibility = 'public' AND featured = 1 ORDER BY featured_order, created_at LIMIT 5").all<{ slug: string; type: string; title: string; excerpt: string | null; story: string | null; media_url: string | null }>())(),
    (async () => db().prepare("SELECT id, recipient_category, title, description, image_url, price_label FROM gifts WHERE published = 1 ORDER BY sort_order, created_at, id").all<{ id: string; recipient_category: string; title: string; description: string | null; image_url: string | null; price_label: string | null }>())(),
    db().prepare("SELECT key, value, updated_at FROM settings WHERE key LIKE 'media.%'").all<{ key: string; value: string; updated_at: string }>(),
  ]);
  const archiveItems: HomepageArchiveItem[] = [];
  if (archive.status === "fulfilled") {
    archiveItems.push(...archive.value.results.filter(e => e.slug !== "the-mark" && hasPublicContent(e.title) && (hasPublicContent(e.story) || hasPublicContent(e.excerpt))).slice(0, 2).map(e => ({
      slug: e.slug, type: e.type, title: e.title, note: hasPublicContent(e.excerpt) ? e.excerpt : e.title,
      image: e.media_url || undefined, alt: e.title,
    })));
  }
  const giftItems: HomepageGift[] = [];
  const giftCollections: GiftCollectionPreview[] = [];
  if (gifts.status === "fulfilled") {
    for (const gift of gifts.value.results.filter(g => hasPublicContent(g.title))) {
      const category = giftCollection(gift.recipient_category);
      giftItems.push({id:gift.id,title:gift.title,description:gift.description,category,imageUrl:gift.image_url,priceLabel:gift.price_label});
      const existing = giftCollections.find(g => g.category === category);
      if (existing) existing.count++;
      else giftCollections.push({ category, count: 1, image: gift.image_url, title: gift.title });
    }
  }
  const mediaVersions = new Map<string, string>();
  if (media.status === 'fulfilled') await Promise.all(media.value.results.map(async row => { mediaVersions.set(row.key, await sha256(row.value)); }));
  const photo = (slot: string) => {
    const row = media.status === "fulfilled" ? media.value.results.find(item => item.key === `media.${slot}` && item.value) : undefined;
    return row ? `/api/admin/media/${slot}?v=${mediaVersions.get(row.key)}${/\.gif$/i.test(row.value)?'&motion=1':''}` : null;
  };
  const photos: LandingPhotos = { bagas: photo("bagas"), iga: photo("iga"), gallery: blocks.photos.map(item=>photo(item.slot)) };
  const arrivalPhotos = { map: photo('arrival-map'), parking: photo('arrival-parking'), entrance: photo('arrival-entrance') };
  return { archiveItems, giftCollections, giftItems, photos, arrivalPhotos };
}
