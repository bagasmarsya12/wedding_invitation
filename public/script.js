const opening = document.querySelector("#opening");
const openButton = document.querySelector("#open-invitation");
const skipButton = document.querySelector("#skip-opening");
const replayButton = document.querySelector("#replay-opening");
const pageShell = document.querySelector("#page-shell");
pageShell.inert = true;
const openingName = document.querySelector("#opening-name");
const openingStatus = document.querySelector("#opening-status");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const inviteContext = document.querySelector("#invite-context");
const inviteToken = inviteContext?.dataset.token || "";
const inviteGuestName = inviteContext?.dataset.guestName || "";
const invitePartyLimit = Math.max(1, Number(inviteContext?.dataset.partyLimit || 2));

const params = new URLSearchParams(location.search);
const guestName = (inviteGuestName || params.get("to") || params.get("guest") || params.get("nama") || "").trim();
if (guestName) {
  openingName.textContent = guestName.slice(0, 80);
  const nameField = document.querySelector('#rsvp-form input[name="name"]');
  if (nameField) nameField.value = guestName.slice(0, 80);
}

if (inviteToken) {
  document.querySelectorAll("[data-invite-path]").forEach(link => {
    link.href = `/invite/${encodeURIComponent(inviteToken)}/${link.dataset.invitePath}`;
  });
  const partySelect = document.querySelector('#rsvp-form select[name="party-size"]');
  if (partySelect) {
    partySelect.replaceChildren(...Array.from({ length: invitePartyLimit }, (_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = `${index + 1} tamu`;
      return option;
    }));
  }
  fetch(`/api/invite/${encodeURIComponent(inviteToken)}/rsvp`)
    .then(response => response.ok ? response.json() : null)
    .then(result => {
      if (!result?.rsvp) return;
      const saved = result.rsvp;
      const attendance = document.querySelector(`#rsvp-form input[name="attendance"][value="${saved.attendance}"]`);
      if (attendance) attendance.checked = true;
      if (partySelect && saved.party_size) partySelect.value = String(saved.party_size);
      const mappings = [["guest-names", "guest_names"], ["dietary", "dietary"], ["message", "message"]];
      mappings.forEach(([field, key]) => { const input = document.querySelector(`#rsvp-form [name="${field}"]`); if (input) input.value = saved[key] || ""; });
    })
    .catch(() => {});
}

fetch("/api/site-state")
  .then(response => response.ok ? response.json() : null)
  .then(state => {
    if (!state?.phase) return;
    document.body.dataset.sitePhase = state.phase;
    const notice = document.querySelector("#lifecycle-notice");
    if (!notice || state.phase === "pre-wedding") return;
    notice.textContent = state.phase === "wedding-day"
      ? "Today is the day — event information below is current."
      : "This invitation is now part of our archive.";
    notice.hidden = false;
  })
  .catch(() => {});

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
rsvpForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!rsvpForm.reportValidity()) return;
  const attending = new FormData(rsvpForm).get("attendance") === "yes";
  if (inviteToken) {
    const button = rsvpForm.querySelector('button[type="submit"]');
    button.disabled = true;
    formStatus.textContent = "Menyimpan jawaban…";
    try {
      const data = new FormData(rsvpForm);
      const response = await fetch(`/api/invite/${encodeURIComponent(inviteToken)}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendance: attending ? "yes" : "no",
          partySize: Number(String(data.get("party-size") || "1").replace(/\D/g, "")) || 1,
          guestNames: String(data.get("guest-names") || ""),
          dietary: String(data.get("dietary") || ""),
          message: String(data.get("message") || ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Jawaban belum dapat disimpan.");
      formStatus.textContent = attending ? "You’re on the list." : "Terima kasih sudah memberi kabar.";
    } catch (error) {
      formStatus.textContent = error instanceof Error ? error.message : "Jawaban belum dapat disimpan.";
    } finally {
      button.disabled = false;
    }
    return;
  }
  formStatus.textContent = attending
    ? "Preview selesai. Konfirmasi online belum dibuka."
    : "Preview selesai. Tidak ada jawaban yang disimpan.";
});
