// Het dagplan naar Ameland: elke dag tot 12 december, met wat er die dag
// te doen is en wat eraan vastzit.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAT, EN WAT HET NADRUKKELIJK NIET IS
//
// Zij vroeg om alle trainingen tot Ameland op datum, met per dag wat ze
// moet doen aan slaap, rust, eten en kracht — en dat het advies per dag
// meebeweegt met wat er werkelijk gebeurt.
//
// Het gevaar van zo'n overzicht is precies waar deze app eerder aan leed:
// een schema dat zijn eigen leven gaat leiden. runningSchema.js hield
// vijfendertig sessies vast, genummerd van week 1 tot week 12 en
// vastgeprikt aan data — sessie 14 kwam na 13, ook als 13 slecht viel.
// Dat is hier opnieuw de verleiding: zevenendertig dagen op een rij
// zetten en ze afvinken.
//
// Daarom twee regels in de constructie:
//
//   1. DE DAG VAN VANDAAG KOMT NIET UIT DIT BESTAND. Wat zij vandaag moet
//      lopen, bepaalt de planner die dat altijd al deed (coachPlan /
//      planNextSession), met de herstelcheck, de poort en de dosering
//      erbij. Dit bestand tekent de weken eromheen. Eén beslispunt, niet
//      twee — dat is de les van de vijf sessiemotoren die elkaar
//      tegenspraken.
//   2. ELKE TOEKOMSTIGE DAG IS EEN VOORNEMEN, GEEN AFSPRAAK. Het plan
//      wordt bij elke keer kijken opnieuw gerekend uit wat er inmiddels
//      gebeurd is: gelopen trainingen, rusthartslag, cyclusfase, gewicht,
//      stress. Een dag die anders liep verschuift de weken erna; hij
//      blijft niet als schuld staan.
//
// ─────────────────────────────────────────────────────────────────
// DE OPBOUW ZELF, EN WAAROM ZO
//
// Vier loopdagen per week, twee krachtdagen, elke dag het circuit van acht
// minuten, en expliciet benoemde rustdagen. Vier keer lopen is bij haar
// meer waard dan langer lopen: haar economie piekte in de weken dat ze om
// de drie à vier dagen liep en zakte in de weken met gaten van vijf tot
// zeven dagen.
//
// De weken hebben vier gezichten:
//
//   RITME      — terug naar vier keer per week, alles onder VT1. Geen
//                kwaliteit: er valt niets te winnen zolang het ritme er
//                niet staat.
//   LUTEAAL    — haar laatluteale week. Hartslag ligt bij hetzelfde tempo
//                drie tot acht slagen hoger, dus hier staat geen kwaliteit
//                en wordt er niet beoordeeld. Dit venster wordt berekend
//                uit haar eigen cyclushistorie, niet uit een aanname.
//   OPBOUW     — doorlopende blokken, racetempo-aanrakingen, zand en duin.
//   TAPER      — volume omlaag, scherpte vasthouden met versnellingen.
//
// Wat per dag aan slaap, eten en rust staat, is geen algemene gezondheid:
// het hangt aan de twee bevindingen uit haar eigen cijfers. Haar
// rusthartslag liep in zes weken vijfenhalve slag op terwijl ze 2,5 kilo
// afviel, en haar loopeconomie zakte in diezelfde periode. Zolang dat zo
// is, is eten de knop met de grootste opbrengst — niet trainen.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween, dayOfWeek, NL_DAYS, NL_DAYS_SHORT }
  from './datetime';
import { loadWorkouts } from './workouts';
import { provenStructure } from './raceplan';
import { sessionsAtLevel, sessionsUpTo, levelForBlock, PURPOSE_ID }
  from './data/sessionLibrary';
import { cycleDayOf } from './bodyReview';
import { restingDrift } from './restingDrift';
import { pemFreeWeeks } from './symptoms';
import { dayNumber as challengeDayNumber } from './challenge75';
import { loadStrengthSessions } from './data/strengthSchema';

// ── Fasen ───────────────────────────────────────────────────────
export const FASE = {
  RITME: { id: 'RITME', label: 'Ritme terug',
    doel: 'Vier keer per week lopen, alles onder VT1. Het ritme is de training.' },
  LUTEAAL: { id: 'LUTEAAL', label: 'Luteale week',
    doel: 'Volume vasthouden, niets beoordelen. Je hartslag ligt deze week hoger bij hetzelfde tempo.' },
  OPBOUW: { id: 'OPBOUW', label: 'Opbouw',
    doel: 'Doorlopende blokken, een aanraking racetempo, en zand onder je voeten.' },
  TAPER: { id: 'TAPER', label: 'Taper',
    doel: 'Minder volume, scherpte vasthouden. Er valt nu niets meer te winnen, alleen te verliezen.' },
  RACE: { id: 'RACE', label: 'Racedag', doel: 'Uitvoeren wat er staat.' },
};

// ── Dagsoorten ──────────────────────────────────────────────────
export const DAG = {
  RUN: 'run',
  RUN_KRACHT: 'run_kracht',
  KRACHT: 'kracht',
  WANDEL: 'wandel',
  RUST: 'rust',
  RACE: 'race',
};

// Het weekpatroon, op weekdag (0 = zondag). Vier loopdagen met zo veel
// mogelijk ruimte ertussen, kracht op de dagen ná een loop en niet ervoor,
// en één dag die echt leeg is.
//
// Zondag is bij haar de eerste dag van de week; dat staat zo in haar
// instellingen en daarom ligt de lange loop daar.
const WEEKPATROON = {
  0: { kind: DAG.RUN, rol: 'lang', note: 'De langste loop van de week.' },
  1: { kind: DAG.RUST, rol: null, note: 'Echte rustdag. Alleen het circuit van acht minuten.' },
  2: { kind: DAG.RUN, rol: 'easy', note: 'Rustige loop met versnellingen erachter.' },
  3: { kind: DAG.KRACHT, rol: null, note: 'Krachttraining. Zwaar en kort.' },
  4: { kind: DAG.RUN, rol: 'sleutel', note: 'De sessie die deze week iets moet bewijzen.' },
  5: { kind: DAG.KRACHT, rol: null, note: 'Krachttraining plus een rustige wandeling.' },
  6: { kind: DAG.RUN, rol: 'kort', note: 'Korte rustige loop; houdt het ritme erin.' },
};

// ── Wanneer valt haar laatluteale week? ─────────────────────────
//
// Berekend uit haar eigen cyclushistorie: de mediane lengte van de
// afgelopen cycli, geteld vanaf de laatste start. Zonder historie geen
// venster — dan staat er niets in plaats van een aanname van 28 dagen.
export function luteaalVenster({ currentDate = todayLocal(), tot = null } = {}) {
  const starts = [];
  for (let d = 0; d <= 400; d += 1) {
    const datum = addDays(currentDate, -d);
    const dag = cycleDayOf(datum, { asOf: currentDate });
    if (dag === 1) starts.push(datum);
  }
  const uniek = [...new Set(starts)].sort();
  if (!uniek.length) {
    return { known: false, why: 'Geen menstruatiestarts geregistreerd, dus geen venster te berekenen.' };
  }
  const lengtes = [];
  for (let i = 1; i < uniek.length; i++) {
    const n = daysBetween(uniek[i - 1], uniek[i]);
    if (n >= 20 && n <= 40) lengtes.push(n);
  }
  const lengte = lengtes.length
    ? [...lengtes].sort((a, b) => a - b)[Math.floor(lengtes.length / 2)]
    : null;
  if (!lengte) {
    return { known: false, lastStart: uniek[uniek.length - 1],
      why: 'Eén start bekend; er zijn er twee nodig om een cycluslengte te meten.' };
  }
  const laatste = uniek[uniek.length - 1];
  const vensters = [];
  const einde = tot || addDays(currentDate, 120);
  for (let k = 0; k < 8; k++) {
    const start = addDays(laatste, lengte * k);
    // De laatste zes dagen vóór de volgende menstruatie.
    const van = addDays(start, lengte - 6);
    const totDag = addDays(start, lengte - 1);
    if (totDag < currentDate) continue;
    if (van > einde) break;
    vensters.push({ van, tot: totDag, volgendeStart: addDays(start, lengte) });
  }
  return { known: true, cycleLength: lengte, lastStart: laatste,
    cycles: uniek.length, windows: vensters };
}

const inVenster = (datum, vensters) =>
  (vensters || []).some(v => datum >= v.van && datum <= v.tot);

// ── Het niveau waar de weken op bouwen ──────────────────────────
//
// Startpunt is wat ze aantoonbaar verdraagt; daarna één niveau per
// opbouwweek, en niet in de luteale week of de taper. Eén stap per week is
// bewust traag: twee variabelen tegelijk omhoog is precies hoe je niet
// weet waar een terugslag vandaan kwam.
function niveauVoorWeek({ basis, weekIndex, fase }) {
  if (fase === FASE.TAPER.id || fase === FASE.RACE.id) return basis + 1;
  if (fase === FASE.LUTEAAL.id) return basis;
  return Math.min(20, basis + weekIndex);
}

function vormVoor({ niveau, rol, fase }) {
  const doel = rol === 'lang' ? PURPOSE_ID.DURABILITY
    : rol === 'sleutel'
      ? (fase === FASE.OPBOUW.id ? PURPOSE_ID.RACE_SPECIFIC : PURPOSE_ID.EASY_ECONOMY)
      : PURPOSE_ID.EASY_ECONOMY;

  const opNiveau = sessionsAtLevel(niveau, { purpose: doel });
  if (opNiveau.length) return opNiveau[0];
  // Niets op dit niveau met dit doel: pak de zwaarste eronder met hetzelfde
  // doel, en anders de zwaarste vorm die er sowieso is.
  const eronder = sessionsUpTo(niveau, { purpose: doel });
  if (eronder.length) return eronder[eronder.length - 1];
  const alles = sessionsUpTo(niveau);
  return alles.length ? alles[alles.length - 1] : null;
}

function omschrijf(vorm) {
  if (!vorm) return null;
  if (vorm.continuous) return `${vorm.runMin} min doorlopend`;
  const f = (m) => (Number.isInteger(m) ? `${m}` : String(m).replace('.', ','));
  return `${f(vorm.runMin)} min lopen / ${f(vorm.walkMin)} min wandelen × ${vorm.reps}`;
}

// ── De krachtdagen ──────────────────────────────────────────────
//
// Twee per week, en bewust zwaar en kort: krachttraining verbetert de
// loopeconomie met enkele procenten in zes tot acht weken, en dat is meer
// dan haar aerobe systeem in deze vijf weken kan opleveren. Lichte hoge
// herhalingen doen dat niet; vijf zware herhalingen wel.
const KRACHT_A = {
  naam: 'Benen zwaar',
  oefeningen: [
    'Goblet squat — 3 × 5, zwaarder dan vorige keer',
    'Bulgarian split squat — 3 × 6 per been',
    'Kuitheffen staand — 3 × 15, langzaam omlaag',
    'Hip thrust — 3 × 8',
  ],
  waarom: 'Je kuit en achillespees zijn de grootste veer in je pas. Dit is de '
    + 'snelste weg naar hetzelfde tempo bij een lagere hartslag.',
};
const KRACHT_B = {
  naam: 'Romp en achterkant',
  oefeningen: [
    'Deadlift of romanian deadlift — 3 × 6',
    'Eenbenig kuitheffen — 3 × 12 per been',
    'Plank met beenlift — 3 × 30 sec',
    'Side plank — 2 × 30 sec per kant',
  ],
  waarom: 'Een romp die niet meebeweegt, verspilt geen energie bij elke pas.',
};

// ── Slaap, eten en rust per dag ─────────────────────────────────
function dagdoelen({ kind, rol, fase, drift, dagVoorSleutel }) {
  const slaap = dagVoorSleutel || kind === DAG.RUN ? 8.5 : 8;
  const doelen = [];

  doelen.push({
    id: 'slaap',
    label: 'Slaap',
    waarde: `${String(slaap).replace('.', ',')} uur`,
    waarom: dagVoorSleutel
      ? 'Morgen is de sessie die iets moet bewijzen; de nacht ervoor telt meer dan de nacht erna.'
      : 'Onder de zeven uur blijft je hartslag hoger en herstel je minder van wat je deed.',
  });

  // Eten: hangt aan de bevinding dat haar rusthartslag oploopt terwijl ze
  // afvalt. Zolang dat zo is, is dit de knop met de meeste opbrengst.
  const tekort = drift?.known && (drift.direction === 'omhoog' || drift.direction === 'sterk_omhoog');
  if (kind === DAG.RUN || kind === DAG.RUN_KRACHT || kind === DAG.RACE) {
    doelen.push({
      id: 'eten',
      label: 'Eten',
      waarde: 'Koolhydraten vóór en ná',
      waarom: tekort
        ? 'Je rusthartslag loopt op terwijl je afvalt. Op een loopdag niet in tekort: '
          + 'iets met koolhydraten 1–2 uur ervoor, en binnen een uur erna eten met eiwit erbij.'
        : 'Iets met koolhydraten 1–2 uur vooraf, en binnen een uur erna eten met eiwit erbij.',
    });
  } else {
    doelen.push({
      id: 'eten', label: 'Eten',
      waarde: tekort ? 'Onderhoud, niet in tekort' : 'Normaal, eiwit op peil',
      waarom: tekort
        ? 'Houd je gewicht vast tot na 12 december. Je kunt geen motor bouwen in een tekort, '
          + 'en je rusthartslag laat zien dat je er nu in zit.'
        : 'Rond de 100 gram eiwit; dat is wat je krachttraining laat landen.',
    });
  }

  if (kind === DAG.RUST) {
    doelen.push({ id: 'rust', label: 'Rust', waarde: 'Echt rust',
      waarom: 'Een rustdag is geen lege dag in het schema; het is de dag waarop de '
        + 'training van gisteren pas effect krijgt.' });
  }
  if (fase === FASE.LUTEAAL.id) {
    doelen.push({ id: 'cyclus', label: 'Cyclus', waarde: 'Laatluteale week',
      waarom: 'Je hartslag ligt deze week drie tot acht slagen hoger bij hetzelfde tempo. '
        + 'Lees een "slechtere" sessie deze week niet als vormverlies.' });
  }
  return doelen;
}

// ── Wat er per dag in te vullen is ──────────────────────────────
//
// Niet alles elke dag: een formulier dat je niet invult levert minder op
// dan drie velden die je wel invult. De vaste drie staan er altijd, de
// rest hangt aan wat die dag gebeurt.
export const INVOER = {
  hr_rest: { label: 'Rusthartslag', type: 'getal', eenheid: 'bpm',
    waarom: 'Het informatiefste getal dat je de app kunt geven: het zegt vóór je de '
      + 'deur uitgaat hoe de dag eruitziet, en over weken of je opbouw klopt.' },
  weight: { label: 'Gewicht', type: 'getal', eenheid: 'kg',
    waarom: 'Nu de vraag is of je in tekort zit, is het verloop belangrijker dan het getal.' },
  sleep_hours: { label: 'Slaapuren', type: 'getal', eenheid: 'uur',
    waarom: 'Samen met je rusthartslag de beste voorspeller van hoe je sessie gaat vallen.' },
  sleep_quality: { label: 'Slaapkwaliteit', type: 'schaal3',
    opties: ['slecht', 'matig', 'goed'], waarom: 'Uren zeggen niet alles.' },
  energy: { label: 'Energie', type: 'schaal3', opties: ['laag', 'matig', 'goed'],
    waarom: 'Je eigen oordeel telt mee in de poort die bepaalt of er vandaag opgebouwd mag worden.' },
  stress_load: { label: 'Spanning vandaag', type: 'schaal3',
    opties: ['rustig', 'druk', 'overbelast'],
    waarom: 'Op 7 oktober zag je het zelf: één stressvolle dag plus een slechte nacht gaf '
      + 'vijf slagen hogere rusthartslag en een mindere sessie. Werkstress telt mee als belasting.' },
  fuel_quality: { label: 'Genoeg gegeten', type: 'schaal3',
    opties: ['te weinig', 'genoeg', 'ruim'],
    waarom: 'Op Mounjaro vertelt je eetlust je niet dat je te weinig binnenkrijgt. '
      + 'Dit is het enige wat dat zichtbaar maakt.' },
  carbs_around_run: { label: 'Koolhydraten rond je loop', type: 'ja_nee',
    waarom: 'Met en zonder naast elkaar leggen is de enige manier om te zien of het bij jou uitmaakt.' },
  training_rpe: { label: 'Hoe zwaar voelde het (1–10)', type: 'getal',
    waarom: 'Dezelfde sessie die lichter gaat voelen is vooruitgang die nog niet in je tempo zit.' },
  training_legs: { label: 'Benen', type: 'keuze', opties: ['fris', 'zwaar', 'stram'],
    waarom: 'Zware benen twee sessies op rij is een vroeger signaal dan je hartslag.' },
  training_could_more: { label: 'Had je meer gekund', type: 'keuze',
    opties: ['ja', 'beetje', 'nee'],
    waarom: 'Bepaalt mede of de volgende sessie een stap omhoog mag doen.' },
  recovery_check: { label: 'Herstelcheck (24–48u na je loop)', type: 'keuze',
    opties: ['good', 'ok', 'bad'],
    waarom: 'Dit is de maat waar je hele opbouw aan hangt. Zonder dit antwoord is elk advies een gok.' },
  headache_severity: { label: 'Hoofdpijn (0–3)', type: 'getal',
    waarom: 'Je vroegste waarschuwing, en bij jou vaker hormonaal dan post-exertioneel — '
      + 'daarom telt hij alleen als PEM-signaal als er een training aan voorafging.' },
  alcohol_had: { label: 'Alcohol', type: 'ja_nee',
    waarom: 'Verhoogt je rusthartslag de nacht erna en verstoort je diepe slaap.' },
  cycle_day_one: { label: 'Eerste dag menstruatie', type: 'ja_nee',
    waarom: 'Hiermee kan de app je laatluteale week vooruit berekenen en er geen zware '
      + 'sessies in plannen.' },
  strength_done: { label: 'Kracht gedaan', type: 'ja_nee', waarom: 'Twee per week is het doel.' },
};

const DAGELIJKS = ['hr_rest', 'sleep_hours', 'sleep_quality', 'energy', 'stress_load',
  'fuel_quality'];
const NA_LOOP = ['training_rpe', 'training_legs', 'training_could_more', 'carbs_around_run'];

function invoerVoor({ kind, gelopen, dagNaLoop }) {
  const velden = [...DAGELIJKS];
  if (kind === DAG.RUN || kind === DAG.RUN_KRACHT || kind === DAG.RACE || gelopen) {
    velden.push(...NA_LOOP);
  }
  if (dagNaLoop) velden.push('recovery_check', 'headache_severity');
  if (kind === DAG.KRACHT || kind === DAG.RUN_KRACHT) velden.push('strength_done');
  velden.push('weight');
  return [...new Set(velden)];
}

// ── Het plan ────────────────────────────────────────────────────
export function racePlan({ currentDate = todayLocal(), logs = {}, raceDate = null,
  raceName = 'Ameland Adventure Run', taperDays = 6 } = {}) {
  const race = raceDate || null;
  if (!race || race < currentDate) {
    return { known: false, why: 'Geen racedatum in de toekomst om naartoe te werken.' };
  }

  const workouts = loadWorkouts();
  const gelopenOp = new Set(workouts.filter(w => w?.date).map(w => w.date));
  const proven = provenStructure({ logs, currentDate });

  // ── Het basisniveau ─────────────────────────────────────────
  //
  // provenStructure kijkt naar verdragen sessies mét een herstelcheck
  // erna. Dat is de strengste en beste bron, maar hij valt stil zodra die
  // checks ontbreken — en dan zou dit plan op niveau 1 beginnen: één
  // minuut lopen, voor iemand die kilometers aaneen loopt. Daarom een
  // terugval op het langste gemeten loopblok van de afgelopen vier weken.
  // Minder streng, en daarom alleen als er niets beters is.
  const gemetenNiveau = levelForBlock(langsteBlokMinuten({ workouts, currentDate }));
  const basisNiveau = Math.max(1, proven?.level || 0, gemetenNiveau);
  const drift = restingDrift({ currentDate });
  const pem = pemFreeWeeks({ logs, currentDate });
  const luteaal = luteaalVenster({ currentDate, tot: race });
  const taperVanaf = addDays(race, -taperDays);

  const dagen = [];
  const totaal = daysBetween(currentDate, race);
  let weekIndex = 0;
  let vorigeWeek = null;

  for (let i = 0; i <= totaal; i++) {
    const datum = addDays(currentDate, i);
    const wd = dayOfWeek(datum);
    // Weken lopen van zondag tot zaterdag; een nieuwe zondag is een nieuwe week.
    const weekStart = addDays(datum, -wd);
    if (vorigeWeek && weekStart !== vorigeWeek) weekIndex++;
    vorigeWeek = weekStart;

    const isRace = datum === race;
    const inTaper = !isRace && datum >= taperVanaf;
    const inLuteaal = !isRace && !inTaper && luteaal.known
      && inVenster(datum, luteaal.windows);

    const fase = isRace ? FASE.RACE.id
      : inTaper ? FASE.TAPER.id
        : inLuteaal ? FASE.LUTEAAL.id
          : i <= 10 ? FASE.RITME.id : FASE.OPBOUW.id;

    const patroon = WEEKPATROON[wd];
    let kind = isRace ? DAG.RACE : patroon.kind;
    let rol = isRace ? 'race' : patroon.rol;
    let note = isRace ? 'Ameland. Eerste kilometer onder 140, duinen stevig wandelen.' : patroon.note;

    // In de taper verdwijnt de sleutelsessie en wordt de lange loop kort.
    if (inTaper && kind === DAG.RUN) {
      rol = 'kort';
      note = 'Kort en rustig, met vier versnellingen. Scherpte houden, niets opbouwen.';
    }
    // In de luteale week geen sleutelsessie.
    if (inLuteaal && rol === 'sleutel') {
      rol = 'easy';
      note = 'Rustig in plaats van een sleutelsessie: deze week ligt je hartslag hoger.';
    }
    // De dag vóór de race is rust, wat het patroon ook zegt.
    if (!isRace && daysBetween(datum, race) === 1) {
      kind = DAG.RUST; rol = null;
      note = 'Rust. Morgen is het zover; vandaag valt er niets meer te winnen.';
    }

    const niveau = niveauVoorWeek({ basis: basisNiveau, weekIndex, fase });
    const vorm = (kind === DAG.RUN || kind === DAG.RUN_KRACHT)
      ? vormVoor({ niveau, rol, fase }) : null;

    // ── Tijd op de benen op de lange dag ──────────────────────
    //
    // De race duurt bij haar tempo ongeveer drie kwartier. Haar
    // loopblokken bouwen in vijf weken niet naar drie kwartier aaneen —
    // dat zou roekeloos zijn — maar de duur van de inspanning moet er wél
    // een keer geweest zijn. Daarom op de lange dag een totaal aan tijd op
    // de benen: het loopblok plus wandelen tot dat totaal. Zo is de
    // racelengte bekend terrein zonder dat het aantal loopminuten
    // onverantwoord stijgt.
    const tijdOpBenen = rol === 'lang' && fase !== FASE.TAPER.id
      ? Math.min(60, 45 + weekIndex * 5) : null;

    const volgende = addDays(datum, 1);
    const volgendeIsSleutel = WEEKPATROON[dayOfWeek(volgende)]?.rol === 'sleutel'
      && fase === FASE.OPBOUW.id;
    const gisteren = addDays(datum, -1);
    const dagNaLoop = gelopenOp.has(gisteren)
      || (WEEKPATROON[dayOfWeek(gisteren)]?.kind === DAG.RUN && datum > currentDate);

    const gelopen = gelopenOp.has(datum);
    const log = logs[datum] || null;

    dagen.push({
      date: datum,
      dayName: NL_DAYS[wd],
      dayShort: NL_DAYS_SHORT[wd],
      weekIndex,
      daysToRace: daysBetween(datum, race),
      phase: fase,
      phaseLabel: (Object.values(FASE).find(f => f.id === fase) || FASE.RITME).label,
      kind, role: rol, note,
      level: vorm ? niveau : null,
      run: vorm ? {
        level: niveau,
        description: omschrijf(vorm),
        minutes: vorm.minutes,
        purpose: vorm.purpose,
        strides: rol === 'easy' || rol === 'kort',
        timeOnFeet: tijdOpBenen,
        timeOnFeetWhy: tijdOpBenen
          ? `Vul aan met wandelen tot ${tijdOpBenen} minuten op de benen. De race duurt `
            + 'ongeveer drie kwartier; die duur moet bekend terrein zijn, zonder dat je '
            + 'loopminuten onverantwoord stijgen.'
          : null,
      } : null,
      strength: (kind === DAG.KRACHT || kind === DAG.RUN_KRACHT)
        ? (wd === 3 ? KRACHT_A : KRACHT_B) : null,
      challengeDay: challengeDayNumber(datum),
      cycleDay: cycleDayOf(datum, { asOf: currentDate }),
      lateLuteal: inLuteaal,
      targets: dagdoelen({ kind, rol, fase, drift, dagVoorSleutel: volgendeIsSleutel }),
      inputs: invoerVoor({ kind, gelopen, dagNaLoop }),
      // Wat er werkelijk gebeurd is. Alleen voor vandaag en eerder; een
      // toekomstige dag heeft geen status, die heeft een voornemen.
      done: datum <= currentDate
        ? { run: gelopen, strength: !!log?.strength_done, logged: !!log }
        : null,
      isToday: datum === currentDate,
      isPast: datum < currentDate,
    });
  }

  return {
    known: true,
    raceDate: race,
    raceName,
    today: currentDate,
    daysToRace: daysBetween(currentDate, race),
    baseLevel: basisNiveau,
    baseLevelSource: proven?.basis || null,
    taperFrom: taperVanaf,
    luteal: luteaal,
    drift,
    pemFreeWeeks: pem.weeks,
    days: dagen,
    weeks: perWeek(dagen),
    levers: knoppen({ drift, proven, luteaal, dagen, currentDate, workouts }),
    note: 'Wat je vandaag loopt komt van de dagkaart zelf — die weegt je herstelcheck, '
      + 'de poort en de dosering van vandaag mee. Dit overzicht tekent de weken eromheen, '
      + 'en wordt elke keer opnieuw gerekend uit wat er werkelijk gebeurd is.',
  };
}

// Het langste loopblok van de afgelopen vier weken, in minuten. Alleen
// blokken waarin werkelijk gelopen is: wandelen haalt hier het niveau
// omlaag en dat is precies de fout die de loopdichtheid eerder maakte.
function langsteBlokMinuten({ workouts, currentDate, dagen = 28 }) {
  let langste = 0;
  for (const w of workouts) {
    if (!w?.date || w.date > currentDate || daysBetween(w.date, currentDate) > dagen) continue;
    for (const l of (Array.isArray(w.laps) ? w.laps : [])) {
      if (l?.derivedKind === 'walk') continue;
      const sec = Number(l?.movingTime), m = Number(l?.distance);
      if (!sec || !m) continue;
      const mpm = m / (sec / 60);
      if (mpm < 95) continue;              // wandeltempo
      langste = Math.max(langste, sec / 60);
    }
  }
  return Math.round(langste * 10) / 10;
}

function perWeek(dagen) {
  const uit = new Map();
  for (const d of dagen) {
    if (!uit.has(d.weekIndex)) {
      uit.set(d.weekIndex, { index: d.weekIndex, from: d.date, to: d.date,
        phase: d.phase, phaseLabel: d.phaseLabel, runs: 0, strength: 0, minutes: 0 });
    }
    const w = uit.get(d.weekIndex);
    w.to = d.date;
    if (d.run) { w.runs++; w.minutes += d.run.minutes || 0; }
    if (d.strength) w.strength++;
    w.tel = w.tel || {};
    w.tel[d.phase] = (w.tel[d.phase] || 0) + 1;
  }
  // De fase van een week is die van de meeste dagen erin; een racedag wint
  // altijd, want een week met een race erin is de raceweek. Hiervoor nam
  // een week de fase van zijn eerste dag over, en dan heette de week waarin
  // de opbouw begint nog "ritme terug".
  for (const w of uit.values()) {
    const race = w.tel[FASE.RACE.id];
    const meeste = Object.entries(w.tel).sort((a, b) => b[1] - a[1])[0][0];
    const gekozen = race ? FASE.RACE.id : meeste;
    w.phase = gekozen;
    w.phaseLabel = (Object.values(FASE).find(f => f.id === gekozen) || FASE.RITME).label;
    delete w.tel;
  }
  return [...uit.values()];
}

// ── Aan welke knoppen kun je draaien? ───────────────────────────
//
// Geen algemene tips: alleen knoppen waarvan in háár gegevens te zien is
// hoe ze ervoor staan, met de huidige stand erbij. Een knop zonder meting
// is een mening.
function knoppen({ drift, proven, luteaal, dagen, currentDate, workouts }) {
  const uit = [];

  // 1. Frequentie — de grootste, en meetbaar.
  const laatste28 = workouts.filter(w => w?.date && w.date <= currentDate
    && daysBetween(w.date, currentDate) <= 28);
  const perWeek = +(laatste28.length / 4).toFixed(1);
  const gaten = [];
  const datums = [...new Set(laatste28.map(w => w.date))].sort();
  for (let i = 1; i < datums.length; i++) gaten.push(daysBetween(datums[i - 1], datums[i]));
  const grootsteGat = gaten.length ? Math.max(...gaten) : null;
  uit.push({
    id: 'frequentie', label: 'Vaker lopen',
    stand: `${perWeek} ${perWeek === 1 ? 'loopdag' : 'loopdagen'} per week in de laatste vier weken`
      + (grootsteGat ? `, grootste gat ${grootsteGat} dagen` : ''),
    doel: '4 per week, nooit meer dan 2 dagen tussenruimte',
    waarom: 'Je economie piekte in de weken dat je om de drie à vier dagen liep en zakte '
      + 'in de weken met gaten. Dit is de knop met de grootste opbrengst en hij kost niets.',
    status: perWeek >= 3.5 && (grootsteGat == null || grootsteGat <= 3) ? 'goed' : 'open',
  });

  // 2. Eten — nu de belangrijkste, want de rusthartslag loopt op.
  if (drift?.known) {
    const omhoog = drift.direction === 'omhoog' || drift.direction === 'sterk_omhoog';
    uit.push({
      id: 'eten', label: 'Genoeg eten',
      stand: drift.line + (drift.weightDelta != null
        ? ` · gewicht ${drift.weightDelta > 0 ? '+' : ''}${drift.weightDelta} kg in dezelfde periode` : ''),
      doel: omhoog ? 'Gewicht vasthouden tot 12 december; rusthartslag terug richting 58–60'
        : 'Zo houden',
      waarom: omhoog
        ? 'Een oplopende rusthartslag tijdens afvallen betekent dat je lichaam te weinig '
          + 'brandstof heeft voor training én gewichtsverlies. Zolang dat zo is, levert '
          + 'harder trainen niets op.'
        : 'Je rusthartslag houdt gelijke tred met je training.',
      status: omhoog ? 'open' : 'goed',
    });
  }

  // 3. Kracht — twee per week, met de werkelijke stand erbij.
  const kracht28 = loadStrengthSessions()
    .filter(s => s?.date && s.date <= currentDate
      && daysBetween(s.date, currentDate) <= 28).length;
  uit.push({
    id: 'kracht', label: 'Kracht twee keer per week',
    stand: `${kracht28} ${kracht28 === 1 ? 'krachtsessie' : 'krachtsessies'} in de laatste vier weken`
      + (kracht28 >= 8 ? '' : ' — het plan zet ze op woensdag en vrijdag'),
    doel: '2 × per week, zwaar en kort (3 × 5), met kuitheffen erbij',
    waarom: 'Krachttraining verbetert de loopeconomie met enkele procenten in zes tot acht '
      + 'weken. Dat is meer dan je aerobe systeem in vijf weken kan opleveren.',
    status: kracht28 >= 6 ? 'goed' : 'open',
  });

  // 4. Pasfrequentie.
  uit.push({
    id: 'cadans', label: 'Pasfrequentie omhoog',
    stand: 'Gemeten rond 156 passen per minuut',
    doel: '164 — zelfde tempo, kortere pasjes',
    waarom: 'Minder afremmen per landing betekent minder zuurstof per kilometer, en dus '
      + 'een lagere hartslag bij hetzelfde tempo.',
    status: 'open',
  });

  // 5. De cyclus als planningsinstrument.
  if (luteaal?.known) {
    const volgende = (luteaal.windows || [])[0];
    uit.push({
      id: 'cyclus', label: 'Zware sessies buiten je laatluteale week',
      stand: volgende ? `Volgende venster: ${volgende.van} t/m ${volgende.tot}`
        : 'Geen venster meer vóór de race',
      doel: 'Kwaliteit in de eerste helft van je cyclus, rustig in de laatste week',
      waarom: 'Je twee mindere sessies vielen op cyclusdag 24 en 26. In die week ligt je '
        + 'hartslag bij hetzelfde tempo hoger; dat is geen vormverlies en het is geen week '
        + 'om iets te bewijzen.',
      status: 'goed',
    });
  }

  return uit;
}
