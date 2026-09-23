"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowRight, Sun, Sunset } from "lucide-react";
import {
  createContext,
  type AnimationEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

type Props = { guestName?: string; token?: string; partyLimit?: number };
type Attendance = "" | "yes" | "no";
type MotionPreferences = { reduced: boolean; precise: boolean };

const MotionContext = createContext<MotionPreferences>({ reduced: false, precise: false });

const EVENT_DATE_UTC = Date.UTC(2026, 10, 1);
const MAPS_URL = "https://maps.app.goo.gl/JFL3wrzj7qsBXbz56";
const VENUE_CENTER: [number, number] = [107.5554364, -6.8755807];

const archiveItems = [
  {
    type: "The mark",
    title: "A B embracing a bending I.",
    note: "The identity began with an old joke about a missing rib. The B holds the curved I without turning the story into a slogan.",
    image: "/assets/bagas-iga-mark.webp",
    alt: "Monogram Bagas dan Iga",
  },
  {
    type: "Photograph",
    title: "Reserved for something real.",
    note: "An original photograph from Bagas and Iga will live here. No substitute memory has been invented.",
  },
  {
    type: "Object",
    title: "Something that survived.",
    note: "This place is held for a real object, receipt, note, or other ordinary evidence worth keeping.",
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
  const [phaseOverride, setPhaseOverride] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch("/api/site-state")
      .then(response => response.ok ? response.json() : null)
      .then(state => setPhaseOverride(state?.phase || ""))
      .catch(() => {});
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
    const forcedToday = phaseOverride === "wedding-day";
    const forcedPast = phaseOverride === "post-wedding";
    const state = forcedPast || days < 0 ? "past" : forcedToday || days === 0 ? "today" : days === 1 ? "tomorrow" : "countdown";
    const countdown = state === "past"
      ? "AND JUST LIKE THAT, WE'RE MARRIED."
      : state === "today"
        ? "IS TODAY."
        : state === "tomorrow"
          ? "IS TOMORROW."
          : `IS ${Math.max(days, 0)} DAYS AWAY.`;
    return { state, countdown };
  }, [now, phaseOverride]);
}

function hashEdition(token: string) {
  let hash = 17;
  for (const character of token || "bagas-iga") hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 3;
}

function BotanicalImage({ src, className, eager = false }: { src: string; className: string; eager?: boolean }) {
  return <img className={className} src={src} alt="" aria-hidden="true" loading={eager ? "eager" : "lazy"} />;
}

function InvitationSpine({ open, onToggle, confirmed }: { open: boolean; onToggle: () => void; confirmed: boolean }) {
  return (
    <header className={`v2-spine ${open ? "is-open" : ""}`}>
      <a className="v2-spine-mark" href="#the-day" aria-label="Kembali ke The Day">B <i>×</i> I</a>
      <span className="v2-spine-date">01 · 11 · 26</span>
      {confirmed ? <span className="v2-spine-rsvp">You’re on the list</span> : <span className="v2-spine-rsvp" aria-hidden="true" />}
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="invitation-info">
        {open ? "Close" : "Info"}
      </button>
      <div className="v2-info-drawer" id="invitation-info" aria-hidden={!open}>
        <div>
          <p><time>14:00</time><span>Akad</span></p>
          <p><time>18:00</time><span>Reception</span></p>
        </div>
        <p className="v2-info-place"><strong>Pandiga Cimahi</strong><span>Jl. Sirnarasa No.11, Cibabat</span></p>
        <nav aria-label="Practical wedding links">
          <a href={MAPS_URL} target="_blank" rel="noreferrer" onClick={onToggle}>Maps</a>
          <a href="#rsvp" onClick={onToggle}>RSVP</a>
          <a href="#useful-bits" onClick={onToggle}>Useful bits</a>
        </nav>
      </div>
    </header>
  );
}

function ArchiveArtifact({ item, index }: { item: (typeof archiveItems)[number]; index: number }) {
  const [turned, setTurned] = useState(false);
  return (
    <article className={`v2-artifact artifact-${index + 1} ${turned ? "is-turned" : ""}`}>
      <button type="button" onClick={() => setTurned(value => !value)} aria-pressed={turned}>
        <span className="v2-artifact-side v2-artifact-front">
          <span className="v2-artifact-index">{String(index + 1).padStart(2, "0")}</span>
          {item.image
            ? <img src={item.image} alt={item.alt || ""} />
            : <span className="v2-artifact-placeholder" aria-hidden="true"><i /><i /><i /></span>}
          <span className="v2-artifact-type">{item.type}</span>
          <strong>{item.title}</strong>
          <small>Turn it over</small>
        </span>
        <span className="v2-artifact-side v2-artifact-back">
          <span>{item.type} / Bagas × Iga</span>
          <strong>{item.note}</strong>
          <small>Return to the front</small>
        </span>
      </button>
    </article>
  );
}

function DestinationMap() {
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
          aria-label="Interactive map around Pandiga Cimahi. Use drag, the controls, or arrow keys to explore."
          aria-describedby="destination-map-help"
          onKeyDown={handleMapKeyDown}
        />
        {status === "loading" && <div className="v2-maplibre-status" role="status">Loading the actual roads around Pandiga…</div>}
        {status === "error" && <div className="v2-maplibre-fallback"><strong>Pandiga Cimahi</strong><span>Live map unavailable right now.</span><a href={MAPS_URL} target="_blank" rel="noreferrer">OPEN IN GOOGLE MAPS <span aria-hidden="true">→</span></a></div>}
        <div className="v2-destination-map-controls" role="group" aria-label="Map controls">
          <button type="button" onClick={() => zoomMap(.1)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomMap(-.1)} aria-label="Zoom out">−</button>
          <button type="button" onClick={resetMap} aria-label="Reset map">↺</button>
        </div>
      </div>
      <p className="v2-destination-map-help" id="destination-map-help">Use the controls, drag, or arrow keys to explore the actual roads around the venue. The directions link below opens Google Maps.</p>
      {reduced && <span className="v2-destination-map-static-note">Map shown in a still state.</span>}
    </div>
  );
}

function WeddingWorld({ guestName = "", token = "", partyLimit = 2 }: Props) {
  const { reduced, precise } = useContext(MotionContext);
  const clock = useExperienceClock();
  const rootRef = useRef<HTMLDivElement>(null);
  const dayTitleRef = useRef<HTMLHeadingElement>(null);
  const [entered, setEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance>("");
  const [partySize, setPartySize] = useState(1);
  const [guestNames, setGuestNames] = useState("");
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [rsvpStatus, setRsvpStatus] = useState("");
  const [rsvpSaved, setRsvpSaved] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const edition = useMemo(() => hashEdition(token), [token]);
  const displayName = guestName.trim();
  const hasGuestName = Boolean(displayName);

  useEffect(() => {
    document.body.classList.add("wedding-v2-body");
    document.body.style.overflow = entered ? "" : "hidden";
    return () => {
      document.body.classList.remove("wedding-v2-body");
      document.body.style.overflow = "";
    };
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    dayTitleRef.current?.focus({ preventScroll: true });
  }, [entered]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`)
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (cancelled || !result?.rsvp) return;
        const saved = result.rsvp;
        const nextAttendance: Attendance = saved.attendance === "yes" ? "yes" : saved.attendance === "no" ? "no" : "";
        setAttendance(nextAttendance);
        setPartySize(Math.max(1, Number(saved.party_size) || 1));
        setGuestNames(saved.guest_names || "");
        setDietary(saved.dietary || "");
        setMessage(saved.message || "");
        setRsvpSaved(nextAttendance === "yes");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

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

  async function submitRsvp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attendance) return;
    if (!token) {
      setRsvpStatus(attendance === "yes" ? "Preview only — open your personal invitation to save this." : "Preview only — nothing was saved.");
      return;
    }
    setRsvpBusy(true);
    setRsvpStatus("Saving your answer…");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attendance, partySize, guestNames, dietary, message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your answer could not be saved.");
      const attending = attendance === "yes";
      setRsvpSaved(attending);
      setRsvpStatus(attending ? "YOU'RE ON THE LIST." : "WE'LL MISS YOU. THANKS FOR LETTING US KNOW.");
    } catch (error) {
      setRsvpStatus(error instanceof Error ? error.message : "Your answer could not be saved.");
    } finally {
      setRsvpBusy(false);
    }
  }

  const editionStyle = { "--edition": edition } as CSSProperties;

  return (
    <div className={`v2-world edition-${edition} ${entered ? "has-entered" : "is-locked"} ${opening ? "is-opening" : ""}`} data-light="day" ref={rootRef} style={editionStyle}>
      <a className="v2-skip-link" href="#the-day" onClick={() => setEntered(true)}>Skip to the invitation</a>

      {!entered && (
        <section className={`v2-opening ${opening ? "is-opening" : ""}`} role="dialog" aria-modal="true" aria-labelledby="opening-recipient">
          <div className="v2-opening-light" aria-hidden="true" />
          <div className="v2-drapery" aria-hidden="true" />
          <div className="v2-opening-folio" aria-hidden="true"><span>Bagas × Iga</span><span>01 · 11 · 2026</span></div>
          <div className="v2-opening-botanicals" aria-hidden="true">
            <BotanicalImage eager src="/assets/botanicals/syzygium/branch-long.webp" className="opening-syzygium" />
            <BotanicalImage eager src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="opening-fern" />
            <BotanicalImage eager src="/assets/botanicals/combretum/climber-left.webp" className="opening-combretum-left" />
            <BotanicalImage eager src="/assets/botanicals/combretum/canopy-branch.webp" className="opening-combretum-top" />
            <BotanicalImage eager src="/assets/botanicals/dendrobium/branch-short.webp" className="opening-orchid" />
          </div>
          <div className="v2-opening-stage" onAnimationEnd={finishOpening}>
            <button className="v2-envelope" type="button" onClick={openInvitation} disabled={opening} aria-label={hasGuestName ? `Open the invitation for ${displayName}` : "Open the invitation"}>
              <span className="v2-envelope-shadow" aria-hidden="true" />
              <span className="v2-envelope-back" aria-hidden="true">
                <span className="v2-envelope-lining"><img src="/assets/bagas-iga-mark.webp" alt="" /></span>
              </span>
              <span className="v2-envelope-flap" aria-hidden="true" />
              <span className="v2-envelope-front">
                <span className="v2-envelope-fold fold-left" aria-hidden="true" />
                <span className="v2-envelope-fold fold-right" aria-hidden="true" />
                <span className="v2-recipient-copy">
                  <small>Teruntuk tamu spesial kami</small>
                  {hasGuestName && <><strong id="opening-recipient" dir="auto">{displayName}</strong><i aria-hidden="true" /></>}
                </span>
                <span className="v2-wax-seal" aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /></span>
              </span>
            </button>
          </div>
          <button className="v2-opening-skip" type="button" onClick={() => setEntered(true)}>Skip opening</button>
          <p className="v2-opening-date">1 November 2026 · Pandiga, Cimahi<br />Akad 14:00 · Reception 18:00</p>
        </section>
      )}

      {entered && <InvitationSpine open={infoOpen} onToggle={() => setInfoOpen(value => !value)} confirmed={rsvpSaved} />}

      <main className="v2-main" aria-hidden={!entered}>
        <div className="v2-botanical-continuum">
        <section className={`v2-day v2-scene state-${clock.state}`} id="the-day" data-light="day" aria-labelledby="day-title">
          <div className="v2-day-garden" aria-hidden="true">
            <div className="v2-day-light" />
            <BotanicalImage eager src="/assets/botanicals/combretum/canopy-branch.webp" className="day-combretum" />
            <BotanicalImage eager src="/assets/botanicals/combretum/tendril.webp" className="day-tendril" />
            <BotanicalImage eager src="/assets/botanicals/melastoma/full-stem.webp" className="day-melastoma" />
          </div>
          <div className="v2-day-copy">
            <img className="v2-day-mark" src="/assets/bagas-iga-mark.webp" alt="Monogram Bagas dan Iga" />
            <p>The day we’ve been dreaming of</p>
            <p className="v2-day-countdown" suppressHydrationWarning>{clock.countdown}</p>
            <div className="v2-day-identity">
              <span>The special day of</span>
              <h1 id="day-title" ref={dayTitleRef} tabIndex={-1}>IGA <i aria-hidden="true">×</i> BAGAS</h1>
              <time dateTime="2026-11-01"><span>Sunday</span>01 November 2026</time>
            </div>
          </div>
          <a className="v2-scroll-cue" href="#details"><span>Continue</span><i /></a>
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
              <p>The details</p>
              <h2 id="details-title"><span>Same place,</span><span>a very special day.</span></h2>
              <p className="v2-destination-intro">Here’s when and where to find us. We can’t wait to see you there.</p>
            </header>
            <div className="v2-destination-card">
              <time className="v2-destination-date" dateTime="2026-11-01"><span>Sunday</span>01 November 2026</time>
              <div className="v2-destination-events" aria-label="Wedding schedule">
                <article>
                  <Sun aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime="2026-11-01T14:00:00+07:00">14:00</time><h3>Akad</h3><p>The official part.</p></div>
                </article>
                <article>
                  <Sunset aria-hidden="true" className="v2-destination-event-icon" strokeWidth={1.35} />
                  <div><time dateTime="2026-11-01T18:00:00+07:00">18:00</time><h3>Reception</h3><p>The louder part.</p></div>
                </article>
              </div>
              <div className="v2-destination-venue">
                <div className="v2-destination-venue-title">
                  <h3>Pandiga</h3>
                  <em>Cimahi</em>
                </div>
                <address>Jl. Sirnarasa No.11, Cibabat,<br />Kec. Cimahi Utara, Kota Cimahi,<br />Jawa Barat 40513</address>
                <a href={MAPS_URL} target="_blank" rel="noreferrer" aria-label="Open directions to Pandiga Cimahi in Google Maps">Open directions <ArrowRight aria-hidden="true" size={17} strokeWidth={1.5} /></a>
              </div>
            </div>
            <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium details-syzygium-front" />
          </div>
          <BotanicalImage src="/assets/botanicals/combretum/flower-tip.webp" className="v2-world-emergence" />
        </section>

        <section className="v2-profiles v2-scene" id="profiles" data-light="warm" aria-labelledby="profiles-title">
          <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="v2-background-bloom v2-background-bloom-profiles" />
          <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="v2-near-field v2-near-profiles" />
          <header>
            <p>For those who know one of us better.</p>
            <h2 id="profiles-title">The two of us,<br />as observed by the other.</h2>
          </header>
          <article className="v2-person v2-person-bagas">
            <figure><div><span>Portrait of Bagas<br />to be added</span></div><figcaption>Bagas, as himself.</figcaption></figure>
            <div>
              <p>Bagas</p><h3>Bagas</h3><small>Bagas Marsya Pratama Nugraha</small>
              <dl>
                <div><dt>Known for</dt><dd>Observation from Iga will be added.</dd></div>
                <div><dt>Usually found</dt><dd>Observation from Iga will be added.</dd></div>
                <div><dt>According to Iga</dt><dd>“A real sentence will live here.”</dd></div>
              </dl>
            </div>
          </article>
          <div className="v2-profile-join"><img src="/assets/bagas-iga-mark.webp" alt="" /></div>
          <article className="v2-person v2-person-iga">
            <figure><div><span>Portrait of Iga<br />to be added</span></div><figcaption>Iga, as herself.</figcaption></figure>
            <div>
              <p>Iga</p><h3>Iga</h3><small>Iga Noviyanti Rohman</small>
              <dl>
                <div><dt>Known for</dt><dd>Observation from Bagas will be added.</dd></div>
                <div><dt>Usually found</dt><dd>Observation from Bagas will be added.</dd></div>
                <div><dt>According to Bagas</dt><dd>“A real sentence will live here.”</dd></div>
              </dl>
            </div>
          </article>
        </section>

        <section className="v2-archive v2-scene" id="archive" data-light="archive" aria-labelledby="archive-title">
          <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="v2-near-field v2-near-archive" />
          <BotanicalImage src="/assets/botanicals/melastoma/full-stem.webp" className="v2-near-field v2-near-archive-bloom" />
          <div className="v2-archive-heading">
            <p>From the archive</p>
            <h2 id="archive-title">Some things were<br />worth keeping.</h2>
            <span>Photographs, objects, and other evidence. Only the real material makes it into the collection.</span>
          </div>
          <div className="v2-evidence-field">
            {archiveItems.map((item, index) => <ArchiveArtifact item={item} index={index} key={item.type} />)}
            <BotanicalImage src="/assets/botanicals/combretum/tendril.webp" className="archive-tendril" />
          </div>
          <Link className="v2-text-link" href="/archive">Open the archive <span aria-hidden="true">↗</span></Link>
        </section>

        <section className="v2-rsvp v2-scene" id="rsvp" data-light="rsvp" aria-labelledby="rsvp-title">
          <BotanicalImage src="/assets/botanicals/melastoma/branch-short.webp" className="v2-background-bloom v2-background-bloom-rsvp" />
          <div className="v2-rsvp-copy">
            <p>Will you be there?</p>
            <h2 id="rsvp-title">We’re doing<br />a headcount.</h2>
            <span>Apparently venues care about these things.</span>
          </div>
          <form className={`v2-rsvp-form ${rsvpSaved ? "is-confirmed" : ""}`} onSubmit={submitRsvp}>
            <p className="v2-form-person">Invitation for <strong>{displayName}</strong></p>
            <fieldset>
              <legend>Your answer</legend>
              <label className={attendance === "yes" ? "is-selected" : ""}>
                <input type="radio" name="attendance" value="yes" checked={attendance === "yes"} onChange={() => setAttendance("yes")} />
                <span>I’ll be there.</span>
              </label>
              <label className={attendance === "no" ? "is-selected" : ""}>
                <input type="radio" name="attendance" value="no" checked={attendance === "no"} onChange={() => setAttendance("no")} />
                <span>I’ll miss this one.</span>
              </label>
            </fieldset>
            {attendance === "yes" && (
              <div className="v2-rsvp-details">
                <label>Number of guests
                  <select value={partySize} onChange={event => setPartySize(Number(event.target.value))}>
                    {Array.from({ length: Math.max(1, partyLimit) }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}
                  </select>
                </label>
                <label>Guest names <span>optional</span><input value={guestNames} onChange={event => setGuestNames(event.target.value)} maxLength={300} /></label>
                <label>Dietary notes <span>optional</span><input value={dietary} onChange={event => setDietary(event.target.value)} maxLength={300} /></label>
                <label>A note for us <span>optional</span><textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={800} rows={3} /></label>
              </div>
            )}
            <button className="v2-rsvp-submit" type="submit" disabled={!attendance || rsvpBusy}>{rsvpBusy ? "Saving…" : token ? "Save my answer" : "Preview my answer"}</button>
            <p className="v2-rsvp-status" role="status">{rsvpStatus}</p>
            {rsvpSaved && <div className={`v2-acceptance-mark edition-${edition}`} aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /><span>Accepted / 01.11.26</span></div>}
          </form>
        </section>

        <section className="v2-useful v2-scene" id="useful-bits" data-light="quiet" aria-labelledby="useful-title">
          <BotanicalImage src="/assets/botanicals/dendrobium/branch-short.webp" className="v2-background-bloom v2-background-bloom-useful" />
          <header><p>The useful bits</p><h2 id="useful-title">The questions someone was going to ask anyway.</h2></header>
          <div className="v2-useful-list">
            <details><summary><span>Dress code</span><small>Details to follow</small></summary><p>The dress code will be added after it is confirmed.</p></details>
            <details><summary><span>Address and entrance</span><small>Pandiga Cimahi</small></summary><p>Jl. Sirnarasa No.11, Cibabat, Kec. Cimahi Utara, Kota Cimahi, Jawa Barat 40513.</p></details>
            <details><summary><span>Parking and accessibility</span><small>Details to follow</small></summary><p>Parking, entrance, and accessibility guidance will be added after venue confirmation.</p></details>
            <details><summary><span>Children and plus-ones</span><small>Details to follow</small></summary><p>Guest-specific guidance will remain attached to each private invitation.</p></details>
            <details><summary><span>Contact person</span><small>Details to follow</small></summary><p>A contact person will be added closer to the date.</p></details>
          </div>
        </section>

        <section className="v2-gifts v2-scene" id="gifts" data-light="late" aria-labelledby="gifts-title">
          <BotanicalImage src="/assets/botanicals/melastoma/branch-short.webp" className="v2-background-bloom v2-background-bloom-gifts" />
          <BotanicalImage src="/assets/botanicals/nephrolepis/frond-arched-01.webp" className="v2-near-field v2-near-gifts" />
          <div className="v2-gifts-heading"><p>A few things</p><h2 id="gifts-title">We’re saving room for.</h2><span>The catalogue opens from a private invitation so reservations stay private.</span></div>
          <div className="v2-gift-shelf" aria-label="Gift collections">
            {["For Bagas", "For Iga", "For Our Home"].map((label, index) => (
              <article key={label}>
                <div className={`v2-object object-${index + 1}`} aria-hidden="true"><i /><i /></div>
                <span>{String(index + 1).padStart(2, "0")}</span><h3>{label}</h3><p>Curated objects will be added here.</p>
              </article>
            ))}
          </div>
          <Link className="v2-text-link" href={token ? `/invite/${encodeURIComponent(token)}/gifts` : "/gifts"}>Open the gift catalogue <span aria-hidden="true">↗</span></Link>
          <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="gifts-syzygium" />
        </section>

        <section className="v2-mark v2-scene" id="leave-a-mark" data-light="dusk" aria-labelledby="mark-title">
          <div className="v2-mark-copy"><p>Leave a mark</p><h2 id="mark-title">Make a mess.<br />We’ll keep it.</h2><span>Write something, draw something, or do both.</span><Link href={token ? `/invite/${encodeURIComponent(token)}/mark` : "/marks"}>{token ? "Open your postcard" : "See guest marks"} <span aria-hidden="true">↗</span></Link></div>
          <div className="v2-postcard-installation" aria-label="Guest postcard installation preview">
            <div className="v2-postcard card-a"><small>Text / drawing</small><strong>Something from you<br />will live here.</strong><span>Kept for Bagas × Iga</span></div>
            <div className="v2-postcard card-b" aria-hidden="true"><i /><i /><i /></div>
            <div className={`v2-postcard card-c edition-${edition}`} aria-hidden="true"><img src="/assets/bagas-iga-mark.webp" alt="" /></div>
          </div>
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
            <p>Beyond the invitation</p>
            <h2 id="beyond-title">The invitation ends here.<br />The rest stays open.</h2>
            <nav aria-label="Beyond the invitation">
              <Link href="/archive"><strong>The Archive</strong><span>Things we kept.</span></Link>
              <Link href="/marks"><strong>The Marks</strong><span>Things you left.</span></Link>
              <span className="is-coming"><strong>The Gallery</strong><span>Then and now. Coming later.</span></span>
            </nav>
          </div>
        </section>
        </div>
      </main>

      <footer className="v2-footer" aria-hidden={!entered}>
        <div className={`v2-footer-edition edition-${edition}`}><img src="/assets/bagas-iga-mark.webp" alt="" /><span>Guest edition {String(edition + 1).padStart(2, "0")}</span></div>
        <p>Bagas × Iga<br /><span>2026</span></p>
        <small>Made with unreasonable attention to detail<br />and approximately 1 billion tokens.</small>
        <button type="button" onClick={() => { setEntered(false); setOpening(false); scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }}>View the envelope again</button>
      </footer>
    </div>
  );
}

export function WeddingExperience(props: Props) {
  return <MotionProvider><WeddingWorld {...props} /></MotionProvider>;
}
