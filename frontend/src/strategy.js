// De strategie. Eén plek, en dit is hem.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// Vier plekken beschreven onafhankelijk van elkaar in welke fase je zat:
//
//   raceplan.js PHASE        BASE / SPECIFIC / TAPER, afgeleid uit het
//                            aantal weken tot de race
//   trainingBlocks.js        zeven blokken met vaste kalenderdatums
//   runningSchema.js         twaalf genummerde weken, ook vastgeprikt
//   CONTINUITY_LADDER        negen treden met eigen verwachte datums
//
// Ze konden elkaar tegenspreken en deden dat ook. Op 15 november zei het
// blokplan "5 km vasthouden", de ladder "40 minuten", en het weekschema
// niets, want dat liep tot half oktober. Wie dan vraagt wat de strategie is,
// krijgt drie antwoorden.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE HIER GELDT
//
// De kalender is een verwachting. Wat je aantoonbaar verdraagt is de
// werkelijkheid, en die wint. Een blokplan dat zegt dat je in november
// doorlopend loopt, terwijl je langste verdragen blok twaalf minuten is,
// beschrijft een wens — geen fase.
//
// Daarom wordt de fase hier afgeleid uit drie dingen, in deze volgorde:
//
//   1. WAT KUN JE AL      het bewezen loopblok en de verdragen afstand,
//                         uitgedrukt als niveau in de sessiebibliotheek
//   2. WAT VRAAGT HET DOEL  hoeveel weken tot de eerstvolgende race, en
//                         hoeveel van de afstand je al dekt
//   3. WAT LAAT HERSTEL TOE  bij PEM-signalen of een slechte respons is er
//                         geen opbouwfase, wat de kalender ook zegt
//
// Het blokplan blijft bestaan als intentie en wordt getoond, maar het
// overrulet nooit meer wat je lichaam laat zien. Waar plan en werkelijkheid
// uiteenlopen, zegt deze module dat met zoveel woorden.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import { levelForBlock, MAX_LEVEL, PURPOSE_ID } from './data/sessionLibrary';
import { getCurrentBlock } from './data/trainingBlocks';

// ── De fasen ────────────────────────────────────────────────────
// Vier, niet drie: "herstellen" is een fase op zich en geen uitzondering.
export const PHASE = {
  RECOVER: {
    id: 'RECOVER', label: 'Herstellen',
    aim: 'Niets opbouwen. De prikkel die er al was moet eerst verwerkt worden.',
    builds: false,
  },
  BASE: {
    id: 'BASE', label: 'Basis bouwen',
    aim: 'Langer kunnen lopen bij dezelfde hartslag. Breedte vóór scherpte.',
    builds: true,
  },
  SPECIFIC: {
    id: 'SPECIFIC', label: 'Racespecifiek',
    aim: 'Wennen aan het tempo en de duur die je doel vraagt.',
    builds: true,
  },
  TAPER: {
    id: 'TAPER', label: 'Taper',
    aim: 'Vers aan de start. Er valt niets meer te winnen, alleen te verliezen.',
    builds: false,
  },
};

export const TAPER_DAYS = 10;
export const SPECIFIC_WEEKS = 6;

// Hoeveel van de doelafstand moet je verdragen voordat racespecifiek werk
// zinvol is? Onder deze dekking is tempo trainen bouwen op zand.
export const SPECIFIC_MIN_COVERAGE = 0.7;

// ── De strategie van vandaag ────────────────────────────────────
//
// `capability` en `goal` komen van buiten, zodat deze module zelf niets
// hoeft te weten over Strava, hartslagmodellen of racedoelen. Dat houdt hem
// testbaar en zorgt dat er geen tweede berekening van dezelfde dingen
// ontstaat — precies de fout die hier werd opgeruimd.
export function currentStrategy({
  capability = null,      // { provenBlockMin, longestToleratedKm, sessions }
  goal = null,            // { name, date, distanceKm, targetTimeSec }
  recovery = null,        // { green, pemFreeWeeks, warnings }
  currentDate = todayLocal(),
} = {}) {
  const blockMin = capability?.provenBlockMin ?? 0;
  const level = levelForBlock(blockMin);
  const verdragen = capability?.longestToleratedKm ?? 0;
  const dekking = goal?.distanceKm ? Math.min(1, verdragen / goal.distanceKm) : null;
  const dagen = goal?.date ? daysBetween(currentDate, goal.date) : null;
  const weken = dagen != null ? dagen / 7 : null;

  const redenen = [];

  // 1. Herstel gaat voor alles.
  const groen = recovery ? recovery.green !== false : true;
  if (!groen) {
    redenen.push('je herstelrespons is op dit moment niet schoon');
    return maak(PHASE.RECOVER, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      lever: 'geen', volgende: null });
  }

  // 2. Taper: alleen als er werkelijk een race aankomt.
  if (dagen != null && dagen >= 0 && dagen <= TAPER_DAYS) {
    redenen.push(`${goal.name} is over ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`);
    return maak(PHASE.TAPER, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      lever: 'geen', volgende: null });
  }

  // 3. Racespecifiek: dichtbij genoeg én je dekt de afstand al grotendeels.
  //    Dat tweede is de voorwaarde die ontbrak. Tempo trainen terwijl je de
  //    helft van de afstand verdraagt, levert een snelle helft op.
  if (weken != null && weken <= SPECIFIC_WEEKS) {
    if (dekking != null && dekking >= SPECIFIC_MIN_COVERAGE) {
      redenen.push(`nog ${Math.round(weken)} weken tot ${goal.name}`);
      redenen.push(`je verdraagt ${Math.round(dekking * 100)}% van de afstand`);
      return maak(PHASE.SPECIFIC, { level, blockMin, dekking, weken, goal, redenen, currentDate,
        lever: 'tempo', volgende: volgendeStap(level, PHASE.SPECIFIC) });
    }
    redenen.push(`${goal.name} is dichtbij, maar je verdraagt pas ${Math.round((dekking || 0) * 100)}% van de afstand`);
    redenen.push('afstand gaat vóór tempo — anders traint je snelle helft');
    return maak(PHASE.BASE, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      lever: 'duur', volgende: volgendeStap(level, PHASE.BASE) });
  }

  // 4. Basis. De standaardtoestand, en dat is geen tussenfase.
  if (goal) redenen.push(`nog ${Math.round(weken)} weken tot ${goal.name} — tijd genoeg voor breedte`);
  else redenen.push('geen race op de kalender, dus breedte bouwen');
  return maak(PHASE.BASE, { level, blockMin, dekking, weken, goal, redenen, currentDate,
    lever: 'duur', volgende: volgendeStap(level, PHASE.BASE) });
}

function volgendeStap(level, phase) {
  if (!phase.builds) return null;
  return Math.min(MAX_LEVEL, level + 1);
}

function maak(phase, x) {
  const blokIntentie = getCurrentBlock(x.currentDate);
  // Loopt het blokplan uit de pas met wat je werkelijk kunt? Dat is geen
  // fout maar informatie, en het hoort zichtbaar te zijn in plaats van dat
  // één van de twee stilzwijgend wint.
  const plantContinu = /doorlopend|vasthouden|continu/i.test(
    `${blokIntentie?.name} ${blokIntentie?.adaptation}`);
  const kanContinu = x.blockMin >= 15;
  const afwijking = plantContinu && !kanContinu
    ? `Het plan gaat er in deze periode van uit dat je doorlopend loopt, maar je langste verdragen blok is ${x.blockMin} minuten. Je opbouw telt, niet de kalender — de rest van het plan schuift mee.`
    : null;

  return {
    phase: phase.id,
    label: phase.label,
    aim: phase.aim,
    builds: phase.builds,
    level: x.level,
    nextLevel: x.volgende,
    provenBlockMin: x.blockMin,
    coverage: x.dekking,
    weeksToGoal: x.weken != null ? +x.weken.toFixed(1) : null,
    goal: x.goal ? { name: x.goal.name, date: x.goal.date, distanceKm: x.goal.distanceKm } : null,
    lever: x.lever,
    reasons: x.redenen,
    // Het blokplan als intentie, nadrukkelijk niet als gezag.
    plannedBlock: blokIntentie ? { id: blokIntentie.id, name: blokIntentie.name } : null,
    planMismatch: afwijking,
    summary: `${phase.label}. ${phase.aim}`,
    why: x.redenen.join('; '),
  };
}

// ── Welke doelen horen bij deze fase? ───────────────────────────
// Meer dan één, want een week bestaat niet uit één soort training. De
// volgorde is de voorkeursvolgorde: het eerste doel dat past wint.
export const PHASE_PURPOSES = {
  RECOVER: [PURPOSE_ID.RECOVERY],
  BASE: [PURPOSE_ID.DURABILITY, PURPOSE_ID.EASY_ECONOMY, PURPOSE_ID.QUALITY_LITE],
  SPECIFIC: [PURPOSE_ID.RACE_SPECIFIC, PURPOSE_ID.DURABILITY, PURPOSE_ID.EASY_ECONOMY],
  TAPER: [PURPOSE_ID.TAPER, PURPOSE_ID.RECOVERY],
};

export function purposesFor(phaseId) {
  return PHASE_PURPOSES[phaseId] || PHASE_PURPOSES.BASE;
}
