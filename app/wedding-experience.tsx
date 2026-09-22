"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
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

type Props = { guestName?: string; token?: string; partyLimit?: number };
type Attendance = "" | "yes" | "no";
type MotionPreferences = { reduced: boolean; precise: boolean };

const MotionContext = createContext<MotionPreferences>({ reduced: false, precise: false });

const EVENT_DATE_UTC = Date.UTC(2026, 10, 1);
const MAPS_URL = "https://maps.app.goo.gl/JFL3wrzj7qsBXbz56";

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
        <section className={`v2-day v2-scene state-${clock.state}`} id="the-day" data-light="day" aria-labelledby="day-title">
          <div className="v2-day-garden" aria-hidden="true">
            <div className="v2-day-light" />
            <BotanicalImage eager src="/assets/botanicals/combretum/canopy-branch.webp" className="day-combretum" />
            <BotanicalImage eager src="/assets/botanicals/combretum/tendril.webp" className="day-tendril" />
            <BotanicalImage eager src="/assets/botanicals/nephrolepis/frond-short-02.webp" className="day-fern" />
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

        <section className="v2-details v2-scene" id="details" data-light="afternoon" aria-labelledby="details-title">
          <div className="v2-details-architecture" aria-hidden="true">
            <div className="v2-details-window" />
            <div className="v2-details-light" />
          </div>
          <BotanicalImage src="/assets/botanicals/syzygium/branch-long.webp" className="details-syzygium" />
          <div className="v2-details-grid">
            <header className="v2-details-intro">
              <p>Wedding information</p>
              <h2 id="details-title">The<br />details.</h2>
              <span>One day, two moments, one place to find.</span>
            </header>
            <div className="v2-details-date">
              <span>Sunday</span>
              <time dateTime="2026-11-01">01 November 2026</time>
            </div>
            <div className="v2-details-schedule" aria-label="Wedding schedule">
              <article>
                <time dateTime="2026-11-01T14:00:00+07:00">14:00</time>
                <div><h3>Akad</h3><p>The official part.</p></div>
              </article>
              <article>
                <time dateTime="2026-11-01T18:00:00+07:00">18:00</time>
                <div><h3>Reception</h3><p>The louder part.</p></div>
              </article>
            </div>
            <div className="v2-details-place">
              <p>At</p>
              <h3>Pandiga <em>Cimahi</em></h3>
              <address>Jl. Sirnarasa No.11, Cibabat,<br />Kec. Cimahi Utara, Kota Cimahi,<br />Jawa Barat 40513</address>
              <a href={MAPS_URL} target="_blank" rel="noreferrer">Open in Maps <span aria-hidden="true">↗</span></a>
            </div>
            <div className="v2-details-map" aria-label="Simplified map around Pandiga Cimahi">
              <svg viewBox="0 0 540 420" role="img" aria-label="Map illustration showing Pandiga on Jalan Sirnarasa">
                <path d="M-20 92C92 80 131 135 229 119S403 27 572 58" />
                <path d="M21 374C104 301 143 264 217 249S337 254 565 171" />
                <path d="M128-15C122 97 157 156 148 247S94 358 94 444" />
                <path d="M365-28C350 91 287 142 310 227S409 315 408 452" />
                <path className="route" d="M75 335C159 270 202 259 278 236S381 186 440 137" />
                <circle cx="278" cy="236" r="12" />
                <circle cx="278" cy="236" r="26" className="map-ring" />
                <text x="298" y="226">Pandiga</text>
                <text x="48" y="327">Jl. Sirnarasa</text>
              </svg>
            </div>
          </div>
        </section>

        <section className="v2-profiles v2-scene" id="profiles" data-light="warm" aria-labelledby="profiles-title">
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
          <BotanicalImage src="/assets/botanicals/syzygium/branch-short.webp" className="gifts-syzygium" />
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
