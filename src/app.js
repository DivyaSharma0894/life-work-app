import { html, render, useState, useEffect, useRef, Icon } from './ui.js';
import { today as todayNow, setTimeZone, newTask, updateTask, mergeTaskFiles, mergeRecordFiles, projectsOf, DEFAULT_TYPES } from './logic.js';
import { createDriveClient } from './drive.js';
import { createDriveAdapter, createLocalAdapter, FOLDER_NAME, DEFAULT_SETTINGS } from './storage.js';
import { signIn, signOut, makeTokenProvider, hasValidToken } from './auth.js';
import { BoardPage } from './board.js';
import { TaskEditor } from './taskEditor.js';
import { sampleTasks } from './sample.js';
import { SettingsPage } from './settings.js';
import { createSynced } from './synced.js';
import { DiaryPage } from './diary.js';
import { StoriesPage } from './stories.js';
import { TodayPage } from './today.js';
import { MonthPage } from './month.js';
import { LockScreen } from './lockui.js';
import { createLock, loadLock, saveLock } from './lock.js';
import { parseInbox, applyDayFields, applyHighlights, applyTasks } from './inbox.js';

const LS = window.localStorage;
const NAV = [
  { id: 'today', label: 'Today', icon: 'today', locked: true },
  { id: 'diary', label: 'Diary', icon: 'diary', locked: true },
  { id: 'board', label: 'Work board', icon: 'board' },
  { id: 'month', label: 'Month', icon: 'month', locked: true },
  { id: 'stories', label: 'Stories', icon: 'stories', locked: true },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];
function routeFromHash() {
  const id = (location.hash || '').replace('#/', '');
  return NAV.some((n) => n.id === id) ? id : 'today';
}

function Welcome({ onDemo, onSetup, sharedId, onConnect }) {
  return html`
    <div class="setup">
      <div><h1 style="font-size:44px">Life & Work</h1><p class="muted" style="font-size:17px;line-height:1.6">Your tasks, diary and habits in one private app. Your data lives in your own Google Drive.</p></div>
      <div class="card pad">
        <h2>Connect your Google Drive</h2>
        <div class="muted">This is the real thing. The app saves everything in one folder called “${FOLDER_NAME}” in your Drive, and Claude can read and update the same folder. It needs a one-time setup of about 5 minutes.</div>
        ${sharedId
          ? html`<div class="small muted">The person who shared this app already set up the Google connection for you. Just sign in with your own Google account.</div>
            <div class="row"><button class="btn primary" onClick=${onConnect}>Connect my Google Drive</button><button class="btn ghost" onClick=${onSetup}>Use my own Client ID instead</button></div>`
          : html`<div><button class="btn primary" onClick=${onSetup}>Set up Google Drive</button></div>`}
      </div>
      <div class="card pad">
        <h2>Just look around first</h2>
        <div class="muted">Demo mode saves to this browser only. You can switch to Google Drive later from Settings.</div>
        <div><button class="btn" onClick=${onDemo}>Try demo mode</button></div>
      </div>
    </div>`;
}

function SetupGuide({ initial, onContinue, onBack }) {
  const [id, setId] = useState(initial || '');
  const ok = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id.trim());
  return html`
    <div class="setup">
      <div><button class="btn ghost" onClick=${onBack}><${Icon} name="left" size=${18} />Back</button></div>
      <h1 style="font-size:36px">Set up Google Drive</h1>
      <div class="card pad">
        <div class="muted">Google needs to know this app is yours. You create a free “OAuth client ID” once. It stays on this computer.</div>
        <ol>
          <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">Google Cloud Console</a> and create a project called “Life and Work”.</li>
          <li>Open <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">Google Drive API</a> and press <b>Enable</b>.</li>
          <li>Go to <b>APIs &amp; Services › OAuth consent screen</b> (newer Google Cloud: <b>Google Auth Platform</b>). If it shows <b>Get started</b>, click it, enter an app name and your email, choose <b>External</b> and create it.</li>
          <li><b>Add yourself as a test user. Do not skip this.</b> On the same screen open <b>Audience</b> (or the <b>Test users</b> section), check that the status is <b>Testing</b>, click <b>Add users</b>, type the exact Gmail address you will sign in with and <b>Save</b>. If it is not in the list, Google blocks sign-in with <i>Error 403: access_denied</i>.</li>
          <li>Go to <b>Credentials</b> (or <b>Clients</b>) and click <b>Create credentials › OAuth client ID</b>. Choose <b>Web application</b>.</li>
          <li>Under <b>Authorised JavaScript origins</b> add <span class="code">${location.origin}</span></li>
          <li>Create it, copy the <b>Client ID</b> and paste it below.</li>
        </ol>
      </div>
      <div class="card pad">
        <div class="field"><label for="cid">Client ID</label>
          <input id="cid" class="input" placeholder="1234567890-abc123.apps.googleusercontent.com" value=${id} onInput=${(e) => setId(e.target.value)} /></div>
        ${id && !ok && html`<div class="small" style="color:#A52A2A">That does not look like a Client ID. It ends with .apps.googleusercontent.com</div>`}
        <div class="small muted">Google will warn that the app is not verified. That is normal for your own app: choose Advanced, then continue. The app can see your whole Drive but only ever reads and writes its own folder.</div>
        <div><button class="btn primary" disabled=${!ok} onClick=${() => onContinue(id.trim())}>Save and sign in with Google</button></div>
      </div>
    </div>`;
}

function SignInScreen({ onSignIn, onChangeId, onDemo, error, busy }) {
  return html`
    <div class="setup">
      <h1 style="font-size:40px">Welcome back</h1>
      <div class="card pad">
        <div class="muted">Sign in to open your “${FOLDER_NAME}” folder.</div>
        ${error && html`<div class="banner err" role="alert">${error}</div>`}
        <div class="row"><button class="btn primary" disabled=${busy} onClick=${onSignIn}>${busy ? 'Opening Google…' : 'Continue with Google'}</button>
          <button class="btn ghost" onClick=${onChangeId}>Change Client ID</button>
          <button class="btn ghost" onClick=${onDemo}>Use demo mode</button></div>
      </div>
    </div>`;
}

function App() {
  const [phase, setPhase] = useState('boot'); // boot | welcome | setup | signin | loading | ready | error
  const [phaseMsg, setPhaseMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [adapter, setAdapter] = useState(null);
  const [file, setFile] = useState(null);
  const [hlFile, setHlFile] = useState(null);
  const [lock, setLock] = useState(loadLock());
  const [sharedId, setSharedId] = useState('');
  const [inboxNote, setInboxNote] = useState(null); // { text, problems }
  const [reloadKey, setReloadKey] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS());
  const [who, setWho] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [saveError, setSaveError] = useState('');
  const [route, setRoute] = useState(routeFromHash());
  const [today, setToday] = useState(todayNow());
  const [editing, setEditing] = useState(null); // { task, isNew }

  const adapterRef = useRef(null);
  const tasksSync = useRef(null);
  const hlSync = useRef(null);
  const statuses = useRef({});
  const lastActive = useRef(Date.now());
  const importing = useRef(false);
  const failedNotes = useRef(new Set());
  const lastInbox = useRef(0);
  const lockRef = useRef(lock);
  lockRef.current = lock;

  // ----- routing and clock -----
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    const tick = setInterval(() => setToday(todayNow()), 60000);
    return () => { window.removeEventListener('hashchange', onHash); clearInterval(tick); };
  }, []);

  // ----- start-up -----
  useEffect(() => {
    fetch('config.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => {
      if (c && /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test((c.clientId || '').trim())) setSharedId(c.clientId.trim());
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const mode = LS.getItem('lwa.mode');
    const cid = LS.getItem('lwa.clientId');
    if (mode === 'demo') startDemo();
    else if (mode === 'drive' && cid) { if (hasValidToken()) startDrive(cid); else setPhase('signin'); }
    else setPhase('welcome');
  }, []);

  async function applyLoaded(ad, sets) {
    adapterRef.current = ad;
    setAdapter(ad);
    const onStatus = (name, st, msg) => {
      statuses.current[name] = { st, msg };
      const all = Object.values(statuses.current);
      const bad = all.find((x) => x.st === 'error');
      setSaveState(bad ? 'error' : all.some((x) => x.st === 'saving') ? 'saving' : 'saved');
      setSaveError(bad ? bad.msg : '');
    };
    statuses.current = {};
    tasksSync.current = createSynced({ name: 'tasks', load: () => ad.loadTasks(), save: (d, v) => ad.saveTasks(d, v), merge: mergeTaskFiles, onData: setFile, onStatus });
    hlSync.current = createSynced({ name: 'highlights', load: () => ad.loadHighlights(), save: (d, v) => ad.saveHighlights(d, v), merge: (x, y) => mergeRecordFiles(x, y, 'highlights'), onData: setHlFile, onStatus });
    await Promise.all([tasksSync.current.init(), hlSync.current.init()]);
    setTimeZone(sets.data.timezone);
    setToday(todayNow());
    setSettings(sets.data);
    setPhase('ready');
  }

  async function startDemo() {
    LS.setItem('lwa.mode', 'demo');
    const ad = createLocalAdapter();
    const s = await ad.loadSettings();
    setWho(await ad.who());
    await applyLoaded(ad, s);
  }

  async function startDrive(cid) {
    setPhase('loading');
    try {
      const client = createDriveClient({ getToken: makeTokenProvider(cid) });
      const ad = createDriveAdapter({ client });
      const init = await ad.init();
      setFolderId(init.folderId);
      const [s, me] = await Promise.all([ad.loadSettings(), ad.who().catch(() => null)]);
      setWho(me);
      await applyLoaded(ad, s);
    } catch (e) {
      if (e.code === 'AUTH' || e.status === 401) { setPhaseMsg('Your Google session ended. Please sign in again.'); setPhase('signin'); return; }
      let msg = e.message || String(e);
      if (e.status === 403) msg += ' If this mentions the Drive API being disabled, enable “Google Drive API” in your Google Cloud project and try again.';
      setPhaseMsg(msg);
      setPhase('error');
    }
  }

  async function doSignIn(cid) {
    setBusy(true);
    setPhaseMsg('');
    try {
      await signIn(cid);
      LS.setItem('lwa.clientId', cid);
      LS.setItem('lwa.mode', 'drive');
      setBusy(false);
      await startDrive(cid);
    } catch (e) {
      setBusy(false);
      setPhaseMsg(e.message || 'Sign-in did not finish.');
      setPhase('signin');
      if (!LS.getItem('lwa.clientId')) LS.setItem('lwa.clientId', cid);
      if (!LS.getItem('lwa.mode')) LS.setItem('lwa.mode', 'drive');
    }
  }

  // ----- saving: each shared file has its own queue (see synced.js) -----
  const commit = (next) => tasksSync.current.commit(next);
  const commitHl = (next) => hlSync.current.commit(next);
  function refresh(force) {
    if (tasksSync.current) tasksSync.current.refresh(force);
    if (hlSync.current) hlSync.current.refresh(force);
    if (force || Date.now() - lastInbox.current > 15000) importInbox();
  }

  // ----- Claude's inbox: notes Claude left in Drive are checked, saved into your files, and only then deleted -----
  async function importInbox(retryFailed = false) {
    const ad = adapterRef.current;
    if (!ad || ad.kind !== 'drive' || importing.current || !tasksSync.current || !hlSync.current) return 'Nothing to check.';
    importing.current = true;
    lastInbox.current = Date.now();
    if (retryFailed) failedNotes.current = new Set();
    const tally = { days: 0, highlights: 0, taskAdds: 0, taskUpdates: 0, months: 0 };
    const problems = [];
    let handled = 0;
    try {
      const list = (await ad.listInbox()).filter((f) => !failedNotes.current.has(f.name));
      for (const f of list) {
        const fail = (msg) => { failedNotes.current.add(f.name); problems.push(msg); };
        let text;
        try { text = await ad.readInbox(f); } catch (e) { fail(`${f.name}: could not be read (${e.message})`); continue; }
        const r = parseInbox(text, f.name);
        if (!r.ok) { fail(`${f.name}: ${r.problems.join('; ')}. The file was left in the inbox folder.`); continue; }
        problems.push(...r.problems.map((x) => `${f.name}: ${x}`));
        try {
          for (const d of r.plan.days) {
            if (!Object.keys(d.fields).length) continue;
            const cur = await ad.loadDay(d.date);
            await ad.saveDay(applyDayFields(cur.data, d.date, d.fields), cur.version, cur.data);
            tally.days++;
          }
          if (r.plan.highlights.length) {
            const hr = applyHighlights(hlSync.current.data, r.plan.highlights);
            if (hr.added && !(await hlSync.current.commit(hr.file))) throw new Error('highlights could not be saved');
            tally.highlights += hr.added;
          }
          if (r.plan.tasksAdd.length || r.plan.tasksUpdate.length) {
            const tr = applyTasks(tasksSync.current.data, r.plan);
            problems.push(...tr.problems.map((x) => `${f.name}: ${x}`));
            if ((tr.added || tr.updated) && !(await tasksSync.current.commit(tr.file))) throw new Error('tasks could not be saved');
            tally.taskAdds += tr.added; tally.taskUpdates += tr.updated;
          }
          for (const m of r.plan.months) {
            const cur = await ad.loadMonth(m.month);
            if (cur.data && (cur.data.summarizedThrough || '') > m.summarizedThrough) continue; // an older note: keep the newer summary
            await ad.saveMonth(m.month, { schema: 1, month: m.month, summary: m.text, summarizedThrough: m.summarizedThrough, updatedAt: new Date().toISOString() });
            tally.months++;
          }
          await ad.removeInbox(f);
          handled++;
        } catch (e) { fail(`${f.name}: ${e.message || e}. It stays in the inbox and will not be lost.`); }
      }
    } catch (e) {
      problems.push(`Could not check Claude's inbox: ${e.message || e}`);
    } finally { importing.current = false; }
    const parts = [];
    if (tally.days) parts.push(`${tally.days} day${tally.days > 1 ? 's' : ''}`);
    if (tally.highlights) parts.push(`${tally.highlights} highlight${tally.highlights > 1 ? 's' : ''}`);
    if (tally.taskAdds) parts.push(`${tally.taskAdds} new task${tally.taskAdds > 1 ? 's' : ''}`);
    if (tally.taskUpdates) parts.push(`${tally.taskUpdates} task update${tally.taskUpdates > 1 ? 's' : ''}`);
    if (tally.months) parts.push('a month summary');
    if (parts.length || problems.length) setInboxNote({ text: parts.length ? `Added from Claude: ${parts.join(', ')}.` : '', problems });
    if (parts.length) setReloadKey((k) => k + 1);
    return parts.length ? `Added from Claude: ${parts.join(', ')}.` : problems.length ? 'Some notes could not be used. See the message at the top.' : 'No new notes from Claude.';
  }

  useEffect(() => { if (phase === 'ready') importInbox(); }, [phase]);

  useEffect(() => {
    const onFocus = () => refresh(false);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  });

  // ----- app lock: locks Diary and Stories, re-locks after inactivity -----
  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); };
    ['pointerdown', 'keydown', 'scroll'].forEach((e) => window.addEventListener(e, bump, true));
    const t = setInterval(() => {
      const l = lockRef.current;
      if (l && Date.now() - lastActive.current > l.autoLockMinutes * 60000) setUnlocked(false);
    }, 5000);
    return () => { ['pointerdown', 'keydown', 'scroll'].forEach((e) => window.removeEventListener(e, bump, true)); clearInterval(t); };
  }, []);

  const lockApi = {
    enable: async (pin) => { const l = await createLock(pin, 5); saveLock(l); setLock(l); setUnlocked(true); lastActive.current = Date.now(); },
    change: async (cur, next) => {
      const { verifyPin } = await import('./lock.js');
      if (!(await verifyPin(cur, lock))) return 'The current PIN is not right.';
      const l = await createLock(next, lock.autoLockMinutes); saveLock(l); setLock(l); return null;
    },
    remove: async (cur) => {
      const { verifyPin } = await import('./lock.js');
      if (!(await verifyPin(cur, lock))) return 'The current PIN is not right.';
      saveLock(null); setLock(null); return null;
    },
    setMinutes: (m) => { const l = { ...lock, autoLockMinutes: m }; saveLock(l); setLock(l); },
    lockNow: () => setUnlocked(false)
  };

  // ----- task actions -----
  const tasks = file ? file.tasks : [];
  const highlights = hlFile ? hlFile.highlights : [];

  function saveTask(t) {
    const existing = tasks.find((x) => x.id === t.id);
    if (existing) {
      const { id, createdAt, updatedAt, completedAt, ...changes } = t;
      const upd = updateTask(existing, changes);
      commit({ ...file, tasks: tasks.map((x) => (x.id === t.id ? upd : x)) });
    } else {
      commit({ ...file, tasks: [...tasks, t] });
    }
    setEditing(null);
  }
  function moveTask(id, status) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    commit({ ...file, tasks: tasks.map((x) => (x.id === id ? updateTask(x, { status }) : x)) });
  }
  function deleteTask(id) {
    const gone = new Set([id, ...tasks.filter((t) => t.parentId === id).map((t) => t.id)]);
    const at = new Date().toISOString();
    commit({ ...file, tasks: tasks.filter((t) => !gone.has(t.id)), deleted: [...(file.deleted || []), ...[...gone].map((g) => ({ id: g, at }))] });
    setEditing(null);
  }
  function addSub(parent, title) {
    commit({ ...file, tasks: [...tasks, newTask({ title, parentId: parent.id, type: parent.type, project: parent.project, priority: parent.priority })] });
  }
  function openTask(t) { setEditing({ task: t, isNew: false }); }
  function openTaskById(id) { const t = ((tasksSync.current.data || {}).tasks || []).find((x) => x.id === id); if (t) setEditing({ task: t, isNew: false }); }
  function saveHighlight(h) {
    const now = new Date().toISOString();
    const exists = highlights.some((x) => x.id === h.id);
    const next = { ...h, updatedAt: now };
    commitHl({ ...hlFile, highlights: exists ? highlights.map((x) => (x.id === h.id ? next : x)) : [...highlights, next] });
  }
  function deleteHighlight(id) {
    commitHl({ ...hlFile, highlights: highlights.filter((x) => x.id !== id), deleted: [...(hlFile.deleted || []), { id, at: new Date().toISOString() }] });
  }
  function seed() { commit({ ...file, tasks: [...tasks, ...sampleTasks(today)] }); }

  async function saveSettings(next) {
    try {
      const r = await adapterRef.current.saveSettings(next);
      setTimeZone(r.data.timezone);
      setToday(todayNow());
      setSettings(r.data);
      return null;
    } catch (e) { return e.message || String(e); }
  }

  function leave(toPhase) {
    signOut();
    LS.removeItem('lwa.mode');
    adapterRef.current = null; setAdapter(null); setFile(null); setHlFile(null); tasksSync.current = null; hlSync.current = null; setUnlocked(false);
    setPhase(toPhase);
  }

  // ----- screens before the app is ready -----
  if (phase === 'boot' || phase === 'loading') return html`<div class="setup"><div class="card empty">${phase === 'loading' ? 'Opening your Drive folder…' : 'Starting…'}</div></div>`;
  if (phase === 'welcome') return html`<${Welcome} onDemo=${startDemo} sharedId=${sharedId} onConnect=${() => doSignIn(sharedId)} onSetup=${() => setPhase('setup')} />`;
  if (phase === 'setup') return html`<${SetupGuide} initial=${LS.getItem('lwa.clientId') || sharedId || ''} onBack=${() => setPhase('welcome')} onContinue=${doSignIn} />`;
  if (phase === 'signin') return html`<${SignInScreen} error=${phaseMsg} busy=${busy} onSignIn=${() => doSignIn(LS.getItem('lwa.clientId'))} onChangeId=${() => setPhase('setup')} onDemo=${startDemo} />`;
  if (phase === 'error') return html`<div class="setup"><h1>Could not open Drive</h1><div class="banner err" role="alert">${phaseMsg}</div>
    <div class="row"><button class="btn primary" onClick=${() => startDrive(LS.getItem('lwa.clientId'))}>Try again</button><button class="btn" onClick=${() => leave('signin')}>Sign in again</button></div></div>`;

  // ----- the app -----
  const isDemo = adapter && adapter.kind === 'local';
  const syncText = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : isDemo ? 'Saved in this browser' : 'Saved to Drive';
  const dotClass = saveState === 'error' ? 'dot err' : saveState === 'saving' ? 'dot warn' : 'dot';

  let page;
  if (route === 'board') {
    page = html`<${BoardPage} tasks=${tasks} today=${today} types=${settings.taskTypes || DEFAULT_TYPES}
      onOpen=${openTask} onNew=${() => setEditing({ task: newTask(), isNew: true })} onMove=${moveTask} canSeed=${isDemo} onSeed=${seed} />`;
  } else if (['today', 'diary', 'stories', 'month'].includes(route) && lock && !unlocked) {
    page = html`<${LockScreen} lock=${lock} what=${{ today: 'Today', diary: 'Your Diary', stories: 'Your Stories', month: 'The Month page' }[route]}
      onUnlock=${() => { setUnlocked(true); lastActive.current = Date.now(); }}
      onForgot=${() => { saveLock(null); setLock(null); leave('signin'); }} />`;
  } else if (route === 'today') {
    page = html`<${TodayPage} api=${adapter} today=${today} goals=${settings.goals} currency=${settings.currency} highlights=${highlights} tasks=${tasks} reloadKey=${reloadKey} onOpenTask=${openTask} />`;
  } else if (route === 'month') {
    page = html`<${MonthPage} api=${adapter} today=${today} goals=${settings.goals} currency=${settings.currency} highlights=${highlights} tasks=${tasks} reloadKey=${reloadKey} />`;
  } else if (route === 'diary') {
    page = html`<${DiaryPage} api=${adapter} today=${today} highlights=${highlights} goals=${settings.goals} currency=${settings.currency}
      reloadKey=${reloadKey} onSaveHighlight=${saveHighlight} onDeleteHighlight=${deleteHighlight} />`;
  } else if (route === 'stories') {
    page = html`<${StoriesPage} highlights=${highlights} today=${today} onSaveHighlight=${saveHighlight} onDeleteHighlight=${deleteHighlight} />`;
  } else if (route === 'settings') {
    page = html`<${SettingsPage} lock=${lock} lockApi=${lockApi} settings=${settings} onSave=${saveSettings} adapter=${adapter} who=${who} folderId=${folderId} tasksFile=${file}
      onRefresh=${() => refresh(true)} onCheckInbox=${() => importInbox(true)} onSeed=${seed} onSignOut=${() => leave('signin')}
      onDemo=${() => { leave('welcome'); }} onResetClient=${() => { LS.removeItem('lwa.clientId'); leave('setup'); }} />`;
  }

  return html`
    <div class="shell">
      <nav class="sidebar" aria-label="Main">
        <div class="brand">Life & Work</div>
        ${NAV.map((n) => html`<a class=${`nav${route === n.id ? ' active' : ''}`} href=${`#/${n.id}`} aria-current=${route === n.id ? 'page' : undefined}><${Icon} name=${n.icon} />${n.label}${n.soon ? html`<span class="soon">soon</span>` : n.locked && lock ? html`<span class="soon"><${Icon} name="lock" size=${12} /></span>` : ''}</a>`)}
        <div class="sync">
          <b><span class=${dotClass}></span>${syncText}</b>
          <div style="margin-top:4px">${isDemo ? 'Demo mode. Nothing is in Google Drive yet.' : `Your data is in your Drive folder “${FOLDER_NAME}”.`}</div>
        </div>
      </nav>
      <main class="main">
        ${isDemo && html`<div class="banner info">Demo mode: data stays in this browser. <a href="#/settings">Connect Google Drive in Settings</a></div>`}
        ${inboxNote && html`<div class=${`banner ${inboxNote.problems.length ? '' : 'info'}`} role="status"><span>${inboxNote.text}${inboxNote.problems.length ? html`<br /><b>Needs a look:</b> ${inboxNote.problems.slice(0, 4).join(' · ')}` : ''}</span><button class="btn" onClick=${() => setInboxNote(null)}>Dismiss</button></div>`}
        ${saveState === 'error' && html`<div class="banner err" role="alert"><span>Your last change was not saved: ${saveError}</span><button class="btn" onClick=${() => { tasksSync.current.retry(); hlSync.current.retry(); }}>Try saving again</button></div>`}
        ${page}
      </main>
      <nav class="tabbar" aria-label="Main (mobile)">
        ${NAV.map((n) => html`<a class=${route === n.id ? 'active' : ''} href=${`#/${n.id}`}><${Icon} name=${n.icon} size=${22} />${n.label === 'Work board' ? 'Board' : n.label}</a>`)}
      </nav>
      ${editing && html`<${TaskEditor} key=${editing.task.id} task=${editing.task} isNew=${editing.isNew} tasks=${tasks} types=${settings.taskTypes || DEFAULT_TYPES}
        projects=${projectsOf(tasks)} today=${today} onSave=${saveTask} onDelete=${deleteTask} onClose=${() => setEditing(null)}
        onOpenTask=${openTaskById} onAddSub=${addSub} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
