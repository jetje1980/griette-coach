// Easy pace is geen doel. Het is een meting.
//
// In de doelenlijst stond "Easy tempo, 7 min/km" als racedoel. Daarmee werd
// het tempo van 3 oktober behandeld als het tempo waarop je nu rustig zou
// moeten lopen. Dat is precies verkeerd om:
//
//   RACE PACE   waar je naartoe werkt. Volgt uit afstand en gewenste tijd.
//   EASY PACE   wat je lichaam vandaag rustig aankan. Volgt uit je data.
//
// Ze hebben verschillende bronnen en bewegen onafhankelijk. Verander je je
// doeltijd van 35 naar 30 minuten, dan verandert je racetempo — en je easy
// pace niet, want je lichaam weet nog nergens van.
//
// Deze easy pace komt uit echte hardloopsegmenten, niet uit sessietempo's:
// wie de wandelblokken meetelt meet vooral hoeveel er gewandeld is.

import { todayLocal, addDays } from './datetime';
import { allBreakdowns, runEconomyTrend } from './pace';
import { exertionalResponse } from './symptoms';
import { loadHrModel } from './hrModel';
import { fmtPaceSec, paceToSec } from './sessionMath';

export const CONFIDENCE = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW', NONE: 'NONE' };

// Hoe ver terug we kijken. Verder dan drie maanden zegt weinig over nu.
const WINDOW_DAYS = 90;

export function easyRunPace({ logs = {}, currentDate = todayLocal() } = {}) {
  const hr = loadHrModel();
  const since = addDays(currentDate, -WINDOW_DAYS);

  const rows = allBreakdowns({ limit: 40, currentDate })
    .filter(b => b.workout.date >= since)
    // Alleen sessies waarin loopblokken te scheiden waren: het gaat om
    // looptempo, niet om sessietempo.
    .filter(b => b.runPace != null && b.runHr != null)
    .map(b => {
      const r = exertionalResponse({ workoutDate: b.workout.date, logs, currentDate });
      return {
        date: b.workout.date,
        runPace: b.runPace, runHr: b.runHr,
        runMinutes: b.runMinutes,
        status: r.status,
        tolerated: r.countsAsVolume,
        allowsBuild: r.allowsBuild,
        drift: b.workout.hrFirstHalf != null && b.workout.hrSecondHalf != null
          ? b.workout.hrSecondHalf - b.workout.hrFirstHalf : null,
        rpe: b.workout.rpe != null ? Number(b.workout.rpe) : null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Alleen wat goed verdragen is telt mee. Een snelle sessie waar je slecht
  // van herstelde zegt niets over wat "rustig" voor jou is.
  const usable = rows.filter(r => r.tolerated);

  // En binnen het easy-richtgebied: harder gelopen sessies vertellen iets
  // anders dan wat we hier willen weten.
  const inBand = usable.filter(r =>
    r.runHr >= hr.easyTargetLow - 8 && r.runHr <= hr.easyTargetHigh + 6);

  const pool = inBand.length >= 3 ? inBand : usable;

  if (!pool.length) {
    return {
      available: false, confidence: CONFIDENCE.NONE,
      paceSecPerKm: null, paceLabel: null,
      observations: rows.length, usable: usable.length,
      note: rows.length
        ? 'Er zijn wel runs, maar nog geen die schoon verdragen én met loopblokken te scheiden waren. ' +
          'Zonder dat blijft je easy tempo een aanname.'
        : 'Nog geen sessies waarin loop- en wandelblokken te scheiden waren. ' +
          'Zet ronden aan op je horloge, dan verschijnt dit vanzelf.',
      reason: 'onvoldoende data',
    };
  }

  // De mediaan, niet het gemiddelde: één trage sessie in de regen mag het
  // beeld niet kantelen.
  const paces = pool.map(r => r.runPace).sort((a, b) => a - b);
  const median = paces[Math.floor(paces.length / 2)];
  const hrs = pool.map(r => r.runHr).sort((a, b) => a - b);
  const medianHr = hrs[Math.floor(hrs.length / 2)];

  // Recente sessies wegen zwaarder dan oude.
  const recent = pool.filter(r => r.date >= addDays(currentDate, -28));
  const recentPaces = recent.map(r => r.runPace).sort((a, b) => a - b);
  const recentMedian = recentPaces.length
    ? recentPaces[Math.floor(recentPaces.length / 2)] : null;

  const current = recentMedian ?? median;

  // De trend: word je sneller bij dezelfde hartslag?
  const econ = runEconomyTrend({ currentDate });

  // Drift en RPE als tegenwicht: gaat het tempo omlaag maar loopt de
  // hartslag op of voelt het zwaarder, dan is dit niet je easy tempo.
  const drifts = pool.map(r => r.drift).filter(d => d != null);
  const avgDrift = drifts.length
    ? drifts.reduce((s, d) => s + d, 0) / drifts.length : null;
  const rpes = pool.map(r => r.rpe).filter(x => x != null);
  const avgRpe = rpes.length ? rpes.reduce((s, x) => s + x, 0) / rpes.length : null;

  const confidence = pool.length >= 6 && inBand.length >= 3 ? CONFIDENCE.HIGH
    : pool.length >= 3 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW;

  // Het richtgebied rond de mediaan: een tempo is nooit één getal.
  const spread = Math.max(0.25, median * 0.05);

  return {
    available: true, confidence,
    paceSecPerKm: paceToSec(current),
    paceLabel: fmtPaceSec(paceToSec(current)),
    paceMin: +current.toFixed(2),
    range: {
      fast: +(current - spread).toFixed(2),
      slow: +(current + spread).toFixed(2),
      label: `${fmtPaceSec(paceToSec(current - spread))}–${fmtPaceSec(paceToSec(current + spread))}`,
    },
    atHr: medianHr,
    observations: rows.length,
    usable: pool.length,
    inBand: inBand.length,
    trendSecPerKm: econ.enough ? econ.gainSec : null,
    trendHonest: econ.enough ? econ.honest : null,
    avgDrift: avgDrift != null ? +avgDrift.toFixed(1) : null,
    avgRpe: avgRpe != null ? +avgRpe.toFixed(1) : null,

    note: `Afgeleid uit ${pool.length} goed verdragen sessie(s) met te scheiden loopblokken, ` +
      `bij een loophartslag rond ${medianHr}.` +
      (econ.enough && econ.gainSec > 0 && econ.honest
        ? ` Je wint op dit moment ${econ.gainSec} sec/km bij vergelijkbare hartslag.`
        : ''),

    // De regel die verwarring met racetempo moet voorkomen.
    caveat: 'Dit is je huidige rustige looptempo, geen doel. Je racetempo volgt uit ' +
      'afstand en gewenste eindtijd en staat hier los van.',
  };
}

// Voor de sessieplanner: welk tempo hoort bij welk doel?
// Easy en durability volgen je gemeten easy pace. Racespecifiek werk volgt
// het doeltempo. Quality-lite zit er bewust tussenin.
// De gemeten tempo's in de vorm die sessionMath verwacht.
//
// Hier zat vroeger een schemastring achter: elke sessie in de bibliotheek had
// "Looptempo: ~9:15-9:45 min/km" naast zich staan, en daar werd de afstand
// uit geparsed. Dat gaf een afstand die klopte bij wat iemand in augustus
// dacht, niet bij wat jij loopt. Nu komt de bandbreedte uit je eigen
// verdragen sessies — of er komt niets, en dan staat er ook geen afstand.
export function measuredPaces({ logs = {}, currentDate = todayLocal() } = {}) {
  const easy = easyRunPace({ logs, currentDate });
  if (!easy.available) return null;

  // Het wandeltempo wordt hier afgeleid, niet opgehaald. Het gemeten
  // wandeltempo binnen runs zit in racePerformance.raceWalkPace() — maar dat
  // bestand importeert dít bestand al, en een kringetje tussen twee modules
  // levert bij het opstarten ondefinieerde waarden op. Voor een
  // afstandsschatting op het planoverzicht is de afleiding genoeg; waar het
  // gemeten wandeltempo écht telt (de racevoorspelling) wordt het wél
  // gebruikt.
  //
  // De regel: een wandelpauze is langzamer dan het blok ervoor. Vijftien tot
  // vijfentwintig procent, wat overeenkomt met wat er in haar eigen
  // afgeleide segmenten terugkomt.
  return {
    runFast: easy.range.fast,
    runSlow: easy.range.slow,
    walkFast: +(easy.range.slow * 1.15).toFixed(2),
    walkSlow: +(easy.range.slow * 1.25).toFixed(2),
    source: 'gemeten looptempo; wandeltempo afgeleid',
    confidence: easy.confidence,
  };
}

export function prescribedPace({ purpose, goal = null, easy = null,
  logs = {}, currentDate = todayLocal() }) {
  const e = easy || easyRunPace({ logs, currentDate });
  const easyMin = e.available ? e.paceMin : null;
  const raceMin = goal?.targetPaceSecPerKm != null ? goal.targetPaceSecPerKm / 60 : null;

  switch (purpose) {
    case 'FIVE_K_SPECIFIC':
    case 'TEN_K_SPECIFIC':
      return { paceMin: raceMin, source: 'race_goal',
        why: `Het doeltempo van ${goal?.distanceKm} km in ${Math.round(goal?.targetTimeSec / 60)} minuten.` };
    case 'QUALITY_LITE': {
      if (easyMin == null) return { paceMin: null, source: 'unknown', why: 'nog geen gemeten easy tempo' };
      // Halverwege easy en racetempo, maar nooit sneller dan racetempo:
      // dit blok is een aanloop, geen wedstrijd.
      const target = raceMin != null
        ? Math.max(raceMin, easyMin - (easyMin - raceMin) * 0.4)
        : easyMin - 0.5;
      return { paceMin: +target.toFixed(2), source: 'between',
        why: 'Tussen je rustige tempo en je racetempo in — merkbaar sneller, zonder de herstelprijs.' };
    }
    case 'RECOVERY':
      return { paceMin: easyMin != null ? +(easyMin + 0.5).toFixed(2) : null, source: 'easy',
        why: 'Rustiger dan rustig.' };
    default:
      return { paceMin: easyMin, source: 'easy',
        why: e.available ? e.note : 'nog geen gemeten easy tempo' };
  }
}
