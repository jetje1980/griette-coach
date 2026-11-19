// Eén tempo vasthouden en kijken of je hartslag zakt.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Hoe gaan we zorgen dat ik echt sneller op dit tempo kom met lagere
// hartslag? Kan ik niet gewoon op dit tempo trainen, en dat elke x dan de
// hartslag wel omlaag gaat?"
//
// Dat kan, en het is methodisch beter dan wat hier stond.
//
// De sleutelsessie werd voorgeschreven op hártslag: "zes keer twee minuten
// op werkhartslag". Dan is de hartslag de opdracht en het tempo de
// uitkomst, en zie je vooruitgang als een tempo dat stijgt. Dat werkt,
// maar het is lastig uit te voeren — je stuurt onderweg op een getal dat
// traag reageert — en de meting is rommelig, want tempo én hartslag
// bewegen allebei.
//
// Andersom is scherper. Houd het tempo vast en laat de hartslag de
// uitkomst zijn. Dan is er per sessie nog maar één variabele, en die is
// precies wat zij wil weten: zakt mijn hartslag bij dit tempo? Dat is geen
// afgeleide van een trend over zes sessies maar een directe herhaalbare
// meting, en daarmee het eerlijkste antwoord dat deze app kan geven.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT NIET IS
//
// Geen vrijbrief om alles op dit tempo te lopen. Niet omdat hard trainen
// niet werkt — het werkt juist goed per minuut — maar omdat je er weinig
// van kunt verdragen. De aanpassingen die de hartslag bij een gegeven
// tempo omlaag brengen (plasmavolume, slagvolume, haarvaten, mitochondriën)
// komen vooral van opgetelde tíjd, en tijd is alleen te maken op lage
// intensiteit. Drie keer dertig minuten op 163 is negentig minuten prikkel
// tegen de hoogste herstelprijs die er is.
//
// Dus: één ankersessie per week, de rest rustig. Dat is de verhouding
// waar het hele plan op rust, en dit bestand verandert daar niets aan —
// het maakt alleen die ene sessie meetbaar.

import { todayLocal, daysBetween } from './datetime';
import { loadWorkouts, fmtPace } from './workouts';
import { steadyEfficiency } from './gemetenTempo';
import { efficiencyTrend } from './efficiency';

// Een blok telt pas als anker als het lang genoeg is om iets te bewijzen.
// Vijf minuten is dezelfde ondergrens als in gemetenTempo: daaronder loopt
// de hartslag nog achter op de inspanning.
export const ANKER_MIN_BLOK_SEC = 300;

// Hoe dicht moet een sessie bij het ankertempo liggen om als herhaling
// van dezelfde test te tellen? Achttien seconden per kilometer. Ruimer en
// je vergelijkt verschillende inspanningen; strakker en er valt in de
// praktijk nooit iets binnen, want niemand loopt op de seconde gelijk.
export const ANKER_MARGE = 0.3;

// Hoe lang blijft een anker staan? Het hele punt is dat het tempo níét
// meebeweegt: een lat die meeschuift meet niets. Pas als zij het anker
// duidelijk voorbij loopt — en niet één keer maar twee — verschuift het.
export const ANKER_VENSTER_DAGEN = 120;
export const ANKER_VERBETER_MARGE = 0.25;

// De sessie zelf: blokken van drie minuten. Lang genoeg om de hartslag te
// laten uitkomen op zijn werkelijke waarde, kort genoeg om het tempo zuiver
// vast te houden en om er een paar van te doen zonder de dag te verbranden.
// Hoeveel metingen op het ankertempo zijn er nodig voor een richting?
// Met twee vergelijk je één sessie met één sessie, en dat is precies wat
// elders in deze app "ruis" heet. Vier is het minimum waarbij beide helften
// een mediaan hebben die iets betekent.
export const ANKER_MIN_METINGEN = 4;

// En hoeveel slagen verschil is een verschil? Een optische polsmeter zit er
// makkelijk een paar naast, en dag tot dag schommelt hartslag met slaap,
// warmte en cyclus. Onder de drie slagen is "gelijk" het eerlijke antwoord.
export const ANKER_RUIS = 3;

export const ANKER_BLOK_MIN = 3;
export const ANKER_PAUZE_MIN = 2;
export const ANKER_REPS = [3, 4, 5, 6];

const mediaan = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── Alle bruikbare metingen ─────────────────────────────────────
//
// Welke sessies vertrouwen we? Dezelfde als de rest van de app, en dat is
// hier geen detail maar de kern. De eerste versie koos als anker haar
// sessie van 4 oktober: 7:53/km op hartslag 125. Dat is precies de sessie
// die efficiencyTrend al als uitbijter weggooit — bij haar economie hoort
// op dat tempo een hartslag rond 160, niet 125. Had dat anker gestaan,
// dan was de meetlat een meetfout geweest en had elke volgende sessie
// er slechter uitgezien dan hij was.
function metingen({ currentDate, workouts, venster }) {
  let uitbijters = new Set();
  try {
    const t = efficiencyTrend({ currentDate, workouts });
    uitbijters = new Set((t.outliers || []).map(o => o.date));
  } catch { uitbijters = new Set(); }

  return (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate
      && daysBetween(w.date, currentDate) <= venster
      && (w.activityType === 'run' || w.activityType == null))
    .map(steadyEfficiency)
    .filter(Boolean)
    // Een weggevallen hartslagmeting maakt een sessie kunstmatig goed, en
    // juist dáár zou hij als anker uit komen. Zie gemetenTempo.
    .filter(s => !s.hrSuspect && !uitbijters.has(s.date)
      && s.langsteBlokSec >= ANKER_MIN_BLOK_SEC)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Het ankertempo ──────────────────────────────────────────────
//
// Niet haar snelste sessie ooit en niet een gemiddelde, maar het snelste
// tempo dat zij aantoonbaar een blok lang heeft vastgehouden. Dat is een
// tempo waarvan vaststaat dat ze het kán — en dat is de enige eis, want
// het anker is een meetlat en geen doel.
export function ankerTempo({ currentDate = todayLocal(), workouts = null,
  venster = ANKER_VENSTER_DAGEN } = {}) {
  const alle = metingen({ currentDate, workouts, venster });
  if (!alle.length) {
    return {
      known: false,
      why: 'Nog geen sessie met een loopblok van vijf minuten of langer. Zodra die er '
        + 'is, staat hier het tempo waarop we je hartslag gaan volgen.',
    };
  }

  const snelste = alle.reduce((a, s) => (s.paceMin < a.paceMin ? s : a), alle[0]);
  return {
    known: true,
    paceMin: snelste.paceMin,
    pace: fmtPace(snelste.paceMin),
    vanaf: snelste.date,
    hrToen: snelste.avgHr,
    blokMin: +(snelste.langsteBlokSec / 60).toFixed(1),
    uitleg: `Het snelste tempo dat je aantoonbaar een blok lang hebt vastgehouden: `
      + `${fmtPace(snelste.paceMin)}/km op ${snelste.date.slice(8)}-${snelste.date.slice(5, 7)}, `
      + `${Math.round(snelste.langsteBlokSec / 60)} minuten aaneen, op hartslag `
      + `${snelste.avgHr}. Dat is de lat: niet sneller worden, maar dit tempo halen bij `
      + 'een lagere hartslag.',
  };
}

// ── Wat de sessie wordt ─────────────────────────────────────────
export function ankerSessie({ anker, weekIndex = 0 } = {}) {
  if (!anker?.known) return null;
  const reps = ANKER_REPS[Math.min(ANKER_REPS.length - 1, Math.floor(weekIndex / 2))];
  return {
    id: `anker_${reps}`,
    reps,
    blokMin: ANKER_BLOK_MIN,
    pauzeMin: ANKER_PAUZE_MIN,
    paceMin: anker.paceMin,
    pace: anker.pace,
    minutes: reps * (ANKER_BLOK_MIN + ANKER_PAUZE_MIN),
    label: `${reps} × ${ANKER_BLOK_MIN} min op ${anker.pace}/km`,
    how: `Loop elk blok op ${anker.pace}/km — niet sneller, ook niet als het makkelijk `
      + `voelt. Daartussen ${ANKER_PAUZE_MIN} minuten wandelen. Het tempo staat vast; `
      + 'je hartslag is wat we meten. Zakt die over de weken bij hetzelfde tempo, dan '
      + 'word je economischer, en dat is precies waar het om gaat.',
    waarom: 'Bij een vast tempo is je hartslag de enige variabele. Dat maakt het een '
      + 'herhaalbare test in plaats van een trainingsgevoel — en je ziet je vooruitgang '
      + 'als één getal dat zakt.',
  };
}

// ── Zakt de hartslag bij dat tempo? ─────────────────────────────
//
// De eigenlijke vraag. Alleen sessies die werkelijk rond het ankertempo
// zijn gelopen tellen mee; een rustige duurloop zegt niets over hoe zwaar
// dit tempo is.
export function ankerTrend({ currentDate = todayLocal(), workouts = null,
  anker = null, venster = ANKER_VENSTER_DAGEN } = {}) {
  const a = anker || ankerTempo({ currentDate, workouts, venster });
  if (!a?.known) return { known: false, why: a?.why || null };

  const opTempo = metingen({ currentDate, workouts, venster })
    .filter(s => Math.abs(s.paceMin - a.paceMin) <= ANKER_MARGE);

  const lijst = opTempo.map(s => ({ date: s.date, hr: s.avgHr, paceMin: s.paceMin,
    blokMin: +(s.langsteBlokSec / 60).toFixed(1) }));

  if (opTempo.length < ANKER_MIN_METINGEN) {
    return {
      known: false,
      anker: a,
      metingen: lijst,
      // Wat er wél is, staat er. Een leeg scherm met "nog niet genoeg"
      // verzwijgt metingen die zij gewoon heeft gedaan.
      why: opTempo.length === 0
        ? `Nog geen sessie rond ${a.pace}/km om mee te vergelijken. Loop de ankersessie `
          + 'en dit vult zich vanzelf.'
        : `${opTempo.length} van de ${ANKER_MIN_METINGEN} sessies op ${a.pace}/km die `
          + 'nodig zijn voor een richting: '
          + lijst.map(m => `${m.date.slice(8)}-${m.date.slice(5, 7)} op ${m.hr}`).join(', ')
          + '. Met minder vergelijk je één sessie met één sessie, en dat is ruis.',
    };
  }

  // Eerste helft tegen tweede helft, met de mediaan: één sessie is ruis en
  // een gemiddelde laat zich door één slechte dag meeslepen. Hetzelfde
  // principe als in efficiencyTrend, zodat de twee niet uit elkaar lopen.
  const half = Math.floor(opTempo.length / 2);
  const toen = mediaan(opTempo.slice(0, half).map(s => s.avgHr));
  const nu = mediaan(opTempo.slice(-half).map(s => s.avgHr));
  const delta = Math.round(nu - toen);

  const richting = delta <= -ANKER_RUIS ? 'zakt'
    : delta >= ANKER_RUIS ? 'stijgt' : 'gelijk';

  return {
    known: true,
    anker: a,
    metingen: lijst,
    aantal: opTempo.length,
    hrToen: Math.round(toen),
    hrNu: Math.round(nu),
    delta,
    richting,
    regel: richting === 'zakt'
      ? `Op ${a.pace}/km ging je hartslag van ${Math.round(toen)} naar ${Math.round(nu)} — `
        + `${Math.abs(delta)} slagen lager voor hetzelfde tempo. Dit is precies wat je `
        + 'vroeg, en het is gemeten en niet gevoeld.'
      : richting === 'stijgt'
        ? `Op ${a.pace}/km ging je hartslag van ${Math.round(toen)} naar ${Math.round(nu)} — `
          + `${delta} slagen hóger. Kijk eerst naar de omstandigheden: zacht zand, hitte, `
          + 'slecht geslapen of de tweede helft van je cyclus verklaren dit vaker dan '
          + 'vormverlies.'
        : `Op ${a.pace}/km ligt je hartslag nog rond ${Math.round(nu)}. Nog geen `
          + 'verschuiving — dat duurt weken, niet sessies.',
  };
}
