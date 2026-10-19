// Loads many daily records at once (for the Month page). Reads a few files at a time so Drive is not flooded.
export async function loadAllDays(api, { limit = 400, pool = 6, onProgress } = {}) {
  const names = (await api.listDays()).sort().slice(-limit);
  const map = new Map();
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < names.length) {
      const date = names[next++];
      try {
        const r = await api.loadDay(date);
        if (r.data) map.set(date, { ...r.data });
      } catch (e) { /* one unreadable day should not hide the others */ }
      done++;
      if (onProgress) onProgress(done, names.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(pool, names.length) }, worker));
  return map;
}

/** Only the daily records of one month ("2026-10"). */
export async function loadMonthDays(api, ym, { pool = 6 } = {}) {
  const names = (await api.listDays()).filter((d) => d.startsWith(ym)).sort();
  const map = new Map();
  let next = 0;
  async function worker() {
    while (next < names.length) {
      const date = names[next++];
      try { const r = await api.loadDay(date); if (r.data) map.set(date, { ...r.data }); } catch (e) { /* skip an unreadable day */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(pool, names.length) }, worker));
  return map;
}
