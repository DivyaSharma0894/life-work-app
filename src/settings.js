import { LockCard } from './lockui.js';
import { html, useState, Icon } from './ui.js';
import { withDefaults, FOLDER_NAME } from './storage.js';
import { ACTIVITY_LEVELS, MAX_KG_PER_WEEK, calorieNeeds } from './calories.js';

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage({ onCheckInbox, lock, lockApi, settings, onSave, adapter, who, folderId, tasksFile, onRefresh, onSeed, onSignOut, onDemo, onResetClient }) {
  const base = withDefaults(settings);
  const [types, setTypes] = useState(base.taskTypes);
  const [goals, setGoals] = useState(base.goals);
  const [body, setBody] = useState(base.body);
  const [name, setName] = useState(base.displayName);
  const [tz, setTz] = useState(base.timezone);
  const [cur, setCur] = useState(base.currency);
  const [newType, setNewType] = useState('');
  const [inboxMsg, setInboxMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const claudeText = `When I say "diary time", open the folder "${FOLDER_NAME}" in my Google Drive, read README.md first, and follow its instructions to log my day. Ask me only the questions that are still unanswered.`;
  const zones = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return []; } })();
  const tzOk = (() => { try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch (e) { return false; } })();
  const [msg, setMsg] = useState('');
  const isDemo = adapter && adapter.kind === 'local';

  const save = async () => {
    setMsg('Saving…');
    if (!tzOk) { setMsg('That time zone is not valid. Pick one from the list, for example Asia/Kolkata.'); return; }
    const err = await onSave({ ...base, displayName: name.trim(), timezone: tz, currency: cur.trim() || '$', taskTypes: types, body, goals: Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, Number(v) || 0])) });
    setMsg(err ? `Not saved: ${err}` : 'Saved');
    setTimeout(() => setMsg(''), 3000);
  };
  const nb = (k) => (body[k] === '' || body[k] == null ? NaN : Number(body[k]));
  const needs = calorieNeeds({ sex: body.sex, age: nb('age'), weightKg: nb('weightKg'), heightCm: nb('heightCm'), activity: body.activity, goal: body.goal, kgPerWeek: nb('kgPerWeek') });
  const setB = (k) => (e) => setBody({ ...body, [k]: e.target.value });
  const addType = () => {
    const t = newType.trim();
    if (t && !types.includes(t)) setTypes([...types, t]);
    setNewType('');
  };
  const goal = (k, label, unit) => html`<div class="field"><label for=${`g-${k}`}>${label}</label>
    <input id=${`g-${k}`} type="number" min="0" class="input" value=${goals[k]} onInput=${(e) => setGoals({ ...goals, [k]: e.target.value })} /><span class="small muted">${unit}</span></div>`;

  return html`
    <div><h1>Settings</h1></div>

    <div class="card pad" style="max-width:720px">
      <h2>Where your data is</h2>
      <div>${adapter ? adapter.label : ''}</div>
      ${who && html`<div class="small muted">${who.displayName ? `${who.displayName} · ` : ''}${who.emailAddress}</div>`}
      ${folderId && html`<a class="small" href=${`https://drive.google.com/drive/folders/${folderId}`} target="_blank" rel="noopener noreferrer">Open the folder in Google Drive</a>`}
      <div class="row">
        <button class="btn" onClick=${onRefresh}><${Icon} name="refresh" size=${18} />Reload from ${isDemo ? 'this browser' : 'Drive'}</button>
        ${isDemo
          ? html`<button class="btn primary" onClick=${onDemo}>Set up Google Drive</button><button class="btn" onClick=${onSeed}>Add sample tasks</button>`
          : html`<button class="btn" onClick=${onSignOut}>Sign out and revoke access</button><button class="btn ghost" onClick=${onResetClient}>Change Client ID</button>`}
      </div>
      <div class="small muted">Signing out removes this app’s access to your Google account. Your files stay in Drive.</div>
    </div>

    <div class="card pad" style="max-width:720px">
      <h2>About you</h2>
      <div class="small muted">Used for “today”, the money label, and so Claude writes your highlights in your name.</div>
      <div class="grid2">
        <div class="field"><label for="s-name">Your name (optional)</label><input id="s-name" class="input" value=${name} onInput=${(e) => setName(e.target.value)} /></div>
        <div class="field"><label for="s-cur">Currency symbol</label><input id="s-cur" class="input" maxlength="4" value=${cur} onInput=${(e) => setCur(e.target.value)} /></div>
        <div class="field"><label for="s-tz">Time zone</label><input id="s-tz" class="input" list="tz-list" value=${tz} onInput=${(e) => setTz(e.target.value)} />
          <datalist id="tz-list">${zones.map((z) => html`<option value=${z}></option>`)}</datalist>
          ${!tzOk && html`<span class="small" style="color:#A52A2A">Not a valid time zone name.</span>`}</div>
      </div>
    </div>

    <div class="card pad" style="max-width:720px">
      <h2>Task types</h2>
      <div class="row" style="gap:8px">
        ${types.map((t) => html`<span class="pill" style="background:#EEE9E2;color:#25201C;display:inline-flex;align-items:center;gap:6px;padding:6px 6px 6px 12px">${t}
          <button class="icon-btn" style="width:28px;height:28px;border:0;background:transparent" aria-label=${`Remove ${t}`} onClick=${() => setTypes(types.filter((x) => x !== t))}><${Icon} name="close" size=${14} /></button></span>`)}
      </div>
      <div class="row" style="flex-wrap:nowrap"><input class="input" aria-label="New task type" placeholder="Add a type, e.g. Learning" value=${newType} onInput=${(e) => setNewType(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') addType(); }} /><button class="btn" onClick=${addType}>Add</button></div>
    </div>

    <div class="card pad" style="max-width:720px">
      <h2>Your goals</h2>
      <div class="small muted">Shown as goal lines and progress on the Today, Diary and Month pages. 0 means no goal.</div>
      <div class="grid2">
        ${goal('waterLitres', 'Water per day', 'litres')}${goal('steps', 'Steps per day', 'steps')}
        ${goal('pagesRead', 'Pages per day', 'pages')}${goal('spendRupees', 'Daily spending allowance (unspent money carries over)', `${cur || '$'}, 0 means off`)}
        ${goal('calories', 'Calories per day', 'kcal, use the calculator below if unsure')}
      </div>
    </div>

    <div class="card pad" style="max-width:720px">
      <h2>Calorie calculator</h2>
      <div class="small muted">Works out roughly how many calories you need a day from your body measurements and your weight goal. It is a general estimate, not medical advice. Your numbers are saved in your own settings file when you press Save.</div>
      <div class="grid2">
        <div class="field"><label for="b-sex">Sex</label><select id="b-sex" class="input" value=${body.sex} onChange=${setB('sex')}><option value="female">Female</option><option value="male">Male</option></select></div>
        <div class="field"><label for="b-age">Age (years)</label><input id="b-age" class="input" type="number" min="10" max="100" value=${body.age} onInput=${setB('age')} /></div>
        <div class="field"><label for="b-weight">Weight (kg)</label><input id="b-weight" class="input" type="number" min="20" max="300" step="0.1" value=${body.weightKg} onInput=${setB('weightKg')} /></div>
        <div class="field"><label for="b-height">Height (cm)</label><input id="b-height" class="input" type="number" min="100" max="250" value=${body.heightCm} onInput=${setB('heightCm')} /></div>
        <div class="field"><label for="b-act">How active are you?</label><select id="b-act" class="input" value=${body.activity} onChange=${setB('activity')}>${ACTIVITY_LEVELS.map((a) => html`<option value=${a.id}>${a.label}</option>`)}</select></div>
        <div class="field"><label for="b-goal">Your goal</label><select id="b-goal" class="input" value=${body.goal} onChange=${setB('goal')}><option value="lose">Lose weight</option><option value="maintain">Stay at this weight</option><option value="gain">Gain weight</option></select></div>
        ${body.goal !== 'maintain' && html`<div class="field"><label for="b-rate">How fast? (kg per week, up to ${MAX_KG_PER_WEEK})</label><input id="b-rate" class="input" type="number" min="0.1" max=${MAX_KG_PER_WEEK} step="0.1" value=${body.kgPerWeek} onInput=${setB('kgPerWeek')} /></div>`}
      </div>
      ${needs ? html`<div class="read" aria-live="polite">
        <div><b>BMI ${needs.bmi}</b> · ${needs.band}</div>
        <div>Calories your body uses in a day at your activity level: <b>${needs.maintenance.toLocaleString()} kcal</b></div>
        <div style="font-size:18px;margin-top:6px">${body.goal === 'maintain' ? 'To stay at this weight, eat about' : body.goal === 'lose' ? `To lose about ${needs.kgPerWeek} kg a week, eat about` : `To gain about ${needs.kgPerWeek} kg a week, eat about`} <b>${needs.target.toLocaleString()} kcal a day</b></div>
        ${needs.notes.map((n) => html`<div class="small" style="color:#A52A2A;margin-top:4px">${n}</div>`)}
        <div class="row" style="margin-top:8px"><button class="btn primary" onClick=${() => setGoals({ ...goals, calories: needs.target })}>Use ${needs.target.toLocaleString()} kcal as my daily goal</button><span class="small muted">Then press Save below.</span></div>
      </div>` : html`<div class="small muted" style="margin-top:8px">Fill in age, weight and height to see your result.</div>`}
    </div>

    ${!isDemo && html`<div class="card pad" style="max-width:720px">
      <h2>Use Claude for your diary</h2>
      <div class="small muted" style="white-space:pre-line">Set this up once:
        1. In Claude, connect Google Drive using the same Google account as this app.
        2. In Claude, open Settings, then Account, and find the box called “Instructions for Claude”.
        3. Paste the line below into that box and save.
        After that, typing “diary time” in any new chat is enough. Claude reads the README in your Drive folder for all the rules.</div>
      <div class="code" style="white-space:pre-wrap;line-height:1.5">${claudeText}</div>
      <div class="row">
        <button class="btn" onClick=${async () => { try { await navigator.clipboard.writeText(claudeText); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch (e) { setCopied(false); } }}>${copied ? 'Copied' : 'Copy this line'}</button>
        <button class="btn" onClick=${async () => { setInboxMsg('Checking…'); setInboxMsg(await onCheckInbox()); }}><${Icon} name="refresh" size=${18} />Check Claude's inbox now</button>
        <span class="small muted" role="status">${inboxMsg}</span>
      </div>
      <div class="small muted">The app also checks by itself whenever you open it or come back to it.</div>
    </div>`}

    <${LockCard} lock=${lock} api=${lockApi} />

    <div class="row" style="max-width:720px"><button class="btn primary" onClick=${save}>Save settings</button><span class="small muted" role="status">${msg}</span></div>

    <div class="card pad" style="max-width:720px">
      <h2>Backup</h2>
      <div class="small muted">Download a copy of your tasks and settings as one file.</div>
      <div><button class="btn" onClick=${() => download(`life-work-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ tasks: tasksFile, settings: base }, null, 2))}>Download backup</button></div>
    </div>`;
}
