// "Waarom staat er dat mn loop slecht werd verdragen? Dat is helemaal
// niet zo, waar kan ik dat aanpassen?"
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// Haar run van 17 november kwam eruit als "slecht verdragen". Op die dag
// had zij hoofdpijn aangevinkt en als oorzaak "cyclus" en "migraine"
// gekozen. De ochtend erna vulde ze ernst 0 in en klikte "goed hersteld".
//
// Drie dingen gingen daar tegelijk mis, en ze versterkten elkaar:
//
//   1. Een aangevinkt vakje "hoofdpijn" werd ernst 2 — "duidelijk" —
//      omdat de code dat getal invulde waar zij niets had ingevuld. Ernst
//      2 is precies de drempel waarboven hoofdpijn in zijn eentje genoeg
//      is voor "slecht verdragen".
//   2. Haar eigen duiding werd niet gelezen. Het lichaamsscherm zegt
//      letterlijk "Jouw lezing weegt zwaar mee — niet elke moeie dag is
//      post-exertioneel", en schrijft dat naar `feeling_causes`. Die
//      werd alleen in pese.js gelezen, niet in het PEM-oordeel. Dus
//      telde een hoofdpijn die zij zelf aan migraine toeschreef gewoon
//      mee als reactie op haar training.
//   3. En nergens stond waar het vandaan kwam, dus viel het niet na te
//      trekken en dus ook niet te weerleggen. Dat was haar vraag.
//
// Dit is dezelfde fout als eerder met kracht: één bron lezen waar er meer
// zijn, en haar dan vertellen dat iets zo is terwijl zij het tegendeel
// heeft ingevuld.
import './_storage-stub.js';
import { readSymptoms, exertionalResponse } from '../../src/symptoms.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 260) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const RUN = '2026-11-17';
const NA1 = '2026-11-18';
const NU = '2026-11-19';

S('1 · Een vinkje is geen ernstscore');
{
  // Alleen "ik had hoofdpijn", zonder dat ze een ernst koos.
  const alleenVinkje = readSymptoms({ date: RUN, symptom_headache: true });
  console.log(`      vinkje → ernst ${alleenVinkje.headache.severity}`);
  ok('een kaal vinkje geldt als licht, niet als duidelijk',
    alleenVinkje.headache.severity === 1, String(alleenVinkje.headache.severity));
  ok('maar het telt wel als aanwezig', alleenVinkje.headache.present === true, '');

  // Vult ze wél een ernst in, dan telt die onverkort. Hoofdpijn is bij
  // haar de vroegste en betrouwbaarste marker; die mag niet verwateren.
  ok('een ingevulde ernst blijft staan zoals ingevuld',
    readSymptoms({ headache_severity: 2 }).headache.severity === 2, '');
  ok('ook een forse', readSymptoms({ headache_severity: 3 }).headache.severity === 3, '');
  ok('en een ingevulde nul betekent geen hoofdpijn',
    readSymptoms({ headache_severity: 0 }).headache.present === false, '');
}

S('2 · Haar eigen duiding wordt gelezen');
{
  const log = { date: RUN, symptom_headache: true, feeling_causes: ['cyclus', 'migraine'] };
  const s = readSymptoms(log);
  console.log(`      oorzaken: ${s.causes.join(', ')}`);
  ok('de gekozen oorzaken staan erin', s.causes.includes('migraine'), JSON.stringify(s.causes));
  // Dit is de kern: migraine kwam alleen uit een apart veld, en zij had
  // hem via de oorzakenkiezer opgegeven.
  ok('migraine via de oorzakenkiezer telt als migraine',
    s.migraine.present === true, JSON.stringify(s.migraine));
  ok('en ziek via diezelfde kiezer telt als infectie',
    readSymptoms({ feeling_causes: ['ziek'] }).infection.present === true, '');
  ok('cyclus maakt er geen migraine van',
    readSymptoms({ feeling_causes: ['cyclus'] }).migraine.present === false, '');
  // Kiest ze zelf PEM, dan is dat haar lezing en die telt ook.
  ok('kiest zij zelf PEM, dan staat dat er als zodanig',
    readSymptoms({ feeling_causes: ['pem'] }).zelfPem === true, '');
  ok('het oude losse veld blijft werken',
    readSymptoms({ migraine: true }).migraine.present === true, '');
}

S('3 · Haar run van 17 november');
{
  // Precies wat er in haar dagboek staat.
  const logs = {
    [RUN]: { date: RUN, run_done: true, energy: 2, training_recovery: 0,
      training_legs: 'fris', training_could_more: 'beetje',
      symptom_headache: true, feeling_causes: ['cyclus', 'migraine'] },
    [NA1]: { date: NA1, energy: 2, recovery_check: 'good', headache_severity: 0,
      training_recovery: 0 },
    [NU]: { date: NU, hr_rest: 67, sleep_quality: 2 },
  };
  const r = exertionalResponse({ workoutDate: RUN, logs, currentDate: NU });
  console.log(`      ${r.status}: ${r.reason}`);
  ok('deze run is niet slecht verdragen', r.status !== 'poor', r.status);
  ok('hij is goed verdragen', r.status === 'good', r.status);
  // De migraine verdwijnt niet uit beeld — hij wordt apart gemeld. Een
  // signaal dat stilzwijgend wegvalt is net zo misleidend als een
  // signaal dat verkeerd wordt uitgelegd.
  ok('en de migraine blijft wel zichtbaar',
    /migraine/i.test(r.reason), r.reason);
  ok('met de reden dat hij niet als inspanningsrespons telt',
    /niet als inspanningsrespons|telt niet mee/i.test(r.reason), r.reason);
}

S('4 · Wat écht een slechte respons is, blijft er een');
{
  // De reparatie mag het signaal niet uitzetten. Dit is waar het in 2024
  // misging en waarvoor deze hele laag bestaat.
  const hard = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, headache_severity: 2, headache_timing: 'h6_24' },
  };
  const r = exertionalResponse({ workoutDate: RUN, logs: hard, currentDate: NU });
  console.log(`      ${r.status}: ${String(r.reason).slice(0, 90)}`);
  ok('duidelijke hoofdpijn zonder migraine blijft slecht verdragen',
    r.status === 'poor', r.status);

  // En met migraine erbij telt diezelfde hoofdpijn niet mee — tenzij zij
  // inspanning zelf als trigger aanwees.
  const metTrigger = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, headache_severity: 3, migraine: true,
      migraine_triggers: ['exertion'] },
  };
  const r2 = exertionalResponse({ workoutDate: RUN, logs: metTrigger, currentDate: NU });
  ok('migraine mét inspanning als trigger telt wél mee',
    r2.status !== 'good', `${r2.status} — ${r2.reason}`);

  // En haar eigen duiding telt twee kanten op. Vinkt zij zelf PEM aan,
  // dan is dat doorslaggevend — net zoals "dit was migraine" dat is. Een
  // regel die haar lezing alleen aanneemt wanneer die gunstig uitvalt, is
  // geen regel maar een voorkeur.
  const pem = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, symptom_pem: true, recovery_check: 'bad' },
  };
  const rp = exertionalResponse({ workoutDate: RUN, logs: pem, currentDate: NU });
  ok('een gemeld PEM-signaal is slecht verdragen', rp.status === 'poor', rp.status);

  const viaKiezer = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, feeling_causes: ['pem'] },
  };
  const rk = exertionalResponse({ workoutDate: RUN, logs: viaKiezer, currentDate: NU });
  console.log(`      zelf PEM gekozen → ${rk.status}: ${String(rk.reason).slice(0, 80)}`);
  ok('ook als zij PEM via de oorzakenkiezer aanwijst', rk.status === 'poor', rk.status);
  ok('en de reden zegt dat haar lezing doorslaggevend is',
    /Jouw lezing is hier doorslaggevend/.test(rk.reason), rk.reason);
}

S('5 · En er staat bij waar je het aanpast');
{
  // Haar tweede vraag, en de belangrijkste: een oordeel dat je niet kunt
  // natrekken, kun je ook niet weerleggen.
  const logs = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, headache_severity: 2, headache_timing: 'h6_24' },
  };
  const r = exertionalResponse({ workoutDate: RUN, logs, currentDate: NU });
  console.log(`      ${r.waarAanTePassen}`);
  ok('het oordeel draagt zijn eigen herkomst',
    Array.isArray(r.herkomst) && r.herkomst.length > 0, JSON.stringify(r.herkomst));
  ok('met de datum waarop het is ingevuld',
    r.herkomst.every(h => /^\d{4}-\d{2}-\d{2}$/.test(h.date)), JSON.stringify(r.herkomst));
  ok('en wat er stond', r.herkomst.some(h => /hoofdpijn/.test(h.wat)),
    JSON.stringify(r.herkomst));
  ok('er staat waar je het corrigeert', /Lichaam/.test(r.waarAanTePassen || ''),
    r.waarAanTePassen);
  ok('met beide manieren: ernst op nul, of een oorzaak kiezen',
    /ernst/.test(r.waarAanTePassen) && /oorzaak/.test(r.waarAanTePassen),
    r.waarAanTePassen);
  ok('en die uitleg staat ook in de reden zelf',
    /Lichaam/.test(r.reason), r.reason);

  // Een vinkje zonder ernst wordt apart benoemd: dan weet ze dat het
  // getal niet van haar kwam.
  const vink = {
    [RUN]: { date: RUN, run_done: true },
    [NA1]: { date: NA1, symptom_headache: true, pe_malaise: true, pe_brainfog: true,
      pe_next_day_worse: true },
  };
  const rv = exertionalResponse({ workoutDate: RUN, logs: vink, currentDate: NU });
  ok('een vinkje zonder ernst wordt als zodanig benoemd',
    (rv.herkomst || []).some(h => /alleen aangevinkt/.test(h.wat)),
    JSON.stringify(rv.herkomst));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
