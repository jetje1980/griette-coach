// De sessiebibliotheek — structuur, en verder niets.
//
// Dit bestand is een terugvaloptie, geen coach. Het levert vormen: hoeveel
// minuten lopen, hoeveel wandelen, hoe vaak, hoe lang in totaal. Wat een
// sessie op een gegeven dag werkelijk moet worden — welk tempo, welke
// hartslag, welke racestrategie — komt uit de engines die dat op je actuele
// data berekenen.
//
// Waarom dat onderscheid er zo hard in zit: hier stond een tweede coach.
// Naast elke sessie stond een vaste hartslagband, een vast tempobereik, en
// bij sommige sessies een harde instructie om bij een bepaalde hartslag over
// te gaan op wandelen. Allemaal met de hand ingetypt in augustus, en daarna
// nooit meer meebewogen met wat je werkelijk kunt. Verander je easy-band, dan
// bleef die tekst staan. Loop je sneller of langzamer dan destijds gedacht,
// dan bleef het tempo staan. En bij de racesessies sloeg die vaste
// wandelgrens het hele tolerantiemodel over.
//
// Twee waarheden naast elkaar is er één te veel. Wat hier is weggehaald:
//
//   hrZone   →  hrModel.js — CPET-context, recente verdragen runs, de
//               vertraagde respons, en de actuele intensity release
//   hrTip    →  hrModel.hrPrescription() per sessiedoel
//   tempo    →  easyPace.js (gemeten) en raceGoalModel (doeltempo)
//   afstand  →  sessionMath.js, uit minuten en werkelijke tempo's
//   race     →  raceGoalModel: afstand, doeltijd, datum, terrein
//
// Wat hier blijft, en met opzet: runMin, walkMin, reps, duration, en een
// omschrijving van het soort prikkel. Dat is de vorm, en die is bruikbaar
// ook als er nog niets over jou bekend is.

// Het soort prikkel dat een sessie geeft. Beschrijvend, niet voorschrijvend:
// het zegt waarvoor deze vorm bedoeld is, niet hoe hard je moet.
export const STIMULUS = {
  INTRO: 'intro',                 // kennismaken met de vorm
  CONTINUITY: 'continuity',       // langere loopblokken, zelfde inspanning
  VOLUME: 'volume',               // meer totale tijd op de benen
  RECOVERY_EFFICIENCY: 'recovery_efficiency', // kortere wandelpauze
  DURABILITY: 'durability',       // langste blokken, volhouden
  TAPER: 'taper',                 // volume omlaag, vorm behouden
  ACTIVATION: 'activation',       // benen voelen, niet belasten
  REST: 'rest',                   // actief rusten
  RACE: 'race',                   // wedstrijd
  COMEBACK: 'comeback',           // terug na een race
};

export const RUNS = [
  // ── Week 1 · Aug 18-22 · Eerste stappen — hartslag is de baas ─────────────
  {
    nr: 1, week: 1,
    runMin: 1, walkMin: 2, reps: 5, duration: 15,
    description: '1 min lopen / 2 min wandelen × 5',
    goal: 'Wennen aan de intervalvorm — niet op gevoel, maar op hartslag lopen',
  },
  {
    nr: 2, week: 1,
    runMin: 1, walkMin: 2, reps: 6, duration: 18,
    description: '1 min lopen / 2 min wandelen × 6',
    goal: 'Hartslag leren lezen — noteer je max HR per interval',
  },
  {
    nr: 3, week: 1,
    runMin: 1.5, walkMin: 2, reps: 6, duration: 21,
    description: '1,5 min lopen / 2 min wandelen × 6',
    goal: 'Probeer de hartslag tijdens lopen onder 128 te houden',
  },

  // ── Week 2 · Aug 25-29 · AMELAND! Strandlopen als bonus ──────────────────
  {
    nr: 4, week: 2,
    runMin: 1.5, walkMin: 2, reps: 5, duration: 17,
    description: '1,5 min lopen / 2 min wandelen × 5',
    goal: 'Ameland bonus: buitenlucht, zonlicht, zand — genieten én bewegen',
    vacation: true,
    vacationNote: '🏝️ Ameland — strandjog is prima vervanging, duinen optioneel',
  },
  {
    nr: 5, week: 2,
    runMin: 2, walkMin: 2, reps: 5, duration: 20,
    description: '2 min lopen / 2 min wandelen × 5',
    goal: '2 min aan een stuk in zone B — dit is de eerste echte mijlpaal',
    vacation: true,
    vacationNote: '🏝️ Ameland',
  },
  {
    nr: 6, week: 2,
    runMin: 2, walkMin: 2, reps: 6, duration: 24,
    description: '2 min lopen / 2 min wandelen × 6',
    goal: 'Volume opbouwen terwijl hartslag laag blijft',
  },

  // ── Week 3 · Sep 1-5 · Na vakantie — opnieuw opbouwen ────────────────────
  {
    nr: 7, week: 3,
    runMin: 2, walkMin: 1.5, reps: 6, duration: 21,
    description: '2 min lopen / 1,5 min wandelen × 6',
    goal: 'Herstelefficiëntie testen — daalt je HR snel genoeg in 1,5 min wandelen?',
  },
  {
    nr: 8, week: 3,
    runMin: 3, walkMin: 2, reps: 5, duration: 25,
    description: '3 min lopen / 2 min wandelen × 5',
    goal: '3 min zone B — mijlpaal. Na de training: hoe voel je je 2 uur later?',
  },
  {
    nr: 9, week: 3,
    runMin: 3, walkMin: 2, reps: 5, duration: 25,
    description: '3 min lopen / 2 min wandelen × 5',
    goal: 'Consistentie — dezelfde sessie voelt makkelijker dan vorige keer',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // VANAF HIER: CONTINUÏTEIT EERST
  //
  // Hierboven liep de opbouw met +1 min loopblok per week. Op dat tempo is
  // 40 min doorlopend — 5 km op 8:00/km — pas ergens in het voorjaar aan de
  // orde, en dat is te traag voor waar zij nu staat.
  //
  // Wat er is veranderd, en waarom het geen extra belasting is: de hefboom
  // is niet langer méér volume maar mínder wandelpauze, op een langzamer
  // tempo. De totale looptijd per sessie groeit van 24 naar 40 minuten; de
  // wandelpauzes verdwijnen. Doorlopend lopen op 8:00/km is metabool niet
  // veel meer dan stevig wandelen — het is een kwestie van tempodiscipline,
  // niet van conditie.
  //
  // De ladder gaat over het lángste doorlopende blok, want dat is wat
  // "achter elkaar" betekent:
  //
  //   8 → 10 → 12 → 15 → 18 → 25 → 30 → 32 → 35 → 40 min
  //
  // Elke stap staat of valt bij de herstelrespons erna. Blijft die schoon,
  // dan volgt de volgende stap; is hij dat niet, dan wordt de stap herhaald
  // en schuift de datum op. Dat is geen voorbehoud in de kleine lettertjes:
  // dit tempo is sneller dan de +10%-regel die elders in dit plan staat, en
  // die uitzondering is alleen te verdedigen zolang de respons meegeeft.
  // ═══════════════════════════════════════════════════════════════════════

  // ── Week 4 · Sep 8-12 · Van intervallen naar blokken ────────────────────
  {
    nr: 10, week: 4,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4',
    goal: 'Totaal 16 min lopen (verdeeld) — meer dan week 1 helemaal',
  },
  {
    nr: 11, week: 4,
    runMin: 6, walkMin: 1.5, reps: 4, duration: 30,
    blockMin: 6,
    description: '6 min lopen / 1,5 min wandelen × 4',
    goal: 'Langer blok, kortere pauze. Loop bewust langzamer dan je gewend bent — dit moet op gesprektempo kunnen.',
  },
  {
    nr: 12, week: 4,
    runMin: 8, walkMin: 2, reps: 3, duration: 30,
    blockMin: 8,
    description: '8 min lopen / 2 min wandelen × 3',
    goal: 'Eerste blok van 8 minuten. Vanaf hier is tempo de rem, niet de pauze.',
    milestone: true,
  },

  // ── Week 5 · Sep 15-19 · De blokken worden lang ─────────────────────────
  {
    nr: 13, week: 5,
    runMin: 10, walkMin: 1.5, reps: 3, duration: 33,
    blockMin: 10,
    description: '10 min lopen / 1,5 min wandelen × 3',
    goal: 'Tien minuten aan één stuk. Zakt je tempo daarvoor naar 8:30? Prima — dat is de bedoeling.',
    milestone: true,
  },
  {
    nr: 14, week: 5,
    runMin: 12, walkMin: 1.5, reps: 2, duration: 27,
    blockMin: 12,
    description: '12 min lopen / 1,5 min wandelen × 2',
    goal: 'Iets korter totaal, langer blok. Herstel telt zwaarder dan volume deze week.',
  },
  {
    nr: 15, week: 5,
    runMin: 15, walkMin: 2, reps: 2, duration: 32,
    blockMin: 15,
    description: '15 min lopen / 2 min wandelen × 2',
    goal: 'Een kwartier achter elkaar — halverwege de ladder. Eén wandelpauze in de hele sessie.',
    milestone: true,
  },

  // ── Week 6 · Sep 22-26 · Zo ver als eerlijk kan vóór de race ────────────
  //
  // Zij wilde hier de volle 5 km doorlopend staan, een week voor de race.
  // Dat haalt de rekening niet: van 8 minuten naar 40 in zeventien dagen is
  // een vertienvoudiging, en zelfs op +25% per week — al ruim boven wat bij
  // een PEM-geschiedenis te verdedigen is — kom je hier rond 30 minuten uit.
  // Wat hier wél staat is 25 minuten doorlopend, ongeveer 3 km. Dat is een
  // echte mijlpaal en het is er een die klopt.
  {
    nr: 16, week: 6,
    runMin: 18, walkMin: 2, reps: 2, duration: 38,
    blockMin: 18,
    description: '18 min lopen / 2 min wandelen × 2',
    goal: 'Langste blokken tot nu toe. Let op je tempo in de tweede helft — daar wordt het verleidelijk.',
  },
  {
    nr: 17, week: 6,
    runMin: 12, walkMin: 1, reps: 2, duration: 25,
    blockMin: 12,
    description: '12 min lopen / 1 min wandelen × 2 — lichter',
    goal: 'Bewust lichter tussen twee zware sessies. Dit is waar de winst wordt opgenomen.',
  },
  {
    nr: 18, week: 6,
    runMin: 25, walkMin: 0, reps: 1, duration: 25,
    blockMin: 25, continuous: true,
    description: '25 min doorlopend — geen wandelpauze',
    goal: '🎯 Je eerste echte doorlopende run: ongeveer 3 km zonder pauze. Start expres te langzaam; je mag de laatste vijf minuten versnellen als het meezit.',
    milestone: true,
  },

  // ── Week 7 · Sep 29 – Okt 3 · 🏁 Racedag ───────────────────────────────
  {
    nr: 19, week: 7,
    runMin: 15, walkMin: 0, reps: 1, duration: 15,
    blockMin: 15, continuous: true,
    description: '15 min doorlopend — losse benen',
    goal: 'Activering, niet training. Doorlopend maar kort: het ritme vasthouden dat je vorige week vond.',
  },
  {
    nr: 20, week: 7,
    runMin: 0, walkMin: 20, reps: 1, duration: 20,
    description: '20 min rustige wandeling — geen lopen',
    goal: 'Actief rusten — bloed laten circuleren, niet belasten',
    restDay: true,
  },
  {
    nr: 21, week: 7,
    runMin: 5, walkMin: 3, reps: null,
    // Drie verschillende getallen, en ze mogen nooit als één worden getoond.
    // `raceTargetFrom` verwijst naar het racedoel (5 km in 35:00); warmlopen
    // en uitlopen staan apart; `duration` is de tijd die de hele dag kost.
    raceTargetFrom: 'okt3',
    warmupMin: 10, cooldownMin: 10,
    duration: 55,
    fixedDate: '2026-10-03',
    raceGoalId: 'okt3',
    description: '🏁 Racedag · doorlopend proberen, run-walk als uitweg',
    goal: 'Checkpoint. Als week 6 op 25 min doorlopend uitkwam, loop deze dan doorlopend op je eigen tempo — met de afspraak dat je gáát wandelen zodra het knijpt, niet als je het al niet meer trekt. Afstand, doeltijd, tempo en hartslag komen uit je racedoel en je actuele data.',
    milestone: true,
    race: true,
  },

  // ── Week 8 · Okt 6-10 · Ladder weer op ──────────────────────────────────
  {
    nr: 22, week: 8,
    runMin: 12, walkMin: 0, reps: 1, duration: 12,
    blockMin: 12, continuous: true,
    description: '12 min doorlopend — zachte comeback',
    goal: 'Herstel activeren, niet presteren. Kort en doorlopend.',
  },
  {
    nr: 23, week: 8,
    runMin: 25, walkMin: 0, reps: 1, duration: 25,
    blockMin: 25, continuous: true,
    description: '25 min doorlopend',
    goal: 'Terug op de ladder waar je stond. Dit moet nu makkelijker voelen dan in week 6.',
  },
  {
    nr: 24, week: 8,
    runMin: 30, walkMin: 0, reps: 1, duration: 30,
    blockMin: 30, continuous: true,
    description: '30 min doorlopend',
    goal: 'Een half uur achter elkaar — ongeveer 3,7 km. Nog twee stappen naar de 5 km.',
    milestone: true,
  },

  // ── Week 9 · Okt 13-17 · Naar de 5 km ───────────────────────────────────
  {
    nr: 25, week: 9,
    runMin: 32, walkMin: 0, reps: 1, duration: 32,
    blockMin: 32, continuous: true,
    description: '32 min doorlopend',
    goal: 'Kleine stap, bewust. De sprong van 30 naar 40 gaat niet in één keer.',
  },
  {
    nr: 26, week: 9,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — korter, iets vlotter',
    goal: 'Kortere sessie waarin je mag voelen hoe 7:30 aanvoelt. Niet forceren; dit is een verkenning.',
  },
  {
    nr: 27, week: 9,
    runMin: 35, walkMin: 0, reps: 1, duration: 35,
    blockMin: 35, continuous: true,
    description: '35 min doorlopend',
    goal: 'Ongeveer 4,4 km zonder pauze. De 5 km is nu één stap weg.',
    milestone: true,
  },

  // ── Week 10 · Okt 20-24 · 🎯 De 5 km achter elkaar ──────────────────────
  {
    nr: 28, week: 10,
    runMin: 40, walkMin: 0, reps: 1, duration: 40,
    blockMin: 40, continuous: true,
    description: '🎯 5 km doorlopend — 40 min op 8:00/km',
    goal: 'Het doel. Vijf kilometer achter elkaar, geen wandelpauze. Start op 8:15 en houd dat vast; als je de laatste kilometer nog iets over hebt is het tempo goed geweest.',
    milestone: true,
  },
  {
    nr: 29, week: 10,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — rustige activering',
    goal: 'Opnemen wat je net hebt gedaan. Bereloop is over een week.',
  },
  {
    nr: 30, week: 10,
    runMin: 15, walkMin: 0, reps: 1, duration: 15,
    blockMin: 15, continuous: true,
    description: '15 min doorlopend — laatste activering',
    goal: 'Mentaal klaar. Je kunt de afstand nu, dat is het verschil met drie weken terug.',
  },

  // ── Week 11 · Okt 27-31 · 🏁 Racedag ────────────────────────────────────
  {
    nr: 31, week: 11,
    runMin: 3, walkMin: 3, reps: 3, duration: 18,
    description: '3 min lopen / 3 min wandelen × 3 — losse benen',
    goal: 'Lichaam activeren zonder te belasten',
  },
  {
    nr: 32, week: 11,
    runMin: 0, walkMin: 20, reps: 1, duration: 20,
    description: '20 min wandelen — dag voor de race',
    goal: 'Uitgerust en zeker aan de start verschijnen',
    restDay: true,
  },
  {
    nr: 33, week: 11,
    runMin: 7, walkMin: 3, reps: null,
    raceTargetFrom: 'okt31',
    warmupMin: 10, cooldownMin: 10,
    duration: 85,
    fixedDate: '2026-10-31',
    raceGoalId: 'okt31',
    description: '🏁 Racedag · doorlopend',
    goal: 'Wedstrijd, en de eerste die je doorlopend loopt. Afstand, doeltijd, tempo, hartslag en racestrategie komen uit je racedoel en je actuele data — niet uit deze bibliotheek.',
    milestone: true,
    race: true,
  },

  // ── Week 12 · Nov 3-7 · Vasthouden, niet opnieuw opbouwen ───────────────
  {
    nr: 34, week: 12,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — herstel Bereloop',
    goal: 'Herstellen én de doorlopende vorm vasthouden voor Ameland 5 km (13 dec)',
  },
  {
    nr: 35, week: 12,
    runMin: 40, walkMin: 0, reps: 1, duration: 40,
    blockMin: 40, continuous: true,
    description: '🎯 5 km doorlopend op raceafstand',
    goal: 'Bevestiging dat de 5 km geen eenmalige stunt was maar je nieuwe basis.',
    milestone: true,
  },
];

// ── De continuïteitsladder ──────────────────────────────────────
//
// Het lángste doorlopende blok, want dat is wat "5 km achter elkaar"
// werkelijk vraagt. Deze lijst staat hier zodat het scherm en de coach
// kunnen zien waar zij op de ladder staat en wat de volgende stap is —
// zonder dat iemand dat uit de sessieteksten hoeft te raden.
//
// De datums zijn een verwachting, geen belofte. Elke stap is voorwaardelijk
// op een schone herstelrespons; is die er niet, dan wordt de stap herhaald en
// schuift alles erachter een sessie op. Dat is de prijs van dit tempo, en het
// is een eerlijker prijs dan een datum die niet klopt.
export const CONTINUITY_LADDER = [
  { blockMin: 8,  runNr: 12, expected: '2026-09-11' },
  { blockMin: 10, runNr: 13, expected: '2026-09-15' },
  { blockMin: 12, runNr: 14, expected: '2026-09-17' },
  { blockMin: 15, runNr: 15, expected: '2026-09-19' },
  { blockMin: 18, runNr: 16, expected: '2026-09-22' },
  { blockMin: 25, runNr: 18, expected: '2026-09-26', note: 'Eerste doorlopende run, circa 3 km — de mijlpaal een week voor de race.' },
  { blockMin: 30, runNr: 24, expected: '2026-10-09' },
  { blockMin: 32, runNr: 25, expected: '2026-10-13' },
  { blockMin: 35, runNr: 27, expected: '2026-10-16' },
  { blockMin: 40, runNr: 28, expected: '2026-10-21', note: '5 km doorlopend op 8:00/km — het doel.' },
];

// Waar staat ze nu, en wat is de volgende stap? Gebaseerd op wat er
// werkelijk is afgewerkt, niet op de kalender.
export function ladderPosition(gedaneBlokken = []) {
  const hoogste = gedaneBlokken.length ? Math.max(...gedaneBlokken.map(Number).filter(n => !isNaN(n))) : 0;
  const bereikt = CONTINUITY_LADDER.filter(s => s.blockMin <= hoogste);
  const volgende = CONTINUITY_LADDER.find(s => s.blockMin > hoogste) || null;
  const doel = CONTINUITY_LADDER[CONTINUITY_LADDER.length - 1];
  return {
    longestBlockMin: hoogste || null,
    stepsDone: bereikt.length,
    stepsTotal: CONTINUITY_LADDER.length,
    next: volgende,
    goal: doel,
    atGoal: hoogste >= doel.blockMin,
    note: !hoogste
      ? 'Nog geen doorlopend blok van acht minuten of langer afgewerkt.'
      : hoogste >= doel.blockMin
        ? `Je loopt ${hoogste} min achter elkaar — de 5 km staat.`
        : `Langste doorlopende blok tot nu: ${hoogste} min. Volgende stap: ${volgende.blockMin} min.`,
  };
}

// ── Afstand is afgeleid, nooit opgeschreven ─────────────────────
// Uit de structuur van de sessie en het tempo dat er werkelijk bij hoort.
// Zonder tempo is er geen afstand — en dat is eerlijker dan een getal
// verzinnen. Wie het actuele looptempo meegeeft, krijgt een afstand die
// bij háár data past in plaats van bij een schemagemiddelde.
import { sessionMath, sessionRange, fmtSec } from '../sessionMath';

// De bibliotheek kent geen tempo's meer, en dus ook geen afstanden.
//
// Deze functie stond hier om het tempobereik uit de sessietekst te parsen.
// Die tekst is weg, en daarmee de enige reden dat dit bestond. Hij
// blijft als lege huls staan omdat vier schermen hem aanroepen, en het is
// eerlijker dat ze niets krijgen dan een getal uit augustus.
//
// Wie een afstand wil: geef `paces` mee aan runDistance. easyPace.measuredPaces()
// levert die uit je eigen verdragen sessies.
export function schemaPaces() { return null; }

// Eén sessie doorrekenen. `paces` overschrijft het schema, zodat de coach
// met jouw actuele tempo kan rekenen in plaats van met het plangemiddelde.
export function runDistance(run, paces = null) {
  if (!run) return null;
  const p = paces || schemaPaces(run);
  if (!p) return null;
  const range = sessionRange({
    runMin: run.runMin, walkMin: run.walkMin, reps: run.reps, duration: run.duration,
    runPaceFast: p.runFast, runPaceSlow: p.runSlow,
    walkPaceFast: p.walkFast, walkPaceSlow: p.walkSlow,
  });
  if (!range) return null;
  return {
    ...range,
    label: range.low.toFixed(1) === range.high.toFixed(1)
      ? `${range.low.toFixed(1)} km`
      : `${range.low.toFixed(1)}–${range.high.toFixed(1)} km`,
  };
}

// Voor plekken die één getal willen.
export function runDistanceKm(run, paces = null) {
  const d = runDistance(run, paces);
  return d ? d.mid : null;
}

// ── Racedag: doeltijd, opwarmen en sessieduur apart ─────────────
// Het schema had één `duration`-veld dat soms de racetijd en soms de hele
// dag betekende. Wie die twee als hetzelfde getal toont, belooft een
// finishtijd die eigenlijk inclusief warmlopen was — of andersom.
export function raceDayBreakdown(run, goal = null) {
  if (!run?.race) return null;
  const targetSec = goal?.targetTimeSec ?? null;
  const warmup = Number(run.warmupMin) || 0;
  const cooldown = Number(run.cooldownMin) || 0;
  const raceMin = targetSec != null ? targetSec / 60 : null;
  return {
    raceTargetMin: raceMin,
    raceTargetLabel: targetSec != null ? fmtSec(targetSec) : null,
    warmupMin: warmup,
    cooldownMin: cooldown,
    totalSessionMin: raceMin != null ? Math.round(raceMin + warmup + cooldown)
      : (Number(run.duration) || null),
    note: raceMin != null
      ? `Doeltijd ${fmtSec(targetSec)} op de klok. Daar komt ${warmup} min inlopen en ` +
        `${cooldown} min uitlopen bij, dus reken op ${Math.round(raceMin + warmup + cooldown)} min ` +
        'van start tot thuis.'
      : null,
  };
}
