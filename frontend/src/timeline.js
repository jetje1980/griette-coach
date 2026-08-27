// Eén tijdlijn over alles wat er is.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT EEN PROJECTIE IS EN GEEN MIGRATIE
//
// De opdracht vraagt om één samenhangende tijdlijn (§7) en laat de technische
// vorm vrij, zolang de coach maar niets mist, historie kan reconstrueren,
// observaties op datum kan combineren en trends opnieuw kan berekenen.
//
// De verleiding is om alles naar één nieuwe store te verhuizen. Dat zou een
// eenmalige migratie zijn van zeventien bestaande sleutels waar al echte data
// in zit — haar daglogs sinds januari, haar workouts, haar metingen. Elke fout
// daarin is dataverlies, en de winst is architectonisch, niet functioneel.
//
// Dit bestand doet het andersom: het leest de bestaande stores en projecteert
// ze op één observatiestroom. Dat levert precies wat de opdracht vraagt, en
// het heeft drie eigenschappen die een migratie niet had:
//
//   · backfill werkt vanzelf. Wie via het bestaande scherm een meting van
//     2 augustus invoert, staat meteen in de tijdlijn — er is geen tweede
//     schrijfpad dat achter kan lopen (§6, §43).
//   · niets kan verloren gaan. De bron blijft de bron (§40).
//   · as-of-date en future leakage zijn gratis: filteren gebeurt bij het
//     lezen, dus een analyse van 10 augustus kán niets van 20 augustus zien
//     omdat die observaties er simpelweg uit gefilterd zijn (§41, §42).
//
// Wat een projectie níet oplost is metadata die in de bron ontbreekt. Daarom
// draagt elke observatie een `observedAt` én, waar bekend, een `source` en een
// `certainty`. Waar de bron niets zegt, staat er `unknown` — nooit een aanname
// (§40).
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';

// De domeinen waarin de coach denkt. Elke observatie hoort bij precies één.
export const DOMAIN = {
  BODY: 'body',            // gewicht, maten, foto's
  TRAINING: 'training',    // hardlopen, kracht, overige sessies
  RECOVERY: 'recovery',    // slaap, hartslag, energie, symptomen, respons
  CYCLE: 'cycle',          // menstruatie, hormonale signalen
  CONTEXT: 'context',      // stress, warmte, alcohol, notities
};

export const CERTAINTY = {
  MEASURED: 'measured',    // een meting met bekende condities
  REPORTED: 'reported',    // door haar ingevuld
  DERIVED: 'derived',      // door de app afgeleid
  UNCERTAIN: 'uncertain',  // bekend, maar met een voorbehoud in de metadata
};

// ── Lezen zonder te struikelen ──────────────────────────────────
function lees(key, terug) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? terug;
  } catch { return terug; }
}

function alleDaglogs() {
  const uit = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('gc_log_')) continue;
      const l = lees(k, null);
      if (l?.date) uit.push(l);
    }
  } catch { /* opslag niet beschikbaar */ }
  return uit.sort((a, b) => a.date.localeCompare(b.date));
}

function obs(o) {
  return {
    observedAt: o.observedAt,
    domain: o.domain,
    metric: o.metric,
    value: o.value,
    unit: o.unit ?? null,
    source: o.source || 'manual',
    certainty: o.certainty || CERTAINTY.REPORTED,
    meta: o.meta || null,
  };
}

// ── De projectie ────────────────────────────────────────────────
// Elke bron levert observaties met een datum. Meer is het niet — en dat is
// precies genoeg om alles wat verderop gebeurt op te kunnen bouwen.

function uitDaglogs() {
  const uit = [];
  for (const l of alleDaglogs()) {
    const d = l.date;
    const push = (domain, metric, value, extra = {}) => {
      if (value === undefined || value === null || value === '') return;
      uit.push(obs({ observedAt: d, domain, metric, value, source: 'daglog', ...extra }));
    };

    push(DOMAIN.BODY, 'weight', num(l.weight), { unit: 'kg', certainty: CERTAINTY.MEASURED });

    push(DOMAIN.RECOVERY, 'sleep_hours', num(l.sleep_hours), { unit: 'u' });
    push(DOMAIN.RECOVERY, 'sleep_quality', num(l.sleep_quality));
    push(DOMAIN.RECOVERY, 'energy', num(l.energy));
    push(DOMAIN.RECOVERY, 'hr_rest', num(l.hr_rest), { unit: 'bpm', certainty: CERTAINTY.MEASURED });
    push(DOMAIN.RECOVERY, 'training_recovery', num(l.training_recovery));
    push(DOMAIN.RECOVERY, 'recovery_check', l.recovery_check);
    push(DOMAIN.RECOVERY, 'headache_severity', num(l.headache_severity));
    push(DOMAIN.RECOVERY, 'day_capacity', l.day_capacity);
    push(DOMAIN.RECOVERY, 'steps', num(l.steps), { certainty: CERTAINTY.MEASURED });

    for (const s of ['pem', 'exhaustion', 'breathless', 'brainfog', 'pain', 'headache', 'hayfever'])
      if (l[`symptom_${s}`]) push(DOMAIN.RECOVERY, `symptom_${s}`, true);
    for (const s of ['fatigue', 'brainfog', 'breathless'])
      if (l[`delayed_${s}`]) push(DOMAIN.RECOVERY, `delayed_${s}`, true);

    // Cyclus en perimenopauze. Deze velden bestonden al in de daglog maar
    // bereikten de coach maar half; hier krijgen ze een eigen domein zodat ze
    // met vergelijkbare cyclusdagen te vergelijken zijn (§26).
    if (l.menstruation_start) push(DOMAIN.CYCLE, 'menstruation_start', true);
    for (const m of ['bloating', 'puffiness', 'breast_tenderness', 'cravings',
      'hot_flashes', 'night_sweats', 'heavy_legs', 'mood'])
      push(DOMAIN.CYCLE, m, l[m]);

    push(DOMAIN.CONTEXT, 'notes', l.notes);
    push(DOMAIN.CONTEXT, 'stress_high', l.low_stress === 0 || l.low_stress === false ? true : null);
    push(DOMAIN.CONTEXT, 'alcohol', l.alcohol);

    // Trainingsvinkjes: de sessie zelf komt uit gc_workouts, maar het vinkje
    // zegt of er die dag belasting was.
    for (const [k, m] of [['run_done', 'run'], ['strength_done', 'strength'],
      ['core_done', 'core'], ['swim_done', 'swim'], ['bike_done', 'bike']])
      if (l[k]) push(DOMAIN.TRAINING, `${m}_done`, true);
    push(DOMAIN.TRAINING, 'swim_duration', num(l.swim_duration), { unit: 'min' });
    push(DOMAIN.TRAINING, 'bike_duration', num(l.bike_duration), { unit: 'min' });
  }
  return uit;
}

function uitMetingen() {
  const uit = [];
  for (const m of lees('gc_measurements', [])) {
    if (!m?.date) continue;
    const push = (metric, value, extra = {}) => {
      if (value == null) return;
      uit.push(obs({ observedAt: m.date, domain: DOMAIN.BODY, metric, value,
        unit: 'cm', source: 'measurement', certainty: CERTAINTY.MEASURED, ...extra }));
    };
    // De historische taillewaarde is niet betrouwbaar gelabeld: het is niet
    // meer zeker of het de natuurlijke taille of de navelomtrek was. Die
    // onzekerheid reist mee in plaats van dat er een aanname van wordt
    // gemaakt (§1).
    push('waist', num(m.waist), m.waistLocation ? { meta: { location: m.waistLocation } } : {
      certainty: m.navel == null ? CERTAINTY.UNCERTAIN : CERTAINTY.MEASURED,
      meta: m.navel == null ? { location: 'unknown',
        note: 'Vóór de splitsing taille/navel is niet vastgelegd op welke hoogte gemeten is.' } : null,
    });
    push('navel', num(m.navel));
    push('hip', num(m.hip));
    push('chest', num(m.chest));
    push('arm', num(m.arm));
    push('thigh', num(m.thigh));
    if (m.weight != null) {
      uit.push(obs({ observedAt: m.date, domain: DOMAIN.BODY, metric: 'weight',
        value: num(m.weight), unit: 'kg', source: 'measurement',
        certainty: CERTAINTY.MEASURED }));
    }
  }
  return uit;
}

function uitWorkouts() {
  const uit = [];
  for (const w of lees('gc_workouts', [])) {
    if (!w?.date) continue;
    const basis = { observedAt: w.date, domain: DOMAIN.TRAINING,
      source: w.source || 'manual', certainty: CERTAINTY.MEASURED,
      meta: { workoutId: w.id, activityType: w.activityType || 'run' } };
    const push = (metric, value, unit = null) => {
      if (value == null) return;
      uit.push(obs({ ...basis, metric, value, unit }));
    };
    push('distance', num(w.distance), 'km');
    push('duration', num(w.duration), 'min');
    push('avg_hr', num(w.averageHR), 'bpm');
    push('max_hr', num(w.maxHR), 'bpm');
    push('rpe', num(w.rpe));
    push('legs', w.legs);
    push('could_do_more', w.couldDoMore);
    push('completed_as_planned', w.completedAsPlanned);
  }
  return uit;
}

function uitKracht() {
  const uit = [];
  for (const s of lees('gc_strength_sessions', [])) {
    if (!s?.date) continue;
    const volume = (s.exercises || []).reduce((v, e) =>
      v + (parseFloat(e.weight) || 0) * (parseInt(e.sets, 10) || 0) * (parseInt(e.reps, 10) || 0), 0);
    uit.push(obs({ observedAt: s.date, domain: DOMAIN.TRAINING, metric: 'strength_volume',
      value: Math.round(volume), unit: 'kg', source: 'strength',
      certainty: CERTAINTY.DERIVED, meta: { program: s.program || null } }));
    for (const e of (s.exercises || [])) {
      if (!e?.name) continue;
      uit.push(obs({ observedAt: s.date, domain: DOMAIN.TRAINING, metric: 'strength_lift',
        value: num(e.weight), unit: 'kg', source: 'strength', certainty: CERTAINTY.MEASURED,
        meta: { exercise: e.name, sets: e.sets ?? null, reps: e.reps ?? null } }));
    }
  }
  return uit;
}

function uitCyclus() {
  const uit = [];
  for (const c of lees('gc_cycle_history', [])) {
    const d = c?.start || c?.date;
    if (!d) continue;
    uit.push(obs({ observedAt: d, domain: DOMAIN.CYCLE, metric: 'menstruation_start',
      value: true, source: 'cycle', certainty: CERTAINTY.REPORTED,
      meta: c.length != null ? { cycleLength: c.length } : null }));
  }
  const start = lees('gc_cycle_start', null);
  if (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    uit.push(obs({ observedAt: start, domain: DOMAIN.CYCLE, metric: 'menstruation_start',
      value: true, source: 'cycle', certainty: CERTAINTY.REPORTED }));
  }
  return uit;
}

function uitFotos() {
  // De observaties staan als object per datum, met de losse waarnemingen
  // erbinnen — niet als lijst. Dat was mijn eerste aanname, en die was fout.
  const uit = [];
  const perDatum = lees('gc_photo_observations', {});
  if (!perDatum || typeof perDatum !== 'object') return uit;

  for (const [datum, waarnemingen] of Object.entries(perDatum)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !waarnemingen) continue;
    const paren = Object.entries(waarnemingen)
      .filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (!paren.length) continue;
    uit.push(obs({ observedAt: datum, domain: DOMAIN.BODY, metric: 'photo_observation',
      value: paren.map(([k, v]) => `${k}: ${v}`).join(' · '),
      source: 'photo', certainty: CERTAINTY.REPORTED,
      meta: { fields: paren.map(([k]) => k) } }));
  }
  return uit;
}

// Vergelijkingen waarbij het model de beelden werkelijk gezien heeft.
//
// Deze staan bewust náást photo_observation en niet ermee vermengd: het ene
// is een herinnering aan wat zij zag, het andere een vergelijking van de
// beelden zelf. Het onderscheid zit in de metric én in `method`, zodat het
// verderop niet per ongeluk op één hoop belandt.
function uitFotoAnalyses() {
  const uit = [];
  const rijen = lees('gc_photo_analyses', []);
  if (!Array.isArray(rijen)) return uit;

  for (const r of rijen) {
    if (!r?.to || !/^\d{4}-\d{2}-\d{2}$/.test(r.to)) continue;
    const velden = r.fields && typeof r.fields === 'object' ? r.fields : {};
    const paren = Object.entries(velden).filter(([, v]) => v);
    if (!paren.length) continue;
    uit.push(obs({
      observedAt: r.to, domain: DOMAIN.BODY, metric: 'photo_comparison',
      value: paren.map(([k, v]) => `${k}: ${v}`).join(' · '),
      source: r.method === 'visual' ? 'vision-model' : (r.method || 'unknown'),
      // Een modelwaarneming is geen meting. Zij is bekend, met voorbehoud —
      // en dat voorbehoud is precies de vergelijkbaarheid.
      certainty: CERTAINTY.UNCERTAIN,
      meta: {
        track: r.track || null, from: r.from || null,
        confidence: r.confidence || null,
        notVisible: r.notVisible || [],
        model: r.model || null,
        summary: r.summary || null,
      },
    }));
  }
  return uit;
}

function uitOverrides() {
  const uit = [];
  for (const o of lees('gc_overrides', [])) {
    if (!o?.date) continue;
    uit.push(obs({ observedAt: o.date, domain: DOMAIN.TRAINING, metric: 'user_override',
      value: o.status || 'PLANNED', source: 'override', certainty: CERTAINTY.REPORTED,
      meta: { coachAdvies: o.originalCoachDecision || null } }));
  }
  return uit;
}

const num = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// ── De volledige stroom ─────────────────────────────────────────
// Bewust niet gecachet. Een cache zou na backfill of correctie ongeldig zijn,
// en dan heb je precies het probleem terug dat §43 beschrijft: een advies dat
// op verouderde data steunt. Dit is goedkoop genoeg om elke keer te doen.
export function timeline({ asOf = null, domains = null, since = null } = {}) {
  let alles = [
    ...uitDaglogs(), ...uitMetingen(), ...uitWorkouts(),
    ...uitKracht(), ...uitCyclus(), ...uitFotos(), ...uitFotoAnalyses(),
    ...uitOverrides(),
  ];

  // As-of-date. Dit is de hele bescherming tegen future leakage: wie de wereld
  // van 10 augustus opvraagt, krijgt niets wat na 10 augustus is waargenomen —
  // ook niet als het gisteren is ingevoerd (§41, §42).
  if (asOf) alles = alles.filter(o => o.observedAt <= asOf);
  if (since) alles = alles.filter(o => o.observedAt >= since);
  if (domains) {
    const set = new Set(Array.isArray(domains) ? domains : [domains]);
    alles = alles.filter(o => set.has(o.domain));
  }

  return alles.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}

// Alle waarnemingen van één meetwaarde, oplopend in tijd.
export function series(metric, { asOf = null, since = null } = {}) {
  return timeline({ asOf, since }).filter(o => o.metric === metric);
}

export function latest(metric, { asOf = null } = {}) {
  const s = series(metric, { asOf });
  return s.length ? s[s.length - 1] : null;
}

// ── Trends ──────────────────────────────────────────────────────
// Alles wordt uit de stroom herberekend, dus een correctie of een backfill
// werkt onmiddellijk door (§6).
export function rollingMean(metric, days, { asOf = todayLocal() } = {}) {
  const vanaf = addDays(asOf, -(days - 1));
  const waarden = series(metric, { asOf, since: vanaf })
    .map(o => o.value).filter(v => typeof v === 'number');
  if (!waarden.length) return null;
  return +(waarden.reduce((a, b) => a + b, 0) / waarden.length).toFixed(2);
}

// De verandering over een venster, met het aantal metingen erbij: twee punten
// is geen trend, en dat hoort de lezer te weten.
export function trend(metric, days, { asOf = todayLocal() } = {}) {
  // Let op het verschil met rollingMean hierboven: een gemiddelde over zeven
  // dagen telt zeven dagen inclusief vandaag, maar een verandering óver 28
  // dagen heeft twee eindpunten nodig die 28 dagen uit elkaar liggen — dus
  // 29 kalenderdagen.
  //
  // Dit stond eerst als -(days - 1), en dat kostte precies het punt dat je
  // nodig hebt: wie elke vier weken haar taille meet, had de vorige meting
  // altijd één dag buiten het venster staan. De 4-wekentrend op maten was
  // daardoor structureel "één meting is geen trend".
  const vanaf = addDays(asOf, -days);
  const s = series(metric, { asOf, since: vanaf }).filter(o => typeof o.value === 'number');
  if (s.length < 2) {
    return { available: false, n: s.length,
      reason: s.length ? 'één meting is geen trend' : 'geen metingen in dit venster' };
  }
  const eerste = s[0], laatste = s[s.length - 1];
  const delta = +(laatste.value - eerste.value).toFixed(2);
  const weken = Math.max(1, days / 7);
  return {
    available: true, n: s.length,
    from: eerste.value, to: laatste.value,
    fromDate: eerste.observedAt, toDate: laatste.observedAt,
    delta, perWeek: +(delta / weken).toFixed(3),
    unit: laatste.unit || null,
  };
}

// ── Datacompleteness ────────────────────────────────────────────
// "Geen probleem gemeten" is iets anders dan "geen gegevens" (§44). Deze
// functie levert dat onderscheid, zodat een advies nooit stilzwijgend groen
// kleurt omdat er niets is ingevuld.
// Nederlandse namen voor de velden die completeness() bijhoudt.
export const FIELD_LABEL = {
  weight: 'gewicht',
  sleep: 'slaap',
  energy: 'energie',
  hr_rest: 'rusthartslag',
  recovery: 'herstelcheck na training',
  training: 'trainingssessies',
  strength: 'krachtsessies',
  measurements: 'lichaamsmaten',
  photos: "progressiefoto's",
  cycle: 'cyclusgegevens',
};

export function completeness({ asOf = todayLocal(), days = 14 } = {}) {
  const vanaf = addDays(asOf, -(days - 1));
  const heeft = (metric) => series(metric, { asOf, since: vanaf }).length;
  // Alles wat er ooit is, ongeacht wanneer. Dit is het verschil tussen
  // "je hebt dit niet" en "je hebt dit al even niet ingevuld".
  const ooit = (metric) => series(metric, { asOf }).length;
  const laatste = (metric) => {
    const s = series(metric, { asOf });
    return s.length ? s[s.length - 1].observedAt : null;
  };

  const GROEPEN = {
    weight: ['weight'],
    sleep: ['sleep_hours', 'sleep_quality'],
    energy: ['energy'],
    hr_rest: ['hr_rest'],
    recovery: ['training_recovery', 'recovery_check', 'headache_severity'],
    training: ['distance', 'duration'],
    strength: ['strength_volume'],
    measurements: ['waist', 'navel', 'hip'],
    photos: ['photo_observation', 'photo_comparison'],
    // Cyclus is meer dan een menstruatiestart: de klachten die ermee
    // meebewegen tellen net zo goed als cyclusdata. Met alleen
    // menstruation_start telde een cyclus van 25 dagen na dag 14 als
    // "geen cyclusgegevens", terwijl ze gewoon in de app staan.
    cycle: ['menstruation_start', 'bloating', 'hot_flashes', 'night_sweats',
      'puffiness', 'breast_tenderness', 'cravings', 'heavy_legs', 'mood'],
  };

  const velden = {};
  const ooitAanwezig = {};
  const laatsteDatum = {};
  for (const [groep, metrics] of Object.entries(GROEPEN)) {
    velden[groep] = metrics.reduce((n, m) => n + heeft(m), 0);
    ooitAanwezig[groep] = metrics.reduce((n, m) => n + ooit(m), 0);
    laatsteDatum[groep] = metrics
      .map(m => laatste(m)).filter(Boolean).sort().pop() || null;
  }

  // ── Ontbreekt, of staat het er alleen al even niet bij? ───────
  //
  // Hier stond één lijst: alles wat in veertien dagen niet voorkwam heette
  // "ontbrekend". Daardoor meldde de app rusthartslag en cyclusgegevens als
  // ontbrekend terwijl ze allebei gewoon in de app staan — alleen ouder dan
  // veertien dagen. Dat is een ander bericht, en het vraagt ook iets anders
  // van de gebruiker.
  const ontbreekt = Object.entries(velden)
    .filter(([k, n]) => n === 0 && ooitAanwezig[k] === 0).map(([k]) => k);
  const verouderd = Object.entries(velden)
    .filter(([k, n]) => n === 0 && ooitAanwezig[k] > 0)
    .map(([k]) => ({ field: k, label: FIELD_LABEL[k] || k, lastDate: laatsteDatum[k] }));
  // Wat er ontbreekt komt op het scherm terecht. `hr_rest` en `cycle` zijn
  // veldnamen uit de code, geen Nederlands — en een gebruiker die leest
  // "beperkt door: hr_rest, cycle" krijgt een foutmelding voorgeschoteld in
  // plaats van een uitleg.
  const missingLabels = ontbreekt.map(k => FIELD_LABEL[k] || k);
  // Voor de dekking telt een verouderde bron half mee: hij bestaat, maar hij
  // is niet actueel. Nul zou onterecht hard zijn, één onterecht geruststellend.
  const punten = Object.entries(velden)
    .reduce((n, [k, v]) => n + (v > 0 ? 1 : ooitAanwezig[k] > 0 ? 0.5 : 0), 0);
  const dekking = punten / Object.keys(velden).length;

  const delen = [];
  if (ontbreekt.length) {
    delen.push(`Nog nooit ingevuld: ${missingLabels.join(', ')}.`);
  }
  if (verouderd.length) {
    delen.push(`Wel aanwezig maar ouder dan ${days} dagen: ${verouderd
      .map(v => `${v.label} (laatst ${v.lastDate})`).join(', ')}. Die tellen mee in de trends; ze zijn alleen niet actueel.`);
  }

  return {
    window: { from: vanaf, to: asOf, days },
    counts: velden,
    everCounts: ooitAanwezig,
    lastDates: laatsteDatum,
    missing: ontbreekt,
    missingLabels,
    // Apart, en met opzet niet in `missing`: dit mag nergens als "ontbreekt"
    // op het scherm komen.
    stale: verouderd,
    coverage: +dekking.toFixed(2),
    confidence: dekking >= 0.8 ? 'hoog' : dekking >= 0.5 ? 'matig' : 'laag',
    note: delen.length
      ? `${delen.join(' ')} Afwezigheid van data is geen groen signaal.`
      : `Alle hoofdbronnen aanwezig in de laatste ${days} dagen.`,
  };
}
