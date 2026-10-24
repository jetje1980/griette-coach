// Komen haar krachttrainingen bij de coach terecht — ook achteraf ingevuld?
//
// WAT ER MIS WAS
//
// De tijdlijnprojectie deed `if (!e?.name) continue;`, en een opgeslagen
// oefening bewaart alleen een `id` (a_squat, c_plank). Dus werd élke
// oefening weggegooid voordat de coach hem zag: de prompt had altijd een
// lege lijst topLifts en in het coachtabblad stond niets over kracht, ook
// als zij drie keer per week tilde.
//
// En een sessie met alleen lichaamsgewicht levert volume 0 op — niet te
// onderscheiden van "niets gedaan".
import './_storage-stub.js';
import { upsertStrengthSession, loadStrengthSessions, exerciseName }
  from '../../src/data/strengthSchema.js';
import { series } from '../../src/timeline.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 220) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-10-24';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

console.log('\n████ Kracht bij de coach ████');

S('1 · Een id wordt een leesbare naam');
{
  ok('een bekende id uit programma A', exerciseName('a_squat') === 'Goblet squat',
    exerciseName('a_squat'));
  ok('een id uit de lessen', !!exerciseName('bm_squat') && exerciseName('bm_squat') !== 'bm_squat',
    exerciseName('bm_squat'));
  ok('een onbekende id verdwijnt niet maar wordt leesbaar',
    exerciseName('x_mysterie') === 'mysterie', exerciseName('x_mysterie'));
  ok('een naam die al een naam is, blijft', exerciseName('Hip thrust') === 'Hip thrust');
  ok('niets in, niets uit', exerciseName(null) === null);
}

S('2 · Een sessie met gewicht komt bij de coach aan');
{
  globalThis.__testStorage.reset();
  upsertStrengthSession({ id: `${TODAY}_A`, date: TODAY, program: 'A', exercises: [
    { id: 'a_squat', weight: '14', sets: 3, reps: 10, done: true },
    { id: 'a_glutes', weight: '20', sets: 3, reps: 12, done: true },
  ] });
  const lifts = series('strength_lift', { asOf: TODAY });
  console.log(`      lifts: ${lifts.map(l => `${l.meta.exercise} ${l.value}kg`).join(' · ')}`);
  ok('beide oefeningen komen door', lifts.length === 2, String(lifts.length));
  ok('met een leesbare naam', lifts.every(l => /[A-Za-z]{4,}/.test(l.meta.exercise)),
    lifts.map(l => l.meta.exercise).join(','));
  ok('en met het gewicht', lifts.some(l => l.value === 14) && lifts.some(l => l.value === 20),
    lifts.map(l => l.value).join(','));
  ok('de id gaat mee voor historie', lifts.every(l => !!l.meta.exerciseId),
    JSON.stringify(lifts.map(l => l.meta.exerciseId)));
  ok('het volume is berekend', series('strength_volume', { asOf: TODAY })[0]?.value > 0,
    String(series('strength_volume', { asOf: TODAY })[0]?.value));
  ok('en de dag is gemarkeerd als krachtdag',
    series('strength_done', { asOf: TODAY }).length === 1);
}

S('3 · Lichaamsgewicht is óók training');
{
  globalThis.__testStorage.reset();
  upsertStrengthSession({ id: `${TODAY}_core`, date: TODAY, program: 'snack', exercises: [
    { id: 'c_plank', reps: 30, sets: 3, done: true },
    { id: 'c_hollow', reps: 20, sets: 3, done: true },
  ] });
  const lifts = series('strength_lift', { asOf: TODAY });
  ok('de oefeningen komen door zonder gewicht', lifts.length === 2, String(lifts.length));
  ok('en zijn gemarkeerd als lichaamsgewicht', lifts.every(l => l.meta.bodyweight === true),
    JSON.stringify(lifts.map(l => l.meta.bodyweight)));
  ok('de waarde is null, niet nul — geen gewicht is iets anders dan nul kilo',
    lifts.every(l => l.value === null), JSON.stringify(lifts.map(l => l.value)));
  ok('het volume is 0', series('strength_volume', { asOf: TODAY })[0]?.value === 0);
  ok('maar de dag telt wel als krachtdag',
    series('strength_done', { asOf: TODAY }).length === 1,
    'anders is lichaamsgewichtwerk niet te onderscheiden van niets doen');
}

S('4 · Achteraf invullen werkt en komt op de juiste dag');
{
  globalThis.__testStorage.reset();
  const drieDagenTerug = addDays(TODAY, -3);
  upsertStrengthSession({ id: `${drieDagenTerug}_B`, date: drieDagenTerug, program: 'B',
    exercises: [{ id: 'b_squat', weight: '16', sets: 3, reps: 10, done: true }] });
  ok('de sessie is bewaard', loadStrengthSessions().length === 1);
  ok('op de ingevulde datum', loadStrengthSessions()[0].date === drieDagenTerug,
    loadStrengthSessions()[0].date);
  const lifts = series('strength_lift', { asOf: TODAY });
  ok('en de coach ziet hem op die dag', lifts.length === 1
    && lifts[0].observedAt === drieDagenTerug, JSON.stringify(lifts.map(l => l.observedAt)));

  // Nog een sessie op een andere eerdere dag: beide moeten blijven staan.
  upsertStrengthSession({ id: `${addDays(TODAY, -5)}_A`, date: addDays(TODAY, -5),
    program: 'A', exercises: [{ id: 'a_squat', weight: '14', sets: 3, reps: 10, done: true }] });
  ok('twee achteraf ingevulde dagen blijven naast elkaar bestaan',
    loadStrengthSessions().length === 2, String(loadStrengthSessions().length));
  ok('en komen beide bij de coach', series('strength_done', { asOf: TODAY }).length === 2,
    String(series('strength_done', { asOf: TODAY }).length));
  ok('een sessie in de toekomst telt niet mee voor vandaag',
    series('strength_done', { asOf: addDays(TODAY, -4) }).length === 1,
    'de tijdlijn hoort op peildatum te filteren');
}

S('5 · Dezelfde dag en hetzelfde programma overschrijft, niet dupliceert');
{
  globalThis.__testStorage.reset();
  upsertStrengthSession({ id: `${TODAY}_A`, date: TODAY, program: 'A',
    exercises: [{ id: 'a_squat', weight: '14', sets: 3, reps: 10, done: true }] });
  upsertStrengthSession({ id: `${TODAY}_A`, date: TODAY, program: 'A',
    exercises: [{ id: 'a_squat', weight: '16', sets: 3, reps: 10, done: true }] });
  ok('één sessie, niet twee', loadStrengthSessions().length === 1,
    String(loadStrengthSessions().length));
  ok('met het nieuwe gewicht', series('strength_lift', { asOf: TODAY })[0].value === 16,
    String(series('strength_lift', { asOf: TODAY })[0].value));
  // Twee verschillende programma's op één dag mogen wél naast elkaar.
  upsertStrengthSession({ id: `${TODAY}_core`, date: TODAY, program: 'snack',
    exercises: [{ id: 'c_plank', reps: 30, sets: 3, done: true }] });
  ok('een ander programma op dezelfde dag staat ernaast',
    loadStrengthSessions().length === 2, String(loadStrengthSessions().length));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
