// Eén herstelbudget voor alles.
//
// Het probleem dat dit oplost: hardlopen, kracht, wandelen, werk en leven
// putten uit dezelfde pot, maar werden apart beoordeeld. De looppoort keek
// naar loopbelasting, de krachtpoort naar krachtbelasting, en niemand keek
// naar de optelsom. Zo kan een dag "kracht mag" zeggen terwijl er gisteren
// gelopen is, vannacht vijf uur geslapen en er vanmiddag een vergadering van
// drie uur staat.
//
// Wat dit bestand NIET doet: beslissen of je mag trainen. Die beslissing
// hoort bij restday.js en strengthGate.js, en die zijn al bewezen. Dit
// bestand krijgt hun uitkomst binnen en rekent alleen uit hoeveel ruimte er
// bovenop die beslissing nog is — en waarvoor.
//
// De volgorde is niet onderhandelbaar:
//
//   HARDE POORT  →  BUDGET  →  KANDIDATEN SCOREN
//
// Een dichte poort kan nooit worden weggescoord door een urgent doel. Wat
// hieronder gebeurt is verdelen wat er is, niet erbij verzinnen wat er niet is.

import { todayLocal, addDays } from './datetime';
import { trainingLoad } from './restday';
import { readSymptoms, exertionalResponse } from './symptoms';
import { strengthStats } from './strength';

export const BAND = {
  NONE: 'NONE',           // geen ruimte: herstel is de enige zinvolle investering
  LOW: 'LOW',             // kleine, zekere dingen
  MODERATE: 'MODERATE',   // één echte prikkel
  GOOD: 'GOOD',           // ruimte voor een volwaardige sessie
};

export const BAND_ORDER = [BAND.NONE, BAND.LOW, BAND.MODERATE, BAND.GOOD];

// Wat een actie ongeveer aan herstel kost, op dezelfde schaal als het budget.
// Grove getallen met opzet: het gaat om de verhouding, niet om de precisie.
export const COST = {
  rest: 0,
  micro: 3,          // twee minuten iets klaarleggen
  admin: 5,          // een check invullen, een blok blokkeren
  walk: 8,
  easyRun: 25,
  qualityRun: 45,
  strengthShort: 20,
  strengthFull: 35,
  lifeLoad: 10,
};

const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function logsIn(logs, currentDate, days) {
  const from = addDays(currentDate, -(days - 1));
  return Object.values(logs || {})
    .filter(l => l?.date && l.date >= from && l.date <= currentDate);
}

/**
 * Het herstelbudget van vandaag.
 *
 * runGate en strengthGate worden ingegeven, niet opnieuw berekend — dat is
 * precies het punt: er komt geen tweede waarheid naast de bewezen poorten.
 */
export function recoveryBudget({
  log = {}, logs = {}, currentDate = todayLocal(),
  runGate = null, strengthGate = null,
} = {}) {
  const reasons = [];
  const penalties = [];

  // ── De harde poort staat boven alles ──────────────────────────
  const hardBlock =
    runGate?.action === 'FULL_REST' ||
    strengthGate?.action === 'FULL_REST' ||
    !!log.symptom_pem ||
    log.training_recovery === 2;

  // ── Beginkapitaal ─────────────────────────────────────────────
  // Honderd is een normale dag met normale slaap en geen klachten. Alles
  // hieronder is een aftrek met een naam erbij; er wordt nergens stilletjes
  // iets afgehaald.
  let capacity = 100;

  // Slaap — niet als drempel maar als glijdende schaal. Een harde regel
  // "onder zeven uur niet trainen" klopt bij haar niet: er zijn nachten van
  // 6,5 uur waarna een rustige sessie prima valt.
  const sleepRows = logsIn(logs, currentDate, 7).filter(l => num(l.sleep_hours) != null);
  const sleepNow = num(log.sleep_hours);
  const sleepAvg = sleepRows.length
    ? sleepRows.reduce((a, l) => a + num(l.sleep_hours), 0) / sleepRows.length : null;

  if (sleepNow != null) {
    if (sleepNow < 5) { capacity -= 30; penalties.push({ what: 'slaap', cost: 30, note: `${sleepNow} uur vannacht` }); }
    else if (sleepNow < 6) { capacity -= 18; penalties.push({ what: 'slaap', cost: 18, note: `${sleepNow} uur vannacht` }); }
    else if (sleepNow < 6.5) { capacity -= 8; penalties.push({ what: 'slaap', cost: 8, note: `${sleepNow} uur vannacht` }); }
  }
  if (sleepAvg != null && sleepAvg < 6.5 && sleepRows.length >= 4) {
    capacity -= 10;
    penalties.push({ what: 'slaapschuld', cost: 10,
      note: `gemiddeld ${sleepAvg.toFixed(1)} uur deze week` });
  }

  // Energie zoals ze hem vandaag zelf inschat.
  const energy = num(log.energy);
  if (energy != null) {
    if (energy <= 1) { capacity -= 25; penalties.push({ what: 'energie', cost: 25, note: 'laag ingeschat' }); }
    else if (energy === 2) { capacity -= 10; penalties.push({ what: 'energie', cost: 10, note: 'matig ingeschat' }); }
    else if (energy >= 4) { capacity += 5; reasons.push('Je energie staat vandaag hoog.'); }
  }

  // Symptomen van vandaag, via de bestaande symptomenlezer — niet opnieuw
  // uitgevonden. Migraine telt hier als belasting, maar wordt nadrukkelijk
  // níet als PEM gelezen; dat onderscheid zit in symptoms.js.
  const sym = readSymptoms(log);
  if (sym.migraine.present) {
    capacity -= 25;
    penalties.push({ what: 'migraine', cost: 25,
      note: 'migraine is belastend, maar telt niet als PEM' });
  }
  if ((sym.headache.severity ?? 0) >= 2) {
    capacity -= 20;
    penalties.push({ what: 'hoofdpijn', cost: 20, note: 'stevige hoofdpijn vandaag' });
  }
  // Diffuse, grieperige spierpijn is een ander signaal dan spierpijn na een
  // zware set. Dat onderscheid staat in symptoms.js en wordt hier gelezen,
  // niet overgedaan.
  if (sym.muscle.type === 'diffuse' || sym.muscle.type === 'flu_like') {
    capacity -= 15;
    penalties.push({ what: 'spierpijn', cost: 15, note: 'diffuse, grieperige spierpijn' });
  } else if (sym.muscle.type === 'doms') {
    capacity -= 5;
    penalties.push({ what: 'spierpijn', cost: 5, note: 'gewone spierpijn na training' });
  }
  if (log.sick || log.illness) {
    capacity -= 40;
    penalties.push({ what: 'ziek', cost: 40, note: 'je gaf aan ziek te zijn' });
  }

  // Stress en overprikkeling — leven is ook belasting.
  if (log.adhd_overwhelmed || log.low_stress === 0 || log.low_stress === false) {
    capacity -= 12;
    penalties.push({ what: 'stress', cost: 12, note: 'drukke of overprikkelde dag' });
  }

  // De respons op de vorige sessie. Dit is haar gevoeligste signaal en het
  // enige dat 24 tot 48 uur later pas zichtbaar wordt.
  const load = trainingLoad(logs, currentDate);
  if (load.lastRunDate) {
    const resp = exertionalResponse({ workoutDate: load.lastRunDate, logs, currentDate });
    if (resp?.status === 'red') {
      capacity -= 45;
      penalties.push({ what: 'abnormale respons', cost: 45,
        note: `de sessie van ${load.lastRunDate} gaf rode signalen` });
    } else if (resp?.status === 'poor') {
      capacity -= 35;
      penalties.push({ what: 'vertraagde respons', cost: 35,
        note: `de sessie van ${load.lastRunDate} viel niet goed` });
    } else if (resp?.status === 'mild') {
      capacity -= 12;
      penalties.push({ what: 'vertraagde respons', cost: 12, note: 'lichte naklachten' });
    } else if (resp?.status === 'good') {
      reasons.push('De vorige sessie viel goed.');
    } else if (resp?.status === 'pending' || resp?.status === 'unanswered') {
      // Onbekend is geen groen licht. Maar het is ook geen rood: de poort
      // vraagt de check al op; het budget houdt alleen een marge aan.
      capacity -= 8;
      penalties.push({ what: 'onbekende respons', cost: 8,
        note: 'de herstelcheck van de vorige sessie staat nog open' });
    }
  }

  // Recente PEM-geschiedenis: een maand met signalen verkleint de pot ook op
  // een dag dat het toevallig meevalt.
  const recent = logsIn(logs, currentDate, 28);
  const pemCount = recent.filter(l =>
    l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2).length;
  if (pemCount >= 3) {
    capacity -= 20;
    penalties.push({ what: 'PEM-geschiedenis', cost: 20, note: `${pemCount} signalen in 28 dagen` });
  } else if (pemCount === 2) {
    capacity -= 10;
    penalties.push({ what: 'PEM-geschiedenis', cost: 10, note: '2 signalen in 28 dagen' });
  }

  capacity = clamp(Math.round(capacity), 0, 110);

  // ── Wat er al uit de pot is ───────────────────────────────────
  let spent = 0;
  const spentOn = [];
  if (log.run_done)      { spent += COST.easyRun;       spentOn.push('run vandaag'); }
  if (log.strength_done) { spent += COST.strengthFull;  spentOn.push('kracht vandaag'); }
  if (log.core_done && !log.strength_done) { spent += COST.strengthShort; spentOn.push('core vandaag'); }
  if (log.walk_done && !log.run_done)      { spent += COST.walk;          spentOn.push('wandeling vandaag'); }

  // Belasting van de afgelopen dagen weegt mee, aflopend: eergisteren telt
  // minder dan gisteren.
  const yesterday = logs?.[addDays(currentDate, -1)];
  const dayBefore = logs?.[addDays(currentDate, -2)];
  if (yesterday?.run_done || yesterday?.strength_done) { spent += 12; spentOn.push('gisteren getraind'); }
  if (dayBefore?.run_done || dayBefore?.strength_done) { spent += 5; }

  // Krachtvolume van de week telt mee in dezelfde pot — dat is het hele punt
  // van één budget in plaats van twee.
  const str = strengthStats(currentDate, 7);
  if (str.training >= 3) { spent += 10; spentOn.push(`${str.training} krachtsessies deze week`); }

  const remaining = clamp(capacity - spent, 0, 110);

  // ── De band ───────────────────────────────────────────────────
  const band = hardBlock ? BAND.NONE
    : remaining >= 55 ? BAND.GOOD
    : remaining >= 30 ? BAND.MODERATE
    : remaining >= 12 ? BAND.LOW
    : BAND.NONE;

  const note = hardBlock
    ? 'De poort staat dicht. Er is vandaag geen budget te verdelen — herstel is de investering.'
    : band === BAND.GOOD ? 'Er is ruimte voor een volwaardige sessie.'
    : band === BAND.MODERATE ? 'Er is ruimte voor één echte prikkel, niet voor twee.'
    : band === BAND.LOW ? 'Kleine, zekere dingen leveren vandaag meer op dan een plan.'
    : 'Je herstelruimte is op. Bewegen mag, belasten niet.';

  return {
    capacity, spent, remaining, band, hardBlock,
    note,
    penalties, spentOn, reasons,
    // Kan deze actie er nog bij? Kosten uit COST, of een eigen schatting.
    affords(cost) {
      if (hardBlock) return cost <= COST.admin;
      return cost <= remaining;
    },
    // Wat de poorten zeggen, doorgegeven zodat een scorer nooit hoeft te
    // raden of trainen überhaupt mag.
    gates: {
      run: runGate?.action || null,
      strength: strengthGate?.action || (strengthGate?.mayTrain ? 'MAY_TRAIN' : null),
      runReleased: runGate?.action === 'RUN_TODAY',
      strengthReleased: !!strengthGate?.mayTrain,
    },
    inputs: {
      sleepNow, sleepAvg: sleepAvg == null ? null : Math.round(sleepAvg * 10) / 10,
      energy, pemCount, migraine: sym.migraine.present,
      headache: sym.headache.severity ?? 0,
      lastRunDate: load.lastRunDate || null,
      runMin7: load.runMin7 ?? 0, runDays7: load.runDays7 ?? 0,
      strengthWeek: str.training,
    },
  };
}

// Leesbare samenvatting voor het scherm — één zin, geen tabel.
export function budgetLine(b) {
  if (!b) return null;
  if (b.hardBlock) return 'Herstel eerst — geen belasting vandaag.';
  const pct = Math.round((b.remaining / Math.max(1, b.capacity)) * 100);
  return `${pct}% van je herstelruimte is nog vrij. ${b.note}`;
}
