// Sign in / sign up and checkout pages (see accountShell in pages.js).
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const okEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  // Sign in / sign up: ask the server to email a sign-in link.
  const form = $(".auth-form");
  if (form) {
    const msg = $(".auth-msg", form), input = $("#authEmail"), btn = $("button", form);
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!okEmail(email)) { say("Please enter a valid email address."); input.focus(); return; }
      say(""); btn.disabled = true;
      try {
        const r = await fetch("/api/auth/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, mode: form.dataset.auth }) });
        if (r.ok) { try { sessionStorage.setItem("auth-email", email); } catch (_) { /* storage off */ } location.href = "/login?sent=1"; return; }
        say(r.status === 404 ? "Sign-in is not open yet. Every feature is free for now." : "We could not send the email. Please try again in a minute.");
      } catch (_) { say("Network error. Check your connection and try again."); }
      btn.disabled = false;
    });
  }
  const sentTo = $("[data-email]");
  if (sentTo) { try { const v = sessionStorage.getItem("auth-email"); if (v) sentTo.textContent = v; } catch (_) { /* storage off */ } }

  // Checkout: choosing a plan updates the summary and the payment link; the email is passed
  // on so the payment page is already filled in.
  const co = $(".co");
  if (co) {
    const pay = $("[data-pay]"), email = $("#coEmail");
    const update = () => {
      const r = $('input[name="plan"]:checked', co);
      co.querySelectorAll(".co-opt").forEach((o) => o.classList.toggle("on", o.contains(r)));
      $("[data-sum-name]").textContent = $(".co-opt-main strong", r.closest(".co-opt")).textContent;
      $("[data-sum-price]").textContent = $(".co-opt-price strong", r.closest(".co-opt")).textContent;
      let href = r.dataset.href;
      if (href && okEmail(email.value.trim())) href += (href.includes("?") ? "&" : "?") + "checkout[email]=" + encodeURIComponent(email.value.trim());
      pay.href = href || "#";
      pay.classList.toggle("is-disabled", !href);
      pay.textContent = href ? "Continue to secure payment" : "Payments open soon";
    };
    co.addEventListener("change", update);
    email.addEventListener("input", update);
    update();
  }
})();
