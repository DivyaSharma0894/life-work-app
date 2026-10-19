import test from 'node:test';
import assert from 'node:assert/strict';
import { monthStats, dayTiles, taskMonthStats, highlightCounts, monthlyRows, priorMaxActivity, lastDay, prevMonth, nextMonth, moodWord } from '../src/stats.js';
import { newDay, newTask, newHighlight } from '../src/logic.js';

const moodNames = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
const mood = [4, 3, 4, 5, 4, 3, 2, 3, 4, 4, 5, 3, 2, 3, 4, 4, 5, 4];
const money = [420, 780, 350, 1200, 560, 900, 300, 480, 640, 520, 1850, 610, 380, 450, 700, 560, 900, 640];
const steps = [6200, 7400, 5100, 9100, 8200, 4300, 3800, 5200, 7600, 8800, 10200, 6100, 4000, 5600, 7900, 7100, 9400, 6820];
const water = [2.5, 2.2, 2.0, 2.8, 2.4, 1.6, 1.4, 1.8, 2.6, 2.5, 3.0, 2.2, 1.5, 2.0, 2.4, 2.6, 2.9, 2.4];
const pages = [20, 0, 15, 30, 12, 0, 0, 10, 25, 18, 40, 0, 0, 15, 22, 28, 35, 24];
const goals = { waterLitres: 3, steps: 8000, pagesRead: 20, spendRupees: 800 };

function october() {
  const m = new Map();
  mood.forEach((s, i) => {
    const date = `2026-10-${String(i + 1).padStart(2, '0')}`;
    m.set(date, { ...newDay(date), mood: moodNames[s - 1], spentRupees: money[i], steps: steps[i], waterLitres: water[i], pagesRead: pages[i], movie: i % 4 === 0, activity: i % 3 === 0, calories: 1800 + i * 10 });
  });
  return m;
}

test('month stats match hand calculation', () => {
  const s = monthStats(october(), '2026-10', '2026-10-18', goals);
  assert.equal(s.last, 18);
  assert.equal(s.logged, 18);
  assert.equal(s.mood.avg, 3.7);
  assert.equal(moodWord(s.mood.avg), 'Good');
  assert.deepEqual(s.mood.best, ['2026-10-04', '2026-10-11', '2026-10-17']);
  assert.deepEqual(s.mood.hardest, ['2026-10-07', '2026-10-13']);
  assert.equal(s.mood.mix.Great, 3);
  assert.equal(s.money.total, money.reduce((a, b) => a + b));
  assert.equal(s.money.perDay, Math.round(money.reduce((a, b) => a + b) / 18));
  assert.equal(s.money.overGoalDays, money.filter((v) => v > 800).length);
  assert.equal(s.steps.total, steps.reduce((a, b) => a + b));
  assert.equal(s.steps.goalDays, steps.filter((v) => v >= 8000).length);
  assert.deepEqual(s.water.under2, ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-13']);
  assert.equal(s.water.avg, 2.3);
  assert.equal(s.pages.total, pages.reduce((a, b) => a + b));
  assert.equal(s.pages.readingDays, pages.filter((v) => v > 0).length);
  assert.equal(s.pages.streak, 5);
  assert.equal(s.calories.series[0], 1800);
  assert.equal(s.calories.max, 1970);
  assert.equal(s.activity.count, 6);
});

test('unanswered days are left out of averages, not counted as zero', () => {
  const m = new Map([['2026-10-01', { ...newDay('2026-10-01'), steps: 6000 }], ['2026-10-03', { ...newDay('2026-10-03'), steps: 8000 }]]);
  const s = monthStats(m, '2026-10', '2026-10-03', {});
  assert.equal(s.steps.avg, 7000);
  assert.equal(s.logged, 2);
  assert.equal(s.mood.avg, null);
  assert.deepEqual(s.mood.best, []);
});

test('reading streak survives a day that is not over yet, but not a real gap', () => {
  const mk = (arr) => new Map(arr.map((p, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, { ...newDay('x'), pagesRead: p }]));
  assert.equal(monthStats(mk([5, 5, 5, null]), '2026-10', '2026-10-04', {}).pages.streak, 3);
  assert.equal(monthStats(mk([5, 5, 0, 5]), '2026-10', '2026-10-04', {}).pages.streak, 1);
});

test('money compares per day with the same days of last month', () => {
  const m = october();
  for (let i = 1; i <= 18; i++) { const d = `2026-09-${String(i).padStart(2, '0')}`; m.set(d, { ...newDay(d), spentRupees: 740 }); }
  const s = monthStats(m, '2026-10', '2026-10-18', goals);
  assert.equal(s.money.prevName, 'September');
  assert.equal(s.money.changePct, Math.round(((s.money.perDay - 740) / 740) * 100));
});

test('past months use all their days; future months are empty; month math', () => {
  assert.equal(lastDay('2026-09', '2026-10-18'), 30);
  assert.equal(lastDay('2026-02', '2026-10-18'), 28);
  assert.equal(lastDay('2026-11', '2026-10-18'), 0);
  assert.equal(prevMonth('2026-01'), '2025-12');
  assert.equal(nextMonth('2026-12'), '2027-01');
});

test('day tiles: percent is capped, no goal or no answer gives null', () => {
  const t = dayTiles({ waterLitres: 2.4, steps: 9000, pagesRead: null, spentRupees: 640 }, { waterLitres: 3, steps: 8000, pagesRead: 20, spendRupees: 0 });
  assert.equal(t.water.pct, 80);
  assert.equal(t.steps.pct, 100);
  assert.equal(t.steps.over, true);
  assert.equal(t.pages.pct, null);
  assert.equal(t.spent.pct, null);
  assert.equal(dayTiles(null, {}).water.value, null);
});

test('tasks and highlights per month; the table has one row per month with data', () => {
  const tasks = [
    newTask({ status: 'Done', completedAt: '2026-10-05T00:00:00Z' }), newTask({ status: 'Done', completedAt: '2026-09-05T00:00:00Z' }),
    newTask({ status: 'To Do', dueDate: '2026-10-10' }), newTask({ status: 'In Progress', dueDate: '2026-10-30' }), newTask({ status: 'To Do', parentId: 'x' })
  ];
  const t = taskMonthStats(tasks, '2026-10', '2026-10-18');
  assert.deepEqual(t, { completed: 1, open: 2, overdue: 1, pct: 33 });
  const h = highlightCounts([newHighlight({ date: '2026-10-02', category: 'Mental Health' }), newHighlight({ date: '2026-09-02', category: 'Mental Health' })], '2026-10');
  assert.equal(h['Mental Health'], 1);
  const all = october();
  all.set('2026-09-05', { ...newDay('2026-09-05'), activity: true });
  const rows = monthlyRows(all, tasks, '2026-10-18');
  assert.deepEqual(rows.map((r) => r.name), ['September', 'October']);
  assert.equal(rows[1].inProgress, true);
  assert.equal(rows[0].tasksDone, 1);
  assert.equal(priorMaxActivity(all, '2026-10'), 1);
  assert.equal(monthStats(all, '2026-10', '2026-10-18', {}, { priorMaxActivity: 1 }).activity.bestYet, true);
});

import { allowance } from '../src/stats.js';
const mkDays = (ym, spent) => new Map(spent.map((s, i) => { const d = `${ym}-${String(i + 1).padStart(2, '0')}`; return [d, s == null ? { ...newDay(d) } : { ...newDay(d), spentRupees: s }]; }));

test('allowance: unspent money carries forward, exactly as in the example', () => {
  const a = allowance(mkDays('2026-10', [300, 0, null]), '2026-10', '2026-10-03', 600);
  assert.deepEqual(a.rows.map((r) => r.avail), [600, 900, 1500]); // 600, then 900, then 1,500
  assert.deepEqual(a.rows.map((r) => r.after), [300, 900, 1500]);
  assert.equal(a.availableToday, 1500);
  assert.equal(a.allowedSoFar, 1800);
  assert.equal(a.spentSoFar, 300);
  assert.equal(a.balance, 1500);
});

test('allowance: overspending is taken from the following days', () => {
  const a = allowance(mkDays('2026-10', [900, 300, 600]), '2026-10', '2026-10-03', 600);
  assert.deepEqual(a.rows.map((r) => r.avail), [600, 300, 600]);
  assert.deepEqual(a.rows.map((r) => r.after), [-300, 0, 0]);
  assert.equal(a.balance, 0);
});

test('allowance: a day that was never logged counts as nothing spent and is reported', () => {
  const m = mkDays('2026-10', [600, null, 100]);
  const a = allowance(m, '2026-10', '2026-10-03', 600);
  assert.equal(a.rows[1].logged, false);
  assert.equal(a.rows[2].avail, 1200);
  assert.equal(a.unloggedBefore, 1);
  // today not logged yet is normal and not reported as missing
  assert.equal(allowance(mkDays('2026-10', [600, 600, null]), '2026-10', '2026-10-03', 600).unloggedBefore, 0);
});

test('allowance: month budget is the daily amount times the days in the month; each month starts fresh; future is empty', () => {
  assert.equal(allowance(new Map(), '2026-10', '2026-10-18', 600).budget, 18600);
  assert.equal(allowance(new Map(), '2026-09', '2026-10-18', 600).budget, 18000);
  assert.equal(allowance(new Map(), '2026-02', '2026-10-18', 600).budget, 16800);
  const sep = mkDays('2026-09', Array(30).fill(0));
  const oct = allowance(new Map([...sep, ...mkDays('2026-10', [0])]), '2026-10', '2026-10-01', 600);
  assert.equal(oct.availableToday, 600); // September's leftover does not roll into October
  const fut = allowance(new Map(), '2026-11', '2026-10-18', 600);
  assert.equal(fut.rows.length, 0);
  assert.equal(fut.availableToday, 0);
});
