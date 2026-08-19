// Symptomen die op elkaar lijken maar iets heel anders betekenen.
//
// Eén generieke "symptoomscore" maakt hier precies de fout die deze loper
// jaren heeft gekost: alles wat pijn doet op één hoop, waardoor het signaal
// dat er werkelijk toe doet verdwijnt in het gemiddelde.
//
// Drie categorieën, en ze worden nooit samengevoegd:
//
//   POST-EXERTIONELE HOOFDPIJN  de persoonlijke PEM-waarschuwing
//   MIGRAINE                    eigen aandoening, eigen triggers
//   SPIERPIJN                   gesplitst in DOMS en diffuus/grieperig
//
// De afname van inspanningsgerelateerde hoofdpijn sinds december 2025 is de
// belangrijkste hersteltrend die er is. Minder hoofdpijn bij dezelfde
// belasting is échte progressie — ook als het tempo nog niet beweegt.

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts } from './workouts';

// ── Post-exertionele hoofdpijn ──────────────────────────────────
export const HEADACHE_SEVERITY = [
  { value: 0, label: 'Geen', color: 'var(--sage)' },
  { value: 1, label: 'Licht', color: 'var(--gold)' },
  { value: 2, label: 'Duidelijk', color: 'var(--rust)' },
  { value: 3, label: 'Fors', color: 'var(--alert)' },
];

export const HEADACHE_TIMING = [
  { id: 'during', label: 'Tijdens de inspanning' },
  { id: 'h0_6', label: '0–6 uur erna' },
  { id: 'h6_24', label: '6–24 uur erna' },
  { id: 'h24_48', label: '24–48 uur erna' },
];

export const HEADACHE_DURATION = [
  { id: 'lt6', label: 'Korter dan 6 uur', weight: 1 },
  { id: 'h6_24', label: '6–24 uur', weight: 2 },
  { id: 'h24_48', label: '24–48 uur', weight: 3 },
  { id: 'gt48', label: 'Langer dan 48 uur', weight: 4 },
];

// ── Migraine ────────────────────────────────────────────────────
// Nadrukkelijk een eigen categorie. Migraine hangt bij deze gebruiker vaak
// samen met hormonen, weer, stress of slaap. Hem als PEM lezen zou de
// trainingsopbouw onterecht afremmen.
export const MIGRAINE_TYPES = [
  { id: 'none', label: 'Geen' },
  { id: 'without_aura', label: 'Migraine zonder aura' },
  { id: 'with_aura', label: 'Migraine met aura' },
];

export const MIGRAINE_TRIGGERS = [
  { id: 'hormonal', label: 'Hormonaal' },
  { id: 'weather', label: 'Weer' },
  { id: 'stress', label: 'Stress' },
  { id: 'sleep', label: 'Slaap' },
  { id: 'exertion', label: 'Mogelijk inspanning' },
  { id: 'unknown', label: 'Onbekend' },
];

// ── Spierpijn ───────────────────────────────────────────────────
export const MUSCLE_TYPES = [
  { id: 'none', label: 'Geen' },
  { id: 'doms', label: 'Gewone spierpijn (DOMS)',
    hint: 'Lokaal, in de spieren die je gebruikt hebt, zonder ziek gevoel.',
    pem: false },
  { id: 'diffuse', label: 'Diffuus of grieperig',
    hint: 'Meerdere spiergroepen tegelijk, met malaise, hoofdpijn of hersenmist.',
    pem: true },
];

// ── Overige post-exertionele signalen ───────────────────────────
export const POST_EXERTIONAL_SIGNS = [
  { id: 'malaise', label: 'Ziek of grieperig gevoel', weight: 3, red: false },
  { id: 'brainfog', label: 'Hersenmist', weight: 2, red: false },
  { id: 'slow_thinking', label: 'Trager denken', weight: 2, red: false },
  { id: 'dizzy', label: 'Duizeligheid', weight: 2, red: false },
  { id: 'palpitations', label: 'Hartkloppingen', weight: 3, red: true },
  { id: 'hr_high_for_pace', label: 'Opvallend hoge hartslag voor het tempo', weight: 2, red: false },
  { id: 'fever', label: 'Verhoging of koorts', weight: 4, red: true },
  { id: 'chills', label: 'Rillingen', weight: 3, red: false },
  { id: 'cold_sweat', label: 'Koud of klam zweet', weight: 4, red: true },
  { id: 'collapse', label: 'Instortgevoel', weight: 5, red: true },
  { id: 'chest', label: 'Borstklachten', weight: 5, red: true },
  { id: 'neuro', label: 'Neurologische alarmsymptomen', weight: 5, red: true },
  { id: 'next_day_worse', label: 'Volgende dag duidelijk slechter functioneren', weight: 3, red: false },
];

export const RED_FLAG_IDS = POST_EXERTIONAL_SIGNS.filter(s => s.red).map(s => s.id);

// ── Uitlezen uit een daglog ─────────────────────────────────────
// Werkt met de nieuwe velden, en valt terug op de oude booleans zodat
// bestaande data niet plotseling niets meer betekent.
export function readSymptoms(log = {}) {
  const headache = log.headache_severity != null ? Number(log.headache_severity)
    : log.symptom_headache ? 2 : null;

  return {
    headache: {
      severity: headache,
      timing: log.headache_timing || null,
      duration: log.headache_duration || null,
      present: headache != null && headache > 0,
    },
    migraine: {
      type: log.migraine_type || (log.symptom_migraine ? 'without_aura' : 'none'),
      triggers: log.migraine_triggers || [],
      present: !!(log.migraine_type && log.migraine_type !== 'none') || !!log.symptom_migraine,
    },
    muscle: {
      type: log.muscle_type || (log.symptom_pain ? 'doms' : 'none'),
      present: !!(log.muscle_type && log.muscle_type !== 'none') || !!log.symptom_pain,
    },
    signs: POST_EXERTIONAL_SIGNS.filter(s => log[`pe_${s.id}`] ||
      // Terugval op de oude losse velden
      (s.id === 'malaise' && (log.symptom_exhaustion || log.delayed_fatigue)) ||
      (s.id === 'brainfog' && (log.symptom_brainfog || log.delayed_brainfog)) ||
      (s.id === 'next_day_worse' && (log.recovery_check === 'bad' ||
        log.training_recovery === 2 || log.symptom_pem)) ||
      (s.id === 'hr_high_for_pace' && log.delayed_breathless)),
  };
}

// ── Het oordeel over één sessie ─────────────────────────────────
// Levert de PEM-status van de respons op een training. Dit is de laag die
// bepaalt of er opgebouwd mag worden.
export function exertionalResponse({ workoutDate, logs = {}, currentDate = todayLocal() }) {
  if (!workoutDate) return { status: 'unknown', reason: 'geen sessiedatum' };

  // Het venster: van de dag zelf tot 48 uur erna.
  const window = [0, 1, 2].map(i => ({ offset: i, date: addDays(workoutDate, i),
    log: logs?.[addDays(workoutDate, i)] || null }));

  const answered = window.filter(w => w.log && (
    w.log.headache_severity != null || w.log.recovery_check ||
    w.log.training_recovery != null || w.log.muscle_type ||
    POST_EXERTIONAL_SIGNS.some(s => w.log[`pe_${s.id}`])));

  const daysSince = daysBetween(workoutDate, currentDate);
  if (!answered.length) {
    return {
      status: daysSince >= 2 ? 'unanswered' : 'pending',
      reason: daysSince >= 2
        ? 'Het 24–48u-venster is voorbij zonder dat je iets hebt ingevuld. Deze sessie telt daarom niet als bewezen verdragen.'
        : 'Het 24–48u-venster loopt nog.',
      daysSince,
    };
  }

  // ── Rode vlaggen: acute abnormale respons ─────────────────────
  const redSigns = [];
  for (const w of window) {
    if (!w.log) continue;
    for (const s of readSymptoms(w.log).signs) {
      if (s.red) redSigns.push({ ...s, when: w.offset });
    }
  }
  if (redSigns.length) {
    return {
      status: 'red', level: 'RED',
      reason: `Abnormale respons na inspanning: ${redSigns.map(s => s.label.toLowerCase()).join(', ')}.`,
      signs: redSigns,
      countsAsVolume: false,
      allowsBuild: false,
      advice: 'Deze sessie telt niet als bewezen belastbaarheid en niet als veilige benchmark. Dit is hetzelfde patroon als 12 januari 2025 — daar mag geen opbouw op volgen.',
    };
  }

  // ── Hoofdpijn: de persoonlijke hoofdmarker ────────────────────
  let worstHeadache = null, headacheWhen = null, headacheDuration = null;
  for (const w of window) {
    const s = readSymptoms(w.log || {});
    if (s.headache.severity != null && s.headache.severity > (worstHeadache ?? -1)) {
      worstHeadache = s.headache.severity;
      headacheWhen = s.headache.timing || (w.offset === 0 ? 'h0_6' : w.offset === 1 ? 'h6_24' : 'h24_48');
      headacheDuration = s.headache.duration;
    }
  }

  // ── Diffuse spierpijn telt mee, DOMS niet ─────────────────────
  const diffuse = window.some(w => readSymptoms(w.log || {}).muscle.type === 'diffuse');
  const doms = window.some(w => readSymptoms(w.log || {}).muscle.type === 'doms');

  // ── Migraine apart houden ─────────────────────────────────────
  const migraine = window.map(w => readSymptoms(w.log || {}).migraine).find(m => m.present);
  const migraineExertional = migraine?.triggers?.includes('exertion');

  // ── Overige signalen wegen ────────────────────────────────────
  const otherSigns = [];
  const seenSigns = new Set();
  for (const w of window) {
    if (!w.log) continue;
    for (const s of readSymptoms(w.log).signs) {
      // Eén signaal telt één keer, ook als het twee dagen achter elkaar
      // is aangevinkt. Anders weegt volhardend invullen als verslechtering.
      if (s.red || seenSigns.has(s.id)) continue;
      seenSigns.add(s.id);
      otherSigns.push({ ...s, when: w.offset });
    }
  }
  const otherWeight = otherSigns.reduce((sum, s) => sum + s.weight, 0);

  // ── Het oordeel ───────────────────────────────────────────────
  const headacheWeight = worstHeadache ? worstHeadache * 2 : 0;
  const durationWeight = HEADACHE_DURATION.find(d => d.id === headacheDuration)?.weight || 0;
  const total = headacheWeight + durationWeight + (diffuse ? 4 : 0) + otherWeight;

  // Duidelijke of forse hoofdpijn na inspanning is op zichzelf al genoeg.
  // Hoofdpijn is bij deze gebruiker de vroegste en betrouwbaarste marker;
  // hem laten wegvallen omdat er verder niets is aangevinkt zou precies de
  // sessies als "verdragen" boeken waar het in 2024 misging.
  const headacheDecisive = worstHeadache >= 2;

  const parts = [];
  if (worstHeadache > 0) {
    parts.push(`hoofdpijn ${HEADACHE_SEVERITY[worstHeadache].label.toLowerCase()}` +
      (headacheWhen ? ` (${HEADACHE_TIMING.find(t => t.id === headacheWhen)?.label.toLowerCase()})` : ''));
  }
  if (diffuse) parts.push('diffuse spierpijn');
  if (otherSigns.length) parts.push(otherSigns.map(s => s.label.toLowerCase()).join(', '));

  if (total >= 6 || headacheDecisive) {
    return {
      status: 'poor', level: 'AMBER',
      headache: worstHeadache, headacheTiming: headacheWhen, diffuse, otherSigns,
      migraine: migraine || null, migraineCountsAsPem: !!migraineExertional,
      reason: `Duidelijke post-exertionele respons: ${parts.join(', ')}.`,
      countsAsVolume: false, allowsBuild: false,
      advice: worstHeadache >= 2
        ? 'Post-exertionele hoofdpijn is bij jou de belangrijkste waarschuwing. Geen opbouw; herhaal het niveau of schaal terug.'
        : 'Geen opbouw op deze sessie. Herhaal hetzelfde niveau tot de respons schoon is.',
    };
  }

  // Migraine telt normaal niet als inspanningsrespons — behalve wanneer jij
  // zelf inspanning als trigger hebt aangevinkt. Dan is het geen losse
  // migraine meer maar een reactie op de training, en mag er niet op
  // opgebouwd worden.
  if (migraineExertional) {
    return {
      status: 'mild', level: 'AMBER',
      headache: worstHeadache ?? 0, headacheTiming: headacheWhen, diffuse, otherSigns,
      migraine: migraine, migraineCountsAsPem: true,
      reason: 'Migraine met inspanning als mogelijke trigger. Dat lees ik hier wél als reactie op de training.',
      countsAsVolume: true, allowsBuild: false,
      advice: 'Geen opbouw op deze sessie. Als dit zich herhaalt bij vergelijkbare belasting, is de belasting zelf de vraag — niet je discipline.',
    };
  }

  if (total >= 2) {
    return {
      status: 'mild', level: 'AMBER',
      headache: worstHeadache, headacheTiming: headacheWhen, diffuse, otherSigns,
      migraine: migraine || null, migraineCountsAsPem: !!migraineExertional,
      reason: parts.length ? `Milde respons: ${parts.join(', ')}.` : 'Milde respons.',
      countsAsVolume: true, allowsBuild: false,
      advice: 'Verdragen, maar niet schoon genoeg om op te bouwen. Houd het niveau vast.',
    };
  }

  return {
    status: 'good', level: 'GREEN',
    headache: worstHeadache ?? 0, diffuse: false, doms,
    migraine: migraine || null, migraineCountsAsPem: false,
    reason: doms
      ? 'Goed verdragen. Wel gewone spierpijn — dat is een normale trainingsrespons, geen PEM.'
      : migraine?.present
        ? 'Goed verdragen. De migraine is apart geregistreerd en wordt niet als inspanningsrespons gelezen.'
        : 'Goed verdragen: geen hoofdpijn, geen diffuse klachten, geen afwijkend herstel.',
    countsAsVolume: true, allowsBuild: true,
    advice: 'Deze sessie telt als bewezen verdragen. Twee tot drie zulke sessies op rij geven ruimte om op te bouwen.',
  };
}

// ── De hoofdpijntrend: de belangrijkste hersteltrend ────────────
// Minder hoofdpijn bij vergelijkbare belasting is echte progressie, ook als
// het tempo nog niet beweegt.
export function headacheTrend({ logs = {}, currentDate = todayLocal(), weeks = 12 } = {}) {
  const runs = loadWorkouts()
    .filter(w => (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate)
    .filter(w => w.date >= addDays(currentDate, -weeks * 7))
    .sort((a, b) => a.date.localeCompare(b.date));

  const points = runs.map(w => {
    const r = exertionalResponse({ workoutDate: w.date, logs, currentDate });
    return {
      date: w.date, km: Number(w.distance) || null, minutes: Number(w.duration) || null,
      headache: r.headache ?? null, status: r.status,
    };
  }).filter(p => p.headache != null);

  if (points.length < 4) {
    return { enough: false, points, count: points.length,
      note: `Nog ${4 - points.length} sessie(s) met een ingevulde hoofdpijnscore nodig voor een trend. Dit is je belangrijkste hersteltrend — het is de moeite waard om hem elke keer in te vullen.` };
  }

  const half = Math.floor(points.length / 2);
  const older = points.slice(0, half), recent = points.slice(half);
  const avg = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0) / a.length;

  const hOld = avg(older, 'headache'), hNew = avg(recent, 'headache');
  const kmOld = avg(older, 'km'), kmNew = avg(recent, 'km');
  const freeRecent = recent.filter(p => p.headache === 0).length;

  const improving = hNew < hOld - 0.3;
  const loadUp = kmNew > kmOld * 1.05;

  return {
    enough: true, points, count: points.length,
    older: +hOld.toFixed(1), recent: +hNew.toFixed(1),
    headacheFreeRecent: freeRecent, recentCount: recent.length,
    improving, loadUp,
    verdict: improving && loadUp
      ? `Minder hoofdpijn (${hOld.toFixed(1)} → ${hNew.toFixed(1)}) terwijl je afstand toenam van ${kmOld.toFixed(1)} naar ${kmNew.toFixed(1)} km. Dat is de belangrijkste vorm van progressie die er voor jou is — belangrijker dan tempo.`
      : improving
        ? `Minder post-exertionele hoofdpijn dan eerder (${hOld.toFixed(1)} → ${hNew.toFixed(1)}) bij vergelijkbare belasting. Dat is echte herstelprogressie, ook zonder tempowinst.`
        : hNew > hOld + 0.3
          ? `Meer hoofdpijn dan eerder (${hOld.toFixed(1)} → ${hNew.toFixed(1)}). Dit is je vroegste waarschuwing — niet opbouwen tot dit weer zakt.`
          : `Hoofdpijn stabiel rond ${hNew.toFixed(1)}. ${freeRecent} van je laatste ${recent.length} sessies waren hoofdpijnvrij.`,
  };
}

// Hoeveel opeenvolgende weken zonder PEM-signaal?
export function pemFreeWeeks({ logs = {}, currentDate = todayLocal(), max = 12 } = {}) {
  let weeks = 0;
  for (let w = 0; w < max; w++) {
    const to = addDays(currentDate, -w * 7);
    const from = addDays(to, -6);
    const bad = Object.values(logs).some(l => l.date >= from && l.date <= to && (
      l.symptom_pem || l.training_recovery === 2 || l.recovery_check === 'bad' ||
      Number(l.headache_severity) >= 2 || l.muscle_type === 'diffuse' ||
      RED_FLAG_IDS.some(id => l[`pe_${id}`])));
    if (bad) break;
    // Alleen weken meetellen waarin er ook echt iets is ingevuld.
    const any = Object.values(logs).some(l => l.date >= from && l.date <= to &&
      (l.recovery_check || l.training_recovery != null || l.headache_severity != null));
    if (!any) break;
    weeks++;
  }
  return { weeks, note: weeks === 0
    ? 'Nog geen volledige PEM-vrije week geregistreerd.'
    : `${weeks} opeenvolgende week${weeks > 1 ? 'en' : ''} zonder PEM-signaal.` };
}
