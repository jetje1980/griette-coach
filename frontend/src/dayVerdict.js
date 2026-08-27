// Het dagoordeel: groen, amber, blauw of rood — en waaróm amber.
//
// Dit is geen nieuwe engine. De scoring hieronder stond woordelijk in
// CoachAdvice.jsx en is hierheen verplaatst, met dezelfde signalen, dezelfde
// gewichten en dezelfde drempels. Er is een test die vastlegt dat het oordeel
// voor elke invoer identiek blijft aan wat het was.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT VERHUISDE
//
// Amber was alleen een kleur. De rustdagpoort zei letterlijk "lopen mag, maar
// korter", en vervolgens schreef de planner exact dezelfde sessie voor als op
// een groene dag. De bedoeling stond in de tekst, niet in de dosering.
//
// Om dat te repareren moet de planner weten dát het amber is. Dat kon op twee
// manieren: het oordeel nog eens narekenen in raceplan — en dan heb je twee
// definities die vroeg of laat uit elkaar lopen — of het oordeel op één plek
// zetten waar allebei bij kunnen. Dit is die plek.
//
// ─────────────────────────────────────────────────────────────────
// FYSIEKE AMBER ≠ CONTEXTUELE AMBER
//
// Niet elke amber is hetzelfde. Slecht geslapen met hersenmist is iets anders
// dan een drukke dag waarop je zelf "minimum" hebt aangevinkt terwijl je
// lichaam prima is. Het eerste hoort de dosis te verlagen; het tweede hoort
// alleen te voorkomen dat er iets bij komt.
//
// De scheiding gaat langs de signalen zelf: slaap, energie, herstelgevoel,
// symptomen, vertraagde respons en recente belasting zijn fysiek. Stress, een
// overweldigd gevoel en een zelfgekozen minimumdag zijn context. Staat er geen
// enkel fysiek signaal in het rood, dan is de amber contextueel.
// ─────────────────────────────────────────────────────────────────

import { todayLocal } from './datetime';

export const DECISION = { GREEN: 'GREEN', AMBER: 'AMBER', BLUE: 'BLUE', RED: 'RED' };
export const AMBER_KIND = { PHYSICAL: 'PHYSICAL', CONTEXTUAL: 'CONTEXTUAL' };

function prevDate(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// Wat is voor haar een normale ochtendstand? Zes weken terug, mediaan plus
// een eigen spreiding. Onder zes metingen is er geen basislijn en dus geen
// oordeel — dan zwijgt dit signaal liever dan dat het gokt.
export const BATTERY_MIN_N = 6;

export function batteryBaseline(logs, currentDate = todayLocal(), days = 42) {
  const waarden = [];
  for (let i = 1; i <= days; i++) {
    const l = logs?.[prevDate(currentDate, i)];
    if (l?.battery_start != null) waarden.push(Number(l.battery_start));
  }
  if (waarden.length < BATTERY_MIN_N) {
    return { known: false, n: waarden.length,
      note: `Nog te weinig batterijstanden (${waarden.length} van ${BATTERY_MIN_N}) om te weten wat voor jou normaal is.` };
  }
  const gem = avg(waarden);
  const afw = waarden.map(v => Math.abs(v - gem)).sort((a, b) => a - b);
  const mad = afw[Math.floor(afw.length / 2)];
  const band = Math.max(mad * 1.5, 4);
  return {
    known: true, n: waarden.length,
    mean: Math.round(gem), band: Math.round(band),
    min: Math.min(...waarden), max: Math.max(...waarden),
    note: `Je start normaal rond ${Math.round(gem)}% (${Math.min(...waarden)}–${Math.max(...waarden)}% over ${waarden.length} dagen).`,
  };
}

// ── De signalen ─────────────────────────────────────────────────
export function daySignals(log, logs, currentDate = todayLocal()) {
  const yest = logs?.[prevDate(currentDate, 1)] ?? {};
  const d2   = logs?.[prevDate(currentDate, 2)] ?? {};
  const d3   = logs?.[prevDate(currentDate, 3)] ?? {};

  const sleepQ = log?.sleep_quality;
  const sleepH = log?.sleep_hours;
  const energy = log?.energy;
  const recovToday = log?.training_recovery;

  const pemToday = recovToday === 2 || log?.symptom_pem;
  const pemYest  = yest?.training_recovery === 2 || yest?.symptom_pem;

  const symptomCount = [
    log?.symptom_pem, log?.symptom_exhaustion, log?.symptom_breathless,
    log?.symptom_brainfog, log?.symptom_pain,
  ].filter(Boolean).length;

  // ── Batterij: haar eigen normaal, niet dat van een gemiddelde ──
  //
  // Hier stond `battStart <= 30`. Dat is een drempel uit het niets, en voor
  // haar precies verkeerd om: vorig jaar eindigde ze structureel op 5, deze
  // weken start ze tussen 18 en 25. Met een vaste 30 telde elke dag als
  // "batterij laag gestart" — juist in de periode waarin het beter gaat dan
  // het ooit was. Dat is geen veiligheid maar blindheid voor vooruitgang.
  //
  // Nu telt het pas als signaal wanneer ze onder haar éígen basislijn zakt.
  const battStart = log?.battery_start;
  const battBase = batteryBaseline(logs, currentDate);
  const battLow = battStart != null && battBase.known
    ? battStart < battBase.mean - battBase.band
    // Zonder basislijn geen oordeel. Een ontbrekende referentie is geen
    // reden om een lage waarde te veronderstellen.
    : false;
  const battBelowOwn = battLow;
  const stressHigh = log?.low_stress === 0 || log?.low_stress === false;
  const overwhelmed = !!log?.adhd_overwhelmed;

  const yestTrained = yest?.run_done || yest?.core_done ||
    (yest?.training_zone && yest?.training_zone !== 'rust');
  const delayedBad = yestTrained && (
    log?.delayed_fatigue || log?.delayed_brainfog || log?.delayed_breathless ||
    symptomCount >= 2);

  const recentTrainDays = [log, yest, d2, d3].filter(l =>
    l?.run_done || l?.core_done || (l?.training_zone && l?.training_zone !== 'rust')).length;

  const zoneC2 = yest?.training_zone === 'C' && d2?.training_zone === 'C';

  return {
    sleepQ, sleepH, avgSleepH: avg([sleepH, yest.sleep_hours, d2.sleep_hours].filter(Boolean)),
    energy, recovToday, pemToday, pemYest, symptomCount,
    battStart, battLow, battBelowOwn, battBaseline: battBase,
    stressHigh, overwhelmed,
    delayedBad, recentTrainDays, zoneC2,
    dayCapacity: log?.day_capacity ?? null,
  };
}

// ── Het oordeel ─────────────────────────────────────────────────
// Ongewijzigd overgenomen. Elke regel hier stond in CoachAdvice.
export function dayVerdict(log, logs, currentDate = todayLocal()) {
  const s = daySignals(log, logs, currentDate);

  let score = 5;
  if (s.sleepQ != null) score += (s.sleepQ - 1.5) * 1.0;
  if (s.energy != null) score += (s.energy - 1.5) * 1.0;
  if (s.recovToday === 2) score -= 4;
  else if (s.recovToday === 1) score -= 1.5;
  score -= s.symptomCount * 1.2;
  if (s.battLow) score -= 1;
  if (s.stressHigh) score -= 0.5;
  if (s.delayedBad) score -= 2.5;
  if (s.recentTrainDays >= 3) score -= 1;
  if (s.zoneC2) score -= 2;

  const hardRed = s.pemToday || s.pemYest || s.symptomCount >= 3 || s.zoneC2 ||
    (s.sleepH != null && s.sleepH < 4.5);

  let decision;
  if (hardRed) decision = DECISION.RED;
  else if (score <= 1.5) decision = DECISION.BLUE;
  else if (score <= 3.5) decision = DECISION.AMBER;
  else decision = DECISION.GREEN;

  if (s.dayCapacity === 'herstel' && decision === DECISION.GREEN) decision = DECISION.BLUE;
  if (s.dayCapacity === 'herstel' && decision === DECISION.AMBER) decision = DECISION.BLUE;
  if (s.dayCapacity === 'minimum' && decision === DECISION.GREEN) decision = DECISION.AMBER;

  return { decision, score: +score.toFixed(2), signals: s, ...amberKind(decision, s) };
}

// ── Fysiek of context? ──────────────────────────────────────────
function amberKind(decision, s) {
  if (decision !== DECISION.AMBER) {
    return { amberKind: null, amberReasons: [] };
  }

  // Fysieke signalen. Elk hiervan zegt iets over het lichaam van vandaag —
  // niet over de agenda.
  const fysiek = [];
  if (s.energy != null && s.energy <= 1) fysiek.push('lage energie');
  if (s.sleepQ != null && s.sleepQ <= 1) fysiek.push('slecht geslapen');
  if (s.recovToday === 1) fysiek.push('herstelgevoel matig');
  if (s.symptomCount >= 1) fysiek.push('actieve klachten');
  if (s.delayedBad) fysiek.push('vertraagde respons op gisteren');
  if (s.recentTrainDays >= 3) fysiek.push('drie belastingsdagen in vier');
  if (s.battLow) {
    fysiek.push(s.battBaseline?.known
      ? `batterij ${s.battStart}% tegenover je eigen normaal van ${s.battBaseline.mean}%`
      : 'batterij laag gestart');
  }

  if (fysiek.length) {
    return { amberKind: AMBER_KIND.PHYSICAL, amberReasons: fysiek };
  }

  // Alles wat overblijft is context: stress, overweldiging, of een dag die je
  // zelf op minimum hebt gezet zonder dat je lichaam iets meldt.
  const context = [];
  if (s.dayCapacity === 'minimum') context.push('je zette de dag zelf op minimum');
  if (s.stressHigh) context.push('stress hoog');
  if (s.overwhelmed) context.push('overweldigd gevoel');

  return {
    amberKind: AMBER_KIND.CONTEXTUAL,
    amberReasons: context.length ? context : ['gemengde signalen zonder fysiek alarm'],
  };
}
