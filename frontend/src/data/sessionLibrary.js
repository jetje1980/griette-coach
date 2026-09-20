// De sessiebibliotheek: vormen, geen kalender.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// runningSchema.js hield 35 sessies vast, genummerd van week 1 tot week 12
// en vastgeprikt aan data in het najaar van 2026. Dat is 23% van een jaar.
// Kom je voorbij die twaalf weken, dan is er geen sessie meer — en de
// nummering zelf suggereert een volgorde die met jouw werkelijke opbouw
// niets te maken heeft: sessie 14 komt na 13, ook als 13 slecht viel.
//
// Bovendien liep die nummering vast aan de kalender. Een herhaalde week
// schoof het schema op, maar de weeknummers niet.
//
// ─────────────────────────────────────────────────────────────────
// WAT HET NU IS
//
// Een bibliotheek van vórmen. Elke vorm heeft:
//
//   purpose    waarvoor hij dient — herstel, easy economy, durability,
//              quality-lite, racespecifiek, taper
//   level      hoe zwaar, op één schaal van 1 tot 20 die van "één minuut
//              lopen" tot "een uur doorlopend met tempoblokken" loopt
//   blockMin   het langste doorlopende loopblok erin — de maat die telt
//   minutes    hoe lang de sessie duurt
//
// Geen weeknummers, geen datums. Welke vorm vandaag aan de beurt is volgt
// uit wat je aantoonbaar verdraagt en waar je doel om vraagt; dat staat in
// strategy.js. Deze lijst zegt alleen wélke vormen bestaan.
//
// Het niveau is de sorteerbare as. Wie op niveau 7 zit kan alles tot en met
// 7, en de volgende stap is 8 — ongeacht welke maand het is.
// ─────────────────────────────────────────────────────────────────

export const PURPOSE_ID = {
  RECOVERY: 'RECOVERY',
  EASY_ECONOMY: 'EASY_ECONOMY',
  DURABILITY: 'DURABILITY',
  QUALITY_LITE: 'QUALITY_LITE',
  RACE_SPECIFIC: 'RACE_SPECIFIC',
  TAPER: 'TAPER',
  TEST: 'TEST',
};

// Vorm bouwen zonder elke keer dezelfde velden te typen.
const rw = (level, runMin, walkMin, reps, purpose, note) => ({
  level, runMin, walkMin, reps,
  blockMin: runMin,
  minutes: Math.round(runMin * reps + walkMin * Math.max(0, reps - 1)),
  continuous: false, purpose, note,
});

const cont = (level, min, purpose, note, extra = {}) => ({
  level, runMin: min, walkMin: 0, reps: 1,
  blockMin: min, minutes: min, continuous: true, purpose, note, ...extra,
});

export const SESSIONS = [
  // ── Niveau 1–4 · kennismaken met de vorm ──────────────────────
  rw(1, 1, 2, 5, PURPOSE_ID.EASY_ECONOMY,
    'Wennen aan de intervalvorm. Hartslag is de baas, niet het gevoel.'),
  rw(1, 1, 2, 6, PURPOSE_ID.EASY_ECONOMY,
    'Zelfde vorm, één blok langer. Noteer je hoogste hartslag per interval.'),
  rw(2, 2, 2, 5, PURPOSE_ID.EASY_ECONOMY,
    'Twee minuten aan één stuk. Let op of je tempo binnen het blok wegzakt.'),
  rw(2, 2, 1.5, 6, PURPOSE_ID.EASY_ECONOMY,
    'Kortere pauze bij hetzelfde loopblok — de eerste efficiëntiestap.'),
  rw(3, 3, 2, 5, PURPOSE_ID.EASY_ECONOMY,
    'Drie minuten. Hoe voel je je twee uur later? Dat is de meting die telt.'),
  rw(3, 3, 1.5, 5, PURPOSE_ID.DURABILITY,
    'Zelfde blok, minder rust. Meer tijd op de benen zonder meer tempo.'),
  rw(4, 4, 2, 4, PURPOSE_ID.EASY_ECONOMY,
    'Vier minuten per blok. Tempo mag hiervoor zakken.'),
  rw(4, 4, 1.5, 5, PURPOSE_ID.DURABILITY,
    'Vijf blokken van vier. Twintig minuten lopen, verdeeld.'),

  // ── Niveau 5–8 · de blokken worden lang ───────────────────────
  rw(5, 6, 1.5, 4, PURPOSE_ID.EASY_ECONOMY,
    'Zes minuten aan één stuk, op gesprektempo.'),
  rw(5, 5, 1, 5, PURPOSE_ID.DURABILITY,
    'Korte pauzes, veel loopminuten. Hartslag stabiel houden is de opgave.'),
  rw(6, 8, 2, 3, PURPOSE_ID.EASY_ECONOMY,
    'Acht minuten. Vanaf hier is tempo de rem, niet de pauze.'),
  rw(6, 8, 1, 3, PURPOSE_ID.DURABILITY,
    'Acht minuten met minimale rust — bijna doorlopend.'),
  rw(7, 10, 1.5, 3, PURPOSE_ID.EASY_ECONOMY,
    'Tien minuten aan één stuk. Zakt je tempo naar 8:30? Prima.'),
  rw(7, 12, 2, 2, PURPOSE_ID.DURABILITY,
    'Twee blokken van twaalf. Eén pauze in de hele sessie.'),
  rw(8, 16, 2, 2, PURPOSE_ID.DURABILITY,
    'Zestien minuten, één pauze. De laatste stap vóór doorlopend.'),
  cont(8, 12, PURPOSE_ID.EASY_ECONOMY,
    'Twaalf minuten doorlopend — korter dan je gewend bent, maar zonder pauze.'),

  // ── Niveau 9–12 · doorlopend ──────────────────────────────────
  cont(9, 15, PURPOSE_ID.EASY_ECONOMY,
    'Een kwartier doorlopend. Start expres te langzaam.'),
  cont(9, 20, PURPOSE_ID.DURABILITY,
    'Twintig minuten doorlopend. Ongeveer 2,5 km op rustig tempo.'),
  cont(10, 25, PURPOSE_ID.DURABILITY,
    'Vijfentwintig minuten. Vanaf hier is het meer dan je totale looptijd vroeger was.'),
  cont(10, 20, PURPOSE_ID.EASY_ECONOMY,
    'Twintig minuten waarin je let op je cadans in plaats van je tempo.'),
  cont(11, 30, PURPOSE_ID.DURABILITY,
    'Een half uur aan één stuk.'),
  cont(11, 25, PURPOSE_ID.QUALITY_LITE,
    'Twintig minuten rustig, dan vijf minuten iets vlotter. Niet hijgen.',
    { surgeMin: 5 }),
  cont(12, 35, PURPOSE_ID.DURABILITY,
    'Vijfendertig minuten doorlopend.'),
  cont(12, 30, PURPOSE_ID.QUALITY_LITE,
    'Drie keer twee minuten vlotter binnen een rustige dertig.',
    { surges: 3, surgeMin: 2 }),

  // ── Niveau 13–16 · afstand en tempo naast elkaar ──────────────
  cont(13, 40, PURPOSE_ID.DURABILITY,
    'Veertig minuten — op rustig tempo ongeveer vijf kilometer.'),
  cont(13, 30, PURPOSE_ID.RACE_SPECIFIC,
    'Twintig rustig, tien op je beoogde racetempo. Stop als het tempo je hartslag optilt.',
    { specificMin: 10 }),
  cont(14, 45, PURPOSE_ID.DURABILITY,
    'Drie kwartier. Dit is de sessie die duur bouwt zonder tempo te vragen.'),
  cont(14, 35, PURPOSE_ID.RACE_SPECIFIC,
    'Vijftien op racetempo, verdeeld over drie blokken binnen een rustige basis.',
    { specificMin: 15, blocks: 3 }),
  cont(15, 50, PURPOSE_ID.DURABILITY,
    'Vijftig minuten. Neem drinken mee.'),
  cont(15, 40, PURPOSE_ID.RACE_SPECIFIC,
    'Twintig minuten aaneengesloten op racetempo binnen een langere run.',
    { specificMin: 20 }),
  cont(16, 60, PURPOSE_ID.DURABILITY,
    'Een uur op de benen. De langste sessie in de bibliotheek.'),
  cont(16, 45, PURPOSE_ID.QUALITY_LITE,
    'Zes keer twee minuten vlotter met twee minuten rustig ertussen.',
    { surges: 6, surgeMin: 2 }),

  // ── Niveau 17–20 · scherp worden ──────────────────────────────
  cont(17, 40, PURPOSE_ID.RACE_SPECIFIC,
    'Twee keer twaalf minuten op racetempo, vijf minuten rustig ertussen.',
    { specificMin: 24, blocks: 2 }),
  cont(17, 50, PURPOSE_ID.DURABILITY,
    'Vijftig minuten met de laatste tien iets vlotter dan de rest.',
    { surgeMin: 10 }),
  cont(18, 45, PURPOSE_ID.RACE_SPECIFIC,
    'Dertig minuten aaneengesloten op racetempo. Dit is de generale.',
    { specificMin: 30 }),
  cont(18, 55, PURPOSE_ID.DURABILITY,
    'Langste rustige run van het blok.'),
  cont(19, 35, PURPOSE_ID.QUALITY_LITE,
    'Acht keer één minuut scherp, ruime rust ertussen. Kort en netjes.',
    { surges: 8, surgeMin: 1 }),
  cont(20, 30, PURPOSE_ID.TEST,
    'Tijdtest op je doelafstand onder goede omstandigheden.',
    { test: true }),

  // ── Taper en herstel · op elk niveau bruikbaar ────────────────
  cont(0, 15, PURPOSE_ID.RECOVERY,
    'Kort en doorlopend, puur om te bewegen. Geen prikkel.'),
  cont(0, 20, PURPOSE_ID.RECOVERY,
    'Twintig minuten waarin niets moet.'),
  rw(0, 3, 3, 3, PURPOSE_ID.RECOVERY,
    'Losse benen: kort lopen, ruim wandelen.'),
  cont(0, 20, PURPOSE_ID.TAPER,
    'Twintig minuten rustig met twee korte versnellingen om scherp te blijven.',
    { surges: 2, surgeMin: 1 }),
  cont(0, 15, PURPOSE_ID.TAPER,
    'Activering: kort, vlot aanvoelend, ruim binnen je grens.'),
  cont(0, 25, PURPOSE_ID.TAPER,
    'Laatste rustige run met het racetempo heel even aangetikt.',
    { surges: 1, surgeMin: 2 }),
];

// Elke vorm krijgt een stabiele id uit zijn eigen inhoud, zodat historie
// eraan kan hangen zonder dat een verschoven regel de id verandert.
for (const s of SESSIONS) {
  s.id = s.continuous
    ? `c${s.level}_${s.runMin}${s.purpose[0]}${s.surges || s.specificMin || ''}`
    : `r${s.level}_${s.runMin}x${s.reps}${s.purpose[0]}`;
  s.label = s.continuous
    ? `${s.runMin} min doorlopend`
    : `${s.runMin} min lopen / ${String(s.walkMin).replace('.', ',')} min wandelen × ${s.reps}`;
}

export const MAX_LEVEL = Math.max(...SESSIONS.map(s => s.level));

export const findSession = (id) => SESSIONS.find(s => s.id === id) || null;

// Alles wat op of onder een niveau ligt — dat is wat je nu aankunt.
export function sessionsUpTo(level, { purpose = null } = {}) {
  return SESSIONS.filter(s => s.level <= level && (!purpose || s.purpose === purpose));
}

// De vormen op precies één niveau, eventueel voor één doel.
export function sessionsAtLevel(level, { purpose = null } = {}) {
  return SESSIONS.filter(s => s.level === level && (!purpose || s.purpose === purpose));
}

// Welk niveau hoort bij een bewezen loopblok? Het hoogste niveau waarvan
// het langste blok binnen bereik ligt. Herstel- en tapervormen staan op
// niveau 0 en tellen hier niet mee: die zijn er altijd.
export function levelForBlock(blockMin) {
  if (!blockMin || blockMin <= 0) return 1;
  const halen = SESSIONS.filter(s => s.level > 0 && s.blockMin <= blockMin);
  return halen.length ? Math.max(...halen.map(s => s.level)) : 1;
}

// Hoeveel sessies zitten er per niveau? Gebruikt door de audit en door het
// scherm, zodat zichtbaar is dat er werkelijk een jaar aan materiaal ligt.
export function libraryShape() {
  const perLevel = {};
  const perPurpose = {};
  for (const s of SESSIONS) {
    perLevel[s.level] = (perLevel[s.level] || 0) + 1;
    perPurpose[s.purpose] = (perPurpose[s.purpose] || 0) + 1;
  }
  return {
    total: SESSIONS.length,
    levels: MAX_LEVEL,
    perLevel, perPurpose,
    longestBlockMin: Math.max(...SESSIONS.map(s => s.blockMin)),
    continuous: SESSIONS.filter(s => s.continuous).length,
    runWalk: SESSIONS.filter(s => !s.continuous).length,
  };
}
