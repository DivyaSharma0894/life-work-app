import { html, useState, useEffect, useRef, Icon, Pill, URG, typeStyle } from './ui.js';
import { STATUSES, PRIORITIES, urgency, subTasks, uid, formatDate } from './logic.js';

export function TaskEditor({ task, isNew, tasks, types, projects, today, onSave, onDelete, onClose, onOpenTask, onAddSub }) {
  const [f, setF] = useState({ ...task, storyPoints: task.storyPoints == null ? '' : task.storyPoints });
  const [newCheck, setNewCheck] = useState('');
  const [newSub, setNewSub] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (titleRef.current && isNew) titleRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const u = urgency(f, today);
  const uc = URG[u];
  const children = isNew ? [] : subTasks(tasks, task.id);
  const parent = f.parentId ? tasks.find((t) => t.id === f.parentId) : null;

  const finish = (overrides = {}) => {
    const title = f.title.trim();
    if (!title) { setError('Please give the task a title.'); if (titleRef.current) titleRef.current.focus(); return; }
    if (f.startDate && f.dueDate && f.startDate > f.dueDate) { setError('The start date is after the due date.'); return; }
    const pts = f.storyPoints === '' ? null : Number(f.storyPoints);
    onSave({ ...f, ...overrides, title, storyPoints: Number.isFinite(pts) ? pts : null });
  };

  const addCheck = () => {
    const text = newCheck.trim();
    if (!text) return;
    setF((p) => ({ ...p, checklist: [...(p.checklist || []), { id: uid('c'), text, done: false }] }));
    setNewCheck('');
  };
  const toggleCheck = (id) => setF((p) => ({ ...p, checklist: p.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }));
  const removeCheck = (id) => setF((p) => ({ ...p, checklist: p.checklist.filter((c) => c.id !== id) }));
  const addSub = () => {
    const title = newSub.trim();
    if (!title) return;
    onAddSub(task, title);
    setNewSub('');
  };

  const done = (f.checklist || []).filter((c) => c.done).length;

  return html`
    <div class="scrim" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" role="dialog" aria-modal="true" aria-label=${isNew ? 'New task' : 'Edit task'}>
        <div class="row between">
          <div class="row">
            <h2>${isNew ? 'New task' : 'Task'}</h2>
            ${!isNew && html`<${Pill} bg=${uc.pillBg} fg=${uc.pillFg}>${u}${f.dueDate && u !== 'Done' ? ` · ${formatDate(f.dueDate)}` : ''}<//>`}
          </div>
          <button class="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} name="close" /></button>
        </div>
        ${parent && html`<div class="small muted">Sub-task of <button class="btn ghost" style="min-height:28px;padding:0 4px" onClick=${() => onOpenTask(parent.id)}>${parent.title}</button></div>`}

        <div class="field">
          <label for="f-title">Title</label>
          <input id="f-title" class="input" ref=${titleRef} value=${f.title} onInput=${set('title')} placeholder="What needs doing?" />
        </div>

        <div class="grid2">
          <div class="field"><label for="f-status">Status</label>
            <select id="f-status" class="input" value=${f.status} onChange=${set('status')}>${STATUSES.map((s) => html`<option value=${s} selected=${f.status === s}>${s}</option>`)}</select></div>
          <div class="field"><label for="f-priority">Priority</label>
            <select id="f-priority" class="input" value=${f.priority} onChange=${set('priority')}>${PRIORITIES.map((s) => html`<option value=${s} selected=${f.priority === s}>${s}</option>`)}</select></div>
          <div class="field"><label for="f-type">Type</label>
            <select id="f-type" class="input" value=${f.type} onChange=${set('type')}>${[...new Set([...types, f.type].filter(Boolean))].map((s) => html`<option value=${s} selected=${f.type === s}>${s}</option>`)}</select></div>
          <div class="field"><label for="f-project">Project name</label>
            <input id="f-project" class="input" list="project-list" value=${f.project} onInput=${set('project')} placeholder="e.g. Website redesign" />
            <datalist id="project-list">${projects.map((p) => html`<option value=${p}></option>`)}</datalist></div>
          <div class="field"><label for="f-start">Start date</label><input id="f-start" type="date" class="input" value=${f.startDate} onInput=${set('startDate')} /></div>
          <div class="field"><label for="f-due">Due date</label><input id="f-due" type="date" class="input" value=${f.dueDate} onInput=${set('dueDate')} /></div>
          <div class="field"><label for="f-pts">Story points</label><input id="f-pts" type="number" min="0" step="1" class="input" value=${f.storyPoints} onInput=${set('storyPoints')} /></div>
          <div class="field"><label for="f-link">Link</label><input id="f-link" class="input" value=${f.link} onInput=${set('link')} placeholder="https://" />
            ${f.link && /^https?:\/\//i.test(f.link) && html`<a class="small" href=${f.link} target="_blank" rel="noopener noreferrer">Open link</a>`}</div>
        </div>

        <div class="card" style="padding:14px 16px">
          <div class="row between"><h3 style="font-size:17px">Checklist</h3><span class="small muted">${done} of ${(f.checklist || []).length}</span></div>
          ${(f.checklist || []).map((c) => html`
            <div class="check">
              <input type="checkbox" checked=${c.done} onChange=${() => toggleCheck(c.id)} aria-label=${c.text} />
              <span style=${c.done ? 'text-decoration:line-through;color:#6F665E' : ''}>${c.text}</span>
              <button class="icon-btn x" style="width:36px;height:36px;border:0" aria-label=${`Remove ${c.text}`} onClick=${() => removeCheck(c.id)}><${Icon} name="close" size=${16} /></button>
            </div>`)}
          <div class="row" style="margin-top:8px;flex-wrap:nowrap">
            <input class="input" placeholder="Add a checklist item" value=${newCheck} onInput=${(e) => setNewCheck(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheck(); } }} aria-label="New checklist item" />
            <button class="btn" onClick=${addCheck}>Add</button>
          </div>
        </div>

        ${!f.parentId && html`
        <div class="card" style="padding:14px 16px">
          <h3 style="font-size:17px">Sub-tasks</h3>
          ${isNew ? html`<div class="small muted" style="margin-top:6px">Save the task first, then you can add sub-tasks.</div>` : html`
            ${children.map((c) => html`<div class="sub"><button class="link" onClick=${() => onOpenTask(c.id)}>${c.title}</button><${Pill} bg=${URG[urgency(c, today)].pillBg} fg=${URG[urgency(c, today)].pillFg}>${c.status}<//></div>`)}
            <div class="row" style="margin-top:8px;flex-wrap:nowrap">
              <input class="input" placeholder="Add a sub-task" value=${newSub} onInput=${(e) => setNewSub(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} aria-label="New sub-task" />
              <button class="btn" onClick=${addSub}>Add</button>
            </div>`}
        </div>`}

        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" class="input" value=${f.notes} onInput=${set('notes')} placeholder="Details, context, links"></textarea></div>

        ${error && html`<div class="banner err" role="alert">${error}</div>`}

        <div class="row between">
          <div class="row">
            <button class="btn primary" onClick=${() => finish()}>${isNew ? 'Add task' : 'Save'}</button>
            ${!isNew && f.status !== 'Done' && html`<button class="btn" onClick=${() => finish({ status: 'Done' })}>Mark as done</button>`}
          </div>
          ${!isNew && (confirmDelete
            ? html`<div class="row"><span class="small">Delete for good${children.length ? ` (and ${children.length} sub-task${children.length > 1 ? 's' : ''})` : ''}?</span><button class="btn danger" onClick=${() => onDelete(task.id)}>Yes, delete</button><button class="btn" onClick=${() => setConfirmDelete(false)}>Keep</button></div>`
            : html`<button class="btn danger" onClick=${() => setConfirmDelete(true)}>Delete</button>`)}
        </div>
      </div>
    </div>`;
}
