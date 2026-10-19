import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveClient } from '../src/drive.js';
import { createDriveAdapter, EMPTY_TASKS, EMPTY_HIGHLIGHTS } from '../src/storage.js';
import { parseInbox, applyDayFields, applyHighlights, applyTasks } from '../src/inbox.js';
import { newTask } from '../src/logic.js';
import { fakeDrive } from './helpers.mjs';

const mk = (d) => createDriveAdapter({ client: createDriveClient({ getToken: async () => 'tok', fetchFn: d.fetchFn }) });

const NOW = new Date('2026-10-18T10:00:00Z');

test('a good note is understood: days, highlights, tasks and month summary', () => {
  const note = JSON.stringify({
    schema: 1,
    days: [{ date: '2026-10-18', mood: 'good', waterLitres: '2.5', steps: 7000, movie: 'yes', movieName: 'Inception', activity: false, calories: '1850', spentRupees: 300, diary: 'A calm day.', moodAnalysis: 'Calm and content.' }],
    highlights: [{ date: '2026-10-18', category: 'mental health', text: 'Felt calm after a walk.' }],
    tasks: { add: [{ title: 'Write tests', priority: 'high', dueDate: '2026-10-20', checklist: ['one', { text: 'two', done: true }] }], update: [{ id: 't_abc', status: 'Done' }] },
    months: [{ month: '2026-10', text: 'A steady month.', summarizedThrough: '2026-10-18' }]
  });
  const r = parseInbox(note, 'a.json');
  assert.ok(r.ok);
  assert.deepEqual(r.problems, []);
  const d = r.plan.days[0];
  assert.equal(d.fields.mood, 'Good');
  assert.equal(d.fields.waterLitres, 2.5);
  assert.equal(d.fields.movie, true);
  assert.equal(d.fields.activity, false);
  assert.equal(d.fields.calories, 1850);
  assert.equal(r.plan.highlights[0].category, 'Mental Health');
  assert.equal(r.plan.tasksAdd[0].priority, 'High');
  assert.equal(r.plan.tasksAdd[0].checklist.length, 2);
  assert.equal(r.plan.tasksUpdate[0].fields.status, 'Done');
  assert.equal(r.plan.months[0].summarizedThrough, '2026-10-18');
});

test('bad input is reported and dropped, never saved', () => {
  assert.equal(parseInbox('not json', 'x.json').ok, false);
  assert.equal(parseInbox('[1,2]', 'x.json').ok, false);
  const r = parseInbox(JSON.stringify({
    days: [{ date: 'yesterday', mood: 'Good' }, { date: '2026-10-18', mood: 'Fantastic', steps: -5, waterLitres: 'lots' }],
    highlights: [{ date: '2026-10-18', category: 'Gossip', text: 'x' }, { date: '2026-10-18', category: 'Office Life', text: '  ' }],
    tasks: { add: [{ status: 'To Do' }, { title: 'T', status: 'Nonsense' }] }
  }), 'y.json');
  assert.equal(r.plan.days.length, 1);
  assert.deepEqual(r.plan.days[0].fields, {});
  assert.equal(r.plan.highlights.length, 0);
  assert.equal(r.plan.tasksAdd.length, 1);
  assert.equal(r.plan.tasksAdd[0].status, undefined);
  assert.ok(r.problems.length >= 6);
});

test('unanswered fields are left alone, answered ones are set', () => {
  const existing = { date: '2026-10-18', mood: 'Low', steps: 4000, calories: 1200, createdAt: 'c', updatedAt: 'u' };
  const out = applyDayFields(existing, '2026-10-18', { mood: 'Good', waterLitres: 2 }, NOW);
  assert.equal(out.mood, 'Good');
  assert.equal(out.steps, 4000);
  assert.equal(out.calories, 1200);
  assert.equal(out.waterLitres, 2);
  assert.equal(out.createdAt, 'c');
  assert.equal(out.updatedAt, NOW.toISOString());
  const fresh = applyDayFields(null, '2026-10-19', { movie: false, movieName: 'ignored' }, NOW);
  assert.equal(fresh.movie, false);
  assert.equal(fresh.movieName, '');
  assert.equal(fresh.steps, null);
});

test('importing the same note twice does not duplicate anything', () => {
  const plan = parseInbox(JSON.stringify({
    highlights: [{ date: '2026-10-18', category: 'Mental Health', text: 'Felt calm.' }],
    tasks: { add: [{ title: 'Once' }] }
  }), 'same.json').plan;
  let h = applyHighlights(EMPTY_HIGHLIGHTS(), plan.highlights, NOW);
  h = applyHighlights(h.file, plan.highlights, NOW);
  assert.equal(h.file.highlights.length, 1);
  let t = applyTasks(EMPTY_TASKS(), plan, NOW);
  t = applyTasks(t.file, plan, NOW);
  assert.equal(t.file.tasks.length, 1);
});

test('a highlight or task you deleted does not come back from an old note', () => {
  const plan = parseInbox(JSON.stringify({ highlights: [{ date: '2026-10-18', category: 'Office Life', text: 'x' }], tasks: { add: [{ title: 'Y' }] } }), 'n.json').plan;
  const hid = plan.highlights[0].id;
  const tid = plan.tasksAdd[0].id;
  assert.equal(applyHighlights({ ...EMPTY_HIGHLIGHTS(), deleted: [{ id: hid, at: 'z' }] }, plan.highlights, NOW).added, 0);
  assert.equal(applyTasks({ ...EMPTY_TASKS(), deleted: [{ id: tid, at: 'z' }] }, plan, NOW).added, 0);
});

test('task updates change only what was sent, and unknown ids are reported', () => {
  const t = newTask({ id: 't_abc', title: 'Keep', priority: 'Low', notes: 'n' }, NOW);
  const plan = parseInbox(JSON.stringify({ tasks: { update: [{ id: 't_abc', status: 'Done' }, { id: 't_missing', status: 'Done' }] } }), 'u.json').plan;
  const r = applyTasks({ ...EMPTY_TASKS(), tasks: [t] }, plan, NOW);
  const got = r.file.tasks[0];
  assert.equal(got.status, 'Done');
  assert.equal(got.priority, 'Low');
  assert.equal(got.title, 'Keep');
  assert.ok(got.completedAt);
  assert.equal(r.problems.length, 1);
});

test('Drive: notes in the inbox are listed oldest first, read, and removed; subfolders are ignored', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  const inbox = [...d.files.values()].find((f) => f.name === 'inbox');
  const put = (name, content) => { const f = { id: 'n_' + name, name, parents: [inbox.id], mimeType: 'application/json', content, version: 1 }; d.files.set(f.id, f); };
  put('2026-10-18T2100-b.json', '{"days":[]}');
  put('2026-10-18T0900-a.json', '{"days":[]}');
  const list = await a.listInbox();
  assert.deepEqual(list.map((f) => f.name), ['2026-10-18T0900-a.json', '2026-10-18T2100-b.json']);
  assert.equal(await a.readInbox(list[0]), '{"days":[]}');
  await a.removeInbox(list[0]);
  assert.equal((await a.listInbox()).length, 1);
});

test('Drive: month summaries are created, then updated in place', async () => {
  const d = fakeDrive();
  const a = mk(d);
  assert.equal((await a.loadMonth('2026-10')).data, null);
  await a.saveMonth('2026-10', { schema: 1, month: '2026-10', summary: 'one', summarizedThrough: '2026-10-10' });
  await a.saveMonth('2026-10', { schema: 1, month: '2026-10', summary: 'two', summarizedThrough: '2026-10-18' });
  const got = await mk(d).loadMonth('2026-10');
  assert.equal(got.data.summary, 'two');
  assert.equal([...d.files.values()].filter((f) => f.name === '2026-10.json').length, 1);
});
