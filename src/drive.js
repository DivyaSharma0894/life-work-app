// Small Google Drive REST client. The fetch function and token provider are injected so it can be tested without Google.

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function createDriveClient({ getToken, fetchFn = (...a) => fetch(...a) }) {
  async function call(url, opts = {}) {
    const token = await getToken();
    const res = await fetchFn(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Google Drive said ${res.status}. ${text.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  async function about() {
    const res = await call(`${API}/about?fields=user(displayName,emailAddress)`);
    return (await res.json()).user;
  }

  /** Find a folder by name inside `parentId` (My Drive by default). Returns the oldest match, or null. */
  async function findFolder(name, parentId = 'root') {
    const q = `name='${esc(name)}' and mimeType='${FOLDER_MIME}' and trashed=false and '${esc(parentId)}' in parents`;
    const res = await call(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime&pageSize=10`);
    const { files } = await res.json();
    return files && files.length ? files[0] : null;
  }

  async function createFolder(name, parentId = 'root') {
    const res = await call(`${API}/files?fields=id,name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] })
    });
    return res.json();
  }

  /** Permanently deletes a file (it does not go to the Drive bin). */
  async function deleteFile(fileId) {
    await call(`${API}/files/${fileId}`, { method: 'DELETE' });
  }

  /** Map of file name to {id, version, modifiedTime} for the files directly inside a folder. */
  async function listFolder(folderId) {
    const out = {};
    let pageToken = '';
    do {
      const q = `'${esc(folderId)}' in parents and trashed=false`;
      const url = `${API}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,version,modifiedTime,mimeType)&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const res = await call(url);
      const body = await res.json();
      for (const f of body.files || []) if (!(f.name in out)) out[f.name] = f;
      pageToken = body.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async function meta(fileId) {
    const res = await call(`${API}/files/${fileId}?fields=id,name,version,modifiedTime`);
    return res.json();
  }

  /** Read a file as text. The version is read first so a change made in between is caught on the next save. */
  async function readText(fileId) {
    const m = await meta(fileId);
    const res = await call(`${API}/files/${fileId}?alt=media`);
    return { text: await res.text(), version: m.version, modifiedTime: m.modifiedTime };
  }

  /** Text of a Google Doc (in case a note was saved as a Doc instead of a plain file). */
  async function exportText(fileId) {
    const res = await call(`${API}/files/${fileId}/export?mimeType=${encodeURIComponent('text/plain')}`);
    return res.text();
  }

  async function createFile(folderId, name, content, mimeType = 'application/json') {
    const boundary = 'lwa' + Math.random().toString(36).slice(2);
    const metadata = JSON.stringify({ name, parents: [folderId], mimeType });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await call(`${UPLOAD}/files?uploadType=multipart&fields=id,name,version,modifiedTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    return res.json();
  }

  async function updateFile(fileId, content, mimeType = 'application/json') {
    const res = await call(`${UPLOAD}/files/${fileId}?uploadType=media&fields=id,name,version,modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': `${mimeType}; charset=UTF-8` },
      body: content
    });
    return res.json();
  }

  return { about, findFolder, createFolder, deleteFile, listFolder, meta, readText, exportText, createFile, updateFile };
}
