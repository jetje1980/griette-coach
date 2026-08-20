// Cloudsynchronisatie met Supabase als bron van waarheid.
//
// Model: bij het opstarten wordt de cloud gelezen en de lokale cache
// gehydrateerd. Daarna is localStorage een cache/offline-laag; elke wijziging
// gaat naar de cloud. Mislukt een schrijfactie, dan verdwijnt hij niet stil:
// de sleutel blijft in een pending-lijst staan en wordt opnieuw geprobeerd.

import { supabase, getUserId, onAuthChange } from './supabase';

const TABLE = 'gc_coach_data';

// Niet synchroniseren. Kort gehouden en per stuk verantwoord, want elke regel
// hier betekent: deze gegevens gaan NOOIT naar de cloud. Een uitzondering die
// niemand meer kan uitleggen is een gegevensverlies dat wacht op zijn moment.
//
//   gc_api_key         een restant uit een oudere versie; ai.js wist hem bij
//                      het opstarten. Sleutels horen sowieso niet omhoog.
//   gc_photos          de naam van de IndexedDB met foto's. Die gaan langs
//                      photoStore naar de bucket, niet langs deze tabel.
//   gc_auth_session    de inlog zelf. Hoort per toestel te blijven.
//   gc_pending_sync    de wachtrij van dit toestel.
//   gc_cloud_hydrated  wanneer dit toestel voor het laatst is bijgewerkt.
//
// Eerder stonden hier ook 'gc_photo_analysis_' en 'gc_strava_'. Die sleutels
// bestaan nergens in de app — het waren dode uitzonderingen die stilzwijgend
// een toekomstige sleutel met die naam zouden hebben tegengehouden.
const SKIP_PREFIXES = [
  'gc_api_key', 'gc_photos',
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
function setStatus(s) { _status = s; _listeners.forEach(fn => fn(s)); notify(); }

export function getSyncStatus() { return _status; }
export function onSyncStatus(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Het mediakanaal ─────────────────────────────────────────────
// Foto's en afbeeldingen gaan niet via gc_coach_data maar via Supabase
// Storage. Dat is een tweede kanaal, en het had een eigen — onzichtbare —
// afloop: een mislukte upload werd naar de console geschreven en verder
// gebeurde er niets. Voor wie de app gebruikt bestond die fout dan niet.
//
// Daarom melden alle uploads zich hier. Eén status voor de hele app: als
// er ook maar iets niet online staat, staat dat er.
let _mediaBusy = 0;
const _mediaFailed = new Map();          // pad → { reason, at, what }

export function mediaUploadStart() { _mediaBusy++; notify(); }
export function mediaUploadDone(path, error, what) {
  _mediaBusy = Math.max(0, _mediaBusy - 1);
  if (error) _mediaFailed.set(path, { reason: String(error), at: new Date().toISOString(), what: what || 'bestand' });
  else _mediaFailed.delete(path);
  notify();
}
export function mediaFailures() {
  return [..._mediaFailed.entries()].map(([path, v]) => ({ path, ...v }));
}
export function clearMediaFailure(path) { _mediaFailed.delete(path); notify(); }

// ── Eén samenvatting voor het scherm ────────────────────────────
// Drie toestanden, in de woorden die de gebruiker leest:
//   ok       ✓ Alles online opgeslagen
//   pending  ⏳ Bezig met synchroniseren
//   error    ⚠ Online opslaan mislukt
// Plus 'offline' en 'signed-out', want die vragen om iets anders dan
// "opnieuw proberen".
export function syncSummary() {
  const queued = loadPending().size;
  const failedMedia = _mediaFailed.size;

  if (_status === 'signed-out') {
    return { state: 'signed-out', icon: '☁', label: 'Niet ingelogd — alleen op dit toestel',
      detail: 'Log in om alles in de cloud te bewaren.', queued, failedMedia };
  }
  if (failedMedia || _status === 'error') {
    const parts = [];
    if (queued) parts.push(`${queued} wijziging${queued > 1 ? 'en' : ''}`);
    if (failedMedia) parts.push(`${failedMedia} foto${failedMedia > 1 ? "'s" : ''}`);
    return { state: 'error', icon: '⚠', label: 'Online opslaan mislukt',
      detail: parts.length ? `${parts.join(' en ')} staan nog niet in de cloud. Ze blijven bewaard.`
        : 'De laatste schrijfactie kwam niet aan. Niets is verloren.',
      queued, failedMedia };
  }
  if (_status === 'offline') {
    return { state: 'offline', icon: '📴', label: 'Offline — wijzigingen staan klaar',
      detail: 'Zodra je weer verbinding hebt gaat alles alsnog omhoog.', queued, failedMedia };
  }
  if (_mediaBusy > 0 || queued > 0 || _status === 'pending') {
    return { state: 'pending', icon: '⏳', label: 'Bezig met synchroniseren',
      detail: _mediaBusy ? 'Beeldmateriaal wordt geüpload.' : 'Wijzigingen worden opgeslagen.',
      queued, failedMedia };
  }
  if (_status === 'ok') {
    return { state: 'ok', icon: '✓', label: 'Alles online opgeslagen',
      detail: 'Deze gegevens staan in je eigen cloudopslag.', queued: 0, failedMedia: 0 };
  }
  return { state: 'idle', icon: '·', label: 'Nog niet gesynchroniseerd',
    detail: '', queued, failedMedia };
}

// Elke verandering — sleutels of media — laat het scherm bijwerken.
const _summaryListeners = new Set();
function notify() {
  const s = syncSummary();
  _summaryListeners.forEach(fn => { try { fn(s); } catch { /* een luisteraar mag de sync niet breken */ } });
}
export function onSyncSummary(fn) {
  _summaryListeners.add(fn);
  fn(syncSummary());
  return () => _summaryListeners.delete(fn);
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
// Een gewone toewijzing, geen defineProperty: localStorage is een platform-
// object met een named property setter, en defineProperty gaat dáár langs.
// Het gevolg zou zijn dat er een sleutel "setItem" wordt opgeslagen met de
// functie als tekst erin, terwijl de echte setItem onaangeroerd blijft — en
// dan synchroniseert er niets meer.
//
// Nevenwerking van de toewijzing: setItem en removeItem verschijnen in
// Object.keys(localStorage). De app telt haar sleutels met length/key(i),
// dus dat heeft geen gevolgen.
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
