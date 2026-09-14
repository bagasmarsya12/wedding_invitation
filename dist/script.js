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
    ], 2100 + i % 4 * 90, 3600 + i % 5 * 55, "cubic-bezier(.12,.52,.28,1)");
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
      { transform:"rotateX(0deg) translateZ(0)", filter:"brightness(1)", offset:0 },
      { transform:"rotateX(-24deg) translateZ(2px)", filter:"brightness(.98)", offset:.24 },
      { transform:"rotateX(-128deg) translateZ(4px)", filter:"brightness(.91)", offset:.72 },
      { transform:"rotateX(-165deg) translateZ(0)", filter:"brightness(.88)", offset:1 }
    ], 1350, 420, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".letter"), [
      { transform:"translateY(0) rotate(0) scale(1)", zIndex:1, offset:0 },
      { transform:"translateY(-7%) rotate(.4deg) scale(1.005)", zIndex:1, offset:.24 },
      { transform:"translateY(-31%) rotate(1deg) scale(1.025)", zIndex:1, offset:.72 },
      { transform:"translateY(-40%) rotate(1.2deg) scale(1.06)", zIndex:8, offset:1 }
    ], 1600, 860, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".letter-address"), [
      { transform:"perspective(900px) translateZ(24px) rotateX(0deg) translateY(0)", opacity:1, offset:0 },
      { transform:"perspective(900px) translateZ(24px) rotateX(-4deg) translateY(-4px)", opacity:.96, offset:.48 },
      { transform:"perspective(900px) translateZ(24px) rotateX(-12deg) translateY(-20px)", opacity:0, offset:1 }
    ], 550, 1950, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".wing-left"), [
      {transform:"perspective(800px) rotateY(0deg) translateX(0)", opacity:1, offset:0},
      {transform:"perspective(800px) rotateY(-28deg) translateX(-6px)", opacity:1, offset:.28},
      {transform:"perspective(800px) rotateY(-72deg) translateX(-16px)", opacity:.42, offset:.68},
      {transform:"perspective(800px) rotateY(-100deg) translateX(-26px)", opacity:0, offset:1}
    ], 950, 1950, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".wing-right"), [
      {transform:"perspective(800px) rotateY(0deg) translateX(0)", opacity:1, offset:0},
      {transform:"perspective(800px) rotateY(28deg) translateX(6px)", opacity:1, offset:.28},
      {transform:"perspective(800px) rotateY(72deg) translateX(16px)", opacity:.42, offset:.68},
      {transform:"perspective(800px) rotateY(100deg) translateX(26px)", opacity:0, offset:1}
    ], 950, 2070, "cubic-bezier(.22,.72,.18,1)");
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
      {transform:"translateY(8%) rotate(0deg) scale(1.04)", offset:.54},
      {transform:"translateY(8%) rotate(0deg) scale(1.08)", offset:1}
    ], 1700, 2400, "cubic-bezier(.22,.72,.18,1)");
    // The little green world appears as a quiet panel before it opens into the viewport.
    const thresholdScene = q(".threshold-scene");
    const boxClip = getComputedStyle(thresholdScene).clipPath;
    animate(thresholdScene, [
      {clipPath:boxClip, opacity:0, offset:0},
      {clipPath:boxClip, opacity:1, offset:.19},
      {clipPath:"inset(0% 0% 0% 0% round 0px)", opacity:1, offset:.79},
      {clipPath:"inset(0% 0% 0% 0% round 0px)", opacity:0, offset:1}
    ], 3100, 2550, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".threshold-world"), [
      {transform:"scale(1.06)"},
      {transform:"scale(1)"}
    ], 1850, 3150, "cubic-bezier(.22,.72,.18,1)");
    animate(q(".letter-garden"), [{opacity:1},{opacity:0}], 700, 2550, "cubic-bezier(.22,.72,.18,1)");
    // Let the paper settle behind the green panel instead of flying toward the camera.
    [q(".sleeve-back"), q(".sleeve-pocket")].forEach(el => animate(el, [
      {transform:"translateY(0)", opacity:1},
      {transform:"translateY(120%)", opacity:0}
    ], 620, 3150));
    [q(".sleeve-cover"), q(".wing-left"), q(".wing-right")].forEach(el =>
      animate(el, [{opacity:1},{opacity:0}], 520, 3180));
    animate(q(".invitation-object"), [{opacity:1},{opacity:0}], 500, 3300, "ease-in-out");
    animate(q(".invitation-backdrop"), [{opacity:1},{opacity:0}], 1100, 3400);
    gate.querySelectorAll(".invitation-corner").forEach(el => animate(el,[{opacity:.6},{opacity:0}],850,3200));
    [q(".invitation-action"), q(".invitation-dateline")].forEach(el=>animate(el,[{opacity:1},{opacity:0}],350,100));
    const world = document.querySelector(".garden-world");
    animate(world, [{transform:"scale(1.22)",filter:"brightness(.72)"},{transform:"scale(1)",filter:"brightness(1)"}], 2350, 3150);
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
