// De diepe analyse: gaat de loopeconomie werkelijk achteruit, of lijkt dat zo?
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT TOEVOEGT AAN economyReading()
//
// economyReading() geeft een oordeel met één laag eromheen. Dat is genoeg
// voor een kaart op het scherm, maar niet om advies op te bouwen. Zij vroeg
// om meer: weeg álle factoren, neem mee dat de wandelpauzes korter worden,
// en geef daar advies op.
//
// Dit bestand legt daarom de hele rekening op tafel:
//
//   1. DE METING        tempo bij hartslag, per sessie, met de datum erbij
//   2. DE VORM          wandelpauze, bloklengte, loopaandeel, werk-rustratio
//   3. DE OMSTANDIGHEDEN cyclusdag, slaap, ondergrond, weer, tijdstip
//   4. HAAR LEZING      wat zij er zelf bij schreef, woordelijk
//   5. DE WEGING        welke verklaring hoeveel gewicht krijgt, en waarom
//
// En dan één uitspraak met een advies dat uit die weging volgt — niet uit
// het laatste getal.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL
//
// Elke kandidaat-verklaring krijgt een gewicht en een reden. Wat niet van
// toepassing is, wordt óók genoemd ("cyclus: niet van toepassing, beide
// reeksen in dezelfde fase"), want een factor die stil wordt overgeslagen
// lijkt achteraf te zijn meegewogen terwijl dat niet gebeurde.
//
// Onbekend is een waarde. "Daar weet ik niets van" is een uitkomst en geen
// nul, en hij hoort in het advies terecht te komen als: dit moet je eerst
// vastleggen voordat ik er iets over kan zeggen.
// ─────────────────────────────────────────────────────────────────

import { todayLocal } from './datetime';
import { economyReading } from './economyReading';
import { densityTrend, densityByDate } from './sessionDensity';
import { sessionContextFor, contextLines } from './sessionContext';
import { continuityTrend, earlyWarnings } from './runningHistory';
import { fmtPace } from './workouts';

// Hoe zwaar weegt een verklaring? Drie niveaus, niet meer — meer schijnt
// precisie die er niet is.
export const WEIGHT = {
  GROOT: { id: 'groot', label: 'verklaart dit waarschijnlijk', rank: 3 },
  MATIG: { id: 'matig', label: 'draagt eraan bij', rank: 2 },
  GEEN: { id: 'geen', label: 'niet van toepassing', rank: 1 },
  ONBEKEND: { id: 'onbekend', label: 'onbekend — niet vastgelegd', rank: 0 },
};

export function economyAnalysis({ logs = {}, currentDate = todayLocal() } = {}) {
  const warn = earlyWarnings({ logs, currentDate });
  const duur = continuityTrend(warn.rows || []);
  const lezing = economyReading({ logs, currentDate,
    continuityGrowing: duur.growing, continuityFrom: duur.fromMin, continuityTo: duur.toMin });

  if (!lezing.available) {
    return { available: false, level: lezing.level, note: lezing.note,
      advice: ['Er is nog niets te vergelijken. Loop een paar sessies met de rondeknop aan bij elk loop- en wandelblok; dan is loop- van wandeltempo te scheiden en kan dit gevuld worden.'] };
  }

  const punten = lezing.econ.points || [];
  const helft = Math.floor(punten.length / 2);
  const vroegD = punten.slice(0, helft).map(p => p.date);
  const laatD = punten.slice(helft).map(p => p.date);

  const dichtheid = densityByDate({ currentDate });
  const vorm = lezing.density && lezing.density.available
    ? lezing.density
    : densityTrend({ earlyDates: vroegD, lateDates: laatD, currentDate, byDate: dichtheid });

  // ── 1. De sessies zelf, op tafel ──────────────────────────────
  const sessies = punten.map(p => {
    const ctx = sessionContextFor(p.date, { logs, asOf: currentDate });
    const d = dichtheid[p.date] || null;
    return {
      date: p.date,
      half: vroegD.includes(p.date) ? 'eerder' : 'recent',
      runPace: p.runPace, runPaceLabel: fmtPace(p.runPace), hr: p.hr,
      blockMin: d?.blockMin ?? null,
      pausePerBlockMin: d?.pausePerBlockMin ?? null,
      workRestRatio: d?.workRestRatio ?? null,
      runShare: d?.runShare ?? null,
      cycleDay: ctx.cycleDay,
      sleepHours: ctx.sleepHours,
      answers: ctx.answers,
      note: ctx.note,
      contextLines: contextLines(ctx),
    };
  });

  // ── 2. De kandidaat-verklaringen, elk met gewicht en reden ────
  const factoren = [];
  const voegToe = (id, naam, gewicht, tekst) =>
    factoren.push({ id, naam, weight: gewicht.id, weightLabel: gewicht.label,
      rank: gewicht.rank, text: tekst });

  // De vorm van de sessie — de factor die zij miste.
  if (!vorm.available) {
    voegToe('vorm', 'vorm van de sessies', WEIGHT.ONBEKEND,
      vorm.note || 'Te weinig sessies met ronden om wandelpauze en bloklengte te vergelijken.');
  } else if (vorm.toContinuous) {
    voegToe('vorm', 'vorm van de sessies', WEIGHT.GROOT,
      'Je bent doorlopend gaan lopen in plaats van met wandelpauzes. Dat is de zwaarste vorm die er is; trager lopen hoort daarbij.');
  } else if (vorm.denser) {
    voegToe('vorm', 'wandelpauze tussen de blokken', WEIGHT.GROOT,
      `${vorm.lines.join(' ')} ${vorm.why}`);
  } else if (vorm.blockLonger) {
    voegToe('vorm', 'lengte van de loopblokken', WEIGHT.GROOT,
      `Je loopblokken werden langer (${vorm.blockFrom} → ${vorm.blockTo} min). Langer aan één stuk bij dezelfde hartslag betekent een lager tempo in dat blok.`);
  } else {
    voegToe('vorm', 'vorm van de sessies', WEIGHT.GEEN,
      `De vorm bleef vergelijkbaar: wandelpauze ${vorm.pauseFrom} → ${vorm.pauseTo} min, bloklengte ${vorm.blockFrom} → ${vorm.blockTo} min. Dit verklaart het tempoverschil dus niet.`);
  }

  // De doorlopende opbouw, los van de dichtheid.
  if (duur.growing) {
    voegToe('continuiteit', 'doorlopend kunnen lopen', WEIGHT.GROOT,
      `Je langste doorlopende blok groeide van ${duur.fromMin} naar ${duur.toMin} minuten. Dat is uithoudingsvermogen dat toeneemt.`);
  }

  // De omstandigheden uit economyReading, met hun eigen gewicht.
  const stoorIds = new Set();
  for (const c of (lezing.confounders?.items || [])) {
    stoorIds.add(c.id);
    voegToe(c.id, naamVan(c.id), c.zwaarte === 'groot' ? WEIGHT.GROOT : WEIGHT.MATIG, c.tekst);
  }
  // En expliciet wat níét meespeelde of niet bekend is. Een factor die
  // stilzwijgend wordt overgeslagen, lijkt achteraf meegewogen.
  for (const [id, naam] of [['cyclus', 'cyclusfase'], ['slaap', 'slaap'],
    ['ondergrond', 'ondergrond'], ['weer', 'weer'], ['tijdstip', 'tijdstip van de dag'],
    ['gegeten', 'eten vooraf']]) {
    if (stoorIds.has(id)) continue;
    const bekend = sessies.filter(s => id === 'cyclus' ? s.cycleDay != null
      : id === 'slaap' ? s.sleepHours != null : !!s.answers?.[id]).length;
    if (bekend === 0) {
      voegToe(id, naam, WEIGHT.ONBEKEND,
        `Van geen van de ${sessies.length} vergeleken sessies is dit vastgelegd.`);
    } else if (bekend < Math.ceil(sessies.length / 2)) {
      voegToe(id, naam, WEIGHT.ONBEKEND,
        `Alleen van ${bekend} van de ${sessies.length} sessies bekend — te weinig om te vergelijken.`);
    } else {
      voegToe(id, naam, WEIGHT.GEEN,
        `Bekend van ${bekend} van de ${sessies.length} sessies, en de twee reeksen verschillen hierin niet.`);
    }
  }

  factoren.sort((a, b) => b.rank - a.rank);

  // ── 3. De uitspraak ───────────────────────────────────────────
  const echtAchteruit = lezing.level === 'achteruit';
  const verklaard = ['dichter', 'ruil', 'onverklaard'].includes(lezing.level);
  const teWeinig = ['waarneming', 'onvoldoende_context'].includes(lezing.level);

  const verdict = echtAchteruit
    ? 'echt_achteruit'
    : verklaard ? 'verklaard_door_factoren'
    : teWeinig ? 'nog_niet_te_zeggen'
    : lezing.level === 'vooruit' ? 'vooruit' : 'stabiel';

  // ── 4. Het advies, dat uit de weging volgt ────────────────────
  const advies = [];
  const zwaar = factoren.filter(f => f.weight === 'groot');
  const onbekend = factoren.filter(f => f.weight === 'onbekend');

  if (verdict === 'echt_achteruit') {
    advies.push('Niet doorbouwen. Houd twee weken hetzelfde niveau vast: zelfde bloklengte, zelfde wandelpauze, zelfde hartslagplafond. Loop je dan weer op je oude tempo, dan was het vermoeidheid; blijft het staan, dan is het de belasting.');
    advies.push('Verlaag niet het tempo én het volume tegelijk. Eén as per keer, anders weet je achteraf niet wat hielp.');
    if (onbekend.length) {
      advies.push(`Leg bij de komende sessies vast wat nu ontbreekt (${onbekend.map(f => f.naam).join(', ')}). Dan kan de volgende vergelijking dit uitsluiten in plaats van open laten.`);
    }
  } else if (verdict === 'verklaard_door_factoren') {
    advies.push(`Dit is geen vormverlies. ${zwaar[0]?.text || ''}`.trim());
    if (vorm.denser || vorm.toContinuous) {
      advies.push('Je hebt op twee assen tegelijk gewonnen: minder rust én hetzelfde werk. Verwacht hier een lager tempo en reken het niet af. Wil je het tempo terugzien, zet dan de wandelpauze één sessie terug op de oude lengte — dan zie je wat er werkelijk veranderd is.');
    } else {
      advies.push('Doorgaan zoals je bezig bent. Wel: laat één van de verstorende factoren gelijk voordat je de volgende conclusie trekt, anders blijft de vergelijking scheef.');
    }
  } else if (verdict === 'nog_niet_te_zeggen') {
    advies.push('Hier valt nog geen uitspraak over te doen. Niet terugschalen op grond hiervan, en ook niet versnellen.');
    if (onbekend.length) {
      advies.push(`Wat de vergelijking nu blokkeert: ${onbekend.map(f => f.naam).join(', ')} is niet vastgelegd. Vul dat bij de volgende drie sessies in.`);
    }
  } else if (verdict === 'vooruit') {
    advies.push('Dit is echte winst. De stap omhoog is verdiend, maar neem er één: of langer, of minder pauze, of sneller — niet twee.');
  } else {
    advies.push('Stabiel is in deze fase precies goed. Consistentie telt hier zwaarder dan een seconde per kilometer.');
    if (vorm.denser || vorm.blockLonger) {
      advies.push('En het is meer dan stabiel: hetzelfde tempo bij een zwaardere vorm is vooruitgang die het tempo niet laat zien.');
    }
  }

  return {
    available: true,
    level: lezing.level,
    verdict,
    label: lezing.label,
    detail: lezing.detail,
    question: lezing.vraag || null,
    measurement: {
      gainSec: lezing.econ.gainSec,
      sessions: lezing.econ.count,
      hrFrom: lezing.econ.early.hr, hrTo: lezing.econ.late.hr,
      paceFrom: fmtPace(lezing.econ.early.pace), paceTo: fmtPace(lezing.econ.late.pace),
      hrDrift: lezing.econ.hrDrift,
    },
    form: vorm,
    factors: factoren,
    sessions: sessies,
    ownReadings: (lezing.confounders?.notes || []),
    advice: advies,
    // Eén regel die het geheel samenvat, voor een kop of een chip.
    summary: `${lezing.label}. ${zwaar.length
      ? `Zwaarst wegende verklaring: ${zwaar[0].naam}.`
      : onbekend.length ? `Nog ${onbekend.length} factor(en) niet vastgelegd.`
      : 'Geen verklarende factor gevonden.'}`,
  };
}

function naamVan(id) {
  return { cyclus: 'cyclusfase', slaap: 'slaap', ondergrond: 'ondergrond',
    weer: 'weer', tijdstip: 'tijdstip van de dag', gegeten: 'eten vooraf',
    vorm: 'vorm van de sessies' }[id] || id;
}

// De analyse als tekstblok voor de coachprompt. Eén bron, zodat het model
// en het scherm niet twee verschillende verhalen krijgen.
export function analysisAsText(a) {
  if (!a?.available) {
    return `LOOPECONOMIE: ${a?.note || 'nog niets te vergelijken'}\n  ${(a?.advice || []).join(' ')}`;
  }
  const L = [];
  L.push('LOOPECONOMIE — DIEPE ANALYSE:');
  L.push(`  uitspraak: ${a.verdict} (${a.label})`);
  L.push(`  meting: ${a.measurement.gainSec} sec/km verschil over ${a.measurement.sessions} vergelijkbare sessies · ` +
    `tempo ${a.measurement.paceFrom} → ${a.measurement.paceTo} bij hartslag ${a.measurement.hrFrom} → ${a.measurement.hrTo}` +
    `${a.measurement.hrDrift != null ? ` (hartslagdrift ${a.measurement.hrDrift})` : ''}`);
  if (a.form?.available) {
    L.push(`  vorm van de sessies: wandelpauze ${a.form.pauseFrom} → ${a.form.pauseTo} min per pauze · ` +
      `bloklengte ${a.form.blockFrom} → ${a.form.blockTo} min · loopaandeel ${a.form.runShareFrom}% → ${a.form.runShareTo}% · ` +
      `werk-rustverhouding ${a.form.ratioFrom} → ${a.form.ratioTo}`);
  } else {
    L.push(`  vorm van de sessies: ${a.form?.note || 'onbekend'}`);
  }
  L.push('  gewogen factoren (van zwaar naar niet van toepassing):');
  for (const f of a.factors) {
    L.push(`    · ${f.naam} — ${f.weightLabel}: ${f.text}`);
  }
  if (a.ownReadings.length) {
    L.push('  haar eigen lezing bij die sessies:');
    for (const n of a.ownReadings) L.push(`    · ${n.date}: "${n.note}"`);
  }
  L.push('  per sessie:');
  for (const s of a.sessions) {
    L.push(`    ${s.date} (${s.half}): ${s.runPaceLabel}/km bij HR ${s.hr}` +
      `${s.blockMin != null ? ` · blok ${s.blockMin} min` : ''}` +
      `${s.pausePerBlockMin != null ? ` · pauze ${s.pausePerBlockMin} min` : ''}` +
      `${s.cycleDay != null ? ` · cyclusdag ${s.cycleDay}` : ' · cyclusdag onbekend'}` +
      `${s.sleepHours != null ? ` · ${s.sleepHours} u slaap` : ''}` +
      `${s.note ? ` · haar opmerking: "${s.note}"` : ''}`);
  }
  L.push('  advies dat hieruit volgt:');
  for (const r of a.advice) L.push(`    · ${r}`);
  L.push('  HOE JE HIEROVER PRAAT:');
  L.push('    Zeg eerst welke van de drie het is: (a) de loopeconomie gaat werkelijk');
  L.push('    achteruit, (b) het lijkt zo maar het komt door de factoren hierboven,');
  L.push('    (c) er is nog te weinig om iets te zeggen. Noem daarna wélke factoren je');
  L.push('    hebt meegewogen en welke je hebt uitgesloten, inclusief de wandelpauze');
  L.push('    tussen de blokken en de lengte van de blokken. Een kortere wandelpauze bij');
  L.push('    hetzelfde loopblok is opbouw, geen achteruitgang — reken dat niet af.');
  L.push('    Geef pas daarna advies, en laat dat advies volgen uit de zwaarst wegende');
  L.push('    factor. Noem niet zeven dingen tegelijk.');
  return L.join('\n');
}
