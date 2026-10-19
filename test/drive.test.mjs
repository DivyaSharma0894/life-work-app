import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriveClient } from '../src/drive.js';
import { createDriveAdapter, EMPTY_TASKS } from '../src/storage.js';
import { newTask, newDay, newHighlight } from '../src/logic.js';

import { fakeDrive } from './helpers.mjs';

const mk = (d) => createDriveAdapter({ client: createDriveClient({ getToken: async () => 'tok', fetchFn: d.fetchFn }) });

test('first run creates the folder with README, tasks and settings', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  const names = [...d.files.values()].map((f) => f.name).sort();
  assert.deepEqual(names, ['Life & Work App', 'README.md', 'days', 'highlights.json', 'inbox', 'months', 'settings.json', 'tasks.json']);
  const { data } = await a.loadTasks();
  assert.deepEqual(data, EMPTY_TASKS());
  const readme = [...d.files.values()].find((f) => f.name === 'README.md');
  assert.match(readme.content, /Claude: you have no memory between chats/);
});

test('a second start reuses the same folder and files', async () => {
  const d = fakeDrive();
  await mk(d).init();
  const before = d.files.size;
  await mk(d).init();
  assert.equal(d.files.size, before);
});

test('saving writes tasks and survives a round trip, including non-English text', async () => {
  const d = fakeDrive();
  const a = mk(d);
  const { data, version } = await a.loadTasks();
  data.tasks.push(newTask({ title: 'दिवाली की तैयारी ₹500' }));
  const saved = await a.saveTasks(data, version);
  const again = await mk(d).loadTasks();
  assert.equal(again.data.tasks[0].title, 'दिवाली की तैयारी ₹500');
  assert.notEqual(saved.version, version);
});

test('an edit made elsewhere (like Claude adding a task) is merged, never overwritten', async () => {
  const d = fakeDrive();
  const app = mk(d);
  const loaded = await app.loadTasks();
  // Claude adds a task directly in Drive while the app is open
  const claudeSide = mk(d);
  const c = await claudeSide.loadTasks();
  c.data.tasks.push(newTask({ id: 'from_claude', title: 'Added by Claude' }));
  await claudeSide.saveTasks(c.data, c.version);
  // The app, still holding the old version, saves its own new task
  loaded.data.tasks.push(newTask({ id: 'from_app', title: 'Added in app' }));
  const result = await app.saveTasks(loaded.data, loaded.version);
  assert.deepEqual(result.data.tasks.map((t) => t.id).sort(), ['from_app', 'from_claude']);
  const final = await mk(d).loadTasks();
  assert.equal(final.data.tasks.length, 2);
});

test('a broken tasks.json is not overwritten', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  [...d.files.values()].find((f) => f.name === 'tasks.json').content = '{ not json';
  await assert.rejects(() => mk(d).loadTasks(), /not valid JSON/);
});

test('daily records: save, list, load, and the days folder sits inside the app folder', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  assert.deepEqual(await a.listDays(), []);
  const day = { ...newDay('2026-10-18'), mood: 'Good', diary: 'आज का दिन अच्छा रहा', bookTitle: 'Atomic Habits', movie: true, movieName: 'Dune' };
  const saved = await a.saveDay(day, null, newDay('2026-10-18'));
  assert.ok(saved.version);
  assert.deepEqual(await mk(d).listDays(), ['2026-10-18']);
  const loaded = await mk(d).loadDay('2026-10-18');
  assert.equal(loaded.data.diary, 'आज का दिन अच्छा रहा');
  assert.equal(loaded.data.movieName, 'Dune');
  assert.deepEqual((await mk(d).loadDay('2026-10-17')).data, null);
  const daysFolder = [...d.files.values()].find((f) => f.name === 'days');
  const dayFile = [...d.files.values()].find((f) => f.name === '2026-10-18.json');
  assert.deepEqual(dayFile.parents, [daysFolder.id]);
});

test('a day edited elsewhere is merged field by field, and a clash is reported', async () => {
  const d = fakeDrive();
  const app = mk(d);
  await app.init();
  const first = await app.saveDay({ ...newDay('2026-10-18'), mood: 'Okay', steps: 1000 }, null, newDay('2026-10-18'));
  const base = first.data;
  // Claude fills in the money and changes the mood while the diary is open in the app
  const claude = mk(d);
  const c = await claude.loadDay('2026-10-18');
  await claude.saveDay({ ...c.data, spentRupees: 640, mood: 'Good', updatedAt: new Date().toISOString() }, c.version, c.data);
  // The app, still on the old version, saves a diary text and also changes the mood
  const mine = { ...base, diary: 'my words', mood: 'Low', updatedAt: new Date(Date.now() + 5000).toISOString() };
  const r = await app.saveDay(mine, first.version, base);
  assert.equal(r.data.spentRupees, 640);       // theirs kept
  assert.equal(r.data.diary, 'my words');      // mine kept
  assert.equal(r.data.mood, 'Low');            // both changed, mine wins
  assert.deepEqual(r.conflicts, ['mood']);
});

test('deleting a day removes the file for good', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  await a.saveDay(newDay('2026-10-18'), null, newDay('2026-10-18'));
  await a.deleteDay('2026-10-18');
  assert.deepEqual(await mk(d).listDays(), []);
});

test('highlights save and merge like tasks', async () => {
  const d = fakeDrive();
  const app = mk(d);
  const loaded = await app.loadHighlights();
  const other = mk(d);
  const o = await other.loadHighlights();
  o.data.highlights.push(newHighlight({ id: 'h_other', date: '2026-10-16', category: 'Mental Health', text: 'from claude' }));
  await other.saveHighlights(o.data, o.version);
  loaded.data.highlights.push(newHighlight({ id: 'h_app', date: '2026-10-17', category: 'Office Life', text: 'from app' }));
  const r = await app.saveHighlights(loaded.data, loaded.version);
  assert.deepEqual(r.data.highlights.map((h) => h.id).sort(), ['h_app', 'h_other']);
});

test('an older README in Drive is upgraded to the new format notes', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await a.init();
  const readme = [...d.files.values()].find((f) => f.name === 'README.md');
  readme.content = '# old readme';
  await mk(d).init();
  assert.match(readme.content, /Format version: 3/);
  assert.match(readme.content, /days\/YYYY-MM-DD\.json/);
});

test('simultaneous first loads do not create the folder twice', async () => {
  const d = fakeDrive();
  const a = mk(d);
  await Promise.all([a.loadTasks(), a.loadSettings(), a.loadHighlights(), a.listDays()]);
  const folders = [...d.files.values()].filter((f) => f.name === 'Life & Work App');
  assert.equal(folders.length, 1);
});
