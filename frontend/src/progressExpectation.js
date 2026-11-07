// Wat mag je aan vooruitgang verwachten? Het antwoord van een trainer,
// niet een doorgetrokken lijn.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG, EN WAT ER MIS WAS
//
// Zij zei het precies goed: er zit nergens een voorspelling in dat ze
// sneller wordt, terwijl mensen normaal gesproken juist snel vooruitgaan.
//
// Ze had gelijk, en er zaten twee fouten onder.
//
// De eerste: de racevoorspelling trok haar GEMETEN trend door, en die
// trend was over de laatste zes sessies licht negatief (−4 sec/km per
// week). Het "waarschijnlijke" scenario werd daarmee elke week slechter.
// Een trainer doet dat niet. Een dip van zes sessies in een periode met
// één loop per week is geen voorspelling van de toekomst; het is een
// beschrijving van een periode waarin er nauwelijks getraind is.
//
// De tweede: het doel per sessie rekende met één procent winst per week,
// alsof alle vooruitgang nieuwe aanpassing is. Maar het grootste deel van
// wat zij de komende weken wint is geen nieuwe aanpassing — het is
// terugpakken wat ze in oktober al had.
//
// ─────────────────────────────────────────────────────────────────
// HOE EEN TRAINER HET WEL DOET: TWEE FASEN
//
// FASE 1 — TERUGPAKKEN. Haar beste gemeten efficiëntie was 0,784 op 18
// oktober; nu staat ze op 0,727. Dat verschil is geen verloren conditie
// maar verloren ritme: in de vier weken erna liep ze gemiddeld één keer
// per week. Wie terug gaat naar vier keer per week pakt zo'n niveau in
// twee tot vier weken terug. Dat gaat snel, en het is precies waarom
// beginnende lopers in het begin zulke sprongen maken — het is zelden
// nieuwe fysiologie, het is een systeem dat weer regelmatig geprikkeld
// wordt.
//
// FASE 2 — NIEUWE AANPASSING. Daarboven komt echte winst, en die gaat
// trager: ongeveer één tot anderhalf procent per week bij iemand die
// consequent traint, en het grootste deel daarvan komt in deze periode
// uit loopeconomie (pasfrequentie, kracht) en niet uit de aerobe motor,
// die maanden nodig heeft.
//
// Het verschil tussen die twee fasen is het hele antwoord op haar vraag.
// Ja, mensen maken snel progressie — in fase 1. En ja, dat geldt nu ook
// voor haar, want ze zit er middenin.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT NIET DOET
//
// Het belooft geen wenstijd. Het rekent vanaf wat gemeten is, met een
// tempo dat benoemd en navolgbaar is, en het zegt bij elke uitkomst onder
// welke voorwaarde hij geldt — vier loopdagen per week, geen terugslag,
// en genoeg eten. Zonder die voorwaarden is het geen verwachting maar een
// wens, en dat verschil hoort zichtbaar te blijven.
// ─────────────────────────────────────────────────────────────────

import { efficiencyTrend, paceAtHr } from './efficiency';
import { todayLocal, daysBetween } from './datetime';
import { gemetenProgressie } from './gemetenTempo';

// Hoe snel pak je een eerder bereikt niveau terug? Twee tot vier weken bij
// vier sessies per week; hier de voorzichtige kant.
export const HERSTEL_WEKEN = 3;

// Nieuwe aanpassing daarboven, per week. 1,25% is het midden van wat bij
// consequent trainen haalbaar is; de onderkant 1%, de bovenkant 1,5%.
export const NIEUW_PER_WEEK_PCT = 1.25;
export const NIEUW_ONDER_PCT = 1.0;
export const NIEUW_BOVEN_PCT = 1.5;

// Onder dit aantal sessies is er geen vertrekpunt.
const MIN_SESSIES = 3;

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return null;
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];
const fmtDatum = (d) => {
  if (!d) return '—';
  const [, m, dag] = d.split('-');
  return `${Number(dag)} ${MAANDEN[Number(m) - 1]}`;
};

const fmtTijd = (min) => {
  if (min == null || !Number.isFinite(min)) return null;
  const t = Math.round(min * 60);
  const u = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return u ? `${u}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

// De verwachte efficiëntie op een datum, in drie scenario's.
export function expectedEfficiency({ currentDate = todayLocal(), date = null,
  workouts = null } = {}) {
  const t = efficiencyTrend({ currentDate, workouts });
  if (!t.known || t.count < MIN_SESSIES) {
    return { known: false, why: t.why || 'Nog te weinig gemeten sessies.' };
  }
  const nu = t.current;
  // Het beste gemeten punt in het venster: dat is het niveau dat terug te
  // pakken is, niet iets wat nog moet worden opgebouwd.
  const beste = Math.max(...(t.sessions || []).map(s => s.ef), nu);

  // ── Haar eigen tempo wint van het boekgetal ─────────────────
  //
  // Zij vroeg of haar hartslag niet sneller zou zakken dan dit model
  // aanneemt. Terechte vraag, en het antwoord staat in haar eigen reeks:
  // over de weken dat ze consequent liep, 1,6% per week tegen de 1,25%
  // die hier stond. Een gemeten helling over haar eigen sessies is
  // altijd een beter antwoord dan een gemiddelde over andere mensen —
  // zolang hij op genoeg punten rust en binnen het mogelijke valt. Zie
  // gemetenTempo.js voor beide grenzen.
  const gemeten = gemetenProgressie({ currentDate, workouts });
  const perWeek = gemeten.known ? gemeten.usable : NIEUW_PER_WEEK_PCT;
  const bovenPerWeek = gemeten.known
    ? Math.max(gemeten.usable, NIEUW_BOVEN_PCT) : NIEUW_BOVEN_PCT;
  const weken = date ? Math.max(0, daysBetween(currentDate, date) / 7) : 0;

  // Fase 1: lineair terug naar het beste punt, in HERSTEL_WEKEN.
  const herstelAandeel = Math.min(1, weken / HERSTEL_WEKEN);
  const naHerstel = nu + (beste - nu) * herstelAandeel;
  // Fase 2: nieuwe winst over de weken die daarna nog komen.
  const nieuweWeken = Math.max(0, weken - HERSTEL_WEKEN);

  // In het gunstige scenario komt het ritme sneller terug — twee weken in
  // plaats van drie — en begint de nieuwe winst dus een week eerder. Dat
  // maakt het verschil tussen de scenario's eerlijk; zonder dat verschilde
  // "als alles meezit" maar een paar tellen van "verwacht", en dan is het
  // geen bandbreedte maar een schijnprecisie.
  const snelHerstel = Math.min(1, weken / 2);
  const naSnelHerstel = nu + (beste - nu) * snelHerstel;
  const snelleNieuweWeken = Math.max(0, weken - 2);

  const metPct = (pct, basis = naHerstel) => +(basis * (1 + (pct / 100) * nieuweWeken)).toFixed(3);

  // De bandbreedte zit niet in het percentage nieuwe winst — dat scheelt
  // over vijf weken een paar tellen. De echte onzekerheid is of het ritme
  // er komt. Daarom is de voorzichtige uitkomst: hooguit de helft van het
  // oude niveau terug en geen nieuwe winst. Dat is het scenario waarin het
  // leven ertussen komt, en dat is realistisch genoeg om te noemen.
  const halfHersteld = nu + (beste - nu) * herstelAandeel * 0.5;

  return {
    known: true,
    current: nu,
    best: +beste.toFixed(3),
    bestDate: (t.sessions || []).find(s => s.ef === beste)?.date || null,
    weeks: +weken.toFixed(1),
    recovered: +naHerstel.toFixed(3),
    low: +halfHersteld.toFixed(3),
    mid: metPct(perWeek),
    high: +(naSnelHerstel * (1 + (bovenPerWeek / 100) * snelleNieuweWeken)).toFixed(3),
    recoveryWeeks: HERSTEL_WEKEN,
    // Welk tempo van vooruitgang hier gebruikt is, en waar het vandaan komt.
    ratePerWeek: perWeek,
    rateSource: gemeten.known ? 'gemeten' : 'literatuur',
    rateWhy: gemeten.why,
    rateIgnored: gemeten.ignored || [],
    phase: weken <= HERSTEL_WEKEN ? 'terugpakken' : 'opbouwen',
  };
}

// Wat betekent die verwachting voor een afstand, op een gegeven
// race-hartslag en ondergrond?
//
// De ondergrondtoeslag is geen natuurkunde maar een ervaringsgetal, en het
// is groot: zacht zand en duinen kosten een lopend mens grofweg een tot
// twee minuten per kilometer. Voor Ameland is dat het verschil tussen een
// tijd waar ze iets aan heeft en een tijd die nergens op slaat, dus hij
// staat er apart bij in plaats van verstopt in één getal.
export const TERREIN = {
  road: { label: 'verharde weg', extraMinPerKm: 0 },
  trail: { label: 'pad en duin', extraMinPerKm: 0.75 },
  beach: { label: 'strand en zacht zand', extraMinPerKm: 1.25 },
};

export function raceExpectation({ currentDate = todayLocal(), raceDate = null,
  distanceKm = 5, raceHr = null, terrain = 'trail', workouts = null,
  vt2 = 156 } = {}) {
  const e = expectedEfficiency({ currentDate, date: raceDate, workouts });
  if (!e.known) return { known: false, why: e.why };

  // Op welke hartslag loop je een race van drie kwartier? Niet op je
  // easy-plafond, en ook niet op VT2 — dat houd je geen drie kwartier vol.
  // Een paar slagen onder VT2 is de gangbare schatting voor deze duur.
  const hr = raceHr || Math.round(vt2 - 6);
  const terreinInfo = TERREIN[terrain] || TERREIN.trail;

  const maak = (ef) => {
    const vlak = paceAtHr(ef, hr);
    const opTerrein = vlak + terreinInfo.extraMinPerKm;
    return {
      ef,
      flatPace: vlak, flatTime: vlak * distanceKm,
      pace: opTerrein, time: opTerrein * distanceKm,
    };
  };

  const nu = maak(e.current);
  const laag = maak(e.low), midden = maak(e.mid), hoog = maak(e.high);

  return {
    known: true,
    raceHr: hr,
    distanceKm,
    terrain: terreinInfo,
    weeks: e.weeks,
    efficiency: e,
    now: nu,
    low: laag, mid: midden, high: hoog,
    line: `Op ${fmtDatum(raceDate)} verwacht ik ${fmtTijd(midden.time)} op ${distanceKm} km `
      + `(${fmtPace(midden.pace)}/km). Bandbreedte: ${fmtTijd(laag.time)} als het ritme maar `
      + `half komt, ${fmtTijd(hoog.time)} als alles meezit.`,
    nowLine: `Met je vorm van vandaag zou die race ${fmtTijd(nu.time)} kosten `
      + `(${fmtPace(nu.pace)}/km).`,
    gainLine: `Dat is ${fmtTijd(nu.time - midden.time)} sneller dan vandaag.`,
    method: `Gerekend op hartslag ${hr} — raceinspanning, een paar slagen onder je VT2 `
      + `van ${vt2}; dat is wat je drie kwartier volhoudt, niet je easy-plafond. `
      + `Daarbovenop ${terreinInfo.extraMinPerKm.toFixed(2).replace('.', ',')} min/km voor `
      + `${terreinInfo.label}.`,
    phases: `Eerste ${e.recoveryWeeks} weken: terugpakken wat je op ${fmtDatum(e.bestDate)} `
      + `al liep (efficiëntie ${e.best}, nu ${e.current}). Daarna `
      + `${String(e.ratePerWeek).replace('.', ',')}% nieuwe winst per week — `
      + (e.rateSource === 'gemeten'
        ? 'jouw eigen gemeten tempo, niet een gemiddelde over andere mensen.'
        : `het literatuurgetal, want ${String(NIEUW_ONDER_PCT).replace('.', ',')}–`
          + `${String(NIEUW_BOVEN_PCT).replace('.', ',')}% is wat hier haalbaar heet. `
          + 'Zodra er een aaneengesloten reeks staat, rekent dit met jouw eigen helling.')
      + ' De voorzichtige uitkomst hierboven is het scenario waarin het ritme er maar '
      + 'half komt.',
    rate: { perWeek: e.ratePerWeek, source: e.rateSource, why: e.rateWhy },
    conditions: 'Dit geldt bij vier loopdagen per week zonder gaten groter dan twee dagen, '
      + 'twee krachttrainingen, geen terugslag, en genoeg eten. Valt een van die vier weg, '
      + 'dan is dit geen verwachting meer maar een wens.',
    fmt: { pace: fmtPace, time: fmtTijd },
  };
}
