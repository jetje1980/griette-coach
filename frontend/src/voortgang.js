// Boek ik vooruitgang? En zo nee, waarop niet?
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG
//
// "Ik vind het raar dat ik sinds een half jaar nauwelijks progressie lijk
// te hebben geboekt."
//
// Progressie kon die vraag niet beantwoorden. Het toonde grafieken,
// sessies, foto's en scores — maar nergens stond het oordeel zelf: ga je
// vooruit, waarop wel en waarop niet, en wat volgt daaruit.
//
// Dat is geen detail. "Nauwelijks progressie" is één gevoel over een
// stapel losse dingen die zich elk anders gedragen. Haar volume groeide
// wel degelijk — van 137 minuten in april naar 253 in oktober — terwijl
// haar economie stilstond. Wie die twee op één hoop gooit, concludeert
// "het werkt niet" terwijl de helft wel werkt.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT BESTAND DOET
//
// Per dimensie: waar stond je, waar sta je, en is dat vooruit, gelijk of
// achteruit. Elk met de meting erbij, en met "onbekend" waar niet
// gemeten is — want een dimensie zonder gegevens hoort niet stilzwijgend
// als "gelijk" te tellen.
//
// Daarna de diagnose: niet een lijst, maar de combinatie. Volume omhoog
// en economie stil betekent iets anders dan allebei stil, en weer iets
// anders dan economie omhoog bij gelijk volume.
//
// En dan een voorstel voor drie maanden dat uit díé diagnose volgt. Geen
// standaardblok dat er altijd hetzelfde uitziet.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts } from './workouts';
import { steadyEfficiency } from './gemetenTempo';
// Kracht komt uit meer dan één plek: de krachtmodule, het circuit van de
// 75-dagen-challenge en een vinkje in het dagboek. Eén bron lezen gaf
// hier "gestopt met kracht" terwijl zij het dagelijks deed.
import { alleKracht, SOORT } from './krachtBronnen';
// Welke factoren meebewegen met haar betere sessies — slaap, cyclus,
// spanning, afstand, rust, kracht, gewicht. Zij vroeg hier expliciet om.
import { efficiencyFactors } from './efficiencyWhy';

// Hoeveel verandering heet vooruitgang? Onder deze drempel is het ruis;
// twee sessies verschillen onderling al meer.
export const DREMPEL_PCT = 4;

// Het venster waarover gekeken wordt, en in hoeveel stukken.
export const VENSTER_DAGEN = 180;

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const gem = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const mediaan = (a) => {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Eén dimensie, met het oordeel erbij. `hoger` zegt welke richting beter
// is: bij economie omhoog, bij rusthartslag omlaag.
function oordeel({ id, label, eenheid, was, nu, hoger = true, toelichting,
  n = null, minN = 2 }) {
  if (was == null || nu == null || (n != null && n < minN)) {
    return { id, label, eenheid, was, nu, verdict: 'onbekend', deltaPct: null,
      regel: `${label}: nog te weinig gemeten om iets te zeggen.`, toelichting };
  }
  // Van nul naar iets is geen oneindige verbetering en geen onbekende: het
  // is begonnen of gestopt. Zonder dit stond er "+null%" bij kracht, en dat
  // is precies de dimensie waar bij haar het meeste te winnen valt.
  if (was === 0 || nu === 0) {
    const gestart = was === 0 && nu > 0;
    const gestopt = nu === 0 && was > 0;
    const goed = hoger ? gestart : gestopt;
    const slecht = hoger ? gestopt : gestart;
    return {
      id, label, eenheid, was: +was.toFixed(2), nu: +nu.toFixed(2), deltaPct: null,
      verdict: goed ? 'vooruit' : slecht ? 'achteruit' : 'gelijk', toelichting,
      regel: `${label}: ${+was.toFixed(2)} → ${+nu.toFixed(2)}${eenheid ? ' ' + eenheid : ''}`
        + (gestopt ? ' — gestopt' : gestart ? ' — begonnen' : ''),
    };
  }
  const pct = +(((nu - was) / Math.abs(was)) * 100).toFixed(1);
  const winst = hoger ? pct : -pct;
  const verdict = winst >= DREMPEL_PCT ? 'vooruit'
    : winst <= -DREMPEL_PCT ? 'achteruit' : 'gelijk';
  const teken = pct > 0 ? '+' : '';
  return {
    id, label, eenheid, was: +was.toFixed(2), nu: +nu.toFixed(2),
    deltaPct: pct, verdict, toelichting,
    regel: `${label}: ${+was.toFixed(2)} → ${+nu.toFixed(2)}${eenheid ? ' ' + eenheid : ''}`
      + ` (${teken}${pct}%)`,
  };
}

// ── De dimensies ────────────────────────────────────────────────
export function voortgang({ currentDate = todayLocal(), logs = {}, workouts = null,
  venster = VENSTER_DAGEN } = {}) {
  const vanaf = addDays(currentDate, -venster);
  const runs = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date >= vanaf && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!runs.length) {
    return { known: false, why: 'Geen loopsessies in dit venster.' };
  }

  // Eerste en laatste derde van de periode, zodat één sessie het beeld
  // niet kantelt.
  const derde = Math.max(1, Math.floor(runs.length / 3));
  const vroeg = runs.slice(0, derde);
  const laat = runs.slice(-derde);
  const grens = { vroegTot: vroeg[vroeg.length - 1].date, laatVanaf: laat[0].date };

  // 1. Economie — alleen steady-state, en zonder de verdachte metingen.
  //
  // Niet de eerste en laatste derde van álle sessies, maar van de sessies
  // die een bruikbare meting opleverden. Haar eerste weken bestonden uit
  // korte blokjes; die leveren geen steady state op, en dan stond er
  // "onbekend" terwijl er verderop genoeg te vergelijken viel. Een
  // dimensie onbekend noemen omdat de verkeerde sessies in het venster
  // vielen, is geen voorzichtigheid maar een lege uitkomst.
  const efAlle = runs.map(steadyEfficiency).filter(x => x && !x.hrSuspect);

  // Niet de eerste paar tegen de laatste paar. Welke sessies een
  // bruikbare meting opleveren hangt af van hoe die dag gelopen is, en
  // dan bepaalt toeval welke punten in welke bak vallen: twee goede
  // sessies vroeg in de lijst maakten hier "17% achteruit" van iets wat
  // over de hele reeks vlak is. Een lijn door álle punten laat zich niet
  // door twee sessies kantelen.
  //
  // En niet met kleinste kwadraten maar met de mediaan van alle
  // paarsgewijze hellingen (Theil–Sen). Een gewone regressie weegt een
  // uitschieter kwadratisch: twee goede sessies vroeg in de reeks maakten
  // van een vlakke lijn nog steeds "4% achteruit". Bij een mediaan telt
  // een uitschieter als één punt, net als alle andere.
  const efTrend = (() => {
    if (efAlle.length < 4) return null;
    const start = efAlle[0].date;
    const p = efAlle.map(s => ({ x: daysBetween(start, s.date) / 7, y: Math.log(s.ef) }));
    const hellingen = [];
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        if (p[j].x !== p[i].x) hellingen.push((p[j].y - p[i].y) / (p[j].x - p[i].x));
      }
    }
    if (!hellingen.length) return null;
    const b = mediaan(hellingen);
    // Het snijpunt op dezelfde manier: de mediaan van wat elk punt zegt.
    const a0 = mediaan(p.map(q => q.y - b * q.x));
    const weken = p[p.length - 1].x;
    return {
      van: +Math.exp(a0).toFixed(3),
      tot: +Math.exp(a0 + b * weken).toFixed(3),
      pctPerWeek: +((Math.exp(b) - 1) * 100).toFixed(2),
      weken: +weken.toFixed(1),
    };
  })();
  const eVroeg = { waarde: efTrend?.van ?? null, n: efAlle.length };
  const eLaat = { waarde: efTrend?.tot ?? null, n: efAlle.length };
  const efVenster = efAlle.length
    ? { van: efAlle[0].date, tot: efAlle[efAlle.length - 1].date, n: efAlle.length,
      pctPerWeek: efTrend?.pctPerWeek ?? null }
    : null;

  // 2. Duur per sessie.
  const minVan = (lijst) => gem(lijst.map(w => num(w.duration)).filter(Number.isFinite));

  // 3. Langste doorlopend blok.
  const blokVan = (lijst) => {
    let max = 0;
    for (const w of lijst) {
      for (const l of (Array.isArray(w.laps) ? w.laps : [])) {
        const sec = num(l.movingTime ?? l.moving_time) || 0;
        const m = num(l.distance) || 0;
        if (sec > max && m / (sec / 60) >= 95) max = sec;
      }
    }
    return max ? +(max / 60).toFixed(1) : null;
  };

  // 4. Frequentie, in sessies per week over elke helft.
  const perWeek = (lijst) => {
    if (lijst.length < 2) return null;
    const wkn = Math.max(1, daysBetween(lijst[0].date, lijst[lijst.length - 1].date) / 7);
    return +(lijst.length / wkn).toFixed(2);
  };

  // 5. Rusthartslag.
  const hrvVan = (van, tot) => mediaan(Object.entries(logs || {})
    .map(([k, l]) => ({ date: l?.date || k, v: num(l?.hrv) }))
    .filter(x => x.date >= van && x.date <= tot && Number.isFinite(x.v))
    .map(x => x.v));

  const rhrVan = (van, tot) => mediaan(Object.entries(logs || {})
    .map(([k, l]) => ({ date: l?.date || k, v: num(l?.hr_rest) }))
    .filter(x => x.date >= van && x.date <= tot && Number.isFinite(x.v))
    .map(x => x.v));

  // 6. Kracht, in sessies per week.
  const krachtAlles = alleKracht({ currentDate, logs, venster });
  const krachtVan = (van, tot) => {
    const d = krachtAlles.dagen.filter(x => x >= van && x <= tot);
    const wkn = Math.max(1, daysBetween(van, tot) / 7);
    return +(d.length / wkn).toFixed(2);
  };
  const zwaarVan = (van, tot) => {
    const d = [...new Set(krachtAlles.zwaar.filter(x => x.date >= van && x.date <= tot)
      .map(x => x.date))];
    const wkn = Math.max(1, daysBetween(van, tot) / 7);
    return +(d.length / wkn).toFixed(2);
  };
  // Kracht en rusthartslag worden niet in twee helften van een half jaar
  // vergeleken maar in twee blokken van zes weken, direct achter elkaar.
  // Anders telt "wel gedaan in september, niet meer sinds" als vooruitgang,
  // omdat september in de tweede helft van het halfjaar valt. Zij is
  // zeven weken geleden gestopt met kracht; dat hoort "achteruit" te zijn
  // en niet "vooruit".
  const BLOK = 42;
  const recentVan = addDays(currentDate, -BLOK);
  const eerderVan = addDays(currentDate, -2 * BLOK);

  const dimensies = [
    oordeel({ id: 'economie', label: 'Economie (tempo bij gelijke hartslag)',
      eenheid: '', was: eVroeg.waarde, nu: eLaat.waarde, hoger: true,
      n: efAlle.length, minN: 4,
      toelichting: 'Meters per minuut gedeeld door hartslag, alleen uit loopblokken van '
        + 'vijf minuten of langer. Dit is de maat die zegt of je sneller wordt zonder '
        + 'harder te werken — en dus de maat die er voor een race toe doet.' }),
    oordeel({ id: 'blok', label: 'Langste doorlopende blok', eenheid: 'min',
      was: blokVan(vroeg), nu: blokVan(laat), hoger: true,
      toelichting: 'Hoe lang je achter elkaar kunt lopen. Dit groeit los van economie: '
        + 'je kunt langer volhouden zonder sneller te zijn.' }),
    oordeel({ id: 'duur', label: 'Minuten per sessie', eenheid: 'min',
      was: minVan(vroeg), nu: minVan(laat), hoger: true,
      toelichting: 'Hoeveel je per keer doet. Groeit dit terwijl de economie stilstaat, '
        + 'dan train je wel meer maar niet effectiever.' }),
    oordeel({ id: 'frequentie', label: 'Loopdagen per week',
      eenheid: '', was: perWeek(vroeg), nu: perWeek(laat), hoger: true,
      toelichting: 'Hoe vaak. Bij beginnende lopers is dit de sterkste voorspeller van '
        + 'economiewinst — sterker dan hoe lang of hoe hard.' }),
    oordeel({ id: 'kracht', label: 'Krachtsessies per week', eenheid: '',
      was: krachtVan(eerderVan, recentVan), nu: krachtVan(recentVan, currentDate),
      hoger: true,
      toelichting: 'Alle kracht bij elkaar: de krachtmodule, het circuit van acht '
        + 'minuten uit de challenge en een vinkje in je dagboek. Dat hij uit meer dan '
        + 'één plek komt, is hier een eis en geen detail.' }),
    oordeel({ id: 'kracht_zwaar', label: 'Waarvan zwaar', eenheid: '',
      was: zwaarVan(eerderVan, recentVan), nu: zwaarVan(recentVan, currentDate),
      hoger: true,
      toelichting: 'Alleen zware, lage herhalingen geven in acht tot twaalf weken 2 tot '
        + '4% betere loopeconomie. Een circuit van acht minuten telt voor je ritme en '
        + 'je romp, maar niet voor deze winst — dat zijn twee verschillende dingen die '
        + 'allebei kracht heten.' }),
    oordeel({ id: 'hrv', label: 'HRV', eenheid: 'ms',
      was: hrvVan(eerderVan, recentVan), nu: hrvVan(recentVan, currentDate), hoger: true,
      toelichting: 'De balans van je autonome zenuwstelsel — het systeem dat bij long '
        + 'COVID ontregeld raakt. Beweegt eerder en sterker dan je rusthartslag, dus '
        + 'een verandering hier is vroeger zichtbaar. Alleen jouw eigen verloop telt; '
        + 'absolute waarden zijn tussen mensen niet te vergelijken.' }),
    oordeel({ id: 'rusthartslag', label: 'Rusthartslag', eenheid: 'bpm',
      was: rhrVan(eerderVan, recentVan), nu: rhrVan(recentVan, currentDate), hoger: false,
      toelichting: 'Een dalende rusthartslag hoort bij een systeem dat herstelt van wat '
        + 'het krijgt. Blijft hij gelijk of stijgt hij, dan landt de training niet.' }),
  ];

  const per = Object.fromEntries(dimensies.map(d => [d.id, d]));
  const vooruit = dimensies.filter(d => d.verdict === 'vooruit');
  const stil = dimensies.filter(d => d.verdict === 'gelijk' || d.verdict === 'achteruit');

  // ── De diagnose: de combinatie, niet de lijst ────────────────
  const gaten = (() => {
    const d = [...new Set(runs.map(w => w.date))].sort();
    const g = d.slice(1).map((x, i) => daysBetween(d[i], x));
    return { grootste: g.length ? Math.max(...g) : null,
      boven7: g.filter(x => x > 7).length };
  })();
  const sessiesPerWeek = perWeek(runs);

  let diagnose;
  if (per.economie.verdict === 'vooruit') {
    diagnose = {
      id: 'werkt',
      kop: 'Je economie gaat vooruit — dit werkt.',
      tekst: 'Wat je doet levert op. De winst zit in doorgaan met wat er staat, niet in '
        + 'iets anders proberen.',
    };
  } else if (sessiesPerWeek != null && sessiesPerWeek < 2.5) {
    diagnose = {
      id: 'frequentie',
      kop: 'Je economie staat stil, en de reden is de frequentie.',
      tekst: `${runs.length} sessies in ${Math.round(daysBetween(runs[0].date, currentDate) / 7)} `
        + `weken is ${sessiesPerWeek} per week`
        + (gaten.grootste ? `, met een gat van ${gaten.grootste} dagen` : '')
        + (gaten.boven7 ? ` en ${gaten.boven7} onderbrekingen langer dan een week` : '')
        + '. Dat is geen trainingsperiode maar een reeks herstarts: elke keer pak je de '
        + 'eerste weken terug en daarna valt het weer stil. Aanpassing vraagt herhaling '
        + 'binnen het venster waarin de vorige prikkel nog telt — ruwweg twee tot drie '
        + 'dagen. Dit is niet je lichaam; dit is de kalender.',
    };
  } else if (per.kracht_zwaar.nu != null && per.kracht_zwaar.nu < 1) {
    diagnose = {
      id: 'kracht',
      kop: 'Je loopt genoeg, maar de prikkel die economie geeft ontbreekt.',
      tekst: 'De frequentie staat en je dóét kracht — alleen niet de soort die '
        + 'loopeconomie verbetert. Daarvoor is zwaar en laag in herhalingen nodig, twee '
        + 'keer per week. Je korte circuit mag gewoon blijven staan; dit komt ernaast, '
        + 'niet in plaats daarvan.',
    };
  } else if (per.duur.verdict === 'vooruit') {
    diagnose = {
      id: 'volume_zonder_economie',
      kop: 'Je doet méér, maar niet effectiever.',
      tekst: 'Je sessies werden langer terwijl je economie gelijk bleef. Meer van hetzelfde '
        + 'voegt op dit punt weinig toe; de prikkel moet van soort veranderen, niet van '
        + 'omvang.',
    };
  } else {
    diagnose = {
      id: 'onduidelijk',
      kop: 'Er is nog geen duidelijke richting.',
      tekst: 'De metingen laten geen eenduidig beeld zien. Een aaneengesloten blok van '
        + 'zes tot acht weken maakt dat vanzelf zichtbaar.',
    };
  }

  return {
    known: true,
    from: runs[0].date, to: runs[runs.length - 1].date,
    sessions: runs.length,
    perWeek: sessiesPerWeek,
    gaps: gaten,
    split: grens,
    economyWindow: efVenster,
    // Patronen: wat onderscheidt haar betere sessies van haar mindere?
    // Niet als los lijstje maar naast het oordeel, want een dimensie die
    // stilstaat is pas bruikbaar als je weet waar hij mee samenhangt.
    patterns: (() => {
      try {
        const f = efficiencyFactors({ currentDate, logs, workouts });
        if (!f.known) return { known: false, why: f.why };
        return {
          known: true,
          line: f.line,
          caveat: f.caveat,
          spread: f.spread,
          findings: f.findings.filter(x => x.enough && x.meaningful),
          geen: f.findings.filter(x => x.enough && !x.meaningful).map(x => x.label),
          ontbreekt: f.findings.filter(x => !x.enough).map(x => x.label),
        };
      } catch { return { known: false, why: 'Patronen zijn nu niet te berekenen.' }; }
    })(),
    dimensions: dimensies,
    byId: per,
    forward: vooruit.map(d => d.id),
    stalled: stil.map(d => d.id),
    diagnosis: diagnose,
    // Eén zin voor bovenaan.
    line: (() => {
      // "Stil" en "achteruit" op één hoop gooien maakt het beeld troebeler
      // dan het is: niet bewegen en terugvallen vragen een ander antwoord.
      const lijst = (a) => a.map(d => d.label.toLowerCase().replace(/ \(.*\)$/, ''))
        .reduce((t, x, i, arr) => t + (i === 0 ? '' : i === arr.length - 1 ? ' en ' : ', ') + x, '');
      const terug = dimensies.filter(d => d.verdict === 'achteruit');
      const vlak = dimensies.filter(d => d.verdict === 'gelijk');
      const delen = [];
      if (vooruit.length) delen.push(`vooruit op ${lijst(vooruit)}`);
      if (vlak.length) delen.push(`gelijk op ${lijst(vlak)}`);
      if (terug.length) delen.push(`terug op ${lijst(terug)}`);
      if (!delen.length) return 'Nog niets te meten in deze periode.';
      return `${delen.join('; ')}.`.replace(/^./, c => c.toUpperCase());
    })(),
  };
}

// ── Het voorstel voor de komende drie maanden ───────────────────
//
// Afgeleid van de diagnose, niet van een sjabloon. Drie blokken van vier
// weken, want dat is de kortste periode waarin een verandering zichtbaar
// wordt zonder dat het plan een half jaar vooruit doet alsof het de
// toekomst kent.
export function driemaandenplan({ voortgang: v, currentDate = todayLocal() } = {}) {
  if (!v?.known) return { known: false, why: v?.why || 'Nog geen beeld van je voortgang.' };

  const blok = (n, titel, doel, meet, waarom) => ({
    nr: n,
    van: addDays(currentDate, (n - 1) * 28),
    tot: addDays(currentDate, n * 28 - 1),
    titel, doel, meet, waarom,
  });

  const id = v.diagnosis.id;
  if (id === 'frequentie') {
    return {
      known: true, diagnose: v.diagnosis,
      kop: 'Drie maanden: eerst ritme, dan pas opbouw',
      blokken: [
        blok(1, 'Ritme vastzetten',
          'Vier loopdagen per week, om de dag, elke sessie kort — 20 tot 30 minuten. '
          + 'Niet langer, hoe goed het ook gaat.',
          'Aantal weken op rij met vier loopdagen. Doel: vier van de vier.',
          'De lengte is nu niet het probleem; de herhaling is het. Kort houden is wat '
          + 'maakt dat de vierde dag er ook werkelijk komt.'),
        blok(2, 'Gewichten erbij, lengte erbij',
          'Zelfde vier loopdagen, plus één à twee keer per week trainen MET GEWICHTEN — '
          + 'geen band, geen eigen lichaamsgewicht. 3 × 5 goblet squat, 3 × 6 split '
          + 'squat per been, 3 × 8 romanian deadlift, 3 × 15 kuitheffen. Zwaar genoeg '
          + 'dat de laatste herhaling moeilijk is. De lange loop mag naar 45 minuten.',
          'Efficiëntie bij gelijke hartslag — hier hoort de eerste zichtbare winst.',
          'Waarom gewichten en niet je circuit: de 2 tot 4% loopeconomie uit de '
          + 'literatuur komt van zware, lage herhalingen. Die maken je pezen en spieren '
          + 'stugger als veer, zodat je per pas minder energie in de grond verliest en '
          + 'je hartslag bij hetzelfde tempo lager ligt. Hoge herhalingen met licht '
          + 'gewicht doen dat niet — die trainen uithoudingsvermogen van de spier, en '
          + 'dat is niet je beperking. Je circuit van acht minuten blijft gewoon staan: '
          + 'dat is je dagelijkse ritme en je romp, en dit komt ernaast.'),
        blok(3, 'Kwaliteit',
          'Vier loopdagen, waarvan één met blokken op racetempo. Kracht blijft staan.',
          'Tempo bij hartslag 145 — vergelijk met je ijksessie van nu.',
          'Snelheid is de laatste knop, niet de eerste. Hij werkt alleen op een basis '
          + 'die er al staat.'),
      ],
      let_op: 'Dit plan heeft één aanname: dat de vier loopdagen er werkelijk komen. '
        + 'Lukt dat in blok 1 niet, dan is blok 1 nog niet af en schuift de rest op. Dat '
        + 'is geen falen maar de enige volgorde die werkt.',
    };
  }
  if (id === 'kracht') {
    return {
      known: true, diagnose: v.diagnosis,
      kop: 'Drie maanden: de ontbrekende prikkel',
      blokken: [
        blok(1, 'Met gewichten beginnen',
          'Eén à twee keer per week trainen MET GEWICHTEN — dumbbells of kettlebell, '
          + 'geen band. 3 × 5 goblet squat, 3 × 6 split squat per been, 3 × 8 romanian '
          + 'deadlift, 3 × 15 kuitheffen langzaam omlaag. Lopen blijft zoals het is.',
          'Of die sessies er elke week zijn, en of het gewicht omhoog kan.',
          'Waarom met gewichten: de economiewinst komt van zware, lage herhalingen — '
          + 'die maken je pezen stugger als veer, zodat je per pas minder energie '
          + 'verliest. Een band of hoge herhalingen trainen iets anders. Eén nieuwe '
          + 'prikkel tegelijk, dus lopen verandert deze vier weken niet.'),
        blok(2, 'Zwaarder worden',
          'Zelfde oefeningen, meer kilo\'s — als vijf herhalingen makkelijk gaan, is het '
          + 'gewicht te licht. Erbij: vier versnellingen van 20 seconden na twee '
          + 'easy-lopen per week.',
          'Efficiëntie bij gelijke hartslag, en het gewicht op de stang.',
          'Economiewinst komt uit zwaarder, niet uit vaker of langer. Progressie in '
          + 'kracht is een getal in kilo\'s; blijft dat gelijk, dan traint je lichaam '
          + 'niets nieuws.'),
        blok(3, 'Omzetten in tempo',
          'Kracht blijft, en één loopsessie per week krijgt blokken op racetempo.',
          'Tempo bij hartslag 145.',
          'Kracht maakt de motor zuiniger; tempoblokken leren je lichaam hem te '
          + 'gebruiken.'),
      ],
      let_op: 'Te licht is hier de enige echte fout. Kon je er nog drie bij, dan telde '
        + 'die set niet mee.',
    };
  }
  if (id === 'werkt') {
    return {
      known: true, diagnose: v.diagnosis,
      kop: 'Drie maanden: doorgaan, en één ding per blok toevoegen',
      blokken: [
        blok(1, 'Vasthouden', 'Precies doen wat je nu doet.',
          'Efficiëntie — blijft de lijn stijgen?',
          'Wat werkt, verander je niet omdat het saai wordt.'),
        blok(2, 'Eén knop erbij',
          'Eén à twee keer per week met gewichten erbij (zwaar, lage herhalingen), '
          + 'verder niets.',
          'Efficiëntie, en of je herstel schoon blijft.',
          'Eén verandering tegelijk, anders weet je straks niet waar de winst vandaan kwam.'),
        blok(3, 'Kwaliteit', 'Eén sessie per week met blokken op racetempo.',
          'Tempo bij hartslag 145.',
          'Snelheid als laatste, op een basis die er inmiddels staat.'),
      ],
      let_op: 'De grootste fout in deze fase is te veel tegelijk willen.',
    };
  }
  return {
    known: true, diagnose: v.diagnosis,
    kop: 'Drie maanden: eerst meten, dan sturen',
    blokken: [
      blok(1, 'Een schone reeks neerzetten',
        'Vier loopdagen per week, om de dag, en bij elke sessie minstens één blok van '
        + 'tien minuten doorlopend.',
        'Aantal bruikbare metingen. Doel: minstens acht.',
        'Zonder aaneengesloten metingen is elke conclusie een gok — ook die van mij.'),
      blok(2, 'Sturen op wat er dan staat',
        'Het plan van blok 2 volgt uit de metingen van blok 1.',
        'Efficiëntie bij gelijke hartslag.',
        'Een plan voor drie maanden dat nu al tot in detail vastligt, doet alsof het de '
        + 'uitkomst van blok 1 kent.'),
      blok(3, 'Kwaliteit', 'Eén sessie per week op racetempo, als de basis staat.',
        'Tempo bij hartslag 145.',
        'Snelheid is de laatste knop.'),
    ],
    let_op: 'Blok 2 en 3 staan hier met opzet grof. Ze worden ingevuld met wat blok 1 '
      + 'oplevert.',
  };
}
