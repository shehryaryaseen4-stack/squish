// Owner dashboard: sign in, search, delete a user, sign out, chart tooltips.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const base = document.body.dataset.admin;
  const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

  const form = $(".ad-login-form");
  if (form) {
    const msg = $(".ad-msg"), btn = $("button", form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      btn.disabled = true; msg.hidden = true;
      try {
        const r = await post(base + "/login", { email: $("#adEmail").value, password: $("#adPass").value });
        if (r.ok) { location.reload(); return; }
        msg.textContent = (await r.json().catch(() => ({}))).error || "Could not sign in.";
      } catch (_) { msg.textContent = "Network error. Try again."; }
      msg.hidden = false; btn.disabled = false;
    });
    return;
  }

  const out = $("[data-logout]");
  if (out) out.addEventListener("click", async () => { await post(base + "/logout"); location.reload(); });

  // The table shows 50 users at a time; a search looks through all of them.
  const search = $(".ad-search"), more = $("[data-more-btn]");
  const rows = () => [...document.querySelectorAll(".ad-users-table tbody tr")];
  if (more) {
    more.addEventListener("click", () => {
      rows().filter((tr) => tr.hasAttribute("data-more")).slice(0, 50).forEach((tr) => { tr.removeAttribute("data-more"); tr.hidden = false; });
      more.hidden = !rows().some((tr) => tr.hasAttribute("data-more"));
    });
  }
  if (search) {
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      rows().forEach((tr) => { const hit = q ? tr.dataset.q.includes(q) : !tr.hasAttribute("data-more"); tr.hidden = !hit; shown += hit; });
      const none = $(".ad-none"); if (none) none.hidden = shown > 0;
      if (more) more.hidden = !!q || !rows().some((tr) => tr.hasAttribute("data-more"));
    });
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const tr = b.closest("tr");
    const email = $(".ad-email", tr).firstChild.textContent;
    if (!confirm("Delete " + email + "? This removes the account for good.")) return;
    b.disabled = true;
    const r = await post(base + "/delete", { id: tr.dataset.id });
    if (r.ok) tr.remove(); else { b.disabled = false; alert("Could not delete. Sign in again and retry."); }
  });

  const later = $("[data-later-btn]");
  if (later) later.addEventListener("click", () => { document.querySelectorAll("tr[data-later]").forEach((tr) => { tr.hidden = false; }); later.parentNode.remove(); });

  // Today's numbers refresh every minute while the tab is visible and nobody is typing.
  const main = $(".ad-main");
  if (main && main.dataset.range === "today") {
    setInterval(() => {
      if (document.visibilityState === "visible" && !(document.activeElement && document.activeElement.matches("input"))) location.reload();
    }, 60000);
  }

  // Chart tooltips: follow the hovered bar.
  document.querySelectorAll(".ad-plot").forEach((plot) => {
    const tip = $(".ad-tip", plot);
    plot.addEventListener("pointermove", (e) => {
      const col = e.target.closest(".ad-col");
      if (!col) { tip.hidden = true; return; }
      const box = col.querySelector(".ad-hit").getBoundingClientRect(), pb = plot.getBoundingClientRect();
      const bar = col.querySelector(".ad-bar");
      const top = bar ? bar.getBoundingClientRect().top : box.bottom;
      tip.textContent = col.dataset.tip;
      tip.style.left = Math.min(Math.max(box.left + box.width / 2 - pb.left, 60), pb.width - 60) + "px";
      tip.style.top = top - pb.top + "px";
      tip.hidden = false;
    });
    plot.addEventListener("pointerleave", () => { tip.hidden = true; });
  });
})();
