// Haar eigen videolijst bij kracht.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT EEN OPSLAG IS EN GEEN VASTE LIJST
//
// YouTube-links verrotten. Een kanaal zet een video op privé, verplaatst
// hem of gooit hem weg, en dan staat er in de app een knop die niets doet.
// Een lijst die alleen in de code staat vraagt dan om een ontwikkelaar voor
// iets dat zij in tien seconden zelf kan: linkje weg, nieuw linkje erin.
//
// Dus: de gevonden lijst is het startpunt, en wat zij toevoegt of
// verwijdert staat hier. Verwijderde startvideo's blijven verwijderd —
// anders komen ze bij elke update terug, en dat is het soort app dat je
// niet meer vertrouwt.
// ─────────────────────────────────────────────────────────────────

import { CORE_VIDEOS } from './data/coreVideos';

const KEY = 'gc_core_videos';

function lees() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch { return {}; }
}

function schrijf(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* opslag vol */ }
  return state;
}

// Alleen YouTube, Vimeo en losse bestanden. Niet uit zuinigheid maar omdat
// een willekeurige link in een app die haar gezondheidsdata draagt geen
// goed idee is.
const TOEGESTAAN = /^https:\/\/([\w-]+\.)*(youtube\.com|youtu\.be|vimeo\.com)\//i;

export function videoUrlIsOk(url) {
  return typeof url === 'string' && TOEGESTAAN.test(url.trim());
}

// De lijst zoals zij hem ziet: de startlijst zonder wat ze weggooide, plus
// wat ze zelf toevoegde.
export function loadCoreVideos() {
  const s = lees();
  const verwijderd = new Set(s.removed || []);
  const eigen = Array.isArray(s.added) ? s.added : [];
  return [
    ...CORE_VIDEOS.filter(v => !verwijderd.has(v.id)).map(v => ({ ...v, source: 'lijst' })),
    ...eigen.map(v => ({ ...v, source: 'eigen' })),
  ];
}

export function addCoreVideo({ title, url, minutes = null, note = null }) {
  const schoon = (url || '').trim();
  if (!videoUrlIsOk(schoon)) {
    return { ok: false, reason: 'Alleen links van YouTube of Vimeo, en ze moeten met https beginnen.' };
  }
  const s = lees();
  const eigen = Array.isArray(s.added) ? s.added : [];
  if (eigen.some(v => v.url === schoon) || CORE_VIDEOS.some(v => v.url === schoon)) {
    return { ok: false, reason: 'Die link staat er al.' };
  }
  const nieuw = {
    id: `eigen_${Date.now()}`,
    title: (title || '').trim() || 'Eigen video',
    url: schoon,
    minutes: minutes != null && minutes !== '' ? Number(minutes) || null : null,
    note: (note || '').trim() || null,
    addedAt: new Date().toISOString(),
  };
  schrijf({ ...s, added: [...eigen, nieuw] });
  return { ok: true, video: nieuw };
}

export function removeCoreVideo(id) {
  const s = lees();
  if (String(id).startsWith('eigen_')) {
    schrijf({ ...s, added: (s.added || []).filter(v => v.id !== id) });
  } else {
    // Een startvideo wordt niet uit de code gehaald maar hier als verwijderd
    // gemarkeerd, zodat hij bij een update niet terugkomt.
    schrijf({ ...s, removed: [...new Set([...(s.removed || []), id])] });
  }
  return loadCoreVideos();
}

// Weggegooide startvideo's terughalen, voor als ze zich vergist.
export function restoreCoreVideos() {
  const s = lees();
  schrijf({ ...s, removed: [] });
  return loadCoreVideos();
}

export function removedCount() {
  return (lees().removed || []).length;
}
