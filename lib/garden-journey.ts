import { heroPassage } from "./hero-passage";
import { destinationLightShift } from "./destination-light";

/** Scroll the document normally; only scenery and selected objects have inertia. */
export function mountGardenJourney(root: HTMLElement): () => void {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-garden-depth]"));
  let bounds: { node: HTMLElement; top: number; height: number; depth: number }[] = [];
  let frame = 0, measureFrame = 0, previous = 0, position = scrollY, disposed = false;
  const hero = root.querySelector<HTMLElement>("#the-day");
  const destination = root.querySelector<HTMLElement>("#details");
  const gifts = root.querySelector<HTMLElement>("#gifts");
  const closing = root.closest(".v2-world")?.querySelector<HTMLElement>(".v2-closing");
  let heroBounds = { top: 0, height: 1 };
  let destinationBounds = { top: 0, height: 1 };
  let giftBounds = { top: 0, height: 1 };
  let closingBounds = { top: 0, height: 1 };
  const profiles = Array.from(root.querySelectorAll<HTMLElement>("#profiles .v2-person"));
  let profileBounds: { node: HTMLElement; top: number; height: number }[] = [];
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));

  function measure() {
    if (hero) {
      const rect = hero.getBoundingClientRect();
      heroBounds = { top: rect.top + scrollY, height: rect.height };
    }
    if (destination) {
      const rect = destination.getBoundingClientRect();
      destinationBounds = { top: rect.top + scrollY, height: rect.height };
    }
    if (gifts) {
      const rect = gifts.getBoundingClientRect();
      giftBounds = { top: rect.top + scrollY, height: rect.height };
    }
    if (closing) {
      const rect = closing.getBoundingClientRect();
      closingBounds = { top: rect.top + scrollY, height: rect.height };
    }
    profileBounds = profiles.map(node => {
      const rect = node.getBoundingClientRect();
      return { node, top: rect.top + scrollY, height: rect.height };
    });
    bounds = items.map(node => {
      // Measure the static containing scene, never our own animated bounds.
      const scene = node.closest(".v2-scene") as HTMLElement;
      const rect = scene.getBoundingClientRect();
      return { node, top: rect.top + scrollY, height: rect.height, depth: Number(node.dataset.gardenDepth) || 0 };
    });
    schedule();
  }
  function draw(now: number) {
    frame = 0;
    if (disposed || document.hidden || media.matches) return;
    const dt = Math.min(64, now - (previous || now - 16));
    previous = now;
    position += (scrollY - position) * (1 - Math.exp(-dt / 145));
    if (hero && heroBounds.top + heroBounds.height > scrollY - innerHeight * .3) {
      const passage = heroPassage(position, heroBounds.top, heroBounds.height);
      hero.style.setProperty("--hero-passage", passage.toFixed(4));
      hero.style.setProperty("--hero-light-x", `${(passage * 90).toFixed(2)}px`);
    }
    const mobile = innerWidth < 721;
    if (closing && closingBounds.top < scrollY + innerHeight * 1.3 && closingBounds.top + closingBounds.height > scrollY - innerHeight * .3) {
      const shift = destinationLightShift(position, closingBounds.top, closingBounds.height, innerHeight, mobile);
      closing.style.setProperty("--closing-light-shift", `${shift.toFixed(3)}px`);
    }
    if (gifts && giftBounds.top < scrollY + innerHeight * 1.3 && giftBounds.top + giftBounds.height > scrollY - innerHeight * .3) {
      const shift = destinationLightShift(position, giftBounds.top, giftBounds.height, innerHeight, mobile);
      gifts.style.setProperty("--gift-light-shift", `${shift.toFixed(3)}px`);
    }
    if (destination && destinationBounds.top < scrollY + innerHeight * 1.3 && destinationBounds.top + destinationBounds.height > scrollY - innerHeight * .3) {
      const shift = destinationLightShift(position, destinationBounds.top, destinationBounds.height, innerHeight, mobile);
      destination.style.setProperty("--destination-light-shift", `${shift.toFixed(3)}px`);
    }
    for (const item of profileBounds) {
      if (item.top > scrollY + innerHeight * 1.3 || item.top + item.height < scrollY - innerHeight * .3) continue;
      const light = destinationLightShift(position, item.top, item.height, innerHeight, mobile) * .75;
      item.node.style.setProperty("--profile-light-shift", `${light.toFixed(3)}px`);
    }
    for (const item of bounds) {
      if (item.top > scrollY + innerHeight * 1.3 || item.top + item.height < scrollY - innerHeight * .3) continue;
      const progress = clamp((position + innerHeight * .5 - item.top - item.height * .5) / ((innerHeight + item.height) * .5));
      item.node.style.setProperty("--journey-y", `${(progress * item.depth * (mobile ? .4 : 1)).toFixed(2)}px`);
      item.node.style.setProperty("--journey-scale", (1 + Math.abs(progress) * Math.abs(item.depth) * .00065).toFixed(4));
    }
    if (Math.abs(scrollY - position) > .15) schedule();
  }
  function schedule() {
    if (!frame && !disposed && !media.matches && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function resize() {
    cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(measure);
  }
  function reset() {
    cancelAnimationFrame(frame); frame = 0; previous = 0; position = scrollY;
    if (media.matches) {
      hero?.style.setProperty("--hero-passage", "0");
      hero?.style.removeProperty("--hero-light-x");
      destination?.style.removeProperty("--destination-light-shift");
      gifts?.style.removeProperty("--gift-light-shift");
      closing?.style.removeProperty("--closing-light-shift");
      profiles.forEach(node => node.style.removeProperty("--profile-light-shift"));
      items.forEach(node => {
      node.style.removeProperty("--journey-y"); node.style.removeProperty("--journey-scale");
      });
    }
    else schedule();
  }
  const observer = new ResizeObserver(resize);
  root.querySelectorAll(".v2-scene").forEach(node => observer.observe(node));
  if (closing) observer.observe(closing);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", resize, { passive: true });
  addEventListener("wedding-language-change", resize);
  document.addEventListener("visibilitychange", reset);
  media.addEventListener("change", reset);
  measure();
  return () => {
    disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(measureFrame); observer.disconnect();
    removeEventListener("scroll", schedule); removeEventListener("resize", resize);
    removeEventListener("wedding-language-change", resize);
    document.removeEventListener("visibilitychange", reset); media.removeEventListener("change", reset);
    items.forEach(node => { node.style.removeProperty("--journey-y"); node.style.removeProperty("--journey-scale"); });
    hero?.style.removeProperty("--hero-passage"); hero?.style.removeProperty("--hero-light-x");
    destination?.style.removeProperty("--destination-light-shift");
    gifts?.style.removeProperty("--gift-light-shift");
    closing?.style.removeProperty("--closing-light-shift");
    profiles.forEach(node => node.style.removeProperty("--profile-light-shift"));
  };
}
