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

  const form = $(".auth-form");
  if (form) {
    const msg = $(".auth-msg", form), btn = $("button", form), email = $("#authEmail"), pass = $("#authPass");
    const say = (t) => { msg.textContent = t; msg.hidden = !t; };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const signup = form.dataset.auth === "signup";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { say("Please enter a valid email address."); email.focus(); return; }
      if (signup && pass.value.length < 8) { say("Use at least 8 characters for your password."); pass.focus(); return; }
      if (!pass.value) { say("Please enter your password."); pass.focus(); return; }
      say(""); btn.disabled = true;
      try {
        const r = await post("/api/auth/" + (signup ? "signup" : "login"), { email: email.value.trim(), password: pass.value });
        if (r.ok) { location.href = form.dataset.next || "/account"; return; }
        const j = await r.json().catch(() => ({}));
        say(j.error || "Something went wrong. Please try again.");
      } catch (_) { say("Network error. Check your connection and try again."); }
      btn.disabled = false;
    });
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
