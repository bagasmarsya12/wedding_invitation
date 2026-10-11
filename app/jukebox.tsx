'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from './language';
import { JukeboxAudio } from '@/lib/jukebox-audio';
import { adjacentTrack, formatAudioTime, isJukeboxPage, JUKEBOX_SESSION_KEY, parseJukeboxSession, playableTracks,
  type JukeboxConfig, type JukeboxCopyKey, type PickedBy } from '@/lib/jukebox-playlist';

type IconName = 'play' | 'pause' | 'previous' | 'next' | 'close' | 'sound' | 'mute';
function Icon({ name }: { name: IconName }) {
  const shapes = {
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
    previous: <><path d="M5 5v14m14-14L8 12l11 7Z" /></>,
    next: <><path d="M19 5v14M5 5l11 7-11 7Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    sound: <><path d="M11 5 6 9H3v6h3l5 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="M11 5 6 9H3v6h3l5 4Zm5 4 5 6m0-6-5 6" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}
function JukeboxIllustration() {
  return <svg viewBox="0 0 76 96" className="jbx-object" fill="none" aria-hidden="true">
    <path d="M8 88V35a30 30 0 0 1 60 0v53Z" fill="#69745b" stroke="#23382d" strokeWidth="1.4" />
    <path d="M13 86V35a25 25 0 0 1 50 0v51Z" fill="#fbf8f1" stroke="#b08b50" strokeWidth="1.3" />
    <path d="M18 50V35a20 20 0 0 1 40 0v15Z" fill="#c4878d" stroke="#b08b50" />
    <path d="M22 48V35a16 16 0 0 1 32 0v13M27 46V35a11 11 0 0 1 22 0v11" stroke="#fbf8f1" strokeWidth="1.2" />
    <rect x="27" y="39" width="22" height="11" rx="2" fill="#23382d" stroke="#b08b50" />
    <circle className="jbx-lamp" cx="38" cy="44.5" r="2.2" fill="#c8b580" />
    <path d="M21 57h34M21 61h34" stroke="#b08b50" strokeWidth=".8" />
    <path className="jbx-line jbx-line-one" d="M22 66h12" stroke="#69745b" strokeLinecap="round" />
    <path className="jbx-line jbx-line-two" d="M42 66h12" stroke="#69745b" strokeLinecap="round" />
    <path d="M6 88h64v5H6Z" fill="#23382d" stroke="#b08b50" />
    <path d="M16 30c-4-7-3-14 2-17m-2 12c-5 0-8-3-9-7 5 0 8 3 9 7m1-6c-1-5 0-9 4-12 2 5 1 9-4 12" fill="#69745b" stroke="#b08b50" strokeWidth=".65" />
    <path d="M60 34c4-7 4-13 0-18m1 11c5-1 8-4 8-8-5 1-8 4-8 8" fill="#69745b" stroke="#b08b50" strokeWidth=".65" />
  </svg>;
}
const pickedKey: Record<PickedBy, JukeboxCopyKey> = { Bagas: 'bagas', Iga: 'iga', Ours: 'ours', 'The One': 'theOne' };

export function Jukebox({ config }: { config: JukeboxConfig }) {
  const path = usePathname(), { language } = useLanguage();
  const tracks = playableTracks(config), trackSignature = tracks.map(track => `${track.id}:${track.src}`).join('|');
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? '');
  const [expanded, setExpanded] = useState(false), [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(config.defaultVolume), [time, setTime] = useState(0), [duration, setDuration] = useState(0);
  const [covered, setCovered] = useState(true), [editing, setEditing] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false), [resumeHint, setResumeHint] = useState(false);
  const engine = useRef<JukeboxAudio | null>(null), currentId = useRef(trackId), expandedRef = useRef(expanded);
  const media = useRef<HTMLAudioElement>(null);
  const volumeRef = useRef(volume), lastVolume = useRef(config.defaultVolume || 0.3), restoreTime = useRef(0);
  const panel = useRef<HTMLElement>(null), opener = useRef<HTMLButtonElement>(null);
  const advance = useRef<() => void>(() => {}), lastSaved = useRef(0);
  const allowed = isJukeboxPage(path), index = Math.max(0, tracks.findIndex(track => track.id === trackId));
  const track = tracks[index];
  const copy = (key: JukeboxCopyKey) => config.copy[key][language];
  const save = () => {
    const player = engine.current;
    if (!player) return;
    try { sessionStorage.setItem(JUKEBOX_SESSION_KEY, JSON.stringify({ trackId: currentId.current,
      time: player.audio.src ? player.audio.currentTime : restoreTime.current, volume: volumeRef.current, wantedPlaying: player.wantedPlaying })); }
    catch { /* Session storage is optional. */ }
  };
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);
  useEffect(() => {
    if (!tracks.length) return;
    const audio = media.current;
    if (!audio) return;
    const player = new JukeboxAudio(audio, config.defaultVolume);
    engine.current = player;
    let stored = null;
    try { stored = sessionStorage.getItem(JUKEBOX_SESSION_KEY); } catch { /* Private mode. */ }
    const session = parseJukeboxSession(stored, tracks, config.defaultVolume);
    currentId.current = session.trackId; volumeRef.current = session.volume; restoreTime.current = session.time;
    lastVolume.current = session.volume || config.defaultVolume || 0.3;
    player.setVolume(session.volume);
    setTrackId(session.trackId); setVolume(session.volume); setTime(session.time); setResumeHint(session.wantedPlaying);
    const onPlay = () => { setPlaying(true); setLoading(false); setHasPlayed(true); setResumeHint(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => { if (player.wantedPlaying) setLoading(true); };
    const onReady = () => setLoading(false);
    const onError = () => { player.stop(); setFailed(true); setLoading(false); setPlaying(false); };
    const onMetadata = () => {
      const length = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(length);
      if (restoreTime.current) {
        audio.currentTime = Math.min(restoreTime.current, Math.max(0, length - 0.05));
        restoreTime.current = 0;
      }
    };
    const onTime = () => {
      if (expandedRef.current) setTime(audio.currentTime);
      if (Date.now() - lastSaved.current > 2000) { lastSaved.current = Date.now(); save(); }
    };
    const onEnded = () => advance.current();
    audio.addEventListener('play', onPlay); audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting); audio.addEventListener('canplay', onReady);
    audio.addEventListener('error', onError); audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('timeupdate', onTime); audio.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', save);
    const onHidden = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      save(); audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting); audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('error', onError); audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', onHidden);
      player.destroy(); engine.current = null;
    };
    // Only rebuild when actual audio sources change, not on language/panel changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackSignature]);
  useEffect(() => {
    const inspect = () => setCovered(!!document.querySelector('.v2-world.is-locked, [aria-modal="true"]'));
    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-modal'] });
    const focus = () => setEditing(document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('.jbx') && !!document.activeElement.closest('input,textarea,select,[contenteditable="true"]'));
    document.addEventListener('focusin', focus); document.addEventListener('focusout', focus);
    return () => { observer.disconnect(); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', focus); };
  }, [path]);
  useEffect(() => { if (!allowed) { engine.current?.stop(); setExpanded(false); } }, [allowed]);
  useEffect(() => {
    if (!expanded || covered || editing) return;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [expanded, covered, editing]);
  function close() { setExpanded(false); opener.current?.focus({ preventScroll: true }); }
  async function toggle() {
    const player = engine.current;
    if (!player || !track) return;
    setFailed(false);
    if (player.wantedPlaying) { setPlaying(false); await player.pause(); save(); return; }
    setLoading(true);
    try {
      if (!player.audio.getAttribute('src')) { player.audio.src = track.src; player.audio.load(); }
      await player.play(); save();
    } catch { setFailed(true); setLoading(false); }
  }
  async function choose(next: number, shouldPlay: boolean) {
    const player = engine.current, selected = tracks[next];
    if (!player || !selected) return;
    currentId.current = selected.id; restoreTime.current = 0;
    setTrackId(selected.id); setTime(0); setDuration(selected.duration); setFailed(false); setLoading(shouldPlay);
    try { await player.select(selected.src, shouldPlay); save(); }
    catch { setFailed(true); setLoading(false); }
  }
  advance.current = () => {
    const next = adjacentTrack(index, tracks.length, 1, config.loop);
    if (next !== null) void choose(next, true);
    else { engine.current?.stop(); setPlaying(false); save(); }
  };
  function step(direction: number) {
    const next = adjacentTrack(index, tracks.length, direction, config.loop);
    if (next !== null) void choose(next, engine.current?.wantedPlaying ?? false);
  }
  function adjustVolume(value: number) {
    if (value > 0) lastVolume.current = value;
    volumeRef.current = value; setVolume(value); engine.current?.setVolume(value); save();
  }
  function seek(value: number) {
    setTime(value);
    if (engine.current?.audio.getAttribute('src') && engine.current.audio.readyState >= 1) engine.current.audio.currentTime = value;
    else restoreTime.current = value;
    save();
  }
  if (!track || !allowed) return null;
  const length = duration || track.duration;
  const hidden = covered || editing;
  return <aside className={`jbx${playing ? ' is-playing' : ''}${expanded ? ' is-expanded' : ''}`} data-available="true" hidden={hidden} aria-label={copy('title')}>
    <audio ref={media} preload="none" hidden aria-hidden="true" />
    <section className="jbx-panel" id="our-jukebox-panel" ref={panel} aria-labelledby="our-jukebox-title" hidden={!expanded}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <header className="jbx-heading"><div><h2 id="our-jukebox-title">{copy('title')}</h2><p>{copy('description')}</p></div>
        <button type="button" className="jbx-icon-button" aria-label={copy('close')} onClick={close}><Icon name="close" /></button></header>
      <div className="jbx-now"><div className="jbx-artwork">{track.artwork ? <img src={track.artwork} alt="" loading="lazy" width="48" height="58" /> : <span aria-hidden="true">I<span>&</span>B</span>}</div>
        <div><small>{copy('nowPlaying')}</small><p className="jbx-track-title" aria-live="polite" aria-atomic="true">{track.title}</p><p className="jbx-artist">{track.artist}</p>
          <span className="jbx-picked">{copy(pickedKey[track.pickedBy])}</span></div></div>
      {track.note[language] && <p className="jbx-note">{track.note[language]}</p>}
      <div className="jbx-seek"><input aria-label={copy('seek')} aria-valuetext={`${formatAudioTime(time)} / ${formatAudioTime(length)}`} type="range" min="0" max={length || 1} step="0.1" value={Math.min(time, length || 1)} disabled={!length} onChange={event => seek(Number(event.target.value))} />
        <div aria-hidden="true"><time>{formatAudioTime(time)}</time><time>{formatAudioTime(length)}</time></div></div>
      <div className="jbx-controls"><div className="jbx-transport">
        <button type="button" className="jbx-icon-button" aria-label={copy('previous')} disabled={adjacentTrack(index, tracks.length, -1, config.loop) === null} onClick={() => step(-1)}><Icon name="previous" /></button>
        <button type="button" className="jbx-play-main" aria-label={copy(playing ? 'pause' : 'play')} aria-pressed={playing} onClick={() => void toggle()}><Icon name={playing ? 'pause' : 'play'} /></button>
        <button type="button" className="jbx-icon-button" aria-label={copy('next')} disabled={adjacentTrack(index, tracks.length, 1, config.loop) === null} onClick={() => step(1)}><Icon name="next" /></button></div>
        <div className="jbx-volume"><button type="button" className="jbx-icon-button" aria-label={copy(volume ? 'mute' : 'unmute')} onClick={() => adjustVolume(volume ? 0 : lastVolume.current)}><Icon name={volume ? 'sound' : 'mute'} /></button>
          <input aria-label={copy('volume')} aria-valuetext={`${Math.round(volume * 100)}%`} type="range" min="0" max="1" step="0.01" value={volume} onChange={event => adjustVolume(Number(event.target.value))} /></div></div>
      <p className="jbx-status" role="status">{failed ? copy('unavailable') : loading ? copy('loading') : ''}</p>
      <ol className="jbx-playlist" aria-label={copy('playlist')}>
        {tracks.map((item, number) => <li key={item.id}><button type="button" aria-label={`${copy('select')}: ${item.title} — ${item.artist}`} aria-current={item.id === track.id ? 'true' : undefined} onClick={() => void choose(number, true)}>
          <span className="jbx-number" aria-hidden="true">{String(number + 1).padStart(2, '0')}</span><span className="jbx-song"><strong>{item.title}</strong><small>{item.artist}</small></span>
          <span className="jbx-track-marker" aria-hidden="true">{item.id === track.id && playing ? <Icon name="pause" /> : <Icon name="play" />}</span></button></li>)}
      </ol>
    </section>
    {!expanded && !hasPlayed && <span className="jbx-hint">{copy(resumeHint ? 'resumeHint' : 'hint')}</span>}
    <div className="jbx-mini"><button type="button" ref={opener} className="jbx-expand" aria-label={copy(expanded ? 'close' : 'open')} aria-controls="our-jukebox-panel" aria-expanded={expanded} onClick={() => {
      if (expanded) close(); else { setTime(engine.current?.audio.getAttribute('src') ? engine.current.audio.currentTime : restoreTime.current); setExpanded(true); }
    }}><JukeboxIllustration /></button>
      <button type="button" className="jbx-mini-play" aria-label={copy(playing ? 'pause' : 'play')} aria-pressed={playing} onClick={() => void toggle()}><Icon name={playing ? 'pause' : 'play'} /></button></div>
  </aside>;
}
