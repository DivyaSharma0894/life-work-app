// Storage adapters. The app only talks to this interface, so it does not care whether data is in Google Drive or in demo mode.
//   init()                          make sure the folder and starter files exist
//   loadTasks() / saveTasks(d, v)   work board, merged with anything changed meanwhile
//   loadHighlights() / saveHighlights(d, v)
//   loadSettings() / saveSettings(d)
//   listDays()                      -> ['2026-10-17', '2026-10-18', ...]  (dates that have a daily record)
//   loadDay(date)                   -> { data | null, version }
//   saveDay(record, baseVersion, baseRecord) -> { data, version, conflicts }
//   deleteDay(date)                 permanent

import { mergeTaskFiles, mergeRecordFiles, merge3, DEFAULT_TYPES, isDate, browserTimeZone } from './logic.js';
import { FOLDER_MIME } from './drive.js';

export const FOLDER_NAME = 'Life & Work App';
export const DAYS_FOLDER = 'days';
export const INBOX_FOLDER = 'inbox';
export const MONTHS_FOLDER = 'months';
const MONTH_FILE = /^(\d{4}-\d{2})\.json$/;
export const README_MARK = 'Format version: 3';

export const EMPTY_TASKS = () => ({ schema: 1, tasks: [], deleted: [] });
export const EMPTY_HIGHLIGHTS = () => ({ schema: 1, highlights: [], deleted: [], summaries: {} });
export const DEFAULT_SETTINGS = () => ({
  schema: 1,
  taskTypes: [...DEFAULT_TYPES],
  goals: { waterLitres: 3, steps: 8000, pagesRead: 20, spendRupees: 0, calories: 0 },
  timezone: browserTimeZone(),
  currency: guessCurrency(browserTimeZone()),
  displayName: '',
  body: { sex: 'female', age: '', weightKg: '', heightCm: '', activity: 'light', goal: 'maintain', kgPerWeek: 0.5 }
});
const INDIA = new Set(['Asia/Kolkata', 'Asia/Calcutta']);
function guessCurrency(tz) { return INDIA.has(tz) ? '₹' : '$'; }
/** Fill in anything missing from saved settings. Older files without a currency keep working. */
export function withDefaults(saved) {
  const d = DEFAULT_SETTINGS();
  const out = { ...d, ...(saved || {}) };
  out.goals = { ...d.goals, ...((saved && saved.goals) || {}) };
  out.body = { ...d.body, ...((saved && saved.body) || {}) };
  if (!saved || saved.currency === undefined) out.currency = guessCurrency(out.timezone);
  return out;
}

/** This file is saved into the Drive folder so the data can be understood without the app, and by Claude in a new chat. */
export const README_TEXT = `# Life & Work App: data folder

${README_MARK}

This folder holds ALL data for the Life & Work App. Everything is plain JSON or Markdown you can open without the app.
Claude: you have no memory between chats, so read this file first. Only touch files inside this folder.

## READ THIS FIRST (Claude)

You can read every file in this folder, and you can create NEW files. You cannot edit an existing file with your Drive tools, so NEVER try to change tasks.json, highlights.json, settings.json or anything in days/ or months/.
To change anything, create ONE new note file inside the folder named "inbox":
- File name: YYYY-MM-DDTHHMM-short-topic.json (for example 2026-10-18T2105-diary.json)
- Save it as plain JSON text. If your tool offers it, keep the original type (do not convert to a Google Doc).
- The app opens the inbox the next time the person opens it or comes back to it, checks the note, saves it into the real files, and deletes the note. Tell the person: "Open your app and it will appear in a few seconds."
- If the person corrects something later, send a NEW note with the corrected values.
- Never delete anything. If the person wants something deleted, tell them to delete it in the app.

### Note format (every part is optional; send only what the person actually told you)
{
  "schema": 1,
  "days": [ { "date": "2026-10-18", "mood": "Good", "waterLitres": 2.5, "steps": 7000, "pagesRead": 12, "bookTitle": "...", "movie": true, "movieName": "...", "activity": false, "activityName": "...", "calories": 2000, "spentRupees": 300, "diary": "...", "moodAnalysis": "..." } ],
  "highlights": [ { "date": "2026-10-18", "category": "Mental Health", "text": "One or two plain lines." } ],
  "tasks": { "add": [ { "title": "...", "status": "To Do", "priority": "High", "type": "Project", "project": "", "startDate": "", "dueDate": "2026-10-20", "notes": "", "checklist": ["step one", "step two"] } ],
            "update": [ { "id": "t_existing_id", "status": "Done" } ] },
  "months": [ { "month": "2026-10", "text": "Short summary of the month.", "summarizedThrough": "2026-10-18" } ]
}
Rules for notes:
- LEAVE OUT any field the person did not answer. Never write null, 0, false or "" to mean "unknown": the app keeps the old value for fields you leave out, and an answered 0 or false is real information.
- Only the field names above are used; mood must be Great, Good, Okay, Low or Rough; category must be exactly Productivity, Mental Health, Office Life or Entertainment; dates are YYYY-MM-DD.
- Anything invalid is dropped by the app and reported to the person, so double check spelling.
- The task "update" needs the id from tasks.json, and sends only the fields that change.

### When the person says "diary time"
1. Read settings.json (displayName, timezone, currency). Work out today's date in THAT time zone, not UTC. Unless they name another day, the diary is for today.
2. Read days/<date>.json if it exists, to see what is already answered (null or empty means not answered).
3. Invite them to tell you about their day in their own words first. Then ask ONLY for what is still missing of the 8 daily answers: water (litres), steps, mood (Great/Good/Okay/Low/Rough), pages read, watched something (a movie, show or series, and its title), did an activity today (yes/no; if yes, ask which one, for example a walk, yoga, a workout, dancing or singing), calories eaten today (a number, an estimate is fine), money spent. If they mention the book they are reading, record bookTitle. Ask a few at a time, never as a long form.
4. "diary" holds what they told you about their day, in their own words, lightly tidied. Do not invent or embellish anything.
5. "moodAnalysis" is ONE short line about the mood of the day, based only on what they said.
6. Highlights are for the stories. Suggest at most 3 moments they actually mentioned, each one or two plain lines in the third person using displayName (or first person if displayName is empty), for example "<name> finished the report ahead of the deadline." Nothing extra. Show the suggestions and save only the ones they approve.
7. Create the note in inbox and tell them what you saved in one short list. Do not paste their diary text back unless asked.

### Month summaries (only when asked, e.g. "summarize my month")
Read months/YYYY-MM.json if it exists: it holds "summary" and "summarizedThrough". Read only the days AFTER summarizedThrough (list the days folder), then write an updated summary of the whole month so far (under 120 words: mood trend, spending, steps, reading, movies, the main events), and send it in "months" with the new summarizedThrough (the last date you covered). Months are plain text for the person to read; do not store totals, the app calculates those.

### Work tasks
To add or change tasks, use the note format above. Read tasks.json first and reuse the exact ids. Ask before marking anything Done or changing dates. Urgency is calculated, never stored.

## Files

### tasks.json  (work board)
{ "schema": 1, "tasks": [ Task, ... ], "deleted": [ { "id": "...", "at": "ISO time" } ] }

Task fields:
- id: string, unique, e.g. "t_abc123". Never reuse.
- title: string
- status: one of Backlog | To Do | In Progress | In Review | Blocked | Done
- priority: one of Critical | High | Medium | Low
- type: one of the taskTypes in settings.json (default Project | Upskilling | POC | Admin)
- project: string, project name (may be empty)
- startDate, dueDate: "YYYY-MM-DD" or "" (in the time zone set in settings.json)
- storyPoints: number or null
- link: string URL or ""
- notes: string
- checklist: [ { "id": "...", "text": "...", "done": true|false } ]
- parentId: id of the parent task for a sub-task, or null
- createdAt, updatedAt: ISO timestamps. ALWAYS set updatedAt to now when you change a task.
- completedAt: ISO timestamp when moved to Done, else null

Rules for tasks.json (read it freely; to change it, use the inbox note above):
1. The app and the person edit this file directly. Claude only reads it and uses ids from it.
2. Deleted tasks are listed in "deleted" with their id so they are never brought back.
3. Urgency (Overdue, Due soon, This week, On track, No date, Done) is NOT stored. It is calculated from dueDate:
   overdue = before today, due soon = within 2 days, this week = within 7 days, otherwise on track.
4. The app merges by updatedAt per task, so a stale copy never silently overwrites a newer edit.

### days/YYYY-MM-DD.json  (one daily record per date, e.g. days/2026-10-18.json)
{
  "date": "2026-10-18",
  "mood": "Great" | "Good" | "Okay" | "Low" | "Rough" | ""   (mood across the whole day),
  "waterLitres": number | null,        (litres of water)
  "steps": number | null,
  "pagesRead": number | null,
  "bookTitle": "",                     (what was being read, optional)
  "movie": true | false | null,        (watched something today? a movie, show, series or anything else)
  "movieName": "",                     (title of what was watched, only if movie is true; the field names are historical)
  "activity": true | false | null,     (did an activity today, for example a walk, yoga or a workout?)
  "activityName": "",                  (which activity, only if activity is true)
  "calories": number | null,           (calories eaten today, kcal)
  "spentRupees": number | null,        (money spent, in the currency set in settings.json; the field name is historical)
  "diary": "",                         (the full diary text, private)
  "moodAnalysis": "",                  (ONE short line on the mood, written by Claude)
  "createdAt": "ISO time", "updatedAt": "ISO time"
}
null means "not answered yet", which is different from 0 or false. Ask only for what is null or empty.
Read these files freely. Claude changes a day only through an inbox note.
Totals, averages and the mood meter are never stored. They are calculated from these files.

### highlights.json  (the "stories": one or two lines per moment, grouped by life category)
{ "schema": 1, "highlights": [ Highlight, ... ], "deleted": [ { "id", "at" } ], "summaries": { "<category>": { "text": "", "updatedAt": "" } } }
Highlight: { "id": "h_abc123", "date": "YYYY-MM-DD", "category": "...", "text": "...", "createdAt": "ISO", "updatedAt": "ISO" }
Categories (exactly these): Productivity | Mental Health | Office Life | Entertainment
Write one or two plain lines, for example "<name> finished the report ahead of the deadline." using the third person and the displayName from settings.json (if it is empty, write in the first person: "I finished the report..."). Add nothing extra.
Claude adds highlights through an inbox note only.

### settings.json
displayName, taskTypes, personal goals per day (waterLitres, steps, pagesRead, spendRupees, calories; 0 = no goal), timezone (IANA name, e.g. Asia/Kolkata) and currency (a symbol such as ₹ or $).
Work out "today" in that time zone, not UTC.

### months/YYYY-MM.json  (rolling month summary, written by the app from Claude's notes)
{ "schema": 1, "month": "2026-10", "summary": "text", "summarizedThrough": "2026-10-18", "updatedAt": "ISO time" }
`;

const pretty = (d) => JSON.stringify(d, null, 2);
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

// ---------- Demo mode: data stays in this browser only ----------

export function createLocalAdapter(ls = window.localStorage) {
  const get = (k, fallback) => {
    try { const v = JSON.parse(ls.getItem(k)); return v || fallback(); } catch (e) { return fallback(); }
  };
  const put = (k, v) => ls.setItem(k, JSON.stringify(v));
  const dayKey = (d) => `lwa.demo.day.${d}`;
  return {
    kind: 'local',
    label: 'Demo mode (this browser only)',
    async init() { return {}; },
    async loadTasks() { return { data: get('lwa.demo.tasks', EMPTY_TASKS), version: '0' }; },
    async saveTasks(data) { put('lwa.demo.tasks', data); return { data, version: '0' }; },
    async loadHighlights() { return { data: { ...EMPTY_HIGHLIGHTS(), ...get('lwa.demo.highlights', EMPTY_HIGHLIGHTS) }, version: '0' }; },
    async saveHighlights(data) { put('lwa.demo.highlights', data); return { data, version: '0' }; },
    async loadSettings() { return { data: withDefaults(get('lwa.demo.settings', () => null)), version: '0' }; },
    async saveSettings(data) { put('lwa.demo.settings', data); return { data, version: '0' }; },
    async listDays() {
      const out = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith('lwa.demo.day.')) out.push(k.slice('lwa.demo.day.'.length));
      }
      return out.filter(isDate).sort();
    },
    async loadDay(date) {
      const raw = ls.getItem(dayKey(date));
      return { data: raw ? JSON.parse(raw) : null, version: raw ? '0' : null };
    },
    async saveDay(record) { put(dayKey(record.date), record); return { data: record, version: '0', conflicts: [] }; },
    async deleteDay(date) { ls.removeItem(dayKey(date)); },
    async listInbox() { return []; }, // Claude cannot reach demo data, so there is never an inbox here
    async readInbox() { return ''; },
    async removeInbox() {},
    async loadMonth(ym) { const raw = ls.getItem(`lwa.demo.month.${ym}`); return { data: raw ? JSON.parse(raw) : null, version: '0' }; },
    async saveMonth(ym, data) { put(`lwa.demo.month.${ym}`, data); return { data, version: '0' }; },
    async who() { return { displayName: 'Demo', emailAddress: 'data is saved only in this browser' }; }
  };
}

// ---------- Google Drive ----------

export function createDriveAdapter({ client, folderName = FOLDER_NAME }) {
  let folderId = null;
  let daysId = null;
  let inboxId = null;
  let monthsId = null;
  let monthFiles = {};
  let files = {};
  let dayFiles = {};
  let ready = null;

  async function doEnsure() {
    let f = await client.findFolder(folderName);
    if (!f) f = await client.createFolder(folderName);
    folderId = f.id;
    files = await client.listFolder(folderId);
    if (!files['README.md']) {
      files['README.md'] = await client.createFile(folderId, 'README.md', README_TEXT, 'text/markdown');
    } else {
      // Bring an older README up to date when the data format grows
      const r = await client.readText(files['README.md'].id);
      if (!r.text.includes(README_MARK)) await client.updateFile(files['README.md'].id, README_TEXT, 'text/markdown');
    }
    if (!files['tasks.json']) files['tasks.json'] = await client.createFile(folderId, 'tasks.json', pretty(EMPTY_TASKS()));
    if (!files['settings.json']) files['settings.json'] = await client.createFile(folderId, 'settings.json', pretty(DEFAULT_SETTINGS()));
    if (!files['highlights.json']) files['highlights.json'] = await client.createFile(folderId, 'highlights.json', pretty(EMPTY_HIGHLIGHTS()));
    const dir = files[DAYS_FOLDER] && files[DAYS_FOLDER].mimeType === FOLDER_MIME ? files[DAYS_FOLDER] : null;
    daysId = dir ? dir.id : (await client.createFolder(DAYS_FOLDER, folderId)).id;
    dayFiles = await client.listFolder(daysId);
    const sub = async (name) => (files[name] && files[name].mimeType === FOLDER_MIME ? files[name] : await client.createFolder(name, folderId)).id;
    inboxId = await sub(INBOX_FOLDER);
    monthsId = await sub(MONTHS_FOLDER);
  }
  // One start-up at a time, even if several screens ask at once
  const ensure = () => ready || (ready = doEnsure().catch((e) => { ready = null; throw e; }));

  function parse(name, text, fallback) {
    try { return text.trim() ? JSON.parse(text) : fallback(); } catch (e) {
      throw new Error(`${name} in your Drive folder is not valid JSON, so the app did not open it to avoid overwriting it. Fix or delete that file and reload.`);
    }
  }

  async function readJson(name, fallback) {
    await ensure();
    const { text, version } = await client.readText(files[name].id);
    return { data: parse(name, text, fallback), version };
  }

  /** Save a whole-file record collection. If the file changed in Drive since `baseVersion`, merge before writing. */
  async function saveMerged(name, data, baseVersion, merge, fallback) {
    await ensure();
    const m = await client.meta(files[name].id);
    let toWrite = data;
    if (String(m.version) !== String(baseVersion)) {
      const remote = await readJson(name, fallback);
      toWrite = merge(data, remote.data);
    }
    const saved = await client.updateFile(files[name].id, pretty(toWrite));
    return { data: toWrite, version: saved.version };
  }

  async function dayFile(date, relist = true) {
    await ensure();
    const name = `${date}.json`;
    if (!dayFiles[name] && relist) dayFiles = await client.listFolder(daysId);
    return dayFiles[name] || null;
  }

  return {
    kind: 'drive',
    get label() { return `Google Drive / ${folderName}`; },
    async init() { await ensure(); return { folderId }; },

    loadTasks() { return readJson('tasks.json', EMPTY_TASKS); },
    saveTasks(data, baseVersion) { return saveMerged('tasks.json', data, baseVersion, mergeTaskFiles, EMPTY_TASKS); },

    async loadHighlights() {
      const r = await readJson('highlights.json', EMPTY_HIGHLIGHTS);
      return { data: { ...EMPTY_HIGHLIGHTS(), ...r.data }, version: r.version };
    },
    saveHighlights(data, baseVersion) {
      return saveMerged('highlights.json', data, baseVersion, (a, b) => mergeRecordFiles(a, b, 'highlights'), EMPTY_HIGHLIGHTS);
    },

    async loadSettings() {
      const r = await readJson('settings.json', DEFAULT_SETTINGS);
      return { data: withDefaults(r.data), version: r.version };
    },
    async saveSettings(data) {
      await ensure();
      const saved = await client.updateFile(files['settings.json'].id, pretty(data));
      return { data, version: saved.version };
    },

    async listDays() {
      await ensure();
      dayFiles = await client.listFolder(daysId);
      return Object.keys(dayFiles).map((n) => (n.match(DAY_FILE) || [])[1]).filter(Boolean).sort();
    },
    async loadDay(date) {
      const f = await dayFile(date);
      if (!f) return { data: null, version: null };
      const { text, version } = await client.readText(f.id);
      return { data: parse(`days/${date}.json`, text, () => null), version };
    },
    /** Saves one daily record. If it changed in Drive meanwhile (for example Claude filled in the mood), the two are merged field by field. */
    async saveDay(record, baseVersion, baseRecord) {
      const name = `${record.date}.json`;
      const f = await dayFile(record.date);
      if (!f) {
        const created = await client.createFile(daysId, name, pretty(record));
        dayFiles[name] = created;
        return { data: record, version: created.version, conflicts: [] };
      }
      const m = await client.meta(f.id);
      let toWrite = record;
      let conflicts = [];
      if (baseVersion == null || String(m.version) !== String(baseVersion)) {
        const { text } = await client.readText(f.id);
        const remote = parse(`days/${record.date}.json`, text, () => null);
        if (remote) {
          const r = merge3(baseRecord || null, record, remote);
          toWrite = r.record;
          conflicts = r.conflicts;
        }
      }
      const saved = await client.updateFile(f.id, pretty(toWrite));
      return { data: toWrite, version: saved.version, conflicts };
    },
    async deleteDay(date) {
      const f = await dayFile(date);
      if (f) { await client.deleteFile(f.id); delete dayFiles[`${date}.json`]; }
    },

    // ----- Claude's inbox: new note files only; each is deleted after the app has saved its contents -----
    async listInbox() {
      await ensure();
      const all = await client.listFolder(inboxId);
      return Object.values(all).filter((f) => f.mimeType !== FOLDER_MIME).sort((a, b) => a.name.localeCompare(b.name));
    },
    async readInbox(file) {
      if (file.mimeType === 'application/vnd.google-apps.document') return client.exportText(file.id);
      return (await client.readText(file.id)).text;
    },
    async removeInbox(file) { await client.deleteFile(file.id); },

    // ----- Rolling month summaries: months/YYYY-MM.json -----
    async loadMonth(ym) {
      await ensure();
      monthFiles = await client.listFolder(monthsId);
      const f = monthFiles[`${ym}.json`];
      if (!f) return { data: null, version: null };
      const { text, version } = await client.readText(f.id);
      return { data: parse(`months/${ym}.json`, text, () => null), version };
    },
    async saveMonth(ym, data) {
      await ensure();
      const name = `${ym}.json`;
      if (!monthFiles[name]) monthFiles = await client.listFolder(monthsId);
      const f = monthFiles[name];
      if (!f) { const created = await client.createFile(monthsId, name, pretty(data)); monthFiles[name] = created; return { data, version: created.version }; }
      const saved = await client.updateFile(f.id, pretty(data));
      return { data, version: saved.version };
    },

    async who() { return client.about(); }
  };
}
