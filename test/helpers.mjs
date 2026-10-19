import assert from 'node:assert/strict';
// A tiny in-memory imitation of the parts of the Google Drive API the app uses.
export function fakeDrive() {
  const files = new Map(); // id -> {id,name,parents,mimeType,content,version}
  let n = 0;
  const log = [];
  const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o, text: async () => JSON.stringify(o) });
  const text = (s) => ({ ok: true, status: 200, json: async () => JSON.parse(s), text: async () => s });
  async function fetchFn(url, opts = {}) {
    const u = new URL(url);
    const method = opts.method || 'GET';
    log.push(`${method} ${u.pathname}`);
    assert.equal(opts.headers.Authorization, 'Bearer tok');
    const p = u.pathname;
    if (p === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q');
      let list = [...files.values()].filter((f) => f.trashed !== true);
      const nameM = q.match(/name='((?:[^'\\]|\\.)*)'/);
      if (nameM) list = list.filter((f) => f.name === nameM[1].replace(/\\'/g, "'") && f.mimeType === 'application/vnd.google-apps.folder');
      const parM = q.match(/'([^']+)' in parents/);
      if (parM && parM[1] !== 'root') list = list.filter((f) => (f.parents || []).includes(parM[1]));
      return json({ files: list.map((f) => ({ id: f.id, name: f.name, version: String(f.version), modifiedTime: 'now', mimeType: f.mimeType })) });
    }
    if (p === '/drive/v3/files' && method === 'POST') {
      const b = JSON.parse(opts.body);
      const f = { id: 'f' + ++n, name: b.name, parents: b.parents, mimeType: b.mimeType, content: '', version: 1 };
      files.set(f.id, f);
      return json({ id: f.id, name: f.name });
    }
    let m = p.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (m && method === 'DELETE') {
      files.delete(m[1]);
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' };
    }
    if (m && method === 'GET') {
      const f = files.get(m[1]);
      if (u.searchParams.get('alt') === 'media') return text(f.content);
      return json({ id: f.id, name: f.name, version: String(f.version), modifiedTime: 'now' });
    }
    if (p === '/upload/drive/v3/files' && method === 'POST') {
      const boundary = opts.headers['Content-Type'].split('boundary=')[1];
      const parts = opts.body.split(`--${boundary}`).filter((s) => s.trim() && s.trim() !== '--');
      const meta = JSON.parse(parts[0].split('\r\n\r\n')[1].trim());
      const content = parts[1].split('\r\n\r\n')[1].replace(/\r\n$/, '');
      const f = { id: 'f' + ++n, name: meta.name, parents: meta.parents, mimeType: meta.mimeType, content, version: 1 };
      files.set(f.id, f);
      return json({ id: f.id, name: f.name, version: String(f.version) });
    }
    m = p.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (m && method === 'PATCH') {
      const f = files.get(m[1]);
      f.content = opts.body;
      f.version++;
      return json({ id: f.id, name: f.name, version: String(f.version) });
    }
    return json({ error: 'not found ' + p }, 404);
  }
  return { fetchFn, files, log };
}

