// Run-walk-run schema voor long COVID · 3×/week.
//
// Let op wat hier NIET meer staat: afstanden. Elke sessie had een
// `km_estimate` die los van de tempo's was opgeschreven, en alle 31 klopten
// niet — gemiddeld 25 tot 50 procent te hoog. T21 beweerde 10 km in 75
// minuten terwijl de eigen getallen 6,4 tot 7,0 km opleveren. Afstand wordt
// nu berekend uit loopminuten, wandelminuten en de werkelijke tempo's; zie
// sessionMath.js. Niemand schrijft hier nog een afstand met de hand op.
// Tempo hardlopen: ~10:00-11:00 min/km · Tempo wandelen: ~11:15-12:00 min/km
// De wandeltempo's stonden hier eerder op 6:30-7:00/km. Dat is bijna
// 9 km/u en dus sneller dan de loopblokken — fysiek onmogelijk als
// richtlijn. Ze zijn afgeleid van het looptempo van elke sessie: een
// wandelpauze hoort langzamer te zijn dan het blok ervoor.
// Richtgebied, geen stopgrens: blijft de hartslag structureel boven het
// easy-doel, dan gaat het tempo omlaag. VT1 (132) is een overgang.

export const RUNS = [
  // ── Week 1 · Aug 18-22 · Eerste stappen — hartslag is de baas ─────────────
  {
    nr: 1, week: 1,
    runMin: 1, walkMin: 2, reps: 5, duration: 15,
    description: '1 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Boven 130 bpm → direct wandelen. Praatregel: je moet hele zinnen kunnen zeggen.',
    tempo: 'Looptempo: ~10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Wennen aan de intervalvorm — niet op gevoel, maar op hartslag lopen',
  },
  {
    nr: 2, week: 1,
    runMin: 1, walkMin: 2, reps: 6, duration: 18,
    description: '1 min lopen / 2 min wandelen × 6',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Als HR na wandelminuut nog boven 110 is: verleng de wandelpauze tot < 105.',
    tempo: 'Looptempo: ~10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Hartslag leren lezen — noteer je max HR per interval',
  },
  {
    nr: 3, week: 1,
    runMin: 1.5, walkMin: 2, reps: 6, duration: 21,
    description: '1,5 min lopen / 2 min wandelen × 6',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Eerste kleine opbouw. Als HR boven 128 bleef tijdens loopblok: terug naar 1 min.',
    tempo: 'Looptempo: ~10:00-10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Probeer de hartslag tijdens lopen onder 128 te houden',
  },

  // ── Week 2 · Aug 25-29 · AMELAND! Strandlopen als bonus ──────────────────
  {
    nr: 4, week: 2,
    runMin: 1.5, walkMin: 2, reps: 5, duration: 17,
    description: '1,5 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Strand is zwaarder (zand slokt energie) → tempo iets lager dan thuis. Zet HR als enige maatstaf.',
    tempo: 'Looptempo: ~11:00 min/km op strand · Wandeltempo: ~12:15-13:00 min/km',
    goal: 'Ameland bonus: buitenlucht, zonlicht, zand — genieten én bewegen',
    vacation: true,
    vacationNote: '🏝️ Ameland — strandjog is prima vervanging, duinen optioneel',
  },
  {
    nr: 5, week: 2,
    runMin: 2, walkMin: 2, reps: 5, duration: 20,
    description: '2 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Eerste keer 2 minuten aan een stuk. Succes = hartslag onder 132 blijft.',
    tempo: 'Looptempo: ~10:00-11:00 min/km · Wandeltempo: ~12:15-13:00 min/km',
    goal: '2 min aan een stuk in zone B — dit is de eerste echte mijlpaal',
    vacation: true,
    vacationNote: '🏝️ Ameland',
  },
  {
    nr: 6, week: 2,
    runMin: 2, walkMin: 2, reps: 6, duration: 24,
    description: '2 min lopen / 2 min wandelen × 6',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Totale looptijd: 12 min. Hartslag gemiddeld tijdens loopblokken? Noteer dit.',
    tempo: 'Looptempo: ~10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Volume opbouwen terwijl hartslag laag blijft',
  },

  // ── Week 3 · Sep 1-5 · Na vakantie — opnieuw opbouwen ────────────────────
  {
    nr: 7, week: 3,
    runMin: 2, walkMin: 1.5, reps: 6, duration: 21,
    description: '2 min lopen / 1,5 min wandelen × 6',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Kortere wandelpauze = meer uitdaging voor hartslag. Bij twijfel: wandelpauze verlengen.',
    tempo: 'Looptempo: ~10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Herstelefficiëntie testen — daalt je HR snel genoeg in 1,5 min wandelen?',
  },
  {
    nr: 8, week: 3,
    runMin: 3, walkMin: 2, reps: 5, duration: 25,
    description: '3 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Eerste keer 3 min lopen. Pas als 2 min echt makkelijk voelt — anders terugstap naar run 7.',
    tempo: 'Looptempo: ~10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: '3 min zone B — mijlpaal. Na de training: hoe voel je je 2 uur later?',
  },
  {
    nr: 9, week: 3,
    runMin: 3, walkMin: 2, reps: 5, duration: 25,
    description: '3 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Herhaal zelfde sessie. Let op: zit je nu al eerder in zone B? Dat is conditiewinst.',
    tempo: 'Looptempo: ~9:45-10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Consistentie — dezelfde sessie voelt makkelijker dan vorige keer',
  },

  // ── Week 4 · Sep 8-12 · Langere loopblokken ──────────────────────────────
  {
    nr: 10, week: 4,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: '4 min vraagt om geduld met tempo. Begin de loopblokken rustig, niet sprint in!',
    tempo: 'Looptempo: ~9:30-10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Totaal 16 min lopen (verdeeld) — meer dan week 1 helemaal',
  },
  {
    nr: 11, week: 4,
    runMin: 4, walkMin: 1.5, reps: 5, duration: 27,
    description: '4 min lopen / 1,5 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Kortere herstelperiode. Als HR niet daalt onder 108 in wandelpauze: verleng naar 2 min.',
    tempo: 'Looptempo: ~9:30-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Hogere loopefficiëntie — meer lopen, minder wandelen',
  },
  {
    nr: 12, week: 4,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Eerste keer 5 min! Neem de eerste minuut extra rustig — de 5e minuut wordt anders te zwaar.',
    tempo: 'Looptempo: ~9:30-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: '5 min zone B = conditie begint mee te komen. Merk je verschil met week 1?',
    milestone: true,
  },

  // ── Week 5 · Sep 15-19 · Opbouw richting Trail ───────────────────────────
  {
    nr: 13, week: 5,
    runMin: 5, walkMin: 2, reps: 5, duration: 35,
    description: '5 min lopen / 2 min wandelen × 5',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Meer volume — totaal 25 min lopen. Hartslag leidend, tempo bijkomstig.',
    tempo: 'Looptempo: ~9:15-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Langste training tot nu toe. Na afloop: energie check — niet moe maar voldaan',
  },
  {
    nr: 14, week: 5,
    runMin: 4, walkMin: 1, reps: 6, duration: 30,
    description: '4 min lopen / 1 min wandelen × 6',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Korte wandelbreak van 1 min — werkt alleen als je HR snel herstelt. Test dit!',
    tempo: 'Looptempo: ~9:15-9:45 min/km · Wandeltempo: ~11:00-11:45 min/km',
    goal: 'Efficiëntie: meer lopen met kortere pauzes, hartslag stabiel',
  },
  {
    nr: 15, week: 5,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: '6 min — echt conditiegebied. Eerste 2 min op 11:00 min/km, daarna naar comfortabel.',
    tempo: 'Looptempo: ~9:15-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Langste loopblokken tot nu — voorbereiding voor Trail op 3 oktober',
  },

  // ── Week 6 · Sep 22-26 · Tapering Trail 10km (3 okt) ────────────────────
  {
    nr: 16, week: 6,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4 (iets minder dan vorige week)',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Tapering: minder volume, zelfde tempo. Benen vers houden voor de race.',
    tempo: 'Looptempo: ~9:15-9:45 min/km · Wandeltempo: ~11:00-11:45 min/km',
    goal: 'Frisse benen sparen — prestatie wordt in herstel gebouwd',
  },
  {
    nr: 17, week: 6,
    runMin: 4, walkMin: 2, reps: 3, duration: 18,
    description: '4 min lopen / 2 min wandelen × 3 — korte activering',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Licht en fris blijven. Geen heroïsche sessie nu — sparen voor de race.',
    tempo: 'Looptempo: ~9:30-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Activering — benen voelen, niet belasten',
  },
  {
    nr: 18, week: 6,
    runMin: 3, walkMin: 2, reps: 3, duration: 15,
    description: '3 min lopen / 2 min wandelen × 3 — rustig uitlopen',
    hrZone: 'Zone B: 106–120 bpm (extra laag)',
    hrTip: 'Race is over 5 dagen! Vandaag alleen losse benen. Stoppen bij 120 bpm.',
    tempo: 'Looptempo: ~10:30-11:30 min/km · Wandeltempo: ~12:45-13:30 min/km',
    goal: 'Mentale voorbereiding: ritme voelen, benen vrij houden',
  },

  // ── Week 7 · Sep 29 – Okt 3 · 🏁 TRAIL 10 KM ───────────────────────────
  {
    nr: 19, week: 7,
    runMin: 3, walkMin: 3, reps: 3, duration: 18,
    description: '3 min lopen / 3 min wandelen × 3 — losse benen',
    hrZone: 'Zone A/B: 95–120 bpm',
    hrTip: 'Race is bijna! Niet boven 120. Dit is alleen even bewegen.',
    tempo: 'Heel rustig — wandeltempo met een lichte trot',
    goal: 'Activering, niet training. Zo fris mogelijk naar de start.',
  },
  {
    nr: 20, week: 7,
    runMin: 0, walkMin: 20, reps: 1, duration: 20,
    description: '20 min rustige wandeling — geen lopen',
    hrZone: 'Zone A: < 106 bpm',
    hrTip: 'Dag voor de race: wandelen, stretchen, goed slapen. Geen extra belasting.',
    tempo: 'Wandeltempo: ~9:30-10:15 min/km',
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
    description: '🏁 TRAIL 5 KM · Run-walk strategie: 5 min lopen / 3 min wandelen',
    hrZone: 'Wedstrijd: hartslagadvies per afstand — zie het raceplan',
    hrTip: 'Race-strategie: bij 130+ DIRECT wandelen. Liever 10 min langzamer dan PEM riskeren. Wandelen op heuvels/klimmen altijd.',
    tempo: null,
    goal: 'Checkpoint van 5 km. Tempo en hartslag komen uit je racedoel en je actuele data, niet uit dit schema.',
    milestone: true,
    race: true,
  },

  // ── Week 8 · Okt 6-10 · Post-race herstel + opbouw Bereloop ─────────────
  {
    nr: 22, week: 8,
    runMin: 3, walkMin: 2, reps: 4, duration: 20,
    description: '3 min lopen / 2 min wandelen × 4 — zachte comeback',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Na race: benen zijn moe. Bij spierpijn of moeheid → rustdag. Geen schuldgevoel.',
    tempo: 'Looptempo: ~10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Herstel activeren — bloed laten stromen, niet presteren',
  },
  {
    nr: 23, week: 8,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Als race-herstel compleet voelt: normaal tempo. Twijfel? Één level terug.',
    tempo: 'Looptempo: ~9:30-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Terug op schema — Bereloop is over 3 weken',
  },
  {
    nr: 24, week: 8,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Langste training na de race. Voel je de conditiewinst van de race?',
    tempo: 'Looptempo: ~9:15-9:45 min/km · Wandeltempo: ~11:00-11:45 min/km',
    goal: 'Bereloop voorbereiding — 10 km opnieuw aanlopen',
  },

  // ── Week 9 · Okt 13-17 · Piek voor Bereloop ─────────────────────────────
  {
    nr: 25, week: 9,
    runMin: 7, walkMin: 2, reps: 4, duration: 36,
    description: '7 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: '7 min is echt conditiegebied. Eerste minuut heel rustig — je hebt 7 nodig.',
    tempo: 'Looptempo: ~9:00-9:30 min/km · Wandeltempo: ~10:45-11:30 min/km',
    goal: 'Langste loopblokken tot nu toe — voorbereiding Bereloop',
  },
  {
    nr: 26, week: 9,
    runMin: 5, walkMin: 1, reps: 6, duration: 36,
    description: '5 min lopen / 1 min wandelen × 6 — hogere intensiteit',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Korte wandelpauze = testen of hartslag snel herstelt. Goed teken van conditie.',
    tempo: 'Looptempo: ~9:00-9:30 min/km · Wandeltempo: ~10:45-11:30 min/km',
    goal: 'Efficiëntie — veel lopen, weinig wandelen, HR stabiel',
  },
  {
    nr: 27, week: 9,
    runMin: 8, walkMin: 2, reps: 4, duration: 40,
    description: '8 min lopen / 2 min wandelen × 4',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: '8 min — dit is je langste loopblok ooit. Tempo is bijzaak, hartslag is alles.',
    tempo: 'Looptempo: ~9:00-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Peak training — 32 min totaal lopen. Bereloop is volgende week!',
    milestone: true,
  },

  // ── Week 10 · Okt 20-24 · Tapering Bereloop (30 okt) ────────────────────
  {
    nr: 28, week: 10,
    runMin: 6, walkMin: 2, reps: 4, duration: 32,
    description: '6 min lopen / 2 min wandelen × 4 — tapering',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Minder volume dan vorige week — benen vers houden. Kwaliteit boven kwantiteit.',
    tempo: 'Looptempo: ~9:15-9:45 min/km · Wandeltempo: ~11:00-11:45 min/km',
    goal: 'Fris blijven — Bereloop is over 10 dagen',
  },
  {
    nr: 29, week: 10,
    runMin: 4, walkMin: 2, reps: 4, duration: 24,
    description: '4 min lopen / 2 min wandelen × 4 — rustige activering',
    hrZone: 'Zone B: 106–125 bpm (iets lager)',
    hrTip: 'Tapering: bewust HR lager houden. Sparen voor race.',
    tempo: 'Looptempo: ~9:45-10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Activering, niet training — benen voelen, bewust ontspannen',
  },
  {
    nr: 30, week: 10,
    runMin: 3, walkMin: 2, reps: 3, duration: 15,
    description: '3 min lopen / 2 min wandelen × 3 — laatste activering',
    hrZone: 'Zone B: 106–120 bpm',
    hrTip: 'Dag voor de race bijna: heel licht bewegen. Stoppen bij 120 bpm.',
    tempo: 'Looptempo: ~10:30 min/km · Wandeltempo: ~11:45-12:30 min/km',
    goal: 'Mentaal klaar voor Bereloop — alles is klaar, nu alleen vertrouwen',
  },

  // ── Week 11 · Okt 27-31 · 🏁 BERELOOP TERSCHELLING ──────────────────────
  {
    nr: 31, week: 11,
    runMin: 3, walkMin: 3, reps: 3, duration: 18,
    description: '3 min lopen / 3 min wandelen × 3 — losse benen',
    hrZone: 'Zone A/B: 95–120 bpm',
    hrTip: 'Race is over 3 dagen. Heel licht — geen km\'s meer opbouwen nu.',
    tempo: 'Zeer rustig — bewegend mediteren',
    goal: 'Lichaam activeren zonder te belasten',
  },
  {
    nr: 32, week: 11,
    runMin: 0, walkMin: 20, reps: 1, duration: 20,
    description: '20 min wandelen — dag voor de race',
    hrZone: 'Zone A: < 106 bpm',
    hrTip: 'Dag voor Bereloop: wandelen + stretchen + goed eten + vroeg slapen.',
    tempo: 'Wandeltempo: ~9:30-10:15 min/km',
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
    description: '🏁 BERELOOP 10 KM TERSCHELLING · Run-walk: 7 min lopen / 3 min wandelen',
    hrZone: 'Wedstrijd: hartslagadvies per afstand — zie het raceplan',
    hrTip: 'Race-strategie: zand en duin = meer weerstand. Bij 130+ DIRECT wandelen. Terschelling is pittiger dan weg — verwacht 5-10% lagere snelheid. Liever slenteren dan PEM.',
    tempo: null,
    goal: 'Bereloop 10 km. Tempo en hartslag komen uit je racedoel en je actuele data, niet uit dit schema.',
    milestone: true,
    race: true,
  },

  // ── Week 12 · Nov 3-7 · Post-races + Ameland Dec voorbereiding ──────────
  {
    nr: 34, week: 12,
    runMin: 5, walkMin: 2, reps: 4, duration: 28,
    description: '5 min lopen / 2 min wandelen × 4 — herstel Bereloop',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Na twee races in 4 weken: luister naar je lichaam. Moe = rustdag. Kracht = doorlopen.',
    tempo: 'Looptempo: ~9:30-10:00 min/km · Wandeltempo: ~11:15-12:00 min/km',
    goal: 'Herstellen én conditie vasthouden voor Ameland 5 km (13 dec)',
  },
  {
    nr: 35, week: 12,
    runMin: 8, walkMin: 2, reps: 3, duration: 30,
    description: '🎯 5 km rustig lopen met run-walk · 8 min / 2 min × 3',
    hrZone: 'Zone B: 106–132 bpm',
    hrTip: 'Je bent in 12 weken van "1 min lopen" naar hier. Dit is échte progressie.',
    tempo: 'Looptempo: ~9:00-9:30 min/km · Wandeltempo: ~10:45-11:30 min/km · Doeltijd 5 km: ~50-55 min',
    goal: 'Ameland 5 km (13 dec) droge test — voorbereiding voor het echte werk',
    milestone: true,
  },
];

// ── Afstand is afgeleid, nooit opgeschreven ─────────────────────
// Uit de structuur van de sessie en het tempo dat er werkelijk bij hoort.
// Zonder tempo is er geen afstand — en dat is eerlijker dan een getal
// verzinnen. Wie het actuele looptempo meegeeft, krijgt een afstand die
// bij háár data past in plaats van bij een schemagemiddelde.
import { sessionMath, sessionRange, fmtSec } from '../sessionMath';

export function schemaPaces(run) {
  const parse = (t) => { const m = String(t).match(/(\d+):(\d+)/); return m ? +m[1] + +m[2] / 60 : null; };
  const tempo = run?.tempo || '';
  const runPart = tempo.match(/Looptempo:[^·]*/)?.[0] || '';
  const walkPart = tempo.match(/Wandeltempo:[^·]*/)?.[0] || '';
  const runPaces = [...runPart.matchAll(/(\d+:\d+)/g)].map(x => parse(x[1])).filter(Boolean);
  const walkPaces = [...walkPart.matchAll(/(\d+:\d+)/g)].map(x => parse(x[1])).filter(Boolean);
  if (!runPaces.length) return null;
  return {
    runFast: Math.min(...runPaces), runSlow: Math.max(...runPaces),
    walkFast: walkPaces.length ? Math.min(...walkPaces) : null,
    walkSlow: walkPaces.length ? Math.max(...walkPaces) : null,
  };
}

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
