// Wat vraagt haar doeltijd werkelijk, en wanneer is dat er?
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG, EN WAAROM IK HEM NIET KON INWILLIGEN ZOALS HIJ GESTELD WAS
//
// "Ik wil echt getraind worden naar 35 min en hartslag max 145. Pas het
// zo aan dat het haalbaar wordt."
//
// Het schema aanpassen maakt dit niet haalbaar, en doen alsof zou het
// ergste zijn wat deze app kan doen — dan loopt ze vijf weken naar een
// getal toe dat niet bestaat en concludeert ze op 12 december dat zíj
// gefaald heeft. Dus staat hier geen nee en ook geen ja, maar het
// rekenwerk: wat moet er waar zijn, en wanneer is dat er.
//
// ─────────────────────────────────────────────────────────────────
// HET REKENWERK
//
// Efficiëntie is hier meters per minuut gedeeld door hartslag. Tempo bij
// een hartslag volgt daar recht uit, en dus ook de omkering: welke
// efficiëntie hoort bij een gewenste tijd op een gegeven hartslag.
//
//   35:00 op 5 km   = 7:00/km = 143 m/min
//   op de weg bij hartslag 145   → EF 0,985
//   op pad en duin bij 145       → EF 1,103  (de duinen kosten 0,75 min/km)
//   op strand bij 145            → EF 1,199
//
// Zij staat op 0,727 en liep op 18 oktober 0,784. Voor Ameland op pad en
// duin bij hartslag 145 is dus ruim vijftig procent nodig, in vijf weken.
// Dat bestaat niet. Bij één tot anderhalf procent per week — de bovenkant
// van wat met alles mee haalbaar is — is vijf weken samen zo'n zes
// procent, en dat is inclusief het terugpakken van oktober.
//
// ─────────────────────────────────────────────────────────────────
// WAT DAN WEL
//
// Het doel is niet onmogelijk; de dátum is te vroeg. EF 0,985 is geen
// buitenissig getal — dat is het niveau van een geoefende recreatieloper.
// Bij haar gemeten tempo van vooruitgang ligt dat op de weg rond april,
// en op duinen een paar maanden later. Dat is een doel waar je vijf
// maanden lang elke week naartoe kunt werken.
//
// Dit bestand rekent dat uit in plaats van het te beweren, en laat zien
// welke drie dingen de datum werkelijk verzetten: de ondergrond, de
// hartslag waarop je de race loopt, en je gewicht. Dan kan zij kiezen —
// met getallen erbij, niet met een mening van mij.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { efficiencyTrend, paceAtHr } from './efficiency';
import { TERREIN, HERSTEL_WEKEN, NIEUW_PER_WEEK_PCT, NIEUW_ONDER_PCT, NIEUW_BOVEN_PCT }
  from './progressExpectation';
import { KOSTEN_PER_KILO_PCT } from './weightPhase';

const MIN_SESSIES = 3;

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return null;
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const fmtTijd = (min) => {
  if (min == null || !Number.isFinite(min)) return null;
  const t = Math.round(min * 60);
  const u = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return u ? `${u}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];
const fmtMaand = (d) => (d ? `${MAANDEN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : null);

// De efficiëntie die hoort bij een tijd, een afstand, een ondergrond en
// een hartslag. Dit is paceAtHr omgekeerd — en het is de enige som in dit
// bestand die ertoe doet.
export function benodigdeEfficientie({ targetSec, distanceKm, hrCap,
  terrain = 'trail' } = {}) {
  if (!targetSec || !distanceKm || !hrCap) return null;
  const tempoOpTerrein = (targetSec / 60) / distanceKm;        // min/km
  const extra = (TERREIN[terrain] || TERREIN.trail).extraMinPerKm;
  const vlakTempo = tempoOpTerrein - extra;
  // Onder nul is de ondergrond zwaarder dan de doeltijd toelaat: dan is
  // er geen efficiëntie die het haalt, hoe groot ook.
  if (vlakTempo <= 0) return { ef: null, vlakTempo, onmogelijk: true };
  return { ef: +(1000 / vlakTempo / hrCap).toFixed(3), vlakTempo, onmogelijk: false };
}

// Hoeveel weken tot een efficiëntie, vanaf een vertrekpunt, bij een
// percentage per week? Eerst het terugpakken van wat er al was — dat gaat
// sneller — en daarna nieuwe winst.
function wekenTot({ doelEf, nu, beste, pctPerWeek }) {
  if (!doelEf || !nu || !pctPerWeek) return null;
  const start = Math.max(nu, 0.001);
  if (doelEf <= start) return 0;
  const top = Math.max(beste || start, start);
  // Fase 1: terug naar het beste gemeten punt, in HERSTEL_WEKEN.
  if (doelEf <= top) return +(HERSTEL_WEKEN * ((doelEf - start) / (top - start))).toFixed(1);
  // Fase 2: daarboven groeit het met pctPerWeek.
  const extra = Math.log(doelEf / top) / Math.log(1 + pctPerWeek / 100);
  return +(HERSTEL_WEKEN + extra).toFixed(1);
}

// ── Het pad naar een doeltijd ───────────────────────────────────
export function doelPad({ currentDate = todayLocal(), raceDate = null,
  targetSec = 2100, distanceKm = 5, hrCap = 145, terrain = 'trail',
  raceHr = null, weight = null, weightTarget = null, workouts = null } = {}) {
  const t = efficiencyTrend({ currentDate, workouts });
  if (!t.known || t.count < MIN_SESSIES) {
    return { known: false, why: t.why || 'Nog te weinig gemeten sessies.' };
  }
  const nu = t.current;
  const beste = Math.max(...(t.sessions || []).map(s => s.ef), nu);

  const nodig = benodigdeEfficientie({ targetSec, distanceKm, hrCap, terrain });
  const scenario = (pct) => wekenTot({ doelEf: nodig?.ef, nu, beste, pctPerWeek: pct });

  const wekenMid = scenario(NIEUW_PER_WEEK_PCT);
  const wekenSnel = scenario(NIEUW_BOVEN_PCT);
  const wekenTraag = scenario(NIEUW_ONDER_PCT);
  const datumVoor = (w) => (w == null ? null : addDays(currentDate, Math.round(w * 7)));

  // Wat er op de racedatum werkelijk in zit, met dezelfde som andersom.
  const wekenTotRace = raceDate ? Math.max(0, daysBetween(currentDate, raceDate) / 7) : null;
  const efOpRace = wekenTotRace == null ? null
    : (wekenTotRace <= HERSTEL_WEKEN
      ? nu + (beste - nu) * (wekenTotRace / HERSTEL_WEKEN)
      : beste * Math.pow(1 + NIEUW_PER_WEEK_PCT / 100, wekenTotRace - HERSTEL_WEKEN));
  const terreinInfo = TERREIN[terrain] || TERREIN.trail;
  const tempoOpRace = efOpRace ? paceAtHr(efOpRace, hrCap) + terreinInfo.extraMinPerKm : null;

  // ── De drie dingen die de datum werkelijk verzetten ───────────
  //
  // Niet "harder trainen" — dat zit al in het percentage per week. Dit
  // zijn de knoppen die de vraag zelf veranderen.
  const knoppen = [];

  // 1. Ondergrond. Verreweg de grootste, en bij haar een keuze: de duinen
  //    van Ameland kosten driekwart minuut per kilometer.
  if (terrain !== 'road') {
    const opWeg = benodigdeEfficientie({ targetSec, distanceKm, hrCap, terrain: 'road' });
    const w = wekenTot({ doelEf: opWeg?.ef, nu, beste, pctPerWeek: NIEUW_PER_WEEK_PCT });
    knoppen.push({
      id: 'ondergrond', label: 'Dezelfde tijd op de weg in plaats van in de duinen',
      effect: `EF ${opWeg?.ef} in plaats van ${nodig?.ef}`,
      datum: datumVoor(w), weken: w,
      waarom: `${terreinInfo.label} kost ${String(terreinInfo.extraMinPerKm).replace('.', ',')} `
        + 'min/km. Over 5 km is dat bijna vier minuten — je loopt dezelfde inspanning '
        + 'en de klok zegt iets anders.',
    });
  }

  // 2. De hartslag waarop je de race loopt. 145 is haar easy-plafond, geen
  //    racehartslag; een race van drie kwartier loop je er een paar slagen
  //    onder VT2.
  const raceHrEcht = raceHr || null;
  if (raceHrEcht && raceHrEcht > hrCap) {
    const opRaceHr = benodigdeEfficientie({ targetSec, distanceKm,
      hrCap: raceHrEcht, terrain });
    const w = wekenTot({ doelEf: opRaceHr?.ef, nu, beste, pctPerWeek: NIEUW_PER_WEEK_PCT });
    knoppen.push({
      id: 'racehartslag', label: `De race op hartslag ${raceHrEcht} in plaats van ${hrCap}`,
      effect: `EF ${opRaceHr?.ef} in plaats van ${nodig?.ef}`,
      datum: datumVoor(w), weken: w,
      waarom: `${hrCap} is je plafond voor rustige duurlopen — het getal waaronder je `
        + 'traint om economischer te worden. Een race van drie kwartier loop je hoger; '
        + 'dat is geen roekeloosheid maar het verschil tussen trainen en wedstrijd.',
    });
  }

  // 3. Gewicht. Eén procent tempo per kilo — hetzelfde getal dat
  //    weightPhase gebruikt, zodat er niet twee waarheden ontstaan.
  if (weight && weightTarget && weight > weightTarget) {
    const kilos = +(weight - weightTarget).toFixed(1);
    const winstPct = kilos * KOSTEN_PER_KILO_PCT;
    const doelLichter = nodig?.ef ? nodig.ef / (1 + winstPct / 100) : null;
    const w = wekenTot({ doelEf: doelLichter, nu, beste, pctPerWeek: NIEUW_PER_WEEK_PCT });
    knoppen.push({
      id: 'gewicht', label: `${String(kilos).replace('.', ',')} kg lichter (${weightTarget} kg)`,
      effect: `scheelt ongeveer ${String(+winstPct.toFixed(1)).replace('.', ',')}% tempo`,
      datum: datumVoor(w), weken: w,
      waarom: 'Lichter is sneller bij dezelfde hartslag — maar alleen als het eraf gaat '
        + 'zonder tekort. In een tekort verlies je meer economie dan de kilo oplevert, '
        + 'dus dit is een knop voor ná 12 december.',
    });
  }

  const haalbaarOpRace = raceDate && nodig?.ef != null && efOpRace != null
    && efOpRace >= nodig.ef;

  return {
    known: true,
    target: { sec: targetSec, tijd: fmtTijd(targetSec / 60), distanceKm, hrCap, terrain,
      label: terreinInfo.label },
    current: nu,
    best: +beste.toFixed(3),
    required: nodig?.ef ?? null,
    impossible: !!nodig?.onmogelijk,
    gapPct: nodig?.ef ? Math.round((nodig.ef / nu - 1) * 100) : null,
    // Wanneer, bij drie tempo's van vooruitgang.
    weeks: { low: wekenTraag, mid: wekenMid, high: wekenSnel },
    dates: { low: datumVoor(wekenTraag), mid: datumVoor(wekenMid), high: datumVoor(wekenSnel) },
    monthMid: fmtMaand(datumVoor(wekenMid)),
    // En wat er op de racedatum zelf werkelijk in zit.
    race: raceDate ? {
      date: raceDate, weeks: +wekenTotRace.toFixed(1),
      ef: +efOpRace.toFixed(3),
      pace: tempoOpRace, time: tempoOpRace * distanceKm,
      reachable: haalbaarOpRace,
    } : null,
    levers: knoppen,
    fmt: { pace: fmtPace, time: fmtTijd, maand: fmtMaand },
    // Eén zin die het hele antwoord draagt.
    line: nodig?.onmogelijk
      ? `${fmtTijd(targetSec / 60)} op ${terreinInfo.label} kan bij geen enkele efficiëntie: `
        + 'de ondergrondtoeslag alleen al is groter dan het doeltempo.'
      : haalbaarOpRace
        ? `${fmtTijd(targetSec / 60)} zit op ${raceDate} binnen bereik.`
        : `${fmtTijd(targetSec / 60)} op ${terreinInfo.label} bij hartslag ${hrCap} vraagt `
          + `efficiëntie ${nodig?.ef}. Je staat op ${nu} en liep als beste ${+beste.toFixed(3)}. `
          + `Bij ${String(NIEUW_PER_WEEK_PCT).replace('.', ',')}% per week is dat `
          + `${wekenMid} weken: ${fmtMaand(datumVoor(wekenMid))}.`,
  };
}
