// Unified storage: localStorage always, backend optional (Mac only)
import { createClient } from '@supabase/supabase-js';

const P = 'gc_';

const _sb = createClient(
  'https://osuqtfsxmquwqsbgzlqn.supabase.co',
  'sb_publishable_6T-JJKX10RgLkWGwBwYaxg_gFANhdHS'
);

const ls = {
  getLog(date) {
    try { return JSON.parse(localStorage.getItem(`${P}log_${date}`)); } catch { return null; }
  },
  saveLog(date, data) {
    const existing = this.getLog(date) || { date };
    const updated = { ...existing, ...data, date };
    localStorage.setItem(`${P}log_${date}`, JSON.stringify(updated));
    return updated;
  },
  getLogs() {
    const logs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${P}log_`)) {
        try { logs.push(JSON.parse(localStorage.getItem(key))); } catch {}
      }
    }
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  },
  getMeasurements() {
    try { return JSON.parse(localStorage.getItem(`${P}measurements`)) || []; } catch { return []; }
  },
  saveMeasurements(date, data) {
    const existing = this.getMeasurements().filter(m => m.date !== date);
    localStorage.setItem(`${P}measurements`, JSON.stringify([{ date, ...data }, ...existing]));
    return { success: true };
  },
};

let _backendOk = null;

async function hasBackend() {
  if (_backendOk !== null) return _backendOk;
  try {
    const r = await fetch('/api/strava/status', { signal: AbortSignal.timeout(1200) });
    _backendOk = r.ok;
  } catch {
    _backendOk = false;
  }
  return _backendOk;
}

async function tryApi(fn) {
  if (!(await hasBackend())) return null;
  try { return await fn(); } catch { return null; }
}

export const store = {
  isOnline: () => _backendOk === true,

  async getLog(date) {
    const remote = await tryApi(() => fetch(`/api/log/${date}`).then(r => r.json()));
    if (remote) { ls.saveLog(date, remote); return remote; }
    return ls.getLog(date);
  },

  async saveLog(date, data) {
    const local = ls.saveLog(date, data);
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    await tryApi(() =>
      fetch(`/api/log/${date}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    );
    return local;
  },

  async deleteLog(date) {
    const key = `${P}log_${date}`;
    localStorage.removeItem(key);
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    try {
      await _sb.from('gc_coach_data').delete().eq('key', key);
    } catch (e) {
      console.warn('Delete van cloud mislukt:', e.message);
    }
  },

  async getLogs() {
    const remote = await tryApi(() => fetch('/api/logs').then(r => r.json()));
    if (remote?.length) {
      remote.forEach(r => ls.saveLog(r.date, r));
      return remote;
    }
    return ls.getLogs();
  },

  async getMeasurements() {
    const remote = await tryApi(() => fetch('/api/measurements').then(r => r.json()));
    if (remote?.length) return remote;
    return ls.getMeasurements();
  },

  async deleteMeasurement(date) {
    const arr = ls.getMeasurements().filter(m => m.date !== date);
    localStorage.setItem(`${P}measurements`, JSON.stringify(arr));
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    return { success: true };
  },

  async saveMeasurements(date, data) {
    ls.saveMeasurements(date, data);
    await tryApi(() =>
      fetch(`/api/measurements/${date}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    );
    return { success: true };
  },

  async backup() {
    return tryApi(() =>
      fetch('/api/backup', { method: 'POST' }).then(r => r.json())
    );
  },
};
