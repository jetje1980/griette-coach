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

// ── Hoe lang taperen, en waarvoor eigenlijk? ────────────────────
//
// WAT ER MIS WAS
//
// Tien dagen taper voor élk doel dat als eerste op de kalender stond. Op
// 21 oktober betekende dat: niet meer opbouwen, want op 31 oktober staat de
// Bereloop. Maar die Bereloop is een STRETCH-doel, en de app zegt daar zelf
// over: "Alleen bij een gunstig verloop. Als het niet lukt, schuift het
// doel — niet de opbouw."
//
// Tien dagen opbouw opgeven voor een doel dat per definitie mag schuiven is
// het omgekeerde van wat dat doel betekent. Zij wilde doorbouwen en had
// gelijk; de app sprak zichzelf tegen.
//
// Daarom hangt de taperlengte nu aan het soort doel. Een checkpoint is een
// peiling waarvoor je niks inlevert, een stretchdoel kost een paar frisse
// dagen, en alleen een echt doel verdient een volle taperweek.
export const TAPER_DAYS_BY_TYPE = {
  TARGET: 7,
  STRETCH: 3,
  CHECKPOINT: 2,
  LONG_TERM: 0,
};

// De terugval als het soort doel onbekend is: behandel het als een doel.
export const TAPER_DAYS = 7;

// ── Haar eigen keuze: doorbouwen tot en met ─────────────────────
//
// Zij kent haar lichaam en haar kalender. Zegt zij "ik wil tot en met
// zondag afstand opbouwen", dan is dat geen voorkeur die de app mag
// wegrekenen. De app blijft wel zeggen wat hij zou adviseren — overrulen is
// iets anders dan verzwijgen.
const BUILD_THROUGH_KEY = 'gc_build_through';

export function loadBuildThrough() {
  try {
    const v = localStorage.getItem(BUILD_THROUGH_KEY);
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch { return null; }
}

export function saveBuildThrough(date) {
  try {
    if (!date) localStorage.removeItem(BUILD_THROUGH_KEY);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) localStorage.setItem(BUILD_THROUGH_KEY, date);
  } catch { /* opslag vol of geblokkeerd */ }
  return loadBuildThrough();
}

export function taperDaysFor(goal) {
  const t = goal?.type ? TAPER_DAYS_BY_TYPE[goal.type] : null;
  return t == null ? TAPER_DAYS : t;
}

export const SPECIFIC_WEEKS = 6;

// ── Welke as is nu de beperkende ────────────────────────────────
//
// WAAROM DIT ER IS
//
// Zij vroeg: waarom 5×5 met 1 minuut wandelen, en niet 3×8 met 2 of 3
// minuten? Dat is de juiste vraag, en het antwoord van de app was fout.
//
// Een run/wandel-sessie kan op drie manieren zwaarder:
//
//   BLOK      langere stukken aan één stuk lopen
//   DICHTHEID kortere wandelpauzes tussen dezelfde blokken
//   TEMPO     sneller lopen bij dezelfde hartslag
//
// Voor "5 km achter elkaar kunnen lopen" is de bloklengte de beperkende as.
// Vijf keer vijf minuten met één minuut pauze levert 25 loopminuten op,
// maar je bent nooit langer dan vijf minuten doorlopend bezig. Drie keer
// acht met ruime pauze levert minder loopminuten en toch meer van wat het
// doel vraagt.
//
// De bibliotheek koppelde langere blokken aan EASY_ECONOMY en kortere
// pauzes aan DURABILITY, en de fasevoorkeur zette DURABILITY vooraan. Dus
// werd de dichtheid opgevoerd terwijl de blokken moesten groeien. Precies
// wat zij zag.
//
// En één as per keer. Blokken langer máken terwijl de pauze korter wordt is
// twee prikkels tegelijk; valt het dan slecht, dan weet je niet welke het
// was — en bij haar is dat niet academisch, want een misrekening kost dagen.
export const AXIS = {
  BLOCK: {
    id: 'BLOCK', label: 'langere blokken',
    aim: 'Langer aan één stuk kunnen lopen. De wandelpauze blijft ruim: die is hier het hulpmiddel, niet het doel.',
  },
  DENSITY: {
    id: 'DENSITY', label: 'kortere pauzes',
    aim: 'Dezelfde blokken met minder herstel ertussen. Pas zinvol als de blokken lang genoeg zijn.',
  },
  PACE: {
    id: 'PACE', label: 'tempo',
    aim: 'Wennen aan het tempo dat je doel vraagt, nu de duur er al is.',
  },
  // In een taper en tijdens herstel groeit er niets, en dan hoort er ook
  // geen as te staan. Ik had hier eerst PACE neergezet voor de taper; dan
  // stond er "wennen aan het tempo dat je doel vraagt, nu de duur er al is"
  // terwijl haar langste blok 6% van die duur dekte. Een onjuiste uitleg is
  // erger dan geen uitleg.
  NONE: {
    id: 'NONE', label: 'niets — vers worden',
    aim: 'Er gaat deze dagen niets omhoog. Wat je nu nog wint is herstel, niet vorm.',
  },
  RECOVER: {
    id: 'RECOVER', label: 'niets — eerst verwerken',
    aim: 'De prikkel die er al was moet eerst landen. Opbouwen komt daarna.',
  },
};

// Hoe ruim moet de pauze blijven zolang de blokken groeien? Korter dan dit
// is de tweede as, en die komt later.
export const GENEROUS_PAUSE_MIN = 1.5;

// Met welk tempo rekenen we de doelafstand om naar minuten, als er nog geen
// gemeten tempo is? Rustig, want daar bouwt ze op.
export const ASSUMED_EASY_PACE_MIN = 8.0;

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
  // Tot en met deze datum wil zij blijven opbouwen, wat de kalender ook
  // zegt. Leeg of in het verleden betekent: geen override.
  buildThrough = null,
  currentDate = todayLocal(),
} = {}) {
  const blockMin = capability?.provenBlockMin ?? 0;
  const level = levelForBlock(blockMin);
  const verdragen = capability?.longestToleratedKm ?? 0;
  const dekking = goal?.distanceKm ? Math.min(1, verdragen / goal.distanceKm) : null;
  const dagen = goal?.date ? daysBetween(currentDate, goal.date) : null;
  const weken = dagen != null ? dagen / 7 : null;

  // Hoeveel minuten doorlopend vraagt het doel, en hoeveel daarvan haal je
  // al in één blok? Zolang dat ver uit elkaar ligt is de bloklengte de as.
  const tempo = capability?.easyPaceMin || ASSUMED_EASY_PACE_MIN;
  const doelMinuten = goal?.distanceKm ? goal.distanceKm * tempo : null;
  const blokDekking = doelMinuten ? Math.min(1, blockMin / doelMinuten) : null;
  const as = (blokDekking == null || blokDekking < SPECIFIC_MIN_COVERAGE)
    ? AXIS.BLOCK : AXIS.PACE;
  // De dekking gaat over doorlopend kunnen lopen. Loopt zij nog met
  // wandelpauzes, dan is de bloklengte de as — ook als het totaal aantal
  // loopminuten al in de buurt van de doelduur komt.


  const redenen = [];

  // 1. Herstel gaat voor alles.
  const groen = recovery ? recovery.green !== false : true;
  if (!groen) {
    redenen.push('je herstelrespons is op dit moment niet schoon');
    return maak(PHASE.RECOVER, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      as: AXIS.RECOVER, blokDekking, doelMinuten, buildThrough, lever: 'geen', volgende: null });
  }

  // 2. Taper: alleen als er werkelijk een race aankomt waarvoor je iets
  //    inlevert, en alleen zolang zij niet zelf zegt dat ze doorbouwt.
  const taperDagen = taperDaysFor(goal);
  const bouwtDoor = buildThrough && buildThrough >= currentDate;
  if (dagen != null && dagen >= 0 && taperDagen > 0 && dagen <= taperDagen && !bouwtDoor) {
    redenen.push(`${goal.name} is over ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`);
    redenen.push(`dat is een ${(goal.type || 'doel').toLowerCase()}-doel, dus ${taperDagen} dagen taper`);
    return maak(PHASE.TAPER, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      as: AXIS.NONE, blokDekking, doelMinuten, buildThrough, taperDagen, lever: 'geen', volgende: null });
  }
  // Zij overrulet de taper. Dat is haar keuze en die wordt genoemd, niet
  // stilzwijgend ingewilligd — een coach die zwijgt over een afwijking van
  // zijn eigen advies is geen coach.
  if (bouwtDoor && dagen != null && dagen >= 0 && dagen <= taperDagen) {
    redenen.push(`je wilt doorbouwen tot en met ${buildThrough}, dus nog geen taper voor ${goal.name}`);
  }

  // 3. Racespecifiek: dichtbij genoeg én je dekt de afstand al grotendeels.
  //    Dat tweede is de voorwaarde die ontbrak. Tempo trainen terwijl je de
  //    helft van de afstand verdraagt, levert een snelle helft op.
  if (weken != null && weken <= SPECIFIC_WEEKS) {
    if (dekking != null && dekking >= SPECIFIC_MIN_COVERAGE) {
      redenen.push(`nog ${Math.round(weken)} weken tot ${goal.name}`);
      redenen.push(`je verdraagt ${Math.round(dekking * 100)}% van de afstand`);
      return maak(PHASE.SPECIFIC, { level, blockMin, dekking, weken, goal, redenen, currentDate,
        as, blokDekking, doelMinuten, buildThrough, taperDagen,
        lever: 'tempo', volgende: volgendeStap(level, PHASE.SPECIFIC) });
    }
    redenen.push(`${goal.name} is dichtbij, maar je verdraagt pas ${Math.round((dekking || 0) * 100)}% van de afstand`);
    redenen.push('afstand gaat vóór tempo — anders traint je snelle helft');
    return maak(PHASE.BASE, { level, blockMin, dekking, weken, goal, redenen, currentDate,
      as, blokDekking, doelMinuten, buildThrough, taperDagen,
      lever: 'duur', volgende: volgendeStap(level, PHASE.BASE) });
  }

  // 4. Basis. De standaardtoestand, en dat is geen tussenfase.
  if (goal) redenen.push(`nog ${Math.round(weken)} weken tot ${goal.name} — tijd genoeg voor breedte`);
  else redenen.push('geen race op de kalender, dus breedte bouwen');
  return maak(PHASE.BASE, { level, blockMin, dekking, weken, goal, redenen, currentDate,
    as, blokDekking, doelMinuten, buildThrough, taperDagen,
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
    // De beperkende as, en waarom. Dit stuurt de vormkeuze in
    // sessionChoice.js en staat op het scherm, zodat een advies niet alleen
    // zegt wát je doet maar ook welke knop er deze weken aan staat.
    axis: (x.as || AXIS.BLOCK).id,
    axisLabel: (x.as || AXIS.BLOCK).label,
    axisAim: (x.as || AXIS.BLOCK).aim,
    goalMinutes: x.doelMinuten != null ? Math.round(x.doelMinuten) : null,
    buildThrough: x.buildThrough || null,
    taperDays: x.taperDagen ?? null,
    blockCoverage: x.blokDekking != null ? +(x.blokDekking * 100).toFixed(0) : null,
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
