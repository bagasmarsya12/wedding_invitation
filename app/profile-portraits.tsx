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
    <video ref={videoRef} src={`/assets/profiles/${person}-portrait.mp4`}
      poster={`/assets/profiles/${person}-portrait.webp`} width={800} height={920}
      muted playsInline loop preload="none" disablePictureInPicture
      role="img" aria-label={name} data-profile-motion={person}>
      {name}
    </video>
  </div>;
}

/** One playback group: prepare nearby, start together, pause outside the room. */
export function useProfileMotion(active: boolean, bagasSource: string | null, igaSource: string | null) {
  const sectionRef = useRef<HTMLElement>(null);
  const bagasRef = useRef<HTMLVideoElement>(null);
  const igaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const videos = [!bagasSource && bagasRef.current, !igaSource && igaRef.current]
      .filter((video): video is HTMLVideoElement => Boolean(video));
    if (!active || !section || !videos.length) return;
    let near = false, visible = false, prepared = false, starting = false, generation = 0;

    function pause() {
      generation++;
      starting = false;
      videos.forEach(video => video.pause());
    }

    function synchronize() {
      const leader = videos[0];
      if (leader.paused || leader.seeking) return;
      for (const video of videos.slice(1)) {
        if (!video.duration || video.seeking) continue;
        const difference = Math.abs(video.currentTime - leader.currentTime);
        const drift = Math.min(difference, Math.abs(video.duration - difference));
        if (drift > .09) video.currentTime = leader.currentTime;
      }
    }

    async function start() {
      if (!visible || document.hidden || starting || videos.some(video => video.readyState < 3 || video.error)) return;
      if (videos.every(video => !video.paused)) return;
      const ticket = ++generation;
      starting = true;
      const position = videos[0].currentTime;
      videos.forEach(video => { if (Math.abs(video.currentTime - position) > .04) video.currentTime = position; });
      const results = await Promise.allSettled(videos.map(video => video.play()));
      if (ticket !== generation) return;
      starting = false;
      if (results.some(result => result.status === "rejected")) pause();
      else synchronize();
    }

    function update() {
      if (near && !prepared) {
        prepared = true;
        videos.forEach(video => { video.preload = "auto"; video.load(); });
      }
      if (visible && !document.hidden) void start();
      else pause();
    }

    const preloadObserver = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      update();
    }, { rootMargin: "500px 0px" });
    const playbackObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    const ready = () => { void start(); };
    videos.forEach(video => {
      video.addEventListener("canplay", ready);
      video.addEventListener("waiting", pause);
      video.addEventListener("error", pause);
    });
    videos[0].addEventListener("timeupdate", synchronize);
    document.addEventListener("visibilitychange", update);
    preloadObserver.observe(section);
    playbackObserver.observe(section);
    return () => {
      pause();
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      document.removeEventListener("visibilitychange", update);
      videos[0].removeEventListener("timeupdate", synchronize);
      videos.forEach(video => {
        video.removeEventListener("canplay", ready);
        video.removeEventListener("waiting", pause);
        video.removeEventListener("error", pause);
        if (video.readyState) video.currentTime = 0;
      });
    };
  }, [active, bagasSource, igaSource]);

  return { sectionRef, bagasRef, igaRef };
}
