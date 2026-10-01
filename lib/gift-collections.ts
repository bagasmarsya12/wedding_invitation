export const GIFT_COLLECTIONS = [
  { key: "bagas", label: "For Bagas" },
  { key: "iga", label: "For Iga" },
  { key: "home", label: "For Our Home" },
] as const;
export type GiftCollection = typeof GIFT_COLLECTIONS[number]["key"];
export const giftCollection = (value: unknown): GiftCollection => value === "iga" || value === "home" ? value : "bagas";
