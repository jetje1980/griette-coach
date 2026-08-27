// Long COVID als dynamische risicolaag, niet als permanente handrem.
//
// ─────────────────────────────────────────────────────────────────
// DE HERKALIBRATIE
//
// De oude logica was: diagnose aanwezig → altijd conservatief. Dat is
// verdedigbaar zolang je niets weet, en onhoudbaar zodra je twee jaar aan
// responsdata hebt. Het levert een coach op die na tien schone weken nog
// steeds hetzelfde voorschrijft als in week één — en dat is geen veiligheid
// maar een plafond.
//
// De nieuwe regel:
//
//   Long COVID is een historische én dynamische risicofactor. De actuele
//   post-exertionele respons bepaalt hoeveel bescherming er nu nodig is.
//
// Wat blijft: de geschiedenis verdwijnt niet. Iemand die in januari 2025 een
// zware terugval had, is niet dezelfde als iemand die er nooit een had. Dat
// zit hier in de vorm van een langzamer stijgend en sneller dalend
// vertrouwen — bescherming gaat er snel op en er langzaam af.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT BESTAND NIET DOET
//
// Het beoordeelt geen enkele losse sessie. Dat doet exertionalResponse() in
// symptoms.js al, en die blijft de enige plek waar een sessie een oordeel
// krijgt. Hier worden die oordelen over weken heen gestapeld tot één
// beschermingsniveau. Eén slechte sessie is geen terugval; drie op rij wel.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { exertionalResponse, readSymptoms, RED_FLAG_IDS } from './symptoms';
import { loadWorkouts } from './workouts';
import { series, rollingMean } from './timeline';
import { cyclePosition, phasePattern, PATTERN_CONFIDENCE, PHASE } from './cyclePatterns';
import { pemSignals, PEM_WARNING_DAYS, HISTORY_DAYS, withinWarningWindow } from './pemWindow';

// ── De drie niveaus (§23) ───────────────────────────────────────
export const PESE = {
  GREEN: 'GROEN',
  ORANGE: 'ORANJE',
  RED: 'ROOD',
};

// Hoe ver terug kijken we voor het actuele beeld? Vier weken is lang genoeg
// om een patroon te zien en kort genoeg om niet aan een oude terugval vast
// te blijven zitten.
export const WINDOW_DAYS = 28;

// Hoeveel schone sessies achter elkaar geven ruimte om op te bouwen? Drie is
// de ondergrens: twee kan toeval zijn, en bij vier wordt de coach traag.
export const CLEAN_STREAK_FOR_BUILD = 3;

// Hoe lang blijft een rode episode meewegen nadat hij voorbij is? Zes weken.
// Dit is de asymmetrie: bescherming gaat er snel op en er langzaam af.
export const RED_SHADOW_DAYS = 42;

// Hoe recent moet een twijfelachtige respons zijn om déze week te bepalen?
//
// Het venster van vier weken hierboven is voor het beeld: hoe gaat het de
// laatste tijd. Maar de limiter heet "wat beperkt je deze week", en één
// tegenvallende sessie van drie weken terug hoort dat niet te zijn. Dat is
// precies waar zij op stuitte: een goede week die als "vertraagd herstel"
// werd gelabeld op grond van iets van 22 dagen geleden.
//
// Dit getal woont niet meer hier. Er is één regel voor hoe ver een
// waarschuwing terug mag kijken, en die staat in pemWindow.js — anders
// heeft "deze week" per scherm een andere lengte.
export const RECENT_RESPONSE_DAYS = PEM_WARNING_DAYS;

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));

// ── De sessies met hun respons ──────────────────────────────────
export function recentResponses({ logs = {}, currentDate = todayLocal(),
  days = WINDOW_DAYS } = {}) {
  const vanaf = addDays(currentDate, -days);
  const workouts = loadWorkouts()
    .filter(w => w?.date && w.date >= vanaf && w.date <= currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  return workouts.map(w => {
    const r = exertionalResponse({ workoutDate: w.date, logs, currentDate });
    return {
      date: w.date,
      distanceKm: w.distance != null ? Number(w.distance) : null,
      durationMin: w.duration != null ? Number(w.duration) : null,
      avgHr: w.averageHR != null ? Number(w.averageHR) : null,
      rpe: w.rpe != null ? Number(w.rpe) : null,
      response: r,
      status: r.status,
      level: r.level || null,
      tolerated: r.countsAsVolume === true,
      allowsBuild: r.allowsBuild === true,
      daysAgo: daysBetween(w.date, currentDate),
    };
  });
}

// Klachten die vandaag of gisteren gemeld zijn, los van een sessie. Deze
// mogen niet meetellen als "respons op training" maar wél als actueel beeld.
function actueleSignalen({ logs = {}, currentDate = todayLocal() } = {}) {
  const dagen = [0, 1].map(i => logs?.[addDays(currentDate, -i)]).filter(Boolean);
  const rode = [];
  for (const l of dagen) {
    for (const s of readSymptoms(l).signs) if (s.red) rode.push(s.id);
    if (l.symptom_pem) rode.push('pem_gemeld');
  }
  return { redFlags: [...new Set(rode)].filter(id => RED_FLAG_IDS.includes(id) || id === 'pem_gemeld') };
}

// PEM die zij zélf heeft aangevinkt, los van welke sessie dan ook.
//
// Dit was een gat waar een test op stuitte: de responslaag hangt aan
// geregistreerde workouts, en een PEM-dag zonder bijbehorende sessie in
// gc_workouts telde daardoor voor niets. Dat is precies verkeerd om — een
// dag die zij als PEM markeert is de directste uitspraak die er is over haar
// belastbaarheid, en of er een horloge aan te pas kwam doet daar niet aan af.
// Beide getallen stonden hier: veertien dagen om iets "gemeld" te noemen en
// zeven om het "vers" te noemen. Dat eerste venster leidde tot een
// waarschuwing op grond van een melding van bijna twee weken terug. Nu geldt
// alleen het venster uit pemWindow.js; de rest is historie om te tonen.
export const PEM_REPORT_WINDOW = PEM_WARNING_DAYS;
export const PEM_FRESH_DAYS = PEM_WARNING_DAYS;

export function selfReportedPem({ currentDate = todayLocal() } = {}) {
  const p = pemSignals({ asOf: currentDate });
  return {
    // `any` betekent nu: binnen het venster. Alles daarbuiten is historie en
    // stuurt niets meer.
    any: p.warning,
    count: p.count,
    lastDate: p.lastDate,
    daysAgo: p.daysAgo,
    fresh: p.warning,
    dates: p.dates,
    history: p.history,
    windowDays: p.windowDays,
    note: p.note,
  };
}

// ── Dagelijks functioneren ──────────────────────────────────────
// §23 noemt "dagelijkse functie" bij alle drie de niveaus. Dat is geen apart
// veld in de app maar wel af te leiden: energie, dagcapaciteit en stappen
// samen zeggen of het gewone leven nog lukt.
export function dailyFunction({ currentDate = todayLocal() } = {}) {
  const energie = rollingMean('energy', 5, { asOf: currentDate });
  const energieBasis = rollingMean('energy', 42, { asOf: currentDate });
  const stappen = rollingMean('steps', 5, { asOf: currentDate });
  const stappenBasis = rollingMean('steps', 42, { asOf: currentDate });

  if (energie == null && stappen == null) {
    return { known: false, note: 'Geen energie- of stappendata om dagelijks functioneren aan af te lezen.' };
  }

  const energieAf = energie != null && energieBasis != null && energie < energieBasis - 0.4;
  const stappenAf = stappen != null && stappenBasis != null && stappenBasis > 0 &&
    stappen < stappenBasis * 0.75;

  return {
    known: true,
    energy: energie, energyBaseline: energieBasis,
    steps: stappen != null ? Math.round(stappen) : null,
    stepsBaseline: stappenBasis != null ? Math.round(stappenBasis) : null,
    impaired: energieAf || stappenAf,
    signals: [
      energieAf ? `energie ${rond(energie, 1)} tegenover je eigen basislijn ${rond(energieBasis, 1)}` : null,
      stappenAf ? `stappen ${Math.round(stappen)} tegenover je basislijn ${Math.round(stappenBasis)}` : null,
    ].filter(Boolean),
    note: energieAf || stappenAf
      ? 'Je dagelijks functioneren ligt onder je eigen basislijn.'
      : 'Je dagelijks functioneren zit op je eigen basislijn.',
  };
}

// ── De classificatie (§23) ──────────────────────────────────────
export function peseState({ logs = {}, currentDate = todayLocal() } = {}) {
  const sessies = recentResponses({ logs, currentDate });
  const functie = dailyFunction({ currentDate });
  const acuut = actueleSignalen({ logs, currentDate });
  const zelfPem = selfReportedPem({ currentDate });
  const signalen = [];

  // Waarschuwen en bewijzen zijn twee verschillende dingen.
  //
  // De regel is: een wáárschuwing mag alleen steunen op vandaag plus zeven
  // dagen. Maar positief bewijs is geen waarschuwing, en dat venster mag
  // dus langer zijn — anders kan er nooit meer opgebouwd worden. Wie twee
  // keer per week loopt, krijgt drie schone sessies simpelweg niet binnen
  // zeven dagen. Dat was mijn eerste poging, en die maakte de coach
  // permanent voorzichtig: precies de fout die dit project bestrijdt.
  //
  //   binnen 7 dagen  → mag oranje of rood veroorzaken
  //   volledig venster → telt mee als bewijs dat het goed gaat
  //
  // Een oude tegenvallende sessie breekt dus wél de schone reeks (want hij
  // wás niet schoon), maar veroorzaakt geen waarschuwing meer.
  const recent = sessies.filter(s => withinWarningWindow(s.date, currentDate));
  const beantwoord = sessies.filter(s => !['pending', 'unanswered'].includes(s.status));
  const alleRode = sessies.filter(s => s.status === 'red');
  // Een rode respons binnen het venster stuurt; daarbuiten valt hij onder de
  // schaduwregeling verderop, die wél langer meeweegt maar niet als acute
  // waarschuwing.
  const rode = alleRode.filter(s => withinWarningWindow(s.date, currentDate));
  const alleSlechte = sessies.filter(s => s.status === 'poor');
  void alleSlechte;
  // Alleen wat binnen het recente venster valt bepaalt deze week. Oudere
  // slechte responsen blijven zichtbaar als historie, maar sturen niet.
  const slechte = alleSlechte.filter(s => withinWarningWindow(s.date, currentDate));
  const oudeSlechte = alleSlechte.filter(s => !withinWarningWindow(s.date, currentDate));
  // Milde en onbeantwoorde sessies zijn zwakke waarschuwingen: alleen binnen
  // het venster.
  const milde = recent.filter(s => s.status === 'mild');
  const onbeantwoord = recent.filter(s => s.status === 'unanswered');
  // Schone sessies zijn bewijs, geen waarschuwing: volledig venster.
  const schone = sessies.filter(s => s.status === 'good');

  // De schone reeks aan het eind, over het volledige venster. Een sessie die
  // niet schoon was breekt hem — ook als hij ouder is dan zeven dagen, want
  // hij was nu eenmaal niet schoon.
  let reeks = 0;
  for (let i = sessies.length - 1; i >= 0; i--) {
    if (sessies[i].status === 'pending') continue;
    if (sessies[i].status === 'good') reeks++; else break;
  }

  // Een rode episode die nog binnen de schaduw valt, ook als hij buiten het
  // venster van vier weken ligt.
  const schaduw = recentResponses({ logs, currentDate, days: RED_SHADOW_DAYS })
    .filter(s => s.status === 'red');

  // ── ROOD ────────────────────────────────────────────────────
  if (acuut.redFlags.length) {
    signalen.push(`alarmsignalen vandaag of gisteren: ${acuut.redFlags.join(', ')}`);
    return uitkomst(PESE.RED, 'hoog', signalen, {
      reason: 'Er zijn vandaag of gisteren alarmsignalen gemeld. Dat gaat vóór elk trainingsplan.',
      advice: 'Actieve bescherming: vandaag geen belasting, en pas opbouwen als dit twee dagen weg is.',
      sessies, functie, reeks,
    });
  }
  if (rode.length) {
    signalen.push(`${rode.length} sessie(s) met abnormale respons in ${WINDOW_DAYS} dagen (${rode.map(s => s.date).join(', ')})`);
    if (functie.impaired) signalen.push(...functie.signals);
    return uitkomst(PESE.RED, 'hoog', signalen, {
      reason: `Duidelijke disproportionele vertraagde verslechtering na inspanning: ${rode[rode.length - 1].response.reason}`,
      advice: 'Actieve PESE-bescherming. Geen opbouw, en de sessie die dit uitlokte telt niet als bewezen belastbaarheid.',
      sessies, functie, reeks,
    });
  }
  // Meerdere systemen tegelijk plus verminderd functioneren: ook rood, ook
  // zonder één enkele sessie die er als rood uitsprong.
  if (slechte.length >= 2 && functie.impaired) {
    signalen.push(`${slechte.length} sessies met duidelijke post-exertionele respons`);
    signalen.push(...functie.signals);
    return uitkomst(PESE.RED, 'redelijk', signalen, {
      reason: 'Herhaalde duidelijke respons na inspanning én dagelijks functioneren onder je basislijn. Samen is dat het patroon waar bescherming voor bedoeld is.',
      advice: 'Actieve PESE-bescherming tot het dagelijks functioneren terug is op je basislijn.',
      sessies, functie, reeks,
    });
  }

  // Zelf gemelde PEM in de afgelopen week weegt zwaar genoeg om groen uit te
  // sluiten, ook als elke geregistreerde sessie schoon was. Zij weet eerder
  // dan de data dat het misgaat.
  if (zelfPem.fresh) {
    signalen.push(`zelf gemelde PEM op ${zelfPem.lastDate} (${zelfPem.daysAgo} dagen geleden)`);
    if (functie.impaired) signalen.push(...functie.signals);
    const zwaar = zelfPem.count >= 2 && functie.impaired;
    return uitkomst(zwaar ? PESE.RED : PESE.ORANGE, 'redelijk', signalen, {
      reason: zwaar
        ? `Je hebt ${zelfPem.count} keer PEM gemeld in twee weken én je dagelijks functioneren ligt onder je basislijn.`
        : `Je hebt zelf PEM gemeld op ${zelfPem.lastDate}. Dat telt, ook als de sessies eromheen schoon oogden.`,
      advice: zwaar
        ? 'Actieve PESE-bescherming tot het dagelijks functioneren terug is.'
        : 'Herhaal het huidige niveau. Opbouwen kan als er een week zonder PEM-melding voorbij is.',
      sessies, functie, reeks,
    });
  }

  // ── ORANJE ──────────────────────────────────────────────────
  if (!beantwoord.length) {
    if (sessies.length) signalen.push(`${sessies.length} sessie(s), geen enkele met een ingevulde herstelcheck`);
    else signalen.push(`geen sessies in ${WINDOW_DAYS} dagen`);
    return uitkomst(PESE.ORANGE, 'laag', signalen, {
      reason: sessies.length
        ? 'Er is getraind, maar het 24–48-uursvenster is niet ingevuld. Zonder die gegevens is niet vast te stellen of het verdragen werd.'
        : 'Er zijn geen recente sessies om een respons aan af te lezen.',
      advice: 'Herhaal het huidige niveau of maak een kleinere stap. Ontbrekende gegevens zijn geen groen licht.',
      sessies, functie, reeks,
    });
  }
  if (slechte.length) {
    signalen.push(`${slechte.length} sessie(s) met duidelijke respons in de afgelopen ${RECENT_RESPONSE_DAYS} dagen`);
    return uitkomst(PESE.ORANGE, 'redelijk', signalen, {
      // Niet nóg een kop voor de reden plakken: response.reason begint al
      // met "Duidelijke post-exertionele respons: …". Twee koppen achter
      // elkaar leest als een systeem dat zichzelf herhaalt.
      reason: `${slechte[slechte.length - 1].response.reason} (${slechte[slechte.length - 1].date}, ${slechte[slechte.length - 1].daysAgo} dagen geleden)`,
      advice: 'Hold of herhaal. Bouw pas op als de volgende sessie schoon verdragen wordt.',
      sessies, functie, reeks,
    });
  }
  if (schaduw.length) {
    const laatste = schaduw[schaduw.length - 1];
    signalen.push(`rode episode op ${laatste.date}, ${daysBetween(laatste.date, currentDate)} dagen geleden`);
    if (reeks >= CLEAN_STREAK_FOR_BUILD) signalen.push(`inmiddels ${reeks} schone sessies op rij`);
    return uitkomst(PESE.ORANGE, 'redelijk', signalen, {
      reason: `De laatste rode episode is ${daysBetween(laatste.date, currentDate)} dagen geleden. Bescherming gaat er sneller op dan af — dat is met opzet zo.`,
      advice: reeks >= CLEAN_STREAK_FOR_BUILD
        ? 'Kleine stappen mogen weer. Eén variabele tegelijk, en pas de volgende stap na een schone respons.'
        : 'Herhaal het huidige niveau tot er drie schone sessies op rij staan.',
      sessies, functie, reeks,
    });
  }
  if (onbeantwoord.length > schone.length) {
    signalen.push(`${onbeantwoord.length} van ${sessies.length} sessies zonder ingevulde herstelcheck`);
    return uitkomst(PESE.ORANGE, 'laag', signalen, {
      reason: 'Meer sessies zonder herstelcheck dan met. Het beeld is te dun om op te bouwen.',
      advice: 'Vul na de volgende sessie de check binnen 48 uur in; dan komt hier een echt oordeel te staan.',
      sessies, functie, reeks,
    });
  }
  if (milde.length && reeks < CLEAN_STREAK_FOR_BUILD) {
    signalen.push(`${milde.length} sessie(s) met milde respons, ${reeks} schone op rij`);
    return uitkomst(PESE.ORANGE, 'redelijk', signalen, {
      reason: 'Milde responsen die niet ernstig zijn, maar ook niet schoon. Verdragen is niet hetzelfde als ruimte om op te bouwen.',
      advice: 'Houd het niveau vast tot de reeks schoon is.',
      sessies, functie, reeks,
    });
  }

  // ── GROEN ───────────────────────────────────────────────────
  signalen.push(`${reeks} schone sessies op rij`);
  signalen.push(`${schone.length} van ${beantwoord.length} beantwoorde sessies goed verdragen`);
  if (zelfPem.any) {
    signalen.push(`laatste zelf gemelde PEM ${zelfPem.daysAgo} dagen geleden, buiten het verse venster`);
  }
  if (oudeSlechte.length) {
    const laatste = oudeSlechte[oudeSlechte.length - 1];
    signalen.push(`één eerdere tegenvallende respons op ${laatste.date} (${laatste.daysAgo} dagen geleden) — te lang geleden om deze week te sturen`);
  }
  if (functie.known) signalen.push(functie.note.toLowerCase());
  return uitkomst(PESE.GREEN, reeks >= CLEAN_STREAK_FOR_BUILD ? 'hoog' : 'redelijk', signalen, {
    reason: `Je laatste ${reeks} sessies zijn zonder vertraagde verslechtering verwerkt en je dagelijks functioneren is normaal.`,
    advice: reeks >= CLEAN_STREAK_FOR_BUILD
      ? 'Zoek progressie. Bij dit beeld is hetzelfde blijven doen geen veiligheid maar ondertraining.'
      : `Nog ${CLEAN_STREAK_FOR_BUILD - reeks} schone sessie(s) tot er ruimte is voor een stap.`,
    sessies, functie, reeks,
  });
}

function uitkomst(state, confidence, signals, extra) {
  return {
    state, confidence, signals,
    allowsBuild: state === PESE.GREEN && extra.reeks >= CLEAN_STREAK_FOR_BUILD,
    protective: state === PESE.RED,
    cleanStreak: extra.reeks,
    sessionCount: extra.sessies.length,
    dailyFunction: extra.functie,
    reason: extra.reason,
    advice: extra.advice,
    sessions: extra.sessies.map(s => ({ date: s.date, status: s.status, level: s.level })),
  };
}

// ── De dynamische risicolaag (§21) ──────────────────────────────
// Hoeveel bescherming is er nu nodig? Dit is de vertaling van de PESE-status
// naar één getal waar de trainingssturing mee kan rekenen, plus de zin die
// uitlegt waarom het niet meer is dan dat.
export const PROTECTION = {
  FULL: 1.00,      // volledige bescherming: geen belasting
  HIGH: 0.60,
  MODERATE: 0.80,
  LIGHT: 0.95,
  NONE: 1.00,      // geen rem: het gewone plan geldt
};

export function longCovidRisk({ logs = {}, currentDate = todayLocal() } = {}) {
  const p = peseState({ logs, currentDate });

  // De geschiedenis telt mee, maar als context — niet als plafond.
  const alleSessies = recentResponses({ logs, currentDate, days: 365 });
  const rodeOoit = alleSessies.filter(s => s.status === 'red');
  const laatsteRood = rodeOoit.length ? rodeOoit[rodeOoit.length - 1].date : null;
  const pemReeks = series('symptom_pem', { asOf: currentDate });
  const laatstePem = pemReeks.length ? pemReeks[pemReeks.length - 1].observedAt : null;
  const vrijDagen = laatstePem ? daysBetween(laatstePem, currentDate) : null;

  let niveau, factor;
  if (p.state === PESE.RED) {
    niveau = p.protective && p.signals.some(s => /alarmsignalen/.test(s)) ? 'volledig' : 'hoog';
    factor = niveau === 'volledig' ? 0 : PROTECTION.HIGH;
  } else if (p.state === PESE.ORANGE) {
    niveau = 'gematigd'; factor = PROTECTION.MODERATE;
  } else {
    niveau = p.allowsBuild ? 'geen' : 'licht';
    factor = p.allowsBuild ? PROTECTION.NONE : PROTECTION.LIGHT;
  }

  return {
    pese: p.state,
    protection: niveau,
    loadFactor: factor,
    allowsBuild: p.allowsBuild,
    confidence: p.confidence,
    history: {
      lastRedResponse: laatsteRood,
      redResponsesYear: rodeOoit.length,
      lastPem: laatstePem,
      pemFreeDays: vrijDagen,
    },
    signals: p.signals,
    reason: p.reason,
    advice: p.advice,
    // De zin die de herkalibratie draagt. Hij hoort in de app te staan, niet
    // alleen in dit commentaar.
    principle: 'Long COVID is een historische én dynamische risicofactor. Wat je nu aankunt volgt uit je recente respons, niet uit je diagnose.',
    note: p.state === PESE.GREEN && p.allowsBuild
      ? `Geen actieve rem. ${vrijDagen != null ? `Laatste PEM-signaal ${vrijDagen} dagen geleden.` : 'Geen PEM-signaal geregistreerd.'} De diagnose blijft in je geschiedenis staan, maar hij bepaalt vandaag niet je plafond.`
      : `Bescherming ${niveau}. ${p.reason}`,
  };
}

// ── Hormonaal is niet automatisch PESE (§24) ────────────────────
//
// Het scenario dat hier misgaat: hogere hartslag, slechter slapen, meer
// bloating, subjectief zwaarder — maar geen vertraagde verslechtering en
// een normaal dagelijks functioneren. Dat leest als een terugval en is het
// waarschijnlijk niet.
//
// Deze functie kiest niet vóór "hormonaal". Ze stelt vast wélk van de twee
// verhalen door de data gedragen wordt, en zegt het eerlijk als dat geen van
// beide is.
export const ATTRIBUTION = {
  PESE: 'post-exertioneel',
  HORMONAL: 'hormonaal/contextueel',
  BOTH: 'allebei mogelijk',
  NEITHER: 'geen van beide aanwijsbaar',
  UNKNOWN: 'te weinig gegevens',
};

export function attributeSymptoms({ logs = {}, currentDate = todayLocal() } = {}) {
  const p = peseState({ logs, currentDate });
  const functie = dailyFunction({ currentDate });
  const pos = cyclePosition(currentDate, { asOf: currentDate });

  const laatste = (m, dagen = 3) => {
    const s = series(m, { asOf: currentDate, since: addDays(currentDate, -dagen) });
    return s.length ? s[s.length - 1].value : null;
  };

  // De klachten die in beide verhalen passen.
  const gedeeld = [];
  const hrNu = rollingMean('hr_rest', 5, { asOf: currentDate });
  const hrBasis = rollingMean('hr_rest', 42, { asOf: currentDate });
  if (hrNu != null && hrBasis != null && hrNu > hrBasis + 2) {
    gedeeld.push(`rusthartslag ${Math.round(hrNu)} tegenover je basislijn ${Math.round(hrBasis)}`);
  }
  const slaapNu = rollingMean('sleep_hours', 5, { asOf: currentDate });
  const slaapBasis = rollingMean('sleep_hours', 42, { asOf: currentDate });
  if (slaapNu != null && slaapBasis != null && slaapNu < slaapBasis - 0.5) {
    gedeeld.push(`slaap ${rond(slaapNu, 1)} u tegenover ${rond(slaapBasis, 1)} u`);
  }

  // De klachten die alleen in het hormonale verhaal passen.
  const hormonaal = [];
  for (const [m, label] of [['bloating', 'opgeblazen gevoel'], ['puffiness', 'vocht in het gezicht'],
    ['hot_flashes', 'opvliegers'], ['night_sweats', 'nachtzweten'],
    ['breast_tenderness', 'gevoelige borsten'], ['cravings', 'cravings']]) {
    if (laatste(m)) hormonaal.push(label);
  }

  // Wat het onderscheid werkelijk maakt: is er vertraagde verslechtering, en
  // functioneert het gewone leven?
  const vertraagd = p.state === PESE.RED ||
    p.sessions.some(s => ['red', 'poor'].includes(s.status));
  const functieAf = functie.impaired === true;

  // En: herhaalt dit zich in eerdere cycli op dezelfde plek? Dat is het enige
  // bewijs dat "hormonaal" meer is dan een uitvlucht.
  const patronen = [];
  if (pos.known && pos.phase !== PHASE.UNKNOWN) {
    for (const m of ['hr_rest', 'sleep_hours', 'bloating', 'weight']) {
      const pat = phasePattern(m, pos.phase, { asOf: currentDate });
      if (pat.known && pat.confidence !== PATTERN_CONFIDENCE.NONE) patronen.push(pat);
    }
  }

  let oordeel, uitleg;
  if (!gedeeld.length && !hormonaal.length && !vertraagd) {
    oordeel = ATTRIBUTION.NEITHER;
    uitleg = 'Er zijn geen klachten om toe te schrijven. Dit is gewoon een normale week.';
  } else if (vertraagd && functieAf) {
    oordeel = ATTRIBUTION.PESE;
    uitleg = 'Er is vertraagde verslechtering ná inspanning én je dagelijks functioneren ligt onder je basislijn. Dat is het post-exertionele patroon, en dat gaat voor.';
  } else if (!vertraagd && !functieAf && (hormonaal.length >= 2 || patronen.length)) {
    oordeel = ATTRIBUTION.HORMONAL;
    uitleg = `Je hartslag en slaap wijken af, maar er is geen vertraagde verslechtering na inspanning en je dagelijks functioneren is normaal.${hormonaal.length ? ` Wat er wél is: ${hormonaal.join(', ')}.` : ''}${patronen.length ? ` En dit herhaalt zich in je eigen cyclusdata: ${patronen[0].note}` : ' Dit patroon is nog niet in eerdere cycli teruggezien, dus dit blijft een waarschijnlijkheid, geen vaststelling.'}`;
  } else if (vertraagd) {
    oordeel = ATTRIBUTION.BOTH;
    uitleg = 'Er is vertraagde respons na inspanning én er zijn hormonale signalen. Welke van de twee zwaarder weegt is hier niet uit te maken; de voorzichtige lezing telt.';
  } else if (!gedeeld.length && hormonaal.length) {
    oordeel = ATTRIBUTION.HORMONAL;
    uitleg = `Alleen hormonale signalen (${hormonaal.join(', ')}), zonder afwijking in hartslag, slaap of herstel.`;
  } else {
    oordeel = ATTRIBUTION.UNKNOWN;
    uitleg = 'Er zijn klachten, maar te weinig gegevens om ze aan iets toe te schrijven. Vul de herstelcheck na je volgende sessie in — dat is het veld dat het onderscheid maakt.';
  }

  return {
    attribution: oordeel,
    shared: gedeeld,
    hormonalOnly: hormonaal,
    delayedWorsening: vertraagd,
    dailyFunctionImpaired: functieAf,
    cyclePhase: pos.phase,
    cycleDay: pos.day ?? null,
    supportingPatterns: patronen,
    explanation: uitleg,
    // De consequentie voor de training, want daar gaat het uiteindelijk om.
    lowerLoad: oordeel === ATTRIBUTION.PESE || oordeel === ATTRIBUTION.BOTH,
    note: oordeel === ATTRIBUTION.HORMONAL
      ? 'Hormonale signalen zijn geen Long-COVID-terugval. Zolang er geen vertraagde verslechtering is en het gewone leven doorgaat, hoeft de trainingsprikkel hier niet voor omlaag.'
      : oordeel === ATTRIBUTION.PESE
        ? 'Dit is wél het post-exertionele patroon. De belasting gaat omlaag, ongeacht waar je in je cyclus zit.'
        : null,
  };
}
