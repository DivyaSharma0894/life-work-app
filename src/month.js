import { html, useState, useEffect, useMemo, Icon } from './ui.js';
import { MOODS, MOOD_COLOR, MOOD_SCORE, CATEGORIES, CATEGORY_COLOR, formatDate, formatLongDate } from './logic.js';
import { allowance, monthStats, taskMonthStats, highlightCounts, monthlyRows, priorMaxActivity, prevMonth, nextMonth, monthName, moodWord } from './stats.js';
import { loadAllDays } from './daysCache.js';

const num = (v, d = 1) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
const dayNums = (list) => list.map((d) => Number(d.slice(8))).join(', ');

function MoodChart({ s, ym }) {
  const W = 640, H = 210, pl = 54, pr = 16, pt = 14, pb = 30;
  const n = Math.max(s.last, 2);
  const xs = (i) => pl + i * ((W - pl - pr) / (n - 1));
  const ys = (v) => pt + (5 - v) * ((H - pt - pb) / 4);
  const pts = s.mood.series.map((v, i) => (v ? [xs(i), ys(v), v] : null));
  // draw the line in runs, so a day with no answer leaves a gap instead of a false slope
  const runs = [];
  let cur = [];
  pts.forEach((p) => { if (p) cur.push(p); else { if (cur.length) runs.push(cur); cur = []; } });
  if (cur.length) runs.push(cur);
  const ticks = [...new Set([1, Math.ceil(s.last / 3), Math.ceil((2 * s.last) / 3), s.last])].filter((d) => d >= 1);
  return html`<svg viewBox=${`0 0 ${W} ${H}`} style="width:100%;height:auto" role="img" aria-label=${`Mood for each day of ${monthName(ym)}, average ${s.mood.avg == null ? 'unknown' : moodWord(s.mood.avg)}`}>
    ${MOODS.slice().reverse().map((m) => html`<g><line x1=${pl} x2=${W - pr} y1=${ys(MOOD_SCORE[m])} y2=${ys(MOOD_SCORE[m])} stroke="#EEE8DF" /><text x=${pl - 8} y=${ys(MOOD_SCORE[m]) + 4} text-anchor="end" font-size="12" fill="#6F665E">${m}</text></g>`)}
    ${runs.map((r) => r.length > 1 && html`<polyline points=${r.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="#9A9087" stroke-width="2" />`)}
    ${pts.map((p) => p && html`<circle cx=${p[0].toFixed(1)} cy=${p[1].toFixed(1)} r="5" fill=${MOOD_COLOR[MOODS.find((m) => MOOD_SCORE[m] === p[2])]} stroke="#fff" stroke-width="1.5" />`)}
    ${ticks.map((d) => html`<text x=${xs(d - 1)} y=${H - 8} text-anchor="middle" font-size="12" fill="#6F665E">${d}</text>`)}
  </svg>`;
}

function BarChart({ title, big, sub, values, max, goal, goalLabel, colorOf, note, label }) {
  const m = Math.max(max || 0, goal || 0, ...values.filter((v) => v != null), 1);
  const pct = (v) => Math.max(v > 0 ? 3 : 0, Math.round((v / m) * 100));
  return html`<div class="card pad">
    <div class="small muted">${title}</div>
    <div><span style="font-family:var(--serif);font-weight:600;font-size:26px">${big}</span></div>
    <div class="small muted" style="margin-bottom:10px">${sub}</div>
    <div class="bars" role="img" aria-label=${label}>
      ${goal > 0 && html`<div class="goalline" style=${`bottom:${(goal / m) * 100}%`}></div><div class="goaltext" style=${`bottom:calc(${(goal / m) * 100}% + 2px)`}>${goalLabel}</div>`}
      ${values.map((v, i) => html`<i title=${v == null ? 'No answer' : String(v)} style=${`height:${v == null ? 0 : pct(v)}%;background:${v == null ? 'transparent' : colorOf(v)}`}></i>`)}
    </div>
    <div class="axis"><span>1</span><span>${Math.ceil(values.length / 2)}</span><span>${values.length}</span></div>
    <div class="small muted" style="margin-top:6px">${note}</div>
  </div>`;
}

function AllowanceCard({ a, ym, currency }) {
  const [all, setAll] = useState(false);
  const cur = (v) => `${v < 0 ? '−' : ''}${currency}${Math.round(Math.abs(v)).toLocaleString()}`;
  const rows = a.rows;
  if (!rows.length) return null;
  const W = 960, H = 230, pl = 48, pr = 8, pt = 26, pb = 26;
  const maxV = Math.max(1, ...rows.map((r) => Math.max(r.avail, r.spent)));
  const step = maxV > 4000 ? 2000 : maxV > 2000 ? 1000 : 500;
  const top = Math.ceil(maxV / step) * step;
  const bw = (W - pl - pr) / rows.length;
  const y = (v) => pt + (1 - v / top) * (H - pt - pb);
  const showAll = bw >= 40;
  const bars = [];
  for (let v = 0; v <= top; v += step) bars.push(html`<g><line x1=${pl} x2=${W - pr} y1=${y(v)} y2=${y(v)} stroke="#EEE8DF" /><text x=${pl - 6} y=${y(v) + 4} text-anchor="end" font-size="11" fill="#6F665E">${v.toLocaleString()}</text></g>`);
  rows.forEach((r, i) => {
    const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
    const availH = Math.max(0, y(0) - y(Math.max(r.avail, 0)));
    const inside = Math.max(0, Math.min(r.spent, r.avail));
    const tipY = Math.min(y(Math.max(r.avail, 0)), y(r.spent));
    const label = r.after >= 0 ? `→${Math.round(r.after)}` : `−${Math.round(Math.abs(r.after))}`;
    const showLabel = showAll || r.after < 0 || i === rows.length - 1;
    bars.push(html`<g>
      <title>${`Day ${r.day}: available ${cur(r.avail)}, spent ${r.logged ? cur(r.spent) : 'not logged'}, ${r.after >= 0 ? 'carries over' : 'overspent by'} ${cur(Math.abs(r.after))}`}</title>
      <rect x=${x} y=${y(Math.max(r.avail, 0))} width=${w} height=${availH} rx="4" fill=${r.logged ? '#CFE4DB' : '#EDEAE4'} />
      ${inside > 0 && html`<rect x=${x} y=${y(inside)} width=${w} height=${y(0) - y(inside)} rx="4" fill="#1E6B5A" />`}
      ${r.spent > Math.max(r.avail, 0) && html`<rect x=${x} y=${y(r.spent)} width=${w} height=${y(Math.max(r.avail, 0)) - y(r.spent)} rx="4" fill="#C93A3A" />`}
      ${showLabel && html`<text x=${x + w / 2} y=${tipY - 5} text-anchor="middle" font-size="10" font-weight="700" fill=${r.after >= 0 ? '#24663F' : '#A52A2A'}>${label}</text>`}
      ${(rows.length <= 16 || r.day % 5 === 0 || r.day === 1 || i === rows.length - 1) && html`<text x=${x + w / 2} y=${H - 8} text-anchor="middle" font-size="11" fill="#6F665E">${r.day}</text>`}
    </g>`);
  });
  // balance line
  const BH = 150, bt = 12, bb = 22;
  const vals = rows.map((r) => r.after);
  const mx = Math.max(a.daily, ...vals), mn = Math.min(-a.daily, ...vals);
  const bx = (i) => pl + (rows.length === 1 ? 0 : i * ((W - pl - pr) / (rows.length - 1)));
  const by = (v) => bt + (1 - (v - mn) / (mx - mn)) * (BH - bt - bb);
  const list = all ? rows.slice().reverse() : rows.slice(-8).reverse();
  const bal = a.balance;
  return html`<div class="card pad">
    <div class="row between"><h2>Spending allowance · ${monthName(ym)}</h2><span class="small muted">${currency}${a.daily.toLocaleString()} a day · month budget ${currency}${a.budget.toLocaleString()} (${Math.round(a.budget / a.daily)} days)</span></div>
    <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="tile"><div class="small muted">Available today</div><div><span class="big">${cur(a.availableToday)}</span></div><div class="small muted">${a.availableToday - a.daily < 0 ? `${currency}${a.daily.toLocaleString()} minus ${cur(a.daily - a.availableToday)} overspent earlier` : `${currency}${a.daily.toLocaleString()} + ${cur(a.availableToday - a.daily)} carried`}</div></div>
      <div class="tile"><div class="small muted">Allowed so far</div><div><span class="big">${cur(a.allowedSoFar)}</span></div><div class="small muted">${rows.length} day${rows.length === 1 ? '' : 's'} × ${currency}${a.daily.toLocaleString()}</div></div>
      <div class="tile"><div class="small muted">Spent so far</div><div><span class="big">${cur(a.spentSoFar)}</span></div><div class="small muted">${cur(a.spentSoFar / rows.length)} per day</div></div>
      <div class="tile"><div class="small muted">Balance in hand</div><div><span class="big" style=${`color:${bal < 0 ? '#A52A2A' : '#24663F'}`}>${bal >= 0 ? '+' : ''}${cur(bal)}</span></div><div class="small muted">${bal < 0 ? 'overspent, taken from the next days' : 'after today’s spending'}</div></div>
    </div>
    ${a.unloggedBefore > 0 && html`<div class="banner" style="margin-top:8px"><span>${a.unloggedBefore} earlier day${a.unloggedBefore === 1 ? ' has' : 's have'} no spending logged. Those days count as ${currency}0 spent, so the allowance carried over. Fill them in the Diary if you spent something.</span></div>`}
    <div class="k" style="margin-top:10px">
      <span><i style="background:#CFE4DB"></i>Available that day (${currency}${a.daily.toLocaleString()} + carried over)</span>
      <span><i style="background:#1E6B5A"></i>Spent</span>
      <span><i style="background:#C93A3A"></i>Spent more than available</span>
      <span><i style="background:#EDEAE4"></i>Not logged</span>
    </div>
    <svg viewBox=${`0 0 ${W} ${H}`} style="width:100%;height:auto" role="img" aria-label=${`Each day: money available, money spent, and what carries over. Balance now ${cur(bal)}.`}>${bars}</svg>
    <div class="small muted">The number above a bar is what carries to the next day (→300), or the overspend taken from it (−150). Hover a bar for the details.</div>
    <div class="small muted" style="margin-top:12px">Balance after each day: above the line is money still available, below it you have spent more than allowed so far.</div>
    <svg viewBox=${`0 0 ${W} ${BH}`} style="width:100%;height:auto" role="img" aria-label="Balance after each day">
      <rect x=${pl} y=${by(0)} width=${W - pl - pr} height=${Math.max(0, by(mn) - by(0))} fill="#FBE1DE" opacity="0.6" />
      <line x1=${pl} x2=${W - pr} y1=${by(0)} y2=${by(0)} stroke="#6F665E" stroke-dasharray="4 4" />
      <text x=${pl - 6} y=${by(0) + 4} text-anchor="end" font-size="11" fill="#6F665E">0</text>
      <polyline fill="none" stroke="#1E6B5A" stroke-width="2" points=${rows.map((r, i) => `${bx(i)},${by(r.after)}`).join(' ')} />
      ${rows.map((r, i) => html`<circle cx=${bx(i)} cy=${by(r.after)} r=${rows.length > 20 ? 3.5 : 5} fill=${r.after >= 0 ? '#1E6B5A' : '#C93A3A'} stroke="#fff" stroke-width="1.5"><title>${`Day ${r.day}: balance ${cur(r.after)}`}</title></circle>`)}
      <text x=${W - pr} y=${by(mn) - 6} text-anchor="end" font-size="11" fill="#A52A2A">overspent</text>
    </svg>
    <div class="row between" style="margin-top:14px"><h3 style="font-size:16px">Day by day</h3>${rows.length > 8 && html`<button class="btn ghost" onClick=${() => setAll(!all)}>${all ? 'Show last 8 days' : `Show all ${rows.length} days`}</button>`}</div>
    <div class="tablewrap"><table class="mt"><thead><tr><th>Day</th><th>Available</th><th>Spent</th><th>Carries over</th></tr></thead><tbody>
      ${list.map((r) => html`<tr><td>${formatDate(r.date)}</td><td>${cur(r.avail)}</td><td>${r.logged ? cur(r.spent) : html`<span class="muted">not logged</span>`}</td><td style=${`color:${r.after < 0 ? '#A52A2A' : '#24663F'};font-weight:700`}>${r.after < 0 ? '' : '+'}${cur(r.after)}</td></tr>`)}
    </tbody></table></div>
  </div>`;
}

export function MonthPage({ api, today, goals, currency = '$', tasks, highlights, reloadKey = 0 }) {
  const [ym, setYm] = useState(today.slice(0, 7));
  const [days, setDays] = useState(null);
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setErr('');
    loadAllDays(api, { onProgress: (d, t) => live && setProgress(t > 20 ? `Loading your days… ${d} of ${t}` : '') })
      .then((m) => { if (live) { setDays(m); setProgress(''); } })
      .catch((e) => { if (live) setErr(e.message || String(e)); });
    return () => { live = false; };
  }, [reloadKey]);
  useEffect(() => {
    let live = true;
    setSummary(null);
    api.loadMonth(ym).then((r) => { if (live) setSummary(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [ym, reloadKey]);

  const stats = useMemo(() => (days ? monthStats(days, ym, today, goals, { priorMaxActivity: priorMaxActivity(days, ym) }) : null), [days, ym, today, goals]);
  const rows = useMemo(() => (days ? monthlyRows(days, tasks, today) : []), [days, tasks, today]);
  const ts = taskMonthStats(tasks, ym, today);
  const daily = goals.spendRupees > 0 ? goals.spendRupees : 0;
  const allow = useMemo(() => (days && daily ? allowance(days, ym, today, daily) : null), [days, ym, today, daily]);
  const hc = highlightCounts(highlights, ym);
  const hMax = Math.max(1, ...Object.values(hc));
  const hTotal = Object.values(hc).reduce((a, b) => a + b, 0);
  const future = ym > today.slice(0, 7);
  const prompt = `Open the folder "Life & Work App" in my Google Drive and read README.md first. Then summarize my ${monthName(ym)} ${ym.slice(0, 4)}: read months/${ym}.json if it exists and only the days after its "summarizedThrough" date, then send an updated summary through the inbox.`;

  if (!stats) return html`<div><h1>Month</h1></div><div class="card empty">${err || progress || 'Loading your days…'}</div>`;
  const s = stats;
  const moodMax = Math.max(1, ...Object.values(s.mood.mix));

  return html`
    <div class="row between">
      <div class="row" style="gap:10px">
        <button class="icon-btn" aria-label="Previous month" onClick=${() => setYm(prevMonth(ym))}><${Icon} name="left" /></button>
        <h1>${monthName(ym)} ${ym.slice(0, 4)}</h1>
        <button class="icon-btn" aria-label="Next month" disabled=${ym >= today.slice(0, 7)} onClick=${() => setYm(nextMonth(ym))}><${Icon} name="right" /></button>
      </div>
      <button class="btn" onClick=${async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch (e) { setCopied(false); } }}>${copied ? 'Copied. Paste it in Claude' : 'Month review with Claude'}</button>
    </div>
    ${err && html`<div class="banner err" role="alert">${err}</div>`}

    <div class="card pad">
      <h2>The month so far</h2>
      ${summary ? html`<div style="line-height:1.6;max-width:820px">${summary.summary}</div>
        <div class="small muted">Written by Claude · Summarized through ${formatLongDate(summary.summarizedThrough)}</div>`
        : html`<div class="muted">${future ? 'This month has not started.' : 'No summary yet. Press “Month review with Claude”, paste the message in Claude, and it appears here.'}</div>`}
    </div>

    ${s.logged === 0 ? html`<div class="card empty">Nothing logged in ${monthName(ym)} yet.</div>` : html`
    <div class="tiles3">
      <div class="tile"><div class="small muted">Average mood</div><div><span class="big">${s.mood.avg == null ? '—' : moodWord(s.mood.avg)}</span></div>
        <div class="small muted">${s.mood.avg == null ? 'No mood answers' : `${num(s.mood.avg)} of 5 across ${s.mood.n} days`}</div></div>
      <div class="tile"><div class="small muted">Money spent</div><div><span class="big">${currency}${num(s.money.total, 0)}</span></div>
        <div class="small muted">${s.money.perDay == null ? '' : `${currency}${num(s.money.perDay, 0)} per day`}${s.money.changePct != null ? ` · ${Math.abs(s.money.changePct)}% ${s.money.changePct < 0 ? 'below' : 'above'} ${s.money.prevName}` : ''}</div></div>
      <div class="tile"><div class="small muted">Steps per day</div><div><span class="big">${num(s.steps.avg, 0)}</span></div>
        <div class="small muted">${num(s.steps.total, 0)} in total${goals.steps > 0 ? ` · goal ${num(goals.steps, 0)}` : ''}</div></div>
      <div class="tile"><div class="small muted">Water per day</div><div><span class="big">${num(s.water.avg)}</span><span class="muted"> L</span></div>
        <div class="small muted">${goals.waterLitres > 0 ? `Goal ${goals.waterLitres} L · ` : ''}${s.water.under2.length} day${s.water.under2.length === 1 ? '' : 's'} under 2 L</div></div>
      <div class="tile"><div class="small muted">Pages read</div><div><span class="big">${num(s.pages.total, 0)}</span></div>
        <div class="small muted">${s.pages.readingDays} reading days${s.pages.streak > 1 ? ` · ${s.pages.streak}-day streak` : ''}</div></div>
      <div class="tile"><div class="small muted">Watched something · Active days</div><div><span class="big">${s.movies.days} · ${s.activity.count}</span></div>
        <div class="small muted">Days watched · days active${s.activity.bestYet ? ' · best month yet' : ''}${s.activity.names.length ? ` (${s.activity.names.slice(0, 4).join(', ')})` : ''}</div></div>
    </div>

    <div class="card pad">
      <div class="row between"><h2>Mood, day by day</h2><span class="small muted">1 to ${s.last} ${monthName(ym).slice(0, 3)}</span></div>
      <${MoodChart} s=${s} ym=${ym} />
      <div class="two" style="margin-top:8px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <div>
          <div class="small muted">Mood mix</div>
          ${MOODS.slice().reverse().map((m) => html`<div class="hbar"><span style="width:56px">${m}</span><div class="track"><div style=${`width:${(s.mood.mix[m] / moodMax) * 100}%;background:${MOOD_COLOR[m]}`}></div></div><b style="width:24px;text-align:right">${s.mood.mix[m]}</b></div>`)}
        </div>
        <div style="line-height:1.7">
          ${s.mood.best.length > 0 && html`<div><b>Best days</b> · ${dayNums(s.mood.best.slice(0, 6))} ${monthName(ym).slice(0, 3)}</div>`}
          ${s.mood.hardest.length > 0 && html`<div><b>Hardest days</b> · ${dayNums(s.mood.hardest.slice(0, 6))} ${monthName(ym).slice(0, 3)}</div>`}
        </div>
      </div>
    </div>

 ${allow && html`<${AllowanceCard} a=${allow} ym=${ym} currency=${currency} />`}
    <div class="charts">
      ${!allow && html`<${BarChart} title="Money spent" big=${`${currency}${num(s.money.total, 0)}`} sub=${s.money.perDay == null ? '' : `${currency}${num(s.money.perDay, 0)} per day`} values=${s.money.series} goal=${goals.spendRupees} goalLabel=${`Goal ${currency}${goals.spendRupees}`}
        colorOf=${(v) => (goals.spendRupees > 0 && v > goals.spendRupees ? '#C2650F' : '#1E6B5A')} label="Bar chart of money spent per day"
        note="Set a daily spending allowance in Settings to see how much you can spend each day, with unspent money carrying over." />`}
      <${BarChart} title="Steps" big=${`${num(s.steps.avg, 0)} avg`} sub=${`${num(s.steps.total, 0)} steps in total`} values=${s.steps.series} goal=${goals.steps} goalLabel=${`Goal ${num(goals.steps, 0)}`}
        colorOf=${(v) => (goals.steps > 0 && v >= goals.steps ? '#1E6B5A' : '#A9CBC1')} label="Bar chart of steps per day" note=${`Dark bars reached the goal: ${s.steps.goalDays} day${s.steps.goalDays === 1 ? '' : 's'} so far.`} />
      <${BarChart} title="Water" big=${`${num(s.water.avg)} L avg`} sub=${`${s.water.under2.length} day${s.water.under2.length === 1 ? '' : 's'} under 2 L`} values=${s.water.series} goal=${goals.waterLitres} goalLabel=${`Goal ${goals.waterLitres} L`}
        colorOf=${(v) => (v < 2 ? '#E08A2D' : '#2A7FA8')} label="Bar chart of water per day" note=${s.water.under2.length ? `Orange bars are low-intake days (under 2 L): ${dayNums(s.water.under2)} ${monthName(ym).slice(0, 3)}.` : 'No low-intake days.'} />
 <${BarChart} title="Calories" big=${s.calories.avg == null ? '—' : `${num(s.calories.avg, 0)} kcal avg`} sub=${goals.calories > 0 ? `${s.calories.overGoalDays} day${s.calories.overGoalDays === 1 ? '' : 's'} over the goal` : 'Set a calorie goal in Settings'} values=${s.calories.series} goal=${goals.calories} goalLabel=${`Goal ${num(goals.calories, 0)}`}
        colorOf=${(v) => (goals.calories > 0 && v > goals.calories ? '#C2650F' : '#7A5BB5')} label="Bar chart of calories eaten per day" note=${goals.calories > 0 ? 'Orange bars went over your daily calorie goal.' : 'Add a goal in Settings to see which days went over.'} />
      <${BarChart} title="Pages read" big=${`${num(s.pages.total, 0)} pages`} sub=${`${s.pages.readingDays} reading days${s.pages.streak > 1 ? `, ${s.pages.streak}-day streak` : ''}`} values=${s.pages.series} goal=${goals.pagesRead} goalLabel=${`Goal ${goals.pagesRead}`}
        colorOf=${(v) => (goals.pagesRead > 0 && v >= goals.pagesRead ? '#3B6FB6' : '#AFC1E0')} label="Bar chart of pages read per day" note="Days without a bar are days you did not read." />
    </div>`}

    <div class="charts">
      <div class="card pad">
        <h2>Tasks this month</h2>
        <div class="row" style="gap:20px;flex-wrap:nowrap;margin-top:10px">
          <div class="donut" style=${`background:conic-gradient(#2E8B57 0 ${ts.pct}%, #E4DDD2 0)`} role="img" aria-label=${`${ts.pct}% complete`}><div><div style="font-family:var(--serif);font-weight:600;font-size:24px;line-height:1">${ts.pct}%</div></div></div>
          <div style="display:flex;flex-direction:column;gap:6px"><div><b>${ts.completed}</b> completed</div><div><b>${ts.open}</b> still open</div><div style=${ts.overdue ? 'color:#A52A2A' : ''}><b>${ts.overdue}</b> overdue</div></div>
        </div>
      </div>
      <div class="card pad">
        <div class="row between"><h2>Highlights by category</h2><a href="#/stories" class="small">Read stories</a></div>
        ${hTotal === 0 ? html`<div class="muted small" style="margin-top:8px">No highlights this month.</div>` : CATEGORIES.map((c) => html`<div class="hbar"><span style="width:110px;font-size:14px">${c}</span><div class="track"><div style=${`width:${(hc[c] / hMax) * 100}%;background:${CATEGORY_COLOR[c]}`}></div></div><b style="width:24px;text-align:right">${hc[c]}</b></div>`)}
      </div>
    </div>


    <div class="card pad">
      <div class="row between"><h2>Month by month</h2>${rows.some((r) => r.inProgress) && html`<span class="small muted">${monthName(today.slice(0, 7))} is still in progress</span>`}</div>
      <div class="tablewrap"><table class="mt">
        <thead><tr><th>Month</th><th>Mood</th><th>Spent</th><th>Steps</th><th>Water</th><th>Pages</th><th>Watched</th><th>Active</th><th>Calories</th><th>Tasks done</th></tr></thead>
        <tbody>${rows.length === 0 ? html`<tr><td colspan="9" class="muted">No months yet.</td></tr>` : rows.slice(-12).map((r) => html`<tr class=${r.inProgress ? 'cur' : ''}>
          <td>${r.name}</td><td>${r.moodAvg == null ? '—' : num(r.moodAvg)}</td><td>${currency}${num(r.spent, 0)}</td><td>${num(r.steps, 0)}</td><td>${r.water == null ? '—' : num(r.water) + ' L'}</td><td>${num(r.pages, 0)}</td><td>${r.movies}</td><td>${r.activity}</td><td>${r.calories == null ? '—' : num(r.calories, 0)}</td><td>${r.tasksDone}</td></tr>`)}</tbody>
      </table></div>
    </div>`;
}
