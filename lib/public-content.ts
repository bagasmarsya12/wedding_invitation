/** Public pages show confirmed content; drafts stay available in configuration. */
// Template profiles and photographs are approved for this invitation.
export const PROFILE_ENABLED = true;
export const PHOTO_SLOTS = ["gallery-01", "gallery-02", "gallery-03", "gallery-04", "gallery-05", "gallery-06"] as const;
export type LandingPhotos = { bagas: string | null; iga: string | null; gallery: (string | null)[] };
export const EMPTY_PHOTOS: LandingPhotos = { bagas: null, iga: null, gallery: PHOTO_SLOTS.map(() => null) };

const PLACEHOLDER = /to be added|coming soon|coming later|details to follow|still choosing|story (?:is |still )?(?:coming|to come)|photograph to come|will be added|can be added here later|real sentence will live here/i;
export function hasPublicContent(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && !PLACEHOLDER.test(value!);
}

export const USEFUL_BITS = [
  { title: "Dress code", summary: "Details to follow", body: "The dress code will be added after it is confirmed.", confirmed: false },
  { title: "Address and entrance", summary: "Pandiga Cimahi", body: "Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513.", confirmed: true },
  { title: "Parking and accessibility", summary: "Details to follow", body: "Parking, entrance, and accessibility guidance will be added after venue confirmation.", confirmed: false },
  { title: "Children and plus-ones", summary: "Details to follow", body: "Guest-specific guidance will remain attached to each private invitation.", confirmed: false },
  { title: "Contact person", summary: "Details to follow", body: "A contact person will be added closer to the date.", confirmed: false },
] as const;

export const BEYOND_DESTINATIONS = [
  { href: "/archive", title: "The Archive", description: "Things we kept.", available: true },
] as const;

export const THE_MARK_PROCESS_MATERIALS: { src: string; alt: string; caption: string }[] = [];

export type HomepageArchiveItem = { type: string; title: string; note: string; image?: string; alt?: string; slug: string };
export const THE_MARK_TEASER: HomepageArchiveItem = {
  type: "The mark", title: "A B embracing a bending I.",
  note: "The identity began with an old joke about a missing rib. The B holds the curved I without turning the story into a slogan.",
  image: "/assets/bagas-iga-mark.webp", alt: "Bagas × Iga monogram", slug: "the-mark",
};
export type GiftCollectionPreview = { category: "bagas" | "iga" | "home"; count: number; image: string | null; title: string };
