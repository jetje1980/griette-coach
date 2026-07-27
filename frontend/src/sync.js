import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://osuqtfsxmquwqsbgzlqn.supabase.co',
  'sb_publishable_6T-JJKX10RgLkWGwBwYaxg_gFANhdHS'
);

const TABLE = 'gc_coach_data';

const SKIP_PREFIXES = ['gc_api_key', 'gc_photos', 'gc_photo_analysis_', 'gc_strava_'];

function shouldSync(key) {
  if (!key.startsWith('gc_')) return false;
  return !SKIP_PREFIXES.some(p => key.startsWith(p));
}

// Sync status: 'idle' | 'pending' | 'ok' | 'error'
let _status = 'idle';
const _listeners = new Set();

function setStatus(s) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

export function getSyncStatus() { return _status; }
export function onSyncStatus(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Intercept all localStorage writes so every component auto-syncs
const _origSet = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (key, value) {
  _origSet(key, value);
  if (shouldSync(key)) scheduleSync();
};

let _syncTimer = null;
function scheduleSync() {
  setStatus('pending');
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(pushAllToCloud, 2000);
}

async function pushAllToCloud() {
  const rows = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (shouldSync(key)) {
      rows.push({ key, value: localStorage.getItem(key), updated_at: new Date().toISOString() });
    }
  }
  if (!rows.length) { setStatus('ok'); return; }
  try {
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'key' });
    setStatus(error ? 'error' : 'ok');
    if (error) console.warn('Cloud sync fout:', error.message);
  } catch (e) {
    setStatus('error');
    console.warn('Cloud sync mislukt:', e.message);
  }
}

export async function restoreFromCloud() {
  try {
    const { data, error } = await supabase.from(TABLE).select('key, value');
    if (error) throw error;
    for (const row of data) {
      if (shouldSync(row.key) && row.value !== null) {
        _origSet(row.key, row.value);
      }
    }
    return data.length;
  } catch (e) {
    console.warn('Cloud restore mislukt:', e.message);
    return 0;
  }
}

export async function forceSyncNow() {
  await pushAllToCloud();
}
