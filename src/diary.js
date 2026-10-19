import { html, useState, useEffect, useRef, Icon, Pill } from './ui.js';
import { MOODS, MOOD_COLOR, MOOD_SCORE, newDay, cleanDay, missingAnswers, highlightsOn, newHighlight, formatLongDate, addDays, formatDate } from './logic.js';
import { HighlightModal, HighlightLine } from './highlights.js';

const FIELD_LABEL = {
  mood: 'Mood', waterLitres: 'Water', steps: 'Steps', pagesRead: 'Pages read', bookTitle: 'Book title', movie: 'Watched something', movieName: 'What you watched',
  activity: 'Activity', activityName: 'Which activity', calories: 'Calories', spentRupees: 'Money spent', diary: 'Diary text', moodAnalysis: 'Mood note'
};

const draftKey = (d) => `lwa.draft.${d}`;
function readDraft(d) {
  try { const v = JSON.parse(sessionStorage.getItem(draftKey(d))); return v && v.date === d ? v : null; } catch (e) { return null; }
}
function writeDraft(d, rec) { try { sessionStorage.setItem(draftKey(d), JSON.stringify(rec)); } catch (e) { /* ignore */ } }
function clearDraft(d) { try { sessionStorage.removeItem(draftKey(d)); } catch (e) { /* ignore */ } }

function shortDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow} ${formatDate(iso)}`;
}

function YesNo({ label, value, onChange }) {
  return html`
    <div class="field"><span class="label" id=${`yn-${label}`}>${label}</span>
      <div class="yn" role="group" aria-labelledby=${`yn-${label}`}>
        <button type="button" class=${value === true ? 'on yes' : ''} aria-pressed=${value === true} onClick=${() => onChange(value === true ? null : true)}>Yes</button>
        <button type="button" class=${value === false ? 'on no' : ''} aria-pressed=${value === false} onClick=${() => onChange(value === false ? null : false)}>No</button>
      </div></div>`;
}

export function DiaryPage({ api, today, highlights, goals, currency = '$', reloadKey = 0, onSaveHighlight, onDeleteHighlight }) {
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState(null);
  const [base, setBase] = useState(null);
  const [version, setVersion] = useState(null);
  const [existing, setExisting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | saving
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [recent, setRecent] = useState({});
  const [hl, setHl] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const token = useRef(0);

  const last10 = Array.from({ length: 10 }, (_, i) => addDays(today, -i));

  async function loadRecent() {
    try {
      const all = await api.listDays();
      const want = last10.filter((d) => all.includes(d));
      const recs = await Promise.all(want.map((d) => api.loadDay(d)));
      const map = {};
      want.forEach((d, i) => { map[d] = recs[i].data; });
      setRecent(map);
    } catch (e) { /* the list is a convenience */ }
  }

  async function open(d) {
    const mine = ++token.current;
    setState('loading'); setErr(''); setMsg(''); setConfirmDelete(false);
    try {
      const r = await api.loadDay(d);
      if (mine !== token.current) return;
      const loaded = r.data ? { ...newDay(d), ...r.data } : newDay(d);
      setBase(loaded); setVersion(r.version); setExisting(!!r.data);
      const saved = readDraft(d);
      if (saved) { setDraft(saved); setDirty(true); setMsg('Your unsaved changes from earlier were restored.'); }
      else { setDraft(loaded); setDirty(false); }
      setState('ready');
    } catch (e) {
      if (mine !== token.current) return;
      setErr(e.message || String(e));
      setState('ready');
      setDraft((p) => p || newDay(d));
    }
  }

  useEffect(() => { open(date); }, [date]);
  // Claude may have added something while this page is open: refresh, unless you are in the middle of typing
  useEffect(() => { if (reloadKey && !dirty) open(date); loadRecent(); loadMonth(); }, [reloadKey]);
  const [month, setMonth] = useState(null);
  async function loadMonth() { try { setMonth((await api.loadMonth(today.slice(0, 7))).data); } catch (e) { /* optional */ } }
  useEffect(() => { loadMonth(); }, [today]);
  useEffect(() => { loadRecent(); }, []);
  useEffect(() => { if (dirty && draft) writeDraft(date, draft); }, [draft, dirty]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(patch) { setDraft((p) => ({ ...p, ...patch })); setDirty(true); setMsg(''); }
  const set = (k) => (e) => update({ [k]: e.target.value });

  function go(d) {
    if (d === date || !isValid(d)) return;
    if (dirty && !window.confirm('You have unsaved changes on this day. Leave without saving?')) return;
    clearDraft(date);
    setDate(d);
  }
  const isValid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today;

  async function save() {
    const rec = { ...cleanDay(draft), date, updatedAt: new Date().toISOString() };
    setState('saving'); setErr(''); setMsg('');
    try {
      const r = await api.saveDay(rec, version, base);
      const saved = { ...newDay(date), ...r.data };
      setBase(saved); setDraft(saved); setVersion(r.version); setExisting(true); setDirty(false); clearDraft(date);
      setMsg(r.conflicts && r.conflicts.length
        ? `Saved. ${r.conflicts.map((k) => FIELD_LABEL[k] || k).join(', ')} was also changed somewhere else (for example by Claude). Your version was kept.`
        : 'Saved.');
      loadRecent();
    } catch (e) {
      setErr(`Not saved: ${e.message || e}`);
    }
    setState('ready');
  }

  async function remove() {
    try {
      await api.deleteDay(date);
      clearDraft(date);
      setConfirmDelete(false);
      await open(date);
      setMsg('That day was deleted. Its highlights are still in Stories.');
      loadRecent();
    } catch (e) { setErr(`Could not delete: ${e.message || e}`); }
  }

  if (!draft) return html`<div class="card empty">${err || 'Opening your diary…'}</div>`;

  const missing = missingAnswers(cleanDay(draft));
  const dayHighlights = highlightsOn(highlights, date);
  const books = [...new Set(Object.values(recent).filter(Boolean).map((r) => r.bookTitle).filter(Boolean))];
  const busy = state === 'loading' || state === 'saving';
  const goal = (k, unit) => (goals && goals[k] ? html`<span class="small muted">Goal: ${goals[k]}${unit}</span>` : '');

  return html`
    <div class="row between">
      <div><h1>Diary</h1><div class="muted small" style="margin-top:4px">${formatLongDate(date)}${date === today ? ' · today' : ''}</div></div>
      <div class="row" style="gap:8px">
        <button class="icon-btn" aria-label="Previous day" onClick=${() => go(addDays(date, -1))}><${Icon} name="left" /></button>
        <input type="date" class="input" style="width:170px" aria-label="Choose a day" max=${today} value=${date} onChange=${(e) => go(e.target.value)} />
        <button class="icon-btn" aria-label="Next day" disabled=${date >= today} onClick=${() => go(addDays(date, 1))}><${Icon} name="right" /></button>
        ${date !== today && html`<button class="btn" onClick=${() => go(today)}>Today</button>`}
      </div>
    </div>

    ${err && html`<div class="banner err" role="alert">${err}</div>`}
    ${msg && html`<div class="banner info" role="status">${msg}</div>`}

    <div class="two">
      <div class="l">
        <div class="card pad">
          <h2>How was your day?</h2>
          <div class="moods" role="radiogroup" aria-label="Mood across the whole day">
            ${MOODS.map((m) => html`<button type="button" role="radio" aria-checked=${draft.mood === m} class=${draft.mood === m ? 'on' : ''}
              style=${draft.mood === m ? `border-color:${MOOD_COLOR[m]};background:${MOOD_COLOR[m]}22` : ''} onClick=${() => update({ mood: draft.mood === m ? '' : m })}>
              <span class="sw" style=${`background:${MOOD_COLOR[m]};border-radius:50%;width:12px;height:12px;margin:0`}></span>${m}</button>`)}
          </div>
          <div class="field"><label for="d-analysis">Mood in one line</label>
            <input id="d-analysis" class="input" maxlength="200" placeholder="Claude writes this when you diary in chat. You can also write it yourself." value=${draft.moodAnalysis} onInput=${set('moodAnalysis')} /></div>
        </div>

        <div class="card pad">
          <h2>The numbers</h2>
          <div class="grid2">
            <div class="field"><label for="d-water">Water (litres)</label><input id="d-water" class="input" type="number" inputmode="decimal" min="0" step="0.1" value=${draft.waterLitres ?? ''} onInput=${set('waterLitres')} />${goal('waterLitres', ' L')}</div>
            <div class="field"><label for="d-steps">Steps</label><input id="d-steps" class="input" type="number" inputmode="numeric" min="0" step="1" value=${draft.steps ?? ''} onInput=${set('steps')} />${goal('steps', '')}</div>
            <div class="field"><label for="d-pages">Pages read</label><input id="d-pages" class="input" type="number" inputmode="numeric" min="0" step="1" value=${draft.pagesRead ?? ''} onInput=${set('pagesRead')} />${goal('pagesRead', '')}</div>
            <div class="field"><label for="d-money">Money spent (${currency})</label><input id="d-money" class="input" type="number" inputmode="decimal" min="0" step="1" value=${draft.spentRupees ?? ''} onInput=${set('spentRupees')} />${goal('spendRupees', '')}</div>
          </div>
          <div class="field"><label for="d-book">Book you are reading (optional)</label>
            <input id="d-book" class="input" list="book-list" value=${draft.bookTitle} onInput=${set('bookTitle')} placeholder="Title" />
            <datalist id="book-list">${books.map((b) => html`<option value=${b}></option>`)}</datalist></div>
        </div>

        <div class="card pad">
          <h2>Entertainment</h2>
          <div class="grid2">
            <${YesNo} label="Watched something" value=${draft.movie} onChange=${(v) => update({ movie: v })} />
            <${YesNo} label="Did an activity today" value=${draft.activity} onChange=${(v) => update({ activity: v })} />
          </div>
          ${draft.activity === true && html`<div class="field"><label for="d-activity">Which activity?</label><input id="d-activity" class="input" value=${draft.activityName} onInput=${set('activityName')} placeholder="For example a walk, yoga, gym, dance, cycling or singing" /></div>`}
          ${draft.movie === true && html`<div class="field"><label for="d-movie">What did you watch?</label><input id="d-movie" class="input" value=${draft.movieName} onInput=${set('movieName')} placeholder="Movie, show or series, e.g. Inception or Stranger Things S2" /></div>`}
        </div>

        <div class="card pad">
          <div class="field"><label for="d-cal"><h2 style="display:inline">Calories eaten</h2></label>
            <input id="d-cal" class="input" type="number" inputmode="numeric" min="0" step="1" value=${draft.calories ?? ''} onInput=${set('calories')} placeholder="Total kcal for the day, an estimate is fine" />${goal('calories', ' kcal')}</div>
        </div>

        <div class="card pad">
          <div class="field"><label for="d-diary"><h2 style="display:inline">Your diary</h2></label>
            <textarea id="d-diary" class="input" style="min-height:220px" value=${draft.diary} onInput=${set('diary')} placeholder="Write about your day, however it comes out. This text only opens on this page."></textarea></div>
        </div>

        <div class="card pad">
          <div class="row between"><h2>Highlights for this day</h2>
            <button class="btn" onClick=${() => setHl({ h: newHighlight({ date }), isNew: true })}><${Icon} name="plus" size=${18} />Add highlight</button></div>
          <div class="small muted">One or two lines that go into your life stories. They save on their own.</div>
          ${dayHighlights.length === 0 ? html`<div class="muted small">No highlights for this day yet.</div>`
            : dayHighlights.map((h) => html`<${HighlightLine} key=${h.id} h=${h} onEdit=${(x) => setHl({ h: x, isNew: false })} />`)}
        </div>

        <div class="card pad" style="position:sticky;bottom:12px;z-index:2">
          ${missing.length > 0 && html`<div class="small muted">Still unanswered: ${missing.join(', ')}</div>`}
          <div class="row between">
            <div class="row">
              <button class="btn primary" disabled=${busy || !dirty} onClick=${save}>${state === 'saving' ? 'Saving…' : existing ? 'Save changes' : 'Save this day'}</button>
              <span class="small muted" role="status">${dirty ? 'Unsaved changes' : existing ? 'Saved' : ''}</span>
            </div>
            ${existing && (confirmDelete
              ? html`<div class="row"><span class="small">Delete this day for good?</span><button class="btn danger" onClick=${remove}>Yes, delete</button><button class="btn" onClick=${() => setConfirmDelete(false)}>Keep</button></div>`
              : html`<button class="btn danger" onClick=${() => setConfirmDelete(true)}><${Icon} name="trash" size=${18} />Delete day</button>`)}
          </div>
        </div>
      </div>

      <div class="r">
        <div class="card pad">
          <h2>Last 10 days</h2>
          <div class="small muted">Tap a day to open it. Catch up on days you missed.</div>
          ${last10.map((d) => {
            const r = recent[d];
            const answered = r ? 8 - missingAnswers({ ...newDay(d), ...r }).length : 0;
            return html`<button class=${`dayrow${d === date ? ' sel' : ''}`} onClick=${() => go(d)} aria-current=${d === date ? 'date' : undefined}>
              <span style="flex:1;text-align:left">${shortDay(d)}</span>
              ${r ? html`<span class="small muted">${answered}/8</span>${r.mood ? html`<${Pill} bg=${MOOD_COLOR[r.mood] + '33'} fg="#25201C">${r.mood}<//>` : ''}` : html`<span class="small muted">Not logged</span>`}
            </button>`;
          })}
        </div>
        ${month && html`<div class="card pad">
          <h2>This month so far</h2>
          <div style="line-height:1.55">${month.summary}</div>
          <div class="small muted">Written by Claude, covers up to ${formatLongDate(month.summarizedThrough)}.</div>
        </div>`}
      </div>
    </div>

    ${hl && html`<${HighlightModal} key=${hl.h.id} h=${hl.h} isNew=${hl.isNew} today=${today}
      onSave=${(h) => { onSaveHighlight(h); setHl(null); }} onDelete=${(id) => { onDeleteHighlight(id); setHl(null); }} onClose=${() => setHl(null)} />`}`;
}
