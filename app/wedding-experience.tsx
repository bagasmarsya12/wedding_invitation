"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, Sun, Sunset } from "lucide-react";
import {
  createContext,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { GardenBackground } from "./garden-background";
import { ReplyStudio } from "./reply-studio";
import { InvitationClosing } from "./invitation-closing";
import { GiftShelf } from "./gift-shelf";
import { ArchiveTable, type ArchiveItem } from "./archive-table";
import { defaultStyleForEdition } from "@/lib/mark-styles";
import { T, LanguageSwitch, useLanguage } from "./language";

type Props = { guestName?: string; token?: string; partyLimit?: number };
type MotionPreferences = { reduced: boolean; precise: boolean };

const MotionContext = createContext<MotionPreferences>({ reduced: false, precise: false });

const EVENT_DATE_UTC = Date.UTC(2026, 10, 1);
const MAPS_URL = "https://maps.app.goo.gl/JFL3wrzj7qsBXbz56";
const VENUE_CENTER: [number, number] = [107.5554364, -6.8755807];

type SiteState = { phase?: string; rsvpEnabled?: boolean; giftsEnabled?: boolean; marksEnabled?: boolean };
const archiveItems: ArchiveItem[] = [
  {
    type: "The mark",
    title: "A B embracing a bending I.",
    note: "The identity began with an old joke about a missing rib. The B holds the curved I without turning the story into a slogan.",
    image: "/assets/bagas-iga-mark.webp",
    alt: "Monogram Bagas dan Iga",
    slug: "the-mark",
  },
  {
    type: "Photograph",
    title: "Reserved for something real.",
    note: "We’re choosing a photograph for this spot. Some things deserve a little time.",
  },
  {
    type: "Object",
    title: "Something that survived.",
    note: "A small place for an ordinary thing that means something to us. The story is coming.",
  },
];

function MotionProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<MotionPreferences>({ reduced: false, precise: false });

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const precise = matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setPreferences({ reduced: reduced.matches, precise: precise.matches });
    update();
    reduced.addEventListener("change", update);
    precise.addEventListener("change", update);
    return () => {
      reduced.removeEventListener("change", update);
      precise.removeEventListener("change", update);
    };
  }, []);

  return <MotionContext.Provider value={preferences}>{children}</MotionContext.Provider>;
}

function useExperienceClock() {
  const { language } = useLanguage();
  const [siteState, setSiteState] = useState<SiteState | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch("/api/site-state")
      .then(response => { if (!response.ok) throw new Error("Site state unavailable"); return response.json() as Promise<SiteState>; })
      .then(state => { if (state) setSiteState(state); })
      .catch(() => setSiteState({ rsvpEnabled: false, giftsEnabled: false, marksEnabled: false }));
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const localDate = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day));
    const days = Math.round((EVENT_DATE_UTC - localDate) / 86_400_000);
    const forcedToday = siteState?.phase === "wedding-day";
    const forcedPast = siteState?.phase === "post-wedding";
    const state = forcedPast || days < 0 ? "past" : forcedToday || days === 0 ? "today" : days === 1 ? "tomorrow" : "countdown";
    const countdown = state === "past"
      ? "AND JUST LIKE THAT, WE'RE MARRIED."
      : state === "today"
        ? "IS TODAY."
        : state === "tomorrow"
          ? "IS TOMORROW."
          : `IS ${Math.max(days, 0)} DAYS AWAY.`;
    const caption = language === "id"
      ? state === "past" ? "DAN SEKARANG, KAMI SUDAH MENIKAH." : state === "today" ? "HARINYA TIBA." : state === "tomorrow" ? "BESOK HARINYA." : `${Math.max(days, 0)} HARI LAGI.`
      : countdown;
    return {
      state,
      countdown: caption,
      ready: siteState !== null,
      rsvpEnabled: siteState?.rsvpEnabled === true,
      giftsEnabled: siteState?.giftsEnabled === true,
      marksEnabled: siteState?.marksEnabled === true,
    };
  }, [now, siteState, language]);
}

function hashEdition(token: string) {
  let hash = 17;
  for (const character of token || "bagas-iga") hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

function BotanicalImage({ src, className, eager = false }: { src: string; className: string; eager?: boolean }) {
  const pixels: Record<string, number> = {
    "syzygium/branch-long": 496, "syzygium/branch-short": 270,
    "nephrolepis/frond-arched-01": 657, "nephrolepis/frond-short-02": 123,
    "combretum/canopy-branch": 1005, "combretum/climber-left": 372,
    "combretum/climber-right": 252, "combretum/flower-cascade": 278,
    "combretum/flower-tip": 173, "combretum/tendril": 444,
    "combretum/flower-cluster": 323, "combretum/flower-spray": 307,
    "combretum/flower-tip-pink": 221, "combretum/leaf-sprig": 153,
    "melastoma/full-stem": 503, "melastoma/branch-short": 286,
    "dendrobium/branch-short": 251,
  };
  const key = src.replace("/assets/botanicals/", "").replace(".webp", "");
  const style = pixels[key] ? { "--botanical-pixels": pixels[key] } as CSSProperties : undefined;
  return <img className={className} style={style} src={src} alt="" aria-hidden="true" decoding="async" loading={eager ? "eager" : "lazy"} />;
}

function InvitationSpine({ open, onToggle, confirmed }: { open: boolean; onToggle: () => void; confirmed: boolean }) {
  const { t } = useLanguage();
  return (
    <header className={`v2-spine ${open ? "is-open" : ""}`}>
      <a className="v2-spine-mark" href="#the-day" aria-label={t("Return to invitation")}>B <i>×</i> I</a>
      <span className="v2-spine-date">01 · 11 · 26</span>
      {confirmed ? <span className="v2-spine-rsvp"><T>You’re on the list</T></span> : <span className="v2-spine-rsvp" aria-hidden="true" />}
      <LanguageSwitch />
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="invitation-info">
        {t(open ? "Close" : "Info")}
      </button>
      <div className="v2-info-drawer" id="invitation-info" aria-hidden={!open}>
        <div>
          <p><time>14:00</time><span>Akad</span></p>
          <p><time>18:00</time><span><T>Reception</T></span></p>
        </div>
        <p className="v2-info-place"><strong>Pandiga Cimahi</strong><span>Jl. Sirnarasa No.11, Cibabat</span></p>
        <nav aria-label={t("Practical wedding links")}>
          <a href="#details" onClick={onToggle}><T>Details</T></a>
          <a href="#profiles" onClick={onToggle}><T>People</T></a>
          <a href="#archive" onClick={onToggle}><T>Archive</T></a>
          <a href="#rsvp" onClick={onToggle}>RSVP</a>
          <a href="#gifts" onClick={onToggle}><T>Gifts</T></a>
          <a href="#leave-a-mark" onClick={onToggle}><T>Postcards</T></a>
          <a href={MAPS_URL} target="_blank" rel="noreferrer" onClick={onToggle}><T>Maps</T></a>
        </nav>
      </div>
    </header>
  );
}

function DestinationMap() {
  const { t } = useLanguage();
  const { reduced } = useContext(MotionContext);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let mapLoaded = false;

    const initialize = async () => {
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        if (cancelled) return;
        const map = new maplibregl.Map({
          container,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: VENUE_CENTER,
          zoom: 12.9,
          minZoom: 12,
          maxZoom: 19,
          attributionControl: false,
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.on("styleimagemissing", event => {
          if (!map.hasImage(event.id)) {
            map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) });
          }
        });
        const markerElement = document.createElement("div");
        markerElement.className = "v2-maplibre-marker";
        markerElement.setAttribute("aria-label", "Pandiga Cimahi");
        markerElement.innerHTML = '<span class="v2-maplibre-marker-pin"><span>B × I</span></span><span class="v2-maplibre-marker-label">Pandiga</span>';
        new maplibregl.Marker({ element: markerElement, anchor: "bottom" }).setLngLat(VENUE_CENTER).addTo(map);
        map.on("load", () => {
          if (cancelled) return;
          mapLoaded = true;
          map.getStyle().layers?.forEach(layer => {
            const id = layer.id;
            if (/^poi_|^highway-shield|^road_shield|^road_one_way|^airport$|^label_other$|^highway-name-minor$|^building-3d$/.test(id)) {
              map.setLayoutProperty(id, "visibility", "none");
              return;
            }
            if (layer.type === "background") map.setPaintProperty(id, "background-color", "#e5e1d6");
            if (layer.type === "fill") {
              if (id === "park" || /^landcover_(wood|grass)$/.test(id)) {
                map.setPaintProperty(id, "fill-color", "#b9cbaa");
                map.setPaintProperty(id, "fill-opacity", 0.7);
              } else if (id === "water") map.setPaintProperty(id, "fill-color", "#afc9c3");
              else if (id === "building") {
                map.setPaintProperty(id, "fill-color", "#ccc5b8");
                map.setPaintProperty(id, "fill-outline-color", "#d5cec1");
                map.setPaintProperty(id, "fill-opacity", 0.44);
              } else if (/^landuse_(school|cemetery|pitch|track)$/.test(id)) map.setPaintProperty(id, "fill-color", "#cdd6bd");
              else if (/^landuse_/.test(id)) map.setPaintProperty(id, "fill-color", "#dedace");
            }
            if (layer.type === "line") {
              if (/^(road|bridge|tunnel)_(motorway|trunk_primary|secondary_tertiary|link)/.test(id)) map.setPaintProperty(id, "line-color", id.endsWith("_casing") ? "#ad9f89" : "#fbf7ec");
              else if (/^(road|bridge|tunnel)_(minor|service_track|street|path_pedestrian)/.test(id)) map.setPaintProperty(id, "line-color", id.endsWith("_casing") ? "#beb7a9" : "#faf7ef");
              else if (/^waterway_/.test(id)) map.setPaintProperty(id, "line-color", "#9fbfb7");
            }
            if (layer.type === "symbol") {
              if (/^highway-name|^label_/.test(id)) {
                map.setPaintProperty(id, "text-color", /^label_(city|town|village)/.test(id) ? "#4a443b" : "#70695d");
                map.setPaintProperty(id, "text-halo-color", "#f2efe7");
              }
            }
          });
          map.resize();
          setStatus("ready");
        });
        map.on("error", () => {
          if (!mapLoaded) setStatus("error");
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer?.disconnect();
        void initialize();
      }
    }, { rootMargin: "240px" });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [reduced]);

  const zoomMap = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn({ duration: 350 });
    else map.zoomOut({ duration: 350 });
  };

  const resetMap = () => mapRef.current?.easeTo({ center: VENUE_CENTER, zoom: 12.9, bearing: 0, pitch: 0, duration: 650, essential: true });

  const handleMapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const distance = event.shiftKey ? 180 : 90;
    if (event.key === "ArrowLeft") { event.preventDefault(); map.panBy([-distance, 0], { duration: 350 }); }
    if (event.key === "ArrowRight") { event.preventDefault(); map.panBy([distance, 0], { duration: 350 }); }
    if (event.key === "ArrowUp") { event.preventDefault(); map.panBy([0, -distance], { duration: 350 }); }
    if (event.key === "ArrowDown") { event.preventDefault(); map.panBy([0, distance], { duration: 350 }); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomMap(1); }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomMap(-1); }
    if (event.key === "Home") { event.preventDefault(); resetMap(); }
  };

  return (
    <div className="v2-destination-map-shell">
      <div className="v2-destination-map-frame">
        <div
          ref={mapContainerRef}
          className="v2-maplibre-map"
          role="application"
          tabIndex={0}
          aria-label={t("Interactive map around Pandiga Cimahi. Use drag, the controls, or arrow keys to explore.")}
          aria-describedby="destination-map-help"
          onKeyDown={handleMapKeyDown}
        />
        {status === "loading" && <div className="v2-maplibre-status" role="status"><T>Loading the actual roads around Pandiga…</T></div>}
        {status === "error" && <div className="v2-maplibre-fallback"><strong>Pandiga Cimahi</strong><span><T>Live map unavailable right now.</T></span><a href={MAPS_URL} target="_blank" rel="noreferrer"><T>OPEN IN GOOGLE MAPS </T><span aria-hidden="true">→</span></a></div>}
        <div className="v2-destination-map-controls" role="group" aria-label={t("Map controls")}>
          <button type="button" onClick={() => zoomMap(.1)} aria-label={t("Zoom in")}>+</button>
          <button type="button" onClick={() => zoomMap(-.1)} aria-label={t("Zoom out")}>−</button>
          <button type="button" onClick={resetMap} aria-label={t("Reset map")}>↺</button>
        </div>
      </div>
      <p className="v2-destination-map-help" id="destination-map-help"><T>Use the controls, drag, or arrow keys to explore the actual roads around the venue. The directions link below opens Google Maps.</T></p>
      {reduced && <span className="v2-destination-map-static-note"><T>Map shown in a still state.</T></span>}
    </div>
  );
}

function WeddingWorld({ guestName = "", token = "" }: Props) {
  const { t } = useLanguage();
  const { reduced, precise } = useContext(MotionContext);
  const clock = useExperienceClock();
  const rootRef = useRef<HTMLDivElement>(null);
  const dayTitleRef = useRef<HTMLHeadingElement>(null);
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rsvpSaved, setRsvpSaved] = useState(false);
  const [featuredArchive, setFeaturedArchive] = useState<ArchiveItem[]>([]);
  const edition = useMemo(() => hashEdition(token), [token]);
  const displayName = guestName.trim();
  const hasGuestName = Boolean(displayName);

  useEffect(() => {
    document.body.classList.add("wedding-v2-body");
    const setAssetDensity = () => rootRef.current?.style.setProperty("--botanical-dpr", String(Math.max(1, window.devicePixelRatio || 1)));
    setAssetDensity();
    window.addEventListener("resize", setAssetDensity, { passive: true });
    document.body.style.overflow = entered ? "" : "hidden";
    return () => {
      document.body.classList.remove("wedding-v2-body");
      document.body.style.overflow = "";
      window.removeEventListener("resize", setAssetDensity);
    };
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    dayTitleRef.current?.focus({ preventScroll: true });
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    fetch("/api/archive?featured=1")
      .then(async response => response.ok ? await response.json() as { entries: { slug: string; type: string; title: string; excerpt: string | null; media_url: string | null }[] } : null)
      .then(result => {
        if (cancelled || !result) return;
        setFeaturedArchive(result.entries.filter(entry => entry.slug !== "the-mark").slice(0, 2).map(entry => ({
          type: entry.type, title: entry.title, note: entry.excerpt || entry.title, slug: entry.slug,
          image: entry.media_url || undefined, alt: entry.title,
        })));
      })
      .catch(() => { /* The editorial placeholders remain until real entries are available. */ });
    return () => { cancelled = true; };
  }, [entered]);

  useEffect(() => {
    if (!entered || !rootRef.current) return;
    const root = rootRef.current;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-light]"));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle("is-in-view", entry.isIntersecting);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.32) root.dataset.light = (entry.target as HTMLElement).dataset.light || "day";
      }
    }, { threshold: [0.12, 0.32, 0.62], rootMargin: "-12% 0px -24%" });
    scenes.forEach(scene => observer.observe(scene));
    return () => observer.disconnect();
  }, [entered]);

  useEffect(() => {
    if (!entered || !precise || reduced || !rootRef.current) return;
    const root = rootRef.current;
    let frame = 0;
    const onPointer = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty("--pointer-x", ((event.clientX / innerWidth) - 0.5).toFixed(3));
        root.style.setProperty("--pointer-y", ((event.clientY / innerHeight) - 0.5).toFixed(3));
      });
    };
    addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      removeEventListener("pointermove", onPointer);
      cancelAnimationFrame(frame);
    };
  }, [entered, precise, reduced]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (infoOpen) setInfoOpen(false);
      else if (!entered) setEntered(true);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [entered, infoOpen]);

  function openInvitation() {
    if (opening) return;
    if (reduced) setEntered(true);
    else setOpening(true);
  }

  function finishOpening(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.animationName !== "v2-stage-journey") return;
    setEntered(true);
    setOpening(false);
  }

  const editionStyle = { "--edition": edition } as CSSProperties;

  return (
    <div className={`v2-world edition-${edition} ${entered ? "has-entered" : "is-locked"} ${opening ? "is-opening" : ""}`} data-light="day" ref={rootRef} style={editionStyle}>
      <a className="v2-skip-link" href="#the-day" onClick={() => setEntered(true)}><T>Skip to the invitation</T></a>

      {!entered && (
        <section className={`v2-opening ${opening ? "is-opening" : ""}`} role="dialog" aria-modal="true" aria-labelledby="opening-recipient">
          <div className="v2-opening-light" aria-hidden="true" />
          <div className="v2-drapery" aria-hidden="true" />
          <header className="v2-opening-folio"><span>Bagas × Iga</span><span>01 · 11 · 2026</span><LanguageSwitch /></header>
          <div className="v2-opening-botanicals" aria-hidden="true">
            <BotanicalImage eager src="/assets/botanicals/syzygium/branch-long.webp" className="opening-syzygium" />
            <BotanicalImage eager src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="opening-fern" />
            <BotanicalImage eager src="/assets/botanicals/melastoma/branch-short.webp" className="opening-melastoma-left" />
            <BotanicalImage eager src="/assets/botanicals/combretum/canopy-branch.webp" className="opening-combretum-top" />
            <BotanicalImage eager src="/assets/botanicals/dendrobium/branch-short.webp" className="opening-orchid" />
          </div>
          <div className="v2-opening-stage" onAnimationEnd={finishOpening}>
            <button className="v2-envelope" type="button" onClick={openInvitation} disabled={opening} aria-label={`${t("Open the invitation")}${hasGuestName ? ` — ${displayName}` : ""}`}>
              <span className="v2-envelope-shadow" aria-hidden="true" />
              <span className="v2-envelope-back" aria-hidden="true">
                <span className="v2-envelope-lining"><img src="/assets/bagas-iga-mark.webp" alt="" /></span>
              </span>
              <span className="v2-envelope-flap" aria-hidden="true" />
              <span className="v2-envelope-front">
                <span className="v2-envelope-fold fold-left" aria-hidden="true" />
                <span className="v2-envelope-fold fold-right" aria-hidden="true" />
                <span className="v2-recipient-copy">
                  <small id={!hasGuestName ? "opening-recipient" : undefined}><T>For our very special guest</T></small>
                  {hasGuestName && <><strong id="opening-recipient" dir="auto">{displayName}</strong><i aria-hidden="true" /></>}
                </span>
                <span className="v2-wax-seal" aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /></span>
              </span>
            </button>
          </div>
          <button className="v2-opening-skip" type="button" onClick={() => setEntered(true)}><T>Skip opening</T></button>
          <p className="v2-opening-date">1 November 2026 · Pandiga, Cimahi<br />Akad 14:00 · <T>Reception</T> 18:00</p>
        </section>
      )}

      {entered && <InvitationSpine open={infoOpen} onToggle={() => setInfoOpen(value => !value)} confirmed={rsvpSaved} />}

      <main className="v2-main" aria-hidden={!entered}>
        <div className="v2-botanical-continuum">
        <GardenBackground active={entered} />
        <section className={`v2-day v2-grand-day v2-scene state-${clock.state}`} id="the-day" data-light="day" aria-labelledby="day-title">
          <div className="v2-day-garden" aria-hidden="true">
            <div className="v2-day-light" />
            <BotanicalImage eager src="/assets/botanicals/combretum/canopy-branch.webp" className="day-combretum" />
            <BotanicalImage eager src="/assets/botanicals/combretum/tendril.webp" className="day-tendril" />
            <BotanicalImage eager src="/assets/botanicals/melastoma/full-stem.webp" className="day-melastoma" />
          </div>
          <div className="v2-conservatory" aria-hidden="true"><i /></div>
          <div className="v2-grand-portal" aria-hidden="true" />
          <div className="v2-garden-steps" aria-hidden="true"><i /><i /><i /></div>
          <div className="v2-hero-exit" aria-hidden="true" />
          <div className="v2-day-copy">
            <img className="v2-day-mark" src="/assets/bagas-iga-mark.webp" alt="Monogram Bagas dan Iga" />
            <p className="v2-grand-prelude"><T>We’re getting married.</T></p>
            <div className="v2-day-identity">
              <h1 id="day-title" ref={dayTitleRef} tabIndex={-1}><span>Iga</span><i aria-hidden="true">&amp;</i><span>Bagas</span></h1>
              <p className="v2-grand-note"><T>Our favourite people. One very good reason to gather.</T></p>
              <time dateTime="2026-11-01"><span><T>Sunday</T></span>01 November 2026</time>
              <p className="v2-grand-venue">Pandiga, Cimahi <span>Akad 14:00 · <T>Reception</T> 18:00 WIB</span></p>
            </div>
            <p className="v2-day-countdown" suppressHydrationWarning><T>The day we’ve been dreaming of</T><span>{clock.countdown}</span></p>
          </div>
          <a className="v2-scroll-cue" href="#details"><span><T>Continue</T></span><i /></a>
        </section>

        <section className="v2-details v2-destination-scene v2-scene" id="details" data-light="afternoon" aria-labelledby="details-title">
          <div className="v2-destination-backdrop" aria-hidden="true">
            <div className="v2-destination-light" />
          </div>
          <div className="v2-destination-page">
            <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium details-syzygium-back" />
            <DestinationMap />
            <div className="v2-destination-paper-edge" aria-hidden="true" />
            <header className="v2-destination-head">
              <p><T>The details</T></p>
              <h2 id="details-title"><span><T>Same place,</T></span><span><T>a very special day.</T></span></h2>
              <p className="v2-destination-intro"><T>Here’s when and where to find us. We can’t wait to see you there.</T></p>
            </header>
            <div className="v2-destination-card">
              <time className="v2-destination-date" dateTime="2026-11-01"><span><T>Sunday</T></span>01 November 2026</time>
              <div className="v2-destination-events" aria-label={t("Wedding schedule")}>
                <article>
                  <Sun aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime="2026-11-01T14:00:00+07:00">14:00</time><h3>Akad</h3><p><T>The official part.</T></p></div>
                </article>
                <article>
                  <Sunset aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime="2026-11-01T18:00:00+07:00">18:00</time><h3><T>Reception</T></h3><p><T>The louder part.</T></p></div>
                </article>
              </div>
              <div className="v2-destination-venue">
                <div className="v2-destination-venue-title">
                  <h3>Pandiga</h3>
                  <em>Cimahi</em>
                </div>
                <address>Jl. Sirnarasa No.11, Cibabat,<br />Kec. Cimahi Utara, Kota Cimahi,<br />Jawa Barat 40513</address>
                <a href={MAPS_URL} target="_blank" rel="noreferrer" aria-label={t("Open directions to Pandiga Cimahi in Google Maps")}><T>Open directions </T><ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} /></a>
              </div>
            </div>
            <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium details-syzygium-front" />
          </div>
          <BotanicalImage src="/assets/botanicals/combretum/flower-tip.webp" className="v2-world-emergence" />
        </section>

        <section className="v2-profiles v2-profile-folio v2-scene" id="profiles" data-light="warm" aria-labelledby="profiles-title">
          <header>
            <p><T>For those who know one of us better.</T></p>
            <h2 id="profiles-title"><T>The two of us,</T><br /><T>as observed by the other.</T></h2>
          </header>
          <article className="v2-person v2-person-bagas" aria-labelledby="profile-bagas-title">
            <figure className="v2-profile-portrait">
              <div className="v2-profile-print">
                <div className="v2-profile-window">
                  <span className="v2-portrait-initial" aria-hidden="true">B</span>
                  <span className="v2-portrait-placeholder"><T>Portrait of Bagas</T><br /><T>to be added</T></span>
                  <i className="v2-portrait-light" aria-hidden="true" />
                </div>
              </div>
              <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="v2-portrait-orchid" />
              <figcaption><T>Bagas, as himself.</T></figcaption>
            </figure>
            <div className="v2-profile-copy">
              <p><T>As observed by Iga</T></p><h3 id="profile-bagas-title">Bagas</h3><small>Bagas Marsya Pratama Nugraha</small>
              <dl>
                <div><dt><T>Known for</T></dt><dd><T>To be added.</T></dd></div>
                <div><dt><T>Usually found</T></dt><dd><T>To be added.</T></dd></div>
                <div><dt><T>According to Iga</T></dt><dd><T>Observation from Iga will be added.</T></dd></div>
              </dl>
            </div>
          </article>
          <div className="v2-profile-join" aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /></div>
          <article className="v2-person v2-person-iga" aria-labelledby="profile-iga-title">
            <figure className="v2-profile-portrait">
              <div className="v2-profile-print">
                <div className="v2-profile-window">
                  <span className="v2-portrait-initial" aria-hidden="true">I</span>
                  <span className="v2-portrait-placeholder"><T>Portrait of Iga</T><br /><T>to be added</T></span>
                  <i className="v2-portrait-light" aria-hidden="true" />
                </div>
              </div>
              <BotanicalImage src="/assets/botanicals/melastoma/full-stem.webp" className="v2-portrait-melastoma" />
              <figcaption><T>Iga, as herself.</T></figcaption>
            </figure>
            <div className="v2-profile-copy">
              <p><T>As observed by Bagas</T></p><h3 id="profile-iga-title">Iga</h3><small>Iga Noviyanti Rohman</small>
              <dl>
                <div><dt><T>Known for</T></dt><dd><T>To be added.</T></dd></div>
                <div><dt><T>Usually found</T></dt><dd><T>To be added.</T></dd></div>
                <div><dt><T>According to Bagas</T></dt><dd><T>Observation from Bagas will be added.</T></dd></div>
              </dl>
            </div>
          </article>
        </section>

        <section className="v2-archive v2-scene v2-archive-table-scene" id="archive" data-light="archive" aria-labelledby="archive-title">
          <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="v2-near-field v2-near-archive" />
          <BotanicalImage src="/assets/botanicals/melastoma/full-stem.webp" className="v2-near-field v2-near-archive-bloom" />
          <div className="v2-archive-heading">
            <p><T>From the archive</T></p>
            <h2 id="archive-title"><T>Some things were</T><br /><T>worth keeping.</T></h2>
            <span><T>Photographs, objects, and little things that became our things.</T></span>
          </div>
          <ArchiveTable items={[archiveItems[0], ...featuredArchive, ...archiveItems.slice(1)].slice(0, 3)} />
        </section>

        <section className="v2-useful v2-scene" id="useful-bits" data-light="quiet" aria-labelledby="useful-title">
          <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="v2-background-bloom v2-background-bloom-useful" />
          <BotanicalImage src="/assets/botanicals/combretum/flower-cluster.webp" className="v2-background-bloom v2-background-bloom-useful-secondary" />
          <header><p><T>The useful bits</T></p><h2 id="useful-title"><T>The questions someone was going to ask anyway.</T></h2></header>
          <div className="v2-useful-list">
            <details><summary><span><T>Dress code</T></span><small><T>Details to follow</T></small></summary><p><T>The dress code will be added after it is confirmed.</T></p></details>
            <details><summary><span><T>Address and entrance</T></span><small>Pandiga Cimahi</small></summary><p>Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513.</p></details>
            <details><summary><span><T>Parking and accessibility</T></span><small><T>Details to follow</T></small></summary><p><T>Parking, entrance, and accessibility guidance will be added after venue confirmation.</T></p></details>
            <details><summary><span><T>Children and plus-ones</T></span><small><T>Details to follow</T></small></summary><p><T>Guest-specific guidance will remain attached to each private invitation.</T></p></details>
            <details><summary><span><T>Contact person</T></span><small><T>Details to follow</T></small></summary><p><T>A contact person will be added closer to the date.</T></p></details>
          </div>
        </section>

        <section className="v2-gifts v2-scene v2-gift-gallery" id="gifts" data-light="late" aria-labelledby="gifts-title">
          <BotanicalImage src="/assets/botanicals/melastoma/branch-short.webp" className="v2-background-bloom v2-background-bloom-gifts" />
          <BotanicalImage src="/assets/botanicals/combretum/flower-spray.webp" className="v2-background-bloom v2-background-bloom-gifts-secondary" />
          <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="v2-near-field v2-near-gifts" />
          <div className="v2-gifts-heading"><p><T>A few things</T></p><h2 id="gifts-title"><T>We’re saving room for.</T></h2><span><T>The catalogue opens from a private invitation so reservations stay private.</T></span></div>
          <GiftShelf href={clock.giftsEnabled ? token ? `/invite/${encodeURIComponent(token)}/gifts` : "/gifts" : null} />
          {clock.giftsEnabled
            ? <Link className="v2-text-link" href={token ? `/invite/${encodeURIComponent(token)}/gifts` : "/gifts"}><T>Open the gift catalogue </T><span aria-hidden="true">↗</span></Link>
            : <p className="v2-feature-note"><T>The gift catalogue will open later.</T></p>}
          <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="gifts-syzygium" />
        </section>

        <section className="v2-mark v2-scene has-studio v2-reply-scene" id="leave-a-mark" data-light="dusk" aria-labelledby="mark-title">
          <div className="v2-mark-copy"><p><T>Your reply</T></p><h2 id="mark-title"><T>A little word</T><br /><T>from you.</T></h2><span><T>Tell us if you’re coming. Leave a little love, if you like.</T></span></div>
          {entered && <div className="v2-mark-studio" id="rsvp"><ReplyStudio token={token} guestName={displayName} defaultStyle={defaultStyleForEdition(edition)} ready={clock.ready} rsvpEnabled={clock.rsvpEnabled} marksEnabled={clock.marksEnabled} onAttendanceSaved={setRsvpSaved} /></div>}
          <BotanicalImage src="/assets/botanicals/melastoma/full-stem.webp" className="mark-melastoma" />
        </section>

        <section className="v2-beyond v2-scene" id="beyond" data-light="night" aria-labelledby="beyond-title">
          <div className="v2-night-light" aria-hidden="true" />
          <div className="v2-night-garden" aria-hidden="true">
            <BotanicalImage src="/assets/botanicals/combretum/canopy-branch.webp" className="night-canopy" />
            <BotanicalImage src="/assets/botanicals/combretum/climber-left.webp" className="night-left" />
            <BotanicalImage src="/assets/botanicals/combretum/climber-right.webp" className="night-right" />
            <BotanicalImage src="/assets/botanicals/combretum/flower-cascade.webp" className="night-bloom" />
            <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="night-fern" />
            <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="night-orchid" />
          </div>
          <div className="v2-beyond-copy">
            <p><T>Beyond the invitation</T></p>
            <h2 id="beyond-title"><T>The invitation ends here.</T><br /><T>The rest stays open.</T></h2>
            <nav aria-label={t("Beyond the invitation")}>
              <Link href="/archive"><strong><T>The Archive</T></strong><span><T>Things we kept.</T></span></Link>
              <span className="is-coming"><strong><T>The Gallery</T></strong><span><T>Then and now. Coming later.</T></span></span>
            </nav>
          </div>
        </section>
        </div>
      </main>

      <InvitationClosing entered={entered} edition={edition} past={clock.state === "past"} onReopen={() => { setEntered(false); setOpening(false); scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }} />
    </div>
  );
}

export function WeddingExperience(props: Props) {
  return <MotionProvider><WeddingWorld {...props} /></MotionProvider>;
}
