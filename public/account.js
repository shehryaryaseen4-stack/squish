// Sign in / sign up, the account page, and the last page of Google sign-in in a popup
// (see the accounts section of pages.js).
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

  // Google sign-in finished in a popup opened by the PDF editor: tell it, then close.
  if (document.body.dataset.ok !== undefined) {
    if (window.opener) {
      try { window.opener.postMessage({ type: "ff-auth", ok: document.body.dataset.ok === "1" }, location.origin); } catch (_) { /* opener gone */ }
      window.close();
    } else if (document.body.dataset.ok === "1") location.replace("/account");
    return;
  }

  // Sign in, sign up, forgot password. Sign-up and reset continue with an emailed code
  // (the .auth-code step) when the server answers { verify: true }.
  const okEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const form = $(".auth-form");
  const codeForm = $(".auth-code");
  let codeEmail = "";
  const done = () => { location.href = (form && form.dataset.next) || "/account"; };
  function showCode(email) {
    codeEmail = email;
    $("[data-email]", codeForm).textContent = email;
    $(".auth-step1").hidden = true;
    codeForm.hidden = false;
    $(".auth-msg", codeForm).hidden = true;
    $("#authCode").value = "";
    $("#authCode").focus();
  }
  if (form) {
    const msg = $(".auth-msg", form), btn = $("button", form), email = $("#authEmail"), pass = $("#authPass");
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const kind = form.dataset.auth;
      const em = email.value.trim();
      if (!okEmail(em)) { say("Please enter a valid email address."); email.focus(); return; }
      if (pass) {
        if (kind === "signup" && pass.value.length < 8) { say("Use at least 8 characters for your password."); pass.focus(); return; }
        if (!pass.value) { say("Please enter your password."); pass.focus(); return; }
      }
      say(""); btn.disabled = true;
      try {
        const r = await post("/api/auth/" + kind, { email: em, password: pass ? pass.value : undefined });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.verify && codeForm) { btn.disabled = false; showCode(j.email || em); return; }
        if (r.ok && j.user) { done(); return; }
        say(j.error || "Something went wrong. Please try again.");
      } catch (_) { say("Network error. Check your connection and try again."); }
      btn.disabled = false;
    });
  }
  if (codeForm) {
    const msg = $(".auth-msg", codeForm), btn = $('button[type="submit"]', codeForm), code = $("#authCode");
    const reset = codeForm.dataset.purpose === "reset";
    const say = (t, ok) => { msg.textContent = t; msg.hidden = !t; msg.classList.toggle("ok", !!ok); };
    code.addEventListener("input", () => { code.value = code.value.replace(/\D/g, "").slice(0, 6); });
    codeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (code.value.length !== 6) { say("Enter the 6-digit code from the email."); code.focus(); return; }
      const np = $("#authNewPass");
      if (reset && np.value.length < 8) { say("Use at least 8 characters for your new password."); np.focus(); return; }
      say(""); btn.disabled = true;
      try {
        const r = await post(reset ? "/api/auth/reset" : "/api/auth/verify", { email: codeEmail, code: code.value, password: reset ? np.value : undefined });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.user) { done(); return; }
        say(j.error || "Something went wrong. Please try again.");
      } catch (_) { say("Network error. Check your connection and try again."); }
      btn.disabled = false;
    });
    $("[data-resend]", codeForm).addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        const r = reset ? await post("/api/auth/forgot", { email: codeEmail }) : await post("/api/auth/resend", { email: codeEmail, purpose: "signup" });
        const j = await r.json().catch(() => ({}));
        say(r.ok ? "A new code is on its way." : (j.error || "Could not send a new code."), r.ok);
      } catch (_) { say("Network error. Check your connection and try again."); }
      setTimeout(() => { e.target.disabled = false; }, 30000);
    });
    $("[data-back]", codeForm).addEventListener("click", () => { codeForm.hidden = true; $(".auth-step1").hidden = false; });
  }

  const del = $("[data-delete]");
  if (del) {
    del.addEventListener("click", async () => {
      if (!confirm("Delete your account for good? This cannot be undone.")) return;
      del.disabled = true;
      const r = await post("/api/me/delete").catch(() => null);
      if (r && r.ok) location.href = "/";
      else { del.disabled = false; alert("Your account could not be deleted. Please try again."); }
    });
  }
})();
