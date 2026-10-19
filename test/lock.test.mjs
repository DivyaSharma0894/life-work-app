import test from 'node:test';
import assert from 'node:assert/strict';
import { createLock, verifyPin, validPin, loadLock, saveLock } from '../src/lock.js';

test('PIN must be 4 to 8 digits', () => {
  assert.ok(validPin('1234'));
  assert.ok(validPin('12345678'));
  assert.ok(!validPin('123'));
  assert.ok(!validPin('123456789'));
  assert.ok(!validPin('12a4'));
  assert.ok(!validPin(''));
});

test('the right PIN opens, a wrong one does not, and the PIN itself is not stored', async () => {
  const lock = await createLock('4821');
  assert.ok(await verifyPin('4821', lock));
  assert.ok(!(await verifyPin('4822', lock)));
  assert.ok(!(await verifyPin('', lock)));
  assert.ok(!JSON.stringify(lock).includes('4821'));
});

test('two locks for the same PIN differ (random salt)', async () => {
  const a = await createLock('4821');
  const b = await createLock('4821');
  assert.notEqual(a.hash, b.hash);
});

test('an invalid PIN cannot create a lock', async () => {
  await assert.rejects(() => createLock('12'), /4 to 8 digits/);
});

test('lock survives save and load, and can be removed', async () => {
  const store = new Map();
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const lock = await createLock('9090', 15);
  saveLock(lock, ls);
  const back = loadLock(ls);
  assert.equal(back.autoLockMinutes, 15);
  assert.ok(await verifyPin('9090', back));
  saveLock(null, ls);
  assert.equal(loadLock(ls), null);
});
