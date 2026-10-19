import { html, useState, useEffect, useRef, Icon } from './ui.js';
import { verifyPin, validPin } from './lock.js';

export function LockScreen({ lock, onUnlock, onForgot, what }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [fails, setFails] = useState(0);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [askForgot, setAskForgot] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.focus();
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const wait = Math.max(0, Math.ceil((until - now) / 1000));

  async function submit(e) {
    e.preventDefault();
    if (wait > 0) return;
    if (await verifyPin(pin, lock)) { onUnlock(); return; }
    const f = fails + 1;
    setFails(f);
    setPin('');
    if (f % 5 === 0) { setUntil(Date.now() + 30000); setNow(Date.now()); setErr('Too many tries. Please wait 30 seconds.'); }
    else setErr('That PIN is not right.');
    if (ref.current) ref.current.focus();
  }

  return html`
    <div class="card pad" style="max-width:420px;margin:40px auto;text-align:center;align-items:stretch">
      <div style="display:flex;justify-content:center;color:var(--primary)"><${Icon} name="lock" size=${34} /></div>
      <h1 style="font-size:28px">${what} is locked</h1>
      <div class="muted small">Enter your PIN to open it.</div>
      <form onSubmit=${submit} class="pad">
        <input ref=${ref} class="input" style="text-align:center;font-size:22px;letter-spacing:0.4em" type="password" inputmode="numeric" autocomplete="off"
          maxlength="8" aria-label="PIN" value=${pin} onInput=${(e) => { setPin(e.target.value.replace(/\D/g, '')); setErr(''); }} />
        ${(err || wait > 0) && html`<div class="banner err" role="alert">${wait > 0 ? `Too many tries. Please wait ${wait} seconds.` : err}</div>`}
        <button class="btn primary" type="submit" disabled=${wait > 0 || pin.length < 4}>Unlock</button>
      </form>
      ${!askForgot
        ? html`<button class="btn ghost" onClick=${() => setAskForgot(true)}>Forgot PIN?</button>`
        : html`<div class="banner" style="text-align:left"><span>This removes the lock on this device and signs you out of Google. Sign in again to set a new PIN. Your data in Drive is not touched.</span>
            <span class="row"><button class="btn danger" onClick=${onForgot}>Remove lock</button><button class="btn" onClick=${() => setAskForgot(false)}>Cancel</button></span></div>`}
    </div>`;
}

export function LockCard({ lock, api }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [cur, setCur] = useState('');
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('idle'); // idle | change | remove
  const digits = (setter) => (e) => { setter(e.target.value.replace(/\D/g, '')); setMsg(''); };

  const enable = async () => {
    if (!validPin(pin)) return setMsg('The PIN must be 4 to 8 digits.');
    if (pin !== pin2) return setMsg('The two PINs do not match.');
    await api.enable(pin);
    setPin(''); setPin2(''); setMsg('App lock is on.');
  };
  const change = async () => {
    if (!validPin(pin)) return setMsg('The new PIN must be 4 to 8 digits.');
    if (pin !== pin2) return setMsg('The two new PINs do not match.');
    const err = await api.change(cur, pin);
    if (err) return setMsg(err);
    setPin(''); setPin2(''); setCur(''); setMode('idle'); setMsg('PIN changed.');
  };
  const remove = async () => {
    const err = await api.remove(cur);
    if (err) return setMsg(err);
    setCur(''); setMode('idle'); setMsg('App lock is off.');
  };

  const field = (id, label, value, setter) => html`<div class="field"><label for=${id}>${label}</label>
    <input id=${id} class="input" type="password" inputmode="numeric" maxlength="8" autocomplete="off" value=${value} onInput=${digits(setter)} /></div>`;

  return html`
    <div class="card pad" style="max-width:720px">
      <h2>App lock</h2>
      <div class="small muted">A PIN on this device keeps your Diary and Stories private from anyone at your screen. It is a privacy screen, not encryption: your files in Drive are protected by your Google account.</div>
      ${!lock ? html`
        <div class="grid2">${field('pin-new', 'New PIN (4 to 8 digits)', pin, setPin)}${field('pin-new2', 'Repeat the PIN', pin2, setPin2)}</div>
        <div><button class="btn primary" onClick=${enable}>Turn on app lock</button></div>
      ` : html`
        <div class="row">
          <div class="field" style="min-width:220px"><label for="auto-min">Lock again after</label>
            <select id="auto-min" class="input" value=${String(lock.autoLockMinutes)} onChange=${(e) => api.setMinutes(Number(e.target.value))}>
              ${[1, 5, 15, 30].map((m) => html`<option value=${String(m)} selected=${lock.autoLockMinutes === m}>${m} minute${m > 1 ? 's' : ''} without activity</option>`)}
            </select></div>
          <button class="btn" onClick=${api.lockNow}><${Icon} name="lock" size=${18} />Lock now</button>
        </div>
        ${mode === 'idle' && html`<div class="row"><button class="btn" onClick=${() => { setMode('change'); setMsg(''); }}>Change PIN</button><button class="btn danger" onClick=${() => { setMode('remove'); setMsg(''); }}>Turn off lock</button></div>`}
        ${mode === 'change' && html`<div class="grid2">${field('pin-cur', 'Current PIN', cur, setCur)}<div></div>${field('pin-new', 'New PIN', pin, setPin)}${field('pin-new2', 'Repeat new PIN', pin2, setPin2)}</div>
          <div class="row"><button class="btn primary" onClick=${change}>Save new PIN</button><button class="btn" onClick=${() => setMode('idle')}>Cancel</button></div>`}
        ${mode === 'remove' && html`<div class="grid2">${field('pin-cur', 'Current PIN', cur, setCur)}</div>
          <div class="row"><button class="btn danger" onClick=${remove}>Turn off app lock</button><button class="btn" onClick=${() => setMode('idle')}>Cancel</button></div>`}
      `}
      <div class="small" role="status" style="min-height:18px">${msg}</div>
    </div>`;
}
