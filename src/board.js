import { html, useState, useMemo, Icon, Pill, URG, typeStyle, PRIORITY_COLOR } from './ui.js';
import { STATUSES, PRIORITIES, URGENCIES, urgency, summarize, needsAttention, filterTasks, topLevel, subTasks, projectsOf, formatDate } from './logic.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dueLabel(t, today) {
  const u = urgency(t, today);
  if (u === 'Done') return t.completedAt ? `Done · ${formatDate(t.completedAt.slice(0, 10))}` : 'Done';
  if (u === 'No date') return 'No date';
  return `${u} · ${formatDate(t.dueDate)}`;
}

function Summary({ tasks, today, onOpen }) {
  const s = summarize(tasks, today);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  const open = s.open || 0;
  const attn = needsAttention(tasks, today);
  const order = ['Overdue', 'Due soon', 'This week', 'On track', 'No date'];
  return html`
    <div class="summary">
      <div class="card">
        <h2>Pending vs done</h2>
        <div class="row" style="gap:20px;margin-top:14px;flex-wrap:nowrap">
          <div class="donut" style=${`background:conic-gradient(#2E8B57 0 ${pct}%, #E4DDD2 0)`} role="img" aria-label=${`${s.done} of ${s.total} tasks done`}>
            <div><div style="font-family:var(--serif);font-weight:600;font-size:24px;line-height:1">${pct}%</div><div class="small muted">done</div></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div><span class="sw" style="background:#2E8B57"></span>Done <b>${s.done}</b></div>
            <div><span class="sw" style="background:#E4DDD2"></span>Pending <b>${s.open}</b></div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Open tasks by urgency</h2>
        <div class="stack" style="margin-top:16px" role="img" aria-label=${order.map((u) => `${s.byUrgency[u]} ${u}`).join(', ')}>
          ${open === 0 ? '' : order.map((u) => s.byUrgency[u] ? html`<div style=${`width:${(s.byUrgency[u] / open) * 100}%;background:${URG[u].bar}`}></div>` : '')}
        </div>
        <div class="legend" style="margin-top:16px">
          ${order.map((u) => html`<div><span class="sw" style=${`background:${URG[u].bar}`}></span>${u} <b>${s.byUrgency[u]}</b></div>`)}
        </div>
      </div>
      <div class="card" style="flex-grow:1.6;flex-basis:340px">
        <div class="row between"><h2>Needs attention</h2><span class="small muted">Open and due within 7 days</span></div>
        <div style="margin-top:8px">
          ${attn.length === 0 ? html`<div class="empty" style="padding:16px 0">Nothing due in the next 7 days.</div>` : attn.slice(0, 5).map((t) => {
            const u = urgency(t, today);
            return html`<button class="attn" onClick=${() => onOpen(t)}>
              <span style="flex:1;min-width:0"><span style="display:block;font-weight:500">${t.title}</span><span class="small muted">${[t.project, t.priority].filter(Boolean).join(' · ')}</span></span>
              <${Pill} bg=${URG[u].pillBg} fg=${URG[u].pillFg}>${u} · ${formatDate(t.dueDate)}<//>
            </button>`;
          })}
          ${attn.length > 5 && html`<div class="small muted" style="padding-top:8px">${attn.length - 5} more</div>`}
        </div>
      </div>
    </div>`;
}

function TaskCard({ t, all, today, onOpen, dragging, setDragging }) {
  const u = urgency(t, today);
  const c = URG[u];
  const ts = typeStyle(t.type);
  const kids = subTasks(all, t.id);
  const doneKids = kids.filter((k) => k.status === 'Done').length;
  return html`
    <div class=${`tcard${dragging === t.id ? ' dragging' : ''}`} style=${`background:${c.bg};border-color:${c.bd}`} tabindex="0" role="button"
      aria-label=${`${t.title}. ${t.status}. ${dueLabel(t, today)}`}
      draggable="true"
      onDragStart=${(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragging(t.id); }}
      onDragEnd=${() => setDragging(null)}
      onClick=${() => onOpen(t)}
      onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(t); } }}>
      <div class="t" style=${t.status === 'Done' ? 'text-decoration:line-through;opacity:.7' : ''}>${t.title}</div>
      <div class="tags">
        <${Pill} bg=${ts.bg} fg=${ts.fg}>${t.type}<//>
        ${t.project && html`<span>${t.project}</span>`}
        ${kids.length > 0 && html`<span>${doneKids}/${kids.length} sub-tasks</span>`}
      </div>
      <div class="meta">
        <${Pill} bg=${c.pillBg} fg=${c.pillFg}>${dueLabel(t, today)}<//>
        <span><span style=${`color:${PRIORITY_COLOR[t.priority] || '#6F665E'};font-weight:700`}>${t.priority}</span>${t.storyPoints != null ? ` · ${t.storyPoints} pts` : ''}</span>
      </div>
    </div>`;
}

function BoardView({ tasks, all, today, onOpen, onMove }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  return html`
    <div class="board-wrap"><div class="board">
      ${STATUSES.map((st) => {
        const items = tasks.filter((t) => t.status === st);
        return html`
          <div class=${`col${over === st ? ' over' : ''}`}
            onDragOver=${(e) => { e.preventDefault(); if (over !== st) setOver(st); }}
            onDragLeave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
            onDrop=${(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setOver(null); setDragging(null); if (id) onMove(id, st); }}>
            <div class="col-head"><span>${st}</span><span class="count">${items.length}</span></div>
            <div class="cards">
              ${items.map((t) => html`<${TaskCard} key=${t.id} t=${t} all=${all} today=${today} onOpen=${onOpen} dragging=${dragging} setDragging=${setDragging} />`)}
              ${items.length === 0 && html`<div class="empty" style="padding:16px 4px">Drop a card here</div>`}
            </div>
          </div>`;
      })}
    </div></div>`;
}

function TableView({ tasks, today, onOpen }) {
  const [sort, setSort] = useState({ key: 'dueDate', dir: 1 });
  const rows = useMemo(() => {
    const val = (t) => {
      switch (sort.key) {
        case 'priority': return PRIORITIES.indexOf(t.priority);
        case 'status': return STATUSES.indexOf(t.status);
        case 'urgency': return URGENCIES.indexOf(urgency(t, today));
        case 'storyPoints': return t.storyPoints == null ? -1 : t.storyPoints;
        case 'dueDate': return t.dueDate || '9999-99-99';
        default: return (t[sort.key] || '').toString().toLowerCase();
      }
    };
    return [...tasks].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [tasks, sort, today]);
  const th = (key, label) => html`<th onClick=${() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))} aria-sort=${sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>${label}${sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</th>`;
  return html`
    <div class="card" style="padding:8px 8px;overflow-x:auto">
      <table class="table">
        <thead><tr>${th('title', 'Title')}${th('status', 'Status')}${th('priority', 'Priority')}${th('type', 'Type')}${th('project', 'Project')}${th('dueDate', 'Due')}${th('urgency', 'Urgency')}${th('storyPoints', 'Points')}</tr></thead>
        <tbody>
          ${rows.map((t) => {
            const u = urgency(t, today);
            return html`<tr class="click" key=${t.id} tabindex="0" onClick=${() => onOpen(t)} onKeyDown=${(e) => { if (e.key === 'Enter') onOpen(t); }} style=${`background:${URG[u].bg}`}>
              <td style="font-weight:700">${t.title}</td><td>${t.status}</td>
              <td style=${`color:${PRIORITY_COLOR[t.priority]};font-weight:700`}>${t.priority}</td>
              <td>${t.type}</td><td>${t.project}</td><td>${t.dueDate ? formatDate(t.dueDate) : ''}</td>
              <td><${Pill} bg=${URG[u].pillBg} fg=${URG[u].pillFg}>${u}<//></td><td>${t.storyPoints == null ? '' : t.storyPoints}</td></tr>`;
          })}
        </tbody>
      </table>
      ${rows.length === 0 && html`<div class="empty">No tasks match.</div>`}
    </div>`;
}

function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // week starts on Monday
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = lead + days + ((7 - ((lead + days) % 7)) % 7);
  const cells = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, month, 1 - lead + i));
    cells.push({ iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), out: d.getUTCMonth() !== month });
  }
  return cells;
}

function CalendarView({ tasks, today, onOpen }) {
  const [y0, m0] = today.split('-').map(Number);
  const [cur, setCur] = useState({ y: y0, m: m0 - 1 });
  const cells = monthCells(cur.y, cur.m);
  const shift = (n) => setCur((c) => { const d = new Date(Date.UTC(c.y, c.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  return html`
    <div class="card">
      <div class="row between" style="margin-bottom:12px">
        <div class="row"><button class="icon-btn" aria-label="Previous month" onClick=${() => shift(-1)}><${Icon} name="left" /></button>
          <h2>${MONTHS[cur.m]} ${cur.y}</h2>
          <button class="icon-btn" aria-label="Next month" onClick=${() => shift(1)}><${Icon} name="right" /></button></div>
        <span class="small muted">Tasks appear on their due date</span>
      </div>
      <div class="cal">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div class="dow">${d}</div>`)}
        ${cells.map((c) => {
          const items = tasks.filter((t) => t.dueDate === c.iso);
          return html`<div class=${`day${c.iso === today ? ' today' : ''}${c.out ? ' out' : ''}`}>
            <div class="small" style=${c.iso === today ? 'font-weight:700;color:#1E6B5A' : 'color:#6F665E'}>${c.day}</div>
            ${items.slice(0, 3).map((t) => { const u = urgency(t, today); return html`<button class="chip" style=${`background:${URG[u].pillBg};color:${URG[u].pillFg}`} title=${t.title} onClick=${() => onOpen(t)}>${t.title}</button>`; })}
            ${items.length > 3 && html`<span class="small muted">+${items.length - 3} more</span>`}
          </div>`;
        })}
      </div>
    </div>`;
}

export function BoardPage({ tasks, today, types, onOpen, onNew, onMove, canSeed, onSeed }) {
  const [view, setView] = useState('board');
  const [f, setF] = useState({ q: '', type: 'All', priority: 'All', project: 'All', status: 'All' });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const top = topLevel(tasks);
  const shown = filterTasks(top, f);
  const s = summarize(tasks, today);
  const typeList = [...new Set([...types, ...tasks.map((t) => t.type)].filter(Boolean))];
  const sel = (k, label, opts) => html`<select class="input filter" aria-label=${label} value=${f[k]} onChange=${set(k)}>
    <option value="All" selected=${f[k] === 'All'}>${label}: All</option>${opts.map((o) => html`<option value=${o} selected=${f[k] === o}>${o}</option>`)}</select>`;
  return html`
    <div class="row between">
      <div><h1>Work board</h1><div class="muted small" style="margin-top:4px">${s.total} tasks · ${s.open} open</div></div>
      <div class="row">
        <input class="input search" type="search" aria-label="Search tasks by title" placeholder="Search by title" value=${f.q} onInput=${set('q')} />
        <button class="btn primary" onClick=${onNew}><${Icon} name="plus" size=${18} />New task</button>
      </div>
    </div>
    ${s.total === 0 ? html`
      <div class="card empty">
        <h2 style="margin-bottom:8px">No tasks yet</h2>
        Add your first task with “New task”, or tell Claude “add a task” in chat.
        ${canSeed && html`<div style="margin-top:14px"><button class="btn" onClick=${onSeed}>Add sample tasks to try the app</button></div>`}
      </div>` : html`
      <${Summary} tasks=${tasks} today=${today} onOpen=${onOpen} />
      <div class="row between">
        <div class="seg" role="tablist" aria-label="Board view">
          ${[['board', 'Board'], ['table', 'Table'], ['calendar', 'Calendar']].map(([k, l]) => html`<button role="tab" aria-selected=${view === k} class=${view === k ? 'on' : ''} onClick=${() => setView(k)}>${l}</button>`)}
        </div>
        <div class="row" style="gap:8px">
          ${sel('type', 'Type', typeList)}${sel('priority', 'Priority', PRIORITIES)}${sel('project', 'Project', projectsOf(top))}${sel('status', 'Status', STATUSES)}
        </div>
      </div>
      ${view === 'board' && html`<${BoardView} tasks=${shown} all=${tasks} today=${today} onOpen=${onOpen} onMove=${onMove} />`}
      ${view === 'table' && html`<${TableView} tasks=${shown} today=${today} onOpen=${onOpen} />`}
      ${view === 'calendar' && html`<${CalendarView} tasks=${shown} today=${today} onOpen=${onOpen} />`}
    `}`;
}
