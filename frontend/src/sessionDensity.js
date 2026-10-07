// Hoe dicht een sessie is: hoeveel lopen, hoeveel pauze ertussen.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER IS
//
// De economievergelijking keek naar één ding: looptempo bij vergelijkbare
// hartslag. Dat lijkt zuiver, maar het mist iets dat zij zelf opmerkte — de
// wandelpauze tussen de blokken.
//
// Worden de pauzes korter, dan begin je elk volgend loopblok met minder
// herstel in de benen. Hetzelfde tempo kost dan méér, en bij een
// hartslagplafond betekent dat: je loopt langzamer. Precies het patroon dat
// als "loopeconomie gaat achteruit" werd gelezen.
//
// Maar korter pauzeren bij hetzelfde loopblok ís de opbouw. Het is dezelfde
// vergissing als bij de doorlopende blokken: de coach waarschuwde voor het
// gedrag dat het plan zelf vroeg. In de bibliotheek staat die stap er
// letterlijk in — "kortere pauze bij hetzelfde loopblok, de eerste
// efficiëntiestap".
//
// ─────────────────────────────────────────────────────────────────
// WAT HIER WORDT GEMETEN
//
// Per sessie, uit de ronden van het horloge:
//
//   pauzePerBlok     gemiddelde wandelminuten tussen twee loopblokken
//   werkRustRatio    loopminuten gedeeld door wandelminuten
//   loopAandeel      welk deel van de sessie je werkelijk liep
//   blokLengte       gemiddelde lengte van een loopblok
//
// Vier getallen die samen zeggen hoe zwaar de vorm was — los van hoe snel
// je liep. Zonder die vier is "trager bij dezelfde hartslag" niet te
// interpreteren, en wordt het dus verkeerd geïnterpreteerd.
// ─────────────────────────────────────────────────────────────────

import { todayLocal } from './datetime';
import { loadWorkouts } from './workouts';
import { paceBreakdown, SEGMENT } from './pace';
import { loadHrSettings } from './goals';

// Hoeveel seconden korter moet de pauze per blok zijn voordat het telt?
// Onder een derde minuut is het ruis in de rondeknop, niet een andere vorm.
export const PAUSE_SHRINK_SEC = 20;

// En hoeveel relatieve stijging van de werk-rustverhouding telt als dichter?
export const RATIO_RISE = 0.15;

// Onder dit aantal sessies per helft valt er niets te vergelijken.
export const MIN_PER_HALF = 2;

const gem = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const rond1 = (x) => (x == null ? null : +x.toFixed(1));

// ── De dichtheid van één sessie ─────────────────────────────────
export function densityOf(workout, { hrSettings = null } = {}) {
  if (!workout) return { available: false, reason: 'geen sessie' };
  const b = paceBreakdown(workout, { hrSettings: hrSettings || loadHrSettings() });
  if (!b.available || b.derived) {
    return { available: false, date: workout.date,
      reason: 'geen ronden om loop- en wandelblokken te scheiden' };
  }

  const loopBlokken = b.segments.filter(s => s.kind === SEGMENT.RUN);
  const wandelBlokken = b.segments.filter(s => s.kind === SEGMENT.WALK);
  if (!loopBlokken.length) {
    return { available: false, date: workout.date, reason: 'geen loopblokken herkend' };
  }

  const loopMin = b.runMinutes || 0;
  const wandelMin = b.walkMinutes || 0;

  // Pauzes tússen de blokken. Bij vier loopblokken liggen er drie pauzes
  // tussen; een wandelstuk vooraf of achteraf is geen pauze maar warming-up
  // of uitlopen, en dat moet de noemer niet verwateren.
  const pauzes = Math.max(0, Math.min(wandelBlokken.length, loopBlokken.length - 1));
  const pauzePerBlok = pauzes > 0 ? wandelMin / wandelBlokken.length : null;

  return {
    available: true,
    date: workout.date,
    runBlocks: loopBlokken.length,
    walkBlocks: wandelBlokken.length,
    pausesBetween: pauzes,
    blockMin: rond1(gem(loopBlokken.map(s => s.minutes))),
    pausePerBlockMin: rond1(pauzePerBlok),
    runMinutes: rond1(loopMin),
    walkMinutes: rond1(wandelMin),
    // Oneindig als er niet gewandeld is: dat is doorlopend, de dichtste vorm
    // die er is. Dat wordt verderop expliciet apart behandeld.
    workRestRatio: wandelMin > 0 ? rond1(loopMin / wandelMin) : null,
    continuous: wandelMin === 0 || loopBlokken.length === 1,
    runShare: loopMin + wandelMin > 0 ? rond1(loopMin / (loopMin + wandelMin)) : null,
    runPace: b.runPace, runHr: b.runHr,
  };
}

export function densityByDate({ currentDate = todayLocal() } = {}) {
  const hr = loadHrSettings();
  const uit = {};
  for (const w of loadWorkouts()) {
    if (w.date > currentDate) continue;
    const d = densityOf(w, { hrSettings: hr });
    if (d.available) uit[w.date] = d;
  }
  return uit;
}

// ── De vergelijking tussen twee reeksen ─────────────────────────
//
// Dezelfde twee helften als de economievergelijking, zodat de uitkomsten
// over hetzelfde gaan. Eerder vergeleken verschillende onderdelen van de
// app verschillende vensters, en dan staan er twee getallen in één kaart.
export function densityTrend({ earlyDates = [], lateDates = [],
  currentDate = todayLocal(), byDate = null } = {}) {
  const alles = byDate || densityByDate({ currentDate });
  const vroeg = earlyDates.map(d => alles[d]).filter(Boolean);
  const laat = lateDates.map(d => alles[d]).filter(Boolean);

  if (vroeg.length < MIN_PER_HALF || laat.length < MIN_PER_HALF) {
    return { available: false, early: vroeg.length, late: laat.length,
      note: 'Te weinig sessies met ronden om de vorm van de sessies te vergelijken.' };
  }

  const pV = gem(vroeg.map(d => d.pausePerBlockMin).filter(x => x != null));
  const pL = gem(laat.map(d => d.pausePerBlockMin).filter(x => x != null));
  const rV = gem(vroeg.map(d => d.workRestRatio).filter(x => x != null));
  const rL = gem(laat.map(d => d.workRestRatio).filter(x => x != null));
  const bV = gem(vroeg.map(d => d.blockMin).filter(x => x != null));
  const bL = gem(laat.map(d => d.blockMin).filter(x => x != null));
  const aV = gem(vroeg.map(d => d.runShare).filter(x => x != null));
  const aL = gem(laat.map(d => d.runShare).filter(x => x != null));

  const pauzeKorterSec = pV != null && pL != null ? Math.round((pV - pL) * 60) : null;
  const ratioStijging = rV != null && rL != null && rV > 0 ? (rL - rV) / rV : null;
  const naarDoorlopend = vroeg.every(d => !d.continuous) && laat.some(d => d.continuous);

  const dichter = naarDoorlopend
    || (pauzeKorterSec != null && pauzeKorterSec >= PAUSE_SHRINK_SEC)
    || (ratioStijging != null && ratioStijging >= RATIO_RISE);

  // Langer per blok is ook zwaarder, maar langs een andere as. Ze worden
  // apart gemeld: samen op één hoop zegt het niets over wat er veranderde.
  const blokLanger = bV != null && bL != null && bL - bV >= 0.5;

  const regels = [];
  if (naarDoorlopend) {
    regels.push('Je bent in de recente sessies doorlopend gaan lopen in plaats van met wandelpauzes.');
  } else if (pauzeKorterSec != null && pauzeKorterSec >= PAUSE_SHRINK_SEC) {
    regels.push(`De wandelpauze tussen je blokken werd ${pauzeKorterSec} seconden korter (${rond1(pV)} → ${rond1(pL)} min per pauze).`);
  }
  if (ratioStijging != null && ratioStijging >= RATIO_RISE && !naarDoorlopend) {
    regels.push(`Je verhouding lopen/wandelen ging van ${rond1(rV)} naar ${rond1(rL)} — meer lopen per minuut wandelen.`);
  }
  if (blokLanger) {
    regels.push(`Je loopblokken werden langer: ${rond1(bV)} → ${rond1(bL)} minuten.`);
  }
  if (aV != null && aL != null && aL - aV >= 0.05) {
    regels.push(`Het aandeel echt lopen in de sessie steeg van ${Math.round(aV * 100)}% naar ${Math.round(aL * 100)}%.`);
  }

  return {
    available: true,
    denser: dichter,
    blockLonger: blokLanger,
    toContinuous: naarDoorlopend,
    pauseShrankSec: pauzeKorterSec,
    ratioRise: ratioStijging != null ? +(ratioStijging * 100).toFixed(0) : null,
    pauseFrom: rond1(pV), pauseTo: rond1(pL),
    ratioFrom: rond1(rV), ratioTo: rond1(rL),
    blockFrom: rond1(bV), blockTo: rond1(bL),
    runShareFrom: aV != null ? Math.round(aV * 100) : null,
    runShareTo: aL != null ? Math.round(aL * 100) : null,
    lines: regels,
    // Waarom dit telt. Deze zin hoort bij de meting en niet in het scherm,
    // zodat hij niet op drie plekken anders komt te staan.
    why: dichter
      ? 'Minder herstel tussen de blokken maakt hetzelfde tempo zwaarder. Bij een hartslagplafond betekent dat langzamer lopen — dat is de vorm die veranderde, niet je vermogen dat afnam.'
      : null,
    counts: { early: vroeg.length, late: laat.length },
  };
}
