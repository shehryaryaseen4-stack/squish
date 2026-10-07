// Drag-to-reorder for file cards and page thumbnails, with mouse, pen and touch.
// Touch: press and hold briefly, then drag (a quick swipe still scrolls the page).
// Every list using this also has move buttons, so it works from the keyboard too.

export function sortable(list, { item, onMove, handle = null, horizontal = true }) {
  let drag = null;

  const items = () => [...list.querySelectorAll(item)];

  function start(el, e) {
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.removeAttribute('id');
    Object.assign(ghost.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
      pointerEvents: 'none', zIndex: 200, opacity: '0.9', boxShadow: '0 18px 40px -10px rgba(0,0,0,.35)', transform: 'rotate(2deg)', margin: 0,
    });
    document.body.appendChild(ghost);
    el.classList.add('is-dragging');
    drag = { el, ghost, from: items().indexOf(el), dx: e.clientX - rect.left, dy: e.clientY - rect.top, target: null, after: false };
  }

  function move(e) {
    if (!drag) return;
    drag.ghost.style.left = `${e.clientX - drag.dx}px`;
    drag.ghost.style.top = `${e.clientY - drag.dy}px`;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const over = under && under.closest(item);
    items().forEach((i) => i.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-target'));
    if (over && list.contains(over) && over !== drag.el) {
      const r = over.getBoundingClientRect();
      const after = horizontal && r.width < list.clientWidth * 0.6 ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      over.classList.add(after ? 'is-drop-after' : 'is-drop-before', 'is-drop-target');
      drag.target = over; drag.after = after;
    } else drag.target = null;
    // scroll the window when dragging near the top or bottom edge
    const edge = 60;
    if (e.clientY < edge) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  function end() {
    if (!drag) return;
    const { el, ghost, from, target, after } = drag;
    ghost.remove();
    el.classList.remove('is-dragging');
    items().forEach((i) => i.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-target'));
    drag = null;
    if (target) {
      let to = items().indexOf(target) + (after ? 1 : 0);
      if (to > from) to -= 1;
      if (to !== from) onMove(from, to);
    }
  }

  let pending = null;
  list.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(item);
    if (!el || !list.contains(el) || e.button > 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    if (handle && !e.target.closest(handle)) return;
    const x0 = e.clientX; const y0 = e.clientY;
    if (e.pointerType === 'touch') {
      pending = { el, x0, y0, timer: setTimeout(() => { pending.ready = true; if (navigator.vibrate) navigator.vibrate(15); start(el, e); }, 280) };
    } else {
      pending = { el, x0, y0, mouse: true };
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (drag) { move(e); return; }
    if (!pending) return;
    const far = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0) > 6;
    if (pending.mouse && far) { start(pending.el, e); pending = null; move(e); } else if (!pending.mouse && far && !pending.ready) { clearTimeout(pending.timer); pending = null; }
  });
  const stop = () => { if (pending) { clearTimeout(pending.timer); pending = null; } end(); };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', () => { if (pending) { clearTimeout(pending.timer); pending = null; } if (drag) end(); });
  // once a touch drag has started, stop the page from scrolling
  list.addEventListener('touchmove', (e) => { if (drag || (pending && pending.ready)) e.preventDefault(); }, { passive: false });
  list.addEventListener('contextmenu', (e) => { if (drag || pending) e.preventDefault(); });
}
