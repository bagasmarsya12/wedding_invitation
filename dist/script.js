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
function openGarden() {
  if (running || isOpen) return;
  if (reducedMotion.matches || typeof Element.prototype.animate !== "function") {
    finishOpening();
    return;
  }
  running = true;
  gate.dataset.state = "opening";
  enter.disabled = true;
  replay.hidden = false;
  skip.focus({ preventScroll:true });
  gate.querySelector(".opening-status").textContent = "Undangan terbuka. Selamat datang di taman kami.";
  const q = selector => gate.querySelector(selector);
  try {
    // Two endpoints per gesture: continuous acceleration, no internal velocity
    // corners. Paper and camera overlap rather than stopping between scenes.
    const paperEase = "cubic-bezier(.42,0,.24,1)";
    animate(q(".invitation-seal"), [
      { transform:"translate3d(0,0,0) rotate(8deg) scale(1)", opacity:1 },
      { transform:"translate3d(8px,18px,0) rotate(15deg) scale(.98)", opacity:0 }
    ], 650, 0, paperEase);
    gate.querySelectorAll(".sleeve-cover").forEach(cover => animate(cover, [
      { transform:"rotateX(0deg)" },
      { transform:"rotateX(-158deg)" }
    ], 1500, 200, paperEase));
    animate(q(".letter"), [
      { transform:"translate3d(0,0,0) rotate(0deg)" },
      { transform:"translate3d(0,-24%,0) rotate(1.4deg)" }
    ], 2450, 700, paperEase);
    animate(q(".invitation-object"), [
      { transform:"translate3d(0,0,0) rotate(-3deg) scale(1)" },
      { transform:"translate3d(0,5%,0) rotate(-1deg) scale(1.025)" }
    ], 3000, 450, paperEase);

    // Reveal the actual homepage, not a differently composed intermediate
    // rectangle. One foreground fade retains the paper's spatial relationships.
    [q(".invitation-action"), q(".invitation-dateline")].forEach(element =>
      animate(element, [{opacity:1},{opacity:0}], 550, 0, "ease-in-out"));
    animate(q(".invitation-perspective"), [
      { opacity:1 }, { opacity:0 }
    ], 1250, 1750, "cubic-bezier(.42,0,.58,1)");
    animate(q(".invitation-backdrop"), [
      { opacity:1 }, { opacity:0 }
    ], 2150, 1950, "cubic-bezier(.42,0,.58,1)");
    gate.querySelectorAll(".invitation-corner").forEach(element =>
      animate(element, [
        {opacity:Number.parseFloat(getComputedStyle(element).opacity)},
        {opacity:0}
      ], 1500, 1900, "ease-in-out"));
    animate(document.querySelector(".garden-center"), [
      {opacity:0, transform:"translate3d(0,10px,0)"},
      {opacity:1, transform:"translate3d(0,0,0)"}
    ], 1300, 3300, paperEase);
    animate(document.querySelector(".garden-bottom"), [
      {opacity:0}, {opacity:1}
    ], 1000, 3600, "ease-in-out");
    animate(header, [
      {opacity:0, visibility:"visible"}, {opacity:1, visibility:"visible"}
    ], 1100, 3500, "ease-in-out");
    animate(skip, [{opacity:1},{opacity:0}], 500, 4100, "ease-in-out");

    // Start every track on the same document clock. Completion follows the
    // browser's animation clock, including slow frames, rather than a timeout.
    const opening = animations.slice();
    const startTime = document.timeline.currentTime;
    opening.forEach(animation => { animation.startTime = startTime; });
    Promise.all(opening.map(animation => animation.finished))
      .then(() => { if (running) finishOpening(); })
      .catch(() => { /* Skip/replay cancels the previous opening intentionally. */ });
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
