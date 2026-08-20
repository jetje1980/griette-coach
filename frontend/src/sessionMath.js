// Afstand, tijd en tempo mogen elkaar nooit tegenspreken.
//
// De aanleiding staat in het schema zelf. T21 beweerde:
//
//   75 minuten · ~10 km · 5 min lopen / 3 min wandelen
//   looptempo 10:00–11:00/km · wandeltempo 12:15–13:00/km
//
// Reken het na en er komt 6,4 tot 7,0 km uit. De 10 km stond als losse
// tekst in het schema, onafhankelijk van de getallen eromheen, en werd
// door niets gecontroleerd. Erger nog: 10 km in 75 minuten vraagt een
// sessietempo van 7:30/km — sneller dan het opgegeven lóóptempo, terwijl
// ruim een derde van de tijd gewandeld wordt. Dat kan fysiek niet.
//
// Vanaf hier is er één functie die afstand berekent, en niemand schrijft
// een afstand meer met de hand op.
//
//   sessieafstand = loopminuten / looptempo + wandelminuten / wandeltempo
//
// Alle tempo's in dit bestand zijn minuten per kilometer, alle duren in
// minuten. Waar seconden handiger zijn, staat dat in de naam.

// ── Eenheden ────────────────────────────────────────────────────
export const secToPace = (sec) => sec / 60;            // sec/km → min/km
export const paceToSec = (min) => Math.round(min * 60);

export function fmtSec(totalSec) {
  if (totalSec == null || !isFinite(totalSec)) return null;
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

export function fmtPaceSec(secPerKm) {
  if (secPerKm == null || !isFinite(secPerKm)) return null;
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── De structuur van een run/walk-sessie ────────────────────────
// Uit reps of uit een totale duur; beide leiden tot dezelfde verdeling.
export function intervalStructure({ runMin, walkMin, reps = null, duration = null }) {
  const rm = Number(runMin) || 0;
  const wm = Number(walkMin) || 0;
  if (!rm) return null;

  if (reps) {
    const r = Number(reps);
    return {
      reps: r, runMin: rm, walkMin: wm,
      runMinutes: +(r * rm).toFixed(2),
      walkMinutes: +(r * wm).toFixed(2),
      totalMinutes: +(r * (rm + wm)).toFixed(2),
      source: 'reps',
    };
  }

  // Zonder reps maar mét een totale duur: het aantal cycli volgt uit de
  // verhouding. Dat levert bewust een gebroken getal op — afronden zou de
  // som weer laten afwijken van de opgegeven duur.
  const total = Number(duration) || 0;
  if (!total) return null;
  const cycles = total / (rm + wm);
  return {
    reps: +cycles.toFixed(3), runMin: rm, walkMin: wm,
    runMinutes: +(cycles * rm).toFixed(2),
    walkMinutes: +(cycles * wm).toFixed(2),
    totalMinutes: +total.toFixed(2),
    source: 'duration',
  };
}

// ── De ene afstandsformule ──────────────────────────────────────
export function sessionDistance({ runMinutes, walkMinutes = 0, runPace, walkPace = null }) {
  const rm = Number(runMinutes) || 0;
  const wm = Number(walkMinutes) || 0;
  const rp = Number(runPace) || 0;
  const wp = Number(walkPace) || 0;
  if (!rm || !rp) return null;

  const runKm = rm / rp;
  const walkKm = wm && wp ? wm / wp : 0;
  const km = runKm + walkKm;
  const minutes = rm + wm;

  return {
    km: +km.toFixed(2),
    runKm: +runKm.toFixed(2),
    walkKm: +walkKm.toFixed(2),
    minutes: +minutes.toFixed(1),
    // Het sessietempo is een uitkomst, geen instelling. Het ligt altijd
    // tussen loop- en wandeltempo in.
    sessionPace: km ? +(minutes / km).toFixed(2) : null,
    runPace: rp,
    walkPace: wp || null,
  };
}

// Alles in één: structuur + tempo's → afstand.
export function sessionMath({ runMin, walkMin, reps = null, duration = null,
  runPace, walkPace = null }) {
  const structure = intervalStructure({ runMin, walkMin, reps, duration });
  if (!structure) return null;
  const dist = sessionDistance({
    runMinutes: structure.runMinutes,
    walkMinutes: structure.walkMinutes,
    runPace, walkPace,
  });
  if (!dist) return null;
  return { ...structure, ...dist };
}

// Een bereik: trage en snelle kant van de opgegeven tempo's.
export function sessionRange({ runMin, walkMin, reps = null, duration = null,
  runPaceFast, runPaceSlow, walkPaceFast = null, walkPaceSlow = null }) {
  const fast = sessionMath({ runMin, walkMin, reps, duration,
    runPace: runPaceFast, walkPace: walkPaceFast });
  const slow = sessionMath({ runMin, walkMin, reps, duration,
    runPace: runPaceSlow, walkPace: walkPaceSlow });
  if (!fast || !slow) return null;
  return {
    low: Math.min(fast.km, slow.km),
    high: Math.max(fast.km, slow.km),
    mid: +((fast.km + slow.km) / 2).toFixed(2),
    fast, slow,
  };
}

// ── Wat er fysiek niet kan ──────────────────────────────────────
// Een wandelblok is trager dan een loopblok. Daaruit volgt dat het
// sessietempo altijd tússen beide in ligt. Wie een afstand opschrijft die
// een sneller sessietempo vraagt dan het looptempo, beschrijft iets wat
// niet bestaat.
export const DISTANCE_TOLERANCE = 0.12;   // 12% speling op een geschatte afstand

export function checkSessionConsistency({ label = null, runMin, walkMin, reps = null,
  duration = null, runPace, walkPace = null, claimedKm = null }) {
  const problems = [];
  const math = sessionMath({ runMin, walkMin, reps, duration, runPace, walkPace });

  if (!math) {
    problems.push({ kind: 'incomplete',
      problem: 'te weinig gegevens om afstand te berekenen' });
    return { label, math: null, problems, ok: false };
  }

  if (walkPace && walkPace <= runPace) {
    problems.push({ kind: 'walk_faster',
      problem: `wandeltempo ${fmtPaceSec(walkPace * 60)} is niet trager dan looptempo ${fmtPaceSec(runPace * 60)}`,
      runPace, walkPace });
  }

  if (claimedKm != null) {
    const claimed = Number(claimedKm);
    const diff = Math.abs(math.km - claimed);
    const rel = claimed ? diff / claimed : 1;
    if (rel > DISTANCE_TOLERANCE) {
      problems.push({ kind: 'distance_mismatch',
        problem: `opgegeven ${claimed} km, berekend ${math.km} km (${Math.round(rel * 100)}% verschil)`,
        claimed, computed: math.km, deltaKm: +diff.toFixed(2) });
    }
    // De onmogelijkheidscheck: vraagt de opgegeven afstand een sessietempo
    // dat sneller is dan het looptempo?
    const impliedSessionPace = math.minutes / claimed;
    if (claimed && impliedSessionPace < runPace) {
      problems.push({ kind: 'impossible',
        problem: `${claimed} km in ${math.minutes} min vraagt ${fmtPaceSec(impliedSessionPace * 60)}/km ` +
          `gemiddeld, sneller dan het opgegeven looptempo ${fmtPaceSec(runPace * 60)}/km — ` +
          'met wandelpauzes kan dat niet',
        impliedSessionPace: +impliedSessionPace.toFixed(2), runPace });
    }
  }

  return { label, math, problems, ok: problems.length === 0 };
}

// ── Doeltempo uit afstand en tijd ───────────────────────────────
// Jij voert afstand en gewenste eindtijd in; het tempo volgt. Nooit
// andersom, en nooit los opgeslagen.
export function paceFromGoal({ distanceKm, targetTimeSec }) {
  const d = Number(distanceKm), t = Number(targetTimeSec);
  if (!d || !t) return null;
  return Math.round(t / d);            // sec/km
}

export function timeFromPace({ distanceKm, paceSecPerKm }) {
  const d = Number(distanceKm), p = Number(paceSecPerKm);
  if (!d || !p) return null;
  return Math.round(d * p);            // sec
}

// "35:00" of "1:05:00" of "35" → seconden
export function parseTime(input) {
  if (input == null) return null;
  if (typeof input === 'number') return Math.round(input * 60);
  const s = String(input).trim();
  if (!s) return null;
  const parts = s.split(':').map(x => x.trim());
  if (parts.some(x => x === '' || isNaN(Number(x)))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return Math.round(nums[0] * 60);        // minuten
  if (nums.length === 2) return Math.round(nums[0] * 60 + nums[1]);
  if (nums.length === 3) return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2]);
  return null;
}
