import test from 'node:test';
import assert from 'node:assert/strict';
import { urgency, daysUntil, newTask, updateTask, mergeTaskFiles, filterTasks, summarize, needsAttention, todayIn } from '../src/logic.js';

const TODAY = '2026-10-18';
const t = (o) => newTask({ title: 'x', ...o });

test('urgency labels follow the due date', () => {
  assert.equal(urgency(t({ dueDate: '2026-10-17' }), TODAY), 'Overdue');
  assert.equal(urgency(t({ dueDate: '2026-10-18' }), TODAY), 'Due soon');
  assert.equal(urgency(t({ dueDate: '2026-10-20' }), TODAY), 'Due soon');
  assert.equal(urgency(t({ dueDate: '2026-10-21' }), TODAY), 'This week');
  assert.equal(urgency(t({ dueDate: '2026-10-25' }), TODAY), 'This week');
  assert.equal(urgency(t({ dueDate: '2026-10-26' }), TODAY), 'On track');
  assert.equal(urgency(t({ dueDate: '' }), TODAY), 'No date');
  assert.equal(urgency(t({ dueDate: '2026-10-01', status: 'Done' }), TODAY), 'Done');
});

test('daysUntil works across month ends', () => {
  assert.equal(daysUntil('2026-11-02', '2026-10-30'), 3);
  assert.equal(daysUntil('2026-10-30', '2026-11-02'), -3);
});

test('todayIn uses the date in the given time zone, not UTC', () => {
  // 20:00 UTC on 17 Oct is already 01:30 on 18 Oct in India
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-10-17T20:00:00Z')), '2026-10-18');
});

test('updateTask stamps completedAt when moved to Done and clears it when reopened', () => {
  const a = t({});
  const done = updateTask(a, { status: 'Done' });
  assert.ok(done.completedAt);
  const reopened = updateTask(done, { status: 'To Do' });
  assert.equal(reopened.completedAt, null);
});

test('merge keeps the newer edit per task and keeps tasks added on either side', () => {
  const base = t({ id: 'a', title: 'old', updatedAt: '2026-10-18T01:00:00Z' });
  const app = { tasks: [{ ...base, title: 'from app', updatedAt: '2026-10-18T02:00:00Z' }] };
  const claude = { tasks: [{ ...base, title: 'from claude', updatedAt: '2026-10-18T03:00:00Z' }, t({ id: 'b', updatedAt: '2026-10-18T03:00:00Z' })] };
  const m = mergeTaskFiles(app, claude);
  assert.equal(m.tasks.length, 2);
  assert.equal(m.tasks.find((x) => x.id === 'a').title, 'from claude');
});

test('merge respects deletes unless the task was edited after', () => {
  const a = t({ id: 'a', updatedAt: '2026-10-18T01:00:00Z' });
  const stale = { tasks: [a] };
  const deleted = { tasks: [], deleted: [{ id: 'a', at: '2026-10-18T02:00:00Z' }] };
  assert.equal(mergeTaskFiles(stale, deleted).tasks.length, 0);
  const edited = { tasks: [{ ...a, updatedAt: '2026-10-18T03:00:00Z' }] };
  assert.equal(mergeTaskFiles(edited, deleted).tasks.length, 1);
});

test('filters and search', () => {
  const tasks = [t({ title: 'Fix load', type: 'Project', priority: 'High' }), t({ title: 'Read docs', type: 'Upskilling', priority: 'Low' })];
  assert.equal(filterTasks(tasks, { type: 'Project' }).length, 1);
  assert.equal(filterTasks(tasks, { q: 'READ' }).length, 1);
  assert.equal(filterTasks(tasks, { priority: 'All', type: 'All' }).length, 2);
});

test('summary counts only top-level tasks and needs-attention is soonest first', () => {
  const p = t({ id: 'p', dueDate: '2026-10-20' });
  const child = t({ id: 'c', parentId: 'p', dueDate: '2026-10-19' });
  const late = t({ id: 'l', dueDate: '2026-10-15' });
  const far = t({ id: 'f', dueDate: '2026-12-01' });
  const done = t({ id: 'd', status: 'Done', dueDate: '2026-10-19' });
  const all = [p, child, late, far, done];
  const s = summarize(all, TODAY);
  assert.equal(s.total, 4);
  assert.equal(s.done, 1);
  assert.equal(s.byUrgency['Overdue'], 1);
  assert.deepEqual(needsAttention(all, TODAY).map((x) => x.id), ['l', 'p']);
});

import { newDay, cleanDay, merge3, missingAnswers, newHighlight, storyOf, highlightsOn, mergeRecordFiles, isDate, addDays } from '../src/logic.js';

test('a new day starts with all 8 questions unanswered', () => {
  const d = newDay('2026-10-18');
  assert.deepEqual(missingAnswers(d), ['water', 'steps', 'mood', 'pages', 'watched something', 'activity', 'calories', 'money']);
  const answered = { ...d, waterLitres: 0, steps: 0, mood: 'Good', pagesRead: 0, movie: false, activity: false, calories: 0, spentRupees: 0 };
  assert.deepEqual(missingAnswers(answered), []); // zero counts as an answer
});

test('cleanDay turns form text into numbers and drops the movie name when no movie', () => {
  const d = cleanDay({ ...newDay('2026-10-18'), waterLitres: '2.4', steps: '6820.4', pagesRead: '', spentRupees: '640', movie: false, movieName: 'Ghost', bookTitle: '  Atomic Habits ' });
  assert.equal(d.waterLitres, 2.4);
  assert.equal(d.steps, 6820);
  assert.equal(d.pagesRead, null);
  assert.equal(d.spentRupees, 640);
  assert.equal(d.movieName, '');
  assert.equal(d.bookTitle, 'Atomic Habits');
  assert.equal(cleanDay({ ...newDay('2026-10-18'), waterLitres: '-3' }).waterLitres, null);
});

test('merge3 keeps edits made on different fields on each side', () => {
  const base = { ...newDay('2026-10-18'), mood: 'Okay', steps: 1000, updatedAt: '2026-10-18T01:00:00Z' };
  const mine = { ...base, diary: 'my words', updatedAt: '2026-10-18T03:00:00Z' };
  const theirs = { ...base, mood: 'Good', spentRupees: 640, updatedAt: '2026-10-18T02:00:00Z' };
  const { record, conflicts } = merge3(base, mine, theirs);
  assert.equal(record.diary, 'my words');
  assert.equal(record.mood, 'Good');
  assert.equal(record.spentRupees, 640);
  assert.deepEqual(conflicts, []);
});

test('merge3 reports a field changed on both sides and keeps mine', () => {
  const base = { ...newDay('2026-10-18'), mood: 'Okay', updatedAt: '2026-10-18T01:00:00Z' };
  const mine = { ...base, mood: 'Low', updatedAt: '2026-10-18T03:00:00Z' };
  const theirs = { ...base, mood: 'Good', updatedAt: '2026-10-18T02:00:00Z' };
  const { record, conflicts } = merge3(base, mine, theirs);
  assert.equal(record.mood, 'Low');
  assert.deepEqual(conflicts, ['mood']);
});

test('stories are per category and oldest first; highlights per day', () => {
  const hs = [
    newHighlight({ date: '2026-10-12', category: 'Mental Health', text: 'b' }),
    newHighlight({ date: '2026-09-21', category: 'Mental Health', text: 'a' }),
    newHighlight({ date: '2026-10-12', category: 'Office Life', text: 'c' })
  ];
  assert.deepEqual(storyOf(hs, 'Mental Health').map((h) => h.text), ['a', 'b']);
  assert.equal(highlightsOn(hs, '2026-10-12').length, 2);
});

test('highlight files merge by id like tasks', () => {
  const h = newHighlight({ id: 'h1', date: '2026-10-12', text: 'old', updatedAt: '2026-10-18T01:00:00Z' });
  const a = { highlights: [{ ...h, text: 'app', updatedAt: '2026-10-18T02:00:00Z' }] };
  const b = { highlights: [h, newHighlight({ id: 'h2' })] };
  const m = mergeRecordFiles(a, b, 'highlights');
  assert.equal(m.highlights.length, 2);
  assert.equal(m.highlights.find((x) => x.id === 'h1').text, 'app');
});

test('date helpers', () => {
  assert.ok(isDate('2026-10-18'));
  assert.ok(!isDate('2026-13-45'));
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});
