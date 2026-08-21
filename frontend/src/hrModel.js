// Hartslag: drie dingen die geen van alle hetzelfde zijn.
//
// De app haalde ze door elkaar. Eén getal — 132 — deed tegelijk dienst als
// VT1, als bovengrens van easy, als wandeltrigger, als medische veiligheids-
// grens en als raceplafond. Daardoor stond er letterlijk "boven 132
// wandelen", alsof de CPET dat zou zeggen. Dat zegt hij niet. VT1 is een
// overgang, geen stopgrens.
//
// Vanaf hier staan drie lagen los van elkaar:
//
//   FYSIOLOGIE     wat de CPET van 4 februari 2025 heeft gemeten.
//                  VT1 132, VT2 156, VO2peak 38. Dit is een anker: het zegt
//                  wat er bestaat, niet wat vandaag mag.
//
//   TOLERANTIE     wat je de afgelopen weken aantoonbaar hebt verdragen.
//                  Dit bepaalt hoeveel intensiteit werkelijk wordt
//                  vrijgegeven. Actuele respons wint altijd van de test.
//
//   VOORSCHRIFT    wat er voor déze sessie geldt. Een easy run stuurt op
//                  een ander bereik dan een tempoblok, en een wedstrijd
//                  weer op iets anders.
//
// De regel die daaruit volgt en die nergens overtreden mag worden:
//
//   fysiologische capaciteit ≠ bewezen langdurige tolerantie
//
// Een sessie ónder VT2 kan te zwaar zijn. Dat de test 156 heeft gemeten,
// bewijst niet dat 150 herhaalbaar is.

import { todayLocal, addDays } from './datetime';
import { loadHrSettings, saveHrSettings } from './goals';
import { allBreakdowns } from './pace';
import { exertionalResponse, pemFreeWeeks } from './symptoms';
import { CPET } from './runningHistory';

// ── Laag 1: de fysiologie ───────────────────────────────────────
export const ZONE = {
  RECOVERY: { id: 'recovery', label: 'Herstel',
    meaning: 'Ruim onder VT1. Praten gaat moeiteloos.' },
  BELOW_VT1: { id: 'below_vt1', label: 'Onder VT1',
    meaning: 'Rustige aerobe belasting. Hier bouw je duurzaam.' },
  VT1_VT2: { id: 'vt1_vt2', label: 'Tussen VT1 en VT2',
    meaning: 'Toenemende intensiteit. Trainbaar gebied, geen verboden gebied.' },
  AT_VT2: { id: 'at_vt2', label: 'Rond VT2',
    meaning: 'Hoge intensiteit. Kort houdbaar, duur herstel.' },
  ABOVE_VT2: { id: 'above_vt2', label: 'Boven VT2',
    meaning: 'Boven je omslagpunt. Alleen in korte stukken, zelden zinvol.' },
};

export function cpetZones({ vt1Hr = CPET.vt1Hr, vt2Hr = CPET.vt2Hr } = {}) {
  return [
    { ...ZONE.RECOVERY, from: null, to: vt1Hr - 26 },
    { ...ZONE.BELOW_VT1, from: vt1Hr - 26, to: vt1Hr },
    { ...ZONE.VT1_VT2, from: vt1Hr, to: vt2Hr },
    { ...ZONE.AT_VT2, from: vt2Hr - 4, to: vt2Hr + 4 },
    { ...ZONE.ABOVE_VT2, from: vt2Hr + 4, to: null },
  ];
}

export function zoneOf(hr, { vt1Hr = CPET.vt1Hr, vt2Hr = CPET.vt2Hr } = {}) {
  if (hr == null) return null;
  if (hr >= vt2Hr + 4) return ZONE.ABOVE_VT2;
  if (hr >= vt2Hr - 4) return ZONE.AT_VT2;
  if (hr >= vt1Hr) return ZONE.VT1_VT2;
  if (hr >= vt1Hr - 26) return ZONE.BELOW_VT1;
  return ZONE.RECOVERY;
}

// ── Laag 2: de velden, strikt uit elkaar ────────────────────────
// Elk veld heeft één betekenis. Wie ze samenvoegt krijgt precies de
// tegenstrijdigheid terug die dit bestand moet opruimen.
export const HR_FIELDS = {
  vt1Hr: 'Eerste ventilatoire drempel uit de CPET. Fysiologisch anker.',
  vt2Hr: 'Tweede ventilatoire drempel uit de CPET. Fysiologisch anker.',
  easyTargetLow: 'Ondergrens van het richtgebied voor rustige duurtraining.',
  easyTargetHigh: 'Bovengrens van datzelfde richtgebied. Een coachkeuze, geen verbod.',
  currentIntensityCeiling: 'Tot hoever intensiever werk nu is vrijgegeven, op grond van je herstelrespons.',
  walkTrigger: 'Alleen voor sessies waar een wandelinstructie bij hoort. Vaak leeg.',
  resumeBelow: 'Waaronder je bij zo’n sessie het lopen hervat.',
};

const MODEL_KEY = 'gc_hr_model';

function defaults() {
  const legacy = loadHrSettings();
  return {
    vt1Hr: CPET.vt1Hr,
    vt2Hr: CPET.vt2Hr,
    // Easy blijft bewust rond of onder VT1 — dat past bij het doel van een
    // rustige sessie en bij dit herstelprofiel. Het is een keuze, en die
    // wordt ook zo benoemd.
    easyTargetLow: legacy.easyLow ?? 106,
    easyTargetHigh: Math.min(legacy.easyHigh ?? CPET.vt1Hr, CPET.vt1Hr),
    // Bij aanvang is er geen bewijs voor werk boven VT1; dat betekent niet
    // dat het gevaarlijk is, alleen dat het nog niet is vrijgegeven.
    currentIntensityCeiling: CPET.vt1Hr,
    walkTrigger: null,
    resumeBelow: legacy.resumeBelow ?? 105,
  };
}

export function loadHrModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODEL_KEY) || 'null');
    return normalize({ ...defaults(), ...(saved || {}) });
  } catch { return normalize(defaults()); }
}

// De easy-band als één regel, uit het actuele model.
//
// Schermen die een sessie uit de sessiebibliotheek tonen hadden hun
// hartslagregel uit die bibliotheek zelf — een vaste band, hard
// ingetypt naast elke sessie. Dat is een tweede waarheid — verandert je band,
// dan verandert die tekst niet mee. Dit is de enige plek waar hij vandaan
// hoort te komen.
export function easyHrLine(model = null) {
  const m = model || loadHrModel();
  return `Easy HR: ${m.easyTargetLow}\u2013${m.easyTargetHigh} bpm`;
}

export function saveHrModel(patch) {
  const next = normalize({ ...loadHrModel(), ...patch });
  localStorage.setItem(MODEL_KEY, JSON.stringify(next));
  // De oude instellingen blijven meelopen zolang andere schermen ze lezen,
  // maar walkTrigger krijgt daar nooit meer stilzwijgend VT1 in.
  saveHrSettings({ easyLow: next.easyTargetLow, easyHigh: next.easyTargetHigh });
  return next;
}

// ── Validatie: nooit twee instructies die elkaar tegenspreken ───
// Het geval uit de opdracht: easyTargetHigh 134 met walkTrigger 132 levert
// "richtgebied tot 134" naast "boven 132 wandelen". Dat mag niet op één
// scherm belanden, dus wordt het hier gevangen én rechtgezet.
export function validateHrModel(m = loadHrModel()) {
  const problems = [];
  if (m.easyTargetLow >= m.easyTargetHigh) {
    problems.push({ field: 'easyTargetLow', problem: 'ondergrens ligt niet onder de bovengrens' });
  }
  if (m.walkTrigger != null && m.walkTrigger <= m.easyTargetHigh) {
    problems.push({ field: 'walkTrigger',
      problem: 'wandeltrigger ligt op of onder het easy-richtgebied — dat zijn twee tegenstrijdige instructies',
      walkTrigger: m.walkTrigger, easyTargetHigh: m.easyTargetHigh });
  }
  if (m.currentIntensityCeiling < m.easyTargetHigh) {
    problems.push({ field: 'currentIntensityCeiling',
      problem: 'intensiteitsplafond ligt onder het easy-richtgebied' });
  }
  if (m.currentIntensityCeiling > m.vt2Hr) {
    problems.push({ field: 'currentIntensityCeiling',
      problem: 'intensiteitsplafond ligt boven VT2' });
  }
  if (m.vt1Hr >= m.vt2Hr) {
    problems.push({ field: 'vt1Hr', problem: 'VT1 ligt niet onder VT2' });
  }
  return problems;
}

function normalize(m) {
  const out = { ...m };
  out.vt1Hr = Number(out.vt1Hr) || CPET.vt1Hr;
  out.vt2Hr = Number(out.vt2Hr) || CPET.vt2Hr;
  if (out.vt1Hr >= out.vt2Hr) out.vt2Hr = out.vt1Hr + 24;

  out.easyTargetLow = Number(out.easyTargetLow) || 106;
  out.easyTargetHigh = Number(out.easyTargetHigh) || out.vt1Hr;
  if (out.easyTargetHigh <= out.easyTargetLow) out.easyTargetHigh = out.easyTargetLow + 10;

  out.currentIntensityCeiling = Math.min(out.vt2Hr,
    Math.max(Number(out.currentIntensityCeiling) || out.vt1Hr, out.easyTargetHigh));

  // Een wandeltrigger die het easy-doel overlapt, is geen instructie maar
  // een tegenstrijdigheid. Hij wordt boven het richtgebied gelegd.
  if (out.walkTrigger != null) {
    const t = Number(out.walkTrigger);
    out.walkTrigger = isNaN(t) ? null : Math.max(t, out.easyTargetHigh + 6);
  }
  out.resumeBelow = Math.min(Number(out.resumeBelow) || 105, out.easyTargetLow);
  return out;
}

// ── Laag 2b: wat je aantoonbaar verdraagt boven VT1 ─────────────
export const RELEASE = {
  BASE: { id: 'BASE', label: 'Nog geen intensiteit vrijgegeven' },
  PROBE: { id: 'PROBE', label: 'Ruimte om kort te proeven boven VT1' },
  PARTIAL: { id: 'PARTIAL', label: 'Beperkt werk boven VT1 vrijgegeven' },
  OPEN: { id: 'OPEN', label: 'Werk richting VT2 vrijgegeven' },
  RESTRICTED: { id: 'RESTRICTED', label: 'Intensiteit teruggeschroefd' },
};

export function intensityRelease({ logs = {}, currentDate = todayLocal(), model = null } = {}) {
  const m = model || loadHrModel();
  const rows = allBreakdowns({ limit: 40, currentDate })
    .map(b => {
      const hr = b.runHr ?? (b.workout.averageHR != null ? Number(b.workout.averageHR) : null);
      if (hr == null) return null;
      const r = exertionalResponse({ workoutDate: b.workout.date, logs, currentDate });
      return { date: b.workout.date, hr, status: r.status, allowsBuild: r.allowsBuild,
        headache: r.headache ?? null, minutes: Number(b.runMinutes) || null };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const above = rows.filter(r => r.hr > m.vt1Hr + 2);
  const recent = (arr) => arr.filter(r => r.date >= addDays(currentDate, -21));
  const toleratedAbove = above.filter(r => r.status === 'good');
  const poorAbove = above.filter(r => r.status === 'poor' || r.status === 'red');
  const poorRecent = recent(poorAbove);
  const pem = pemFreeWeeks({ logs, currentDate });

  // Slechte respons boven VT1 wint van elke theoretische grens. Dat is de
  // hele reden dat de CPET geen vrijbrief is.
  if (poorRecent.length) {
    const worst = poorRecent[poorRecent.length - 1];
    return {
      level: RELEASE.RESTRICTED.id, label: RELEASE.RESTRICTED.label,
      ceiling: m.vt1Hr,
      observations: above.length, tolerated: toleratedAbove.length, poor: poorAbove.length,
      pemFreeWeeks: pem.weeks,
      why: `Je sessie van ${worst.date.slice(5)} rond ${worst.hr} bpm is niet schoon verdragen. ` +
        `Dat je VT2 op ${m.vt2Hr} ligt verandert daar niets aan: de respons erna is de maat, niet de test.`,
      evidence: poorRecent.map(r => ({ date: r.date, hr: r.hr, status: r.status })),
    };
  }

  if (pem.weeks >= 4 && toleratedAbove.length >= 3) {
    const maxOk = Math.max(...toleratedAbove.map(r => r.hr));
    return {
      level: RELEASE.OPEN.id, label: RELEASE.OPEN.label,
      ceiling: Math.min(m.vt2Hr, maxOk + 6),
      observations: above.length, tolerated: toleratedAbove.length, poor: poorAbove.length,
      pemFreeWeeks: pem.weeks,
      why: `${toleratedAbove.length} sessies boven VT1 goed verdragen, ${pem.weeks} PEM-vrije weken. ` +
        `Werk tot ongeveer ${Math.min(m.vt2Hr, maxOk + 6)} bpm is vrijgegeven — stapsgewijs, niet in één keer.`,
      evidence: toleratedAbove.slice(-4).map(r => ({ date: r.date, hr: r.hr, status: r.status })),
    };
  }

  if (pem.weeks >= 4 && toleratedAbove.length >= 1) {
    return {
      level: RELEASE.PARTIAL.id, label: RELEASE.PARTIAL.label,
      ceiling: Math.min(m.vt2Hr - 8, m.vt1Hr + 8),
      observations: above.length, tolerated: toleratedAbove.length, poor: poorAbove.length,
      pemFreeWeeks: pem.weeks,
      why: `${toleratedAbove.length} sessie(s) boven VT1 goed verdragen en ${pem.weeks} PEM-vrije weken. ` +
        `Korte blokken tot ongeveer ${Math.min(m.vt2Hr - 8, m.vt1Hr + 8)} bpm mogen; verder pas met meer bewijs.`,
      evidence: toleratedAbove.slice(-3).map(r => ({ date: r.date, hr: r.hr, status: r.status })),
    };
  }

  if (pem.weeks >= 3) {
    return {
      level: RELEASE.PROBE.id, label: RELEASE.PROBE.label,
      ceiling: m.vt1Hr + 5,
      observations: above.length, tolerated: toleratedAbove.length, poor: poorAbove.length,
      pemFreeWeeks: pem.weeks,
      why: `${pem.weeks} PEM-vrije weken, maar nog nauwelijks bewijs boven VT1. ` +
        `Kort tot ongeveer ${m.vt1Hr + 5} bpm proeven mag; daarna eerst kijken hoe je herstelt.`,
      evidence: [],
    };
  }

  return {
    level: RELEASE.BASE.id, label: RELEASE.BASE.label,
    ceiling: m.vt1Hr,
    observations: above.length, tolerated: toleratedAbove.length, poor: poorAbove.length,
    pemFreeWeeks: pem.weeks,
    why: pem.weeks < 3
      ? `Nog ${3 - pem.weeks} PEM-vrije week(en) nodig voordat werk boven VT1 aan de orde is. ` +
        'Dat is een opbouwkeuze, geen fysiologische grens — je VT1 is een overgang, geen plafond.'
      : 'Nog geen sessies boven VT1 om op te bouwen. Eerst rustig volume, dan intensiteit.',
    evidence: [],
  };
}

// ── Laag 3: het voorschrift voor één sessie ─────────────────────
// Precies één instructie per sessie, intern consistent. Nooit een
// richtgebied naast een wandelgrens die elkaar overlappen.
export function hrPrescription({
  purpose = 'EASY_ECONOMY', logs = {}, currentDate = todayLocal(),
  model = null, release = null,
} = {}) {
  const m = model || loadHrModel();
  const rel = release || intensityRelease({ logs, currentDate, model: m });

  const easy = { low: m.easyTargetLow, high: m.easyTargetHigh };
  const hardPurposes = ['QUALITY_LITE', 'FIVE_K_SPECIFIC', 'TEN_K_SPECIFIC'];
  const wantsWork = hardPurposes.includes(purpose);

  // Werkblokken bestaan alleen als er ruimte voor is vrijgegeven.
  const roomAboveVt1 = rel.ceiling - m.vt1Hr;
  const work = wantsWork && roomAboveVt1 >= 4
    ? { low: m.vt1Hr, high: rel.ceiling }
    : null;

  // Een wandeltrigger hoort alleen bij sessies waar hij functie heeft: bij
  // rustige opbouw waar hartslag boven het richtgebied betekent dat het
  // tempo eruit moet. Nooit gelijk aan VT1, want dan is het geen trigger
  // maar een verbod op het richtgebied zelf.
  const walkTrigger = (purpose === 'EASY_ECONOMY' || purpose === 'DURABILITY' ||
    purpose === 'RECOVERY' || purpose === 'TAPER')
    ? Math.max(m.easyTargetHigh + 8, m.vt1Hr + 8)
    : null;

  const zone = zoneOf(easy.high, m);

  let text, why;
  if (work) {
    text = `Easy delen ${easy.low}–${easy.high} bpm. Werkblokken mogen naar ${work.low}–${work.high} bpm, ` +
      'boven VT1 dus — dat is precies de bedoeling van dit blok.';
    why = `${rel.label.toLowerCase()}: ${rel.why}`;
  } else if (wantsWork) {
    text = `Richtgebied ${easy.low}–${easy.high} bpm. Het tempoblok stuurt vandaag op tempo, ` +
      'niet op een hogere hartslag — daar is nog geen bewijs voor.';
    why = rel.why;
  } else {
    text = `Richtgebied ${easy.low}–${easy.high} bpm. Kort oplopen daarboven is geen fout; ` +
      `laat het tempo zakken wanneer je hartslag structureel boven ${easy.high} blijft` +
      (walkTrigger ? `, en wandel als hij richting ${walkTrigger} gaat.` : '.');
    why = `Voor deze rustige training houden we je rond of onder VT1 (${m.vt1Hr}) omdat dat past bij ` +
      'het doel van de sessie en bij je huidige herstelprofiel — niet omdat daarboven een grens ligt.';
  }

  // Twee lengtes van dezelfde instructie. `line` staat op de kaart en moet
  // in één oogopslag leesbaar zijn; `text` staat in het sessiedetail en mag
  // de nuance dragen. Ze spreken elkaar nooit tegen — de korte is een
  // verkorting van de lange, geen andere regel.
  const line = work
    ? `Easy ${easy.low}–${easy.high} bpm · werkblokken ${work.low}–${work.high} bpm`
    : `Richtgebied ${easy.low}–${easy.high} bpm — kort erboven is geen fout`;

  return {
    purpose,
    easy, work, walkTrigger,
    resumeBelow: m.resumeBelow,
    ceiling: rel.ceiling,
    release: rel,
    vt1Hr: m.vt1Hr, vt2Hr: m.vt2Hr,
    zone,
    text, why, line,
  };
}

// ── Laag 3b: wedstrijden hebben eigen logica ────────────────────
// Een wedstrijd hoeft niet binnen de easy-band te blijven. Maar "race = 156"
// is net zo fout als "boven 132 wandelen": het hangt af van de afstand en
// van wat je hebt laten zien.
export function raceHrGuidance({ race, logs = {}, currentDate = todayLocal(),
  model = null, release = null, state = null } = {}) {
  const m = model || loadHrModel();
  const rel = release || intensityRelease({ logs, currentDate, model: m });
  const km = Number(race?.distanceKm) || 5;

  // Hoe langer de afstand, hoe meer de hartslag een duurprobleem wordt in
  // plaats van een intensiteitsprobleem.
  const longRace = km >= 8;
  const coverage = state?.longestTolerated && km
    ? state.longestTolerated / km : null;

  const strongEvidence = rel.level === RELEASE.OPEN.id && (coverage == null || coverage >= 0.6);
  const someEvidence = rel.level === RELEASE.PARTIAL.id || rel.level === RELEASE.PROBE.id;
  const restricted = rel.level === RELEASE.RESTRICTED.id;

  // Het plafond voor de wedstrijd komt nooit boven wat is vrijgegeven, en
  // nooit boven VT2.
  const cap = Math.min(m.vt2Hr, rel.ceiling + (strongEvidence && !longRace ? 6 : 0));

  let start, avg, finish, note;
  if (restricted) {
    start = { low: m.easyTargetLow, high: m.easyTargetHigh - 4 };
    avg = { low: m.easyTargetLow + 4, high: m.easyTargetHigh };
    finish = { low: m.easyTargetLow + 4, high: m.easyTargetHigh + 4 };
    note = 'Je laatste sessies boven VT1 zijn niet schoon verdragen. Deze wedstrijd is een ' +
      'uitloop, geen test.';
  } else if (strongEvidence && !longRace) {
    // 5 km met bewijs: mag oplopen richting VT2, maar niet vanaf de start.
    start = { low: m.vt1Hr - 10, high: m.vt1Hr };
    avg = { low: m.vt1Hr, high: Math.min(cap, m.vt1Hr + Math.round((cap - m.vt1Hr) * 0.7)) };
    finish = { low: avg.high, high: cap };
    note = `Op deze afstand mag je hartslag oplopen richting VT2 (${m.vt2Hr}). Begin onder VT1 en ` +
      'laat hem stijgen; de laatste kilometer is waar de ruimte zit.';
  } else if (strongEvidence && longRace) {
    // 10 km: conservatiever verdelen, de afstand is het probleem.
    start = { low: m.vt1Hr - 12, high: m.vt1Hr - 4 };
    avg = { low: m.vt1Hr - 4, high: Math.min(cap - 6, m.vt1Hr + 8) };
    finish = { low: avg.high, high: Math.min(cap, m.vt1Hr + 14) };
    note = `Tien kilometer vraagt een vlakkere verdeling dan vijf. Je VT2 van ${m.vt2Hr} is een anker ` +
      'uit één test, geen tempo dat je een uur volhoudt.';
  } else if (someEvidence) {
    start = { low: m.easyTargetLow, high: m.vt1Hr - 6 };
    avg = { low: m.vt1Hr - 6, high: Math.min(rel.ceiling, m.vt1Hr + 4) };
    finish = { low: avg.high, high: Math.min(rel.ceiling + 4, m.vt2Hr - 10) };
    note = 'Er is beperkt bewijs boven VT1. Loop op gevoel binnen dit bereik en bewaar de ruimte ' +
      'voor het laatste stuk.';
  } else {
    start = { low: m.easyTargetLow, high: m.easyTargetHigh - 6 };
    avg = { low: m.easyTargetLow + 6, high: m.easyTargetHigh };
    finish = { low: m.easyTargetHigh - 4, high: m.easyTargetHigh + 6 };
    note = 'Nog geen bewijs dat hogere intensiteit wordt verdragen. Deze wedstrijd is een ' +
      'checkpoint: uitlopen binnen je richtgebied telt als geslaagd.';
  }

  const confidence = strongEvidence ? 'MEDIUM' : someEvidence ? 'LOW' : 'LOW';

  return {
    race, start, avg, finish, cap,
    vt1Hr: m.vt1Hr, vt2Hr: m.vt2Hr,
    release: rel, confidence,
    note,
    // Deze zin moet blijven staan, in elke variant.
    caveat: `VT2 ${m.vt2Hr} komt uit één test op één dag. Dat is fysiologische capaciteit, ` +
      'geen bewijs dat je die belasting verdraagt — je herstel de dagen erna blijft de maat.',
    text: `Start ${start.low}–${start.high} · gemiddeld ${avg.low}–${avg.high} · ` +
      `slot tot ${finish.high} bpm`,
  };
}

// ── De kalibratie: easy-doel bijstellen uit eigen data ──────────
// Dit verving vroeger de wandeltrigger door VT1. Nu raakt het alleen het
// easy-richtgebied, en blijft de wandeltrigger een aparte, optionele keuze.
export function applyEasyCalibration(cal) {
  if (!cal?.enough) return null;
  const m = loadHrModel();
  return saveHrModel({
    easyTargetLow: cal.currentRange.low,
    easyTargetHigh: Math.min(cal.currentRange.high, m.vt1Hr),
  });
}
