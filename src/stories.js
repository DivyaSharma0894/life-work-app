import { html, useState, useMemo, Icon } from './ui.js';
import { CATEGORIES, CATEGORY_COLOR, newHighlight, storyOf, monthLabel } from './logic.js';
import { HighlightModal, HighlightLine, CategoryDot } from './highlights.js';

export function StoriesPage({ highlights, today, onSaveHighlight, onDeleteHighlight }) {
  const [cat, setCat] = useState('All');
  const [hl, setHl] = useState(null);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const base = cat === 'All'
      ? [...highlights].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      : storyOf(highlights, cat);
    const needle = q.trim().toLowerCase();
    return needle ? base.filter((h) => h.text.toLowerCase().includes(needle)) : base;
  }, [highlights, cat, q]);

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, highlights.filter((h) => h.category === c).length]));
  let lastMonth = '';

  return html`
    <div class="row between">
      <div><h1>Stories</h1><div class="muted small" style="margin-top:4px">Your life, one line at a time. Oldest first, so each story reads from the beginning.</div></div>
      <button class="btn primary" onClick=${() => setHl({ h: newHighlight({ date: today, category: cat === 'All' ? CATEGORIES[0] : cat }), isNew: true })}><${Icon} name="plus" size=${18} />Add highlight</button>
    </div>

    <div class="row" role="tablist" aria-label="Story categories" style="gap:8px">
      <button role="tab" aria-selected=${cat === 'All'} class=${`chip${cat === 'All' ? ' on' : ''}`} onClick=${() => setCat('All')}>All · ${highlights.length}</button>
      ${CATEGORIES.map((c) => html`<button role="tab" aria-selected=${cat === c} class=${`chip${cat === c ? ' on' : ''}`} onClick=${() => setCat(c)}
        style=${cat === c ? `border-color:${CATEGORY_COLOR[c]};background:${CATEGORY_COLOR[c]}1F` : ''}><${CategoryDot} category=${c} /> ${c} · ${counts[c]}</button>`)}
    </div>

    <input class="input" style="max-width:360px" type="search" aria-label="Search highlights" placeholder="Search your stories" value=${q} onInput=${(e) => setQ(e.target.value)} />

    <div class="card pad" style="max-width:820px">
      ${list.length === 0
        ? html`<div class="empty">${highlights.length === 0 ? 'No highlights yet. Add one here, or on a day in your Diary.' : 'Nothing matches.'}</div>`
        : list.map((h) => {
          const m = monthLabel(h.date);
          const head = m !== lastMonth ? html`<h3 class="monthhead">${m}</h3>` : null;
          lastMonth = m;
          return html`<div key=${h.id}>${head}<${HighlightLine} h=${h} showDate=${true} onEdit=${(x) => setHl({ h: x, isNew: false })} /></div>`;
        })}
    </div>

    ${hl && html`<${HighlightModal} key=${hl.h.id} h=${hl.h} isNew=${hl.isNew} today=${today}
      onSave=${(h) => { onSaveHighlight(h); setHl(null); }} onDelete=${(id) => { onDeleteHighlight(id); setHl(null); }} onClose=${() => setHl(null)} />`}`;
}
