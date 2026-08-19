// Van doel naar actie — zonder dat de gebruiker zelf expert hoeft te zijn.
//
// Een doel is geen actie. "Frisser gezicht" zegt niets over wat je vandaag
// moet doen, en het is niet haar taak om uit te zoeken hoeveel slaap
// daarvoor uitmaakt of welke rol kracht daarin speelt. Dat is de taak van
// de coach.
//
// De keten die dit bestand onderhoudt:
//
//   DOEL → DRIVERS → BOTTLENECK → ACTIE → METING → REVIEW → AANPASSEN
//
// Twee regels die er altijd boven staan:
//   · nooit meer prikkel adviseren dan het herstel toelaat;
//   · nooit "meer discipline" als antwoord op herhaalde frictie.

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadGoals, goalTarget, loadHrSettings } from './goals';
import { loadWorkouts, toleranceFor } from './workouts';
import { strengthStats, patternCoverage, capacityChange } from './strength';
import { trainingLoad } from './restday';
import { runEconomyTrend } from './pace';
import { store } from './store';

const ACTION_LOG_KEY = 'gc_leverage_log';
const ROUTINE_KEY = 'gc_glow_routine';

// ── Driverdefinities ────────────────────────────────────────────
// Per domein: welke beïnvloedbare factoren doen ertoe, hoe meet je ze, en
// wat is de kleinste effectieve actie als deze de bottleneck blijkt?
//
// `assess` geeft { status: 'ok'|'thin'|'poor'|'unknown', value, note }.
// De driver met de slechtste status én het hoogste gewicht is de bottleneck.

const STATUS_RANK = { poor: 3, thin: 2, ok: 1, unknown: 0 };

function mkDriver(id, label, weight, assess, actions) {
  return { id, label, weight, assess, actions };
}

// Hulpjes over de laatste N dagen aan daglogs
function logsIn(logs, currentDate, days) {
  const from = addDays(currentDate, -(days - 1));
  return Object.values(logs || {})
    .filter(l => l.date && l.date >= from && l.date <= currentDate);
}

function avgOf(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// ── Gedeelde drivers ────────────────────────────────────────────
const sleepDriver = mkDriver('sleep', 'Slaap', 1.0,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 14).filter(l => l.sleep_hours != null);
    if (rows.length < 3) return { status: 'unknown', note: 'te weinig ingevulde nachten' };
    const h = avgOf(rows.map(l => Number(l.sleep_hours)));
    const q = avgOf(rows.map(l => l.sleep_quality).filter(x => x != null));
    const short = rows.filter(l => Number(l.sleep_hours) < 6.5).length;
    if (h < 6.5 || short >= rows.length / 2) {
      return { status: 'poor', value: h,
        note: `gemiddeld ${h.toFixed(1)} uur, ${short} van de ${rows.length} nachten onder 6,5 uur` };
    }
    if (h < 7 || (q != null && q < 1.5)) {
      return { status: 'thin', value: h, note: `gemiddeld ${h.toFixed(1)} uur; net aan` };
    }
    return { status: 'ok', value: h, note: `gemiddeld ${h.toFixed(1)} uur` };
  },
  [{ minutes: 5, text: 'Zet vanavond een alarm dat zegt dat je gaat afsluiten, niet dat je moet slapen.' },
   { minutes: 10, text: 'Bepaal nu je uiterste stoptijd voor werk en schermen, en zet hem in je agenda.' },
   { minutes: 0, text: 'Bescherm de avond: geen extra afspraak, geen late training.' }]);

const recoveryDriver = mkDriver('recovery', 'Herstel', 1.2,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 14);
    const pem = rows.filter(l => l.symptom_pem || l.recovery_check === 'bad' || l.training_recovery === 2).length;
    const answered = rows.filter(l => l.training_recovery != null || l.recovery_check).length;
    if (answered < 3) return { status: 'unknown', note: 'te weinig herstelchecks ingevuld' };
    if (pem >= 2) return { status: 'poor', value: pem, note: `${pem} PEM-signalen in 14 dagen` };
    if (pem === 1) return { status: 'thin', value: pem, note: '1 PEM-signaal in 14 dagen' };
    return { status: 'ok', value: 0, note: 'geen PEM-signalen in 14 dagen' };
  },
  [{ minutes: 0, text: 'Vandaag geen trainingsprikkel. Herstel is nu de investering met de hoogste opbrengst.' },
   { minutes: 5, text: 'Vul je herstelcheck in — zonder die data kan ik de opbouw niet sturen.' },
   { minutes: 20, text: 'Rustig wandelen of liggen; bewegen mag, belasten niet.' }]);

const stressDriver = mkDriver('stress', 'Stressbelasting', 0.8,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 14);
    const high = rows.filter(l => l.low_stress === 0 || l.low_stress === false || l.adhd_overwhelmed).length;
    if (rows.length < 4) return { status: 'unknown', note: 'te weinig dagen ingevuld' };
    if (high >= rows.length * 0.5) return { status: 'poor', value: high, note: `${high} van ${rows.length} dagen met hoge stress of overprikkeling` };
    if (high >= rows.length * 0.3) return { status: 'thin', value: high, note: `${high} drukke dagen in ${rows.length}` };
    return { status: 'ok', value: high, note: 'stressbeeld stabiel' };
  },
  [{ minutes: 10, text: 'Zet één blok van 30 minuten vrij in je agenda waarin niemand iets van je wil.' },
   { minutes: 5, text: 'Schrijf op wat er vandaag écht af moet. De rest mag morgen.' },
   { minutes: 1, text: 'Eén minuut naar buiten, zonder telefoon. Dat is genoeg om je systeem te laten zakken.' }]);

const proteinDriver = mkDriver('protein', 'Eiwit en volwaardige voeding', 1.0,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 14);
    const tracked = rows.filter(l => l.protein_ok != null || l.eiwit != null || l.protein != null);
    if (!tracked.length) {
      return { status: 'unknown',
        note: 'niet bijgehouden — in perimenopauze is eiwit een van de sterkste hefbomen voor spierbehoud' };
    }
    const ok = tracked.filter(l => l.protein_ok || Number(l.protein) >= 90).length;
    const pct = ok / tracked.length;
    if (pct < 0.5) return { status: 'poor', value: pct, note: `op ${Math.round(pct * 100)}% van de bijgehouden dagen genoeg eiwit` };
    if (pct < 0.75) return { status: 'thin', value: pct, note: `${Math.round(pct * 100)}% van de dagen genoeg eiwit` };
    return { status: 'ok', value: pct, note: 'eiwit is meestal op orde' };
  },
  [{ minutes: 5, text: 'Zorg dat je hoofdmaaltijd vandaag een stevige eiwitbron heeft — dat beschermt spier terwijl je vorm verandert.' },
   { minutes: 2, text: 'Leg voor morgen één eiwitrijk tussendoortje klaar, zodat de keuze al gemaakt is.' }]);

const strengthConsistencyDriver = mkDriver('strength_consistency', 'Krachtconsistentie', 1.2,
  ({ currentDate }) => {
    const s = strengthStats(currentDate, 28);
    if (s.training === 0) return { status: 'poor', value: 0, note: 'geen krachtsessies in 28 dagen' };
    if (s.perWeek < 1) return { status: 'poor', value: s.perWeek, note: `${s.perWeek} sessies per week` };
    if (s.perWeek < 1.8) return { status: 'thin', value: s.perWeek, note: `${s.perWeek} sessies per week; twee is het omslagpunt` };
    return { status: 'ok', value: s.perWeek, note: `${s.perWeek} sessies per week` };
  },
  [{ minutes: 15, text: 'Doe STRONG 15. Kort telt volledig mee — consistentie verslaat lengte.' },
   { minutes: 25, text: 'Doe STRONG 25 met de band die je vorige keer gebruikte.' },
   { minutes: 2, text: 'Leg je matje en banden nu klaar op de plek waar je traint. Dat is de echte drempel.' }]);

const patternDriver = mkDriver('pattern_coverage', 'Volledige bewegingsdekking', 0.7,
  ({ currentDate }) => {
    const c = patternCoverage(currentDate, 28);
    if (c.sessions === 0) return { status: 'unknown', note: 'geen sessies om te beoordelen' };
    if (c.missing.length >= 3) return { status: 'poor', value: c.pct, note: c.advice };
    if (c.missing.length) return { status: 'thin', value: c.pct, note: c.advice };
    return { status: 'ok', value: c.pct, note: 'alle zeven patronen komen aan bod' };
  },
  [{ minutes: 30, text: 'Kies STRONG 30 — die dekt alle zeven bewegingspatronen in één les.' }]);

const aerobicVolumeDriver = mkDriver('aerobic_volume', 'Rustige aerobe minuten', 1.0,
  ({ logs, currentDate }) => {
    const load = trainingLoad(logs, currentDate);
    if (!load.runMin7 && !load.runMin28) return { status: 'poor', value: 0, note: 'geen geregistreerde loopminuten' };
    if (load.runMin7 < 40) return { status: 'thin', value: load.runMin7, note: `${load.runMin7} loopminuten deze week` };
    return { status: 'ok', value: load.runMin7, note: `${load.runMin7} loopminuten deze week` };
  },
  [{ minutes: 20, text: 'Een rustige run/walk binnen je hartslagband telt volledig mee — tempo is bijzaak.' },
   { minutes: 30, text: 'Wandelen in de buitenlucht telt ook als tijd op de benen.' }]);

const runEconomyDriver = mkDriver('run_economy', 'Loopeconomie', 0.9,
  ({ currentDate }) => {
    const e = runEconomyTrend({ currentDate });
    if (!e.enough) return { status: 'unknown', note: e.note };
    if (e.gainSec < -5) return { status: 'poor', value: e.gainSec, note: 'looptempo bij gelijke hartslag is achteruit gegaan' };
    if (!e.honest) return { status: 'thin', value: e.gainSec, note: 'sneller, maar met hogere hartslag — dat is harder werken, niet economischer' };
    if (e.gainSec < 3) return { status: 'thin', value: e.gainSec, note: 'nog geen duidelijke winst' };
    return { status: 'ok', value: e.gainSec, note: `${e.gainSec} sec/km winst bij gelijke hartslag` };
  },
  [{ minutes: 25, text: 'Blijf strikt binnen je hartslagband. Loopeconomie komt van veel rustige minuten, niet van harder lopen.' },
   { minutes: 15, text: 'Kracht voor benen en kuiten ondersteunt je pas — dat werkt indirect door in je tempo.' }]);

const toleranceDriver = mkDriver('tolerance', 'Trainingstolerantie', 1.3,
  ({ logs, currentDate }) => {
    const runs = loadWorkouts().filter(w => (w.activityType === 'run' || w.activityType == null)
      && w.date >= addDays(currentDate, -27) && w.date <= currentDate);
    if (!runs.length) return { status: 'unknown', note: 'geen runs in 28 dagen' };
    const poor = runs.filter(w => toleranceFor(w, logs) === 'poor').length;
    const pending = runs.filter(w => toleranceFor(w, logs) === 'pending').length;
    if (poor >= 2) return { status: 'poor', value: poor, note: `${poor} slecht verdragen sessies in 28 dagen` };
    if (poor === 1) return { status: 'thin', value: poor, note: '1 slecht verdragen sessie in 28 dagen' };
    if (pending > runs.length / 2) return { status: 'thin', value: pending, note: `${pending} sessies wachten nog op een herstelcheck` };
    return { status: 'ok', value: 0, note: 'sessies worden goed verdragen' };
  },
  [{ minutes: 2, text: 'Vul de herstelcheck van je laatste training in — daar hangt de hele opbouw aan.' },
   { minutes: 0, text: 'Houd het niveau vast in plaats van op te bouwen. Een herhaalde sessie is geen stilstand.' }]);

const daylightDriver = mkDriver('daylight', 'Buitenlicht en beweging', 0.6,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 7);
    const out = rows.filter(l => l.run_done || l.outside || l.walk_done).length;
    if (rows.length < 3) return { status: 'unknown', note: 'te weinig dagen ingevuld' };
    if (out === 0) return { status: 'poor', value: 0, note: 'geen geregistreerde buitenmomenten deze week' };
    if (out < 3) return { status: 'thin', value: out, note: `${out} buitenmomenten deze week` };
    return { status: 'ok', value: out, note: `${out} buitenmomenten deze week` };
  },
  [{ minutes: 10, text: 'Tien minuten naar buiten in daglicht — het beste dat er is voor je slaapritme en je huid.' }]);

const routineDriver = mkDriver('skin_routine', 'Huidroutine en SPF', 0.8,
  ({ currentDate }) => {
    let r = {};
    try { r = JSON.parse(localStorage.getItem(ROUTINE_KEY) || '{}'); } catch { r = {}; }
    const days = Object.keys(r).filter(d => d >= addDays(currentDate, -13) && d <= currentDate);
    if (!days.length) return { status: 'unknown', note: 'routine niet bijgehouden' };
    const done = days.filter(d => r[d]?.spf || r[d]?.evening).length;
    const pct = done / 14;
    if (pct < 0.4) return { status: 'poor', value: pct, note: `${done} van de 14 dagen routine gedaan` };
    if (pct < 0.7) return { status: 'thin', value: pct, note: `${done} van de 14 dagen routine gedaan` };
    return { status: 'ok', value: pct, note: `${done} van de 14 dagen routine gedaan` };
  },
  [{ minutes: 2, text: 'SPF op, ook op een grijze dag. Dit is de enige interventie met onbetwist effect op hoe je huid over jaren oogt.' },
   { minutes: 3, text: 'Zet je avondroutine klaar op het aanrecht, dan hoef je vanavond niets meer te bedenken.' }]);

const alcoholDriver = mkDriver('alcohol', 'Alcoholbelasting', 0.6,
  ({ logs, currentDate }) => {
    const rows = logsIn(logs, currentDate, 14).filter(l => l.alcohol != null);
    if (!rows.length) return { status: 'unknown', note: 'niet bijgehouden' };
    const days = rows.filter(l => Number(l.alcohol) > 0).length;
    if (days >= 7) return { status: 'poor', value: days, note: `${days} van de 14 dagen alcohol` };
    if (days >= 4) return { status: 'thin', value: days, note: `${days} van de 14 dagen alcohol` };
    return { status: 'ok', value: days, note: `${days} van de 14 dagen alcohol` };
  },
  [{ minutes: 0, text: 'Eén alcoholvrije avond deze week doet meer voor je slaap en je huid dan welke crème ook.' }]);

const protectedTimeDriver = mkDriver('protected_time', 'Beschermde vrije tijd', 1.0,
  ({ currentDate }) => {
    let total = 0, checked = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentDate, -i);
      try {
        const plan = JSON.parse(localStorage.getItem(`gc_day_plan_${d}`) || '{}');
        checked++;
        total += (plan.freeBlocks || []).length;
      } catch { /* geen plan */ }
    }
    if (!checked) return { status: 'unknown', note: 'geen dagplanning gevonden' };
    if (total === 0) return { status: 'poor', value: 0, note: 'geen enkel beschermd blok deze week' };
    if (total < 3) return { status: 'thin', value: total, note: `${total} beschermde blokken deze week` };
    return { status: 'ok', value: total, note: `${total} beschermde blokken deze week` };
  },
  [{ minutes: 5, text: 'Blokkeer één avond deze week volledig. Structuur dient je autonomie, niet andersom.' },
   { minutes: 2, text: 'Markeer vandaag één dagdeel als vrij — en houd je eraan.' }]);

// ── Doeldomeinen met hun drivers ────────────────────────────────
export const DOMAINS = {
  GLOW: {
    id: 'GLOW', emoji: '✨', label: 'Glow — frisser, energieker gezicht',
    drivers: [sleepDriver, recoveryDriver, stressDriver, routineDriver,
      proteinDriver, daylightDriver, alcoholDriver],
    measures: ['freshness-score die je zelf geeft', 'maandelijkse gezichtsfoto op dezelfde plek',
      'slaaptrend over 14 dagen', 'hoe consequent je routine is'],
    review: '4–8 weken',
    caution: 'Geen huidanalyse en geen medische uitspraken. Cosmetische behandelingen zijn context die jij zelf registreert, nooit een advies dat hier automatisch uit rolt.',
  },
  BODY: {
    id: 'BODY', emoji: '⚖️', label: 'Body — ranker, sterker, strakker',
    drivers: [strengthConsistencyDriver, proteinDriver, recoveryDriver, sleepDriver,
      patternDriver, aerobicVolumeDriver, stressDriver],
    measures: ['tailletrend', 'gewichtstrend als context, niet als hoofdmaat',
      'krachtcapaciteit', 'fotovergelijking', 'hoe kleding valt'],
    review: '8–12 weken',
    caution: 'Nooit crash-dieet, nooit lage energiebeschikbaarheid. In perimenopauze kost spierverlies je meer dan een paar kilo op de weegschaal je oplevert.',
  },
  RUN: {
    id: 'RUN', emoji: '🏃', label: 'Run — sneller en verder binnen je herstel',
    drivers: [toleranceDriver, recoveryDriver, aerobicVolumeDriver, runEconomyDriver,
      strengthConsistencyDriver, sleepDriver],
    measures: ['run pace bij gelijke hartslag', 'hartslag bij gelijk tempo',
      'langste verdragen run', '24–48u-respons'],
    review: '4–8 weken',
    caution: 'Een ambitieus einddoel maakt de opbouw niet sneller. De hartslagband en de vertraagde respons blijven leidend.',
  },
  STRENGTH: {
    id: 'STRENGTH', emoji: '💪', label: 'Strength — sterker worden',
    drivers: [strengthConsistencyDriver, patternDriver, recoveryDriver, proteinDriver, sleepDriver],
    measures: ['bandniveau', 'herhalingen bij gelijke RPE', 'krachtcapaciteitsscore', 'RPE bij dezelfde les'],
    review: '4–8 weken',
    caution: 'Progressie binnen herstelcapaciteit. Twee zware sessies achter elkaar leveren minder op dan twee goed verdragen sessies met rust ertussen.',
  },
  FRESHNESS: {
    id: 'FRESHNESS', emoji: '🌿', label: 'Energie en herstel',
    drivers: [sleepDriver, recoveryDriver, stressDriver, protectedTimeDriver, daylightDriver],
    measures: ['PEM-dagen per maand', 'slaapuren', 'ervaren energie', 'hoeveel beschermde tijd je hield'],
    review: 'wekelijks',
    caution: null,
  },
  TIME: {
    id: 'TIME', emoji: '🕐', label: 'Tijd en autonomie',
    drivers: [protectedTimeDriver, stressDriver, sleepDriver],
    measures: ['beschermde blokken per week', 'vrije avonden', 'of het leven levend voelde of administratief'],
    review: 'wekelijks',
    caution: 'Geen sociale of vrijetijds-KPI\'s. Dit gaat over ruimte, niet over productiviteit.',
  },
};

export const DOMAIN_LIST = Object.values(DOMAINS);

// ── De keten uitrekenen ─────────────────────────────────────────
export function analyseDomain(domainId, { logs = {}, currentDate = todayLocal() } = {}) {
  const domain = DOMAINS[domainId];
  if (!domain) return null;

  const ctx = { logs, currentDate };
  const drivers = domain.drivers.map(d => {
    const a = d.assess(ctx) || { status: 'unknown' };
    return { id: d.id, label: d.label, weight: d.weight, actions: d.actions, ...a };
  });

  // De bottleneck: slechtste status, en bij gelijke status het zwaarste
  // gewicht. Onbekend telt als "hier weten we het niet" en kan óók de
  // bottleneck zijn — dan is meten de actie.
  const scored = drivers.map(d => ({
    ...d, score: STATUS_RANK[d.status] * 10 + d.weight,
  })).sort((a, b) => b.score - a.score);

  const worst = scored[0];
  const bottleneck = worst && STATUS_RANK[worst.status] >= 2 ? worst
    : scored.find(d => d.status === 'unknown') || worst;

  const known = drivers.filter(d => d.status !== 'unknown').length;
  const confidence = known >= domain.drivers.length * 0.7 ? 'HIGH'
    : known >= domain.drivers.length * 0.4 ? 'MEDIUM' : 'LOW';

  return {
    domain, drivers: scored, bottleneck,
    confidence,
    knownDrivers: known, totalDrivers: domain.drivers.length,
    dataNote: known < domain.drivers.length
      ? `${domain.drivers.length - known} van de ${domain.drivers.length} factoren zijn nog niet te beoordelen omdat de data ontbreekt.`
      : null,
  };
}

// ── De hefboom van vandaag ──────────────────────────────────────
// Niet zoveel mogelijk acties, maar de actie met de hoogste verwachte
// opbrengst binnen de capaciteit van vandaag.
export function highestLeverageAction({
  logs = {}, currentDate = todayLocal(), coach = null, runGate = null,
  strengthGate = null, minutes = null, domainIds = null,
} = {}) {
  const active = domainIds || activeDomainIds();
  const analyses = active.map(id => analyseDomain(id, { logs, currentDate })).filter(Boolean);
  if (!analyses.length) return { available: false, reason: 'Geen actieve doelen ingesteld.' };

  const capacity = capacityToday({ coach, runGate, strengthGate, logs, currentDate });

  // Elke bottleneck levert kandidaat-acties. We wegen op: hoe hard is het
  // een bottleneck, hoe zwaar weegt de driver, hoeveel doelen delen hem,
  // en past hij binnen de capaciteit van vandaag?
  const candidates = [];
  for (const a of analyses) {
    const b = a.bottleneck;
    if (!b) continue;
    for (const act of b.actions || []) {
      if (minutes != null && act.minutes > minutes) continue;
      if (!capacity.allows(act, b)) continue;
      candidates.push({
        driverId: b.id, driverLabel: b.label, driverNote: b.note, status: b.status,
        domain: a.domain, action: act,
        weight: STATUS_RANK[b.status] * 10 + b.weight,
      });
    }
  }

  if (!candidates.length) {
    return { available: false, capacity,
      reason: capacity.restOnly
        ? 'Vandaag is herstel de enige zinvolle investering. Er is geen actie die daar bovenop iets toevoegt.'
        : 'Geen passende actie binnen de beschikbare tijd.' };
  }

  // Een driver die meerdere doelen tegelijk deblokkeert weegt zwaarder —
  // dat is precies wat "hoogste hefboom" betekent.
  const shared = {};
  for (const c of candidates) shared[c.driverId] = (shared[c.driverId] || 0) + 1;
  for (const c of candidates) c.weight += (shared[c.driverId] - 1) * 4;

  candidates.sort((a, b) => b.weight - a.weight ||
    (a.action.minutes || 0) - (b.action.minutes || 0));

  const best = candidates[0];
  const alsoServes = analyses
    .filter(a => a.bottleneck?.id === best.driverId)
    .map(a => a.domain.label.split('—')[0].trim());

  return {
    available: true,
    capacity,
    action: best.action,
    driver: { id: best.driverId, label: best.driverLabel, note: best.driverNote, status: best.status },
    domain: best.domain,
    alsoServes,
    // "Waarom dit?" — hooguit vier korte redenen, geen essay.
    why: [
      `${best.driverLabel} is nu de beperkende factor: ${best.driverNote}.`,
      alsoServes.length > 1
        ? `Dit blokkeert tegelijk ${alsoServes.join(' en ')} — daarom levert het meer op dan een losse actie.`
        : `Dit is wat ${best.domain.label.split('—')[0].trim().toLowerCase()} op dit moment tegenhoudt.`,
      capacity.note,
      best.domain.caution ? best.domain.caution.split('.')[0] + '.' : null,
    ].filter(Boolean).slice(0, 4),
    alternatives: candidates.slice(1, 4),
    analyses,
  };
}

// Welke doeldomeinen zijn actief? Uit de doelenstore, met een verstandige
// standaard als er nog niets is ingesteld.
export function activeDomainIds() {
  const goals = loadGoals().filter(g => g.status === 'active');
  const map = { RUN: 'RUN', BODY: 'BODY', SHAPE: 'STRENGTH', FRESHNESS: 'FRESHNESS', TIME: 'TIME' };
  const ids = new Set();
  for (const g of goals) {
    const d = map[g.domain];
    if (d && DOMAINS[d]) ids.add(d);
  }
  ids.add('GLOW');           // glow staat altijd aan; het is een expliciet doel
  if (!ids.size) return ['RUN', 'BODY', 'FRESHNESS', 'GLOW'];
  return [...ids];
}

// ── Wat laat de capaciteit van vandaag toe? ─────────────────────
function capacityToday({ coach, runGate, strengthGate, logs, currentDate }) {
  const decision = coach?.decision || null;
  const pem = !!(logs?.[currentDate]?.symptom_pem || logs?.[currentDate]?.training_recovery === 2);
  const restOnly = pem || decision === 'RED'
    || runGate?.action === 'FULL_REST' || strengthGate?.action === 'FULL_REST';

  const trainingAllowed = !restOnly &&
    (runGate?.action === 'RUN_TODAY' || strengthGate?.mayTrain);

  return {
    decision, restOnly, trainingAllowed, pem,
    note: restOnly
      ? 'Je capaciteit laat vandaag geen trainingsprikkel toe; alles wat herstel dient telt dubbel.'
      : decision === 'AMBER'
        ? 'Je capaciteit is vandaag gemengd — kleine, zekere acties leveren meer op dan grote plannen.'
        : trainingAllowed
          ? 'Je capaciteit laat vandaag een echte trainingsprikkel toe.'
          : 'Bewegen mag, belasten niet.',
    // Een actie die belasting toevoegt mag niet op een herstel-dag.
    allows(action, driver) {
      if (!restOnly) return true;
      // Bij volledige rust alleen acties die herstel, slaap, stress,
      // routine of voeding dienen — nooit training.
      return ['sleep', 'recovery', 'stress', 'skin_routine', 'protein',
        'alcohol', 'protected_time'].includes(driver.id);
    },
  };
}

// ── Uitvoering en learning loop ─────────────────────────────────
// Als een actie steeds niet lukt, is "meer discipline" het verkeerde
// antwoord. Dan is de frictie het probleem.
export function loadActionLog() {
  try { return JSON.parse(localStorage.getItem(ACTION_LOG_KEY) || '[]'); } catch { return []; }
}

export function logAction({ date = todayLocal(), driverId, domainId, text, outcome, friction = null }) {
  const arr = loadActionLog();
  arr.unshift({
    id: `lv_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    date, driverId, domainId, text, outcome, friction,
  });
  localStorage.setItem(ACTION_LOG_KEY, JSON.stringify(arr.slice(0, 400)));
  return arr;
}

// Herhaalde mislukking op dezelfde driver → frictie oplossen, niet
// aandringen.
export function adherenceFor(driverId, { days = 28, currentDate = todayLocal() } = {}) {
  const from = addDays(currentDate, -(days - 1));
  const rows = loadActionLog().filter(r => r.driverId === driverId && r.date >= from);
  if (rows.length < 3) return { enough: false, count: rows.length };
  const done = rows.filter(r => r.outcome === 'done').length;
  const skipped = rows.filter(r => r.outcome === 'skipped').length;
  const annoying = rows.filter(r => r.outcome === 'annoying').length;
  const pct = Math.round((done / rows.length) * 100);
  return {
    enough: true, count: rows.length, done, skipped, annoying, pct,
    struggling: pct < 40 || annoying >= 2,
    verdict: annoying >= 2
      ? 'Je hebt dit een paar keer als irritant gemarkeerd. Ik stop met het voorstellen en zoek een andere ingang.'
      : pct < 40
        ? 'Dit lukt vaak niet. Dat is geen kwestie van discipline maar van frictie — wat staat er in de weg?'
        : `Dit lukt in ${pct}% van de gevallen.`,
  };
}

// Voorstellen die telkens stukliepen worden niet eindeloos herhaald.
export function suppressedDrivers({ currentDate = todayLocal() } = {}) {
  const ids = new Set();
  for (const d of new Set(loadActionLog().map(r => r.driverId))) {
    const a = adherenceFor(d, { currentDate });
    if (a.enough && a.annoying >= 2) ids.add(d);
  }
  return ids;
}

// ── Review windows ──────────────────────────────────────────────
// Niet elk doel elke dag beoordelen. Kleine schommelingen zijn ruis.
export const REVIEW_WINDOWS = {
  daily: { label: 'Dagelijks', items: ['herstel', 'symptomen', 'readiness', 'slaap', 'de actie van vandaag'] },
  weekly: { label: 'Wekelijks', items: ['trainingsbelasting', 'routineconsistentie', 'beschermde tijd', 'bottleneck'] },
  block: { label: '4–8 weken', items: ['lichaamssamenstelling', 'krachttrend', 'loopeconomie', 'effect van een interventie'] },
  monthly: { label: 'Maandelijks', items: ['gezichtsfoto', 'bodyfoto', 'grotere Future Self-progressie'] },
};

export const REVIEW_DECISIONS = ['CONTINUE', 'ADJUST', 'REPLACE', 'PAUSE', 'ESCALATE'];

// Wat zou de coach na deze periode besluiten?
export function reviewDomain(domainId, { logs = {}, currentDate = todayLocal() } = {}) {
  const a = analyseDomain(domainId, { logs, currentDate });
  if (!a) return null;
  const adh = adherenceFor(a.bottleneck?.id, { currentDate });

  let decision, reason;
  if (a.bottleneck?.status === 'unknown') {
    decision = 'ADJUST';
    reason = `${a.bottleneck.label} is niet te beoordelen: ${a.bottleneck.note}. Eerst meten, dan sturen.`;
  } else if (adh.enough && adh.struggling) {
    decision = 'REPLACE';
    reason = adh.verdict;
  } else if (a.bottleneck?.status === 'poor') {
    decision = a.domain.id === 'FRESHNESS' || a.bottleneck.id === 'recovery' ? 'ESCALATE' : 'ADJUST';
    reason = `${a.bottleneck.label} staat in het rood: ${a.bottleneck.note}.`;
  } else if (a.bottleneck?.status === 'thin') {
    decision = 'CONTINUE';
    reason = `${a.bottleneck.label} is de zwakste schakel maar beweegt de goede kant op.`;
  } else {
    decision = 'CONTINUE';
    reason = 'Geen duidelijke bottleneck — de huidige aanpak mag door.';
  }

  return { ...a, decision, reason, adherence: adh,
    reviewWindow: a.domain.review, measures: a.domain.measures };
}
