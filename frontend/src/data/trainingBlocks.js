// Hardlooproadmap: trainingsblokken op hoofdlijnen (3–6 maanden vooruit).
// De roadmap toont richting — exacte sessies blijven adaptief (BUILD/HOLD/REPEAT/DELOAD/SWAP/TEST).

export const TRAINING_BLOCKS = [
  {
    id: 'rebuild', name: 'REBUILD', emoji: '🔧',
    start: '2026-08-17', end: '2026-08-31',
    adaptation: 'Weer wennen aan belasting na de zomer — korte run/walk, alles strikt zone B.',
    not: 'Geen tempo, geen lange duurlopen, geen zone C.',
  },
  {
    id: 'aerobic', name: 'AEROBIC BASE', emoji: '🫁',
    start: '2026-09-01', end: '2026-10-03',
    adaptation: 'Aerobe basis: zone B-volume, run/walk verlengen. Eindigt met Trail 10 km (3 okt).',
    not: 'Geen snelheid, geen intervallen boven zone B.',
  },
  {
    id: 'economy', name: 'ECONOMY', emoji: '⚙️',
    start: '2026-10-05', end: '2026-10-30',
    adaptation: 'Loopeconomie: langere loopblokken, kortere wandelpauzes. Eindigt met Bereloop Terschelling (30 okt).',
    not: 'Geen nieuw volume vlak voor de race, geen zone C.',
  },
  {
    id: 'continuous', name: 'CONTINUOUS RUNNING', emoji: '🏃',
    start: '2026-11-02', end: '2026-12-13',
    adaptation: 'Naar doorlopend hardlopen zonder wandelpauzes. Ameland 5 km (13 dec) als meetpunt.',
    not: 'Geen tempowerk; volume max +10% per week.',
  },
  {
    id: '5kbase', name: '5K BASE', emoji: '📏',
    start: '2026-12-14', end: '2027-02-28',
    adaptation: 'Consistente 5 km-basis: 2–3× per week doorlopend in zone B.',
    not: 'Geen race-tempo zolang herstel wisselend is.',
  },
  {
    id: '5kperf', name: '5K PERFORMANCE', emoji: '⚡',
    start: '2027-03-01', end: '2027-04-30',
    adaptation: 'Voorzichtige tempo-prikkels bovenop de basis — alleen bij stabiel groen.',
    not: 'Geen back-to-back zware dagen.',
  },
  {
    id: 'test', name: 'TEST', emoji: '🧪',
    start: '2027-05-01', end: '2027-05-31',
    adaptation: '5 km-tijdtest onder goede omstandigheden — meten wat de opbouw heeft gebracht.',
    not: 'Rondom de test alleen licht onderhoud.',
  },
];

export function getCurrentBlock(dateStr) {
  return TRAINING_BLOCKS.find(b => dateStr >= b.start && dateStr <= b.end)
    || TRAINING_BLOCKS.find(b => dateStr < b.start)
    || TRAINING_BLOCKS[TRAINING_BLOCKS.length - 1];
}

export function getBlockFor(dateStr) {
  return TRAINING_BLOCKS.find(b => dateStr >= b.start && dateStr <= b.end) || null;
}

// ── Adaptieve blokverwachting ───────────────────────────────────
// Kalenderdatums zijn de wens; werkelijke readiness bepaalt het tempo.
// Herhaalde/teruggeschaalde sessies schuiven de verwachte einddatum op.
// Races (Trail 3 okt, Bereloop 30 okt, Ameland 13 dec) blijven vast staan.
export function blockExpectation(currentDate) {
  const block = getCurrentBlock(currentDate);
  if (!block) return null;
  let events = [];
  try {
    events = JSON.parse(localStorage.getItem('gc_adaptive_log') || '[]')
      .filter(e => e.date >= block.start && e.date <= currentDate);
  } catch { /* geen log */ }
  const setbacks = events.filter(e =>
    ['repeated', 'deload', 'poorly_tolerated', 'stopped', 'done_modified'].includes(e.event)
  );
  const shiftDays = Math.min(21, setbacks.length * 3);
  const expectedEnd = (() => {
    const d = new Date(block.end + 'T12:00:00');
    d.setDate(d.getDate() + shiftDays);
    return d.toISOString().slice(0, 10);
  })();
  const raceNote = shiftDays > 0 && (block.id === 'aerobic' || block.id === 'economy')
    ? 'De racedatum blijft vast staan — het haalbare doel voor die dag schuift mee met je werkelijke opbouw.'
    : null;
  return {
    block,
    originalEnd: block.end,
    expectedEnd,
    shiftDays,
    setbackCount: setbacks.length,
    reason: setbacks.length > 0
      ? `${setbacks.length} sessie${setbacks.length > 1 ? 's' : ''} herhaald/aangepast/teruggeschaald wegens vertraagde herstelrespons`
      : null,
    raceNote,
  };
}

// Weekfocus voor de komende N weken: per week (maandag) het actieve blok
export function upcomingWeekFoci(fromDateStr, weeks = 4) {
  const monday = (ds) => {
    const d = new Date(ds + 'T12:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d.toISOString().slice(0, 10);
  };
  const addDays = (ds, n) => {
    const d = new Date(ds + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const startMonday = monday(fromDateStr);
  return Array.from({ length: weeks }, (_, i) => {
    const mon = addDays(startMonday, i * 7);
    const mid = addDays(mon, 3);
    const block = getBlockFor(mid) || getCurrentBlock(mid);
    return { monday: mon, sunday: addDays(mon, 6), block };
  });
}
