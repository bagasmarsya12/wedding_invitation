/* eslint-disable @next/next/no-img-element */
import { T, useLanguage } from "./language";
import { GIFT_COLLECTIONS } from "@/lib/gift-collections";
import type { GiftCollectionPreview } from "@/lib/public-content";

/** Only collections containing actual catalogue items have a public shelf. */
export function GiftShelf({ href, collections }: { href: string | null; collections: GiftCollectionPreview[] }) {
  const { t } = useLanguage();
  return <><div className="v2-gift-shelf gift-collection-shelf" aria-label={t("Gift collections")}>
    {GIFT_COLLECTIONS.filter(({ key }) => collections.some(c => c.category === key)).map(({ key, label }) => {
      const collection = collections.find(c => c.category === key)!;
      const contents = <>
        <div className={`gift-niche gift-niche-${key}`} aria-hidden="true">
          <span className="gift-niche-shadow" /><span className="gift-niche-light" />
          <span className="gift-niche-plinth" />{collection.image && <img src={collection.image} alt={collection.title} loading="lazy" />}
        </div>
        <div className="gift-collection-caption"><h3><T>{label}</T></h3><p>{collection.count} <T>{collection.count === 1 ? "item" : "items"}</T></p>
          {href && <span className="gift-collection-action"><T>Explore this collection</T><span aria-hidden="true">↗</span></span>}
        </div>
      </>;
      return <article key={key} className={`gift-collection gift-collection-${key}`}>
        {href ? <a href={`${href}?collection=${key}`} className="gift-collection-link" aria-label={`${t("Explore this collection")}: ${t(label)}`}>{contents}</a>
          : <div className="gift-collection-link is-closed">{contents}</div>}
      </article>;
    })}
  </div></>;
}
