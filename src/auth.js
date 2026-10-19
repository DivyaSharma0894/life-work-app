// Google sign-in for a browser-only app (Google Identity Services, token flow).
// The token lives in this tab's session storage only. Nothing is sent to any server of ours.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_KEY = 'lwa.token';

let tokenClient = null;
let current = null; // { token, expiresAt }

function readStored() {
  try {
    const v = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (v && v.expiresAt > Date.now() + 60000) return v;
  } catch (e) { /* ignore */ }
  return null;
}

export function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    document.head.appendChild(s);
  });
}

function request(clientId, prompt) {
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      prompt,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        current = { token: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(current)); } catch (e) { /* ignore */ }
        resolve(current.token);
      },
      error_callback: (err) => reject(new Error(err && err.type === 'popup_closed' ? 'The Google window was closed before sign-in finished.' : (err && err.message) || 'Google sign-in failed.'))
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

/** Call from a button click. Shows Google's own consent window. */
export async function signIn(clientId) {
  await loadGis();
  return request(clientId, 'select_account');
}

export function hasValidToken() {
  return !!(current && current.expiresAt > Date.now() + 60000) || !!readStored();
}

/** Returns a valid token, refreshing quietly when it is about to expire. */
export function makeTokenProvider(clientId) {
  return async function getToken() {
    if (current && current.expiresAt > Date.now() + 60000) return current.token;
    const stored = readStored();
    if (stored) { current = stored; return stored.token; }
    await loadGis();
    try {
      return await request(clientId, '');
    } catch (e) {
      const err = new Error('Your Google session ended. Please sign in again.');
      err.code = 'AUTH';
      throw err;
    }
  };
}

export function signOut() {
  const t = current && current.token;
  current = null;
  try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
    window.google.accounts.oauth2.revoke(t, () => {});
  }
}
