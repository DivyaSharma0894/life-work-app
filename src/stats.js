// All the numbers on the Today and Month dashboards. Pure functions: nothing here is ever saved,
// everything is calculated from the daily records, tasks and highlights each time.

import { MOODS, MOOD_SCORE, CATEGORIES, topLevel, addDays } from './logic.js';

const nums = (a) => a.filter((v) => typeof v === 'number');
const sum = (a) => nums(a).reduce((x, y) => x + y, 0);
const avg = (a) => { const n = nums(a); return n.length ? sum(n) / n.length : null; };
const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

export const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym) => MONTH_NAMES[Number(ym.slice(5)) - 1];
/** Last day of the month that counts: today for the current month, the final day for past months, 0 for the future. */
export function lastDay(ym, today) {
  const cur = today.slice(0, 7);
  if (ym > cur) return 0;
  return ym === cur ? Number(today.slice(8)) : daysInMonth(ym);
}
const dateOf = (ym, i) => `${ym}-${String(i + 1).padStart(2, '0')}`;

// ---------- one day ----------

/** Progress tiles for one day. pct is capped at 100, or null when there is no goal or no answer. */
export function dayTiles(rec, goals = {}) {
  const tile = (value, goal) => ({ value: value ?? null, goal: goal > 0 ? goal : null, pct: value != null && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null, over: value != null && goal > 0 && value > goal });
  return {
    water: tile(rec ? rec.waterLitres : null, goals.waterLitres),
    steps: tile(rec ? rec.steps : null, goals.steps),
    pages: tile(rec ? rec.pagesRead : null, goals.pagesRead),
    spent: tile(rec ? rec.spentRupees : null, goals.spendRupees),
    calories: tile(rec ? rec.calories : null, goals.calories)
  };
}

// ---------- one month ----------

export function monthStats(daysMap, ym, today, goals = {}, opts = {}) {
  const last = lastDay(ym, today);
  const rec = (i) => daysMap.get(dateOf(ym, i)) || null;
  const series = (field) => Array.from({ length: last }, (_, i) => { const r = rec(i); const v = r ? r[field] : null; return typeof v === 'number' ? v : null; });
  const moodScores = Array.from({ length: last }, (_, i) => { const r = rec(i); return r && MOOD_SCORE[r.mood] ? MOOD_SCORE[r.mood] : null; });

  let logged = 0;
  for (let i = 0; i < last; i++) if (rec(i)) logged++;

  const moodN = nums(moodScores).length;
  const mix = Object.fromEntries(MODES().map((m) => [m, 0]));
  moodScores.forEach((s) => { if (s) mix[MOODS.find((m) => MOOD_SCORE[m] === s)]++; });
  const top = moodN ? Math.max(...nums(moodScores)) : 0;
  const low = moodN ? Math.min(...nums(moodScores)) : 0;
  const best = top >= 4 ? moodScores.map((s, i) => (s === top ? dateOf(ym, i) : null)).filter(Boolean) : [];
  const hardest = low && low <= 2 && low < top ? moodScores.map((s, i) => (s === low ? dateOf(ym, i) : null)).filter(Boolean) : [];

  const money = series('spentRupees');
  const steps = series('steps');
  const water = series('waterLitres');
  const pages = series('pagesRead');

  // streak of reading days, ending at the latest day (today is allowed to be "not yet")
  let k = last - 1;
  if (ym === today.slice(0, 7) && !(pages[k] > 0)) k--;
  let streak = 0;
  while (k >= 0 && pages[k] > 0) { streak++; k--; }

  // money against the same days of the previous month, per day so months with gaps compare fairly
  const prev = prevMonth(ym);
  const prevLast = Math.min(last, daysInMonth(prev));
  const prevMoney = Array.from({ length: prevLast }, (_, i) => { const r = daysMap.get(dateOf(prev, i)); return r && typeof r.spentRupees === 'number' ? r.spentRupees : null; });
  const perDay = avg(money);
  const prevPerDay = avg(prevMoney);
  const changePct = perDay != null && prevPerDay ? Math.round(((perDay - prevPerDay) / prevPerDay) * 100) : null;

  const countTrue = (field) => Array.from({ length: last }, (_, i) => { const r = rec(i); return r && r[field] === true ? 1 : 0; }).reduce((a, b) => a + b, 0);
  const videoCount = countTrue('activity');

  const calories = series('calories');
  const activityNames = [...new Set(Array.from({ length: last }, (_, i) => rec(i)).filter((r) => r && r.activity === true && r.activityName).map((r) => r.activityName))];

  return {
    ym, last, logged,
    mood: { avg: round1(avg(moodScores)), n: moodN, mix, series: moodScores, best, hardest },
    money: { total: sum(money), perDay: perDay == null ? null : Math.round(perDay), series: money, max: Math.max(0, ...nums(money)), overGoalDays: goals.spendRupees > 0 ? nums(money).filter((v) => v > goals.spendRupees).length : 0, changePct, prevName: monthName(prev) },
    steps: { total: sum(steps), avg: avg(steps) == null ? null : Math.round(avg(steps)), series: steps, goalDays: goals.steps > 0 ? nums(steps).filter((v) => v >= goals.steps).length : 0 },
    water: { avg: round1(avg(water)), series: water, under2: water.map((v, i) => (v != null && v < 2 ? dateOf(ym, i) : null)).filter(Boolean) },
    pages: { total: sum(pages), readingDays: nums(pages).filter((v) => v > 0).length, streak, series: pages },
    movies: { days: countTrue('movie') },
    activity: { count: videoCount, names: activityNames, bestYet: videoCount > 0 && videoCount > (opts.priorMaxActivity || 0) },
    calories: { total: sum(calories), avg: avg(calories) == null ? null : Math.round(avg(calories)), series: calories, max: Math.max(0, ...nums(calories)), overGoalDays: goals.calories > 0 ? nums(calories).filter((v) => v > goals.calories).length : 0 }
  };
}
function MODES() { return [...MOODS]; }

/** How many active days the best earlier month had (to say "best month yet"). */
export function priorMaxActivity(daysMap, ym) {
  const by = new Map();
  for (const [d, r] of daysMap) if (d.slice(0, 7) < ym && r.activity === true) by.set(d.slice(0, 7), (by.get(d.slice(0, 7)) || 0) + 1);
  return Math.max(0, ...by.values());
}

/** Task numbers for a month: finished in it, still open now, overdue now. */
export function taskMonthStats(tasks, ym, today) {
  const all = tasks;
  const completed = all.filter((t) => t.completedAt && t.completedAt.slice(0, 7) === ym).length;
  const open = topLevel(all).filter((t) => t.status !== 'Done');
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const denom = completed + open.length;
  return { completed, open: open.length, overdue, pct: denom ? Math.round((completed / denom) * 100) : 0 };
}

export function highlightCounts(highlights, ym) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const h of highlights) if (h.date && h.date.slice(0, 7) === ym && counts[h.category] != null) counts[h.category]++;
  return counts;
}

/** One row per month that has any data, oldest first, for the month-by-month table. */
export function monthlyRows(daysMap, tasks, today) {
  const months = [...new Set([...daysMap.keys()].map((d) => d.slice(0, 7)))].sort();
  return months.map((ym) => {
    const st = monthStats(daysMap, ym, today, {});
    return {
      ym, name: monthName(ym), inProgress: ym === today.slice(0, 7), moodAvg: st.mood.avg, spent: st.money.total, steps: st.steps.avg, water: st.water.avg,
      pages: st.pages.total, movies: st.movies.days, activity: st.activity.count, calories: st.calories.avg, tasksDone: tasks.filter((t) => t.completedAt && t.completedAt.slice(0, 7) === ym).length
    };
  });
}

export function moodWord(avgScore) {
  if (avgScore == null) return '';
  return MOODS.find((m) => MOOD_SCORE[m] === Math.min(5, Math.max(1, Math.round(avgScore)))) || '';
}

export { addDays };

// ---------- spending allowance with carry-over ----------

/**
 * A fixed amount is allowed each day, and what you do not spend carries to the next day.
 * Overspending is taken from the following days (the balance goes below zero). The month starts fresh.
 * A day with no money answer counts as "spent nothing" (so the allowance carries), and is reported as not logged.
 */
export function allowance(daysMap, ym, today, daily) {
  const last = lastDay(ym, today);
  const rows = [];
  let carry = 0;
  let unloggedBefore = 0;
  for (let i = 0; i < last; i++) {
    const date = dateOf(ym, i);
    const r = daysMap.get(date);
    const logged = !!r && typeof r.spentRupees === 'number';
    const spent = logged ? r.spentRupees : 0;
    const avail = daily + carry;
    const after = avail - spent;
    rows.push({ date, day: i + 1, avail, spent, after, logged });
    if (!logged && date !== today) unloggedBefore++;
    carry = after;
  }
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  return {
    rows, daily,
    budget: daily * daysInMonth(ym),
    allowedSoFar: daily * rows.length,
    spentSoFar: rows.reduce((a, r) => a + r.spent, 0),
    balance: lastRow ? lastRow.after : 0,
    availableToday: lastRow ? lastRow.avail : 0,
    unloggedBefore
  };
}
