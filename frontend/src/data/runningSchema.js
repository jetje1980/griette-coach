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

  // ── Week 4 · Sep 8-12 · Langere loopblokken ──────────────────────────────
  {
    nr: 10, week: 4,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4',
    goal: 'Totaal 16 min lopen (verdeeld) — meer dan week 1 helemaal',
  },
  {
    nr: 11, week: 4,
    runMin: 4, walkMin: 1.5, reps: 5, duration: 27,
    description: '4 min lopen / 1,5 min wandelen × 5',
    goal: 'Hogere loopefficiëntie — meer lopen, minder wandelen',
  },
  {
    nr: 12, week: 4,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4',
    goal: '5 min zone B = conditie begint mee te komen. Merk je verschil met week 1?',
    milestone: true,
  },

  // ── Week 5 · Sep 15-19 · Opbouw richting de 5 km ─────────────────────────
  {
    nr: 13, week: 5,
    runMin: 5, walkMin: 2, reps: 5, duration: 35,
    description: '5 min lopen / 2 min wandelen × 5',
    goal: 'Langste training tot nu toe. Na afloop: energie check — niet moe maar voldaan',
  },
  {
    nr: 14, week: 5,
    runMin: 4, walkMin: 1, reps: 6, duration: 30,
    description: '4 min lopen / 1 min wandelen × 6',
    goal: 'Efficiëntie: meer lopen met kortere pauzes, hartslag stabiel',
  },
  {
    nr: 15, week: 5,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4',
    goal: 'Langste loopblokken tot nu — opbouw richting de race van 3 oktober',
  },

  // ── Week 6 · Sep 22-26 · Taperweek voor 3 oktober ───────────────────────
  {
    nr: 16, week: 6,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4 (iets minder dan vorige week)',
    goal: 'Frisse benen sparen — prestatie wordt in herstel gebouwd',
  },
  {
    nr: 17, week: 6,
    runMin: 4, walkMin: 2, reps: 3, duration: 18,
    description: '4 min lopen / 2 min wandelen × 3 — korte activering',
    goal: 'Activering — benen voelen, niet belasten',
  },
  {
    nr: 18, week: 6,
    runMin: 3, walkMin: 2, reps: 3, duration: 15,
    description: '3 min lopen / 2 min wandelen × 3 — rustig uitlopen',
    goal: 'Mentale voorbereiding: ritme voelen, benen vrij houden',
  },

  // ── Week 7 · Sep 29 – Okt 3 · 🏁 Racedag ───────────────────────────────
  {
    nr: 19, week: 7,
    runMin: 3, walkMin: 3, reps: 3, duration: 18,
    description: '3 min lopen / 3 min wandelen × 3 — losse benen',
    goal: 'Activering, niet training. Zo fris mogelijk naar de start.',
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
    description: '🏁 Racedag · Run-walk: 5 min lopen / 3 min wandelen',
    goal: 'Checkpoint. Afstand, doeltijd, tempo, hartslag en racestrategie komen uit je racedoel en je actuele data — niet uit deze bibliotheek.',
    milestone: true,
    race: true,
  },

  // ── Week 8 · Okt 6-10 · Post-race herstel + opbouw Bereloop ─────────────
  {
    nr: 22, week: 8,
    runMin: 3, walkMin: 2, reps: 4, duration: 20,
    description: '3 min lopen / 2 min wandelen × 4 — zachte comeback',
    goal: 'Herstel activeren — bloed laten stromen, niet presteren',
  },
  {
    nr: 23, week: 8,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4',
    goal: 'Terug op schema — de volgende race is over drie weken',
  },
  {
    nr: 24, week: 8,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4',
    goal: 'Opbouw richting de volgende race',
  },

  // ── Week 9 · Okt 13-17 · Piek voor Bereloop ─────────────────────────────
  {
    nr: 25, week: 9,
    runMin: 7, walkMin: 2, reps: 4, duration: 36,
    description: '7 min lopen / 2 min wandelen × 4',
    goal: 'Langste loopblokken tot nu toe — opbouw richting de race',
  },
  {
    nr: 26, week: 9,
    runMin: 5, walkMin: 1, reps: 6, duration: 36,
    description: '5 min lopen / 1 min wandelen × 6 — hogere intensiteit',
    goal: 'Efficiëntie — veel lopen, weinig wandelen, HR stabiel',
  },
  {
    nr: 27, week: 9,
    runMin: 8, walkMin: 2, reps: 4, duration: 40,
    description: '8 min lopen / 2 min wandelen × 4',
    goal: 'Piek in de opbouw — 32 min totaal lopen. De race is volgende week.',
    milestone: true,
  },

  // ── Week 10 · Okt 20-24 · Taperweek voor 31 oktober ─────────────────────
  {
    nr: 28, week: 10,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4 — tapering',
    goal: 'Fris blijven — de race is over tien dagen',
  },
  {
    nr: 29, week: 10,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4 — rustige activering',
    goal: 'Activering, niet training — benen voelen, bewust ontspannen',
  },
  {
    nr: 30, week: 10,
    runMin: 3, walkMin: 2, reps: 3, duration: 15,
    description: '3 min lopen / 2 min wandelen × 3 — laatste activering',
    goal: 'Mentaal klaar — alles staat, nu alleen vertrouwen',
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
    description: '🏁 Racedag · Run-walk: 7 min lopen / 3 min wandelen',
    goal: 'Wedstrijd. Afstand, doeltijd, tempo, hartslag en racestrategie komen uit je racedoel en je actuele data — niet uit deze bibliotheek.',
    milestone: true,
    race: true,
  },

  // ── Week 12 · Nov 3-7 · Post-races + Ameland Dec voorbereiding ──────────
  {
    nr: 34, week: 12,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4 — herstel Bereloop',
    goal: 'Herstellen én conditie vasthouden voor Ameland 5 km (13 dec)',
  },
  {
    nr: 35, week: 12,
    runMin: 8, walkMin: 2, reps: 3, duration: 30,
    description: '🎯 5 km rustig lopen met run-walk · 8 min / 2 min × 3',
    goal: 'Droge test op raceafstand — voorbereiding voor het echte werk',
    milestone: true,
  },
];

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
