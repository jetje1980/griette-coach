// Doel naast uitkomst, per training — en wat er daarna moet veranderen.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Ik wil dat er een tabel komt per training met doel hartslag en tempo en
// wat mijn hartslag en tempo was in die training. En geef per volgende
// training aan wat er aangepast moet worden om dat doel van 35 min
// Ameland te halen."
//
// ─────────────────────────────────────────────────────────────────
// WAT DEZE SUITE BEWAAKT
//
// Niet of de tabel vol staat, maar of hij eerlijk is. Vier dingen, en de
// eerste is de belangrijkste:
//
//   · het doel van een voorbije dag wordt gereconstrueerd met de gegevens
//     van vóór die dag. Reken je met de gegevens van vandaag, dan
//     vergelijk je haar prestatie met een lat die achteraf is verlegd —
//     en dan "haalt" ze doelen die op die dag nog niet bestonden, of
//     faalt ze tegen doelen die ze nooit heeft gezien;
//   · het oordeel gaat over de hartslag, niet over het tempo. Snel
//     lopen bóven de band is geen geslaagde sessie;
//   · een onbetrouwbare meting telt niet mee in het patroon. Zij meet met
//     een optische Garmin en geen band; een hartslag die wegvalt mag geen
//     "topdag" worden en ook geen "te hard";
//   · en de bijsturing citeert de tabel die ernaast staat. Twee vensters
//     voor dezelfde vraag is hoe dit project al een paar keer in
//     tegenspraak met zichzelf is geraakt.
import './_storage-stub.js';
import { sessieTabel, sessieRij, volledigeTabel, bijsturing, HR_MARGE, TABEL_AANTAL }
  from '../../src/sessieVergelijking.js';
import { racePlan } from '../../src/racePlanDays.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 240) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

const TODAY = '2026-11-11';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

// Een loopblok van tien minuten op een gegeven efficiëntie en hartslag.
// ef = meter per minuut gedeeld door hartslag, dus meters = ef * hr * min.
//
// LET OP bij het kiezen van ef en hr: ef * hr is meters per minuut, en
// onder MIN_METER_PER_MIN (95) rekent de app het als wandelen en valt het
// blok weg. Een fixture met ef 0,70 op hartslag 132 haalt 92 m/min en
// levert dus géén meetbare sessie op — dat is geen bug maar de
// ondergrens die voorkomt dat een strandwandeling als loopblok telt.
const blok = (ef, hr, min = 10) => ({
  movingTime: min * 60, distance: ef * hr * min, avgHr: hr,
});
const run = (date, ef, hr, { blokken = 2, min = 10 } = {}) => ({
  id: date, date, activityType: 'run', duration: blokken * min + 5,
  distance: (ef * hr * min * blokken) / 1000,
  laps: Array.from({ length: blokken }, () => blok(ef, hr, min)),
});

function wereld(workouts, { logs = null } = {}) {
  globalThis.__testStorage.reset();
  localStorage.setItem('gc_hr_settings', JSON.stringify({ easyLow: 106, easyHigh: 145,
    resumeBelow: 105, walkTrigger: 150 }));
  localStorage.setItem('gc_workouts', JSON.stringify(workouts));
  localStorage.setItem('gc_strength_sessions', JSON.stringify([]));
  localStorage.setItem('gc_challenge75', JSON.stringify({ days: {} }));
  const L = logs || {};
  if (!logs) {
    for (let i = 60; i >= 0; i--) {
      const d = addDays(TODAY, -i);
      L[d] = { date: d, hr_rest: 61, sleep_hours: 7.5 };
    }
  }
  for (const [d, l] of Object.entries(L)) localStorage.setItem(`gc_log_${d}`, JSON.stringify(l));
  return L;
}

S('1 · Elke training staat erin met doel én uitkomst');
{
  // Zes sessies op dezelfde efficiëntie, allemaal ruim boven de easy-band.
  const W = [-30, -26, -22, -18, -14, -10, -6, -2].map(n => run(addDays(TODAY, n), 0.72, 148));
  const logs = wereld(W);
  const t = sessieTabel({ currentDate: TODAY, logs });
  console.log(`      ${t.rows.length} rijen, ${t.bruikbaar} bruikbaar`);
  ok('elke training is een rij', t.rows.length === W.length, String(t.rows.length));
  ok('met een doelhartslag', t.rows.every(r => r.doelHr > 0), '');
  ok('en de werkelijke hartslag ernaast',
    t.rows.every(r => r.echteHr === 148), JSON.stringify(t.rows.map(r => r.echteHr)));
  ok('en het werkelijke tempo', t.rows.every(r => r.echtTempo > 0), '');
  ok('met het verschil er los bij',
    t.rows.every(r => Number.isFinite(r.hrDelta)), '');
  // Het loopblok apart van de sessieduur: "35 min" inclusief wandelen zegt
  // niets over belasting. Dit onderscheid is eerder stukgelopen op een
  // strandwandeling die als loopblok werd gelezen.
  ok('en het gemeten loopblok, niet de sessieduur',
    t.rows.every(r => Math.abs(r.blokMin - 20) < 0.2), JSON.stringify(t.rows.map(r => r.blokMin)));
  ok('de tabel toont standaard tien trainingen', TABEL_AANTAL === 10, String(TABEL_AANTAL));
}

S('2 · Het doel van toen, niet de lat van vandaag');
{
  // DE KERNTEST. Dezelfde dag, twee keer beoordeeld: één keer in een
  // wereld waarin er daarna niets meer gebeurde, en één keer in een
  // wereld waarin zij daarna drie veel betere sessies liep.
  const dag = addDays(TODAY, -20);
  const basis = [-32, -28, -24].map(n => run(addDays(TODAY, n), 0.70, 140));
  const die = run(dag, 0.70, 140);

  const logsA = wereld([...basis, die]);
  const a = sessieRij(die, { logs: logsA, workouts: [...basis, die] });

  const later = [-12, -8, -4].map(n => run(addDays(TODAY, n), 0.84, 140));
  const logsB = wereld([...basis, die, ...later]);
  const b = sessieRij(die, { logs: logsB, workouts: [...basis, die, ...later] });

  console.log(`      doel op ${dag}: ${a.doelTempo} zonder latere sessies, `
    + `${b.doelTempo} met drie betere erna`);
  ok('het doel van die dag is in beide werelden hetzelfde',
    a.doelTempo === b.doelTempo, `${a.doelTempo} vs ${b.doelTempo}`);
  ok('en de uitkomst natuurlijk ook',
    a.echteHr === b.echteHr && a.echtTempo === b.echtTempo, '');
  // Zonder deze regel zou haar sessie van 18 oktober vandaag worden
  // afgerekend op een doel dat uit november komt.
  ok('het oordeel verschuift dus niet achteraf', a.oordeel === b.oordeel,
    `${a.oordeel} vs ${b.oordeel}`);
}

S('3 · Het oordeel gaat over hartslag, niet over tempo');
{
  const W = [-24, -20, -16, -12, -8].map(n => run(addDays(TODAY, n), 0.74, 132));
  // Een snelle sessie, maar ruim boven de band: hoger tempo omdat de
  // hartslag hoger is, niet omdat ze economischer liep.
  const hard = run(addDays(TODAY, -4), 0.70, 152);
  const logs = wereld([...W, hard]);
  const r = sessieRij(hard, { logs, workouts: [...W, hard] });
  console.log(`      ${r.echtTempo} min/km op hartslag ${r.echteHr} → ${r.oordeel}`);
  ok('sneller dan het doel maar boven de band heet "te hard"',
    r.teHard && r.oordeel === 'te hard', `${r.oordeel} · Δhr ${r.hrDelta}`);
  ok('en de uitleg zegt waarom tempo hier geen prestatie is',
    /geen prestatie maar het gevolg/.test(r.uitleg), r.uitleg);

  // En andersom: binnen de band is binnen de band, ook als het tempo
  // achterblijft. Dat is wat zij doet als ze het goed doet.
  const braaf = run(addDays(TODAY, -3), 0.74, 130);
  const logs2 = wereld([...W, braaf]);
  const r2 = sessieRij(braaf, { logs: logs2, workouts: [...W, braaf] });
  ok('trager dan het doel maar binnen de band is niet "te hard"',
    !r2.teHard && r2.oordeel === 'binnen de band', `${r2.oordeel} · Δhr ${r2.hrDelta}`);
  ok('een afwijking binnen de marge geldt als binnen de band',
    sessieRij(run(addDays(TODAY, -3), 0.74, 132 + HR_MARGE),
      { logs: logs2, workouts: W }).teHard === false, '');
}

S('4 · Wat niet te meten is, wordt niet geraden');
{
  // Een sessie zonder loopblok van vijf minuten: wandelen, of een paar
  // korte stukjes. Daar is geen loopeconomie uit te lezen.
  const kort = { id: 'k', date: addDays(TODAY, -5), activityType: 'run', duration: 30,
    laps: [{ movingTime: 120, distance: 200, avgHr: 120 }] };
  const W = [-24, -20, -16].map(n => run(addDays(TODAY, n), 0.74, 132));
  const logs = wereld([...W, kort]);
  const r = sessieRij(kort, { logs, workouts: [...W, kort] });
  ok('een sessie zonder meetbaar blok staat er als onmeetbaar',
    r.known === false && /vijf minuten/.test(r.why), JSON.stringify(r));

  // En een doel dat er op die datum nog niet was, krijgt een reden mee in
  // plaats van een leeg vakje. Een gat dat niets zegt, leest als een fout.
  const eerste = run(addDays(TODAY, -40), 0.74, 132);
  const logs2 = wereld([eerste]);
  const r2 = sessieRij(eerste, { logs: logs2, workouts: [eerste] });
  ok('een ontbrekend doeltempo draagt zijn eigen reden',
    r2.doelTempo == null && !!r2.doelTempoWhy, JSON.stringify([r2.doelTempo, r2.doelTempoWhy]));
  ok('en de werkelijke waarden staan er wél',
    r2.echteHr === 132 && r2.echtTempo > 0, JSON.stringify([r2.echteHr, r2.echtTempo]));
}

S('5 · Een weggevallen hartslagmeting is geen topdag en geen uitspatting');
{
  // Zij meet met een optische Garmin en gebruikt nooit een band. Valt die
  // meter weg, dan zakt de hartslag terwijl het tempo staat — en dat ziet
  // eruit als de beste sessie van het jaar.
  const W = [-24, -20, -16, -12].map(n => run(addDays(TODAY, n), 0.70, 150));
  const raar = { id: 'r', date: addDays(TODAY, -6), activityType: 'run', duration: 40,
    distance: 4, laps: [blok(0.70, 150), blok(0.78, 135), blok(0.90, 117)] };
  const logs = wereld([...W, raar]);
  const r = sessieRij(raar, { logs, workouts: [...W, raar] });
  console.log(`      ${r.oordeel}: ${String(r.uitleg).slice(0, 70)}…`);
  ok('de meting wordt als onbetrouwbaar gemarkeerd',
    r.hrSuspect && r.oordeel === 'meting onbetrouwbaar', r.oordeel);
  ok('en de uitleg wijst de meter aan, niet haar vorm',
    /band die loslaat|optische meter/.test(r.uitleg), r.uitleg);

  const t = sessieTabel({ currentDate: TODAY, logs });
  ok('hij telt niet mee in het patroon',
    t.bruikbaar === W.length, `${t.bruikbaar} van ${t.rows.length}`);
  ok('maar hij staat wel in de tabel',
    t.rows.some(x => x.date === raar.date), '');
}

S('5b · Een uitbijter telt in de tabel net zomin mee als in de trend');
{
  // De trendmotor gooit sessies weg die te ver van de mediaan liggen —
  // die bepalen haar doeltempo niet. Noemt de tabel zo'n sessie dan
  // "goed", dan staan er twee oordelen over één training in één app.
  // Haar sessie van 4 oktober is precies zo'n geval: hartslag 125 bij
  // 7:53/km, efficiëntie 1,02 tegen een reeks rond 0,72.
  const W = [-26, -22, -18, -14, -10].map(n => run(addDays(TODAY, n), 0.72, 145));
  const raar = run(addDays(TODAY, -6), 1.02, 125);
  const logs = wereld([...W, raar]);
  const t = sessieTabel({ currentDate: TODAY, logs });
  const rij = t.rows.find(r => r.date === raar.date);
  console.log(`      ${rij.date}: ef ${rij.ef} → ${rij.oordeel}`);
  ok('de tabel markeert hem als niet meetellend',
    rij.uitbijter === true && rij.oordeel === 'telt niet mee', rij.oordeel);
  ok('en zegt erbij dat dat niet "slecht" betekent',
    /niet hetzelfde als een slechte sessie/.test(rij.uitleg), rij.uitleg);
  ok('de gemeten waarden blijven gewoon staan',
    rij.echteHr === 125 && rij.echtTempo > 0, JSON.stringify([rij.echteHr, rij.echtTempo]));
  ok('maar hij telt niet mee in het patroon',
    t.bruikbaar === W.length, `${t.bruikbaar} van ${t.rows.length}`);

  // En een gewone sessie blijft gewoon beoordeeld worden.
  ok('de andere sessies houden hun oordeel',
    t.rows.filter(r => r.date !== raar.date).every(r => !r.uitbijter), '');
}

S('6 · Het patroon over de rijen heen');
{
  const W = [-26, -22, -18, -14, -10, -6].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  const t = sessieTabel({ currentDate: TODAY, logs });
  console.log(`      ${t.samenvatting}`);
  ok('structureel te hard wordt een patroon genoemd', t.patroon === true, '');
  ok('met het mediane overschot erbij', t.overschot >= 10, String(t.overschot));
  ok('en de samenvatting noemt het geen incident',
    /geen incident maar hoe je traint/.test(t.samenvatting), t.samenvatting);

  // Eén slechte dag is geen gewoonte.
  const braaf = [-26, -22, -18, -14, -10].map(n => run(addDays(TODAY, n), 0.74, 130));
  const logs2 = wereld([...braaf, run(addDays(TODAY, -6), 0.72, 150)]);
  const t2 = sessieTabel({ currentDate: TODAY, logs: logs2 });
  ok('één uitschieter tussen vijf goede is geen patroon', t2.patroon === false,
    `${t2.teHard} van ${t2.bruikbaar}`);
  ok('en dat staat ook niet in de samenvatting',
    !/geen incident/.test(t2.samenvatting), t2.samenvatting);
}

S('7 · De bijsturing zet hartslag vooraan, en citeert de tabel');
{
  const W = [-26, -22, -18, -14, -10, -6].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  const dagen = [
    { date: TODAY, dayShort: 'wo', role: 'easy',
      run: { description: 'rustig', hr: 'Mik op 106–132 bpm', paceMin: 10.2, blockMin: 12 } },
    { date: addDays(TODAY, 1), dayShort: 'do', role: 'sleutel',
      run: { description: 'sleutel', hr: 'Mik op 106–132 bpm', paceMin: 10.1, blockMin: 10 } },
  ];
  const tabel = sessieTabel({ currentDate: TODAY, logs });
  const b = bijsturing({ currentDate: TODAY, dagen, logs, tabel,
    targetSec: 2100, distanceKm: 5, terrain: 'trail', hrCap: 145 });
  console.log(`      knoppen: ${b.items.map(i => i.knop).join(', ')}`);
  ok('elke aanstaande training krijgt een aanpassing', b.items.length === 2, '');
  ok('en de knop is de hartslag', b.items.every(i => i.knop === 'hartslag'),
    JSON.stringify(b.items.map(i => i.knop)));
  // Dit is de regel die een tegenspraak op één scherm voorkomt.
  ok('de onderbouwing citeert exact de getallen uit de tabel ernaast',
    b.items[0].waarom.includes(`${tabel.bruikbaar} meetbare sessies`)
    && b.items[0].waarom.includes(`${tabel.overschot} slagen`), b.items[0].waarom);
  ok('de onderbouwing staat één keer, niet bij elke rij opnieuw',
    !!b.items[0].waarom && b.items[1].waarom === null, '');
  ok('maar elke rij heeft zijn eigen doeltempo in de korte vorm',
    b.items[0].aanpassing !== b.items[1].aanpassing,
    JSON.stringify(b.items.map(i => i.aanpassing)));
  ok('en elke rij noemt de doelhartslag', b.items.every(i => i.doelHr === 132),
    JSON.stringify(b.items.map(i => i.doelHr)));
}

S('8 · Pas als de hartslag klopt, komen de andere knoppen');
{
  // Vijf brave sessies: hartslag is niet meer de bindende beperking. Dan
  // hoort de volgende knop te verschijnen — en niet eerder, want meer
  // volume op een prikkel die niet aanslaat is weggegooid werk.
  const W = [-26, -22, -18, -14, -10].map(n => run(addDays(TODAY, n), 0.76, 128));
  const logs = wereld(W);
  const dagen = [{ date: TODAY, dayShort: 'wo', role: 'easy',
    run: { description: 'rustig', hr: 'Mik op 106–132 bpm', paceMin: 10.2, blockMin: 12 } }];

  const weinig = bijsturing({ currentDate: TODAY, dagen, logs, runDagenPerWeek: 1.7,
    targetSec: 2100, distanceKm: 5, terrain: 'trail' });
  ok('te weinig loopdagen wordt de knop', weinig.items[0].knop === 'frequentie',
    weinig.items[0].knop);
  ok('met haar werkelijke frequentie erin',
    /1\.7 keer per week/.test(weinig.items[0].waarom), weinig.items[0].waarom);

  // Frequentie op orde, maar een blok dat langer is dan ze ooit liep.
  const lang = [{ ...dagen[0], run: { ...dagen[0].run, blockMin: 45 } }];
  const b2 = bijsturing({ currentDate: TODAY, dagen: lang, logs, runDagenPerWeek: 3.5,
    targetSec: 2100, distanceKm: 5, terrain: 'trail' });
  ok('een blok boven het bewezene wordt de knop', b2.items[0].knop === 'bloklengte',
    `${b2.items[0].knop} — ${b2.items[0].aanpassing}`);
  ok('met een startpunt dat ze wél heeft gehaald',
    /Begin met 1[0-9] min/.test(b2.items[0].aanpassing), b2.items[0].aanpassing);

  // Alles op orde: dan is kracht wat er nog ligt.
  const b3 = bijsturing({ currentDate: TODAY, dagen, logs, runDagenPerWeek: 3.5,
    targetSec: 2100, distanceKm: 5, terrain: 'trail' });
  ok('en anders is zware kracht wat er nog ligt', b3.items[0].knop === 'kracht',
    b3.items[0].knop);
  ok('waarbij haar circuit van acht minuten blijft staan',
    /blijft daarnaast gewoon staan/.test(b3.items[0].waarom), b3.items[0].waarom);
}

S('9 · De 35 minuten blijven staan, met de som erbij');
{
  const W = [-26, -22, -18, -14, -10].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  const dagen = [{ date: TODAY, dayShort: 'wo', role: 'easy',
    run: { description: 'rustig', hr: 'Mik op 106–132 bpm', paceMin: 10.2, blockMin: 12 } }];
  const b = bijsturing({ currentDate: TODAY, dagen, logs,
    targetSec: 2100, distanceKm: 5, terrain: 'trail', hrCap: 145 });
  console.log(`      ${b.kader}`);
  ok('het doel staat er als tijd', b.doel.tijd === '35:00', b.doel.tijd);
  ok('met de efficiëntie die ervoor nodig is', b.doel.benodigdeEf > 1,
    String(b.doel.benodigdeEf));
  ok('en het tempo op vlakke weg', b.doel.tempoVlak > 0 && b.doel.tempoVlak < 7,
    String(b.doel.tempoVlak));
  ok('de ondergrond staat er apart bij', /pad en duin/.test(b.kader), b.kader);
  // Niet wegpoetsen, en ook niet suggereren dat het wel lukt.
  ok('het kader zegt eerlijk dat 12 december dat niet wordt',
    /brengen je niet naar dat getal op 12 december/.test(b.kader), b.kader);
  ok('en dat de weg dezelfde is',
    /dezelfde aanpassingen/.test(b.kader), b.kader);
}

S('10 · Een dag op slot krijgt geen opdracht');
{
  // Staat een dag op slot door de poort, dan is "loop hem op 132" geen
  // advies maar een tegenspraak met het scherm ernaast.
  const W = [-26, -22, -18, -14, -10].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  const dagen = [
    { date: TODAY, dayShort: 'wo', role: 'easy', gated: true, gateReason: 'gisteren gelopen',
      run: { description: 'rustig', hr: 'Mik op 106–132 bpm', paceMin: 10.2, blockMin: 12 } },
    { date: addDays(TODAY, 2), dayShort: 'vr', role: 'easy',
      run: { description: 'rustig', hr: 'Mik op 106–132 bpm', paceMin: 10.2, blockMin: 12 } },
  ];
  const b = bijsturing({ currentDate: TODAY, dagen, logs });
  ok('de dag op slot staat niet in de bijsturing',
    b.items.every(i => i.date !== TODAY), JSON.stringify(b.items.map(i => i.date)));
  ok('de eerstvolgende vrije dag wel',
    b.items.some(i => i.date === addDays(TODAY, 2)), JSON.stringify(b.items.map(i => i.date)));
}

S('11 · De tabel loopt door tot en met de race');
{
  // Zij vroeg het blok "alvast in te vullen tot en met de race". Dat is
  // één tabel: gelopen trainingen met doel én uitkomst, aanstaande met
  // alleen het doel. Een aparte planning naast een apart logboek zou
  // dezelfde training twee keer tonen met twee doelen.
  const W = [-26, -22, -18, -14, -10, -6].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  localStorage.setItem('gc_race_goals', JSON.stringify([{ id: 'a', date: '2026-12-12',
    name: 'Ameland', type: 'TARGET', enabled: true, terrain: 'trail',
    distanceKm: 5, targetTimeSec: 2100 }]));
  const plan = racePlan({ currentDate: TODAY, logs, raceDate: '2026-12-12',
    raceKm: 5, raceSec: 2100, raceName: 'Ameland' });
  const v = volledigeTabel({ currentDate: TODAY, logs, dagen: plan.days });
  const laatste = v.rows[v.rows.length - 1];
  console.log(`      ${v.gelopen} gelopen, ${v.teGaan} te gaan, laatste ${laatste.date}`);

  ok('de tabel eindigt op de racedag', laatste.date === '2026-12-12', laatste.date);
  ok('en die racedag is er een met een eigen hartslag en tempo',
    laatste.doelHr > 0 && laatste.doelTempo > 0,
    JSON.stringify([laatste.doelHr, laatste.doelTempo]));
  // De race loop je niet op je easy-band. Kwam dit getal uit het
  // easy-voorschrift, dan stond er 132 voor een wedstrijd.
  ok('de racehartslag is hoger dan de easy-hartslag',
    laatste.doelHr > v.rows.find(r => r.status === 'gepland').doelHr,
    `${laatste.doelHr} tegen ${v.rows.find(r => r.status === 'gepland').doelHr}`);
  ok('en hij staat als race gemarkeerd', laatste.isRace === true, '');

  ok('de rijen staan op datum, oud naar nieuw',
    v.rows.every((r, i) => i === 0 || v.rows[i - 1].date <= r.date), '');
  ok('gelopen trainingen staan erin met hun uitkomst',
    v.rows.filter(r => r.status === 'gelopen').every(r => r.echteHr > 0), '');
  ok('aanstaande trainingen hebben een doel maar nog geen uitkomst',
    v.rows.filter(r => r.status === 'gepland')
      .every(r => r.doelHr > 0 && r.echteHr == null), '');
  ok('er staat ruim een maand aan trainingen klaar', v.teGaan >= 10, String(v.teGaan));

  // Eén training, één rij. Vandaag is zowel gepland als mogelijk gelopen.
  const data = v.rows.map(r => r.date);
  ok('geen enkele datum staat er twee keer in',
    new Set(data).size === data.length, JSON.stringify(data));

  // Het oordeel over het verleden komt uit dezelfde bron als de losse
  // tabel: anders staan er twee samenvattingen die iets anders zeggen.
  const los = sessieTabel({ currentDate: TODAY, logs });
  ok('de samenvatting is dezelfde als die van de losse tabel',
    v.samenvatting === los.samenvatting && v.overschot === los.overschot, '');
}

S('12 · En hij werkt zich bij als er een training bijkomt');
{
  // Dit is wat zij vroeg: "telkens aanpassen bij nieuwe trainingen".
  // Er is niets om aan te zetten — een toekomstige rij rekent met de
  // gemeten efficiëntie van nu, dus een betere sessie verschuift de hele
  // rechterkolom vanzelf.
  const W = [-26, -22, -18, -14, -10, -6].map(n => run(addDays(TODAY, n), 0.72, 149));
  const logs = wereld(W);
  const plan = racePlan({ currentDate: TODAY, logs, raceDate: '2026-12-12',
    raceKm: 5, raceSec: 2100 });
  const voor = volledigeTabel({ currentDate: TODAY, logs, dagen: plan.days });
  const doelVoor = voor.rows.filter(r => r.status === 'gepland').slice(-1)[0].doelTempo;

  // Twee duidelijk betere sessies erbij.
  const beter = [...W, run(addDays(TODAY, -3), 0.80, 140), run(addDays(TODAY, -1), 0.82, 140)];
  const logs2 = wereld(beter);
  const plan2 = racePlan({ currentDate: TODAY, logs: logs2, raceDate: '2026-12-12',
    raceKm: 5, raceSec: 2100 });
  const na = volledigeTabel({ currentDate: TODAY, logs: logs2, dagen: plan2.days });
  const doelNa = na.rows.filter(r => r.status === 'gepland').slice(-1)[0].doelTempo;

  console.log(`      doeltempo laatste trainingsdag: ${doelVoor} → ${doelNa}`);
  ok('betere sessies maken het doeltempo sneller', doelNa < doelVoor,
    `${doelVoor} → ${doelNa}`);
  ok('en de nieuwe sessies staan zelf ook in de tabel',
    na.gelopen > voor.gelopen, `${voor.gelopen} → ${na.gelopen}`);
}

S('13 · Een leeg dossier verzint niets');
{
  wereld([]);
  const t = sessieTabel({ currentDate: TODAY, logs: {} });
  ok('geen trainingen, geen rijen', t.rows.length === 0 && t.known === false, '');
  ok('en een samenvatting die dat zegt',
    /Nog geen sessie/.test(t.samenvatting), t.samenvatting);
  const b = bijsturing({ currentDate: TODAY, dagen: [], logs: {} });
  ok('geen aanstaande trainingen, geen bijsturing', b.known === false, '');
  ok('maar het doel staat er nog steeds', b.doel.tijd === '35:00', b.doel.tijd);
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
