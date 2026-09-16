"use client";

import { useEffect, useMemo, useState } from "react";

type Gift = { id: string; title: string; description: string | null; category: string; imageUrl: string | null; priceLabel: string | null; status: string; reservedByYou: boolean; purchaseUrl: string | null; shippingRequired: boolean };

export function GiftCatalogue({ token, guestName }: { token: string; guestName: string }) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [category, setCategory] = useState("bagas");
  const [message, setMessage] = useState("");
  const [shipping, setShipping] = useState<string | null>(null);
  const [cashGift, setCashGift] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}/gifts`)
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Gift catalogue is unavailable.");
        return result;
      })
      .then(result => {
        if (cancelled) return;
        setGifts(result.gifts);
        setCashGift(result.cashGiftDetails ?? null);
        setShipping(result.shippingInstructions ?? null);
      })
      .catch(error => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, [token]);
  const visible = useMemo(() => gifts.filter(gift => gift.category === category), [gifts, category]);
  const act = async (giftId: string, action: string) => {
    setBusy(giftId); setMessage(""); setShipping(null);
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/gifts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ giftId, action, surprise: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gift could not be updated.");
      setGifts(result.gifts); setShipping(result.shippingInstructions ?? null);
      setMessage(action === "reserve" ? "Reserved for you." : action === "release" ? "Reservation released." : "Marked as purchased.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gift could not be updated."); }
    finally { setBusy(""); }
  };
  return (
    <>
      <div className="catalogue-tabs" role="tablist" aria-label="Gift recipient">
        {[["bagas", "For Bagas"], ["iga", "For Iga"], ["home", "For Our Home"]].map(([key, label]) => <button role="tab" aria-selected={category === key} className={category === key ? "is-active" : ""} onClick={() => setCategory(key)} key={key}>{label}</button>)}
      </div>
      <p className="product-status" role="status">{message}</p>
      {shipping && <aside className="private-note"><strong>Private delivery information</strong><p>{shipping}</p><small>Visible because {guestName} holds this reservation.</small></aside>}
      <div className="gift-grid">
        {visible.length === 0 && <div className="empty-catalogue"><span>{category}</span><p>No items have been added to this category yet.</p></div>}
        {visible.map(gift => <article className="gift-card" key={gift.id}>
          <div className="gift-image">{gift.imageUrl ? <img src={gift.imageUrl} alt="" /> : <span>Object photograph<br />to be added</span>}</div>
          <p>{gift.category} / {gift.status}</p><h2>{gift.title}</h2><p>{gift.description}</p>{gift.priceLabel && <small>{gift.priceLabel}</small>}
          <div className="gift-actions">
            {gift.status === "available" && <button disabled={busy === gift.id} onClick={() => act(gift.id, "reserve")}>Reserve quietly</button>}
            {gift.reservedByYou && gift.status === "reserved" && <><button disabled={busy === gift.id} onClick={() => act(gift.id, "release")}>Release</button><button disabled={busy === gift.id} onClick={() => act(gift.id, "purchased")}>I’ve bought it</button>{gift.purchaseUrl && <a href={gift.purchaseUrl} target="_blank" rel="noreferrer">Open purchase link</a>}</>}
            {!gift.reservedByYou && gift.status !== "available" && <span>{gift.status === "purchased" ? "Purchased" : "Reserved"}</span>}
          </div>
        </article>)}
      </div>
      {cashGift && <aside className="cash-gift"><p>Prefer something simpler?</p><h2>Cash gift</h2><pre>{cashGift}</pre><button onClick={async () => { await navigator.clipboard.writeText(cashGift); setMessage("Copied."); }}>Copy details</button></aside>}
    </>
  );
}
