import Link from "next/link";
import { T, useLanguage } from "./language";
import { GIFT_COLLECTIONS } from "@/lib/gift-collections";

/** Empty architectural displays, not invented wishlist objects. */
export function GiftShelf({ href }: { href: string | null }) {
  const { t } = useLanguage();
  return <><div className="v2-gift-shelf gift-collection-shelf" aria-label={t("Gift collections")}>
    {GIFT_COLLECTIONS.map(({ key, label }) => {
      const contents = <>
        <div className={`gift-niche gift-niche-${key}`} aria-hidden="true">
          <span className="gift-niche-shadow" /><span className="gift-niche-light" />
          <span className="gift-niche-plinth" /><span className="gift-niche-ticket"><T>Still choosing.</T></span>
        </div>
        <div className="gift-collection-caption"><h3><T>{label}</T></h3><p><T>Curated objects will be added here.</T></p>
          {href && <span className="gift-collection-action"><T>Explore this collection</T><span aria-hidden="true">↗</span></span>}
        </div>
      </>;
      return <article key={key} className={`gift-collection gift-collection-${key}`}>
        {href ? <Link href={`${href}?collection=${key}`} className="gift-collection-link" aria-label={`${t("Explore this collection")}: ${t(label)}`}>{contents}</Link>
          : <div className="gift-collection-link is-closed">{contents}</div>}
      </article>;
    })}
  </div><p className="gift-shelf-hint"><T>Scroll sideways to explore all three collections.</T></p></>;
}
