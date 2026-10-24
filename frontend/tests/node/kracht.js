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
import { saveSession } from '../../src/strength.js';
import { buildCoachContext, contextAsText } from '../../src/coachContext.js';

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

S('6 · Een les is een hele sessie, niet een halve');
{
  // WAT ER MIS WAS
  //
  // Negen van haar elf krachtsessies in de cloud zijn lessen: type
  // coach_class met een classId, een duur, een RPE en een bandweerstand —
  // en géén oefeningenlijst en géén programma. De projectie keek alleen
  // naar oefeningen en gewicht, dus leverde zo'n sessie exact één feit op:
  // volume 0. Dertig minuten op RPE 3 met medium banden was voor de coach
  // niet te onderscheiden van niets gedaan.
  globalThis.__testStorage.reset();
  const dag = (n) => addDays(TODAY, n);
  saveSession({ id: 'st_1', date: dag(-12), type: 'coach_class', classId: 'strong30',
    duration: 30, rpe: 3, couldDoMore: 'beetje', bandResistance: 'medium', completed: 'full' });
  saveSession({ id: 'st_2', date: dag(-11), type: 'coach_class', classId: 'strong15',
    duration: 15, rpe: 3, couldDoMore: 'ja', bandResistance: 'medium', completed: 'full' });
  saveSession({ id: 'st_3', date: dag(-9), type: 'coach_class', classId: 'strong15',
    duration: 15, rpe: 2, couldDoMore: 'ja', bandResistance: 'light', completed: 'full' });

  const duur = series('strength_duration', { asOf: TODAY });
  const rpe = series('strength_rpe', { asOf: TODAY });
  const band = series('strength_band', { asOf: TODAY });
  console.log(`      duur: ${duur.map(o => `${o.observedAt}:${o.value}min`).join(' · ')}`);

  ok('de duur van elke les komt door', duur.length === 3, String(duur.length));
  ok('in minuten', duur.every(o => o.unit === 'min'));
  ok('met de juiste waarden', duur.map(o => o.value).sort((a, b) => a - b).join(',') === '15,15,30',
    duur.map(o => o.value).join(','));
  ok('de RPE komt door', rpe.length === 3 && rpe.some(o => o.value === 2),
    rpe.map(o => o.value).join(','));
  ok('en of ze meer had gekund gaat mee', rpe.every(o => o.meta.couldDoMore != null),
    JSON.stringify(rpe.map(o => o.meta.couldDoMore)));
  ok('de bandweerstand komt door', band.length === 3 && band.some(o => o.value === 'light'),
    band.map(o => o.value).join(','));
  ok('de les-id gaat mee, zodat je weet welke les het was',
    duur.every(o => !!o.meta.classId), JSON.stringify(duur.map(o => o.meta.classId)));

  // Het punt waar het om begon: tellen ze als sessie?
  const gedaan = series('strength_done', { asOf: TODAY });
  ok('drie lessen zijn drie krachtdagen', gedaan.length === 3, String(gedaan.length));
  ok('en zijn te herkennen als les', gedaan.every(o => o.meta.type === 'coach_class'),
    JSON.stringify(gedaan.map(o => o.meta.type)));
  ok('het volume is nul — een les tilt geen losse kilo\'s',
    series('strength_volume', { asOf: TODAY }).every(o => o.value === 0));

  // En wat de coach er dan van leest.
  const ctx = buildCoachContext({ asOf: TODAY });
  const tekst = contextAsText(ctx);
  const krachtblok = tekst.split('KRACHT:')[1]?.split('\n\n')[0] || '';
  console.log(`      coach leest:${krachtblok.split('\n').slice(0, 3).join('\n     ')}`);
  ok('de coach ziet drie sessies, niet nul', ctx.strength.sessions28 === 3,
    String(ctx.strength.sessions28));
  ok('en weet dat het lessen waren', ctx.strength.classSessions28 === 3,
    String(ctx.strength.classSessions28));
  ok('met de minuten bij elkaar', ctx.strength.classMinutes28 === 60,
    String(ctx.strength.classMinutes28));
  ok('en de gemiddelde RPE', ctx.strength.avgClassRpe28 === 2.7,
    String(ctx.strength.avgClassRpe28));
  ok('de laatste sessie is de laatste les, niet null', ctx.strength.lastSession === dag(-9),
    String(ctx.strength.lastSession));
  ok('en het staat in de tekst die naar de coach gaat',
    /waarvan 3 lessen, samen 60 min/.test(krachtblok), krachtblok.trim().slice(0, 120));
  ok('met de uitleg dat duur hier de belasting is',
    /duur de belasting/.test(krachtblok));
}

S('7 · Lessen en programma\'s door elkaar op één dag');
{
  // Zij doet een les én tilt soms op dezelfde dag. Dat mag niet in elkaar
  // schuiven: twee prikkels op één dag is een ander gegeven dan één.
  globalThis.__testStorage.reset();
  saveSession({ id: 'st_les', date: TODAY, type: 'coach_class', classId: 'strong15',
    duration: 15, rpe: 4, bandResistance: 'medium', completed: 'full' });
  upsertStrengthSession({ id: `${TODAY}_A`, date: TODAY, program: 'A',
    exercises: [{ id: 'a_squat', weight: '14', sets: 3, reps: 10, done: true }] });
  ok('beide staan er', loadStrengthSessions().length === 2,
    String(loadStrengthSessions().length));
  ok('de coach ziet twee prikkels op die dag',
    series('strength_done', { asOf: TODAY }).length === 2);
  ok('het getilde gewicht blijft zichtbaar',
    series('strength_lift', { asOf: TODAY }).length === 1);
  ok('en de duur van de les ook',
    series('strength_duration', { asOf: TODAY }).length === 1);
  const ctx = buildCoachContext({ asOf: TODAY });
  ok('de les wordt niet dubbel geteld als getild volume',
    ctx.strength.classSessions28 === 1, String(ctx.strength.classSessions28));
  ok('en de toplifts bevatten alleen echte lifts',
    ctx.strength.topLifts.length === 1, JSON.stringify(ctx.strength.topLifts));
}

S('8 · Een gemiste les achteraf invullen');
{
  globalThis.__testStorage.reset();
  // Zij vulde op 24 oktober een les van 20 oktober in. Die hoort op 20
  // oktober te staan en vanaf dat moment mee te tellen.
  const toen = addDays(TODAY, -4);
  saveSession({ id: 'st_laat', date: toen, type: 'coach_class', classId: 'strong30',
    duration: 30, rpe: 5, bandResistance: 'heavy', completed: 'partial' });
  const d = series('strength_duration', { asOf: TODAY });
  ok('de les staat op de dag dat zij hem deed', d.length === 1 && d[0].observedAt === toen,
    JSON.stringify(d.map(o => o.observedAt)));
  ok('en telt op die dag al mee',
    series('strength_done', { asOf: toen }).length === 1);
  ok('niet eerder', series('strength_done', { asOf: addDays(toen, -1) }).length === 0);
  ok('gedeeltelijk afgerond blijft gedeeltelijk',
    series('strength_done', { asOf: TODAY })[0].meta.completed === 'partial',
    String(series('strength_done', { asOf: TODAY })[0].meta.completed));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
