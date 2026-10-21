// Small DOM helpers shared by every screen.

export function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function el<T extends HTMLElement = HTMLElement>(markup: string): T {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as T;
}

export function $<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  const e = root.querySelector<T>(sel);
  if (!e) throw new Error(`Missing element ${sel}`);
  return e;
}

export function on(root: ParentNode, sel: string, type: string, fn: (e: Event, el: HTMLElement) => void) {
  root.querySelectorAll<HTMLElement>(sel).forEach((n) => n.addEventListener(type, (e) => fn(e, n)));
}

const toastHost = () => document.getElementById('toasts')!;

export function toast(message: string, kind: 'info' | 'good' | 'warn' = 'info', ms = 2600) {
  const t = el(`<div class="toast ${kind}" role="status">${esc(message)}</div>`);
  toastHost().appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, ms);
}

export interface ModalAction {
  label: string;
  kind?: 'primary' | 'ghost' | 'danger';
  onClick?: () => void | boolean;
  id?: string;
}

/** Shows a modal dialog. An action returning `false` keeps it open. */
export function modal(opts: { title: string; body: string; actions: ModalAction[]; dismissible?: boolean; className?: string; onClose?: () => void }) {
  const host = document.getElementById('modals')!;
  const wrap = el(`
    <div class="modal-backdrop ${opts.className ?? ''}">
      <div class="modal panel" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
        <h2>${esc(opts.title)}</h2>
        <div class="modal-body">${opts.body}</div>
        <div class="modal-actions">${opts.actions
          .map((a, i) => `<button class="btn ${a.kind ?? 'ghost'}" data-i="${i}" ${a.id ? `id="${a.id}"` : ''}>${esc(a.label)}</button>`)
          .join('')}</div>
      </div>
    </div>`);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 250);
    opts.onClose?.();
  };
  wrap.querySelectorAll<HTMLButtonElement>('.modal-actions button').forEach((b) =>
    b.addEventListener('click', () => {
      const a = opts.actions[Number(b.dataset.i)];
      if (a.onClick?.() === false) return;
      close();
    }),
  );
  if (opts.dismissible !== false) {
    wrap.addEventListener('click', (e) => e.target === wrap && close());
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        window.removeEventListener('keydown', esc, true);
      }
    };
    window.addEventListener('keydown', esc, true);
  }
  host.appendChild(wrap);
  requestAnimationFrame(() => {
    wrap.classList.add('show');
    wrap.querySelector<HTMLButtonElement>('.modal-actions .btn.primary, .modal-actions .btn')?.focus();
  });
  return { close, root: wrap };
}

export function confirmDialog(title: string, text: string, confirmLabel = 'Confirm', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title,
      body: `<p>${esc(text)}</p>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: () => void (answered = true, resolve(false)) },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => void (answered = true, resolve(true)) },
      ],
      onClose: () => !answered && resolve(false),
    });
  });
}

export function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCountdown(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export function stars(n: number, max = 3) {
  return `<span class="stars" aria-label="${n} of ${max} stars">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join('')}</span>`;
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
