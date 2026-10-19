import { html, useState, useEffect, Icon, Pill, URG } from './ui.js';
import { MOODS, MOOD_SCORE, MOOD_COLOR, addDays, formatLongDate, formatDate, highlightsOn, needsAttention, urgency } from './logic.js';
import { dayTiles, allowance } from './stats.js';
import { loadMonthDays } from './daysCache.js';
import { HighlightLine } from './highlights.js';

const MOOD_INK = { Great: '#1F6B40', Good: '#4E7A1F', Okay: '#8A6A00', Low: '#9A4F0A', Rough: '#A52A2A' };
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—');

function Tile({ label, value, unit, goal, goalUnit = '', prefix = '', pct, color, over }) {
  return html`
    <div class="tile">
      <div class="small muted">${label}</div>
      <div><span class="big">${value == null ? '—' : prefix + fmt(value)}</span>${goal != null ? html`<span class="muted"> / ${prefix}${fmt(goal)}${goalUnit}</span>` : unit ? html`<span class="muted"> ${unit}</span>` : ''}</div>
      ${pct != null && html`<div class="bar" role="img" aria-label=${`${pct}% of the goal${over ? ', over the goal' : ''}`}><div style=${`width:${pct}%;background:${color}`}></div></div>`}
    </div>`;
}

function YesNoPill({ label, value, detail }) {
  const style = value === true ? ['#E0F1E6', '#24663F'] : value === false ? ['#EEE9E2', '#6F665E'] : ['#F3EFE8', '#8A8178'];
  return html`<div class="tile row between" style="flex-wrap:nowrap">
    <div style="min-width:0"><div>${label}</div>${detail && html`<div class="small muted" style="overflow-wrap:anywhere">${detail}</div>`}</div>
    <${Pill} bg=${style[0]} fg=${style[1]}>${value === true ? 'Yes' : value === false ? 'No' : 'Not answered'}<//></div>`;
}

function SpentTile({ a, currency, isToday }) {
  const r = a.rows[a.rows.length - 1];
  const m = (v) => `${v < 0 ? '−' : ''}${currency}${Math.round(Math.abs(v)).toLocaleString()}`;
  const pct = r.avail > 0 ? Math.min(100, Math.round((r.spent / r.avail) * 100)) : 100;
  const over = r.after < 0;
  return html`
    <div class="tile">
      <div class="small muted">Spent</div>
      <div><span class="big">${r.logged ? m(r.spent) : '—'}</span><span class="muted"> / ${m(r.avail)} available</span></div>
      <div class="bar" role="img" aria-label=${`${pct}% of the available money${over ? ', overspent' : ''}`}><div style=${`width:${pct}%;background:${over ? '#A52A2A' : '#C2650F'}`}></div></div>
      <div class="small" style=${`margin-top:4px;color:${over ? '#A52A2A' : '#24663F'}`}>${over ? `${m(r.after)} is taken from the next days` : `${m(r.after)} carries over${isToday ? ` · tomorrow you can spend ${m(r.after + a.daily)}` : ''}`}</div>
    </div>`;
}

export function TodayPage({ api, today, goals, currency = '$', highlights, tasks, reloadKey = 0, onOpenTask }) {
  const [date, setDate] = useState(today);
  const [rec, setRec] = useState(undefined); // undefined = loading, null = no record
  const [err, setErr] = useState('');
  const [allow, setAllow] = useState(null);
  const daily = goals.spendRupees > 0 ? goals.spendRupees : 0;

  useEffect(() => {
    let live = true;
    setRec(undefined); setErr('');
    api.loadDay(date).then((r) => { if (live) setRec(r.data); }).catch((e) => { if (live) { setErr(e.message || String(e)); setRec(null); } });
    return () => { live = false; };
  }, [date, reloadKey]);

  useEffect(() => {
    let live = true;
    if (!daily || rec === undefined) { setAllow(null); return undefined; }
    loadMonthDays(api, date.slice(0, 7)).then((days) => {
      if (!live) return;
      if (rec) days = new Map(days).set(date, rec);
      const a = allowance(days, date.slice(0, 7), date, daily);
      setAllow(a.rows.length ? a : null);
    }).catch(() => live && setAllow(null));
    return () => { live = false; };
  }, [date, rec, daily, reloadKey]);

  const [y, m, d] = date.split('-').map(Number);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const monthWord = formatLongDate(date).split(', ')[1].replace(/\s\d{4}$/, '');
  const t = dayTiles(rec, goals);
  const score = rec && MOOD_SCORE[rec.mood];
  const attn = needsAttention(tasks, today).slice(0, 4);
  const stories = highlightsOn(highlights, date);

  return html`
    <div class="row between">
      <div>
        <div class="small muted" style="letter-spacing:0.04em;text-transform:uppercase">${weekday}${date === today ? ' · today' : ''}</div>
        <h1>${monthWord}</h1>
      </div>
      <div class="row" style="gap:8px">
        <button class="icon-btn" aria-label="Previous day" onClick=${() => setDate(addDays(date, -1))}><${Icon} name="left" /></button>
        <button class="icon-btn" aria-label="Next day" disabled=${date >= today} onClick=${() => setDate(addDays(date, 1))}><${Icon} name="right" /></button>
        ${date !== today && html`<button class="btn" onClick=${() => setDate(today)}>Today</button>`}
      </div>
    </div>
    ${err && html`<div class="banner err" role="alert">${err}</div>`}

    <div class="two">
      <div class="l">
        <div class="card pad">
          <div class="small muted">Mood ${date === today ? 'today' : 'that day'}</div>
          ${rec === undefined ? html`<div class="muted" style="padding:14px 0">Loading…</div>` : html`
            <div class="row" style="gap:14px;flex-wrap:nowrap;margin-top:4px">
              <div style=${`font-family:var(--serif);font-weight:600;font-size:40px;line-height:1.1;color:${score ? MOOD_INK[rec.mood] : '#8A8178'}`}>${score ? rec.mood : '—'}</div>
              <div style="flex:1;display:flex;gap:4px" role="img" aria-label=${score ? `Mood meter: ${score} of 5` : 'Mood not answered'}>
                ${MOODS.slice().reverse().map((mo) => html`<div style=${`flex:1;height:10px;border-radius:5px;background:${MOOD_COLOR[mo]};opacity:${score === MOOD_SCORE[mo] ? 1 : 0.3}`}></div>`)}
              </div>
            </div>
            ${rec && rec.moodAnalysis && html`<div class="read"><b>Claude's read</b> · ${rec.moodAnalysis}</div>`}
            ${!rec && html`<div class="read">Nothing logged for this day yet. <a href="#/diary">Open the Diary</a> or say “diary time” to Claude.</div>`}`}
        </div>

        <div class="tiles">
          <${Tile} label="Water" value=${t.water.value} goal=${t.water.goal} goalUnit=" L" unit="L" pct=${t.water.pct} color="#2A7FA8" over=${t.water.over} />
          <${Tile} label="Steps" value=${t.steps.value} goal=${t.steps.goal} pct=${t.steps.pct} color="#1E6B5A" over=${t.steps.over} />
          <${Tile} label="Pages read" value=${t.pages.value} goal=${t.pages.goal} pct=${t.pages.pct} color="#3B6FB6" over=${t.pages.over} />
          ${allow ? html`<${SpentTile} a=${allow} currency=${currency} isToday=${date === today} />`
            : html`<${Tile} label="Spent" value=${t.spent.value} goal=${daily ? null : t.spent.goal} prefix=${currency} pct=${daily ? null : t.spent.pct} color=${t.spent.over ? '#A52A2A' : '#C2650F'} over=${t.spent.over} />`}
        </div>
        ${rec && rec.bookTitle && html`<div class="small muted">Reading: <b style="color:var(--ink)">${rec.bookTitle}</b></div>`}

        <div class="tiles">
          <${YesNoPill} label="Watched something" value=${rec ? rec.movie : null} detail=${rec && rec.movie ? rec.movieName : ''} />
          <${YesNoPill} label="Did an activity" value=${rec ? rec.activity : null} detail=${rec && rec.activity ? rec.activityName : ''} />
        </div>

        <div class="tiles">
          <${Tile} label="Calories eaten" value=${t.calories.value} goal=${t.calories.goal} goalUnit=" kcal" unit="kcal" pct=${t.calories.pct} color=${t.calories.over ? '#A52A2A' : '#7A5BB5'} over=${t.calories.over} />
        </div>
      </div>

      <div class="r">
        <div class="card pad">
          <div class="row between"><h2>Needs attention</h2><a href="#/board" class="small">Open board</a></div>
          ${attn.length === 0 ? html`<div class="muted small">Nothing due in the next 7 days.</div>` : attn.map((tk) => {
            const u = urgency(tk, today);
            return html`<button class="attn" onClick=${() => onOpenTask(tk)}>
              <span style="flex:1;min-width:0"><span style="display:block;font-weight:500">${tk.title}</span><span class="small muted">${[tk.project, tk.priority].filter(Boolean).join(' · ')}</span></span>
              <${Pill} bg=${URG[u].pillBg} fg=${URG[u].pillFg}>${u}<//></button>`;
          })}
        </div>
        <div class="card pad">
          <h2>${date === today ? 'Added to your stories today' : `Stories on ${formatDate(date)}`}</h2>
          ${stories.length === 0 ? html`<div class="muted small">No highlights for this day.</div>` : stories.map((h) => html`<${HighlightLine} key=${h.id} h=${h} />`)}
        </div>
      </div>
    </div>`;
}
