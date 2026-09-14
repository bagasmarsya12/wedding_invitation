const form = document.querySelector("#rsvp-form");
const status = document.querySelector("#form-status");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
