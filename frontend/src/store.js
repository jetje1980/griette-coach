// Unified storage: localStorage always, backend optional (Mac only)
import { supabase as _sb, getUserId } from './supabase';
import { saveKeyNow } from './sync';

const P = 'gc_';

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
  // Samenvoegen, niet vervangen.
  //
  // Hier stond: de rij van die datum eruit filteren en er een nieuwe voor in
  // de plaats zetten met alleen de zojuist ingevulde velden. Wie 's ochtends
  // navel invulde en 's middags taille, was zijn navel kwijt — zonder
  // melding, zonder spoor. saveLog() hierboven deed het al goed; alleen
  // metingen niet.
  //
  // Wat er teruggegeven wordt is niet alleen "gelukt" maar ook wát er
  // veranderde. Het scherm kan dat tonen, en de audit hieronder bewaart het
  // zodat een verdwenen waarde terug te vinden is.
  saveMeasurements(date, data) {
    const alle = this.getMeasurements();
    const bestaand = alle.find(m => m.date === date) || null;
    const rest = alle.filter(m => m.date !== date);

    const schoon = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === null || v === undefined) continue;
      schoon[k] = v;
    }

    const samengevoegd = { ...(bestaand || {}), ...schoon, date };
    const nieuw = [samengevoegd, ...rest].sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(`${P}measurements`, JSON.stringify(nieuw));

    // Wat is er precies gebeurd? Toegevoegd, gewijzigd, of ongemoeid gelaten.
    const toegevoegd = [], gewijzigd = [], behouden = [];
    for (const k of Object.keys(schoon)) {
      if (!bestaand || bestaand[k] == null) toegevoegd.push(k);
      else if (Number(bestaand[k]) !== Number(schoon[k])) {
        gewijzigd.push({ veld: k, van: bestaand[k], naar: schoon[k] });
      }
    }
    for (const k of Object.keys(bestaand || {})) {
      if (k !== 'date' && !(k in schoon)) behouden.push(k);
    }

    ls.logMeasurementChange({ date, toegevoegd, gewijzigd, behouden, resultaat: samengevoegd });
    return { success: true, record: samengevoegd, toegevoegd, gewijzigd, behouden };
  },

  // Het spoor. Zonder dit is een verdwenen waarde niet terug te vinden en
  // ook niet te bewijzen; met dit is het allebei.
  logMeasurementChange(entry) {
    try {
      const key = `${P}measurement_log`;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift({ ...entry, at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 200)));
    } catch { /* het spoor mag de opslag nooit blokkeren */ }
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

  // Opslaan en wachten tot het écht online staat.
  //
  // Hiervoor werd er lokaal geschreven, een optionele backend geprobeerd, en
  // teruggegeven. De cloudsync liep intussen op de achtergrond met anderhalve
  // seconde vertraging — dus "opgeslagen" verscheen voordat er ook maar iets
  // was verstuurd, en bij een fout bleef die melding staan.
  //
  // Nu komt de uitkomst van de cloud mee terug. Lokaal is het hoe dan ook
  // bewaard; wat het scherm mag zeggen hangt af van `cloud.ok`.
  async saveLog(date, data) {
    const local = ls.saveLog(date, data);
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    await tryApi(() =>
      fetch(`/api/log/${date}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    );
    const cloud = await saveKeyNow(`gc_log_${date}`);
    return { ...local, _cloud: cloud };
  },

  async deleteLog(date) {
    const key = `${P}log_${date}`;
    localStorage.removeItem(key);
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    try {
      const uid = await getUserId();
      if (uid) await _sb.from('gc_coach_data').delete().eq('user_id', uid).eq('key', key);
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
    const verwijderd = ls.getMeasurements().find(m => m.date === date) || null;
    const arr = ls.getMeasurements().filter(m => m.date !== date);
    localStorage.setItem(`${P}measurements`, JSON.stringify(arr));
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    // Ook een verwijdering hoort in het spoor: dan is achteraf te zien wat
    // er weg is en wat erin stond.
    ls.logMeasurementChange({ date, verwijderd, toegevoegd: [], gewijzigd: [], behouden: [] });
    const cloud = await saveKeyNow('gc_measurements');
    return { success: true, cloud, verwijderd };
  },

  // Het spoor uitlezen — voor het scherm, en om een verdwenen waarde terug
  // te vinden.
  measurementLog() {
    try { return JSON.parse(localStorage.getItem(`${P}measurement_log`) || '[]'); }
    catch { return []; }
  },

  async saveMeasurements(date, data) {
    const uitkomst = ls.saveMeasurements(date, data);
    localStorage.setItem('gc_last_data_change', new Date().toISOString());
    await tryApi(() =>
      fetch(`/api/measurements/${date}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    );
    const cloud = await saveKeyNow('gc_measurements');
    return { ...uitkomst, cloud };
  },

  async backup() {
    return tryApi(() =>
      fetch('/api/backup', { method: 'POST' }).then(r => r.json())
    );
  },
};
