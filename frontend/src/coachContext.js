// Wat de coach te zien krijgt, en waarom precies dat.
//
// ─────────────────────────────────────────────────────────────────
// WAT DE AUDIT VOND
//
// Van dertig gemeten datavelden bereikten er twaalf de coachprompt niet. Acht
// opslagsleutels werden tijdens het opbouwen van de context nooit gelezen:
// krachtsessies, lichaamsdoelen, foto-observaties, cyclushistorie,
// seizoensfocus, de levendlijst, de overrides en het adaptieve logboek.
//
// Het gevolg was niet dat de coach fout rekende, maar dat hij hele domeinen
// niet kende. Over kracht kon hij niets zeggen omdat er niets over kracht in
// stond. Dat leest van buiten als een coach die kracht onbelangrijk vindt.
//
// Dit bestand is de enige plek waar context wordt samengesteld. Eén builder,
// zodat "wat weet de coach" één antwoord heeft in plaats van vier (§9).
//
// ─────────────────────────────────────────────────────────────────
// DRIE REGELS
//
// 1. Alles komt uit de tijdlijn. Geen tweede leespad, dus geen bron die stil
//    achterloopt na een correctie of backfill (§6, §43).
//
// 2. Onbekend is een waarde. Waar niets is ingevuld staat dat er, met zoveel
//    woorden. Afwezigheid van data mag nooit als groen gelezen worden (§44).
//
// 3. Samenvatten mag, weglaten niet. De coach krijgt trends in plaats van
//    duizend regels, maar krijgt er altijd bij te horen dát er historie is en
//    hoeveel (§10).
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';
import {
  timeline, series, latest, rollingMean, trend, completeness, DOMAIN,
} from './timeline';

function lees(key, terug) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? terug;
  } catch { return terug; }
}

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));

// ── De context ──────────────────────────────────────────────────
export function buildCoachContext({ asOf = todayLocal(), horizon = 120 } = {}) {
  const sinds = addDays(asOf, -horizon);
  const alles = timeline({ asOf });

  return {
    asOf,
    body: bodyContext(asOf),
    training: trainingContext(asOf),
    strength: strengthContext(asOf),
    recovery: recoveryContext(asOf),
    cycle: cycleContext(asOf),
    goals: goalContext(asOf),
    context: overigContext(asOf),
    completeness: completeness({ asOf }),
    // Zodat de coach wéét dat er historie is, ook als hij hem niet meekrijgt.
    history: {
      firstObservation: alles.length ? alles[0].observedAt : null,
      totalObservations: alles.length,
      window: { from: sinds, to: asOf },
      note: alles.length
        ? `Er zijn ${alles.length} waarnemingen vanaf ${alles[0].observedAt}. Vraag om oudere context als dat nodig is.`
        : 'Nog geen waarnemingen.',
    },
  };
}

// ── Lichaam ─────────────────────────────────────────────────────
function bodyContext(asOf) {
  const gew = latest('weight', { asOf });
  const taille = latest('waist', { asOf });
  const navel = latest('navel', { asOf });

  return {
    weight: {
      last: gew?.value ?? null,
      lastDate: gew?.observedAt ?? null,
      mean7: rollingMean('weight', 7, { asOf }),
      mean28: rollingMean('weight', 28, { asOf }),
      trend28: trend('weight', 28, { asOf }),
      // Het 7-daags gemiddelde is de maat, niet de losse weging. Dat staat
      // hier expliciet omdat de coach anders op ruis reageert (§3).
      note: 'Beoordeel gewicht op het 7-daags gemiddelde, niet op één weging.',
    },
    waist: maatBlok('waist', asOf, taille),
    navel: maatBlok('navel', asOf, navel),
    hip: maatBlok('hip', asOf, latest('hip', { asOf })),
    chest: maatBlok('chest', asOf, latest('chest', { asOf })),
    arm: maatBlok('arm', asOf, latest('arm', { asOf })),
    thigh: maatBlok('thigh', asOf, latest('thigh', { asOf })),
    photos: fotoBlok(asOf),
  };
}

function maatBlok(metric, asOf, laatste) {
  if (!laatste) {
    return { last: null, known: false,
      note: `Nog geen ${metric === 'navel' ? 'navelomtrek' : metric} gemeten.` };
  }
  // Het voorbehoud hangt aan de oudste meting, niet aan de nieuwste — en juist
  // die oude punten dragen de trend. Een trend die begint bij een waarde
  // waarvan niemand meer weet waar hij gemeten is, hoort dat te zeggen.
  const alle = series(metric, { asOf });
  const onzeker = alle.find(o => o.meta?.note);

  return {
    last: laatste.value,
    lastDate: laatste.observedAt,
    known: true,
    trend28: trend(metric, 28, { asOf }),
    trend84: trend(metric, 84, { asOf }),
    certainty: laatste.certainty,
    caveat: onzeker
      ? `${onzeker.meta.note} (${onzeker.observedAt}: ${onzeker.value} cm)`
      : null,
  };
}

function fotoBlok(asOf) {
  const foto = series('photo_observation', { asOf });
  if (!foto.length) {
    return { count: 0, known: false,
      note: 'Nog geen progressiefoto-observaties vastgelegd.' };
  }
  const laatste = foto[foto.length - 1];
  return {
    count: foto.length,
    known: true,
    lastDate: laatste.observedAt,
    lastFields: laatste.meta?.fields || [],
    lastNote: typeof laatste.value === 'string' ? laatste.value : null,
    // Foto's zijn kwalitatief. Dit staat erbij zodat er geen percentages uit
    // gefantaseerd worden (§14).
    instruction: 'Beoordeel foto\'s kwalitatief: silhouet, taille, buikprofiel, tonus. Nooit een vetpercentage of aantal kilo\'s vet uit een foto afleiden.',
  };
}

// ── Hardlopen ───────────────────────────────────────────────────
function trainingContext(asOf) {
  const runs = timeline({ asOf, domains: DOMAIN.TRAINING })
    .filter(o => o.meta?.workoutId);
  const perSessie = new Map();
  for (const o of runs) {
    const id = o.meta.workoutId;
    if (!perSessie.has(id)) {
      perSessie.set(id, { id, date: o.observedAt, type: o.meta.activityType });
    }
    perSessie.get(id)[o.metric] = o.value;
  }
  const sessies = [...perSessie.values()].sort((a, b) => a.date.localeCompare(b.date));
  const laatste3 = sessies.slice(-3);

  const dagen = series('run_done', { asOf, since: addDays(asOf, -27) }).length;

  return {
    sessionCount: sessies.length,
    last3: laatste3.map(s => ({
      date: s.date, distanceKm: s.distance ?? null, durationMin: s.duration ?? null,
      avgHr: s.avg_hr ?? null, rpe: s.rpe ?? null,
      legs: s.legs ?? null, couldDoMore: s.could_do_more ?? null,
    })),
    runDays28: dagen,
    // Zwemmen en fietsen zijn ook belasting, ook al zijn ze geen looptraining.
    swimMin28: series('swim_duration', { asOf, since: addDays(asOf, -27) })
      .reduce((a, o) => a + (o.value || 0), 0),
    bikeMin28: series('bike_duration', { asOf, since: addDays(asOf, -27) })
      .reduce((a, o) => a + (o.value || 0), 0),
    known: sessies.length > 0,
    note: sessies.length ? null : 'Nog geen geregistreerde loopsessies.',
  };
}

// ── Kracht ──────────────────────────────────────────────────────
// Dit hele blok ontbrak. gc_strength_sessions werd nooit gelezen bij het
// opbouwen van de context, dus over kracht kon de coach niets zeggen.
function strengthContext(asOf) {
  const volume = series('strength_volume', { asOf });
  const lifts = series('strength_lift', { asOf });

  if (!volume.length && !lifts.length) {
    return { known: false, sessions: 0,
      note: 'Geen krachtdata beschikbaar. Dat is iets anders dan geen kracht getraind.' };
  }

  const laatste28 = volume.filter(o => o.observedAt >= addDays(asOf, -27));
  const perOefening = new Map();
  for (const l of lifts) {
    if (!l.meta?.exercise || l.value == null) continue;
    const k = l.meta.exercise;
    const vorige = perOefening.get(k);
    if (!vorige || l.observedAt >= vorige.date) {
      perOefening.set(k, { date: l.observedAt, weight: l.value,
        sets: l.meta.sets, reps: l.meta.reps });
    }
  }

  return {
    known: true,
    sessions: volume.length,
    sessions28: laatste28.length,
    perWeek28: rond(laatste28.length / 4, 1),
    volumeTrend28: trend('strength_volume', 28, { asOf }),
    lastSession: volume.length ? volume[volume.length - 1].observedAt : null,
    topLifts: [...perOefening.entries()].slice(0, 8)
      .map(([naam, v]) => ({ exercise: naam, weight: v.weight, sets: v.sets, reps: v.reps, date: v.date })),
    note: laatste28.length >= 8
      ? 'Twee of meer krachtprikkels per week — dat is het doel.'
      : `${laatste28.length} krachtsessies in vier weken; het doel is 2–3 per week.`,
  };
}

// ── Herstel ─────────────────────────────────────────────────────
function recoveryContext(asOf) {
  const pem = series('symptom_pem', { asOf, since: addDays(asOf, -83) });
  const laatstePem = pem.length ? pem[pem.length - 1].observedAt : null;

  return {
    sleep: {
      mean7: rollingMean('sleep_hours', 7, { asOf }),
      quality7: rollingMean('sleep_quality', 7, { asOf }),
      trend28: trend('sleep_hours', 28, { asOf }),
    },
    hrRest: {
      last: latest('hr_rest', { asOf })?.value ?? null,
      mean7: rollingMean('hr_rest', 7, { asOf }),
      trend28: trend('hr_rest', 28, { asOf }),
    },
    energy: { mean7: rollingMean('energy', 7, { asOf }) },
    steps7: rollingMean('steps', 7, { asOf }),
    pem: {
      lastDate: laatstePem,
      count84: pem.length,
      freeWeeks: laatstePem
        ? Math.floor((new Date(asOf) - new Date(laatstePem)) / (7 * 86400000))
        : null,
      // De kernregel uit §29: geschiedenis is een risicofactor, geen
      // permanente rem. Wat telt is de respons van nú.
      instruction: 'Long COVID is een historische en dynamische risicofactor, geen permanente primaire limiter. De 24–48u-respons op de laatste sessies bepaalt hoeveel bescherming nodig is.',
    },
  };
}

// ── Cyclus en perimenopauze ─────────────────────────────────────
function cycleContext(asOf) {
  // Dezelfde start kan uit twee bronnen komen — de daglog en de
  // cyclushistorie. Ontdubbelen op datum, anders ontstaat er een cyclus van
  // nul dagen tussen twee registraties van hetzelfde moment.
  const startObs = series('menstruation_start', { asOf });
  const perDatum = new Map();
  for (const o of startObs) {
    const bestaand = perDatum.get(o.observedAt);
    // De registratie mét lengte wint: die draagt meer informatie.
    if (!bestaand || (o.meta?.cycleLength != null && bestaand.meta?.cycleLength == null)) {
      perDatum.set(o.observedAt, o);
    }
  }
  const uniek = [...perDatum.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const starts = uniek.map(o => o.observedAt);
  const laatste = starts.length ? starts[starts.length - 1] : null;
  const dag = laatste
    ? Math.floor((new Date(asOf) - new Date(laatste)) / 86400000) + 1 : null;

  // Cycluslengtes uit de werkelijke starts, niet uit een aanname van 28 dagen.
  const lengtes = [];
  for (let i = 1; i < starts.length; i++) {
    lengtes.push(Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000));
  }
  // Staat er een lengte bij een geregistreerde start, dan telt die mee. Met
  // één start zijn er nog geen intervallen om zelf te rekenen, en dan is haar
  // eigen opgave het enige wat er is.
  const gemeld = uniek.map(o => o.meta?.cycleLength).filter(n => typeof n === 'number');
  const bron = lengtes.length ? lengtes : gemeld;
  const gemiddeld = bron.length
    ? Math.round(bron.reduce((a, b) => a + b, 0) / bron.length) : null;
  const spreiding = lengtes.length >= 2
    ? Math.max(...lengtes) - Math.min(...lengtes) : null;

  const signaal = (m) => {
    const s = series(m, { asOf, since: addDays(asOf, -13) });
    return s.length ? s[s.length - 1].value : null;
  };

  return {
    known: !!laatste,
    lastPeriodStart: laatste,
    cycleDay: dag,
    observedLengths: lengtes.length ? lengtes : gemeld,
    meanLength: gemiddeld,
    spread: spreiding,
    // Geen fase-etiket zonder onderbouwing. Bij perimenopauze is een cyclus
    // vaak onregelmatig, en dan is "dag 21 dus luteaal" een verzinsel (§24).
    phase: fase(dag, gemiddeld, spreiding),
    signals: {
      bloating: signaal('bloating'),
      puffiness: signaal('puffiness'),
      breastTenderness: signaal('breast_tenderness'),
      cravings: signaal('cravings'),
      hotFlashes: signaal('hot_flashes'),
      nightSweats: signaal('night_sweats'),
      heavyLegs: signaal('heavy_legs'),
      mood: signaal('mood'),
    },
    instruction: laatste
      ? 'Gebruik cyclus als contextmodifier, nooit als diagnose. Hormonale schommeling is geen vettoename en geen Long-COVID-terugval.'
      : 'Geen cyclusdata bekend. Benoem dat als onbekend in plaats van het weg te laten.',
  };
}

function fase(dag, gemiddeld, spreiding) {
  if (dag == null) return { label: 'onbekend', certainty: 'geen data' };
  if (dag <= 5) return { label: 'menstruatie', certainty: 'hoog' };
  // Zonder een stabiele cycluslengte is elke fase-uitspraak een gok.
  if (gemiddeld == null || (spreiding != null && spreiding > 7)) {
    return { label: 'onbekend', certainty: 'laag',
      why: spreiding != null && spreiding > 7
        ? `Je cycluslengte varieert ${spreiding} dagen; een fase-indeling zou schijnzekerheid zijn.`
        : 'Te weinig menstruatiedata om een fase te bepalen.' };
  }
  if (dag < gemiddeld * 0.45) return { label: 'folliculair', certainty: 'matig' };
  if (dag < gemiddeld * 0.6) return { label: 'rond ovulatie', certainty: 'laag' };
  return { label: 'luteaal', certainty: 'matig' };
}

// ── Doelen ──────────────────────────────────────────────────────
function goalContext(asOf) {
  const body = lees('gc_goals', []).filter(g => g?.enabled !== false);
  const races = lees('gc_race_goals', []).filter(g => g?.enabled !== false);
  const gew = rollingMean('weight', 7, { asOf });

  return {
    body: body.map(g => ({
      id: g.id, name: g.name || g.metric, domain: g.domain || null,
      metric: g.metric || null, target: g.target_value ?? null,
      targetDate: g.target_date || null,
    })),
    races: races.map(g => ({
      id: g.id, name: g.name, distanceKm: g.distanceKm,
      targetTimeSec: g.targetTimeSec ?? null, date: g.date,
    })),
    weightMilestone: gewichtsMijlpaal(gew),
    focus: lees('gc_executive_focus', null),
  };
}

// 55 kg is een beslismoment, geen tussenstation. En 50 kg wordt nooit vanzelf
// het volgende doel (§20).
function gewichtsMijlpaal(mean7) {
  if (mean7 == null) return { known: false, note: 'Nog geen 7-daags gewichtsgemiddelde.' };
  if (mean7 <= 55.5) {
    return {
      known: true, current: mean7, milestone: 55,
      state: 'EVALUATIEPUNT',
      instruction: 'Het 7-daags gemiddelde nadert 55 kg. Dat is een expliciet evaluatiemoment: beoordeel eerst lichaam, prestatie en herstel samen, en adviseer daarna stabiliseren, rustig door naar 52–53 kg, of stoppen met afvallen. Activeer 50 kg nooit automatisch.',
    };
  }
  return {
    known: true, current: mean7, milestone: 55,
    toGo: rond(mean7 - 55, 1),
    state: 'ONDERWEG',
    instruction: 'Streeftempo is 0,2–0,3 kg per week. Stilstand met kleinere taille, betere foto\'s of stijgende kracht telt als recompositie en is geen mislukking.',
  };
}

// ── Overige context ─────────────────────────────────────────────
function overigContext(asOf) {
  const laat = (m) => {
    const s = series(m, { asOf, since: addDays(asOf, -6) });
    return s.length ? s[s.length - 1].value : null;
  };
  const notities = series('notes', { asOf, since: addDays(asOf, -13) })
    .map(o => `${o.observedAt}: ${o.value}`).slice(-5);

  return {
    stressRecent: laat('stress_high'),
    alcoholRecent: laat('alcohol'),
    notes: notities,
    overrides: series('user_override', { asOf, since: addDays(asOf, -83) })
      .map(o => ({ date: o.observedAt, status: o.value, tegen: o.meta?.coachAdvies || null })),
  };
}

// ── Wat de coach gebruikt, leesbaar ─────────────────────────────
// Dit voedt de "Gebruikte gegevens"-knop (§11). Geen prompt tonen, wel
// traceerbaarheid: welke getallen zaten erin en van wanneer.
export function usedData(ctx) {
  const r = [];
  const push = (label, waarde, wanneer = null) => {
    if (waarde === null || waarde === undefined) return;
    r.push({ label, value: String(waarde), when: wanneer });
  };

  push('7-daags gewichtsgemiddelde', ctx.body.weight.mean7 != null ? `${ctx.body.weight.mean7} kg` : null,
    ctx.body.weight.lastDate);
  if (ctx.body.weight.trend28?.available) {
    push('gewichtstrend 4 weken', `${ctx.body.weight.trend28.delta > 0 ? '+' : ''}${ctx.body.weight.trend28.delta} kg`);
  }
  if (ctx.body.waist.known) push('natuurlijke taille', `${ctx.body.waist.last} cm`, ctx.body.waist.lastDate);
  if (ctx.body.navel.known) push('navelomtrek', `${ctx.body.navel.last} cm`, ctx.body.navel.lastDate);
  if (ctx.body.navel.trend28?.available) {
    push('naveltrend 4 weken', `${ctx.body.navel.trend28.delta} cm`);
  }
  push('laatste loopsessies', ctx.training.last3.length
    ? ctx.training.last3.map(s => `${s.date.slice(5)} ${s.distanceKm ?? '?'} km`).join(' · ') : null);
  push('krachtsessies (4 wk)', ctx.strength.known ? `${ctx.strength.sessions28}` : null);
  push('slaap (7 dg gem.)', ctx.recovery.sleep.mean7 != null ? `${ctx.recovery.sleep.mean7} u` : null);
  push('rusthartslag (7 dg gem.)', ctx.recovery.hrRest.mean7 != null ? `${ctx.recovery.hrRest.mean7} bpm` : null);
  push('cyclusdag', ctx.cycle.cycleDay);
  push('cyclusfase', ctx.cycle.phase.label !== 'onbekend'
    ? `${ctx.cycle.phase.label} (${ctx.cycle.phase.certainty})` : 'onbekend');
  push('progressiefoto', ctx.body.photos.known ? `${ctx.body.photos.lastDate}` : null);
  push('laatste PEM-signaal', ctx.recovery.pem.lastDate || 'geen in 12 weken');
  push('datadekking', `${Math.round(ctx.completeness.coverage * 100)}% · zekerheid ${ctx.completeness.confidence}`);

  return { items: r, missing: ctx.completeness.missing };
}

// ── Als tekst voor de prompt ────────────────────────────────────
export function contextAsText(ctx) {
  const L = [];
  const zeg = (s) => L.push(s);

  zeg(`PEILDATUM: ${ctx.asOf}`);
  zeg(`DATADEKKING: ${Math.round(ctx.completeness.coverage * 100)}% — zekerheid ${ctx.completeness.confidence}. ${ctx.completeness.note}`);
  zeg('');

  zeg('LICHAAM:');
  const w = ctx.body.weight;
  zeg(`  gewicht laatste: ${w.last ?? 'onbekend'} kg · 7-daags gemiddelde: ${w.mean7 ?? 'onbekend'} · 28-daags: ${w.mean28 ?? 'onbekend'}`);
  if (w.trend28?.available) {
    zeg(`  gewichtstrend 4 weken: ${w.trend28.delta > 0 ? '+' : ''}${w.trend28.delta} kg (${w.trend28.perWeek} kg/week, ${w.trend28.n} metingen)`);
  } else zeg(`  gewichtstrend 4 weken: ${w.trend28?.reason || 'onbekend'}`);
  for (const [naam, blok] of [['natuurlijke taille', ctx.body.waist], ['navelomtrek', ctx.body.navel],
    ['heup', ctx.body.hip], ['borst', ctx.body.chest], ['arm', ctx.body.arm], ['dij', ctx.body.thigh]]) {
    if (!blok.known) { zeg(`  ${naam}: onbekend`); continue; }
    const t = blok.trend28?.available ? ` · 4 weken ${blok.trend28.delta > 0 ? '+' : ''}${blok.trend28.delta} cm` : '';
    zeg(`  ${naam}: ${blok.last} cm (${blok.lastDate})${t}${blok.caveat ? ` — LET OP: ${blok.caveat}` : ''}`);
  }
  zeg(`  progressiefoto's: ${ctx.body.photos.known ? `${ctx.body.photos.count}, laatste ${ctx.body.photos.lastDate}` : 'geen'}`);
  if (ctx.body.photos.lastNote) zeg(`  laatste foto-observatie: ${ctx.body.photos.lastNote}`);
  zeg(`  ${ctx.body.photos.instruction}`);
  zeg('');

  zeg('HARDLOPEN:');
  if (ctx.training.known) {
    for (const s of ctx.training.last3) {
      zeg(`  ${s.date}: ${s.distanceKm ?? '?'} km · ${s.durationMin ?? '?'} min · HR ${s.avgHr ?? '?'} · RPE ${s.rpe ?? '?'}${s.legs ? ` · benen ${s.legs}` : ''}`);
    }
    zeg(`  loopdagen laatste 4 weken: ${ctx.training.runDays28}`);
    zeg(`  overige belasting 4 weken: zwemmen ${ctx.training.swimMin28} min · fietsen ${ctx.training.bikeMin28} min`);
  } else zeg(`  ${ctx.training.note}`);
  zeg('');

  zeg('KRACHT:');
  if (ctx.strength.known) {
    zeg(`  ${ctx.strength.sessions28} sessies in 4 weken (${ctx.strength.perWeek28}/week) · laatste ${ctx.strength.lastSession}`);
    if (ctx.strength.volumeTrend28?.available) {
      zeg(`  volumetrend 4 weken: ${ctx.strength.volumeTrend28.delta > 0 ? '+' : ''}${ctx.strength.volumeTrend28.delta} kg`);
    }
    for (const l of ctx.strength.topLifts.slice(0, 5)) {
      zeg(`  ${l.exercise}: ${l.weight ?? '?'} kg ${l.sets ?? '?'}×${l.reps ?? '?'} (${l.date})`);
    }
    zeg(`  ${ctx.strength.note}`);
  } else zeg(`  ${ctx.strength.note}`);
  zeg('');

  zeg('HERSTEL:');
  zeg(`  slaap 7-daags: ${ctx.recovery.sleep.mean7 ?? 'onbekend'} u · kwaliteit ${ctx.recovery.sleep.quality7 ?? 'onbekend'}`);
  zeg(`  rusthartslag 7-daags: ${ctx.recovery.hrRest.mean7 ?? 'onbekend'} bpm`);
  zeg(`  energie 7-daags: ${ctx.recovery.energy.mean7 ?? 'onbekend'}`);
  zeg(`  stappen 7-daags: ${ctx.recovery.steps7 ?? 'onbekend'}`);
  zeg(`  laatste PEM-signaal: ${ctx.recovery.pem.lastDate || 'geen in 12 weken'}${ctx.recovery.pem.freeWeeks != null ? ` (${ctx.recovery.pem.freeWeeks} weken geleden)` : ''}`);
  zeg(`  ${ctx.recovery.pem.instruction}`);
  zeg('');

  zeg('CYCLUS / PERIMENOPAUZE:');
  if (ctx.cycle.known) {
    zeg(`  laatste menstruatiestart: ${ctx.cycle.lastPeriodStart} · cyclusdag ${ctx.cycle.cycleDay}`);
    zeg(`  gemeten cycluslengtes: ${ctx.cycle.observedLengths.join(', ') || 'nog te weinig'}${ctx.cycle.meanLength ? ` · gemiddeld ${ctx.cycle.meanLength}` : ''}`);
    zeg(`  fase: ${ctx.cycle.phase.label} (zekerheid ${ctx.cycle.phase.certainty})${ctx.cycle.phase.why ? ` — ${ctx.cycle.phase.why}` : ''}`);
    const sig = Object.entries(ctx.cycle.signals).filter(([, v]) => v != null && v !== 0);
    zeg(`  signalen: ${sig.length ? sig.map(([k, v]) => `${k} ${v}`).join(', ') : 'geen gemeld'}`);
  } else zeg('  onbekend — geen menstruatiedata vastgelegd');
  zeg(`  ${ctx.cycle.instruction}`);
  zeg('');

  zeg('DOELEN:');
  for (const g of ctx.goals.body) zeg(`  lichaam: ${g.name}${g.target != null ? ` → ${g.target}` : ''}`);
  for (const g of ctx.goals.races) zeg(`  race: ${g.name} — ${g.distanceKm} km op ${g.date}`);
  if (ctx.goals.focus?.primaryFocus) zeg(`  focus dit seizoen: ${ctx.goals.focus.primaryFocus}`);
  const m = ctx.goals.weightMilestone;
  if (m.known) zeg(`  gewichtsmijlpaal: ${m.state} — ${m.instruction}`);
  zeg('');

  if (ctx.context.notes.length) {
    zeg('NOTITIES:');
    for (const n of ctx.context.notes) zeg(`  ${n}`);
    zeg('');
  }
  if (ctx.context.overrides.length) {
    zeg(`OVERRIDES (bewust tegen het advies in getraind): ${ctx.context.overrides.length} in 12 weken`);
    zeg('');
  }

  if (ctx.completeness.missing.length) {
    zeg(`ONBEKEND: ${ctx.completeness.missing.join(', ')}. Behandel dit als ontbrekende data, niet als "geen probleem". Benoem je zekerheid als die hierdoor beperkt is.`);
  }

  return L.join('\n');
}
