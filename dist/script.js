const form = document.querySelector("#rsvp-form");
const status = document.querySelector("#form-status");

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    status.textContent = "Preview complete. Your response has not been stored yet.";
  });
}
