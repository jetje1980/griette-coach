// Cloudsynchronisatie met Supabase als bron van waarheid.
//
// Model: bij het opstarten wordt de cloud gelezen en de lokale cache
// gehydrateerd. Daarna is localStorage een cache/offline-laag; elke wijziging
// gaat naar de cloud. Mislukt een schrijfactie, dan verdwijnt hij niet stil:
// de sleutel blijft in een pending-lijst staan en wordt opnieuw geprobeerd.

import { supabase, getUserId, onAuthChange } from './supabase';

const TABLE = 'gc_coach_data';

// Niet synchroniseren: secrets, grote binaire caches en auth-state.
const SKIP_PREFIXES = [
  'gc_api_key', 'gc_photos', 'gc_photo_analysis_', 'gc_strava_',
  'gc_auth_session', 'gc_pending_sync', 'gc_cloud_hydrated',
];

function shouldSync(key) {
  if (!key || !key.startsWith('gc_')) return false;
  return !SKIP_PREFIXES.some(p => key.startsWith(p));
}

// ── Status ──────────────────────────────────────────────────────
// 'idle' | 'pending' | 'ok' | 'error' | 'offline' | 'signed-out'
let _status = 'idle';
const _listeners = new Set();
function setStatus(s) { _status = s; _listeners.forEach(fn => fn(s)); }

export function getSyncStatus() { return _status; }
export function onSyncStatus(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Pending-wijzigingen (overleven een refresh) ─────────────────
const PENDING_KEY = 'gc_pending_sync';
const _origSet = localStorage.setItem.bind(localStorage);
const _origRemove = localStorage.removeItem.bind(localStorage);

function loadPending() {
  try { return new Set(JSON.parse(localStorage.getItem(PENDING_KEY) || '[]')); }
  catch { return new Set(); }
}
function savePending(set) {
  _origSet(PENDING_KEY, JSON.stringify([...set]));
}
function markPending(key) {
  const p = loadPending();
  p.add(key);
  savePending(p);
}
export function pendingCount() { return loadPending().size; }

// ── Schrijfacties onderscheppen ─────────────────────────────────
localStorage.setItem = function (key, value) {
  _origSet(key, value);
  if (shouldSync(key)) { markPending(key); scheduleSync(); }
};
localStorage.removeItem = function (key) {
  _origRemove(key);
  if (shouldSync(key)) { markPending(key); scheduleSync(); }
};

let _syncTimer = null;
function scheduleSync() {
  setStatus('pending');
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { pushPending(); }, 1500);
}

// ── Naar de cloud schrijven ─────────────────────────────────────
async function pushPending() {
  const userId = await getUserId();
  if (!userId) { setStatus('signed-out'); return; }

  const pending = loadPending();
  if (!pending.size) { setStatus('ok'); return; }

  const now = new Date().toISOString();
  const rows = [];
  const deletions = [];
  for (const key of pending) {
    const value = localStorage.getItem(key);
    if (value === null) deletions.push(key);
    else rows.push({ user_id: userId, key, value, updated_at: now });
  }

  try {
    if (rows.length) {
      const { error } = await supabase.from(TABLE)
        .upsert(rows, { onConflict: 'user_id,key' });
      if (error) throw error;
    }
    if (deletions.length) {
      const { error } = await supabase.from(TABLE)
        .delete().eq('user_id', userId).in('key', deletions);
      if (error) throw error;
    }
    savePending(new Set());          // alles geland
    setStatus('ok');
  } catch (e) {
    // Niets stilzwijgend verliezen: pending blijft staan voor een retry
    setStatus(navigator.onLine === false ? 'offline' : 'error');
    console.warn('Cloud sync mislukt (wijzigingen blijven in wachtrij):', e.message);
  }
}

// ── Vanuit de cloud hydrateren ──────────────────────────────────
// Cloud wint bij het opstarten, behalve voor sleutels die nog in de
// wachtrij staan — die zijn lokaal nieuwer en gaan juist omhoog.
export async function restoreFromCloud() {
  const userId = await getUserId();
  if (!userId) { setStatus('signed-out'); return 0; }

  try {
    const { data, error } = await supabase.from(TABLE)
      .select('key, value, updated_at').eq('user_id', userId);
    if (error) throw error;

    const pending = loadPending();
    let applied = 0;
    for (const row of data || []) {
      if (!shouldSync(row.key) || row.value === null) continue;
      if (pending.has(row.key)) continue;           // lokale wijziging voorrang
      if (localStorage.getItem(row.key) !== row.value) {
        _origSet(row.key, row.value);               // cache vullen zonder her-sync
        applied++;
      }
    }
    _origSet('gc_cloud_hydrated', new Date().toISOString());
    setStatus(pending.size ? 'pending' : 'ok');
    if (pending.size) scheduleSync();
    return applied;
  } catch (e) {
    setStatus(navigator.onLine === false ? 'offline' : 'error');
    console.warn('Cloud restore mislukt:', e.message);
    return 0;
  }
}

export async function forceSyncNow() {
  await pushPending();
}

// Bij inloggen meteen hydrateren; bij uitloggen stoppen met syncen.
onAuthChange((event) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    restoreFromCloud();
  } else if (event === 'SIGNED_OUT') {
    savePending(new Set());
    setStatus('signed-out');
  }
});

// Opnieuw proberen zodra het netwerk terug is
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (loadPending().size) scheduleSync(); });
}
