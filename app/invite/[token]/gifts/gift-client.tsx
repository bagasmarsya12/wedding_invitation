"use client";
/* eslint-disable @next/next/no-img-element */
import { T, useLanguage } from "../../../language";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { GIFT_COLLECTIONS, type GiftCollection } from "@/lib/gift-collections";

type Gift = { id: string; title: string; description: string | null; category: string; imageUrl: string | null; priceLabel: string | null; status: string; reservedByYou: boolean; reservedByName: string | null; purchaseUrl: string | null; shippingRequired: boolean };
type Result = { error?: string; gifts?: Gift[]; guestName?: string; cashGiftDetails?: string | null; shippingInstructions?: string | null; enabled?: boolean };
type Action = "reserve" | "release" | "purchased";
const CATEGORY_LABELS: Record<string, string> = { bagas: "For Bagas", iga: "For Iga", home: "For Our Home" };
function GiftObject({ gift }: { gift: Gift }) {
  const [failed, setFailed] = useState(false);
  return <div className={`gift-image gift-display-${gift.category}`}><span className="gift-display-light" aria-hidden="true" />
    {gift.imageUrl && !failed ? <img src={gift.imageUrl} alt={gift.title} loading="lazy" decoding="async" onError={() => setFailed(true)} onLoad={event => { const image = event.currentTarget; image.style.setProperty("--gift-native-width", `${image.naturalWidth / Math.max(1, devicePixelRatio || 1)}px`); }} /> : <span className="gift-photo-placeholder"><T>{failed ? "Image unavailable." : "Object photograph"}</T>{!failed && <><br /><T>to be added</T></>}</span>}
    <span className="gift-display-plinth" aria-hidden="true" /></div>;
}

export function GiftCatalogue({ token, guestName, initialCategory = "bagas" }: { token: string; guestName: string; initialCategory?: GiftCollection }) {
  const { t } = useLanguage();
  const [gifts, setGifts] = useState<Gift[]>([]), [identity, setIdentity] = useState(guestName);
  const [category, setCategory] = useState<GiftCollection>(initialCategory), [message, setMessage] = useState("");
  const [shipping, setShipping] = useState<string | null>(null), [cashGift, setCashGift] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [enabled, setEnabled] = useState(true), [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0), [selectedId, setSelectedId] = useState<string | null>(null), [mode, setMode] = useState<Action>("reserve");
  const pending = useRef(false), readEpoch = useRef(0), dialog = useRef<HTMLDialogElement>(null);
  const selected = gifts.find(gift => gift.id === selectedId);
  useEffect(() => {
    let cancelled = false, controller: AbortController | null = null;
    async function refresh() {
      if (pending.current || document.hidden) return;
      controller?.abort(); controller = new AbortController();
      const epoch = ++readEpoch.current;
      try {
        const response = await fetch(`/api/invite/${encodeURIComponent(token)}/gifts`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as Result;
        if (!response.ok || !data.gifts) throw new Error(data.error || "Gift catalogue is unavailable.");
        if (cancelled || epoch !== readEpoch.current || pending.current) return;
        setGifts(data.gifts); setIdentity(data.guestName || guestName); setCashGift(data.cashGiftDetails ?? null); setShipping(data.shippingInstructions ?? null); setEnabled(data.enabled !== false); setLoad("ready");
      } catch (error) {
        if (cancelled || epoch !== readEpoch.current || (error instanceof Error && error.name === "AbortError")) return;
        setMessage(error instanceof Error ? error.message : "Gift catalogue is unavailable.");
        setLoad(current => current === "loading" ? "error" : current);
      }
    }
    void refresh(); const interval = setInterval(() => { void refresh(); }, 20_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; controller?.abort(); clearInterval(interval); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [token, guestName, revision]);
  useEffect(() => {
    if (!selectedId) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, [selectedId]);
  const visible = gifts.filter(gift => gift.category === category);
  function reload() { setLoad("loading"); setMessage(""); setRevision(value => value + 1); }
  function browse(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const key = event.key;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(key)) return;
    const next = key === "Home" ? 0 : key === "End" ? GIFT_COLLECTIONS.length - 1 : (index + (key === "ArrowRight" ? 1 : GIFT_COLLECTIONS.length - 1)) % GIFT_COLLECTIONS.length;
    event.preventDefault(); setCategory(GIFT_COLLECTIONS[next].key); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  }
  function openAction(gift: Gift, action: Action) { setMessage(""); setMode(action); setSelectedId(gift.id); }
  const allowed = Boolean(selected && enabled && (mode === "reserve" ? selected.status === "available" : selected.reservedByYou && selected.status === "reserved"));
  async function act() {
    if (!selected || !allowed || pending.current || load !== "ready") return;
    pending.current = true; readEpoch.current++; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/gifts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ giftId: selected.id, action: mode }) });
      const data = await response.json() as Result;
      if (data.gifts) setGifts(data.gifts);
      if (!response.ok) { if (response.status === 403) setEnabled(false); throw new Error(data.error || "Gift could not be updated."); }
      setIdentity(data.guestName || identity); setShipping(data.shippingInstructions ?? null);
      setMessage(mode === "reserve" ? "Gift booked for you." : mode === "release" ? "Booking cancelled. The gift is available again." : "Marked as purchased.");
      setSelectedId(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gift could not be updated."); }
    finally { pending.current = false; setBusy(false); }
  }
  const bookedName = (gift: Gift) => gift.reservedByYou ? t("you") : gift.reservedByName || t("another guest");
  return <>
    <div className="catalogue-tabs" role="tablist" aria-label={t("Gift collections")}>{GIFT_COLLECTIONS.map(({ key, label }, index) => <button type="button" role="tab" id={`gift-tab-${key}`} aria-controls="gift-collection-panel" aria-selected={category === key} tabIndex={category === key ? 0 : -1} className={category === key ? "is-active" : ""} onKeyDown={event => browse(event, index)} onClick={() => setCategory(key)} key={key}>{t(label)}</button>)}</div>
    <p className="product-status" role="status">{t(message || (!enabled ? "Gift reservations are currently closed." : ""))}</p>
    {shipping && <aside className="private-note"><strong><T>Private delivery information</T></strong><p>{shipping}</p><small><T>Visible because </T>{identity}<T> holds this reservation.</T></small></aside>}
    <div id="gift-collection-panel" role="tabpanel" aria-labelledby={`gift-tab-${category}`} aria-busy={load === "loading" || busy} tabIndex={0}>
      {load === "loading" && <div className="gift-loading"><p role="status"><T>Opening the collection…</T></p><div aria-hidden="true"><span /><span /><span /></div></div>}
      {load === "error" && <div className="gift-load-error"><button type="button" className="paper-button" onClick={reload}><T>Try again</T></button></div>}
      {load === "ready" && <div className="gift-grid">{visible.length === 0 && <div className={`empty-catalogue gift-empty-${category}`}><span>{t(CATEGORY_LABELS[category])}</span><h2><T>A little space, for now.</T></h2><p><T>No items have been added to this category yet.</T></p><div className="gift-empty-niche" aria-hidden="true" /></div>}
        {visible.map(gift => <article className={`gift-card gift-card-${gift.category} ${gift.status !== "available" && !gift.reservedByYou ? "is-booked" : ""}`} key={gift.id}>
          <GiftObject key={gift.imageUrl || gift.id} gift={gift} /><div className="gift-card-caption"><p className={`gift-availability is-${gift.status}`}><span aria-hidden="true" />{gift.status === "available" ? t("available") : <span className="gift-reserved-name">{t(gift.status === "purchased" ? "Purchased by" : "Booked by")} {bookedName(gift)}</span>}</p><h2>{gift.title}</h2><p>{gift.description}</p>{gift.priceLabel && <small>{gift.priceLabel}</small>}
          <div className="gift-actions">{gift.status === "available" && <button type="button" disabled={!enabled || busy} onClick={() => openAction(gift, "reserve")}><T>Book this gift</T></button>}
            {gift.reservedByYou && gift.status === "reserved" && <><button type="button" disabled={!enabled || busy} onClick={() => openAction(gift, "release")}><T>Cancel booking</T></button><button type="button" disabled={!enabled || busy} onClick={() => openAction(gift, "purchased")}><T>I’ve bought it</T></button></>}
            {gift.reservedByYou && gift.purchaseUrl && <a href={gift.purchaseUrl} target="_blank" rel="noreferrer"><T>Open purchase link</T></a>}
            {!gift.reservedByYou && gift.status !== "available" && <button type="button" disabled aria-label={`${t("Booked by")} ${gift.reservedByName || t("another guest")}`}><T>Already booked</T></button>}
          </div></div></article>)}
      </div>}
      {load === "ready" && <button type="button" className="gift-refresh" disabled={busy} onClick={reload}><T>Refresh the collection</T></button>}
    </div>
    {cashGift && <aside className="cash-gift"><p><T>Prefer something simpler?</T></p><h2><T>Cash gift</T></h2><pre>{cashGift}</pre><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(cashGift); setMessage("Copied."); } catch { setMessage("Copy unavailable. Select the details above to copy them."); } }}><T>Copy details</T></button></aside>}
    <dialog ref={dialog} className="gift-booking-sheet" aria-labelledby="gift-booking-title" onCancel={event => { if (busy) event.preventDefault(); else setSelectedId(null); }} onClose={() => setSelectedId(null)}>
      <header><h2 id="gift-booking-title"><T>{mode === "reserve" ? "Book this gift" : mode === "release" ? "Cancel booking" : "I’ve bought it"}</T></h2><button type="button" disabled={busy} autoFocus aria-label={t("Close booking")} onClick={() => setSelectedId(null)}>×</button></header>
      {selected && <><p>{selected.title}</p><div className="booking-identity"><T>Booked under</T><strong dir="auto">{identity}</strong></div>
        <p><T>{mode === "reserve" ? "Your name will be visible to other invited guests beside this gift." : mode === "release" ? "Cancelling makes this gift available to another guest." : "This records your purchase and keeps the gift unavailable to other guests."}</T></p>
        {!allowed && selected.status !== "available" && <p><T>Booked by</T> {selected.reservedByName || t("another guest")}</p>}
        {message && <p role="status">{t(message)}</p>}
        <button className="booking-confirm" type="button" disabled={!allowed || busy} onClick={act}><T>{busy ? "Saving your choice…" : mode === "reserve" ? "Confirm booking" : mode === "release" ? "Confirm cancellation" : "Confirm purchase"}</T></button>
      </>}
    </dialog>
  </>;
}
