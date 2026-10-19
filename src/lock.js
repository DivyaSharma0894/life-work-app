// PIN lock helpers. The PIN is never stored, only a salted PBKDF2 hash, and only on this device.
// This is a privacy screen for your Diary and Stories (it keeps people at your laptop out).
// Your files in Drive are protected by your Google account, not by this PIN.

const ITERATIONS = 150000;
const enc = new TextEncoder();

const toB64 = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const validPin = (pin) => /^\d{4,8}$/.test(pin || '');

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toB64(bits);
}

export async function createLock(pin, autoLockMinutes = 5) {
  if (!validPin(pin)) throw new Error('The PIN must be 4 to 8 digits.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { v: 1, salt: toB64(salt), iterations: ITERATIONS, hash: await derive(pin, salt, ITERATIONS), autoLockMinutes };
}

export async function verifyPin(pin, lock) {
  if (!lock || !validPin(pin)) return false;
  const got = await derive(pin, fromB64(lock.salt), lock.iterations);
  if (got.length !== lock.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ lock.hash.charCodeAt(i);
  return diff === 0;
}

const KEY = 'lwa.lock';
export function loadLock(ls = window.localStorage) {
  try { const v = JSON.parse(ls.getItem(KEY)); return v && v.hash ? v : null; } catch (e) { return null; }
}
export function saveLock(lock, ls = window.localStorage) {
  if (lock) ls.setItem(KEY, JSON.stringify(lock)); else ls.removeItem(KEY);
}
