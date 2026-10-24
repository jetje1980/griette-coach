// De 75-dagenuitdaging: telt hij eerlijk, en houdt hij haar lichaam heel?
//
// De regels die hier worden vastgehouden:
//   · een rode dag met de herstelversie is een AFGERONDE dag, geen gemiste;
//   · de teller telt afgeronde dagen van de 75, niet opeenvolgende dagen —
//     een teller die bij één gemiste dag naar nul springt, is de reden dat
//     mensen op dag 35 stoppen;
//   · de foto hoort bij de dag en verdwijnt niet als zij het vinkje weghaalt.
import { startChallenge, loadChallenge, resetChallenge, dayNumber, dateOfDay,
  markDay, unmarkDay, markPhoto, setStartDate, challengeStatus, dailyMessage,
  challengeAsText,
  DONE_KIND } from '../../src/challenge75.js';
import { CHALLENGE, CIRCUIT, CIRCUIT_TOTAL_SECONDS, RECOVERY_VERSION,
  PHASES, phaseForDay, MILESTONES } from '../../src/data/challenge75.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 220) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const START = '2026-10-23';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

let mem = {};
function store(seed = {}) {
  mem = { ...seed };
  globalThis.localStorage = {
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i] ?? null,
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
  };
  globalThis.sessionStorage = globalThis.localStorage;
}

console.log('\n████ 75 dagen, acht minuten ████');

S('1 · Het circuit zelf');
{
  ok('zestien oefeningen', CIRCUIT.length === 16, String(CIRCUIT.length));
  ok('samen acht minuten', CIRCUIT_TOTAL_SECONDS === 480, String(CIRCUIT_TOTAL_SECONDS));
  ok('elke oefening heeft uitvoering, reden en waar je het voelt',
    CIRCUIT.every(o => o.cue?.length > 30 && o.why?.length > 20 && o.felt),
    CIRCUIT.filter(o => !(o.cue?.length > 30 && o.why?.length > 20 && o.felt))
      .map(o => o.id).join(','));
  ok('elke oefening heeft een tijd', CIRCUIT.every(o => o.seconds > 0));
  ok('de herstelversie is korter', RECOVERY_VERSION.reduce((s, o) => s + o.seconds, 0)
    < CIRCUIT_TOTAL_SECONDS);
  ok('de video staat erbij met de waarschuwing dat hij niet nagekeken is',
    /niet nagekeken|reconstructie/.test(CHALLENGE.videoNote), CHALLENGE.videoNote);
  ok('en de link is de hare', CHALLENGE.videoUrl.includes('IEu57_V0OHI'), CHALLENGE.videoUrl);
}

S('2 · De fasen dekken alle 75 dagen');
{
  const gaten = [];
  for (let d = 1; d <= 75; d++) if (!phaseForDay(d)) gaten.push(d);
  ok('elke dag hoort bij een fase', gaten.length === 0, gaten.join(','));
  ok('de fasen sluiten aan zonder overlap',
    PHASES.every((p, i) => i === 0 || p.from === PHASES[i - 1].to + 1),
    PHASES.map(p => `${p.from}-${p.to}`).join(' '));
  ok('fase 1 belooft niets zichtbaars', /nog niet|normaal/.test(PHASES[0].visible),
    PHASES[0].visible);
  ok('en de latere fasen wel, met een voorwaarde',
    PHASES.some(p => /anderen/.test(p.visible)),
    PHASES.map(p => p.visible.slice(0, 40)).join(' | '));
  ok('dag 75 heeft een mijlpaal', !!MILESTONES[75], MILESTONES[75]);
}

S('3 · Starten en tellen');
{
  store();
  ok('zonder start geen stand', challengeStatus({ currentDate: START }).active === false);
  startChallenge({ startDate: START });
  ok('dag 1 is de startdag', dayNumber(START) === 1, String(dayNumber(START)));
  ok('dag 75 is 74 dagen later', dateOfDay(75) === addDays(START, 74), dateOfDay(75));
  ok('opnieuw starten verandert de startdatum niet',
    startChallenge({ startDate: '2026-11-01' }).startDate === START,
    loadChallenge().startDate);
  const st = challengeStatus({ currentDate: START });
  ok('de stand staat op dag 1 van 75', st.day === 1 && st.totalDays === 75,
    `${st.day}/${st.totalDays}`);
  ok('nog niets gedaan', st.doneCount === 0 && !st.doneToday);
}

S('4 · Afvinken, en wat er dan te horen is');
{
  store();
  startChallenge({ startDate: START });
  markDay(START, { kind: DONE_KIND.CIRCUIT });
  const st = challengeStatus({ currentDate: START });
  ok('de dag is afgerond', st.doneToday && st.doneCount === 1);
  const b = dailyMessage({ currentDate: START });
  ok('er is een bericht', b.lines.length >= 3, JSON.stringify(b.lines).slice(0, 120));
  ok('het noemt de mijlpaal van dag 1', /Dag 1/.test(b.lines[0]), b.lines[0]);
  // De fase van week 1 legt het mechanisme uit; de test toetst dát er een
  // mechanisme staat en niet welk woord ik toevallig koos.
  ok('het vertelt wat er nu gebeurt in haar lichaam',
    /hersenen leren|zenuwstelsel/.test(b.lines.join(' ')),
    b.lines.join(' ').slice(0, 160));
  ok('en het belooft niets zichtbaars op dag 1',
    !/strakker|getonder|zichtbaar resultaat/.test(b.lines.join(' '))
      || /nog niet/.test(b.lines.join(' ')), b.lines.join(' ').slice(0, 200));
  ok('er wordt om een foto gevraagd', b.photoAsked === true);
}

S('5 · Een rode dag telt volwaardig mee');
{
  store();
  startChallenge({ startDate: START });
  const dag3 = addDays(START, 2);
  markDay(dag3, { kind: DONE_KIND.RECOVERY });
  const st = challengeStatus({ currentDate: dag3 });
  ok('de hersteldag is een afgeronde dag', st.doneToday && st.doneCount === 1,
    `${st.doneCount}`);
  ok('en wordt als hersteldag geteld', st.recoveryCount === 1, String(st.recoveryCount));
  const b = dailyMessage({ currentDate: dag3 });
  ok('het bericht zegt dat die volwaardig meetelt',
    /volwaardig/.test(b.lines.join(' ')), b.lines.join(' ').slice(0, 200));
  ok('en presenteert rust niet als uitzondering',
    /rust op een rode dag is geen uitzondering/i.test(b.lines.join(' ')),
    b.lines.join(' ').slice(-160));
}

S('6 · Een gemiste dag zet de teller niet op nul');
{
  store();
  startChallenge({ startDate: START });
  for (const i of [0, 1, 2, 3, 5]) markDay(addDays(START, i), { kind: DONE_KIND.CIRCUIT });
  const st = challengeStatus({ currentDate: addDays(START, 5) });
  ok('vijf dagen gedaan ondanks de overgeslagen dag', st.doneCount === 5,
    String(st.doneCount));
  ok('de voortgang rekent met afgeronde dagen', st.completionPct === Math.round(5 / 6 * 100),
    `${st.completionPct}%`);
  ok('de reeks-op-rij is informatief en klopt', st.streak === 1, String(st.streak));
  ok('maar de uitdaging loopt gewoon door', st.active && !st.finished);
}

S('7 · De foto hoort bij de dag, niet bij het vinkje');
{
  store();
  startChallenge({ startDate: START });
  markPhoto(START, { type: 'front', photoId: 'p1' });
  ok('de foto is vastgelegd', challengeStatus({ currentDate: START }).photoToday);
  markDay(START, { kind: DONE_KIND.CIRCUIT });
  ok('afvinken wist de foto niet', challengeStatus({ currentDate: START }).photoToday);
  unmarkDay(START);
  const st = challengeStatus({ currentDate: START });
  ok('het vinkje is weg', !st.doneToday);
  ok('maar de foto staat er nog', st.photoToday, JSON.stringify(loadChallenge().days));
}

S('8 · Racedagen en tweede workouts');
{
  store();
  startChallenge({ startDate: START });
  markDay(START, { kind: DONE_KIND.RACE });
  ok('een racedag rondt de dag af', challengeStatus({ currentDate: START }).doneToday);
  const dag2 = addDays(START, 1);
  markDay(dag2, { kind: DONE_KIND.EXTRA, secondWorkout: '20 min lower body' });
  const st = challengeStatus({ currentDate: dag2 });
  ok('een tweede workout wordt geteld', st.extraCount === 1, String(st.extraCount));
  ok('en de tweede workout is bewaard',
    loadChallenge().days[dag2].secondWorkout === '20 min lower body',
    JSON.stringify(loadChallenge().days[dag2]));
  const b = dailyMessage({ currentDate: dag2 });
  ok('met de waarschuwing over twee prikkels op één dag',
    /herstelcheck morgen/.test(b.lines.join(' ')), b.lines.join(' ').slice(-180));
}

S('9 · Na dag 75');
{
  store();
  startChallenge({ startDate: START });
  const na = addDays(START, 80);
  const st = challengeStatus({ currentDate: na });
  ok('de uitdaging is afgelopen', st.finished === true);
  ok('en blijft op dag 75 staan', st.day === 75, String(st.day));
  ok('met nul resterende dagen', st.remaining === 0, String(st.remaining));
}

S('10 · De coachprompt krijgt de regels mee');
{
  store();
  startChallenge({ startDate: START });
  markDay(START, { kind: DONE_KIND.CIRCUIT });
  const t = challengeAsText({ currentDate: START });
  ok('er staat een blok in de prompt', !!t && /75-DAGENUITDAGING/.test(t), String(t).slice(0, 80));
  ok('met de stand', /dag 1 van 75/.test(t), t.split('\n')[1]);
  ok('en de regel dat een hersteldag een afgeronde dag is',
    /herstelversie is een afgeronde dag/.test(t), t.slice(-300));
  ok('plus de regel dat een gemiste dag niet wordt afgerekend',
    /reken.*gemiste dag niet af/s.test(t), t.slice(-300));
  store();
  ok('niet gestart betekent geen blok', challengeAsText({ currentDate: START }) === null);
}

S('De startdatum alsnog goedzetten');
{
  // WAT ER MIS WAS
  //
  // De uitdaging werd aangezet om twee uur 's nachts: technisch zaterdag,
  // voor haar nog vrijdagavond. Haar dag 1 werd daarmee een dag
  // opgeschoven, en de teller klopte vanaf dag één niet meer met wat zij
  // meemaakte. Zonder correctie kijk je 75 dagen naar een fout getal.
  store();
  startChallenge({ startDate: '2026-10-24' });
  markDay('2026-10-24', { kind: DONE_KIND.CIRCUIT });
  markPhoto('2026-10-24', { type: 'dag', photoId: 'p1' });
  ok('voor de correctie is 24 oktober dag 1',
    dayNumber('2026-10-24') === 1, String(dayNumber('2026-10-24')));

  const na = setStartDate('2026-10-23');
  ok('de startdatum is verzet', na.startDate === '2026-10-23', na.startDate);
  ok('24 oktober is nu dag 2', dayNumber('2026-10-24') === 2,
    String(dayNumber('2026-10-24')));
  ok('en 23 oktober is dag 1', dayNumber('2026-10-23') === 1,
    String(dayNumber('2026-10-23')));
  ok('het afvinken blijft op zijn eigen datum staan',
    na.days['2026-10-24']?.kind === DONE_KIND.CIRCUIT,
    JSON.stringify(na.days));
  ok('maar het dagnummer schuift mee', na.days['2026-10-24']?.day === 2,
    String(na.days['2026-10-24']?.day));
  ok('de foto blijft bij diezelfde dag', !!na.days['2026-10-24']?.photo);
  ok('niets viel buiten het venster', na.buitenVenster === 0,
    String(na.buitenVenster));

  const st = challengeStatus({ currentDate: '2026-10-24' });
  ok('de stand telt vandaag als dag 2', st.day === 2, String(st.day));
  ok('en één afgeronde dag', st.doneCount === 1, String(st.doneCount));
  ok('de einddatum schuift mee', st.endDate === addDays('2026-10-23', 74),
    st.endDate);

  // Een verschuiving die werk buiten het venster duwt, moet dat melden en
  // niet stilletjes weggooien.
  const ver = setStartDate('2026-01-01');
  ok('een te grote verschuiving meldt wat erbuiten valt', ver.buitenVenster === 1,
    String(ver.buitenVenster));
  ok('en gooit de dag niet weg', !!ver.days['2026-10-24'],
    JSON.stringify(Object.keys(ver.days)));

  // En terug: de correctie is omkeerbaar.
  const terug = setStartDate('2026-10-23');
  ok('teruggezet klopt alles weer', terug.days['2026-10-24']?.day === 2
    && terug.buitenVenster === 0, JSON.stringify(terug.days));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
