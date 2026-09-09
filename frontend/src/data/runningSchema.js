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
  //
  // De rungs zijn groter geworden dan in de eerste opzet, en dat kan omdat
  // het grootste deel ervan geen nieuwe belasting is. Zij loopt nu al 16 tot
  // 24 minuten per sessie, alleen in stukjes geknipt. Die stukjes aan elkaar
  // plakken tot één blok van twintig minuten is dezelfde belasting, anders
  // gerangschikt. Pas boven de vierentwintig minuten begint werkelijk nieuw
  // volume — en dat zijn precies de laatste twee rungs.
  {
    nr: 10, week: 4,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4',
    goal: 'Totaal 16 min lopen (verdeeld) — meer dan week 1 helemaal',
  },
  {
    nr: 11, week: 4,
    runMin: 8, walkMin: 1.5, reps: 3, duration: 27,
    blockMin: 8,
    description: '8 min lopen / 1,5 min wandelen × 3',
    goal: 'Eerste blok van acht minuten. Loop bewust langzamer dan je gewend bent — dit moet op gesprektempo kunnen.',
  },
  {
    nr: 12, week: 4,
    runMin: 12, walkMin: 2, reps: 2, duration: 26,
    blockMin: 12,
    description: '12 min lopen / 2 min wandelen × 2',
    goal: 'Twaalf minuten aan één stuk — minder dan wat je nu al per sessie loopt, alleen niet meer geknipt.',
    milestone: true,
  },

  // ── Week 5 · Sep 15-19 · Van blokken naar doorlopend ────────────────────
  {
    nr: 13, week: 5,
    runMin: 16, walkMin: 2, reps: 2, duration: 34,
    blockMin: 16,
    description: '16 min lopen / 2 min wandelen × 2',
    goal: 'Zestien minuten, één pauze. Zakt je tempo daarvoor naar 8:30? Prima — dat is de bedoeling.',
  },
  {
    nr: 14, week: 5,
    runMin: 12, walkMin: 0, reps: 1, duration: 12,
    blockMin: 12, continuous: true,
    description: '12 min doorlopend — kort en licht',
    goal: 'Bewust lichter tussen twee stappen. Dit is waar de winst wordt opgenomen, niet waar hij wordt gemaakt.',
  },
  {
    nr: 15, week: 5,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — geen wandelpauze',
    goal: '🎯 Je eerste doorlopende run: ongeveer 2,5 km zonder pauze. Start expres te langzaam.',
    milestone: true,
  },

  // ── Week 6 · Sep 22-26 · Naar 3,8 km ────────────────────────────────────
  //
  // Zij vroeg hier eerst 5 km, daarna minimaal 3,8 met 4 of 4,5 als voorkeur.
  // 3,8 km is 30 minuten op 8:00/km, en dat past: de ladder loopt dan
  // 8 → 12 → 16 → 20 → 25 → 30, met stappen van +50, +33, +25, +25 en +20
  // procent. Afnemende stappen, wat de goede vorm is.
  //
  // 4,5 km zou 36 minuten zijn: een laatste stap van +44% in dezelfde week,
  // zonder opnameweek ertussen. Dat is de stap die van een opbouw een gok
  // maakt, en die staat hier dus niet. Hij staat op 9 oktober.
  //
  // Wat deze week kost: er zit geen rustige week meer tussen vandaag en 26
  // september. Elke sessie is een stap. Gaat één respons mis, dan schuift het
  // geheel en is de vloer 3,1 km in plaats van 3,8.
  {
    nr: 16, week: 6,
    runMin: 25, walkMin: 0, reps: 1, duration: 25,
    blockMin: 25, continuous: true,
    description: '25 min doorlopend',
    goal: 'Ongeveer 3,1 km. Vanaf hier is het nieuw terrein: langer dan je totale looptijd per sessie tot nu toe.',
    milestone: true,
  },
  {
    nr: 17, week: 6,
    runMin: 15, walkMin: 0, reps: 1, duration: 15,
    blockMin: 15, continuous: true,
    description: '15 min doorlopend — lichter',
    goal: 'De enige adem in deze week. Loop hem echt rustig; de zaterdag hangt hiervan af.',
  },
  {
    nr: 18, week: 6,
    runMin: 31, walkMin: 0, reps: 1, duration: 31,
    blockMin: 31, continuous: true,
    stretchMin: 32,
    description: '🎯 3,8 km doorlopend — 31 min op 8:00/km',
    goal: 'De vloer die je vroeg, een week voor de race. Voelt het op 28 minuten nog goed, loop dan door naar 32 min (4,0 km). Voelt het dat niet, stop op 3,8 — dat was het doel en dat is gehaald.',
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

  // ── Week 8 · Okt 6-10 · 4,0 en 4,5 km ───────────────────────────────────
  //
  // Omdat 26 september nu op 3,8 km eindigt in plaats van 3,1, schuift alles
  // hierachter een week naar voren. De 4,5 km die zij het liefst al in
  // september wilde, staat hier — met een opnameweek en een race ertussen in
  // plaats van in dezelfde week als de 25 minuten.
  {
    nr: 22, week: 8,
    runMin: 15, walkMin: 0, reps: 1, duration: 15,
    blockMin: 15, continuous: true,
    description: '15 min doorlopend — zachte comeback',
    goal: 'Herstel activeren na de race, niet presteren.',
  },
  {
    nr: 23, week: 8,
    runMin: 32, walkMin: 0, reps: 1, duration: 32,
    blockMin: 32, continuous: true,
    description: '4,0 km doorlopend — 32 min',
    goal: 'Terug op de ladder, één rung hoger dan voor de race.',
  },
  {
    nr: 24, week: 8,
    runMin: 36, walkMin: 0, reps: 1, duration: 36,
    blockMin: 36, continuous: true,
    description: '🎯 4,5 km doorlopend — 36 min',
    goal: 'De afstand die je het liefst al in september had gelopen. Nog één rung naar de 5 km.',
    milestone: true,
  },

  // ── Week 9 · Okt 13-17 · 🎯 De 5 km achter elkaar ───────────────────────
  {
    nr: 25, week: 9,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — kort, opnemen',
    goal: 'Licht tussen 4,5 en 5 km. Niet de plek om iets te bewijzen.',
  },
  {
    nr: 26, week: 9,
    runMin: 30, walkMin: 0, reps: 1, duration: 30,
    blockMin: 30, continuous: true,
    description: '30 min doorlopend — middellang',
    goal: 'Ritme vasthouden. Deze moet nu duidelijk makkelijker voelen dan op 26 september.',
  },
  {
    nr: 27, week: 9,
    runMin: 40, walkMin: 0, reps: 1, duration: 40,
    blockMin: 40, continuous: true,
    description: '🎯 5 km doorlopend — 40 min op 8:00/km',
    goal: 'Het doel. Vijf kilometer achter elkaar, geen wandelpauze. Start op 8:15 en houd dat vast; heb je de laatste kilometer nog iets over, dan was het tempo goed.',
    milestone: true,
  },

  // ── Week 10 · Okt 20-24 · Vasthouden en taperen voor Bereloop ───────────
  {
    nr: 28, week: 10,
    runMin: 40, walkMin: 0, reps: 1, duration: 40,
    blockMin: 40, continuous: true,
    description: '5 km doorlopend — bevestiging',
    goal: 'Twee keer 5 km achter elkaar in één week maakt er een basis van in plaats van een stunt.',
  },
  {
    nr: 29, week: 10,
    runMin: 20, walkMin: 0, reps: 1, duration: 20,
    blockMin: 20, continuous: true,
    description: '20 min doorlopend — rustige activering',
    goal: 'Opnemen. Bereloop is over een week.',
  },
  {
    nr: 30, week: 10,
    runMin: 15, walkMin: 0, reps: 1, duration: 15,
    blockMin: 15, continuous: true,
    description: '15 min doorlopend — laatste activering',
    goal: 'Mentaal klaar. Je kunt de afstand nu, dat is het verschil met zes weken terug.',
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
  { blockMin: 8,  runNr: 11, expected: '2026-09-10' },
  { blockMin: 12, runNr: 12, expected: '2026-09-12' },
  { blockMin: 16, runNr: 13, expected: '2026-09-15' },
  { blockMin: 20, runNr: 15, expected: '2026-09-19', note: 'Eerste doorlopende run, circa 2,5 km.' },
  { blockMin: 25, runNr: 16, expected: '2026-09-22', note: 'Vanaf hier nieuw volume: langer dan de totale looptijd per sessie tot nu toe.' },
  { blockMin: 31, runNr: 18, expected: '2026-09-26', note: '3,8 km doorlopend — de vloer die zij vroeg, een week voor de race. Loopt het makkelijk, dan door naar 4,0 km.' },
  { blockMin: 32, runNr: 23, expected: '2026-10-07', note: '4,0 km.' },
  { blockMin: 36, runNr: 24, expected: '2026-10-09', note: '4,5 km — de afstand die zij het liefst al in september had gelopen.' },
  { blockMin: 40, runNr: 27, expected: '2026-10-16', note: '5 km doorlopend op 8:00/km — het doel.' },
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
