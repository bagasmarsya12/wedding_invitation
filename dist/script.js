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
  const count = innerWidth < 760 ? 14 : 24;
  for (let i = 0; i < count; i++) {
    const petal = document.createElement("img");
    petal.src = i % 3 === 0 ? "assets/10-dried-leaf.webp" : "assets/09-falling-petal.webp";
    petal.alt = "";
    petal.style.setProperty("--size", (18 + (i * 13 % 34)) + "px");
    host.append(petal);
    const angle = i / count * Math.PI * 2 + .2;
    const x = Math.cos(angle) * innerWidth * (.55 + i % 3 * .08);
    const y = Math.sin(angle) * innerHeight * .65;
    const turn = (i % 2 ? -1 : 1) * (100 + i * 19);
    animate(petal, [
      { opacity:0, transform:"translate(-50%, -50%) scale(.2) rotate(0deg)", offset:0 },
      { opacity:.85, transform:`translate(${x * .28}px,${y * .23}px) scale(.65) rotate(${turn * .35}deg)`, offset:.28 },
      { opacity:0, transform:`translate(${x}px,${y}px) scale(1.5) rotate(${turn}deg)`, offset:1 }
    ], 1800 + i % 4 * 90, 2700 + i % 5 * 45, "cubic-bezier(.12,.52,.28,1)");
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
      { transform:"rotate(8deg) translateZ(0) scale(.94)", opacity:1, offset:.18 },
      { transform:"rotate(-14deg) translate3d(14px,-20px,60px) scale(1.08)", opacity:1, offset:.62 },
      { transform:"rotate(-38deg) translate3d(85px,150px,120px) scale(.85)", opacity:0, offset:1 }
    ], 740);
    animate(q(".sleeve-cover"), [
      { transform:"rotateX(0deg)", filter:"brightness(1)" },
      { transform:"rotateX(-165deg)", filter:"brightness(.88)" }
    ], 900, 360);
    animate(q(".letter"), [
      { transform:"translateY(0) rotate(0) scale(1)", zIndex:1, offset:0 },
      { transform:"translateY(-43%) rotate(2deg) scale(1)", zIndex:1, offset:.62 },
      { transform:"translateY(-43%) rotate(3deg) scale(1.18)", zIndex:8, offset:1 }
    ], 1250, 820);
    animate(q(".letter-address"), [
      { transform:"perspective(900px) rotateY(0deg)", opacity:1 },
      { transform:"perspective(900px) rotateY(-125deg)", opacity:0 }
    ], 880, 1620);
    animate(q(".wing-left"), [{transform:"rotateY(0deg)"},{transform:"perspective(800px) rotateY(-135deg)"}], 900, 1700);
    animate(q(".wing-right"), [{transform:"rotateY(0deg)"},{transform:"perspective(800px) rotateY(135deg)"}], 900, 1830);
    q(".miniature-world").querySelectorAll(".garden-plant").forEach((plant, i) => {
      const resting = getComputedStyle(plant).transform;
      animate(plant, [
        {transform:resting + " rotateX(82deg) scale(.65)", opacity:0},
        {transform:resting + " rotateX(0deg) scale(1)", opacity:1}
      ], 850, 1740 + i * 75);
    });
    animate(q(".miniature-light"), [{opacity:.1},{opacity:1}], 550, 2250);
    // The half-second reveal breath gives the miniature garden time to register.
    animate(q(".invitation-object"), [
      {transform:"rotate(-3deg) scale(1)", offset:0},
      {transform:"translateY(12%) rotate(0deg) scale(1.08)", offset:.36},
      {transform:"translateY(48%) rotate(0deg) scale(3.6)", offset:1}
    ], 1450, 2550, "cubic-bezier(.55,.02,.18,1)");
    // Drop the physical sleeve out of the lens before the brief garden match-dissolve.
    [q(".sleeve-back"), q(".sleeve-pocket")].forEach(el => animate(el, [
      {transform:"translateY(0)", opacity:1},
      {transform:"translateY(120%)", opacity:0}
    ], 500, 2700));
    [q(".sleeve-cover"), q(".wing-left"), q(".wing-right")].forEach(el =>
      animate(el, [{opacity:1},{opacity:0}], 320, 2740));
    animate(q(".invitation-object"), [{opacity:1},{opacity:0}], 350, 3400, "ease-in-out");
    animate(q(".invitation-backdrop"), [{opacity:1},{opacity:0}], 1050, 2650);
    gate.querySelectorAll(".invitation-corner").forEach(el => animate(el,[{opacity:.6},{opacity:0}],700,2550));
    [q(".invitation-action"), q(".invitation-dateline")].forEach(el=>animate(el,[{opacity:1},{opacity:0}],350,100));
    const world = document.querySelector(".garden-world");
    animate(world, [{transform:"scale(1.55)",filter:"brightness(.65)"},{transform:"scale(1)",filter:"brightness(1)"}], 2450, 2750);
    world.querySelectorAll(".garden-plant").forEach((plant,i)=>{
      const resting = getComputedStyle(plant).transform;
      const direction = plant.classList.contains("plant-strelitzia") || plant.classList.contains("plant-branch") ? -1 : 1;
      animate(plant, [
        {transform:resting + ` translateX(${direction * 75}px) scale(1.13)`},
        {transform:resting + " translateX(0) scale(1)"}
      ], 2100, 2850 + i * 40);
    });
    animate(document.querySelector(".garden-center"), [
      {opacity:0,transform:"translateY(16px)"},
      {opacity:1,transform:"translateY(0)"}
    ], 1250, 3700);
    animate(document.querySelector(".garden-bottom"), [{opacity:0},{opacity:1}],600,4500);
    emitPetals();
    const threshold = q(".garden-threshold");
    ["04-hedera-helix", "02-freesia-refracta", "08-wisteria-sprig"].forEach((asset, i) => {
      const bloom = document.createElement("img");
      bloom.src = `assets/${asset}.webp`;
      bloom.alt = "";
      threshold.append(bloom);
      const x = i === 0 ? -innerWidth * .9 : i === 1 ? innerWidth * .85 : innerWidth * .25;
      const y = i === 2 ? -innerHeight * 1.3 : innerHeight * .15;
      animate(bloom, [
        {opacity:0, transform:`translate(-50%,-30%) scale(.35) rotate(${i * 20 - 30}deg)`, offset:0},
        {opacity:1, transform:`translate(calc(-50% + ${x * .3}px),calc(-40% + ${y * .25}px)) scale(1.2) rotate(${i * 25 - 35}deg)`, offset:.4},
        {opacity:0, transform:`translate(calc(-50% + ${x}px),calc(-40% + ${y}px)) scale(2.4) rotate(${i * 35 - 40}deg)`, offset:1}
      ], 1650, 2680 + i * 100, "cubic-bezier(.35,.02,.2,1)");
    });
    finishTimer = window.setTimeout(finishOpening, 5250);
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
  if(form.reportValidity()) status.textContent="Preview complete. Your response has not been stored yet.";
});
