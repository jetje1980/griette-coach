// Wat jouw cyclus met jouw lichaam doet — geleerd, niet aangenomen.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM HIER GEEN DAG 14 STAAT
//
// De standaardaanname is: dag 14 is de eisprong, vanaf dag 15 is het luteaal.
// Die aanname komt uit een kalender van 28 dagen die bij veel vrouwen niet
// klopt en in de perimenopauze bijna nooit. Cycli worden korter, langer, en
// vooral onregelmatiger — en juist dán is een vast raster gevaarlijk, want
// het plakt een fase-etiket op een dag die die fase niet is.
//
// Dit bestand rekent daarom fase-relatief en achterwaarts. Voor elke cyclus
// is de eigen lengte L bekend (van start tot volgende start). De fasen worden
// vanaf het éínde geteld, omdat de tweede helft bij variabele cycli het meest
// constant is:
//
//   dag 1 t/m 5          menstruatie
//   dag 6 t/m L−16       folliculair
//   L−15 t/m L−12        rond de eisprong
//   L−11 t/m L−6         midluteaal
//   L−5 t/m L            laatluteaal
//
// Bij een cyclus van 28 komt dat op dag 13–16 rond de eisprong uit; bij een
// cyclus van 24 op dag 9–12, en bij 34 op dag 19–22. Dat is precies het punt.
//
// En als de lopende cyclus nog niet is afgesloten, is L onbekend. Dan wordt
// er geschat met je eigen gemiddelde — maar alleen als je cycli consistent
// genoeg zijn. Zo niet: `onbekend`. Dat is geen falen maar het eerlijke
// antwoord (§18).
//
// ─────────────────────────────────────────────────────────────────
// EN WAAROM ÉÉN CYCLUS HIER NIETS BEWIJST
//
// Een verschil in één cyclus is een waarneming. Hetzelfde verschil in drie
// cycli is een patroon. Het verschil daartussen wordt niet weggemoffeld in
// een voorzichtige formulering maar staat als waarde in de uitkomst (§17).
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series, latest } from './timeline';
import { personalBandwidth } from './bodyReview';
import { runEconomyTrend } from './pace';

const gem = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));
const mediaan = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// ── De cycli zelf ───────────────────────────────────────────────
export const PHASE = {
  MENSTRUAL: 'menstruatie',
  FOLLICULAR: 'folliculair',
  OVULATORY: 'rond de eisprong',
  MID_LUTEAL: 'midluteaal',
  LATE_LUTEAL: 'laatluteaal',
  UNKNOWN: 'onbekend',
};

export const PHASE_ORDER = [PHASE.MENSTRUAL, PHASE.FOLLICULAR, PHASE.OVULATORY,
  PHASE.MID_LUTEAL, PHASE.LATE_LUTEAL];

// Boven deze spreiding in cycluslengte is een fase-indeling schijnzekerheid.
// Zeven dagen is ruim: het laat normale variatie toe en vangt de
// onregelmatigheid die bij perimenopauze hoort.
export const MAX_SPREAD_DAYS = 7;

// Onder dit aantal afgesloten cycli is er geen eigen gemiddelde om mee te
// rekenen.
export const MIN_CYCLES_FOR_LENGTH = 2;

export function menstruationStarts({ asOf = todayLocal() } = {}) {
  return [...new Set(series('menstruation_start', { asOf }).map(o => o.observedAt))].sort();
}

// Alle afgesloten cycli, met hun werkelijke lengte. De lopende cyclus staat
// er apart bij, want die heeft nog geen lengte.
export function cycles({ asOf = todayLocal() } = {}) {
  const starts = menstruationStarts({ asOf });
  const gesloten = [];
  for (let i = 0; i < starts.length - 1; i++) {
    gesloten.push({
      start: starts[i], end: addDays(starts[i + 1], -1),
      length: daysBetween(starts[i], starts[i + 1]),
      closed: true,
    });
  }
  const lopend = starts.length
    ? { start: starts[starts.length - 1], end: null,
      length: null, closed: false,
      dayCount: daysBetween(starts[starts.length - 1], asOf) + 1 }
    : null;
  return { closed: gesloten, current: lopend, starts };
}

// Hoe regelmatig zijn je cycli? Dit bepaalt of er überhaupt over fasen
// gesproken mag worden.
export function cycleRegularity({ asOf = todayLocal() } = {}) {
  const { closed } = cycles({ asOf });
  const lengtes = closed.map(c => c.length).filter(n => n >= 15 && n <= 90);
  if (lengtes.length < MIN_CYCLES_FOR_LENGTH) {
    return { known: false, n: lengtes.length, lengths: lengtes,
      note: `Nog ${MIN_CYCLES_FOR_LENGTH - lengtes.length} afgesloten cyclus/cycli nodig voordat er van een eigen cycluslengte sprake is.` };
  }
  const spreiding = Math.max(...lengtes) - Math.min(...lengtes);
  const typisch = Math.round(mediaan(lengtes));
  return {
    known: true, n: lengtes.length, lengths: lengtes,
    typicalLength: typisch,
    spread: spreiding,
    regular: spreiding <= MAX_SPREAD_DAYS,
    note: spreiding <= MAX_SPREAD_DAYS
      ? `Je cycli duren ${Math.min(...lengtes)}–${Math.max(...lengtes)} dagen, mediaan ${typisch}. Regelmatig genoeg om met fasen te rekenen.`
      : `Je cycli lopen uiteen van ${Math.min(...lengtes)} tot ${Math.max(...lengtes)} dagen (${spreiding} dagen verschil). Dat is te variabel voor een betrouwbare fase-indeling — en dat past bij de perimenopauze. Er wordt hier geen fase geraden.`,
  };
}

// Fase-indeling binnen één cyclus, gerekend vanaf het einde.
export function phaseOfDay(day, length) {
  if (!day || !length || length < 15) return PHASE.UNKNOWN;
  if (day <= 5) return PHASE.MENSTRUAL;
  if (day > length - 5) return PHASE.LATE_LUTEAL;
  if (day > length - 11) return PHASE.MID_LUTEAL;
  if (day > length - 16) return PHASE.OVULATORY;
  return PHASE.FOLLICULAR;
}

// Waar viel deze datum in de cyclus? Met de zekerheid erbij.
export function cyclePosition(datum, { asOf = todayLocal() } = {}) {
  const { closed, current } = cycles({ asOf });
  const alle = current ? [...closed, current] : closed;
  const hoort = alle.filter(c => datum >= c.start && (!c.end || datum <= asOf)).pop();
  if (!hoort) {
    return { known: false, day: null, phase: PHASE.UNKNOWN,
      note: 'Deze datum ligt vóór je eerste geregistreerde menstruatie.' };
  }
  const dag = daysBetween(hoort.start, datum) + 1;
  const reg = cycleRegularity({ asOf });

  // Afgesloten cyclus: de echte lengte is bekend, dus de fase ook.
  if (hoort.closed) {
    return { known: true, day: dag, cycleStart: hoort.start, length: hoort.length,
      phase: phaseOfDay(dag, hoort.length), certainty: 'gemeten',
      note: `Cyclusdag ${dag} van een cyclus die ${hoort.length} dagen duurde.` };
  }

  // Lopende cyclus: de lengte is nog niet bekend. Schatten mag alleen als je
  // cycli regelmatig genoeg zijn — anders is de fase onbekend (§18).
  if (!reg.known || !reg.regular) {
    return { known: true, day: dag, cycleStart: hoort.start, length: null,
      phase: PHASE.UNKNOWN, certainty: 'onbekend',
      note: `Cyclusdag ${dag}. ${reg.note} Zolang dat zo is, staat er geen fase — een geraden fase is erger dan geen fase.` };
  }
  return { known: true, day: dag, cycleStart: hoort.start,
    length: reg.typicalLength, estimated: true,
    phase: phaseOfDay(dag, reg.typicalLength), certainty: 'geschat',
    note: `Cyclusdag ${dag}, fase geschat op je eigen mediane cycluslengte van ${reg.typicalLength} dagen (${reg.n} cycli, spreiding ${reg.spread}).` };
}

// ── Patronen leren ──────────────────────────────────────────────
// De vier niveaus uit §17. Ze zijn bewust grof: het verschil tussen
// "aanwijzing" en "sterk herhaald patroon" moet je in taal kunnen horen.
export const PATTERN_CONFIDENCE = {
  NONE: 'onvoldoende data',
  HINT: 'aanwijzing',
  LIKELY: 'waarschijnlijk persoonlijk patroon',
  STRONG: 'sterk herhaald patroon',
};

const CONF_RANK = [PATTERN_CONFIDENCE.NONE, PATTERN_CONFIDENCE.HINT,
  PATTERN_CONFIDENCE.LIKELY, PATTERN_CONFIDENCE.STRONG];

// Elke maat die met de cyclus mee kan bewegen. De lijst komt uit §16.
export const CYCLE_METRICS = [
  { id: 'weight', label: 'gewicht', unit: 'kg', decimals: 1 },
  { id: 'navel', label: 'navelomtrek', unit: 'cm', decimals: 1 },
  { id: 'waist', label: 'taille', unit: 'cm', decimals: 1 },
  { id: 'hr_rest', label: 'rusthartslag', unit: 'bpm', decimals: 0 },
  { id: 'sleep_hours', label: 'slaap', unit: 'u', decimals: 1 },
  { id: 'energy', label: 'energie', unit: '', decimals: 1 },
  { id: 'bloating', label: 'opgeblazen gevoel', unit: '', decimals: 1 },
  { id: 'puffiness', label: 'vocht in het gezicht', unit: '', decimals: 1 },
  { id: 'hot_flashes', label: 'opvliegers', unit: '', decimals: 1 },
  { id: 'night_sweats', label: 'nachtzweten', unit: '', decimals: 1 },
  { id: 'cravings', label: 'cravings', unit: '', decimals: 1 },
  { id: 'heavy_legs', label: 'zware benen', unit: '', decimals: 1 },
  { id: 'breast_tenderness', label: 'gevoelige borsten', unit: '', decimals: 1 },
];

// Waarnemingen van één maat, elk met de cyclusfase waarin ze vielen.
// Alleen afgesloten cycli tellen mee: daar is de lengte gemeten en dus de
// fase-indeling betrouwbaar.
export function observationsByPhase(metric, { asOf = todayLocal(), points = null } = {}) {
  const { closed } = cycles({ asOf });
  if (!closed.length) return { known: false, cycles: 0, rows: [] };

  const waarnemingen = points
    ? points.filter(p => typeof p.value === 'number')
    : series(metric, { asOf })
      .filter(o => typeof o.value === 'number')
      .map(o => ({ date: o.observedAt, value: o.value }));

  const rijen = [];
  for (const c of closed) {
    for (const w of waarnemingen) {
      if (w.date < c.start || w.date > c.end) continue;
      const dag = daysBetween(c.start, w.date) + 1;
      rijen.push({ ...w, cycle: c.start, cycleLength: c.length,
        day: dag, phase: phaseOfDay(dag, c.length) });
    }
  }
  return { known: rijen.length > 0, cycles: closed.length, rows: rijen };
}

// Het patroon zelf: wijkt één fase stelselmatig af van de rest van de cyclus?
//
// Per cyclus wordt het gemiddelde ín de fase vergeleken met het gemiddelde
// buiten die fase. Zo telt niet mee dat je in maart zwaarder was dan in juni —
// elke cyclus is zijn eigen referentie.
export function phasePattern(metric, phase, { asOf = todayLocal(), points = null } = {}) {
  const obs = observationsByPhase(metric, { asOf, points });
  const meta = CYCLE_METRICS.find(m => m.id === metric) || { label: metric, unit: '', decimals: 1 };

  if (!obs.known) {
    return { known: false, confidence: PATTERN_CONFIDENCE.NONE, cycles: 0,
      note: `Nog geen ${meta.label}-metingen binnen een afgesloten cyclus.` };
  }

  const perCyclus = [];
  const perCycleGroups = new Map();
  for (const r of obs.rows) {
    if (!perCycleGroups.has(r.cycle)) perCycleGroups.set(r.cycle, []);
    perCycleGroups.get(r.cycle).push(r);
  }
  for (const [start, rijen] of perCycleGroups) {
    const inFase = rijen.filter(r => r.phase === phase).map(r => r.value);
    const erbuiten = rijen.filter(r => r.phase !== phase).map(r => r.value);
    if (!inFase.length || !erbuiten.length) continue;
    const dagen = rijen.filter(r => r.phase === phase).map(r => r.day);
    perCyclus.push({
      cycle: start,
      cycleLength: rijen[0].cycleLength,
      inPhase: rond(gem(inFase), 2), outside: rond(gem(erbuiten), 2),
      delta: rond(gem(inFase) - gem(erbuiten), 2),
      dayRange: [Math.min(...dagen), Math.max(...dagen)],
      n: inFase.length,
    });
  }

  if (perCyclus.length < 2) {
    return { known: false, confidence: PATTERN_CONFIDENCE.NONE,
      cycles: perCyclus.length, perCycle: perCyclus,
      note: perCyclus.length
        ? `Eén cyclus met ${meta.label} in en buiten de fase ${phase}. Eén cyclus is geen patroon.`
        : `Nog geen cyclus waarin ${meta.label} zowel in als buiten de fase ${phase} gemeten is.` };
  }

  const richtingen = perCyclus.map(c => Math.sign(c.delta));
  const consistent = richtingen.every(r => r === richtingen[0] && r !== 0);
  const gemiddeld = rond(gem(perCyclus.map(c => c.delta)), 2);

  if (!consistent) {
    return { known: false, confidence: PATTERN_CONFIDENCE.NONE,
      cycles: perCyclus.length, perCycle: perCyclus, meanDelta: gemiddeld,
      note: `Over ${perCyclus.length} cycli wisselt de richting van je ${meta.label} in de fase ${phase}. Dat is variatie, geen patroon.` };
  }

  // Hoe zwaar telt dit? Het aantal herhalingen, en of het effect groter is
  // dan je gewone ruis.
  const band = personalBandwidth(metric, { asOf, days: 365 });
  const buitenRuis = band.known ? Math.abs(gemiddeld) > band.band : null;
  let vertrouwen = PATTERN_CONFIDENCE.HINT;
  if (perCyclus.length >= 3) vertrouwen = PATTERN_CONFIDENCE.LIKELY;
  if (perCyclus.length >= 4 && buitenRuis === true) vertrouwen = PATTERN_CONFIDENCE.STRONG;
  // Binnen je eigen ruis blijft het een aanwijzing, hoe vaak het zich ook
  // herhaalt: een verschil dat in je normale schommeling past, is geen
  // hormonaal signaal maar variatie die toevallig dezelfde kant op viel.
  if (buitenRuis === false) vertrouwen = PATTERN_CONFIDENCE.HINT;

  const dagVan = Math.min(...perCyclus.map(c => c.dayRange[0]));
  const dagTot = Math.max(...perCyclus.map(c => c.dayRange[1]));
  const omhoog = richtingen[0] > 0;
  const grootte = `${Math.abs(gemiddeld).toFixed(meta.decimals)}${meta.unit ? ' ' + meta.unit : ''}`;

  return {
    known: true,
    confidence: vertrouwen,
    metric, phase,
    cycles: perCyclus.length,
    perCycle: perCyclus,
    meanDelta: gemiddeld,
    direction: omhoog ? 'hoger' : 'lager',
    dayRange: [dagVan, dagTot],
    beyondNoise: buitenRuis,
    band: band.known ? band.band : null,
    // De zin uit §16: concreet, met het aantal cycli en de eigen dagen erin.
    note: `In ${perCyclus.length} cycli lag je ${meta.label} rond cyclusdag ${dagVan}–${dagTot} gemiddeld ${grootte} ${omhoog ? 'hoger' : 'lager'} dan in de rest van je cyclus (${vertrouwen}${buitenRuis === false ? `, maar binnen je normale schommeling van ±${band.band}` : ''}).`,
  };
}

// Alles doorzoeken: welke maten laten in welke fase een patroon zien?
export function learnedPatterns({ asOf = todayLocal(), minConfidence = PATTERN_CONFIDENCE.HINT } = {}) {
  const drempel = CONF_RANK.indexOf(minConfidence);
  const gevonden = [];
  const overwogen = [];

  // pace@HR komt niet uit de tijdlijn maar uit de loopanalyse: het is een
  // afgeleide van tempo én hartslag samen, en alleen zinvol voor sessies waar
  // die twee te scheiden waren.
  const econ = runEconomyTrend({ currentDate: asOf });
  const pacePunten = econ.enough
    ? econ.points.map(p => ({ date: p.date, value: p.runPace })) : null;

  const teOnderzoeken = [
    ...CYCLE_METRICS.map(m => ({ id: m.id, points: null })),
    ...(pacePunten ? [{ id: 'run_pace_at_hr', points: pacePunten }] : []),
  ];

  for (const m of teOnderzoeken) {
    for (const fase of PHASE_ORDER) {
      const p = phasePattern(m.id, fase, { asOf, points: m.points });
      overwogen.push({ metric: m.id, phase: fase, confidence: p.confidence, cycles: p.cycles });
      if (p.known && CONF_RANK.indexOf(p.confidence) >= drempel) gevonden.push(p);
    }
  }

  gevonden.sort((a, b) =>
    CONF_RANK.indexOf(b.confidence) - CONF_RANK.indexOf(a.confidence) ||
    Math.abs(b.meanDelta) - Math.abs(a.meanDelta));

  // Spiegelbeelden wegstrepen.
  //
  // Dit vond een test die ik verkeerd had geschreven, maar het probleem was
  // echt: als je gewicht in de laatluteale fase hoger is dan in de rest van
  // je cyclus, dan is het in de folliculaire fase per definitie lager dan in
  // de rest. Dat zijn niet twee patronen maar één feit, twee keer gezegd.
  //
  // Een coach die beide opsomt, klinkt alsof hij twee dingen weet. Daarom
  // per maat alleen het sterkste patroon, met de tegenhanger als voetnoot.
  const perMaat = new Map();
  for (const p of gevonden) {
    const bestaand = perMaat.get(p.metric);
    if (!bestaand) { perMaat.set(p.metric, { ...p, mirrors: [] }); continue; }
    bestaand.mirrors.push({ phase: p.phase, meanDelta: p.meanDelta, direction: p.direction });
  }
  const uniek = [...perMaat.values()];
  uniek.sort((a, b) =>
    CONF_RANK.indexOf(b.confidence) - CONF_RANK.indexOf(a.confidence) ||
    Math.abs(b.meanDelta) - Math.abs(a.meanDelta));

  const reg = cycleRegularity({ asOf });
  return {
    known: uniek.length > 0,
    patterns: uniek,
    allPhaseHits: gevonden.length,
    considered: overwogen.length,
    regularity: reg,
    note: uniek.length
      ? `${uniek.length} patroon/patronen gevonden in je eigen data.`
      : `Nog geen herhaalde patronen. ${reg.known ? `Er zijn ${reg.n} afgesloten cycli.` : reg.note}`,
  };
}

// ── Persoonlijke fluctuatieranges (§20) ─────────────────────────
// Niet "vrouwen schommelen 1–2 kg" maar wat jóuw reeks laat zien. En binnen
// cycluscontext, want de vraag is meestal niet "hoeveel varieer ik" maar
// "hoeveel varieer ik zónder dat er iets structureels aan de hand is".
export const RANGE_METRICS = ['weight', 'navel', 'waist', 'hr_rest',
  'sleep_hours', 'energy', 'bloating'];

export function fluctuationRanges({ asOf = todayLocal(), days = 180 } = {}) {
  const uit = {};
  for (const m of RANGE_METRICS) {
    const b = personalBandwidth(m, { asOf, days });
    const meta = CYCLE_METRICS.find(x => x.id === m) || { label: m, unit: '', decimals: 1 };
    if (!b.known) { uit[m] = { known: false, label: meta.label, note: b.note }; continue; }
    // De bandbreedte is eenzijdig; wat je in de praktijk ziet is dal tot piek.
    const laag = rond(b.band, meta.decimals);
    const hoog = rond(b.band * 1.5, meta.decimals);
    uit[m] = {
      known: true, label: meta.label, unit: meta.unit,
      n: b.n, mean: b.mean, band: b.band,
      typicalRange: [laag, hoog],
      note: `Je ${meta.label} schommelt normaal ongeveer ${laag}–${hoog}${meta.unit ? ' ' + meta.unit : ''} (uit ${b.n} metingen).`,
    };
  }

  // pace@HR apart, want die komt uit de loopanalyse.
  const econ = runEconomyTrend({ currentDate: asOf });
  uit.run_pace_at_hr = econ.enough
    ? { known: true, label: 'looptempo bij dezelfde hartslag', unit: 'sec/km',
      n: econ.count, drift: econ.hrDrift, gainSec: econ.gainSec,
      note: econ.verdict }
    : { known: false, label: 'looptempo bij dezelfde hartslag', note: econ.note };

  return uit;
}

// ── Vergelijken met dezelfde cycluscontext (§19) ────────────────
// De vergelijking waar het om draait: niet "ten opzichte van vorige week"
// maar "ten opzichte van dezelfde plek in eerdere cycli". Dat is de enige
// vergelijking waarin een hormonale piek zichzelf wegdeelt.
export const SAME_PHASE_WINDOW = 3;

export function sameContextComparison(metric, { asOf = todayLocal() } = {}) {
  const pos = cyclePosition(asOf, { asOf });
  const meta = CYCLE_METRICS.find(m => m.id === metric) || { label: metric, unit: '', decimals: 1 };
  const nu = latest(metric, { asOf });

  if (!pos.known || pos.day == null) {
    return { known: false, label: meta.label,
      note: 'Geen menstruatiedata rond deze datum, dus geen hormonaal vergelijkbaar moment.' };
  }
  if (nu?.value == null) {
    return { known: false, label: meta.label, currentCycleDay: pos.day,
      note: `Geen actuele ${meta.label}-meting om te vergelijken.` };
  }

  // Alle eerdere waarnemingen op ongeveer dezelfde cyclusdag, uit afgesloten
  // cycli. Per cyclus het gemiddelde, zodat één cyclus met vijf metingen niet
  // vijf keer meetelt.
  const obs = observationsByPhase(metric, { asOf });
  const dichtbij = obs.rows.filter(r => Math.abs(r.day - pos.day) <= SAME_PHASE_WINDOW);
  const perCyclus = new Map();
  for (const r of dichtbij) {
    if (!perCyclus.has(r.cycle)) perCyclus.set(r.cycle, []);
    perCyclus.get(r.cycle).push(r.value);
  }
  const punten = [...perCyclus.entries()]
    .map(([cyclus, waarden]) => ({ cycle: cyclus, value: rond(gem(waarden), 2), n: waarden.length }));

  if (!punten.length) {
    return { known: false, label: meta.label, currentCycleDay: pos.day, current: nu.value,
      note: `Nog geen eerdere ${meta.label}-meting rond cyclusdag ${pos.day}. Die vergelijking ontstaat vanzelf als je dit volhoudt.` };
  }

  const toen = gem(punten.map(p => p.value));
  const verschil = rond(nu.value - toen, 2);

  // Ter contrast: de kale vergelijking met een week terug — het beeld dat
  // zonder cycluscontext op het scherm zou staan.
  const weekTerug = series(metric, { asOf: addDays(asOf, -5) })
    .filter(o => typeof o.value === 'number' && o.observedAt >= addDays(asOf, -10));
  const vorigeWeek = weekTerug.length ? weekTerug[weekTerug.length - 1] : null;
  const weekDelta = vorigeWeek ? rond(nu.value - vorigeWeek.value, 2) : null;

  return {
    known: true,
    label: meta.label, unit: meta.unit,
    currentCycleDay: pos.day, phase: pos.phase, phaseCertainty: pos.certainty,
    current: nu.value,
    comparableMean: rond(toen, 2),
    delta: verschil,
    cycles: punten.length,
    samples: punten,
    weekDelta,
    // Het onderscheid dat §19 vraagt: de twee vergelijkingen kunnen tegen
    // elkaar in wijzen, en dan wint de hormonaal vergelijkbare.
    contradicts: weekDelta != null && Math.sign(weekDelta) !== Math.sign(verschil) &&
      weekDelta !== 0 && verschil !== 0,
    note: `Rond cyclusdag ${pos.day} was je ${meta.label} in ${punten.length} eerdere cyclus/cycli gemiddeld ${rond(toen, meta.decimals)}${meta.unit ? ' ' + meta.unit : ''}; nu ${nu.value}${meta.unit ? ' ' + meta.unit : ''} (${verschil > 0 ? '+' : ''}${verschil}).`,
  };
}

// De coachtekst uit §19: eerst wat de kale weekvergelijking zegt, dan wat de
// hormonaal vergelijkbare vergelijking zegt, en welke van de twee je hier
// moet geloven.
export function cycleContextNarrative({ asOf = todayLocal(),
  metrics = ['weight', 'navel', 'waist'] } = {}) {
  const delen = [];
  const vergelijkingen = {};
  let tegenspraak = false;

  for (const m of metrics) {
    const c = sameContextComparison(m, { asOf });
    vergelijkingen[m] = c;
    if (!c.known) continue;
    if (c.contradicts) tegenspraak = true;
    delen.push(c);
  }

  if (!delen.length) {
    return { known: false, comparisons: vergelijkingen,
      text: 'Er is nog geen hormonaal vergelijkbaar moment om naast vandaag te leggen. Zolang dat zo is, blijft elke uitspraak over "voller" of "strakker" een vergelijking met vorige week — en die zegt in de tweede cyclushelft weinig.' };
  }

  const week = delen.filter(d => d.weekDelta != null);
  const zinnen = [];
  if (week.length) {
    zinnen.push(`Ten opzichte van een week terug: ${week.map(d =>
      `${d.label} ${d.weekDelta > 0 ? '+' : ''}${d.weekDelta}${d.unit ? ' ' + d.unit : ''}`).join(', ')}.`);
  }
  zinnen.push(`Ten opzichte van eerdere check-ins rond dezelfde cyclusdagen: ${delen.map(d =>
    `${d.label} ${d.delta > 0 ? '+' : ''}${d.delta}${d.unit ? ' ' + d.unit : ''}`).join(', ')}.`);
  if (tegenspraak) {
    zinnen.push('Die twee wijzen niet dezelfde kant op. De vergelijking met dezelfde cyclusdagen is hier de betrouwbaardere: daarin deelt de hormonale piek zichzelf weg.');
  }

  return {
    known: true,
    comparisons: vergelijkingen,
    contradicts: tegenspraak,
    cycleDay: delen[0].currentCycleDay,
    phase: delen[0].phase,
    text: zinnen.join(' '),
  };
}

// ── Alles bij elkaar, voor de context en de UI ──────────────────
export function cycleIntelligence({ asOf = todayLocal() } = {}) {
  const positie = cyclePosition(asOf, { asOf });
  const reg = cycleRegularity({ asOf });
  const patronen = learnedPatterns({ asOf });
  return {
    position: positie,
    regularity: reg,
    patterns: patronen,
    ranges: fluctuationRanges({ asOf }),
    narrative: cycleContextNarrative({ asOf }),
    // De enige samenvattende zin die je zonder voorbehoud mag lezen.
    headline: !positie.known
      ? 'Geen cyclusdata vastgelegd.'
      : positie.phase === PHASE.UNKNOWN
        ? `Cyclusdag ${positie.day}, fase onbekend. ${reg.note}`
        : `Cyclusdag ${positie.day}, ${positie.phase} (${positie.certainty}).`,
  };
}
