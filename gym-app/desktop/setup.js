// First start of the Windows app: online account, licence or demo.
(async function () {
  const api = window.gymDesktop.setup;
  const info = await api.info();
  const $ = (sel, el = document) => el.querySelector(sel);

  document.querySelectorAll('[data-product]').forEach((x) => { x.textContent = info.productName; });
  $('[data-letter]').textContent = info.productName.charAt(0);
  document.title = `Welcome to ${info.productName}`;
  if (!info.platformUrl) $('[data-server]').hidden = false;

  const show = (step) => {
    document.querySelectorAll('[data-step]').forEach((s) => { s.hidden = s.dataset.step !== step; });
    $(`[data-step="${step}"] input`)?.focus();
  };
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.go !== 'demo') return show(b.dataset.go === 'licence' && info.licence ? 'gym' : b.dataset.go);
    b.disabled = true;
    await api.demo();
  }));

  const g = $('#gym');
  g.country.innerHTML = info.countries.map((c) => `<option value="${c.code}" ${c.code === info.country ? 'selected' : ''}>${c.name}${c.code === 'OTHER' ? '' : ` (${c.currency})`}</option>`).join('');
  const feeHint = () => { g.monthlyFee.placeholder = String(info.countries.find((c) => c.code === g.country.value)?.monthly || ''); };
  g.country.addEventListener('change', feeHint);
  feeHint();

  // Runs a step, showing what went wrong under the form.
  const submit = (form, run) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    const err = form.querySelector('[data-error]');
    err.textContent = '';
    btn.disabled = true;
    try {
      const r = await run(form);
      if (r && r.ok === false) err.textContent = r.error;
    } catch (x) {
      err.textContent = x.message;
    } finally {
      btn.disabled = false;
    }
  });

  submit($('#online'), async (f) => {
    const r = await api.online(f.address.value);
    if (r.ok) await api.relaunch();
    return r;
  });
  submit($('#licence'), async (f) => {
    const r = await api.activate(f.key.value, f.server.value);
    if (r.ok) show('gym');
    return r;
  });
  submit(g, async (f) => {
    if (f.ownerPin.value !== f.pin2.value) return { ok: false, error: 'The two PINs are different' };
    return api.gym({ name: f.name.value, country: f.country.value, monthlyFee: f.monthlyFee.value, ownerPin: f.ownerPin.value, email: f.email.value, phone: f.phone.value });
  });

  const note = new URLSearchParams(location.search).get('note');
  if (note === 'gym') show('gym');
  if (note === 'licence') {
    show('licence');
    $('#licence [data-error]').textContent = 'Please activate your licence on this computer.';
  }
})();
