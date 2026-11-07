// Wat zou deze sessie moeten opleveren?
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG
//
// Zij wil bij elke volgende training zien welke progressie ze zou moeten
// maken in hartslag en tempo. Terecht: een plan dat alleen zegt "8 min
// lopen × 3 bij 106–132 bpm" vertelt je wat je doet, niet of je vooruit
// gaat.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT GEEN VOORSPELLING IS
//
// Er zijn twee manieren om een doel per sessie te zetten, en ze zijn niet
// gelijkwaardig.
//
// De eerste is terugrekenen vanaf de wens: ze wil 6:30/km, dus deel het
// verschil door het aantal weken en zet elke week een stapje. Dat voelt
// concreet en het is fictie — het getal komt uit de wens, niet uit haar
// lichaam, en elke week dat ze het niet haalt is een week "achterstand"
// op iets wat nooit is gemeten.
//
// De tweede is vooruitrekenen vanaf wat er staat: haar gemeten
// efficiëntie, vermenigvuldigd met een tempo van vooruitgang dat in de
// literatuur en in haar eigen reeks terug te zien is. Dan is het doel van
// volgende week altijd een klein stukje boven wat ze nu kán, en nooit een
// getal waar ze niet bij in de buurt komt.
//
// Dit bestand doet het tweede, en zegt er altijd bij waar het vandaan
// komt. Eén procent efficiëntiewinst per week is de bovenkant van wat met
// alles mee haalbaar is (frequentie, kracht, pasfrequentie, genoeg eten);
// het is bewust de bovenkant, zodat het doel iets om naar te reiken is en
// niet iets om onder te blijven.
//
// En het belangrijkste: naast het doel staat altijd wat ze dezelfde soort
// sessie de vorige keer werkelijk liep. Dat is gemeten, en daarmee het
// enige eerlijke ijkpunt.
// ─────────────────────────────────────────────────────────────────

import { efficiencyTrend, paceAtHr } from './efficiency';
import { todayLocal, daysBetween } from './datetime';

// Hoeveel efficiëntie kun je per week winnen als alles meezit? Eén procent
// is de bovenkant: het grootste deel daarvan komt uit loopeconomie
// (pasfrequentie, kracht), niet uit de aerobe motor, die veel trager
// beweegt. Twee procent per week bestaat niet over vijf weken.
export const WINST_PER_WEEK_PCT = 1.0;

// Onder dit aantal sessies is er geen betrouwbaar vertrekpunt en wordt er
// geen doel gezet.
const MIN_SESSIES = 3;

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return null;
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const secVerschil = (vanMin, naarMin) => Math.round((vanMin - naarMin) * 60);

// Het doel voor één sessie op een gegeven datum en hartslag.
export function sessionTarget({ date, hr = 132, currentDate = todayLocal(),
  workouts = null, purpose = null } = {}) {
  const t = efficiencyTrend({ currentDate, workouts });
  if (!t.known || t.count < MIN_SESSIES) {
    return {
      known: false,
      why: t.known
        ? `${t.count} gemeten sessies; vanaf ${MIN_SESSIES} staat hier wat deze sessie `
          + 'zou moeten opleveren.'
        : t.why,
    };
  }

  const weken = Math.max(0, daysBetween(currentDate, date) / 7);
  const doelEf = +(t.current * (1 + (WINST_PER_WEEK_PCT / 100) * weken)).toFixed(3);
  const nuTempo = paceAtHr(t.current, hr);
  const doelTempo = paceAtHr(doelEf, hr);

  // Wat liep ze de vorige keer op dit soort sessie? Alleen sessies met een
  // vergelijkbare gemiddelde hartslag; anders vergelijk je een rustige
  // duurloop met een tempoblok.
  const sessies = t.sessions || [];
  const vergelijkbaar = sessies.filter(s => Math.abs(s.avgHr - hr) <= 8);
  const vorige = (vergelijkbaar.length ? vergelijkbaar : sessies)
    .slice(-1)[0] || null;

  return {
    known: true,
    date,
    hr,
    weeksOut: +weken.toFixed(1),
    currentEf: t.current,
    targetEf: doelEf,
    currentPace: nuTempo,
    targetPace: doelTempo,
    gainSeconds: secVerschil(nuTempo, doelTempo),
    last: vorige ? {
      date: vorige.date, pace: vorige.paceMin, hr: vorige.avgHr, ef: vorige.ef,
      comparable: vergelijkbaar.includes(vorige),
    } : null,
    line: weken < 0.5
      ? `Mik op ${fmtPace(doelTempo)}/km bij hartslag ${hr}`
      : `Mik op ${fmtPace(doelTempo)}/km bij hartslag ${hr} — dat is `
        + `${secVerschil(nuTempo, doelTempo)} sec/km sneller dan waar je nu staat`,
    lastLine: vorige
      ? `Vorige vergelijkbare sessie (${vorige.date.slice(5)}): ${fmtPace(vorige.paceMin)}/km `
        + `bij hartslag ${vorige.avgHr}.`
      : null,
    why: `Je gemeten efficiëntie is ${t.current} (meters per minuut per hartslag). Dit doel `
      + `rekent met ${WINST_PER_WEEK_PCT}% winst per week — de bovenkant van wat haalbaar is `
      + 'als frequentie, kracht, pasfrequentie en eten allemaal meedoen. Het komt dus uit '
      + 'wat je nu kunt, niet uit je wenstijd.',
    // Wat er gebeurt als dit tempo wordt aangehouden tot de race.
    purpose,
  };
}

// Hetzelfde, maar dan voor een hele reeks dagen in één keer: één
// efficiëntieberekening voor alle dagen samen in plaats van per dag.
export function targetsForDays(dagen, { currentDate = todayLocal(), workouts = null } = {}) {
  const t = efficiencyTrend({ currentDate, workouts });
  const uit = new Map();
  if (!t.known || t.count < MIN_SESSIES) return { known: false, why: t.why, targets: uit };

  for (const d of dagen) {
    if (!d?.date || !d.hr) continue;
    uit.set(d.date, sessionTarget({ date: d.date, hr: d.hr, currentDate, workouts }));
  }
  return { known: true, base: t.current, targets: uit };
}

// De hartslag waarop een sessie gelopen wordt, uit het voorschrift. Het
// voorschrift is tekst ("Mik op 106–132 bpm (onder VT1) · grens 145");
// hier komt het getal eruit waarop het doel gezet wordt: de bovenkant van
// het richtgebied, want daar wordt het tempo gemeten.
export function hrUitVoorschrift(regel, { fallback = 132 } = {}) {
  if (!regel) return fallback;
  const bereik = String(regel).match(/(\d{2,3})\s*[–-]\s*(\d{2,3})/);
  if (bereik) return Number(bereik[2]);
  const los = String(regel).match(/(\d{2,3})/);
  return los ? Number(los[1]) : fallback;
}
