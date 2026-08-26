// De longitudinale beoordeling: wat is er werkelijk aan het veranderen?
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT WEL EN NIET IS
//
// Dit is geen tweede engine naast de bestaande. hrModel, raceplan, restday,
// recoveryBudget en Goal Intelligence blijven bepalen wat je vandaag traint.
// Dit bestand kijkt naar iets anders: de vraag over weken en maanden — verandert
// mijn lichaam de goede kant op, en waaraan zie ik dat?
//
// Vier dingen die het doet, en die alle vier hetzelfde principe delen:
// een uitspraak pas doen als je eigen data hem dragen.
//
//   1. je eigen bandbreedte leren (§27). Niet "1 kg is veel" maar "jouw gewicht
//      varieert normaal ±0,8 kg, dus dit is ruis".
//   2. vergelijken met vergelijkbare cycluscontext (§26), niet alleen met
//      vorige week — want vorige week kan hormonaal een heel andere dag zijn.
//   3. structureel van tijdelijk scheiden (§28), met voorzichtige woorden en
//      zonder medische stelligheid.
//   4. elke 4–6 weken een nieuw tussendoel voorstellen (§17), afgeleid van je
//      werkelijke respons en niet van een lineaire centimeterplanning (§18).
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE ALLES DRAAGT
//
// Eén cyclus is geen patroon. Twee metingen zijn geen bandbreedte. Waar de
// data te dun zijn staat er "nog niet te zeggen" — en dat is een uitkomst,
// geen fout. Een coach die na één maand een persoonlijk patroon claimt, heeft
// geen patroon gevonden maar ruis benoemd.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';
import { series, latest, rollingMean, trend } from './timeline';

const GOAL_KEY = 'gc_body_milestones';

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));
const gem = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// ── 1. Je eigen normale schommeling ─────────────────────────────
// Hoeveel varieert een maat bij jou normaal? Dat is geen constante uit een
// boek maar iets wat uit je eigen reeks komt. Vandaar de ondergrens: onder
// zes metingen is een spreiding geen bandbreedte maar toeval.
export const BANDWIDTH_MIN_N = 6;

export function personalBandwidth(metric, { asOf = todayLocal(), days = 120 } = {}) {
  const s = series(metric, { asOf, since: addDays(asOf, -days) })
    .filter(o => typeof o.value === 'number');

  if (s.length < BANDWIDTH_MIN_N) {
    return { known: false, n: s.length,
      note: `Nog te weinig metingen (${s.length} van ${BANDWIDTH_MIN_N}) om je normale schommeling te kennen.` };
  }

  const waarden = s.map(o => o.value);
  const middel = gem(waarden);
  // Mediane absolute afwijking: minder gevoelig voor die ene rare weging dan
  // een standaarddeviatie, en dat is precies wat je hier wilt.
  const afw = waarden.map(v => Math.abs(v - middel)).sort((a, b) => a - b);
  const mad = afw[Math.floor(afw.length / 2)];
  const band = Math.max(mad * 1.5, 0.1);

  return {
    known: true, n: s.length,
    mean: rond(middel, 2),
    band: rond(band, 2),
    unit: s[s.length - 1].unit || null,
    // De zin die dit bruikbaar maakt aan de andere kant.
    note: `Jouw ${metric} varieert in deze periode normaal ±${rond(band, 1)}${s[s.length - 1].unit || ''}.`,
  };
}

// Is een verandering groter dan je eigen ruis?
//
// Hier zit een onderscheid dat ik er eerst niet in had, en dat het verschil
// maakt tussen "je bent aangekomen" en "je hebt zaterdag pasta gegeten".
//
//   span: 'point'  — hoe ver ligt deze éne waarde van je gemiddelde af?
//                    Dan is de bandbreedte de goede maat: hij is eenzijdig.
//   span: 'range'  — het verschil tussen twee metingen aan de uiteinden van
//                    een venster. Die twee kunnen allebei aan een andere kant
//                    van het gemiddelde liggen, dus binnen normale variatie
//                    kan dat verschil oplopen tot tweemaal de bandbreedte.
//
// De 4-wekentrend is altijd het tweede geval. Met de eenzijdige drempel werd
// een reeks die netjes rond hetzelfde punt schommelde "structureel" genoemd
// zodra hij toevallig van een dal naar een piek liep.
export function beyondNoise(metric, delta, { asOf = todayLocal(), span = 'point' } = {}) {
  const b = personalBandwidth(metric, { asOf });
  if (!b.known) return { known: false, note: b.note };
  const drempel = rond(span === 'range' ? b.band * 2 : b.band, 2);
  const buiten = Math.abs(delta) > drempel;
  const uitleg = span === 'range'
    ? `van dal naar piek is dat ${rond(drempel, 1)}`
    : `±${rond(b.band, 1)}`;
  return {
    known: true, band: b.band, threshold: drempel, span,
    delta: rond(delta, 2), beyond: buiten,
    note: buiten
      ? `${rond(Math.abs(delta), 1)} ligt buiten je normale schommeling van ±${rond(b.band, 1)} (${uitleg}).`
      : `${rond(Math.abs(delta), 1)} valt binnen je normale schommeling van ±${rond(b.band, 1)} (${uitleg}) — dit is ruis, geen verandering.`,
  };
}

// ── 2. Vergelijkbare cycluscontext ──────────────────────────────
// "Je lijkt voller dan vorige week" is een zwakke uitspraak als vorige week
// hormonaal een andere dag was. Deze functie zoekt de metingen uit eerdere
// cycli die op ongeveer dezelfde cyclusdag vielen (§26).
export function cycleDayOf(datum, { asOf = todayLocal() } = {}) {
  const starts = [...new Set(series('menstruation_start', { asOf })
    .map(o => o.observedAt))].sort();
  const laatsteVoor = starts.filter(s => s <= datum).pop();
  if (!laatsteVoor) return null;
  return Math.floor((new Date(datum) - new Date(laatsteVoor)) / 86400000) + 1;
}

export const SIMILAR_WINDOW = 3;   // ± dagen rond dezelfde cyclusdag

export function comparableCycleDays(metric, {
  asOf = todayLocal(), window = SIMILAR_WINDOW,
} = {}) {
  const nuDag = cycleDayOf(asOf, { asOf });
  if (nuDag == null) {
    return { known: false, note: 'Geen menstruatiedata, dus geen vergelijkbare cyclusdagen.' };
  }

  const huidigeStart = [...new Set(series('menstruation_start', { asOf })
    .map(o => o.observedAt))].sort().pop();

  // Alles uit eerdere cycli dat op een vergelijkbare cyclusdag viel.
  const kandidaten = series(metric, { asOf })
    .filter(o => typeof o.value === 'number')
    .filter(o => o.observedAt < huidigeStart)
    .map(o => ({ ...o, cycleDay: cycleDayOf(o.observedAt, { asOf }) }))
    .filter(o => o.cycleDay != null && Math.abs(o.cycleDay - nuDag) <= window);

  if (!kandidaten.length) {
    return { known: false, currentCycleDay: nuDag,
      note: `Nog geen eerdere metingen rond cyclusdag ${nuDag}. Dit is de eerste keer dat we hier kijken.` };
  }

  const nu = latest(metric, { asOf });
  const toenGem = gem(kandidaten.map(o => o.value));

  return {
    known: true,
    currentCycleDay: nuDag,
    current: nu?.value ?? null,
    comparableMean: rond(toenGem, 2),
    n: kandidaten.length,
    delta: nu?.value != null ? rond(nu.value - toenGem, 2) : null,
    samples: kandidaten.map(o => ({ date: o.observedAt, cycleDay: o.cycleDay, value: o.value })),
    note: nu?.value != null
      ? `Op vergelijkbare cyclusdagen (${kandidaten.length} eerdere metingen rond cyclusdag ${nuDag}) was je ${metric} gemiddeld ${rond(toenGem, 1)}; nu is het ${nu.value}.`
      : `Vergelijkbare cyclusdagen bekend, maar geen actuele meting van ${metric}.`,
  };
}

// Een patroon telt pas als het zich herhaalt. Eén cyclus is geen patroon (§25).
export const PATTERN_MIN_CYCLES = 2;

export function hormonalPattern(metric, { asOf = todayLocal() } = {}) {
  const starts = [...new Set(series('menstruation_start', { asOf })
    .map(o => o.observedAt))].sort();
  if (starts.length < PATTERN_MIN_CYCLES + 1) {
    return { known: false, cycles: Math.max(0, starts.length - 1),
      note: `Nog ${PATTERN_MIN_CYCLES + 1 - starts.length} menstruatieregistratie(s) nodig voordat er van een patroon sprake kan zijn. Eén cyclus is geen patroon.` };
  }

  // Per cyclus: het gemiddelde in de laatste week vóór de volgende start,
  // tegenover het gemiddelde in de week erna. Zo zie je of iets structureel
  // rond dezelfde fase omhoog gaat.
  const perCyclus = [];
  for (let i = 0; i < starts.length - 1; i++) {
    const start = starts[i], volgende = starts[i + 1];
    const laat = series(metric, { asOf, since: addDays(volgende, -7) })
      .filter(o => o.observedAt < volgende && typeof o.value === 'number');
    const vroeg = series(metric, { asOf, since: start })
      .filter(o => o.observedAt <= addDays(start, 7) && typeof o.value === 'number');
    if (!laat.length || !vroeg.length) continue;
    perCyclus.push({
      cycle: start,
      late: rond(gem(laat.map(o => o.value)), 2),
      early: rond(gem(vroeg.map(o => o.value)), 2),
      delta: rond(gem(laat.map(o => o.value)) - gem(vroeg.map(o => o.value)), 2),
    });
  }

  if (perCyclus.length < PATTERN_MIN_CYCLES) {
    return { known: false, cycles: perCyclus.length,
      note: `Slechts ${perCyclus.length} cyclus/cycli met genoeg metingen. Een patroon vraagt er minstens ${PATTERN_MIN_CYCLES}.` };
  }

  // Herhaalt het zich in dezelfde richting?
  const richtingen = perCyclus.map(c => Math.sign(c.delta));
  const consistent = richtingen.every(r => r === richtingen[0] && r !== 0);
  const gemiddeld = rond(gem(perCyclus.map(c => c.delta)), 2);

  return {
    known: consistent,
    cycles: perCyclus.length,
    perCycle: perCyclus,
    meanDelta: gemiddeld,
    direction: consistent ? (richtingen[0] > 0 ? 'hoger' : 'lager') : 'wisselend',
    note: consistent
      ? `In ${perCyclus.length} cycli was je ${metric} in de week vóór je menstruatie steeds ${richtingen[0] > 0 ? 'hoger' : 'lager'} (gemiddeld ${gemiddeld > 0 ? '+' : ''}${gemiddeld}). Dat is een herhaald patroon in je eigen data.`
      : `Over ${perCyclus.length} cycli wisselt de richting. Nog geen patroon — alleen variatie.`,
  };
}

// ── 3. Structureel of tijdelijk ─────────────────────────────────
// Voorzichtige woorden, geen medische zekerheid (§28). Wat deze functie doet
// is de aanwijzingen naast elkaar leggen, niet een diagnose stellen.
export const CHANGE = {
  STRUCTURAL: 'structureel',
  TEMPORARY: 'waarschijnlijk tijdelijk',
  UNCLEAR: 'nog niet te zeggen',
};

export function classifyChange(metric, { asOf = todayLocal() } = {}) {
  const t28 = trend(metric, 28, { asOf });
  if (!t28.available) {
    return { verdict: CHANGE.UNCLEAR, why: [t28.reason], confidence: 'geen' };
  }

  // Twee eindpunten van een venster: dus de tweezijdige drempel.
  const ruis = beyondNoise(metric, t28.delta, { asOf, span: 'range' });
  const cyclus = comparableCycleDays(metric, { asOf });
  const waarom = [];
  let oordeel = CHANGE.UNCLEAR;

  // Binnen je eigen ruis is het geen verandering, hoe graag je ook wilt dat
  // het er een is.
  if (ruis.known && !ruis.beyond) {
    oordeel = CHANGE.TEMPORARY;
    waarom.push(ruis.note);
  } else if (ruis.known && ruis.beyond) {
    oordeel = CHANGE.STRUCTURAL;
    waarom.push(ruis.note);
  } else {
    waarom.push(ruis.note || 'Nog geen bandbreedte bekend.');
  }

  // Tijdelijke verklaringen die een stijging kunnen dragen zonder dat er iets
  // structureels aan de hand is.
  const tijdelijk = [];
  const recent = (m) => {
    const s = series(m, { asOf, since: addDays(asOf, -6) });
    return s.length ? s[s.length - 1].value : null;
  };
  if (recent('bloating')) tijdelijk.push('bloating gemeld');
  if (recent('puffiness')) tijdelijk.push('gezicht voller');
  if (recent('alcohol')) tijdelijk.push('alcohol');
  const slaap = rollingMean('sleep_hours', 3, { asOf });
  if (slaap != null && slaap < 6.5) tijdelijk.push(`korte nachten (${rond(slaap, 1)} u)`);

  if (t28.delta > 0 && tijdelijk.length) {
    oordeel = CHANGE.TEMPORARY;
    waarom.push(`Er zijn tijdelijke verklaringen: ${tijdelijk.join(', ')}.`);
  }

  if (cyclus.known) {
    waarom.push(cyclus.note);
    // Vergeleken met dezelfde hormonale context is het beeld vaak anders.
    if (cyclus.delta != null && Math.sign(cyclus.delta) !== Math.sign(t28.delta)) {
      waarom.push('Op vergelijkbare cyclusdagen wijst het de andere kant op dan de kale weektrend — die vergelijking is hier de betrouwbaardere.');
    }
  }

  return {
    verdict: oordeel,
    delta: t28.delta,
    perWeek: t28.perWeek,
    why: waarom,
    temporaryFactors: tijdelijk,
    confidence: ruis.known ? (cyclus.known ? 'redelijk' : 'matig') : 'laag',
  };
}

// ── Recompositie herkennen ──────────────────────────────────────
// Gewicht stil terwijl taille kleiner wordt en kracht stijgt is vooruitgang,
// geen stilstand (§3, §35). Deze functie zegt dat met de cijfers erbij.
export function recompositionSignal({ asOf = todayLocal() } = {}) {
  const gewicht = trend('weight', 28, { asOf });
  const taille = trend('waist', 28, { asOf });
  const navel = trend('navel', 28, { asOf });
  const kracht = trend('strength_volume', 28, { asOf });

  const stil = gewicht.available && Math.abs(gewicht.delta) < 0.6;
  const maatOmlaag = (taille.available && taille.delta < -0.5) ||
    (navel.available && navel.delta < -0.5);
  const krachtOmhoog = kracht.available && kracht.delta > 0;
  const krachtOmlaag = kracht.available && kracht.delta < 0;
  const snelAf = gewicht.available && gewicht.perWeek < -0.45;

  if (stil && maatOmlaag) {
    return {
      signal: 'RECOMPOSITIE', positief: true,
      note: `Gewicht staat vrijwel stil (${gewicht.delta > 0 ? '+' : ''}${gewicht.delta} kg in 4 weken), maar je maten nemen af${krachtOmhoog ? ' en je krachtvolume stijgt' : ''}. Dat past bij recompositie en telt als vooruitgang — geen reden om scherper te eten.`,
    };
  }
  if (snelAf && krachtOmlaag) {
    return {
      signal: 'TE_SNEL', positief: false,
      note: `Je gewicht daalt met ${rond(Math.abs(gewicht.perWeek), 2)} kg per week — sneller dan de beoogde 0,2–0,3 — terwijl je krachtvolume afneemt. Voor dit doel is dat tempo te agressief: meer onderhoud en spierbehoud.`,
    };
  }
  if (gewicht.available && gewicht.perWeek < -0.45) {
    return {
      signal: 'SNEL', positief: false,
      note: `Je gewicht daalt met ${rond(Math.abs(gewicht.perWeek), 2)} kg per week. Het streeftempo is 0,2–0,3 kg. Kijk of spierbehoud niet in het gedrang komt.`,
    };
  }
  if (gewicht.available && gewicht.perWeek >= -0.35 && gewicht.perWeek <= -0.15) {
    return {
      signal: 'OP_TEMPO', positief: true,
      note: `Je 7-daags gemiddelde daalt met ${rond(Math.abs(gewicht.perWeek), 2)} kg per week. Dat is precies het gewenste tempo.`,
    };
  }
  return { signal: 'GEEN_OORDEEL', positief: null,
    note: gewicht.available ? null : 'Nog te weinig gewichtsmetingen voor een trendoordeel.' };
}

// ── 4. Dynamische tussendoelen ──────────────────────────────────
// Geen lineaire centimeterplanning maar een doel dat op je werkelijke respons
// is afgestemd (§17, §18). De termijn is zes weken, want dat is lang genoeg om
// ruis uit te middelen en kort genoeg om bij te sturen.
export const REVIEW_WEEKS = 6;

export function loadMilestones() {
  try {
    const a = JSON.parse(localStorage.getItem(GOAL_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

export function saveMilestone(m) {
  const arr = loadMilestones();
  const entry = {
    id: m.id || `bm_${m.from}`,
    from: m.from, until: m.until,
    targets: m.targets,
    basis: m.basis || null,
    createdAt: m.createdAt || new Date().toISOString(),
    status: m.status || 'ACTIEF',
  };
  const i = arr.findIndex(x => x.id === entry.id);
  if (i >= 0) arr[i] = { ...arr[i], ...entry }; else arr.unshift(entry);
  localStorage.setItem(GOAL_KEY, JSON.stringify(arr.slice(0, 24)));
  return entry;
}

export function activeMilestone({ asOf = todayLocal() } = {}) {
  return loadMilestones().find(m => m.status === 'ACTIEF' && m.until >= asOf) || null;
}

// Is het tijd voor een nieuwe review?
export function reviewDue({ asOf = todayLocal() } = {}) {
  const actief = activeMilestone({ asOf });
  if (!actief) {
    return { due: true, reason: 'Er loopt nog geen tussendoel.' };
  }
  const over = Math.ceil((new Date(actief.until) - new Date(asOf)) / 86400000);
  return {
    due: over <= 0,
    daysLeft: over,
    milestone: actief,
    reason: over <= 0
      ? `Het tussendoel liep tot ${actief.until}. Tijd om te beoordelen en een nieuw doel te zetten.`
      : `Nog ${over} dagen tot de volgende review op ${actief.until}.`,
  };
}

// Het voorstel zelf. Afgeleid van waar je nu staat en hoe je de vorige periode
// reageerde — niet van een tabel.
export function proposeMilestone({ asOf = todayLocal() } = {}) {
  const gew7 = rollingMean('weight', 7, { asOf });
  const taille = latest('waist', { asOf })?.value ?? null;
  const navel = latest('navel', { asOf })?.value ?? null;
  const heup = latest('hip', { asOf })?.value ?? null;
  const recomp = recompositionSignal({ asOf });
  const krachtPerWeek = series('strength_volume', { asOf, since: addDays(asOf, -27) }).length / 4;

  const until = addDays(asOf, REVIEW_WEEKS * 7);
  const targets = [];
  const basis = [];

  // Gewicht: het streeftempo, maar afgeremd als de vorige periode te snel ging
  // of als kracht eronder leed.
  if (gew7 != null) {
    const tempo = recomp.signal === 'TE_SNEL' || recomp.signal === 'SNEL' ? 0.15 : 0.25;
    const doel = rond(gew7 - tempo * REVIEW_WEEKS, 1);
    // Nooit voorbij 55 zonder evaluatie.
    const begrensd = Math.max(doel, 55);
    targets.push({
      metric: 'weight', label: '7-daags gewichtsgemiddelde',
      from: rond(gew7, 1), to: begrensd, unit: 'kg',
      range: [rond(begrensd, 1), rond(begrensd + 0.5, 1)],
    });
    basis.push(`tempo ${tempo} kg/week op basis van je respons de afgelopen 4 weken`);
    if (doel < 55) {
      basis.push('doel begrensd op 55 kg: dat is een evaluatiepunt, geen tussenstation');
    }
  }

  // Maten: één centimeter over zes weken is ambitieus genoeg, en alleen als er
  // een meting is om vanaf te rekenen.
  if (taille != null) {
    targets.push({ metric: 'waist', label: 'natuurlijke taille',
      from: taille, to: rond(taille - 1, 1), unit: 'cm', direction: '−1 cm' });
  }
  if (navel != null) {
    targets.push({ metric: 'navel', label: 'navelomtrek',
      from: navel, to: rond(navel - 1.5, 1), unit: 'cm', direction: '−1 tot −2 cm' });
  }
  if (heup != null) {
    targets.push({ metric: 'hip', label: 'heup',
      from: heup, to: heup, unit: 'cm', direction: 'ongeveer stabiel — hier gaat het om behoud' });
  }

  targets.push({ metric: 'strength_volume', label: 'kracht',
    from: rond(krachtPerWeek, 1), to: Math.max(2, Math.ceil(krachtPerWeek)),
    unit: 'sessies/week',
    direction: krachtPerWeek >= 2 ? 'minimaal behouden' : 'naar 2 per week' });

  targets.push({ metric: 'running', label: 'hardlopen',
    direction: 'progressie zonder delayed worsening' });

  return {
    from: asOf, until, weeks: REVIEW_WEEKS, targets, basis,
    note: 'Dit is een richting, geen contract. Als je lichaam anders reageert, verschuift het doel — niet jij.',
  };
}

// ── Beoordelen van een afgelopen periode ────────────────────────
// Foto's mogen cijferdoelen overrulen (§36). Wat hier gebeurt is dat het
// centimetertarget zijn status als eindoordeel verliest zodra het bredere
// beeld beter is dan het getal.
export function reviewMilestone(milestone, { asOf = todayLocal() } = {}) {
  if (!milestone) return { available: false };

  const uitkomsten = (milestone.targets || []).map(t => {
    if (!t.metric || t.to == null) return { ...t, status: 'GEEN_CIJFER' };
    const nu = t.metric === 'weight'
      ? rollingMean('weight', 7, { asOf })
      : latest(t.metric, { asOf })?.value ?? null;
    if (nu == null) return { ...t, now: null, status: 'GEEN_METING' };
    const gehaald = t.from > t.to ? nu <= t.to : Math.abs(nu - t.to) <= 1;
    return { ...t, now: rond(nu, 1), status: gehaald ? 'GEHAALD' : 'NIET_GEHAALD' };
  });

  const recomp = recompositionSignal({ asOf });
  const foto = series('photo_observation', { asOf, since: milestone.from });
  const kracht = trend('strength_volume', 28, { asOf });

  // Het bredere beeld: telt dit als vooruitgang, ook als een getal niet gehaald is?
  //
  // Met alleen "recompositie positief of kracht omhoog" was er een gat waar
  // zij precies het meest kwetsbaar is: gewicht dat keurig op tempo daalt
  // terwijl het krachtvolume zakt, kwam eruit als "beeld beter". Dat is het
  // tegendeel — afvallen mét spierverlies is de uitkomst die dit hele plan
  // probeert te vermijden. Dalende kracht is daarom een veto, geen detail.
  const krachtDaalt = kracht.available && kracht.delta < 0;
  const breedBeter = !krachtDaalt &&
    (recomp.positief === true || (kracht.available && kracht.delta > 0));

  const gemist = uitkomsten.filter(u => u.status === 'NIET_GEHAALD');

  return {
    available: true,
    milestone,
    outcomes: uitkomsten,
    recomposition: recomp,
    photoCount: foto.length,
    verdict: gemist.length === 0 ? 'GEHAALD'
      : breedBeter ? 'CIJFER_GEMIST_MAAR_BEELD_BETER' : 'NIET_GEHAALD',
    note: gemist.length === 0
      ? 'Alle doelen van deze periode gehaald.'
      : breedBeter
        ? `Het centimetertarget is niet gehaald (${gemist.map(u => u.label).join(', ')}), maar het bredere beeld is beter: ${recomp.note || 'kracht neemt toe'}. Dan is het getal minder relevant dan verwacht — beoordeel eerst of onderhoud of recompositie meer oplevert dan verder afvallen.`
        : krachtDaalt
          ? `Niet gehaald: ${gemist.map(u => u.label).join(', ')}. En belangrijker: je krachtvolume daalt. Wat er van het gewicht af gaat is dan niet alleen vet. Eerst kracht terug, dan pas weer op maten sturen.`
          : `Niet gehaald: ${gemist.map(u => u.label).join(', ')}. Kijk eerst naar herstel, slaap en cyclus voordat je het tempo opvoert.`,
  };
}

// ── 5. Wat is nu de belangrijkste limiter? ──────────────────────
// Eén waarde per week, gebaseerd op recente data en niet op profielhistorie
// (§33). De volgorde is de prioriteit uit §46: veiligheid eerst, gewichtstempo
// laatst.
export const LIMITER = {
  PESE: 'PESE',
  DELAYED_RECOVERY: 'delayed_recovery',
  HORMONAL: 'hormonal_perimenopause',
  SLEEP: 'sleep',
  HEAT: 'heat',
  MUSCULAR: 'muscular_fatigue',
  DISTANCE: 'distance_tolerance',
  ECONOMY: 'aerobic_economy',
  STRENGTH: 'strength_recovery',
  NUTRITION: 'nutrition_energy_availability',
  STRESS: 'stress',
  READY: 'none_ready_to_build',
};

export function classifyLimiter({ asOf = todayLocal() } = {}) {
  const recent = (m, dagen = 6) =>
    series(m, { asOf, since: addDays(asOf, -dagen) }).length;
  const laatste = (m, dagen = 6) => {
    const s = series(m, { asOf, since: addDays(asOf, -dagen) });
    return s.length ? s[s.length - 1].value : null;
  };

  const pem14 = series('symptom_pem', { asOf, since: addDays(asOf, -13) }).length;
  const vertraagd = recent('delayed_fatigue') + recent('delayed_brainfog') +
    recent('delayed_breathless');
  const slaap = rollingMean('sleep_hours', 5, { asOf });
  const spier = recent('symptom_pain');
  const stress = laatste('stress_high');
  const krachtSessies = series('strength_volume', { asOf, since: addDays(asOf, -13) }).length;

  // Hormonaal telt pas mee als er een herhaald patroon onder zit — anders is
  // het een losse klachtendag en geen limiter (§25, §31).
  const hormonaalSignaal = ['bloating', 'puffiness', 'hot_flashes', 'night_sweats']
    .filter(m => laatste(m)).length;
  const patroon = hormonalPattern('weight', { asOf });

  const kandidaten = [];
  if (pem14 > 0) kandidaten.push({ limiter: LIMITER.PESE, prio: 1,
    why: `PEM-signaal in de afgelopen twee weken (${pem14}×).` });
  if (vertraagd > 0) kandidaten.push({ limiter: LIMITER.DELAYED_RECOVERY, prio: 2,
    why: `Vertraagde klachten na inspanning in de afgelopen week (${vertraagd} meldingen).` });
  if (slaap != null && slaap < 6.5) kandidaten.push({ limiter: LIMITER.SLEEP, prio: 3,
    why: `Slaap gemiddeld ${rond(slaap, 1)} u over vijf dagen.` });
  if (hormonaalSignaal >= 2) kandidaten.push({ limiter: LIMITER.HORMONAL, prio: 4,
    why: `${hormonaalSignaal} hormonale signalen deze week${patroon.known ? `, en dit patroon herhaalt zich in je eigen data (${patroon.note})` : ', maar nog zonder herhaald patroon in je eigen data'}.` });
  if (spier >= 2) kandidaten.push({ limiter: LIMITER.MUSCULAR, prio: 5,
    why: 'Meerdere dagen spierpijn gemeld.' });
  if (stress) kandidaten.push({ limiter: LIMITER.STRESS, prio: 6,
    why: 'Stress hoog gemeld.' });
  if (krachtSessies === 0) kandidaten.push({ limiter: LIMITER.STRENGTH, prio: 7,
    why: 'Geen krachtsessies in twee weken — spierbehoud is dan de beperkende factor, niet je conditie.' });

  if (!kandidaten.length) {
    return { limiter: LIMITER.READY, why: ['Geen beperkende signalen in de recente data.'],
      confidence: 'redelijk',
      note: 'Er is ruimte om op te bouwen. Te weinig prikkel is ook een coachfout.' };
  }

  kandidaten.sort((a, b) => a.prio - b.prio);
  return {
    limiter: kandidaten[0].limiter,
    why: kandidaten.map(k => k.why),
    others: kandidaten.slice(1).map(k => k.limiter),
    confidence: 'redelijk',
    note: kandidaten[0].limiter === LIMITER.HORMONAL
      ? 'Hormonale signalen zijn geen Long-COVID-terugval. Zolang er geen vertraagde verslechtering is, hoeft de belasting hier niet stevig voor omlaag.'
      : null,
  };
}
