// Shared UI pieces: library re-exports, colours, icons.
export { html, render, useState, useEffect, useRef, useMemo, useCallback } from '../vendor/preact-htm.js';
import { html } from '../vendor/preact-htm.js';

// Urgency colours: red for near deadlines, as in the design.
export const URG = {
  'Overdue': { bg: '#FDEFED', bd: '#F2C4BF', pillBg: '#FBE1DE', pillFg: '#A52A2A', bar: '#C93A3A' },
  'Due soon': { bg: '#FEF3E4', bd: '#F3CDA0', pillBg: '#FDE8CF', pillFg: '#8F4A06', bar: '#E08A2D' },
  'This week': { bg: '#FDF8E3', bd: '#EEDC9A', pillBg: '#FAEFC2', pillFg: '#6E5200', bar: '#E5B93A' },
  'On track': { bg: '#F1F8F3', bd: '#CFE4D6', pillBg: '#E0F1E6', pillFg: '#24663F', bar: '#2E8B57' },
  'No date': { bg: '#FFFFFF', bd: '#E9E2D8', pillBg: '#EEE9E2', pillFg: '#6F665E', bar: '#BDB4A6' },
  'Done': { bg: '#F8F6F2', bd: '#E9E2D8', pillBg: '#E0F1E6', pillFg: '#24663F', bar: '#2E8B57' }
};

const TYPE_STYLES = {
  Project: { bg: '#E3EBF7', fg: '#284E8A' },
  Upskilling: { bg: '#EAE6F7', fg: '#4B3F94' },
  POC: { bg: '#FBE9F1', fg: '#A03060' },
  Admin: { bg: '#EEE9E2', fg: '#5A5149' }
};
const EXTRA = [{ bg: '#DDF0EE', fg: '#1E5F57' }, { bg: '#FBEBD9', fg: '#8A4B10' }, { bg: '#E8EFD9', fg: '#4A6420' }];
export function typeStyle(type) {
  if (TYPE_STYLES[type]) return TYPE_STYLES[type];
  let h = 0;
  for (const c of type || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

export const PRIORITY_COLOR = { Critical: '#A52A2A', High: '#8F4A06', Medium: '#5A5149', Low: '#6F665E' };

const PATHS = {
  today: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  diary: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  board: '<rect x="4" y="4" width="6" height="16" rx="1.5"/><rect x="14" y="4" width="6" height="10" rx="1.5"/>',
  month: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  stories: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
};

export function Icon({ name, size = 20 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: PATHS[name] || '' }}></svg>`;
}

export function Pill({ bg, fg, children, title }) {
  return html`<span class="pill" title=${title} style=${`background:${bg};color:${fg}`}>${children}</span>`;
}
