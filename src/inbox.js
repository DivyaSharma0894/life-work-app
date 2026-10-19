// Claude's way in. Claude (through the Drive connector) can read files and create NEW files, but cannot edit existing ones.
// So it leaves small JSON notes in the "inbox" folder. The app reads each note, checks it, merges it into the real files,
// and only then deletes it. Everything here is pure logic so it can be tested without a browser or Drive.

import { MOODS, CATEGORIES, STATUSES, PRIORITIES, isDate, newDay, cleanDay, newTask, updateTask, newHighlight } from './logic.js';

const str = (v, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? undefined : typeof v === 'object' ? undefined : String(v).slice(0, max));
const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) return Number(v);
  return undefined;
};
const bool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') { const s = v.trim().toLowerCase(); if (['yes', 'true'].includes(s)) return true; if (['no', 'false'].includes(s)) return false; }
  return undefined;
};
const oneOf = (v, list) => (typeof v === 'string' ? list.find((x) => x.toLowerCase() === v.trim().toLowerCase()) : undefined);

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const goodId = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{3,60}$/.test(v) ? v : null);

/** Check and clean the fields of one daily record. Anything unknown or invalid is dropped and reported. */
export function cleanDayFields(raw, problems, where) {
  const out = {};
  const take = (k, v) => { if (v !== undefined) out[k] = v; };
  const bad = (k) => { if (raw[k] !== undefined && raw[k] !== null) problems.push(`${where}: could not use "${k}"`); };
  const rules = {
    mood: (v) => oneOf(v, MOODS),
    waterLitres: num, steps: num, pagesRead: num, spentRupees: num, calories: num,
    bookTitle: (v) => str(v, 200), movieName: (v) => str(v, 200), activityName: (v) => str(v, 200),
    diary: (v) => str(v), moodAnalysis: (v) => str(v, 300),
    movie: bool, activity: bool
  };
  for (const [k, fn] of Object.entries(rules)) {
    if (raw[k] === undefined || raw[k] === null) continue; // not answered: leave the field alone
    const v = fn(raw[k]);
    if (v === undefined) bad(k); else take(k, v);
  }
  return out;
}

function cleanTaskFields(raw, problems, where, partial) {
  const out = {};
  const bad = (k) => problems.push(`${where}: could not use "${k}"`);
  const set = (k, v, ok) => { if (raw[k] === undefined || raw[k] === null) return; if (ok(v)) out[k] = v; else bad(k); };
  if (raw.title !== undefined) { const t = str(raw.title, 300); if (t && t.trim()) out.title = t.trim(); else bad('title'); }
  if (raw.status !== undefined) { const s = oneOf(raw.status, STATUSES); if (s) out.status = s; else bad('status'); }
  if (raw.priority !== undefined) { const p = oneOf(raw.priority, PRIORITIES); if (p) out.priority = p; else bad('priority'); }
  for (const k of ['type', 'project']) set(k, str(raw[k], 100), (v) => v !== undefined);
  for (const k of ['link', 'notes']) set(k, str(raw[k]), (v) => v !== undefined);
  for (const k of ['startDate', 'dueDate']) set(k, raw[k], (v) => v === '' || isDate(v));
  set('storyPoints', num(raw.storyPoints), (v) => v !== undefined);
  if (Array.isArray(raw.checklist)) {
    out.checklist = raw.checklist
      .map((c, i) => (typeof c === 'string' ? { text: c, done: false } : c && typeof c.text === 'string' ? { text: c.text, done: bool(c.done) === true } : null))
      .filter(Boolean).map((c, i) => ({ id: `c_${hash(c.text)}_${i}`, text: c.text.slice(0, 300), done: c.done }));
  }
  if (!partial && !out.title) problems.push(`${where}: a new task needs a title, so it was skipped`);
  return out;
}

/** Turn the text of one inbox file into a checked plan. Never throws. */
export function parseInbox(text, fileName = 'note') {
  const problems = [];
  const plan = { days: [], highlights: [], tasksAdd: [], tasksUpdate: [], months: [] };
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return { ok: false, plan, problems: ["it is not valid JSON"] }; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { ok: false, plan, problems: ["it is not a JSON object"] };
  const tag = hash(fileName);

  const days = new Map();
  (Array.isArray(msg.days) ? msg.days : []).forEach((d, i) => {
    const where = `days[${i}]`;
    if (!d || !isDate(d.date)) { problems.push(`${where}: missing or invalid date`); return; }
    const fields = cleanDayFields(d, problems, `${where} (${d.date})`);
    days.set(d.date, { ...(days.get(d.date) || {}), ...fields });
  });
  plan.days = [...days].map(([date, fields]) => ({ date, fields }));

  (Array.isArray(msg.highlights) ? msg.highlights : []).forEach((h, i) => {
    const where = `highlights[${i}]`;
    const category = oneOf(h && h.category, CATEGORIES);
    const t = h && str(h.text, 400);
    if (!h || !isDate(h.date) || !category || !t || !t.trim()) { problems.push(`${where}: needs a valid date, one of the 5 categories and some text`); return; }
    plan.highlights.push({ id: goodId(h.id) || `h_in_${tag}_${i}`, date: h.date, category, text: t.trim() });
  });

  const tasks = msg.tasks && typeof msg.tasks === 'object' ? msg.tasks : {};
  (Array.isArray(tasks.add) ? tasks.add : []).forEach((t, i) => {
    const where = `tasks.add[${i}]`;
    if (!t || typeof t !== 'object') { problems.push(`${where}: not an object`); return; }
    const f = cleanTaskFields(t, problems, where, false);
    if (f.title) plan.tasksAdd.push({ id: goodId(t.id) || `t_in_${tag}_${i}`, ...f });
  });
  (Array.isArray(tasks.update) ? tasks.update : []).forEach((t, i) => {
    const where = `tasks.update[${i}]`;
    if (!t || !goodId(t.id)) { problems.push(`${where}: needs the task id`); return; }
    plan.tasksUpdate.push({ id: t.id, fields: cleanTaskFields(t, problems, where, true) });
  });

  (Array.isArray(msg.months) ? msg.months : []).forEach((m, i) => {
    const where = `months[${i}]`;
    const text2 = m && str(m.text, 4000);
    if (!m || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.month || '') || !isDate(m.summarizedThrough) || !text2 || !text2.trim()) {
      problems.push(`${where}: needs month (YYYY-MM), text and summarizedThrough (YYYY-MM-DD)`); return;
    }
    plan.months.push({ month: m.month, text: text2.trim(), summarizedThrough: m.summarizedThrough });
  });

  const nothing = !plan.days.length && !plan.highlights.length && !plan.tasksAdd.length && !plan.tasksUpdate.length && !plan.months.length;
  return { ok: !nothing || problems.length === 0, empty: nothing, plan, problems };
}

/** Put Claude's answers into a daily record. Fields Claude did not send are left exactly as they were. */
export function applyDayFields(existing, date, fields, now = new Date()) {
  const base = existing ? { ...newDay(date, now), ...existing } : newDay(date, now);
  const merged = cleanDay({ ...base, ...fields, date });
  if (fields.movie === false) merged.movieName = '';
  merged.updatedAt = now.toISOString();
  return merged;
}

/** Add Claude's highlights. A highlight that is already there (same id), or was deleted on purpose, is not added again. */
export function applyHighlights(file, list, now = new Date()) {
  const have = new Set((file.highlights || []).map((h) => h.id));
  const gone = new Set((file.deleted || []).map((d) => d.id));
  const add = list.filter((h) => !have.has(h.id) && !gone.has(h.id)).map((h) => newHighlight(h, now));
  return { file: add.length ? { ...file, highlights: [...(file.highlights || []), ...add] } : file, added: add.length };
}

export function applyTasks(file, plan, now = new Date()) {
  const problems = [];
  let tasks = file.tasks || [];
  const have = new Set(tasks.map((t) => t.id));
  const gone = new Set((file.deleted || []).map((d) => d.id));
  let added = 0;
  let updated = 0;
  for (const t of plan.tasksAdd) {
    if (have.has(t.id) || gone.has(t.id)) continue;
    tasks = [...tasks, newTask(t, now)];
    have.add(t.id);
    added++;
  }
  for (const u of plan.tasksUpdate) {
    const cur = tasks.find((t) => t.id === u.id);
    if (!cur) { problems.push(`task ${u.id} was not found, so it was not changed`); continue; }
    if (!Object.keys(u.fields).length) continue;
    tasks = tasks.map((t) => (t.id === u.id ? updateTask(t, u.fields, now) : t));
    updated++;
  }
  return { file: added || updated ? { ...file, tasks } : file, added, updated, problems };
}
