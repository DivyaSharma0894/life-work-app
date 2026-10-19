// Pure logic for tasks: no browser or network code in this file, so it can be tested in Node.

export const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Done'];
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const DEFAULT_TYPES = ['Project', 'Upskilling', 'POC', 'Admin'];
export const URGENCIES = ['Overdue', 'Due soon', 'This week', 'On track', 'No date', 'Done'];

/** The person's own time zone: from Settings, else this computer's. */
export const browserTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
let activeTz = browserTimeZone();
export function setTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); activeTz = tz; } catch (e) { activeTz = browserTimeZone(); }
}
export const getTimeZone = () => activeTz;

/** A date as YYYY-MM-DD in a given time zone. */
export function todayIn(tz, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
/** Today's date in the person's time zone. */
export const today = (now = new Date()) => todayIn(activeTz, now);

function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Whole days from `today` to `due` (negative = overdue). */
export function daysUntil(due, today) {
  return dayNumber(due) - dayNumber(today);
}

/** Urgency label from the due date: Overdue, Due soon (<=2 days), This week (<=7), On track, No date, Done. */
export function urgency(task, today) {
  if (task.status === 'Done') return 'Done';
  if (!task.dueDate) return 'No date';
  const n = daysUntil(task.dueDate, today);
  if (n < 0) return 'Overdue';
  if (n <= 2) return 'Due soon';
  if (n <= 7) return 'This week';
  return 'On track';
}

export function uid(prefix = 't') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function newTask(fields = {}, now = new Date()) {
  const stamp = now.toISOString();
  return {
    id: uid('t'),
    title: '',
    status: 'To Do',
    priority: 'Medium',
    type: 'Project',
    project: '',
    startDate: '',
    dueDate: '',
    storyPoints: null,
    link: '',
    notes: '',
    checklist: [],
    parentId: null,
    createdAt: stamp,
    updatedAt: stamp,
    completedAt: null,
    ...fields
  };
}

/** Apply changes to a task, stamping updatedAt and completedAt. */
export function updateTask(task, changes, now = new Date()) {
  const stamp = now.toISOString();
  const next = { ...task, ...changes, updatedAt: stamp };
  if (next.status === 'Done' && task.status !== 'Done') next.completedAt = stamp;
  if (next.status !== 'Done' && task.status === 'Done') next.completedAt = null;
  return next;
}

/**
 * Merge two copies of tasks.json so edits from the app and from Claude never overwrite each other silently.
 * Each record wins by its own updatedAt. Deleted ids are kept as tombstones so a delete is not undone by a stale copy.
 */
export function mergeTaskFiles(a, b) {
  return mergeRecordFiles(a, b, 'tasks');
}

/** Same merge for any file shaped { <key>: [records with id and updatedAt], deleted: [...] }, such as highlights.json. */
export function mergeRecordFiles(a, b, key) {
  const byId = new Map();
  for (const t of [...(a[key] || []), ...(b[key] || [])]) {
    const have = byId.get(t.id);
    if (!have || (t.updatedAt || '') > (have.updatedAt || '')) byId.set(t.id, t);
  }
  const tomb = new Map();
  for (const d of [...(a.deleted || []), ...(b.deleted || [])]) {
    const have = tomb.get(d.id);
    if (!have || d.at > have.at) tomb.set(d.id, d);
  }
  for (const [id, d] of tomb) {
    const t = byId.get(id);
    if (t && (t.updatedAt || '') <= d.at) byId.delete(id);
  }
  const rest = { ...b, ...a };
  return { ...rest, schema: 1, [key]: [...byId.values()], deleted: [...tomb.values()] };
}

export function topLevel(tasks) {
  return tasks.filter((t) => !t.parentId);
}

export function subTasks(tasks, parentId) {
  return tasks.filter((t) => t.parentId === parentId);
}

export function filterTasks(tasks, f = {}) {
  const q = (f.q || '').trim().toLowerCase();
  return tasks.filter((t) => {
    if (f.type && f.type !== 'All' && t.type !== f.type) return false;
    if (f.priority && f.priority !== 'All' && t.priority !== f.priority) return false;
    if (f.project && f.project !== 'All' && t.project !== f.project) return false;
    if (f.status && f.status !== 'All' && t.status !== f.status) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function summarize(tasks, today) {
  const top = topLevel(tasks);
  const done = top.filter((t) => t.status === 'Done').length;
  const open = top.length - done;
  const byUrgency = Object.fromEntries(URGENCIES.map((u) => [u, 0]));
  for (const t of top) byUrgency[urgency(t, today)]++;
  return { total: top.length, done, open, byUrgency };
}

/** Open tasks due within 7 days (overdue ones included), soonest first. */
export function needsAttention(tasks, today) {
  return topLevel(tasks)
    .filter((t) => t.status !== 'Done' && t.dueDate && daysUntil(t.dueDate, today) <= 7)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate) || PRIORITIES.indexOf(x.priority) - PRIORITIES.indexOf(y.priority));
}

export function projectsOf(tasks) {
  return [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort();
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}`;
}

// ---------------------------------------------------------------------------
// Life module: daily records, highlights, categories
// ---------------------------------------------------------------------------

export const MOODS = ['Great', 'Good', 'Okay', 'Low', 'Rough'];
export const MOOD_SCORE = { Great: 5, Good: 4, Okay: 3, Low: 2, Rough: 1 };
export const MOOD_COLOR = { Great: '#2E8B57', Good: '#8BB84A', Okay: '#E5B93A', Low: '#E08A2D', Rough: '#C93A3A' };
export const CATEGORIES = ['Productivity', 'Mental Health', 'Office Life', 'Entertainment'];
export const CATEGORY_COLOR = { 'Productivity': '#3B6FB6', 'Mental Health': '#6B5BB5', 'Office Life': '#1E6B5A', 'Entertainment': '#C2650F' };

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

/** An empty daily record. Numbers are null until answered, so "not answered" is different from zero. */
export function newDay(date, now = new Date()) {
  const stamp = now.toISOString();
  return {
    date,
    mood: '',
    waterLitres: null,
    steps: null,
    pagesRead: null,
    bookTitle: '',
    movie: null,
    movieName: '',
    activity: null,
    activityName: '',
    calories: null,
    spentRupees: null,
    diary: '',
    moodAnalysis: '',
    createdAt: stamp,
    updatedAt: stamp
  };
}

/** Which of the 8 daily questions are still unanswered (used by the form and, later, by Claude). */
export function missingAnswers(day) {
  const m = [];
  if (day.waterLitres == null) m.push('water');
  if (day.steps == null) m.push('steps');
  if (!day.mood) m.push('mood');
  if (day.pagesRead == null) m.push('pages');
  if (day.movie == null) m.push('watched something');
  if (day.activity == null) m.push('activity');
  if (day.calories == null) m.push('calories');
  if (day.spentRupees == null) m.push('money');
  return m;
}

export function toNumberOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Turn what the form holds into a clean record. */
export function cleanDay(d) {
  return {
    ...d,
    waterLitres: toNumberOrNull(d.waterLitres),
    steps: toNumberOrNull(d.steps) == null ? null : Math.round(toNumberOrNull(d.steps)),
    pagesRead: toNumberOrNull(d.pagesRead) == null ? null : Math.round(toNumberOrNull(d.pagesRead)),
    spentRupees: toNumberOrNull(d.spentRupees),
    bookTitle: (d.bookTitle || '').trim(),
    movieName: d.movie ? (d.movieName || '').trim() : '',
    calories: toNumberOrNull(d.calories) == null ? null : Math.round(toNumberOrNull(d.calories)),
    activityName: d.activity ? (d.activityName || '').trim() : '',
    moodAnalysis: (d.moodAnalysis || '').trim()
  };
}

/**
 * Three-way merge of one daily record. `base` is what we loaded, `mine` is our edit, `theirs` is what is in Drive now.
 * A field changed only on one side takes that side. A field changed on both sides keeps ours, and is reported so the app can say so.
 */
export function merge3(base, mine, theirs) {
  const out = { ...theirs };
  const conflicts = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base || {})]);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  for (const k of keys) {
    if (k === 'updatedAt' || k === 'createdAt') continue;
    const b = base ? base[k] : undefined;
    const mineChanged = !same(mine[k], b);
    const theirsChanged = !same(theirs[k], b);
    if (mineChanged && theirsChanged && !same(mine[k], theirs[k])) conflicts.push(k);
    if (mineChanged) out[k] = mine[k];
    else out[k] = theirs[k];
  }
  out.createdAt = theirs.createdAt || mine.createdAt;
  out.updatedAt = mine.updatedAt > (theirs.updatedAt || '') ? mine.updatedAt : theirs.updatedAt;
  return { record: out, conflicts };
}

export function newHighlight(fields = {}, now = new Date()) {
  const stamp = now.toISOString();
  return { id: uid('h'), date: '', category: CATEGORIES[0], text: '', createdAt: stamp, updatedAt: stamp, ...fields };
}

/** Highlights for one category, oldest first. */
export function storyOf(highlights, category) {
  return highlights
    .filter((h) => h.category === category)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export function highlightsOn(highlights, date) {
  return highlights.filter((h) => h.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function formatLongDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[dt.getUTCDay()]}, ${d} ${months[m - 1]} ${y}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const monthLabel = (iso) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [y, m] = iso.split('-').map(Number);
  return `${months[m - 1]} ${y}`;
};
