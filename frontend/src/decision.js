// Het besluit, als object.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAT
//
// Fase 1 bewees dat de data de prompt bereiken. Fase 2 moet bewijzen dat de
// beslissing verandert. Dat kun je niet aan proza toetsen: een coachtekst
// leest altijd plausibel, ook als hij bij elke dataset hetzelfde zegt. Je
// kunt hem pas toetsen als er een besluit uit komt met een naam.
//
// Dit bestand levert dat besluit. Acht velden, allemaal een enum of een
// datum, allemaal afgeleid uit de lagen die er al zijn:
//
//   limiter.js       → wat beperkt deze week
//   pese.js          → hoeveel bescherming is er nodig
//   progression.js   → mag er opgebouwd worden, en waarmee
//   bodyReview.js    → wat verandert er structureel aan het lichaam
//   photoAnalysis.js → wat is er werkelijk gezien, en hoe zeker
//   cyclePatterns.js → welk deel is hormonale context
//
// Er wordt hier niets opnieuw uitgerekend. Wat hier gebeurt is samenvoegen
// tot één uitspraak — precies wat een coach doet en wat een dashboard niet
// doet.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE HET GEHEEL BIJEENHOUDT
//
// Elk veld draagt zijn eigen bewijs en zijn eigen gaten. `evidence` zegt
// waaróm, `missingData` zegt wat het oordeel beperkt. Een besluit met een
// lege `evidence` bestaat niet: dan is het antwoord "onvoldoende data" en
// heet het ook zo.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series, rollingMean, completeness } from './timeline';
import { weeklyLimiter, LIMITER, LIMITER_NL } from './limiter';
import { peseState, PESE, longCovidRisk, attributeSymptoms, ATTRIBUTION,
  selfReportedPem } from './pese';
import { trainingBalance, RISK, progressionProposal } from './progression';
import { recompositionSignal, classifyChange, CHANGE, activeMilestone,
  reviewDue, proposeMilestone, reviewMilestone, REVIEW_WEEKS } from './bodyReview';
import { loadAnalyses, convergentFindings, ANALYSIS_FIELDS, SCALE_NEUTRAL,
  CONFIDENCE as PHOTO_CONFIDENCE } from './photoAnalysis';
import { cyclePosition, cycleRegularity, phasePattern, learnedPatterns,
  PATTERN_CONFIDENCE, PHASE } from './cyclePatterns';
import { runEconomyTrend } from './pace';
import { loadWorkouts } from './workouts';

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));

// ── De enums ────────────────────────────────────────────────────
export const TRAINING_DECISION = {
  PROTECT: 'PROTECT',                   // actieve bescherming, geen belasting
  REDUCE: 'REDUCE',                     // belasting omlaag
  HOLD: 'HOLD',                         // herhaal het niveau
  PROGRESS: 'PROGRESS',                 // één stap vooruit
  PROGRESS_ACTIVELY: 'PROGRESS_ACTIVELY', // ondertraining: actief zoeken
};

export const BODY_DECISION = {
  RECOMPOSITION: 'RECOMPOSITION',             // gewicht stil, maten omlaag
  CONTINUE: 'CONTINUE',                       // op koers
  EVALUATE: 'EVALUATE',                       // beslismoment
  MAINTENANCE: 'MAINTENANCE',                 // onderhoud
  MUSCLE_PRESERVATION: 'MUSCLE_PRESERVATION', // spierbehoud gaat voor
  NO_JUDGEMENT: 'NO_JUDGEMENT',               // te weinig data
};

export const WEIGHT_STRATEGY = {
  MAINTAIN_CURRENT_DEFICIT: 'MAINTAIN_CURRENT_DEFICIT',
  REDUCE_DEFICIT: 'REDUCE_DEFICIT',
  MAINTENANCE: 'MAINTENANCE',
  INCREASE_INTAKE: 'INCREASE_INTAKE',
  PAUSE_LOSS: 'PAUSE_LOSS',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
};

export const GOAL_ADJUSTMENT = {
  NONE: 'NONE',
  SLOW_DOWN: 'SLOW_DOWN',
  HOLD: 'HOLD',
  REVISE_TARGET: 'REVISE_TARGET',
  EVALUATE_MILESTONE: 'EVALUATE_MILESTONE',
};

// Zekerheid als getal én als woord. Het getal is voor tests en sortering,
// het woord voor het scherm — en ze mogen nooit uit elkaar lopen, dus is er
// één vertaling.
export const CONFIDENCE_VALUE = { hoog: 0.85, redelijk: 0.6, laag: 0.35, geen: 0.1 };
export function confidenceWord(v) {
  return v >= 0.75 ? 'hoog' : v >= 0.5 ? 'redelijk' : v > 0.2 ? 'laag' : 'geen';
}

// ── Krachtdata: ontbreekt de data of ontbreekt de training? ─────
//
// Dit lijkt haarkloverij en is het niet. "Je doet geen krachttraining" is
// een uitspraak over haar gedrag; "er is geen krachtdata" is een uitspraak
// over de app. Ze voelen totaal verschillend, en alleen de tweede is waar
// zolang er nooit iets is ingevuld (§17 van 2C).
export function strengthDataState({ asOf = todayLocal() } = {}) {
  const ooit = series('strength_volume', { asOf });
  const recent = series('strength_volume', { asOf, since: addDays(asOf, -13) });
  if (!ooit.length) {
    return { state: 'GEEN_DATA', sessions14: 0, everLogged: 0,
      label: 'geen krachtdata',
      note: 'Er is nog nooit een krachtsessie vastgelegd. Dat betekent niet dat je niet traint — het betekent dat de app het niet weet en er dus niets over kan zeggen.' };
  }
  if (!recent.length) {
    return { state: 'GEEN_RECENTE_SESSIES', sessions14: 0, everLogged: ooit.length,
      lastDate: ooit[ooit.length - 1].observedAt,
      label: 'geen krachtsessies in veertien dagen',
      note: `Laatste vastgelegde krachtsessie: ${ooit[ooit.length - 1].observedAt}. Er is wél historie, dus dit is een echte onderbreking en geen ontbrekende data.` };
  }
  return { state: 'ACTUEEL', sessions14: recent.length, everLogged: ooit.length,
    lastDate: recent[recent.length - 1].observedAt,
    label: `${recent.length} krachtsessie(s) in veertien dagen`,
    note: null };
}

// ── Loopeconomie: verslechtering of hormonale ruis? ─────────────
//
// Scenario 15 tegenover 16. Dezelfde waarneming — hartslag hoger bij
// hetzelfde tempo — betekent iets anders als er een herhaald cycluspatroon
// onder ligt dan wanneer het over meerdere cycluscontexten heen blijft
// staan.
export function economyReading({ logs = {}, currentDate = todayLocal() } = {}) {
  const econ = runEconomyTrend({ currentDate });
  const attributie = attributeSymptoms({ logs, currentDate });
  const positie = cyclePosition(currentDate, { asOf: currentDate });

  if (!econ.enough) {
    return { known: false, verdict: 'ONBEKEND', note: econ.note,
      missing: ['looptempo bij hartslag'] };
  }

  const slechter = econ.gainSec < -5 || econ.hrDrift > 3;
  if (!slechter) {
    return { known: true, verdict: econ.gainSec > 5 ? 'VERBETERT' : 'STABIEL',
      gainSec: econ.gainSec, hrDrift: econ.hrDrift, note: econ.verdict };
  }

  // Het onderscheid: is dit één cycluscontext of loopt het er dwars doorheen?
  const punten = econ.points || [];
  const contexten = new Set(punten
    .filter(p => p.date >= addDays(currentDate, -28))
    .map(p => cyclePosition(p.date, { asOf: currentDate }).phase)
    .filter(f => f && f !== PHASE.UNKNOWN));

  const patroon = positie.phase !== PHASE.UNKNOWN
    ? phasePattern('hr_rest', positie.phase, { asOf: currentDate })
    : { known: false };
  const hormonaalPlausibel = attributie.attribution === ATTRIBUTION.HORMONAL &&
    (patroon.known || attributie.supportingPatterns?.length > 0);

  // Over meerdere fasen heen slechter, zonder hormonale verklaring: dat is
  // een structurele trend en die hoort serieus genomen te worden.
  if (contexten.size >= 2 && !hormonaalPlausibel) {
    return { known: true, verdict: 'VERSLECHTERT',
      gainSec: econ.gainSec, hrDrift: econ.hrDrift, phases: [...contexten],
      structural: true,
      note: `Je looptempo bij dezelfde hartslag is over ${contexten.size} verschillende cyclusfasen heen slechter geworden (${econ.hrDrift > 0 ? `hartslag +${econ.hrDrift}` : `${econ.gainSec} sec/km`}). Dat is niet met je cyclus te verklaren; dit is een structurele trend.` };
  }

  return { known: true, verdict: 'MOGELIJK_HORMONAAL',
    gainSec: econ.gainSec, hrDrift: econ.hrDrift, phases: [...contexten],
    structural: false,
    note: `Je hartslag ligt hoger bij hetzelfde tempo, maar dit valt samen met ${hormonaalPlausibel ? 'een hormonaal patroon dat je eerder had' : 'één cycluscontext'} en je herstel is normaal. Dat is waarschijnlijker hormonale ruis dan conditieverlies — nog niet als achteruitgang boeken.` };
}

// ── Wat de foto's zeggen, en hoe hard ──────────────────────────
export function photoReading({ asOf = todayLocal() } = {}) {
  const analyses = loadAnalyses().filter(a => a.to <= asOf && a.method === 'visual');
  if (!analyses.length) {
    return { known: false, count: 0, direction: null,
      confidence: PHOTO_CONFIDENCE.NONE,
      note: 'Er is nog niet werkelijk naar de foto\'s gekeken. Een oordeel over lichaamssamenstelling steunt hier alleen op cijfers.',
      missing: ['visuele fotovergelijking'] };
  }

  const laatste = analyses[0];
  const convergent = convergentFindings({ asOf });

  // De richting: het veld overall_direction, en anders het gemiddelde van de
  // velden die iets zeggen.
  const schaal = ANALYSIS_FIELDS.find(f => f.id === 'overall_direction');
  const richtingWaarde = laatste.fields?.overall_direction;
  const midden = Math.floor(schaal.scale.length / 2);
  const index = richtingWaarde ? schaal.scale.indexOf(richtingWaarde) : midden;
  const richting = index > midden ? 'GUNSTIG' : index < midden ? 'ONGUNSTIG' : 'GELIJK';

  // Bij lage vergelijkbaarheid mag er geen stellige uitspraak uit komen.
  const zwak = [PHOTO_CONFIDENCE.LOW, PHOTO_CONFIDENCE.NONE].includes(laatste.confidence);

  return {
    known: true,
    count: analyses.length,
    lastDate: laatste.to,
    direction: zwak ? 'ONZEKER' : richting,
    rawDirection: richting,
    confidence: laatste.confidence,
    weak: zwak,
    convergent,
    fields: laatste.fields,
    note: zwak
      ? `De laatste vergelijking (${laatste.to}) had een lage vergelijkbaarheid${laatste.confidenceReason ? `: ${laatste.confidenceReason}` : ''}. Wat je op die beelden ziet kan net zo goed licht, houding of kleding zijn. Hier hoort geen conclusie over lichaamssamenstelling uit te komen.`
      : `Visuele vergelijking van ${laatste.to} (zekerheid ${laatste.confidence}): ${richting.toLowerCase()}. ${convergent.note}`,
  };
}

// ── Het besluit ─────────────────────────────────────────────────
export function coachDecision({ logs = null, currentDate = todayLocal() } = {}) {
  const asOf = currentDate;
  const daglogs = logs || daglogsUitOpslag(asOf);

  const lim = weeklyLimiter({ logs: daglogs, currentDate: asOf });
  const pese = peseState({ logs: daglogs, currentDate: asOf });
  const risico = longCovidRisk({ logs: daglogs, currentDate: asOf });
  const attributie = attributeSymptoms({ logs: daglogs, currentDate: asOf });
  const balans = trainingBalance({ logs: daglogs, currentDate: asOf });
  const voorstel = progressionProposal({ logs: daglogs, currentDate: asOf });
  const recomp = recompositionSignal({ asOf });
  const kracht = strengthDataState({ asOf });
  const economie = economyReading({ logs: daglogs, currentDate: asOf });
  const fotos = photoReading({ asOf });
  const cyclus = cyclePosition(asOf, { asOf });
  const regelmaat = cycleRegularity({ asOf });
  const dekking = completeness({ asOf });

  const evidence = [];
  const missing = [];
  const zeg = (s) => { if (s) evidence.push(s); };
  const mist = (s) => { if (s && !missing.includes(s)) missing.push(s); };

  // ── Trainingsbesluit ────────────────────────────────────────
  let training;
  if (risico.protection === 'volledig') {
    training = TRAINING_DECISION.PROTECT;
    zeg(risico.reason);
  } else if (pese.state === PESE.RED) {
    training = TRAINING_DECISION.REDUCE;
    zeg(pese.reason);
  } else if (!voorstel.build) {
    training = TRAINING_DECISION.HOLD;
    zeg(voorstel.reason);
  } else if (balans.risk === RISK.UNDERTRAINING) {
    training = TRAINING_DECISION.PROGRESS_ACTIVELY;
    zeg(balans.note);
    zeg(`hefboom: ${voorstel.lever} — ${voorstel.step}`);
  } else {
    training = TRAINING_DECISION.PROGRESS;
    zeg(`hefboom: ${voorstel.lever} — ${voorstel.step}`);
  }
  zeg(`beperkende factor: ${LIMITER_NL[lim.primary]} (${lim.confidence})`);
  if (attributie.attribution === ATTRIBUTION.HORMONAL) zeg(attributie.explanation);

  // Ontbrekende hersteldata is geen groen licht, en mag ook nooit als
  // "geen PESE" gelezen worden (§11 van 2C).
  const zonderCheck = pese.sessionCount > 0 &&
    pese.signals.some(s => /zonder (ingevulde )?herstelcheck|niet ingevuld|geen enkele/.test(s));
  if (zonderCheck) mist('herstelrespons 24–48 uur bij de recente sessies');
  if (!pese.sessionCount) mist('recente trainingssessies');
  for (const m of dekking.missing) mist(m);
  if (economie.missing) for (const m of economie.missing) mist(m);
  if (fotos.missing) for (const m of fotos.missing) mist(m);
  if (kracht.state === 'GEEN_DATA') mist('krachtdata');

  // ── Lichaamssamenstelling ───────────────────────────────────
  const gewicht7 = rollingMean('weight', 7, { asOf });
  const gewichtVerandering = classifyChange('weight', { asOf });
  const mijlpaal = gewicht7 != null && gewicht7 <= 55.5;
  const krachtDaalt = kracht.state === 'ACTUEEL' &&
    (recomp.signal === 'TE_SNEL' ||
      series('strength_volume', { asOf, since: addDays(asOf, -28) }).length >= 2 &&
      trendDaalt('strength_volume', asOf));

  let body, weight, doelAanpassing = { type: GOAL_ADJUSTMENT.NONE, reason: null };

  if (mijlpaal && krachtDaalt) {
    // Scenario 10: het getal is gehaald maar de prijs was spierweefsel.
    body = BODY_DECISION.MUSCLE_PRESERVATION;
    weight = WEIGHT_STRATEGY.MAINTENANCE;
    doelAanpassing = { type: GOAL_ADJUSTMENT.HOLD,
      reason: 'Het 7-daags gemiddelde is op de mijlpaal, maar het krachtvolume daalt. Verder afvallen kost hier weefsel dat je nodig hebt. Eerst onderhoud en kracht terug.' };
    zeg(`7-daags gewicht ${gewicht7} kg op de mijlpaal, maar krachtvolume daalt`);
  } else if (mijlpaal) {
    // Scenario 9: expliciet evaluatiemoment, en 50 kg nooit automatisch.
    body = BODY_DECISION.EVALUATE;
    weight = WEIGHT_STRATEGY.MAINTENANCE;
    doelAanpassing = { type: GOAL_ADJUSTMENT.EVALUATE_MILESTONE,
      reason: 'Het 7-daags gemiddelde is bij 55 kg. Dat is een beslismoment, geen tussenstation: stabiliseren, rustig door naar 52–53 kg, of stoppen met afvallen. 50 kg wordt hier niet automatisch geactiveerd.',
      options: ['stabiliseren op dit gewicht', 'rustig door naar 52–53 kg', 'stoppen met afvallen en op recompositie sturen'] };
    zeg(`7-daags gewicht ${gewicht7} kg — evaluatiemoment bereikt`);
  } else if (recomp.signal === 'TE_SNEL') {
    // Scenario 3: tempo omlaag, spierbehoud omhoog.
    body = BODY_DECISION.MUSCLE_PRESERVATION;
    weight = WEIGHT_STRATEGY.REDUCE_DEFICIT;
    doelAanpassing = { type: GOAL_ADJUSTMENT.SLOW_DOWN, reason: recomp.note };
    zeg(recomp.note);
  } else if (recomp.signal === 'SNEL') {
    body = BODY_DECISION.MUSCLE_PRESERVATION;
    weight = WEIGHT_STRATEGY.REDUCE_DEFICIT;
    doelAanpassing = { type: GOAL_ADJUSTMENT.SLOW_DOWN, reason: recomp.note };
    zeg(recomp.note);
  } else if (recomp.signal === 'RECOMPOSITIE') {
    // Scenario 2A en 20: stilstand op de weegschaal is hier vooruitgang.
    body = BODY_DECISION.RECOMPOSITION;
    weight = WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT;
    zeg(recomp.note);
    if (fotos.known && fotos.direction === 'GUNSTIG') zeg(fotos.note);
  } else if (recomp.signal === 'OP_TEMPO') {
    body = BODY_DECISION.CONTINUE;
    weight = WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT;
    zeg(recomp.note);
  } else if (allesStaatStil({ asOf, gewicht7 })) {
    // Scenario 2B: gewicht, maten én kracht staan alle drie stil. Dat is geen
    // fluctuatie die verklaard moet worden maar een vlakke periode — en die
    // vraagt een beslissing, niet een geruststelling.
    body = BODY_DECISION.EVALUATE;
    weight = WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT;
    zeg('Gewicht, maten en kracht staan alle drie stil. Dat is het moment om te beoordelen of een kleine aanpassing zinvol is — niet om harder te gaan trainen of scherper te eten.');
  } else if (gewichtVerandering.verdict === CHANGE.TEMPORARY) {
    // Scenario 6: een piek die binnen haar eigen ruis of hormonale context
    // past, is geen vettoename.
    body = BODY_DECISION.CONTINUE;
    weight = WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT;
    for (const w of gewichtVerandering.why) zeg(w);
  } else if (gewicht7 == null) {
    body = BODY_DECISION.NO_JUDGEMENT;
    weight = WEIGHT_STRATEGY.INSUFFICIENT_DATA;
    mist('gewichtsmetingen');
  } else {
    // Scenario 2B: alles stabiel. Dat is geen mislukking en geen succes —
    // het is een moment om te beoordelen of een kleine aanpassing zin heeft.
    body = BODY_DECISION.EVALUATE;
    weight = WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT;
    zeg('Gewicht, maten en kracht staan alle drie stil. Dat is het moment om te beoordelen of een kleine aanpassing zinvol is — niet om harder te gaan trainen of scherper te eten.');
  }

  // Scenario 20: maten en kracht flink beter terwijl het gewicht boven de
  // oorspronkelijke lijn ligt. Dan is de lijn verkeerd, niet het lichaam.
  const lopend = activeMilestone({ asOf });
  if (lopend && body === BODY_DECISION.RECOMPOSITION) {
    const gewichtDoel = (lopend.targets || []).find(t => t.metric === 'weight');
    if (gewichtDoel && gewicht7 != null && gewicht7 > gewichtDoel.to + 0.5) {
      doelAanpassing = { type: GOAL_ADJUSTMENT.REVISE_TARGET,
        reason: `Je zit ${rond(gewicht7 - gewichtDoel.to, 1)} kg boven de gewichtslijn van dit tussendoel, maar je maten en kracht gaan de goede kant op. Dan klopt de lijn niet, niet je lichaam: het gewichtsdoel hoort naar boven bijgesteld te worden.`,
        proposal: { metric: 'weight', from: gewichtDoel.to, to: rond(gewicht7 - 0.5, 1) } };
      zeg(doelAanpassing.reason);
    }
  }

  // Het lichaamscompositiebesluit mag de training nooit remmen. Als de
  // strategie zegt "minder tekort" en het trainingsbesluit zegt "opbouwen",
  // dan blijven dat twee losse besluiten — geen compromis.
  const guardNote = 'Het lichaamscompositiedoel is nooit een reden om harder te trainen, minder te eten of minder te herstellen.';

  // ── Zekerheid ───────────────────────────────────────────────
  // De zwakste schakel telt. Een limiter met hoge zekerheid boven een
  // datadekking van 30% is geen hoog vertrouwen maar een mooi getal.
  const limiterWaarde = CONFIDENCE_VALUE[lim.confidence] ?? 0.35;
  const dekkingWaarde = CONFIDENCE_VALUE[dekking.confidence] ?? 0.35;
  let vertrouwen = Math.min(limiterWaarde, dekkingWaarde);
  if (zonderCheck) vertrouwen = Math.min(vertrouwen, 0.4);
  if (missing.length >= 5) vertrouwen = Math.min(vertrouwen, 0.4);

  // ── Volgende review ─────────────────────────────────────────
  const review = reviewDue({ asOf });
  const nextReview = lopend?.until || addDays(asOf, REVIEW_WEEKS * 7);

  return {
    asOf,
    primaryLimiter: lim.primary,
    primaryLimiterLabel: lim.primaryLabel,
    secondaryLimiter: lim.secondary,
    secondaryLimiterLabel: lim.secondaryLabel,
    limiterConfidence: limiterWaarde,
    trainingDecision: training,
    bodyCompositionDecision: body,
    weightStrategy: weight,
    confidence: rond(vertrouwen, 2),
    confidenceLabel: confidenceWord(vertrouwen),
    nextReviewDate: nextReview,
    reviewDue: review.due,
    goalAdjustment: doelAanpassing,
    evidence,
    missingData: missing,

    // De onderliggende lagen, zodat een scherm of test niet opnieuw hoeft
    // te rekenen om te laten zien waaróp dit steunt.
    detail: {
      pese: pese.state,
      protection: risico.protection,
      loadFactor: risico.loadFactor,
      attribution: attributie.attribution,
      balance: balans.risk,
      lever: voorstel.build ? voorstel.lever : null,
      leverStep: voorstel.build ? voorstel.step : null,
      recomposition: recomp.signal,
      weightMean7: gewicht7,
      weightChange: gewichtVerandering.verdict,
      strength: kracht,
      economy: economie,
      photos: fotos,
      cycleDay: cyclus.day ?? null,
      cyclePhase: cyclus.phase,
      cyclePhaseCertainty: cyclus.certainty ?? null,
      cycleRegular: regelmaat.regular ?? null,
      coverage: dekking.coverage,
    },
    guard: guardNote,
  };
}

// Staat werkelijk alles stil? Dit onderscheidt "een piek die verklaard moet
// worden" van "een vlakke periode". Beide leveren geen alarm op, maar het
// tweede vraagt een beslissing en het eerste een geruststelling — en dat is
// niet hetzelfde advies.
const STIL_KG = 0.35;
const STIL_CM = 0.6;

function vlak(metric, asOf, marge) {
  const s = series(metric, { asOf, since: addDays(asOf, -28) })
    .filter(o => typeof o.value === 'number');
  if (s.length < 2) return null;
  const waarden = s.map(o => o.value);
  return (Math.max(...waarden) - Math.min(...waarden)) <= marge;
}

function allesStaatStil({ asOf, gewicht7 }) {
  if (gewicht7 == null) return false;
  const g = vlak('weight', asOf, STIL_KG);
  const t = vlak('waist', asOf, STIL_CM);
  const n = vlak('navel', asOf, STIL_CM);
  const k = vlak('strength_volume', asOf, 1);
  // Minstens drie van de vier moeten bekend én vlak zijn. Met minder gegevens
  // is "alles staat stil" een uitspraak over de app, niet over het lichaam.
  const bekend = [g, t, n, k].filter(x => x !== null);
  if (bekend.length < 3) return false;
  return bekend.every(x => x === true);
}

function trendDaalt(metric, asOf) {
  const s = series(metric, { asOf, since: addDays(asOf, -28) })
    .filter(o => typeof o.value === 'number');
  if (s.length < 2) return false;
  return s[s.length - 1].value < s[0].value;
}

function daglogsUitOpslag(asOf) {
  const uit = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('gc_log_')) continue;
      const l = JSON.parse(localStorage.getItem(k) || 'null');
      if (l?.date && l.date <= asOf) uit[l.date] = l;
    }
  } catch { /* opslag niet beschikbaar */ }
  return uit;
}

// ── De taalregels (§36) ─────────────────────────────────────────
//
// Wat de coach níet mag zeggen. Dit is geen stijlvoorkeur: "dit is PESE" en
// "dit komt door oestrogeen" zijn diagnoses, en een app die op zelfrapportage
// draait kan die niet stellen. De toegestane vormen staan er ook bij, zodat
// er iets te schrijven blijft.
export const FORBIDDEN_PHRASINGS = [
  { pattern: /\bdit (is|wordt veroorzaakt door) (PESE|post-?exertionele malaise)\b/i,
    why: 'stelt een diagnose die alleen een arts kan stellen' },
  { pattern: /\bveroorzaakt door (oestrogeen|progesteron|hormonen)\b/i,
    why: 'claimt een biochemisch mechanisme dat hier niet gemeten is' },
  { pattern: /\bhormonaal vet\b/i,
    why: 'bestaat niet als meetbare categorie' },
  // Diagnosetermen betrapt in beide woordvolgordes: "je hebt een burn-out"
  // én "dat je een burn-out hebt". Nederlands zet het werkwoord in een
  // bijzin achteraan, en een regex die dat niet weet laat de helft door.
  { pattern: /\bje\b[^.!?]{0,60}\b(burn-?out|overtraining|hypothyreo[iï]die|insulineresistentie|bijnieruitputting)\b/i,
    why: 'is een medische diagnose' },
];

export const ALLOWED_HEDGES = [
  'waarschijnlijk', 'past bij', 'lijkt samen te hangen met',
  'onvoldoende data', 'waarschijnlijker dan', 'kan wijzen op',
  'in jouw data zie ik',
];

// De opdracht zegt het precies: deze vormen mogen niet "zonder voldoende
// basis". Een uitspraak mét voorbehoud is dus toegestaan — "waarschijnlijk
// past dit bij overtraining" is een hypothese, "je hebt overtraining" is een
// diagnose. Daarom wordt er per zin gekeken of er een voorbehoud in staat.
function zinnen(tekst) {
  return tekst.split(/(?<=[.!?])\s+/).filter(z => z.trim());
}

function heeftVoorbehoud(zin) {
  const l = zin.toLowerCase();
  return ALLOWED_HEDGES.some(h => l.includes(h)) ||
    /\b(lijkt|zou kunnen|misschien|mogelijk|vermoedelijk|niet zeker)\b/.test(l);
}

export function checkPhrasing(tekst) {
  if (!tekst) return { ok: true, violations: [] };
  const overtredingen = [];
  for (const zin of zinnen(tekst)) {
    for (const f of FORBIDDEN_PHRASINGS) {
      if (!f.pattern.test(zin)) continue;
      // "hormonaal vet" en "veroorzaakt door oestrogeen" blijven fout, ook
      // met een voorbehoud: het zijn geen te zwakke uitspraken maar
      // categorieën die niet bestaan of niet gemeten zijn.
      const mildbaar = /burn-?out|overtraining|hypothyreo|insulineresistentie|bijnieruitputting/i.test(zin);
      if (mildbaar && heeftVoorbehoud(zin)) continue;
      overtredingen.push({ match: (zin.match(f.pattern) || [])[0], sentence: zin.trim(), why: f.why });
    }
  }
  return { ok: overtredingen.length === 0, violations: overtredingen };
}

// De instructie die met de prompt meegaat.
export function phrasingInstruction() {
  return [
    'TAALREGELS — GEEN PSEUDO-MEDISCHE STELLIGHEID:',
    `  Toegestaan: ${ALLOWED_HEDGES.join(', ')}.`,
    '  Verboden zonder harde basis: "dit is PESE", "veroorzaakt door oestrogeen", "hormonaal vet",',
    '  of welke diagnose dan ook. Je beschrijft patronen in haar eigen data, je stelt niets vast.',
    '  Waar de data te dun zijn, schrijf je dat op als uitkomst — niet als voorzichtig geformuleerde gok.',
  ].join('\n');
}

// ── Het besluit als tekst voor de prompt (§35) ──────────────────
// De coach krijgt het besluit als skelet mee en schrijft daar de mensentaal
// omheen. Zo kan de tekst niet iets anders beweren dan het besluit — en is
// het besluit toetsbaar zonder de tekst te lezen.
export function decisionAsText(d) {
  const L = [];
  L.push('BESLUIT (gestructureerd, door de app berekend uit haar longitudinale data):');
  L.push(JSON.stringify({
    primaryLimiter: d.primaryLimiter,
    secondaryLimiter: d.secondaryLimiter,
    limiterConfidence: d.limiterConfidence,
    trainingDecision: d.trainingDecision,
    bodyCompositionDecision: d.bodyCompositionDecision,
    weightStrategy: d.weightStrategy,
    confidence: d.confidence,
    nextReview: d.nextReviewDate,
    goalAdjustment: d.goalAdjustment,
    missingData: d.missingData,
  }, null, 2));
  L.push('');
  L.push('ONDERBOUWING:');
  for (const e of d.evidence) L.push(`  · ${e}`);
  if (d.missingData.length) {
    L.push('');
    L.push(`ONTBREKEND: ${d.missingData.join(', ')}.`);
    L.push('  Benoem deze onzekerheid expliciet. Ontbrekende data is nooit een groen signaal,');
    L.push('  en "geen gegevens over PESE" is iets anders dan "geen PESE".');
  }
  L.push('');
  L.push(`GRENS: ${d.guard}`);
  L.push('');
  L.push('Schrijf je advies binnen dit besluit. Je mag het toelichten, nuanceren en in haar taal');
  L.push('zetten, maar niet tegenspreken. Wijkt de data volgens jou af van het besluit, zeg dat dan');
  L.push('met zoveel woorden in plaats van er stilzwijgend omheen te schrijven.');
  L.push('');
  L.push(phrasingInstruction());
  return L.join('\n');
}
