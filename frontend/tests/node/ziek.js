// Gewoon griep is geen PEM — en HRV telt mee.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Ik wil bij de check-in ergens kunnen melden als ik gewoon griep heb,
// zonder dat er gelijk wordt gedacht dat het PEM is of door long covid
// komt."
//
// Dezelfde fout als eerder met migraine, en net zo gegrond. Een infectie
// geeft precies de signalen waar het PEM-oordeel op let: grieperig
// gevoel, rillingen, koorts, hersenmist, een hoge rusthartslag. Maar de
// oorzaak is een virus en niet de training van eergisteren. Zonder dat
// onderscheid telt een week griep als bewijs dat haar opbouw te zwaar
// was, breekt het haar PEM-vrije reeks, en wordt haar schema teruggezet
// voor iets wat met hardlopen niets te maken had.
//
// Deze suite bewaakt drie dingen, en de derde is de belangrijkste:
//
//   · een gemelde infectie telt niet mee in het inspanningsoordeel;
//   · en breekt haar PEM-vrije reeks niet;
//   · maar geeft trainen óók niet vrij, en zet de rode vlaggen niet uit.
//     Ziek is ziek. Als dit een uitweg werd om door te trainen, had ik
//     iets gevaarlijkers gebouwd dan wat er stond.
import './_storage-stub.js';
import { exertionalResponse, pemFreeWeeks, readSymptoms, INFECTION_TYPES,
  RED_FLAG_IDS } from '../../src/symptoms.js';
import { restDayDecision } from '../../src/restday.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

function wereld(logs, { run = '2026-11-09' } = {}) {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'w1', date: run, duration: 30, distance: 3.2, activityType: 'run',
      laps: [{ movingTime: 600, distance: 1100, avgHr: 140 }] },
  ]));
  for (const [d, v] of Object.entries(logs)) {
    localStorage.setItem(`gc_log_${d}`, JSON.stringify({ date: d, ...v }));
  }
  const uit = {};
  for (const [d, v] of Object.entries(logs)) uit[d] = { date: d, ...v };
  return uit;
}

S('1 · Het veld wordt gelezen');
{
  ok('een gemelde griep wordt herkend',
    readSymptoms({ infection_type: 'flu' }).infection.present === true, '');
  ok('"geen" telt niet als infectie',
    readSymptoms({ infection_type: 'none' }).infection.present === false, '');
  ok('en een los vinkje uit een oudere versie ook',
    readSymptoms({ infection: true }).infection.present === true, '');
  ok('er zijn soorten om uit te kiezen', INFECTION_TYPES.length >= 4,
    String(INFECTION_TYPES.length));
}

S('2 · Griepklachten na een loop tellen niet als PEM');
{
  // Zonder de melding: grieperig gevoel plus hoofdpijn na een sessie is
  // een duidelijke post-exertionele reactie, en dat hoort ook zo.
  const zonder = wereld({
    '2026-11-09': { run_done: true },
    '2026-11-10': { headache_severity: 2, pe_malaise: true, pe_chills: true },
  });
  const a = exertionalResponse({ workoutDate: '2026-11-09', logs: zonder, currentDate: TODAY });
  console.log(`      zonder melding: ${a.status} — ${a.reason.slice(0, 70)}`);
  ok('zonder melding is dit een slechte respons', a.status === 'poor', a.status);
  ok('en mag er niet opgebouwd worden', a.allowsBuild === false, String(a.allowsBuild));

  // Mét de melding: dezelfde klachten, andere conclusie.
  const met = wereld({
    '2026-11-09': { run_done: true },
    '2026-11-10': { headache_severity: 2, pe_malaise: true, pe_chills: true,
      infection_type: 'flu' },
  });
  const b = exertionalResponse({ workoutDate: '2026-11-09', logs: met, currentDate: TODAY });
  console.log(`      mét melding:   ${b.status} — ${b.reason.slice(0, 70)}`);
  ok('met de melding is het geen slechte respons meer', b.status !== 'poor', b.status);
  ok('de infectie staat wel vermeld', !!b.infectionNote, String(b.infectionNote));
  ok('en de uitleg zegt dat het niets over haar belastbaarheid zegt',
    /belastbaarheid/.test(b.infectionNote || ''), b.infectionNote);
  ok('met erbij dat trainen toch dicht blijft',
    /dicht tot je beter bent/.test(b.infectionNote || ''), b.infectionNote);
}

S('3 · Maar rode vlaggen blijven rood, ook bij griep');
{
  // Dit is de grens. Borstklachten of neurologische alarmsymptomen zijn
  // nooit "gewoon de griep" — als die hier zouden wegvallen, had ik een
  // uitweg gebouwd in plaats van een onderscheid.
  const logs = wereld({
    '2026-11-09': { run_done: true },
    '2026-11-10': { infection_type: 'flu', pe_chest: true },
  });
  const r = exertionalResponse({ workoutDate: '2026-11-09', logs, currentDate: TODAY });
  console.log(`      borstklachten bij griep → ${r.status}`);
  ok('borstklachten blijven een rode vlag', r.status === 'red' || r.level === 'RED',
    `${r.status} / ${r.level}`);
  ok('borstklachten staan ook echt in de lijst rode vlaggen',
    RED_FLAG_IDS.includes('chest') && RED_FLAG_IDS.includes('neuro'),
    JSON.stringify(RED_FLAG_IDS));
}

S('4 · De PEM-vrije reeks blijft staan');
{
  const zonder = {};
  const met = {};
  for (let i = 0; i < 40; i++) {
    const d = addDays(TODAY, -i);
    zonder[d] = { date: d }; met[d] = { date: d };
  }
  // Een loop, en de dag erna griepklachten.
  zonder['2026-11-09'] = { date: '2026-11-09', run_done: true };
  met['2026-11-09'] = { date: '2026-11-09', run_done: true };
  zonder['2026-11-10'] = { date: '2026-11-10', recovery_check: 'bad', headache_severity: 2 };
  met['2026-11-10'] = { date: '2026-11-10', recovery_check: 'bad', headache_severity: 2,
    infection_type: 'flu' };

  globalThis.__testStorage.reset();
  localStorage.setItem('gc_workouts', JSON.stringify([
    { id: 'w', date: '2026-11-09', duration: 30, distance: 3, activityType: 'run' }]));
  const a = pemFreeWeeks({ logs: zonder, currentDate: TODAY });
  const b = pemFreeWeeks({ logs: met, currentDate: TODAY });
  console.log(`      zonder melding ${a.weeks} weken · met melding ${b.weeks} weken`);
  ok('zonder melding wordt de reeks gebroken', a.weeks === 0, String(a.weeks));
  ok('met de melding blijft de reeks staan', b.weeks > 0, String(b.weeks));

  // Haar eigen PEM-vinkje blijft wél gelden, ook op een ziektedag. Dat is
  // een oordeel van haar, geen afgeleide van een klacht.
  const eigen = { ...met };
  eigen['2026-11-10'] = { ...met['2026-11-10'], symptom_pem: true };
  ok('haar eigen PEM-vinkje telt ook tijdens griep',
    pemFreeWeeks({ logs: eigen, currentDate: TODAY }).weeks === 0,
    String(pemFreeWeeks({ logs: eigen, currentDate: TODAY }).weeks));
}

S('5 · Ziek geeft trainen niet vrij');
{
  const logs = wereld({
    '2026-11-11': { infection_type: 'flu', pe_malaise: true },
    '2026-11-09': { run_done: true },
  }, { run: '2026-11-09' });
  const g = restDayDecision({ log: logs[TODAY], logs, currentDate: TODAY });
  console.log(`      poort: ${g.action}`);
  ok('de poort blijft dicht', g.action !== 'RUN_TODAY', g.action);
  ok('en de reden gaat over ziek zijn, niet over opbouw',
    /grieperig|ziek/i.test(g.blockers.join(' ')), g.blockers.join(' | '));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
