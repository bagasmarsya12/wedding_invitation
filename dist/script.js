const form = document.querySelector("#rsvp-form");
const status = document.querySelector("#form-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const openingGate = document.querySelector("[data-opening-gate]");
const openingEnter = document.querySelector("#opening-enter");
const openingSkip = document.querySelector("#opening-skip");
const guestName = document.querySelector("[data-guest-name]");

if (openingGate && openingEnter && openingSkip) {
  const params = new URLSearchParams(window.location.search);
  const providedName = params.get("to") || params.get("guest") || params.get("name");
  const displayName = providedName?.trim().slice(0, 48) || "Tamu Spesial Kami";
  let openingFinished = false;

  if (guestName) {
    guestName.textContent = displayName;
  }

  document.body.classList.add("opening-active");

  const finishOpening = (skip = false) => {
    if (openingFinished) {
      return;
    }

    openingFinished = true;
    openingGate.classList.add("is-opening");

    window.setTimeout(
      () => {
        openingGate.classList.add("is-dismissed");
        openingGate.setAttribute("aria-hidden", "true");
        openingGate.inert = true;
        document.body.classList.remove("opening-active");
      },
      reducedMotion.matches ? 40 : skip ? 80 : 1500,
    );
  };

  openingEnter.addEventListener("click", () => finishOpening());
  openingSkip.addEventListener("click", () => finishOpening(true));

  openingGate.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      finishOpening(true);
    }
  });
}

if (!reducedMotion.matches && "IntersectionObserver" in window) {
  document.documentElement.classList.add("motion-ready");

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10%", threshold: 0.14 },
  );

  document.querySelectorAll("[data-reveal], .botanical-reveal").forEach((element) => {
    revealObserver.observe(element);
  });
}

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    status.textContent = "Preview complete. Your response has not been stored yet.";
  });
}
