// Keeps one shared JSON file (tasks.json, highlights.json) in sync with storage.
// Saves are queued one after another, so quick edits never race, and a save that finds the file changed in Drive merges first.

export function createSynced({ name, load, save, merge, onData, onStatus }) {
  let version = '0';
  let latest = null;
  let chain = Promise.resolve();
  let lastRefresh = 0;
  let pending = 0;

  const self = {
    async init() {
      const r = await load();
      version = r.version;
      latest = r.data;
      onData(latest);
      return latest;
    },
    get data() { return latest; },
    commit(next) {
      latest = next;
      onData(next);
      pending++;
      onStatus(name, 'saving');
      chain = chain.then(async () => {
        const sent = latest;
        try {
          const r = await save(sent, version);
          version = r.version;
          if (r.data !== sent && latest === sent) { latest = r.data; onData(r.data); }
          pending--;
          if (pending === 0) onStatus(name, 'saved');
          return true;
        } catch (e) {
          pending--;
          onStatus(name, 'error', e.message || String(e));
          return false;
        }
      });
      return chain; // resolves true once this change is safely saved, false if saving failed
    },
    retry() { return self.commit(latest); },
    /** Pick up changes made elsewhere (for example by Claude). Skipped while a save is running. */
    async refresh(force = false) {
      if (pending > 0) return;
      if (!force && Date.now() - lastRefresh < 15000) return;
      lastRefresh = Date.now();
      try {
        const r = await load();
        if (String(r.version) !== String(version)) {
          const merged = merge(latest, r.data);
          version = r.version;
          latest = merged;
          onData(merged);
        }
      } catch (e) { /* a failed background refresh is not worth interrupting the user */ }
    }
  };
  return self;
}
