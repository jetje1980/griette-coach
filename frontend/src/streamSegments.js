// Loop- en wandelblokken afleiden uit de ruwe Strava-streams.
//
// Het probleem dat dit oplost: haar horloge legt geen ronden vast bij de
// overgang van lopen naar wandelen. Strava levert dan alleen kilometersplits,
// en daar zit lopen en wandelen dóór elkaar. Daardoor bleef het looptempo
// leeg, viel de racevoorspelling terug op sessietempo, en was de zekerheid
// altijd LOW.
//
// Maar de gegevens zijn er wél. Strava bewaart per seconde de snelheid, de
// hartslag en vaak de cadans. Daaruit zijn de blokken zelf af te leiden,
// zonder dat er onderweg op een knop hoeft te worden gedrukt.
//
// Twee signalen, in volgorde van betrouwbaarheid:
//
//   CADANS    hardlopen ligt rond 150-180 stappen per minuut, wandelen rond
//             100-120. Strava telt per been, dus die getallen halveren.
//             Dit is het scherpste onderscheid dat er is.
//   SNELHEID  als er geen cadans is: het snelheidsverloop binnen deze ene
//             sessie. Niet met een vaste drempel — wie 8:00/km loopt en
//             10:30/km wandelt heeft een heel ander omslagpunt dan iemand
//             die 5:00 en 7:00 loopt.

import { fmtPaceSec } from './sessionMath';

// Onder deze duur is het geen blok maar ruis: een stoplicht, een hek, een
// moment waarop het horloge even de weg kwijt was.
export const MIN_SEGMENT_SEC = 25;

// Cadans per been; verdubbeld is dit stappen per minuut.
const RUN_SPM = 140;
const WALK_SPM = 125;

const median = (arr) => {
  const v = arr.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

// ── De streams uitpakken ────────────────────────────────────────
// Strava levert `{ time: {data: []}, velocity_smooth: {data: []}, … }`.
export function readStreams(streams) {
  if (!streams) return null;
  const get = (k) => {
    const s = streams[k];
    const d = Array.isArray(s) ? s : s?.data;
    return Array.isArray(d) ? d : null;
  };
  const time = get('time');
  if (!time || time.length < 20) return null;
  return {
    time,
    velocity: get('velocity_smooth'),
    distance: get('distance'),
    heartrate: get('heartrate'),
    cadence: get('cadence'),
    n: time.length,
  };
}

// ── Per punt: lopen of wandelen? ────────────────────────────────
function classifyPoints(s) {
  const n = s.n;
  const out = new Array(n).fill(null);

  // Cadans wint als hij er is en genoeg punten dekt.
  const cadPoints = s.cadence ? s.cadence.filter(c => c != null && c > 0).length : 0;
  if (s.cadence && cadPoints > n * 0.6) {
    for (let i = 0; i < n; i++) {
      const c = s.cadence[i];
      if (c == null || c <= 0) { out[i] = null; continue; }
      // Strava telt per been bij hardlopen; onder 110 is dat vrijwel zeker
      // het geval en verdubbelen we.
      const spm = c < 110 ? c * 2 : c;
      out[i] = spm >= RUN_SPM ? 'run' : spm <= WALK_SPM ? 'walk' : null;
    }
    // Grensgevallen invullen met de dichtstbijzijnde beslissing.
    fillGaps(out);
    return { kinds: out, method: 'cadence' };
  }

  // Anders: het snelheidsverloop binnen deze sessie.
  if (!s.velocity) return { kinds: out, method: null };
  const moving = s.velocity.filter(v => v != null && v > 0.4);
  if (moving.length < 20) return { kinds: out, method: null };

  const sorted = [...moving].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const slow = q(0.2), fast = q(0.8);

  // Te weinig spreiding: dit was een doorlopende inspanning, geen run/walk.
  if (!slow || (fast - slow) / slow < 0.18) {
    return { kinds: out, method: 'uniform', uniform: true };
  }

  const split = (slow + fast) / 2;
  for (let i = 0; i < n; i++) {
    const v = s.velocity[i];
    if (v == null || v <= 0.4) { out[i] = null; continue; }
    out[i] = v >= split ? 'run' : 'walk';
  }
  fillGaps(out);
  return { kinds: out, method: 'velocity', split };
}

function fillGaps(kinds) {
  let last = null;
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] == null) kinds[i] = last;
    else last = kinds[i];
  }
  // En vooraan, waar nog niets bekend was.
  const first = kinds.find(k => k != null) || null;
  for (let i = 0; i < kinds.length && kinds[i] == null; i++) kinds[i] = first;
}

// ── Punten samenvoegen tot blokken ──────────────────────────────
function toBlocks(s, kinds) {
  const blocks = [];
  let start = 0;
  for (let i = 1; i <= s.n; i++) {
    if (i === s.n || kinds[i] !== kinds[start]) {
      blocks.push({ kind: kinds[start], from: start, to: i - 1 });
      start = i;
    }
  }
  return blocks;
}

// Korte blokken opslokken in hun buren: een wandelpauze van acht seconden
// is geen wandelpauze.
function mergeShort(blocks, s) {
  const dur = (b) => (s.time[b.to] - s.time[b.from]) || 0;
  let changed = true;
  let list = blocks;
  while (changed) {
    changed = false;
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (dur(b) >= MIN_SEGMENT_SEC || list.length === 1) { out.push(b); continue; }
      // Voeg toe aan de langste buur.
      const prev = out[out.length - 1];
      const next = list[i + 1];
      if (prev && (!next || dur(prev) >= dur(next))) {
        prev.to = b.to; changed = true;
      } else if (next) {
        next.from = b.from; changed = true;
      } else {
        out.push(b);
      }
    }
    // Aangrenzende blokken van dezelfde soort samenvoegen.
    const joined = [];
    for (const b of out) {
      const last = joined[joined.length - 1];
      if (last && last.kind === b.kind) { last.to = b.to; changed = true; }
      else joined.push({ ...b });
    }
    list = joined;
  }
  return list;
}

// ── Het resultaat: segmenten in de vorm die paceBreakdown verwacht ──
export function segmentsFromStreams(streams) {
  const s = readStreams(streams);
  if (!s) return { available: false, reason: 'geen bruikbare streams' };

  const { kinds, method, uniform } = classifyPoints(s);
  if (!method) return { available: false, reason: 'geen snelheid of cadans in de streams' };

  if (uniform) {
    return { available: false, uniform: true, method,
      reason: 'De snelheid varieerde te weinig om loop- en wandelblokken te scheiden — ' +
        'dit was een doorlopende inspanning.' };
  }

  const blocks = mergeShort(toBlocks(s, kinds), s);
  const segments = blocks.map((b, i) => {
    const secs = (s.time[b.to] - s.time[b.from]) || 0;
    const meters = s.distance
      ? Math.max(0, (s.distance[b.to] ?? 0) - (s.distance[b.from] ?? 0))
      : null;
    const hrs = s.heartrate
      ? s.heartrate.slice(b.from, b.to + 1).filter(h => h != null && h > 0) : [];
    const cads = s.cadence
      ? s.cadence.slice(b.from, b.to + 1).filter(c => c != null && c > 0) : [];
    return {
      index: i,
      kind: b.kind,
      distance: meters,                              // meters
      movingTime: secs,                              // seconden
      avgHr: hrs.length ? Math.round(hrs.reduce((x, y) => x + y, 0) / hrs.length) : null,
      cadence: cads.length ? Math.round(median(cads)) : null,
      derived: true,
    };
  }).filter(seg => seg.movingTime >= 10 && (seg.distance == null || seg.distance > 5));

  const runs = segments.filter(x => x.kind === 'run');
  const walks = segments.filter(x => x.kind === 'walk');
  if (!runs.length) {
    return { available: false, method,
      reason: 'Geen loopblokken te onderscheiden in deze sessie.' };
  }

  const paceOf = (arr) => {
    const m = arr.reduce((x, y) => x + (y.distance || 0), 0);
    const t = arr.reduce((x, y) => x + (y.movingTime || 0), 0);
    return m > 0 ? (t / 60) / (m / 1000) : null;
  };

  return {
    available: true,
    method,
    segments,
    runCount: runs.length,
    walkCount: walks.length,
    runPace: paceOf(runs),
    walkPace: walks.length ? paceOf(walks) : null,
    runMinutes: +(runs.reduce((x, y) => x + y.movingTime, 0) / 60).toFixed(1),
    walkMinutes: +(walks.reduce((x, y) => x + y.movingTime, 0) / 60).toFixed(1),
    note: method === 'cadence'
      ? `${runs.length} loopblokken en ${walks.length} wandelblokken, afgeleid uit je cadans.`
      : `${runs.length} loopblokken en ${walks.length} wandelblokken, afgeleid uit het ` +
        'snelheidsverloop binnen deze sessie.',
  };
}

// De vorm die `paceBreakdown` als `laps` verwacht, met een merkteken dat ze
// zijn afgeleid en niet door het horloge zijn vastgelegd.
export function toLaps(result) {
  if (!result?.available) return null;
  return result.segments.map(s => ({
    distance: s.distance,
    movingTime: s.movingTime,
    avgHr: s.avgHr,
    cadence: s.cadence,
    derivedKind: s.kind,
    derivedFrom: 'streams',
  }));
}
