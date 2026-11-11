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

// ── Gewoon ziek is geen PEM ─────────────────────────────────────
//
// Zij vroeg erom, en het is dezelfde fout als met migraine: "ik wil
// ergens kunnen melden dat ik gewoon griep heb zonder dat er gelijk
// wordt gedacht dat het PEM is of door long covid komt."
//
// Terecht, en het is ook medisch het juiste onderscheid. Een infectie
// geeft precies de signalen waar het PEM-oordeel op let — grieperig
// gevoel, rillingen, koorts, hersenmist, een hoge rusthartslag, een lage
// HRV — maar de oorzaak is een virus en niet de training van eergisteren.
// Zonder dit onderscheid telt een week griep als bewijs dat haar opbouw
// te zwaar was, breekt het haar PEM-vrije reeks, en wordt haar schema
// teruggezet voor iets wat met hardlopen niets te maken had.
//
// Wat het NIET doet: trainen vrijgeven. Ziek is ziek, en de poort blijft
// dicht. Het verandert alleen de conclusie die eraan hangt.
export const INFECTION_TYPES = [
  { id: 'none', label: 'Geen' },
  { id: 'cold', label: 'Verkoudheid' },
  { id: 'flu', label: 'Griep of koorts' },
  { id: 'stomach', label: 'Buikgriep' },
  { id: 'other', label: 'Iets anders infectieus' },
];

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
    // Een infectie: zelf gemeld, met een soort en of hij nog loopt.
    infection: {
      type: log.infection_type
        || (log.infection === true || log.symptom_sick === true ? 'other' : 'none'),
      present: !!(log.infection_type && log.infection_type !== 'none')
        || log.infection === true || log.symptom_sick === true,
      day: log.infection_day != null ? Number(log.infection_day) : null,
    },
    migraine: {
      type: log.migraine_type || ((log.symptom_migraine || log.migraine) ? 'without_aura' : 'none'),
      triggers: log.migraine_triggers || [],
      // Ook het kale veld `migraine`. In haar dagboek staat op 19 september
      // "migraine: true" met als notitie "alcohol gehad daardoor migraine",
      // zónder migraine_type — en dan zag deze functie geen migraine, zodat
      // de hoofdpijn van die dag alsnog als post-exertioneel signaal kon
      // tellen. Precies wat niet de bedoeling is.
      present: !!(log.migraine_type && log.migraine_type !== 'none')
        || !!log.symptom_migraine || log.migraine === true,
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

  // ── Hoofdpijn: de persoonlijke hoofdmarker, maar niet de migraine ──
  //
  // Zij zei het zo: migraine zegt niets over long COVID, een PEM-reactie
  // wel. Dat is medisch ook het juiste onderscheid. Migraine heeft bij haar
  // eigen triggers — hormonen, weer, alcohol, slaaptekort — en die staan
  // los van inspanning. Toch woog de hoofdpijn van een migrainedag hier
  // gewoon mee, en met ernst 2 of hoger was dat op zichzelf al genoeg voor
  // "geen opbouw". Een migraineaanval in het weekend blokkeerde zo haar
  // training van de week erna.
  //
  // Dus: op een dag met migraine telt de hoofdpijn niet mee in het
  // PEM-oordeel — tenzij zij de migraine zélf als inspanningsgerelateerd
  // heeft aangemerkt. De migraine verdwijnt niet uit beeld; hij wordt
  // apart gemeld, en recoveryBudget rekent hem al als belasting.
  const migraineDagen = new Set();
  for (const w of window) {
    const m = readSymptoms(w.log || {}).migraine;
    if (m.present && !m.triggers?.includes('exertion')) migraineDagen.add(w.offset);
  }

  // ── Een infectie is geen bewijs over haar belastbaarheid ─────
  //
  // Op een dag die zij als griep of verkoudheid heeft gemeld, tellen de
  // signalen die bij ziek zijn horen niet mee in het PEM-oordeel. Ze
  // verdwijnen niet — ze worden apart gemeld, zodat zichtbaar blijft dat
  // er iets was en waaróm het niet meetelt. Een signaal dat stilzwijgend
  // wegvalt is net zo misleidend als een signaal dat verkeerd wordt
  // uitgelegd.
  const infectieDagen = new Set();
  let infectieSoort = null;
  for (const w of window) {
    const inf = readSymptoms(w.log || {}).infection;
    if (inf.present) { infectieDagen.add(w.offset); infectieSoort = infectieSoort || inf.type; }
  }
  // Welke signalen horen bij ziek zijn en dus bij de infectie, niet bij de
  // sessie. Borstklachten en neurologische alarmsymptomen staan er
  // nadrukkelijk níét bij: die blijven altijd een rode vlag.
  const ZIEKTE_SIGNALEN = new Set(['malaise', 'fever', 'chills', 'brainfog',
    'slow_thinking', 'cold_sweat', 'next_day_worse']);
  let worstHeadache = null, headacheWhen = null, headacheDuration = null;
  let migraineHoofdpijn = null;
  for (const w of window) {
    const s = readSymptoms(w.log || {});
    if (infectieDagen.has(w.offset)) continue;
    if (migraineDagen.has(w.offset)) {
      if (s.headache.severity != null) {
        migraineHoofdpijn = Math.max(migraineHoofdpijn ?? 0, s.headache.severity);
      }
      continue;
    }
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
  const infectieSignalen = [];
  const seenSigns = new Set();
  for (const w of window) {
    if (!w.log) continue;
    for (const s of readSymptoms(w.log).signs) {
      // Eén signaal telt één keer, ook als het twee dagen achter elkaar
      // is aangevinkt. Anders weegt volhardend invullen als verslechtering.
      if (s.red || seenSigns.has(s.id)) continue;
      seenSigns.add(s.id);
      // Hoort dit signaal bij de gemelde infectie? Dan telt het daar en
      // niet bij de sessie — behalve de rode vlaggen, die hierboven al
      // apart gaan en altijd blijven staan.
      if (infectieDagen.has(w.offset) && ZIEKTE_SIGNALEN.has(s.id)) {
        infectieSignalen.push({ ...s, when: w.offset });
        continue;
      }
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

  // Wat er over de infectie te zeggen valt, los van het oordeel. Dit
  // hoort zichtbaar te blijven: zij moet kunnen zien dát er signalen
  // waren en waaróm ze niet meetellen, anders lijkt de app ze te missen.
  const infectieLabel = INFECTION_TYPES.find(t => t.id === infectieSoort)?.label || null;
  const infectieNoot = infectieDagen.size
    ? `Je hebt in dit venster ${infectieLabel ? infectieLabel.toLowerCase() : 'een infectie'} `
      + 'gemeld. '
      + (infectieSignalen.length
        ? `De klachten die daarbij horen (${infectieSignalen.map(x => x.label.toLowerCase()).join(', ')}) `
          + 'tellen niet mee als reactie op je training. '
        : '')
      + 'Ziek zijn zegt niets over je belastbaarheid, en het breekt je PEM-vrije reeks niet. '
      + 'Trainen blijft wel dicht tot je beter bent.'
    : null;

  // Wat er over de migraine te zeggen valt, los van het oordeel.
  const migraineNoot = migraine && !migraineExertional
    ? `Er was migraine in dit venster${migraineHoofdpijn ? ` (hoofdpijn ${migraineHoofdpijn})` : ''}`
      + `${migraine.triggers?.length ? `, triggers: ${migraine.triggers.join(', ')}` : ''}. `
      + 'Die telt niet mee als post-exertionele reactie — migraine heeft eigen '
      + 'triggers en zegt niets over je belastbaarheid.'
    : null;

  if (total >= 6 || headacheDecisive) {
    return {
      status: 'poor', level: 'AMBER',
      headache: worstHeadache, headacheTiming: headacheWhen, diffuse, otherSigns,
      migraine: migraine || null, migraineCountsAsPem: !!migraineExertional,
      migraineNote: migraineNoot,
      infection: infectieSoort || null, infectionNote: infectieNoot,
      reason: `Duidelijke post-exertionele respons: ${parts.join(', ')}.`
        + (migraineNoot ? ` ${migraineNoot}` : ''),
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
      infection: infectieSoort || null, infectionNote: infectieNoot,
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
      infection: infectieSoort || null, infectionNote: infectieNoot,
      reason: (parts.length ? `Milde respons: ${parts.join(', ')}.` : 'Milde respons.')
        + (infectieNoot ? ` ${infectieNoot}` : ''),
      countsAsVolume: true, allowsBuild: false,
      advice: 'Verdragen, maar niet schoon genoeg om op te bouwen. Houd het niveau vast.',
    };
  }

  return {
    status: 'good', level: 'GREEN',
    headache: worstHeadache ?? 0, diffuse: false, doms,
    migraine: migraine || null, migraineCountsAsPem: false,
    infection: infectieSoort || null, infectionNote: infectieNoot,
    reason: infectieNoot ? `Geen tekenen van een post-exertionele reactie. ${infectieNoot}` : doms
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

// ── Wanneer telt een klacht als PEM? ────────────────────────────
//
// WAT ER MIS WAS, EN WAAROM HET ERTOE DOET
//
// Zij zei het zelf, en ze heeft gelijk: haar long-COVID-geschiedenis hoort
// mee te tellen wanneer er een PEM-reactie ís, niet als staande aanname.
// Deze functie deed het omgekeerde, op twee manieren.
//
//   1. Elke klacht telde als PEM-signaal, ook zonder inspanning ervoor.
//      Een migraine op een rustdag zette de teller op nul. Maar PEM is per
//      definitie een VERSLECHTERING NA INSPANNING: de klacht moet volgen op
//      wat je deed. Een migraine op een dag zonder training is een
//      migrainedag — vervelend, en iets om te loggen, maar het zegt niets
//      over hoeveel belasting ze verdraagt.
//
//   2. Een week zónder invoer brak de reeks óók ("if (!any) break"). Niet
//      loggen werd dus bestraft alsof haar lichaam iets had gemeld. Twee
//      weken vakantie zonder app = nul PEM-vrije weken = alle poorten dicht.
//
// Allebei de fouten wijzen dezelfde kant op: ze maken van de diagnose een
// permanente rem in plaats van een reactie op wat er werkelijk gebeurt.
//
// Nu:
//   · een klacht telt als PEM-signaal wanneer ze binnen 72 uur op een
//     training volgt, óf wanneer zij zelf het PEM-vinkje zet (dat is haar
//     eigen oordeel en dat wint altijd), óf bij een rode vlag uit de
//     post-exertionele lijst;
//   · een week zonder invoer breekt niets; hij telt alleen niet mee als
//     bewijs. Het aantal wordt apart gemeld, zodat niemand doet alsof een
//     lege week een schone week is.
const PEM_VENSTER_UREN = 72;

function inspanningBinnenVenster(datum, sessieDatums) {
  return sessieDatums.some(d => {
    const verschil = daysBetween(d, datum);
    return verschil >= 0 && verschil <= PEM_VENSTER_UREN / 24;
  });
}

export function pemFreeWeeks({ logs = {}, currentDate = todayLocal(), max = 12,
  workouts = null } = {}) {
  // Elke dag waarop iets van belasting stond: een loop, of een
  // krachtsessie. Zonder die lijst is "na inspanning" niet te bepalen.
  const sessies = new Set();
  for (const w of (workouts || loadWorkouts())) if (w?.date) sessies.add(w.date);
  for (const l of Object.values(logs)) {
    if (l?.date && (l.strength_done || l.run_session || l.workout_done)) sessies.add(l.date);
  }
  const sessieDatums = [...sessies];

  const isSignaal = (l) => {
    // Haar eigen vinkje en de rode vlaggen gelden altijd: dat is een
    // oordeel over de reactie zelf, niet over een losse klacht.
    if (l.symptom_pem) return true;
    if (RED_FLAG_IDS.some(id => l[`pe_${id}`])) return true;
    // Migraine telt hier niet. Zij heeft gelijk: migraine zegt niets over
    // long COVID, een PEM-reactie wel. Een migrainedag die toevallig na een
    // training valt, zette de teller op nul en blokkeerde de opbouw.
    const sym = readSymptoms(l);
    const m = sym.migraine;
    const migraineDag = m.present && !m.triggers?.includes('exertion');
    // Een gemelde infectie telt hier net zo min. Griep geeft precies de
    // klachten waar deze teller op let — slecht hersteld, hoofdpijn,
    // diffuse spierpijn — maar de oorzaak is een virus. Zonder deze regel
    // zet een week griep haar PEM-vrije reeks op nul en blokkeert dat
    // haar opbouw voor weken, voor iets wat met hardlopen niets te maken
    // had. Haar eigen PEM-vinkje en de rode vlaggen hierboven blijven
    // wél gelden: die zijn een oordeel, geen afgeleide.
    if (sym.infection?.present) return false;
    const hoofdpijn = !migraineDag && Number(l.headache_severity) >= 2;
    const klacht = l.training_recovery === 2 || l.recovery_check === 'bad'
      || hoofdpijn || l.muscle_type === 'diffuse';
    if (!klacht) return false;
    // Geen inspanning in de 72 uur ervoor: dan is dit geen post-exertionele
    // reactie. Het blijft een slechte dag, en die staat gewoon in het
    // dagboek — hij hoort alleen niet de opbouw te blokkeren.
    return inspanningBinnenVenster(l.date, sessieDatums);
  };

  let weken = 0, zonderInvoer = 0;
  let gebroken = null;
  for (let w = 0; w < max; w++) {
    const to = addDays(currentDate, -w * 7);
    const from = addDays(to, -6);
    const inWeek = Object.values(logs).filter(l => l?.date >= from && l.date <= to);
    const signaal = inWeek.find(isSignaal);
    if (signaal) { gebroken = signaal.date; break; }
    const ingevuld = inWeek.some(l => l.recovery_check || l.training_recovery != null
      || l.headache_severity != null);
    // Een lege week breekt niets en bewijst niets.
    if (!ingevuld) { zonderInvoer++; continue; }
    weken++;
  }

  const note = weken === 0
    ? (zonderInvoer
      ? `Nog geen week met invoer om te beoordelen (${zonderInvoer} week/weken zonder gegevens).`
      : 'Nog geen volledige PEM-vrije week geregistreerd.')
    : `${weken} ${weken === 1 ? 'week' : 'weken'} zonder post-exertioneel signaal`
      + (zonderInvoer ? `, plus ${zonderInvoer} week/weken zonder invoer (die tellen niet mee als bewijs).` : '.')
      + (gebroken ? ` Laatste signaal: ${gebroken}.` : '');

  return { weeks: weken, unloggedWeeks: zonderInvoer, lastSignal: gebroken, note };
}
