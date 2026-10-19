import { html, useState, useEffect, useRef, Icon } from './ui.js';
import { CATEGORIES, CATEGORY_COLOR, formatDate } from './logic.js';

export function CategoryDot({ category }) {
  return html`<span class="sw" style=${`background:${CATEGORY_COLOR[category] || '#999'};border-radius:50%;width:10px;height:10px`}></span>`;
}

/** Add or edit one highlight: a date, a category and one or two lines. */
export function HighlightModal({ h, isNew, today, onSave, onDelete, onClose }) {
  const [f, setF] = useState(h);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = () => {
    const text = f.text.trim();
    if (!text) return setErr('Please write a line.');
    if (!f.date) return setErr('Please choose a date.');
    onSave({ ...f, text });
  };
  return html`
    <div class="scrim" onMouseDown=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style="max-width:520px" role="dialog" aria-modal="true" aria-label=${isNew ? 'New highlight' : 'Edit highlight'}>
        <div class="row between"><h2>${isNew ? 'Add a highlight' : 'Edit highlight'}</h2>
          <button class="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} name="close" /></button></div>
        <div class="grid2">
          <div class="field"><label for="h-cat">Category</label>
            <select id="h-cat" class="input" value=${f.category} onChange=${set('category')}>${CATEGORIES.map((c) => html`<option value=${c} selected=${f.category === c}>${c}</option>`)}</select></div>
          <div class="field"><label for="h-date">Date</label><input id="h-date" type="date" class="input" max=${today} value=${f.date} onInput=${set('date')} /></div>
        </div>
        <div class="field"><label for="h-text">One or two lines</label>
          <textarea id="h-text" ref=${ref} class="input" style="min-height:80px" value=${f.text} onInput=${set('text')} placeholder="What happened or what you felt, in a line or two"></textarea></div>
        ${err && html`<div class="banner err" role="alert">${err}</div>`}
        <div class="row between">
          <button class="btn primary" onClick=${save}>${isNew ? 'Add' : 'Save'}</button>
          ${!isNew && (confirm
            ? html`<div class="row"><span class="small">Delete for good?</span><button class="btn danger" onClick=${() => onDelete(h.id)}>Yes, delete</button><button class="btn" onClick=${() => setConfirm(false)}>Keep</button></div>`
            : html`<button class="btn danger" onClick=${() => setConfirm(true)}>Delete</button>`)}
        </div>
      </div>
    </div>`;
}

export function HighlightLine({ h, onEdit, showDate = false }) {
  return html`
    <div class="hl">
      <${CategoryDot} category=${h.category} />
      <div style="flex:1;min-width:0;line-height:1.45"><b>${h.category}</b>${showDate ? html` <span class="muted small">· ${formatDate(h.date)}</span>` : ''} · ${h.text}</div>
      ${onEdit && html`<button class="icon-btn" style="width:36px;height:36px;border:0" aria-label=${`Edit highlight: ${h.text}`} onClick=${() => onEdit(h)}><${Icon} name="edit" size=${16} /></button>`}
    </div>`;
}
