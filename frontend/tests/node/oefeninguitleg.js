// Weet je wat je gaat doen, voordat je hoort hoe je het goed doet?
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Ook wil ik bij kracht duidelijker uitleg wat een goblet squat is enzo
// en hoe gewichten gebruiken. Gebruik eenvoudige jip en janneke taal."
//
// Er stonden drie technische aanwijzingen per oefening: "dumbbell tegen
// je borst, ellebogen naar binnen, voeten iets breder dan je heupen".
// Dat is bruikbaar als je weet wat een goblet squat is, en onleesbaar als
// je dat niet weet. De aanwijzingen gingen over hoe je het goed doet en
// sloegen de vraag over wat je eigenlijk gaat doen.
//
// ─────────────────────────────────────────────────────────────────
// WAT DEZE SUITE BEWAAKT
//
// Niet of de teksten mooi zijn — dat kan een test niet. Wel drie dingen
// die er anders stilletjes uit vallen:
//
//   · elke oefening die in haar programma's staat, heeft een uitleg.
//     Een losse oefening zonder uitleg valt niet op tussen dertien die
//     hem wel hebben, totdat zij juist díe tegenkomt;
//   · de uitleg legt de naam uit. Daar ging haar vraag over: niet "hoe
//     doe ik het" maar "wat ís dit";
//   · en er staat geen vakjargon in dat zelf weer uitleg nodig heeft.
import './_storage-stub.js';
import { TECHNIQUE, techniqueFor, GEWICHTEN_UITLEG }
  from '../../src/data/exerciseTechnique.js';
import { PROGRAM_A, PROGRAM_B } from '../../src/data/strengthSchema.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const OEFENINGEN = [...PROGRAM_A.exercises, ...PROGRAM_B.exercises];

S('1 · Elke oefening in haar programma legt zichzelf uit');
{
  console.log(`      ${OEFENINGEN.length} oefeningen in programma A en B`);
  const zonderWat = OEFENINGEN.filter(e => !techniqueFor(e.id)?.wat);
  ok('geen enkele oefening zonder "wat is dit"', zonderWat.length === 0,
    zonderWat.map(e => e.name).join(', '));
  const zonderGewicht = OEFENINGEN.filter(e => !techniqueFor(e.id)?.gewicht);
  ok('en geen enkele zonder "wat pak je vast"', zonderGewicht.length === 0,
    zonderGewicht.map(e => e.name).join(', '));
  ok('de drie aanwijzingen staan er nog steeds naast',
    OEFENINGEN.every(e => techniqueFor(e.id)?.cues?.length === 3), '');
}

S('2 · De uitleg legt de naam uit, niet alleen de beweging');
{
  // Dit is waar haar vraag over ging. Een Engelse naam die onvertaald
  // blijft staan, is precies het woord waar ze op vastliep.
  const vertaald = [
    ['a_squat', /goblet is bokaal|bokaal/i],
    ['a_hinge', /deadlift betekent/i],
    ['a_glutes', /hip thrust is letterlijk/i],
    ['a_pull', /row is het Engelse woord|roeien/i],
    ['a_core', /kever/i],
    ['a_calves', /calf is het Engelse woord|kuit/i],
    ['b_lunge', /split betekent/i],
    ['b_hinge', /ketelbel/i],
    ['b_glutes', /glute is je bilspier/i],
    ['b_push', /press betekent duwen|press is duwen/i],
    ['b_pull', /uit-elkaar-trekken/i],
    ['b_carry', /boer/i],
  ];
  for (const [id, patroon] of vertaald) {
    const t = techniqueFor(id);
    ok(`${id} legt zijn naam uit`, patroon.test(t.wat), t.wat.slice(0, 110));
  }
}

S('3 · Geen jargon dat zelf uitleg nodig heeft');
{
  // Deze woorden stonden in de oude aanwijzingen en zijn precies waar de
  // uitleg overheen moest. Komen ze terug in de nieuwe tekst, dan is het
  // probleem verplaatst in plaats van opgelost.
  const JARGON = [/\bRIR\b/, /\bhypertrofie\b/i, /\bconcentrisch/i, /\bexcentrisch/i,
    /\beccentric/i, /\bprogressive overload\b/i, /\bunilateraal/i, /\bposterior chain\b/i];
  const fouten = [];
  for (const e of OEFENINGEN) {
    const t = techniqueFor(e.id);
    for (const j of JARGON) {
      if (j.test(t.wat) || j.test(t.gewicht)) fouten.push(`${e.id}: ${j}`);
    }
  }
  ok('geen vakterm in de uitleg', fouten.length === 0, fouten.join(', '));

  // En de zinnen blijven kort genoeg om staand in de sportkamer te lezen.
  const telang = OEFENINGEN.filter(e => {
    const z = techniqueFor(e.id).wat.split(/(?<=\.)\s+/);
    return z.some(x => x.split(/\s+/).length > 34);
  });
  ok('geen zin van meer dan vierendertig woorden', telang.length === 0,
    telang.map(e => e.id).join(', '));
}

S('4 · Hoe gewichten werken staat één keer, niet bij elke oefening');
{
  console.log(`      ${GEWICHTEN_UITLEG.map(b => b.kop).join(' · ')}`);
  ok('er is een algemene uitleg', GEWICHTEN_UITLEG.length >= 4,
    String(GEWICHTEN_UITLEG.length));
  ok('met een kop en een tekst per blok',
    GEWICHTEN_UITLEG.every(b => b.kop && b.tekst), '');

  const alles = GEWICHTEN_UITLEG.map(b => b.tekst).join(' ');
  ok('hij legt uit wat een serie en een herhaling zijn',
    /Een herhaling is/.test(alles) && /Een serie is/.test(alles), '');
  ok('en hoe je weet of een gewicht goed is',
    /laatste twee herhalingen zwaar/.test(alles), '');
  ok('en wanneer er een kilo bij mag',
    /twee of drie herhalingen over/.test(alles), '');
  // Zij traint voor hardlopen, niet voor spiermassa. Dat is de vraag die
  // bij "waarom zou ik zwaar tillen" als eerste opkomt.
  ok('en waarom zwaar tillen haar sneller maakt, niet zwaarder',
    /niet zwaarder van/.test(alles) && /hartslag/.test(alles), '');
  ok('met een oplossing voor wie geen halters heeft',
    /rugzak|waterfles/.test(alles), '');

  // De uitleg mag niet per oefening herhaald worden: dat is hoe een
  // scherm onleesbaar wordt.
  const herhaald = OEFENINGEN.filter(e =>
    /Een serie is een rijtje/.test(techniqueFor(e.id).gewicht));
  ok('en hij staat niet nog eens bij elke oefening', herhaald.length === 0,
    herhaald.map(e => e.id).join(', '));
}

S('5 · De oefeningen buiten haar programma blijven werken');
{
  // De korte varianten en de bandversies hebben geen eigen uitleg, en dat
  // mag — maar ze mogen er niet op stukgaan.
  const overig = Object.keys(TECHNIQUE)
    .filter(k => !OEFENINGEN.some(e => e.id === k));
  console.log(`      ${overig.length} oefeningen buiten programma A en B`);
  ok('ze hebben allemaal nog hun drie aanwijzingen',
    overig.every(k => TECHNIQUE[k].cues?.length === 3),
    overig.filter(k => TECHNIQUE[k].cues?.length !== 3).join(', '));
  ok('en een zoekterm voor een demo',
    overig.every(k => !!TECHNIQUE[k].search), '');
  ok('een onbekende oefening geeft niets terug in plaats van een fout',
    techniqueFor('bestaat_niet') === null, '');
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
