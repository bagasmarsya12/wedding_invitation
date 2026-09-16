const opening = document.querySelector("#opening");
const openButton = document.querySelector("#open-invitation");
const skipButton = document.querySelector("#skip-opening");
const replayButton = document.querySelector("#replay-opening");
const pageShell = document.querySelector("#page-shell");
const openingName = document.querySelector("#opening-name");
const openingStatus = document.querySelector("#opening-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const params = new URLSearchParams(location.search);
const guestName = (params.get("to") || params.get("guest") || params.get("nama") || "").trim();
if (guestName) {
  openingName.textContent = guestName.slice(0, 80);
  const nameField = document.querySelector('#rsvp-form input[name="name"]');
  if (nameField) nameField.value = guestName.slice(0, 80);
}

let openingTimer = 0;
let isOpen = false;

function finishOpening({ focus = true } = {}) {
  if (openingTimer) clearTimeout(openingTimer);
  openingTimer = 0;
  isOpen = true;
  opening.classList.add("is-finished");
  opening.classList.remove("is-opening");
  opening.setAttribute("aria-hidden", "true");
  pageShell.inert = false;
  document.body.classList.remove("invitation-locked");
  document.body.classList.add("is-entered");
  if (focus) document.querySelector("#hero-title").focus?.({ preventScroll: true });
}

function openInvitation() {
  if (isOpen || opening.classList.contains("is-opening")) return;
  openingStatus.textContent = "Undangan sedang dibuka.";
  openButton.disabled = true;
  opening.classList.add("is-opening");

  if (reducedMotion.matches) {
    finishOpening({ focus: true });
    return;
  }

  openingTimer = window.setTimeout(() => {
    openingStatus.textContent = "Undangan terbuka.";
    finishOpening({ focus: true });
  }, 2550);
}

function replayOpening() {
  if (openingTimer) clearTimeout(openingTimer);
  isOpen = false;
  pageShell.inert = true;
  document.body.classList.add("invitation-locked");
  document.body.classList.remove("is-entered");
  opening.classList.remove("is-opening", "is-finished");
  opening.removeAttribute("aria-hidden");
  openButton.disabled = false;
  openingStatus.textContent = "";
  window.scrollTo({ top: 0, behavior: "instant" });
  requestAnimationFrame(() => openButton.focus({ preventScroll: true }));
}

openButton.addEventListener("click", openInvitation);
skipButton.addEventListener("click", () => finishOpening({ focus: true }));
replayButton.addEventListener("click", replayOpening);

opening.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    finishOpening({ focus: true });
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [openButton, skipButton].filter(control => !control.disabled);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

reducedMotion.addEventListener("change", event => {
  if (event.matches && opening.classList.contains("is-opening")) {
    finishOpening({ focus: true });
  }
});

if ("IntersectionObserver" in window && !reducedMotion.matches) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach(element => element.classList.add("is-visible"));
}

const rsvpForm = document.querySelector("#rsvp-form");
const formStatus = document.querySelector("#form-status");
rsvpForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!rsvpForm.reportValidity()) return;
  const attending = new FormData(rsvpForm).get("attendance") === "yes";
  formStatus.textContent = attending
    ? "Preview selesai. Konfirmasi online belum dibuka."
    : "Preview selesai. Tidak ada jawaban yang disimpan.";
});
