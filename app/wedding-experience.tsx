"use client";
import { FormattedText } from "./formatted-text";
/* eslint-disable @next/next/no-img-element */

import { ArrowRight, Sun, Sunset } from "lucide-react";
import {
  createContext,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
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
import { GiftSection } from "./gift-section";
import { ArchiveCollection } from "./archive-collection";
import { GuestArchiveSession } from "./guest-archive-session";
import { defaultStyleForEdition } from "@/lib/mark-styles";
import { T, LanguageSwitch, useLanguage } from "./language";
import { PROFILE_ENABLED, BEYOND_DESTINATIONS, THE_MARK_TEASER, type HomepageArchiveItem, type GiftCollectionPreview, type HomepageGift } from "@/lib/public-content";
import { weddingDisplay } from "@/lib/website-content";
import { invitationClock } from "@/lib/invitation-clock";
import { WEDDING_EVENTS, WEDDING_VENUE } from "@/lib/wedding-calendar";
import { CalendarActions } from "./calendar-actions";
import { ProfilePortrait, useProfileMotion } from "./profile-portraits";
import { GuestPass } from "./guest-pass";
import { ArrivalGuide } from "./arrival-guide";
import { EnvelopeArt } from "./envelope-art";
import { EnvelopePassage } from './envelope-passage';
import { OPENING_FAILSAFE_MS, type LiftedLetter } from '@/lib/envelope-passage';
import { AtelierFloralAccent, AtelierFloralFrame, type AtelierCorner } from "./atelier-flowers";
import { useGuestRsvp } from "./use-guest-rsvp";
import { EMPTY_ARRIVAL_PHOTOS, type ArrivalPhotos } from "@/lib/arrival-content";
import { KeepsakeBotanicals, KeepsakeMonogram } from "./keepsake-botanicals";
import { EMPTY_PHOTOS, type LandingPhotos } from "@/lib/public-content";

type Props = { keepsakeNote?:{note1:string;note2:string}; guestName?: string; token?: string; partyLimit?: number; archiveItems?: HomepageArchiveItem[]; giftCollections?: GiftCollectionPreview[]; giftItems?: HomepageGift[]; photos?: LandingPhotos; arrivalPhotos?:ArrivalPhotos };
type MotionPreferences = { reduced: boolean; precise: boolean };

const MotionContext = createContext<MotionPreferences>({ reduced: false, precise: false });

const MAPS_URL = WEDDING_VENUE.mapsUrl;
const VENUE_CENTER: [number, number] = [107.5554364, -6.8755807];

type SiteState = { phase?: string; rsvpEnabled?: boolean; giftsEnabled?: boolean; marksEnabled?: boolean };
const DEFAULT_ARCHIVE: HomepageArchiveItem[] = [];
const EMPTY_GIFTS: HomepageGift[] = [];

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
  const { language, website, tField } = useLanguage();
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
    return {
      ...invitationClock(now, siteState?.phase, language, website.weddingDate),
      countdown: (()=>{const clock=invitationClock(now,siteState?.phase,language,website.weddingDate);return tField(`countdown.${clock.state==='countdown'?'days':clock.state}`).replaceAll('{{days}}',String(clock.days));})(),
      ready: siteState !== null,
      rsvpEnabled: siteState?.rsvpEnabled === true,
      giftsEnabled: siteState?.giftsEnabled === true,
      marksEnabled: siteState?.marksEnabled === true,
    };
  }, [now, siteState, language, website.weddingDate,tField]);
}

function hashEdition(token: string) {
  let hash = 17;
  for (const character of token || "bagas-iga") hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

function BotanicalImage({src,className}:{src:string;className:string;eager?:boolean}) {
  const corner:AtelierCorner=className.includes("fern")||className.includes("tendril")?"bottom-left":className.includes("melastoma")||className.includes("front")||className.includes("right")?"bottom-right":src.includes("dendrobium")?"top-right":"top-left";
  return <AtelierFloralAccent corner={corner} className={className} style={{"--botanical-pixels":1086} as CSSProperties} />;
}

function InvitationSpine({ open, onToggle, confirmed, profilesEnabled, giftsEnabled }: { open: boolean; onToggle: () => void; confirmed: boolean; profilesEnabled: boolean; giftsEnabled: boolean }) {
  const { t, website, language, arrival } = useLanguage();
  const display=weddingDisplay(website,language);
  const MAPS_URL=website.mapsUrl;
  function navigateChapter(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onToggle();
    const href = event.currentTarget.getAttribute("href");
    if (!href?.startsWith("#")) return;
    requestAnimationFrame(() => {
      const target = document.getElementById(href.slice(1));
      const destination = target?.matches(".v2-scene") ? target.querySelector<HTMLElement>("h1, h2") : target;
      destination?.focus({ preventScroll: true });
    });
  }
  return (
    <header className={`v2-spine ${open ? "is-open" : ""}`}>
      <LanguageSwitch />
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="invitation-info">
        {t(open ? "Close" : "Info")}
      </button>
      <div className="v2-info-drawer" id="invitation-info" aria-hidden={!open} inert={!open}>
        <div>
          <p><time>{website.akadTime}</time><span><T>Akad</T></span></p>
          <p><time>{website.receptionTime}</time><span><T>Reception</T></span></p>
        </div>
        {confirmed && <p className="v2-info-rsvp" role="status"><T>You’re on the list</T></p>}
        <p className="v2-info-place"><strong>{display.venue}</strong><span>{website.venueAddress}</span></p>
        <nav aria-label={t("Practical wedding links")}>
          <a href="#the-day" onClick={navigateChapter}><T>Return to invitation</T></a>
          <a href="#details" onClick={navigateChapter}><T>Details</T></a>
          {profilesEnabled && <a href="#profiles" onClick={navigateChapter}><T>People</T></a>}
          <a href="#archive" onClick={navigateChapter}><T>Archive</T></a>
          <a href="#rsvp" onClick={navigateChapter}><T>RSVP</T></a>
          {giftsEnabled && <a href="#gifts" onClick={navigateChapter}><T>Gifts</T></a>}
          <a href="#leave-a-mark" onClick={navigateChapter}><T>Postcards</T></a>
          <a href={MAPS_URL} target="_blank" rel="noreferrer" onClick={onToggle}><T>Maps</T></a>
        </nav>
      </div>
    </header>
  );
}

function DestinationMap() {
  const { t, website, language } = useLanguage();
  const display=weddingDisplay(website,language);
  const MAPS_URL=website.mapsUrl;
  const VENUE_CENTER: [number,number]=[website.longitude,website.latitude];
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
        markerElement.setAttribute("aria-label", display.venue);
        const pin=document.createElement("span"); pin.className="v2-maplibre-marker-pin"; pin.textContent="B × I"; const label=document.createElement("span"); label.className="v2-maplibre-marker-label"; label.textContent=website.venueName; markerElement.appendChild(pin); markerElement.appendChild(label);
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
    }, { rootMargin: "1600px 0px" });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [reduced, website.longitude, website.latitude, website.venueName]);

  const zoomMap = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (delta > 0) map.zoomIn({ duration: reduced ? 0 : 350 });
    else map.zoomOut({ duration: reduced ? 0 : 350 });
  };

  const resetMap = () => mapRef.current?.easeTo({ center: VENUE_CENTER, zoom: 12.9, bearing: 0, pitch: 0, duration: reduced ? 0 : 650 });

  const handleMapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const distance = event.shiftKey ? 180 : 90;
    if (event.key === "ArrowLeft") { event.preventDefault(); map.panBy([-distance, 0], { duration: reduced ? 0 : 350 }); }
    if (event.key === "ArrowRight") { event.preventDefault(); map.panBy([distance, 0], { duration: reduced ? 0 : 350 }); }
    if (event.key === "ArrowUp") { event.preventDefault(); map.panBy([0, -distance], { duration: reduced ? 0 : 350 }); }
    if (event.key === "ArrowDown") { event.preventDefault(); map.panBy([0, distance], { duration: reduced ? 0 : 350 }); }
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
        {status === "error" && <div className="v2-maplibre-fallback"><strong>{website.venueName}, {website.venueCity}</strong><span><T>Live map unavailable right now.</T></span><a href={MAPS_URL} target="_blank" rel="noreferrer"><T>OPEN IN GOOGLE MAPS </T><span aria-hidden="true">→</span></a></div>}
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

function WeddingWorld({ keepsakeNote, guestName = "", token = "", partyLimit = 1, archiveItems = DEFAULT_ARCHIVE, giftItems = EMPTY_GIFTS, photos = EMPTY_PHOTOS, arrivalPhotos = EMPTY_ARRIVAL_PHOTOS }: Props) {
  const { t, content, tField, language, website, blocks } = useLanguage();
  const display=weddingDisplay(website,language);
  const MAPS_URL=website.mapsUrl;
  const akad={...WEDDING_EVENTS.akad,time:website.akadTime,startsAt:`${website.weddingDate}T${website.akadTime}:00+07:00`};
  const reception={...WEDDING_EVENTS.reception,time:website.receptionTime,startsAt:`${website.weddingDate}T${website.receptionTime}:00+07:00`};
  const { reduced, precise } = useContext(MotionContext);
  const clock = useExperienceClock();
  const rootRef = useRef<HTMLDivElement>(null);
  const dayTitleRef = useRef<HTMLHeadingElement>(null);
  const [entered, setEntered] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [opening, setOpening] = useState(false);
  const [liftedLetter,setLiftedLetter]=useState<LiftedLetter|null>(null);
  const [cinematicEntry,setCinematicEntry]=useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const rsvp = useGuestRsvp({ token, partyLimit, active: entered, rsvpEnabled: clock.rsvpEnabled });
  const edition = useMemo(() => hashEdition(token), [token]);
  const displayName = guestName.trim();
  const hasGuestName = Boolean(displayName);
  const profilesEnabled = website.profilesEnabled;
  const { sectionRef: profilesRef, bagasRef: bagasVideoRef, igaRef: igaVideoRef } = useProfileMotion(entered && profilesEnabled && !reduced, photos.bagas, photos.iga);
  const giftsEnabled = clock.giftsEnabled;
  const usefulBits = blocks.faq;
  const destinations = blocks.links;

  useEffect(() => {
    queueMicrotask(() => setHydrated(true));
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
      else if (!entered) {setEntered(true);setOpening(false);setLiftedLetter(null);}
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [entered, infoOpen]);

  function openInvitation() {
    if (opening) return;
    scrollTo({top:0,behavior:'instant'});
    if (reduced) setEntered(true);
    else {setCinematicEntry(true);setOpening(true);}
  }

  function finishOpening() {setEntered(true);setOpening(false);setLiftedLetter(null);}

  useEffect(() => {
    if (!opening) return;
    // Missing graphics/animation events cannot trap the guest behind the opening.
    const timer = window.setTimeout(() => { setEntered(true); setOpening(false);setLiftedLetter(null); }, OPENING_FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);

  const editionStyle = { "--edition": edition } as CSSProperties;

  return (
    <div className={`v2-world edition-${edition} ${entered ? "has-entered" : "is-locked"} ${opening ? "is-opening" : ""} ${cinematicEntry?'has-opening-passage':''}`} data-light="day" ref={rootRef} style={editionStyle}>
      <GuestArchiveSession token={token} />
      <link rel="preload" as="image" href="/atelier/assets/keepsake-florals.webp" fetchPriority="high" />
      <a className="v2-skip-link" href="#the-day" onClick={finishOpening}><T>Skip to the invitation</T></a>

      {!entered && (
        <section className={`v2-opening ${opening ? "is-opening" : ""}`} role="dialog" aria-modal="true" aria-labelledby="opening-recipient">
          <div className="envelope-passage-backdrop" aria-hidden="true" />
          <div className="v2-opening-light" aria-hidden="true" />
          <AtelierFloralFrame className="atelier-opening-garden" />
          <header className="v2-opening-folio"><span>{display.names}</span><span>{display.stamp}</span><LanguageSwitch /></header>
          <div className="v2-opening-stage">
            <button className="v2-envelope" type="button" onClick={openInvitation} disabled={opening} aria-label={`${t("Open the invitation")}${hasGuestName ? ` — ${displayName}` : ""}`}>
              <EnvelopeArt recipient={displayName} opening={opening} reduced={reduced} onLifted={setLiftedLetter} />
              <span id="opening-recipient" className="atelier-opening-recipient">{hasGuestName?displayName:t("For our very special guest")}</span>
              <span className="atelier-open-label">{t("Open the invitation")}<ArrowRight size={16} strokeWidth={1.3} aria-hidden="true" /></span>
            </button>
          </div>
          {opening&&liftedLetter&&<EnvelopePassage letter={liftedLetter} onComplete={finishOpening} />}
          <button className="v2-opening-skip" type="button" onClick={finishOpening}><T>Skip opening</T></button>
          <p className="v2-opening-date">{display.date} · {display.venue}<br /><T>Akad</T> {website.akadTime} · <T>Reception</T> {website.receptionTime} <T>WIB</T></p>
        </section>
      )}

      {entered && <InvitationSpine open={infoOpen} onToggle={() => setInfoOpen(value => !value)} confirmed={rsvp.saved?.attendance === 'yes'} profilesEnabled={profilesEnabled} giftsEnabled={giftsEnabled} />}

      <main className="v2-main" aria-hidden={hydrated && !entered} inert={hydrated && !entered}>
        <div className="v2-botanical-continuum">
        <GardenBackground active={entered || opening} />
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
            <img className="v2-day-mark" src="/assets/bagas-iga-mark.webp" alt="Iga & Bagas monogram" />
            <p className="v2-grand-prelude"><T>We’re getting married.</T></p>
            <div className="v2-day-identity">
              <h1 id="day-title" ref={dayTitleRef} tabIndex={-1} aria-label={display.names}><span>{website.secondName}</span>{" "}<i aria-hidden="true">&amp;</i>{" "}<span>{website.firstName}</span></h1>
              <p className="v2-grand-note"><T field="hero.hero sub" rich /></p>
              <time dateTime={website.weddingDate}><span>{display.day}</span>{display.date}</time>
              <p className="v2-grand-venue">{display.venue}<span>{t("Akad")} {website.akadTime} · {t("Reception")} {website.receptionTime} <T>WIB</T></span></p>
            </div>
            <p className="v2-day-countdown" suppressHydrationWarning><T>{clock.state === "past" ? "And just like that," : "The day we’ve been dreaming of is"}</T><span>{clock.countdown}</span></p>
          </div>
          <a className="v2-scroll-cue" href="#details"><span><T>Continue</T></span><i /></a>
        </section>

        <section className="v2-details v2-destination-scene v2-event-arrival v2-scene" id="details" data-light="afternoon" aria-labelledby="details-title">
          <div className="v2-destination-backdrop" aria-hidden="true">
            <div className="v2-destination-light" />
          </div>
          <div className="v2-destination-page">
            <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium details-syzygium-back" />
            <div className="v2-destination-paper-edge" aria-hidden="true" />
            <header className="v2-destination-head">
              <p><T>The details</T></p>
              <h2 id="details-title" tabIndex={-1}><T field="details.head" /></h2>
              <p className="v2-destination-intro"><T field="details.sub" rich /></p>
            </header>
            <div className="v2-destination-card ks-event-paper">
              <time className="v2-destination-date" dateTime={website.weddingDate}><span>{display.day}</span>{display.date}</time>
              <div className="v2-destination-events" aria-label={t("Wedding schedule")}>
                <article>
                  <Sun aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime={akad.startsAt}>{akad.time}</time><h3><T>Akad</T></h3><p><T field="details.akad" rich /></p><CalendarActions eventKey="akad" /></div>
                </article>
                <article>
                  <Sunset aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime={reception.startsAt}>{reception.time}</time><h3><T>Reception</T></h3><p><T field="details.resepsi" rich /></p><CalendarActions eventKey="reception" /></div>
                </article>
              </div>
              <div className="v2-destination-venue">
                <div className="v2-destination-venue-title">
                  <h3>{website.venueName}</h3>
                  <em>{website.venueCity}</em>
                </div>
                <address>{website.venueAddress}</address>
                <a href={MAPS_URL} target="_blank" rel="noreferrer" aria-label={t("Open directions to Pandiga Cimahi in Google Maps")}><T>Open directions </T><ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} /></a>
              </div>
            </div>
            <DestinationMap />
            {token && <div id="guest-pass"><GuestPass key={token} token={token} /></div>}
            <ArrivalGuide photos={arrivalPhotos} guestName={displayName} faq={usefulBits} />
            <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium details-syzygium-front" />
          </div>
          <BotanicalImage src="/assets/botanicals/combretum/flower-tip.webp" className="v2-world-emergence" />
        </section>

        {profilesEnabled && <section className="v2-profiles v2-profile-folio v2-scene" id="profiles" data-light="warm" aria-labelledby="profiles-title" ref={profilesRef}>
          <header>
            <h2 id="profiles-title" tabIndex={-1}><T field="profil.head" /></h2>
          </header>
          <article className="v2-person v2-person-bagas" aria-labelledby="profile-bagas-title">
            <figure className="v2-profile-portrait">
              <div className="v2-profile-print">
                <ProfilePortrait person="bagas" src={photos.bagas} name="Bagas Marsya Pratama Nugraha" videoRef={bagasVideoRef} />
              </div>
              <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="v2-portrait-orchid" />
              <KeepsakeBotanicals arrangement="portrait" />
            </figure>
            <div className="v2-profile-copy">
              <h3 id="profile-bagas-title">{tField("profil.nama1")}</h3>
              <dl>
                <div><dt><T field="profil.person_label" /></dt><dd><T field="profil.b_family" rich /></dd></div>
                <div><dt><T field="profil.b_known_label" /></dt><dd><T field="profil.b_known" rich /></dd></div>
                <div><dt><T field="profil.b_eyes_label" /></dt><dd><T field="profil.quote1" rich /></dd></div>
              </dl>
            </div>
          </article>
          <div className="v2-profile-join" aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /></div>
          <article className="v2-person v2-person-iga" aria-labelledby="profile-iga-title">
            <figure className="v2-profile-portrait">
              <div className="v2-profile-print">
                <ProfilePortrait person="iga" src={photos.iga} name="Iga Noviyanti Rohman" videoRef={igaVideoRef} />
              </div>
              <BotanicalImage src="/assets/botanicals/melastoma/full-stem.webp" className="v2-portrait-melastoma" />
              <KeepsakeBotanicals arrangement="portrait" />
            </figure>
            <div className="v2-profile-copy">
              <h3 id="profile-iga-title">{tField("profil.i_nama")}</h3>
              <dl>
                <div><dt><T field="profil.person_label" /></dt><dd><T field="profil.i_family" rich /></dd></div>
                <div><dt><T field="profil.i_known_label" /></dt><dd><T field="profil.i_known" rich /></dd></div>
                <div><dt><T field="profil.i_eyes_label" /></dt><dd><T field="profil.quote2" rich /></dd></div>
              </dl>
            </div>
          </article>
        </section>}

        <section className="v2-our-story v2-scene ks-story" id="our-story" data-light="quiet" aria-labelledby="our-story-title">
          <div className="ks-folio ks-story-folio">
            <div className="ks-paper">
              <header><KeepsakeMonogram /><p><T>Our story</T></p><h2 id="our-story-title"><T field="story.head" /></h2></header>
              <ol>{blocks.story.map((item,index) => <li key={item.id}><span aria-hidden="true">{String(index+1).padStart(2,"0")}</span><h3>{item.title[language]}</h3><p><FormattedText value={item.body[language]}/></p></li>)}</ol>
            </div>
            <KeepsakeBotanicals />
          </div>
        </section>

        <ArchiveCollection items={archiveItems} photos={photos.gallery} />

        {giftsEnabled && <GiftSection token={token} guestName={displayName} gifts={giftItems} />}

        <section className="v2-mark v2-scene has-studio v2-reply-scene ks-reply" id="leave-a-mark" data-light="dusk" aria-labelledby="mark-title">
          <div className="ks-reply-heading"><div className="v2-mark-copy"><p><T field="mark.head" /></p><h2 id="mark-title" tabIndex={-1}><T field="mark.sub" /></h2><span><T field="mark.desc" rich /></span></div><KeepsakeBotanicals arrangement="reply" /></div>
          {entered && <div className="v2-mark-studio" id="rsvp" tabIndex={-1} role="group" aria-labelledby="mark-title"><ReplyStudio token={token} guestName={displayName} defaultStyle={defaultStyleForEdition(edition)} ready={clock.ready} marksEnabled={clock.marksEnabled} rsvp={rsvp} /></div>}
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
              {destinations.map(item => <a key={item.href} href={item.href}><strong>{item.title[language]}</strong><span><FormattedText value={item.body[language]}/></span></a>)}
            </nav>
          </div>
        </section>
        </div>
      </main>

      <InvitationClosing keepsakeNote={keepsakeNote} entered={entered} edition={edition} past={clock.state === "past"} guestName={displayName} />
    </div>
  );
}

export function WeddingExperience(props: Props) {
  return <MotionProvider><WeddingWorld {...props} /></MotionProvider>;
}
