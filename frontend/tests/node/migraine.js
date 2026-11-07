// Migraine is geen PEM-reactie.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT APART GETEST WORDT
//
// Zij zei het zo: migraine zegt niets over long COVID, een PEM-reactie
// wel. Dat is ook medisch het juiste onderscheid — haar migraine heeft
// eigen triggers (hormonen, weer, alcohol, slaaptekort) die niets met
// inspanning te maken hebben.
//
// De app deed het anders. Hoofdpijn met ernst 2 of hoger was op zichzelf
// al genoeg voor "geen opbouw", ook als die hoofdpijn de migraine zelf
// was. Een migraineaanval in het weekend blokkeerde zo de opbouw van de
// week erna. En readSymptoms keek alleen naar migraine_type en
// symptom_migraine, niet naar het kale veld `migraine` dat in haar
// dagboek staat — op 19 september met als notitie "alcohol gehad daardoor
// migraine".
import './_storage-stub.js';
import { readSymptoms, exertionalResponse, pemFreeWeeks } from '../../src/symptoms.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);
const TODAY = '2026-11-07';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

console.log('\n████ Migraine staat los van PEM ████');

S('1 · Het kale veld migraine wordt gelezen');
{
  // Precies de vorm die in haar dagboek staat op 19 september.
  const log = { date: '2026-09-19', migraine: true, headache_severity: 3,
    feeling_causes: ['migraine', 'slaap', 'druk'], note: 'alcohol gehad daardoor migraine' };
  const s = readSymptoms(log);
  ok('migraine wordt herkend zonder migraine_type', s.migraine.present === true,
    JSON.stringify(s.migraine));
  ok('en de hoofdpijn blijft gewoon zichtbaar', s.headache.severity === 3,
    String(s.headache.severity));
  ok('zonder migraineveld geen migraine',
    readSymptoms({ headache_severity: 3 }).migraine.present === false);
}

S('2 · Migraine na een training blokkeert de opbouw niet');
{
  const loop = '2026-11-01';
  const logs = {
    [loop]: { date: loop, recovery_check: 'good', headache_severity: 0 },
    [addDays(loop, 1)]: { date: addDays(loop, 1), migraine: true, headache_severity: 3,
      migraine_triggers: ['hormonen', 'weer'] },
  };
  const r = exertionalResponse({ workoutDate: loop, logs, currentDate: TODAY });
  console.log(`      ${r.status}: ${r.reason}`);
  ok('de sessie wordt niet als slecht verdragen gerekend', r.status !== 'poor',
    `${r.status} — ${r.reason}`);
  ok('de migraine wordt wél benoemd',
    /migraine/i.test(r.reason || '') || !!r.migraine || !!r.migraineNote,
    JSON.stringify({ reason: r.reason, note: r.migraineNote }));

  // Dezelfde hoofdpijn zónder migrainemarkering is wél een signaal.
  const zonder = {
    [loop]: { date: loop, recovery_check: 'good', headache_severity: 0 },
    [addDays(loop, 1)]: { date: addDays(loop, 1), headache_severity: 3 },
  };
  const r2 = exertionalResponse({ workoutDate: loop, logs: zonder, currentDate: TODAY });
  console.log(`      zonder migrainemarkering: ${r2.status}`);
  ok('post-exertionele hoofdpijn zonder migraine telt wél', r2.status === 'poor',
    `${r2.status} — ${r2.reason}`);
}

S('3 · Migraine die zij zelf aan inspanning koppelt, telt wél');
{
  const loop = '2026-11-01';
  const logs = {
    [loop]: { date: loop, recovery_check: 'good' },
    [addDays(loop, 1)]: { date: addDays(loop, 1), migraine: true, headache_severity: 3,
      migraine_triggers: ['exertion'] },
  };
  const r = exertionalResponse({ workoutDate: loop, logs, currentDate: TODAY });
  ok('met trigger inspanning telt de hoofdpijn mee', r.status === 'poor',
    `${r.status} — ${r.reason}`);
  ok('en dat staat zo in de uitkomst', r.migraineCountsAsPem === true,
    String(r.migraineCountsAsPem));
}

S('4 · Een migrainedag zet de PEM-vrije weken niet op nul');
{
  globalThis.__testStorage.reset();
  const logs = {};
  for (let i = 0; i < 28; i++) {
    const d = addDays(TODAY, -i);
    logs[d] = { date: d, recovery_check: 'good', headache_severity: 0 };
  }
  // Een training, en twee dagen later een migraine met ernst 3.
  const loop = addDays(TODAY, -9);
  localStorage.setItem('gc_workouts', JSON.stringify([{ id: 'r', date: loop, distance: 4 }]));
  logs[addDays(loop, 2)] = { date: addDays(loop, 2), migraine: true,
    headache_severity: 3, migraine_triggers: ['hormonen'] };

  const met = pemFreeWeeks({ logs, currentDate: TODAY });
  console.log(`      ${met.weeks} weken · ${met.note}`);
  ok('de migraine breekt de reeks niet', met.weeks >= 3, `${met.weeks} — ${met.note}`);

  // Dezelfde dag, maar nu als echte PEM-reactie aangevinkt.
  const pem = { ...logs };
  pem[addDays(loop, 2)] = { date: addDays(loop, 2), symptom_pem: true };
  const r = pemFreeWeeks({ logs: pem, currentDate: TODAY });
  ok('haar eigen PEM-vinkje doet dat wél', r.weeks < met.weeks,
    `${r.weeks} vs ${met.weeks}`);
  ok('met de datum van het signaal erbij', r.lastSignal === addDays(loop, 2),
    String(r.lastSignal));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
