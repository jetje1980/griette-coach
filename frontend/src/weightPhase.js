// Afvallen én sneller worden: wat kan tegelijk, en wat niet.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG, EN HET EERLIJKE ANTWOORD
//
// Zij wil naar 57 kilo en vraagt: minder zwaar zijn maakt toch sneller?
//
// Ja. Dat deel klopt, en het is te becijferen. De energiekosten van
// hardlopen schalen vrijwel recht evenredig met wat je draagt: ongeveer
// één procent per kilo. Bij haar tempo van rond 9:30 per kilometer is één
// procent zo'n 5 à 6 seconden. Van 61,5 naar 57 kilo is 4,5 kilo, en dus
// grofweg 25 tot 30 seconden per kilometer — twee en een halve minuut op
// vijf kilometer. Dat is veel.
//
// Maar het antwoord heeft een tweede helft, en die is net zo hard: je kunt
// dat voordeel alleen verzilveren als je de motor houdt die het moet
// dragen. Afvallen gebeurt in een energietekort, en in een tekort bouwt
// het lichaam geen aerobe capaciteit op — het houdt wat het heeft, of
// minder. Haar eigen cijfers laten dat precies zien: terwijl ze 2,5 kilo
// afviel steeg haar rusthartslag van 57 naar 62,5 en zakte haar
// loopeconomie 4,5 procent. Die 4,5 procent economieverlies is bij haar
// tempo ongeveer 25 seconden per kilometer — vrijwel exact wat die 4,5
// kilo haar zou opleveren.
//
// Met andere woorden: tegelijk doen levert bij benadering niets op. Ná
// elkaar doen levert allebei op.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT BESTAND DOET
//
// Het rekent het voordeel van het gewichtsdoel uit, het rekent de kosten
// van het tempo waarin ze afvalt uit, en het legt ze naast elkaar. Daarna
// is het aan haar: de fase is een instelling, geen oordeel. Kiest ze voor
// doorgaan met afvallen, dan past het eetadvies zich aan en worden de
// tempoverwachtingen eerlijk naar beneden bijgesteld in plaats van dat de
// app doet alsof allebei kan.
// ─────────────────────────────────────────────────────────────────

import { series } from './timeline';
import { todayLocal, addDays, daysBetween } from './datetime';

const KEY = 'gc_weight_phase';

export const FASE = {
  AFVALLEN: 'afvallen',
  BEHOUD: 'behoud',
};

// Eén procent energiekosten per kilo is de gangbare vuistregel uit
// loopeconomie-onderzoek. Bij een tempo van 9:30/km is één procent 5,7
// seconden; dit bestand rekent met háár gemeten tempo, niet met dat getal.
export const KOSTEN_PER_KILO_PCT = 1.0;

// Boven dit tempo van afvallen gaat het ten koste van spiermassa en
// herstel. Een halve kilo per week is de bovengrens die in de
// sportvoedingsliteratuur standaard wordt aangehouden voor iemand die
// traint; bij haar, met een rusthartslag die al oploopt, is het eerder een
// plafond dan een doel.
export const MAX_KG_PER_WEEK = 0.5;

export function loadWeightPhase() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object') return v;
  } catch { /* stuk opgeslagen */ }
  return { phase: null, target: null, holdUntil: null, setAt: null };
}

export function saveWeightPhase(patch) {
  const next = { ...loadWeightPhase(), ...patch, setAt: todayLocal() };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* opslag vol */ }
  return next;
}

const rond = (x, n = 1) => (x == null ? null : +x.toFixed(n));

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// Hoe snel valt ze af, gemeten over het venster?
function tempoVanAfvallen({ currentDate, dagen = 42 }) {
  const punten = series('weight', { asOf: currentDate, since: addDays(currentDate, -dagen) })
    .filter(o => typeof o.value === 'number');
  if (punten.length < 3) return { known: false, n: punten.length };
  const eerste = punten[0], laatste = punten[punten.length - 1];
  const weken = Math.max(1, daysBetween(eerste.observedAt, laatste.observedAt) / 7);
  return {
    known: true,
    from: eerste.value, to: laatste.value,
    delta: rond(laatste.value - eerste.value),
    perWeek: rond((laatste.value - eerste.value) / weken, 2),
    weeks: rond(weken, 1),
    n: punten.length,
  };
}

export function weightPlan({ currentDate = todayLocal(), target = null,
  easyPaceMin = null, raceDate = null } = {}) {
  const opgeslagen = loadWeightPhase();
  const doel = target ?? opgeslagen.target;
  const huidigReeks = series('weight', { asOf: currentDate })
    .filter(o => typeof o.value === 'number');
  const huidig = huidigReeks.length ? huidigReeks[huidigReeks.length - 1].value : null;
  const tempo = tempoVanAfvallen({ currentDate });

  if (huidig == null) {
    return { known: false, why: 'Nog geen gewicht gemeten, dus hier valt niets over te zeggen.' };
  }

  const teGaan = doel != null ? rond(huidig - doel) : null;
  // Wat levert dat gewicht op in tempo? Eén procent energiekosten per kilo,
  // toegepast op haar eigen gemeten tempo.
  const secPerKiloPerKm = easyPaceMin
    ? rond(easyPaceMin * 60 * (KOSTEN_PER_KILO_PCT / 100), 1) : null;
  const winstSec = (teGaan != null && secPerKiloPerKm != null)
    ? rond(teGaan * secPerKiloPerKm, 0) : null;

  // Hoe lang duurt het op een verantwoord tempo?
  const wekenNodig = teGaan != null && teGaan > 0
    ? Math.ceil(teGaan / MAX_KG_PER_WEEK) : 0;
  const klaarOp = wekenNodig ? addDays(currentDate, wekenNodig * 7) : null;
  const dagenTotRace = raceDate ? daysBetween(currentDate, raceDate) : null;
  const haalbaarVoorRace = dagenTotRace != null && wekenNodig * 7 <= dagenTotRace;

  const teSnel = tempo.known && tempo.perWeek != null
    && tempo.perWeek < -MAX_KG_PER_WEEK;

  return {
    known: true,
    current: rond(huidig),
    target: doel,
    toGo: teGaan,
    phase: opgeslagen.phase,
    holdUntil: opgeslagen.holdUntil,
    rate: tempo,
    tooFast: teSnel,
    secondsPerKmPerKilo: secPerKiloPerKm,
    gainSeconds: winstSec,
    weeksNeeded: wekenNodig,
    doneBy: klaarOp,
    beforeRace: haalbaarVoorRace,
    tradeoff: afweging({ teGaan, winstSec, secPerKiloPerKm, dagenTotRace, raceDate }),
    rateNote: tempo.known
      ? `${tempo.delta > 0 ? '+' : ''}${tempo.delta} kg in ${tempo.weeks} weken `
        + `(${tempo.perWeek > 0 ? '+' : ''}${tempo.perWeek} kg per week)`
      : 'Te weinig weegmomenten om een tempo te meten.',
    rateVerdict: teSnel
      ? `Dat is sneller dan ${MAX_KG_PER_WEEK} kg per week. Boven dat tempo gaat er spier `
        + 'mee, en spier is precies wat je tempo draagt.'
      : tempo.known && tempo.perWeek < 0
        ? 'Dat tempo is verantwoord.'
        : null,
  };
}

function afweging({ teGaan, winstSec, secPerKiloPerKm, dagenTotRace, raceDate }) {
  if (teGaan == null || winstSec == null) return null;
  const weken = dagenTotRace != null ? Math.floor(dagenTotRace / 7) : null;
  const kiloTotRace = weken != null ? rond(Math.min(teGaan, weken * MAX_KG_PER_WEEK), 1) : null;
  const winstTotRace = kiloTotRace != null && secPerKiloPerKm != null
    ? Math.round(kiloTotRace * secPerKiloPerKm) : null;

  return {
    // Het voordeel van het hele doel.
    totalLine: `${teGaan} kg eraf scheelt ongeveer ${winstSec} seconden per kilometer — `
      + `dat is ${fmtPace(winstSec * 5 / 60)} op vijf kilometer.`,
    // Wat er tot de race in zit, en wat het kost.
    raceLine: raceDate && kiloTotRace != null
      ? `Tot ${raceDate} kun je er verantwoord ${kiloTotRace} kg af hebben: ongeveer `
        + `${winstTotRace} seconden per kilometer winst.`
      : null,
    // En de keerzijde, met haar eigen cijfers.
    costLine: 'Daar staat tegenover dat je in een tekort geen aerobe capaciteit opbouwt. '
      + 'Jouw economie zakte 4,5% in de weken dat je 2,5 kg afviel, en 4,5% is bij jouw '
      + 'tempo ook ongeveer 25 seconden per kilometer. Tegelijk doen heft elkaar grofweg op.',
    advice: 'Ná elkaar levert allebei op: tot de race op onderhoud eten en de motor bouwen, '
      + 'daarna verder naar je doelgewicht met de conditie die je dan hebt. Het gewicht '
      + 'loopt niet weg; de vijf weken vóór een race wel.',
  };
}

// De eetboodschap die hieruit volgt, voor het dagplan.
export function fuelLine({ currentDate = todayLocal(), raceDate = null } = {}) {
  const p = loadWeightPhase();
  if (p.phase === FASE.BEHOUD) {
    return {
      phase: FASE.BEHOUD,
      line: 'Onderhoud: niet in tekort',
      why: `Je hebt gekozen voor onderhoud tot ${p.holdUntil || raceDate || 'de race'}. `
        + 'Dat is de fase waarin je motor kan groeien; het gewicht pak je daarna weer op.',
    };
  }
  if (p.phase === FASE.AFVALLEN) {
    return {
      phase: FASE.AFVALLEN,
      line: 'Afvallen, maar met brandstof rond je trainingen',
      why: 'Je hebt gekozen om door te gaan met afvallen. Dat mag — houd dan wel het '
        + 'tempo onder een halve kilo per week, eet koolhydraten rond je loop en haal je '
        + 'eiwit (1,6–2 g per kilo), anders gaat er spier mee. En verwacht in deze weken '
        + 'minder tempowinst bij gelijke hartslag: die komt niet uit een tekort.',
    };
  }
  return { phase: null, line: null, why: null };
}
