"use client";
import { T, useLanguage } from "../../../language";


import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { GIFT_COLLECTIONS, type GiftCollection } from "@/lib/gift-collections";

type Gift = { id: string; title: string; description: string | null; category: string; imageUrl: string | null; priceLabel: string | null; status: string; reservedByYou: boolean; purchaseUrl: string | null; shippingRequired: boolean };

// Category keys are storage identifiers; the interface shows translated labels.
const CATEGORY_LABELS: Record<string, string> = { bagas: "For Bagas", iga: "For Iga", home: "For Our Home" };
const categoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;

function GiftObject({ gift }: { gift: Gift }) {
  const [failed, setFailed] = useState(false);
  return <div className={`gift-image gift-display-${gift.category}`}>
    <span className="gift-display-light" aria-hidden="true" />
    {gift.imageUrl && !failed
      ? <img src={gift.imageUrl} alt={gift.title} loading="lazy" decoding="async" onError={() => setFailed(true)} onLoad={event => {
        const image = event.currentTarget;
        image.style.setProperty("--gift-native-width", `${image.naturalWidth / Math.max(1, devicePixelRatio || 1)}px`);
      }} />
      : <span className="gift-photo-placeholder"><T>{failed ? "Image unavailable." : "Object photograph"}</T>{!failed && <><br /><T>to be added</T></>}</span>}
    <span className="gift-display-plinth" aria-hidden="true" />
  </div>;
}

export function GiftCatalogue({ token, guestName, initialCategory = "bagas" }: { token: string; guestName: string; initialCategory?: GiftCollection }) {
  const { t } = useLanguage();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [category, setCategory] = useState<GiftCollection>(initialCategory);
  const [message, setMessage] = useState("");
  const [shipping, setShipping] = useState<string | null>(null);
  const [cashGift, setCashGift] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}/gifts`)
      .then(async response => {
        const result = await response.json() as { error?: string; gifts: Gift[]; cashGiftDetails: string | null; shippingInstructions: string | null; enabled: boolean };
        if (!response.ok) throw new Error(result.error || "Gift catalogue is unavailable.");
        return result;
      })
      .then(result => {
        if (cancelled) return;
        setGifts(result.gifts);
        setCashGift(result.cashGiftDetails ?? null);
        setShipping(result.shippingInstructions ?? null);
        setEnabled(result.enabled !== false); setLoad("ready");
      })
      .catch(error => { if (!cancelled) { setMessage(error.message); setLoad("error"); } });
    return () => { cancelled = true; };
  }, [token, revision]);
  const visible = gifts.filter(gift => gift.category === category);
  function reload() { setLoad("loading"); setMessage(""); setRevision(value => value + 1); }
  function browse(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % GIFT_COLLECTIONS.length;
    else if (event.key === "ArrowLeft") next = (index + GIFT_COLLECTIONS.length - 1) % GIFT_COLLECTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = GIFT_COLLECTIONS.length - 1;
    else return;
    event.preventDefault(); setCategory(GIFT_COLLECTIONS[next].key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  }
  const act = async (giftId: string, action: string) => {
    if (pending.current || load !== "ready") return;
    if (!enabled) { setMessage("Gift reservations are currently closed."); return; }
    pending.current = true; setBusy(giftId); setMessage("");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/gifts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ giftId, action, surprise: true }) });
      const result = await response.json() as { error?: string; gifts: Gift[]; shippingInstructions: string | null };
      if (!response.ok) throw new Error(result.error || "Gift could not be updated.");
      setGifts(result.gifts); setShipping(result.shippingInstructions ?? null);
      setMessage(action === "reserve" ? "Reserved for you." : action === "release" ? "Reservation released." : "Marked as purchased.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gift could not be updated."); }
    finally { pending.current = false; setBusy(""); }
  };
  return (
    <>
      <div className="catalogue-tabs" role="tablist" aria-label={t("Gift collections")}>
        {GIFT_COLLECTIONS.map(({ key, label }, index) => <button type="button" role="tab" id={`gift-tab-${key}`} aria-controls="gift-collection-panel" aria-selected={category === key} tabIndex={category === key ? 0 : -1} className={category === key ? "is-active" : ""} onKeyDown={event => browse(event, index)} onClick={() => setCategory(key)} key={key}>{t(label)}</button>)}
      </div>
      <p className="product-status" role="status">{t(message || (!enabled ? "Gift reservations are currently closed." : ""))}</p>
      {busy && <p className="gift-saving" role="status"><T>Saving your choice…</T></p>}
      {shipping && <aside className="private-note"><strong><T>Private delivery information</T></strong><p>{shipping}</p><small><T>Visible because </T>{guestName}<T> holds this reservation.</T></small></aside>}
      <div id="gift-collection-panel" role="tabpanel" aria-labelledby={`gift-tab-${category}`} aria-busy={load === "loading" || Boolean(busy)} tabIndex={0}>
      {load === "loading" && <div className="gift-loading"><p role="status"><T>Opening the collection…</T></p><div aria-hidden="true"><span /><span /><span /></div></div>}
      {load === "error" && <div className="gift-load-error"><button type="button" className="paper-button" onClick={reload}><T>Try again</T></button></div>}
      {load === "ready" && <div className="gift-grid">
        {visible.length === 0 && <div className={`empty-catalogue gift-empty-${category}`}><span>{t(categoryLabel(category))}</span><h2><T>A little space, for now.</T></h2><p><T>No items have been added to this category yet.</T></p><div className="gift-empty-niche" aria-hidden="true" /></div>}
        {visible.map(gift => <article className={`gift-card gift-card-${gift.category}`} key={gift.id}>
          <GiftObject gift={gift} />
          <div className="gift-card-caption"><p className={`gift-availability is-${gift.status}`}><span aria-hidden="true" />{t(gift.reservedByYou ? gift.status === "purchased" ? "Purchased by you" : "Held for you" : gift.status)}</p><h2>{gift.title}</h2><p>{gift.description}</p>{gift.priceLabel && <small>{gift.priceLabel}</small>}
          <div className="gift-actions">
            {gift.status === "available" && <button disabled={!enabled || Boolean(busy)} onClick={() => act(gift.id, "reserve")}><T>Reserve quietly</T></button>}
            {gift.reservedByYou && gift.status === "reserved" && <><button disabled={!enabled || Boolean(busy)} onClick={() => act(gift.id, "release")}><T>Release</T></button><button disabled={!enabled || Boolean(busy)} onClick={() => act(gift.id, "purchased")}><T>I’ve bought it</T></button>{gift.purchaseUrl && <a href={gift.purchaseUrl} target="_blank" rel="noreferrer"><T>Open purchase link</T></a>}</>}
            {!gift.reservedByYou && gift.status !== "available" && <span>{t(gift.status === "purchased" ? "Purchased" : "Reserved")}</span>}
          </div>
          </div>
        </article>)}
        </div>}
      {message && load === "ready" && !busy && <button type="button" className="gift-refresh" onClick={reload}><T>Refresh the collection</T></button>}
      </div>
      {cashGift && <aside className="cash-gift"><p><T>Prefer something simpler?</T></p><h2><T>Cash gift</T></h2><pre>{cashGift}</pre><button onClick={async () => {
        try { await navigator.clipboard.writeText(cashGift); setMessage("Copied."); }
        catch { setMessage("Copy unavailable. Select the details above to copy them."); }
      }}><T>Copy details</T></button></aside>}
    </>
  );
}
