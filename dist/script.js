const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const gate = document.querySelector("#invitation-gate");
const enter = document.querySelector("#enter-garden");
const skip = document.querySelector("#skip-opening");
const replay = document.querySelector("#replay-opening");
const heroTitle = document.querySelector("#hero-title");
const main = document.querySelector("main");
const header = document.querySelector(".site-header");
const skipLink = document.querySelector(".skip-link");
const animations = [];
let finishTimer;
let running = false;
let isOpen = false;

const params = new URLSearchParams(location.search);
const suppliedName = (params.get("to") || params.get("guest") || params.get("name") || "")
  .replace(/[\u0000-\u001f\u007f]/g, "").trim();
const guestLabel = document.querySelector("#guest-greeting");
guestLabel.textContent = suppliedName || "Tamu Spesial Kami";
if (!suppliedName) document.querySelector("#guest-salutation").textContent = "Teruntuk";
if (suppliedName.length > 35) gate.classList.add("guest-long");
if (suppliedName) document.querySelector("#guest-name").value = suppliedName;

const countdownTarget = new Date("2026-11-01T14:00:00+07:00").getTime();
function updateCountdown() {
  const remaining = Math.max(0, countdownTarget - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor(remaining / 3600000) % 24;
  const minutes = Math.floor(remaining / 60000) % 60;
  const values = { days, hours, minutes };
  Object.entries(values).forEach(([unit, value]) => {
    const element = document.querySelector(`#countdown-${unit}`);
    if (element) element.textContent = new Intl.NumberFormat("id-ID", { minimumIntegerDigits: unit === "days" ? 1 : 2 }).format(value);
  });
}
updateCountdown();
window.setInterval(updateCountdown, 60000);

function animate(element, frames, duration, delay = 0, easing = "cubic-bezier(.22,.72,.18,1)") {
  if (!element) return;
  const animation = element.animate(frames, { duration, delay, easing, fill: "both" });
  animations.push(animation);
  return animation;
}
function stopAnimations() {
  clearTimeout(finishTimer);
  animations.splice(0).forEach(animation => animation.cancel());
}
function finishOpening() {
  if (isOpen) return;
  isOpen = true;
  running = false;
  gate.hidden = true;
  stopAnimations();
  gate.querySelector(".flight-particles").replaceChildren();
  gate.querySelector(".threshold-scene").classList.remove("threshold-transform-mode");
  gate.querySelector(".garden-threshold").replaceChildren();
  gate.querySelector(".opening-status").textContent = "";
  main.inert = false;
  header.inert = false;
  skipLink.inert = false;
  document.body.classList.remove("invitation-active");
  document.body.classList.add("garden-entered");
  replay.hidden = false;
  heroTitle.focus({ preventScroll: true });
}
function showInvitation() {
  stopAnimations();
  isOpen = false;
  running = false;
  enter.disabled = false;
  gate.hidden = false;
  gate.dataset.state = "ready";
  gate.querySelector(".flight-particles").replaceChildren();
  document.body.classList.add("invitation-active");
  document.body.classList.remove("garden-entered");
  main.inert = true;
  header.inert = true;
  skipLink.inert = true;
  window.scrollTo({ top: 0, behavior: "instant" });
  enter.focus({ preventScroll: true });
}
function emitPetals() {
  const host = gate.querySelector(".flight-particles");
  const count = innerWidth < 760 ? 8 : 12;
  for (let i = 0; i < count; i++) {
    const petal = document.createElement("img");
    petal.src = i % 3 === 0 ? "assets/10-dried-leaf.webp" : "assets/09-falling-petal.webp";
    petal.alt = "";
    petal.style.setProperty("--size", (14 + (i * 11 % 22)) + "px");
    host.append(petal);
    const angle = i / count * Math.PI * 2 + .2;
    const x = Math.cos(angle) * innerWidth * (.55 + i % 3 * .08);
    const y = Math.sin(angle) * innerHeight * .65;
    const turn = (i % 2 ? -1 : 1) * (100 + i * 19);
    animate(petal, [
      { opacity:0, transform:"translate(-50%, -50%) scale(.2) rotate(0deg)", offset:0 },
      { opacity:.4, transform:`translate(${x * .22}px,${y * .18}px) scale(.65) rotate(${turn * .35}deg)`, offset:.28 },
      { opacity:0, transform:`translate(${x}px,${y}px) scale(1.5) rotate(${turn}deg)`, offset:1 }
    ], 1100 + i % 4 * 55, 4100 + i % 5 * 45, "cubic-bezier(.12,.52,.28,1)");
  }
}
function openGarden() {
  if (running || isOpen) return;
  if (reducedMotion.matches || typeof Element.prototype.animate !== "function") {
    finishOpening();
    return;
  }
  running = true;
  gate.dataset.state = "opening";
  enter.disabled = true;
  skip.focus({ preventScroll:true });
  gate.querySelector(".opening-status").textContent = "Undangan terbuka. Selamat datang di taman kami.";
  const q = selector => gate.querySelector(selector);
  // One clock. The pocket occludes the insert until it has cleared the opening.
  try {
    animate(q(".invitation-seal"), [
      { transform:"rotate(8deg) translateZ(0) scale(1)", opacity:1, offset:0 },
      { transform:"rotate(5deg) translate3d(0,-2px,0) scale(.94)", opacity:1, offset:.2 },
      { transform:"rotate(-5deg) translate3d(5px,-9px,16px) scale(1.02)", opacity:1, offset:.62 },
      { transform:"rotate(-18deg) translate3d(24px,32px,30px) scale(.92)", opacity:0, offset:1 }
    ], 980, 80, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".sleeve-cover"), [
      { transform:"rotateX(0deg) translate3d(0,0,0)", offset:0 },
      { transform:"rotateX(-18deg) translate3d(0,-1px,2px)", offset:.22 },
      { transform:"rotateX(-116deg) translate3d(0,-3px,4px)", offset:.7 },
      { transform:"rotateX(-165deg) translate3d(0,-2px,0)", offset:1 }
    ], 1480, 420, "cubic-bezier(.2,.72,.16,1)");
    animate(q(".letter"), [
      { transform:"translate3d(0,0,0) rotate(0deg) scale(1)", offset:0 },
      { transform:"translate3d(0,-6%,0) rotate(.25deg) scale(1.004)", offset:.22 },
      { transform:"translate3d(0,-27%,0) rotate(.72deg) scale(1.02)", offset:.68 },
      { transform:"translate3d(0,-40%,0) rotate(1deg) scale(1.06)", offset:1 }
    ], 1740, 900, "cubic-bezier(.2,.72,.16,1)");
    animate(q(".letter-address"), [
      { transform:"translate3d(0,0,0) rotateX(0deg)", opacity:1, offset:0 },
      { transform:"translate3d(0,-3px,0) rotateX(-3deg)", opacity:.96, offset:.45 },
      { transform:"translate3d(0,-18px,0) rotateX(-10deg)", opacity:0, offset:1 }
    ], 680, 2020, "cubic-bezier(.2,.72,.16,1)");
    animate(q(".wing-left"), [
      {transform:"perspective(800px) rotateY(0deg) translateX(0)", opacity:1, offset:0},
      {transform:"perspective(800px) rotateY(-28deg) translateX(-6px)", opacity:1, offset:.28},
      {transform:"perspective(800px) rotateY(-72deg) translateX(-16px)", opacity:.42, offset:.68},
      {transform:"perspective(800px) rotateY(-100deg) translateX(-26px)", opacity:0, offset:1}
    ], 1080, 2020, "cubic-bezier(.2,.72,.16,1)");
    animate(q(".wing-right"), [
      {transform:"perspective(800px) rotateY(0deg) translateX(0)", opacity:1, offset:0},
      {transform:"perspective(800px) rotateY(28deg) translateX(6px)", opacity:1, offset:.28},
      {transform:"perspective(800px) rotateY(72deg) translateX(16px)", opacity:.42, offset:.68},
      {transform:"perspective(800px) rotateY(100deg) translateX(26px)", opacity:0, offset:1}
    ], 1080, 2110, "cubic-bezier(.2,.72,.16,1)");
    // Keep the botanical composition on one compositor layer. Individual plant
    // transforms caused frame drops while the paper was unfolding on mobile.
    animate(q(".miniature-world"), [
      {transform:"translate3d(0,8px,0) scale(.985)", opacity:.72},
      {transform:"translate3d(0,0,0) scale(1)", opacity:1}
    ], 1120, 1900, "cubic-bezier(.2,.72,.16,1)");
    animate(q(".miniature-light"), [{opacity:.1},{opacity:1}], 720, 2250);
    // The half-second reveal breath gives the miniature garden time to register.
    animate(q(".invitation-object"), [
      {transform:"rotate(-3deg) scale(1)", offset:0},
      {transform:"translateY(8%) rotate(0deg) scale(1.04)", offset:.54},
      {transform:"translateY(8%) rotate(0deg) scale(1.08)", offset:1}
    ], 1700, 2400, "cubic-bezier(.22,.72,.18,1)");
    // The little green world appears as a quiet panel before it opens into the viewport.
    const thresholdScene = q(".threshold-scene");
    const boxClip = getComputedStyle(thresholdScene).clipPath;
    if (innerWidth > 760) {
      const frame = q(".invitation-perspective").getBoundingClientRect();
      const scaleX = frame.width / innerWidth;
      const scaleY = frame.height / innerHeight;
      thresholdScene.classList.add("threshold-transform-mode");
      animate(thresholdScene, [
        {transform:`translate3d(0,0,0) scale(${scaleX},${scaleY})`, opacity:0, offset:0},
        {transform:`translate3d(0,0,0) scale(${scaleX},${scaleY})`, opacity:1, offset:.19},
        {transform:"translate3d(0,0,0) scale(1,1)", opacity:1, offset:.79},
        {transform:"translate3d(0,0,0) scale(1,1)", opacity:0, offset:1}
      ], 3100, 2550, "cubic-bezier(.22,.72,.18,1)");
    } else {
      animate(thresholdScene, [
        {clipPath:boxClip, opacity:0, offset:0},
        {clipPath:boxClip, opacity:1, offset:.19},
        {clipPath:"inset(0% 0% 0% 0% round 0px)", opacity:1, offset:.79},
        {clipPath:"inset(0% 0% 0% 0% round 0px)", opacity:0, offset:1}
      ], 3100, 2550, "cubic-bezier(.22,.72,.18,1)");
    }
    animate(q(".letter-garden"), [{opacity:1},{opacity:0}], 700, 2550, "cubic-bezier(.22,.72,.18,1)");
    // Let the paper settle behind the green panel instead of flying toward the camera.
    [q(".sleeve-back"), q(".sleeve-pocket")].forEach(el => animate(el, [
      {transform:"translateY(0)", opacity:1},
      {transform:"translateY(120%)", opacity:0}
    ], 620, 3150));
    // The wings own their opacity. Animating it again here made them reappear
    // for a frame because delayed WAAPI animations apply their first keyframe.
    animate(q(".sleeve-cover"), [{opacity:1},{opacity:0}], 620, 3230);
    animate(q(".invitation-object"), [{opacity:1},{opacity:0}], 500, 3300, "ease-in-out");
    animate(q(".invitation-backdrop"), [{opacity:1},{opacity:0}], 1100, 3400);
    gate.querySelectorAll(".invitation-corner").forEach(el => {
      const restingOpacity = Number.parseFloat(getComputedStyle(el).opacity);
      animate(el,[{opacity:restingOpacity},{opacity:0}],850,3200);
    });
    [q(".invitation-action"), q(".invitation-dateline")].forEach(el=>animate(el,[{opacity:1},{opacity:0}],350,100));
    animate(document.querySelector(".garden-center"), [
      {opacity:0,transform:"translateY(16px)"},
      {opacity:1,transform:"translateY(0)"}
    ], 1250, 4300);
    animate(document.querySelector(".garden-bottom"), [{opacity:0},{opacity:1}],600,4900);
    emitPetals();
    finishTimer = window.setTimeout(finishOpening, 5650);
  } catch {
    finishOpening();
  }
}
enter.addEventListener("click", openGarden);
skip.addEventListener("click", finishOpening);
replay.addEventListener("click", showInvitation);
gate.addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); finishOpening(); }
  if (event.key === "Tab") {
    const focusable = [enter,skip].filter(el => !el.disabled);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
reducedMotion.addEventListener("change", () => { if (running) finishOpening(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && running) finishOpening(); });

// The greeting and main invitation remain available without animation assets.
showInvitation();
const fireflies = document.querySelector(".garden-fireflies");
for(let i=0;i<15;i++) {
  const dot=document.createElement("i");
  dot.style.cssText = `left:${8+i*37%86}%;top:${15+i*23%70}%;--period:${4+i%4}s;--delay:-${i%5}s`;
  fireflies.append(dot);
}

const progressBar = document.querySelector(".scroll-progress span");
const parallaxItems = [...document.querySelectorAll("[data-parallax]")];
const activeParallaxItems = new Set();
let scrollFrame = 0;

function renderPageMotion() {
  scrollFrame = 0;
  const scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const scrollProgress = Math.min(1, Math.max(0, scrollY / scrollRange));
  if (progressBar) progressBar.style.transform = `scaleX(${scrollProgress})`;

  if (!reducedMotion.matches) {
    activeParallaxItems.forEach(element => {
      const bounds = element.parentElement.getBoundingClientRect();
      const distanceFromCenter = bounds.top + bounds.height / 2 - innerHeight / 2;
      const speed = Number.parseFloat(element.dataset.parallax || "0.04");
      const shift = Math.max(-46, Math.min(46, -distanceFromCenter * speed));
      element.style.translate = `0 ${shift.toFixed(2)}px`;
    });
  }
}

function requestPageMotion() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(renderPageMotion);
}

addEventListener("scroll", requestPageMotion, { passive:true });
addEventListener("resize", requestPageMotion, { passive:true });
renderPageMotion();

if (!reducedMotion.matches && "IntersectionObserver" in window) {
  const parallaxObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) activeParallaxItems.add(entry.target);
      else activeParallaxItems.delete(entry.target);
    });
    requestPageMotion();
  }, { rootMargin:"20% 0px 20%" });
  parallaxItems.forEach(element => parallaxObserver.observe(element));
}

if (!reducedMotion.matches && matchMedia("(hover:hover) and (pointer:fine)").matches) {
  const hero = document.querySelector(".garden-hero");
  const heroPlants = [...hero.querySelectorAll(".garden-world .garden-plant")];
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function renderPointerMotion() {
    pointerFrame = 0;
    hero.style.setProperty("--pointer-x", `${50 + pointerX * 16}%`);
    hero.style.setProperty("--pointer-y", `${44 + pointerY * 12}%`);
    heroPlants.forEach((plant, index) => {
      const depth = 2.5 + index * 0.7;
      plant.style.translate = `${(pointerX * depth).toFixed(2)}px ${(pointerY * depth).toFixed(2)}px`;
    });
  }

  hero.addEventListener("pointermove", event => {
    const bounds = hero.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
    pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(renderPointerMotion);
  }, { passive:true });

  hero.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
    if (!pointerFrame) pointerFrame = requestAnimationFrame(renderPointerMotion);
  });
}

if (!reducedMotion.matches && "IntersectionObserver" in window) {
  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver(entries => entries.forEach(entry=>{
    if(entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
  }), {threshold:.1});
  document.querySelectorAll("[data-reveal], .botanical-reveal").forEach(el=>observer.observe(el));
}
const form=document.querySelector("#rsvp-form");
const status=document.querySelector("#form-status");
if(form && status) form.addEventListener("submit",event=>{
  event.preventDefault();
  if(form.reportValidity()) status.textContent="Preview selesai. Jawabanmu belum disimpan.";
});
