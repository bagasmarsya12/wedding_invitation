"use client";

import { useEffect, useRef, type RefObject } from "react";
import { LandingPhoto } from "./landing-photo";

type Person = "bagas" | "iga";

/** CMS photographs take precedence over the couple's supplied, bundled loops. */
export function ProfilePortrait({ person, src, name, videoRef }: {
  person: Person; src: string | null; name: string; videoRef: RefObject<HTMLVideoElement | null>;
}) {
  if (src) return <LandingPhoto key={src} className="v2-profile-window" src={src} alt={name} initial={person === "bagas" ? "B" : "I"} />;
  return <div className="landing-photo v2-profile-window has-photo is-motion">
    <video ref={videoRef} src={`/assets/profiles/${person}-portrait-v2.mp4`}
      poster={`/assets/profiles/${person}-portrait.webp`} width={800} height={920}
      muted playsInline loop preload="none" disablePictureInPicture
      role="img" aria-label={name} data-profile-motion={person}>
      {name}
    </video>
  </div>;
}

/** Prepare nearby and play visible portraits; synchronize when both are in view. */
export function useProfileMotion(active: boolean, bagasSource: string | null, igaSource: string | null) {
  const sectionRef = useRef<HTMLElement>(null);
  const bagasRef = useRef<HTMLVideoElement>(null);
  const igaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const videos = [!bagasSource && bagasRef.current, !igaSource && igaRef.current]
      .filter((video): video is HTMLVideoElement => Boolean(video));
    if (!active || !section || !videos.length) return;
    const visible = new Set<HTMLVideoElement>();
    const prepared = new Set<HTMLVideoElement>();
    let generation = 0;
    const pending = new Set<HTMLVideoElement>();

    function synchronize() {
      const playing = videos.filter(video => visible.has(video) && !video.paused && !video.seeking);
      const leader = playing[0];
      if (!leader) return;
      for (const video of playing.slice(1)) {
        if (!video.duration) continue;
        const difference = Math.abs(video.currentTime - leader.currentTime);
        const drift = Math.min(difference, Math.abs(video.duration - difference));
        if (drift > .09) video.currentTime = leader.currentTime;
      }
    }

    function update() {
      for (const video of videos) {
        if (!visible.has(video) || document.hidden) { video.pause(); continue; }
        if (video.readyState < 3 || video.error || !video.paused || pending.has(video)) continue;
        const leader = videos.find(other => other !== video && visible.has(other) && !other.paused);
        if (leader && Math.abs(video.currentTime - leader.currentTime) > .04) video.currentTime = leader.currentTime;
        const ticket = generation;
        pending.add(video);
        void video.play().then(() => {
          if (ticket !== generation || !visible.has(video) || document.hidden) video.pause();
          else synchronize();
        }).catch(() => { /* Keep the still poster if autoplay is unavailable. */ })
          .finally(() => pending.delete(video));
      }
    }

    // Each portrait owns its visibility: narrow screens must not decode both rooms.
    const preloadObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (!entry.isIntersecting || prepared.has(video)) continue;
        prepared.add(video);
        video.preload = "auto";
        video.load();
        preloadObserver.unobserve(video);
      }
    }, { rootMargin: "250px 0px" });
    const playbackObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) visible.add(video);
        else visible.delete(video);
      }
      update();
    });
    videos.forEach(video => {
      video.addEventListener("canplay", update);
      video.addEventListener("timeupdate", synchronize);
      preloadObserver.observe(video);
      playbackObserver.observe(video);
    });
    document.addEventListener("visibilitychange", update);
    return () => {
      generation++;
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      document.removeEventListener("visibilitychange", update);
      videos.forEach(video => {
        video.pause();
        video.removeEventListener("canplay", update);
        video.removeEventListener("timeupdate", synchronize);
        if (video.readyState) video.currentTime = 0;
      });
    };
  }, [active, bagasSource, igaSource]);

  return { sectionRef, bagasRef, igaRef };
}
