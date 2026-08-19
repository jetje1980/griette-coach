// Persoonlijke hardloopgeschiedenis — waarom deze coach anders rekent.
//
// De kern van deze geschiedenis in één zin:
//
//   acute output is bij deze loper geen betrouwbare proxy voor duurzame
//   belastbaarheid.
//
// Ze kon in 2024 en begin 2025 nog 21 km lopen en een 5 km in 27 minuten,
// terwijl haar herstelvermogen al aan het instorten was. Een coach die
// alleen naar voltooide afstanden kijkt, zou daar opnieuw op afgaan.
//
// Daarom staan hier twee dingen strikt uit elkaar:
//
//   VOLTOOID   de afstand is fysiek afgelegd
//   VERDRAGEN  de 24-48 uur erna waren normaal
//
// Alleen het tweede telt als bewijs van belastbaarheid.

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts } from './workouts';
import { exertionalResponse } from './symptoms';
import { loadHrSettings, saveHrSettings } from './goals';
import { paceBreakdown, allBreakdowns } from './pace';

// ── Trainingsfasen ──────────────────────────────────────────────
export const PHASES = [
  { id: 'covid', from: '2022-12-01', to: '2023-02-28',
    label: 'COVID', note: 'Eind december 2022 besmet.' },
  { id: 'rebuild23', from: '2023-03-01', to: '2023-12-31',
    label: 'Opbouw 2023', note: 'Weer opgebouwd; qua training een relatief sterk jaar.',
    quality: 'strong' },
  { id: 'peak24', from: '2024-01-01', to: '2024-08-17',
    label: 'Marathonopbouw 2024', note: 'Veel getraind richting halve en hele marathon.',
    quality: 'strong' },
  { id: 'relapse', from: '2024-08-18', to: '2025-02-03',
    label: 'Nieuwe ziekteperiode', quality: 'declining',
    note: 'Opnieuw ziek rond augustus 2024. Acute prestaties bleven soms hoog, herstel werd steeds slechter.' },
  { id: 'diagnosis', from: '2025-02-04', to: '2025-11-30',
    label: 'Diagnose en stop', quality: 'stopped',
    note: 'Na de diagnose volledig gestopt met hardlopen. Daarna nog circa negen maanden hoofdpijn bij minimale inspanning.' },
  { id: 'headacheEase', from: '2025-12-01', to: '2026-02-28',
    label: 'Hoofdpijn neemt af', quality: 'recovering',
    note: 'Sinds ongeveer december 2025 duidelijk minder inspanningsgerelateerde hoofdpijn. Dat is de belangrijkste hersteltrend tot nu toe.' },
  { id: 'rebuild26', from: '2026-03-01', to: '2099-12-31',
    label: 'Rustige opbouw 2026', quality: 'building',
    note: 'Opnieuw opbouwen via run/walk, met herstel als stuurvariabele.' },
];

export const phaseOf = (date) => PHASES.find(p => date >= p.from && date <= p.to) || null;

// ── Historische referentieruns ──────────────────────────────────
// Bewust met een label erbij. `tolerance` zegt wat de sessie waard was als
// bewijs — niet hoe indrukwekkend hij was.
export const HISTORICAL_RUNS = [
  { date: '2023-12-07', km: 10.02, pace: '6:11', hr: 161, tolerance: 'reference' },
  { date: '2023-12-09', km: 17.46, pace: '6:50', hr: 157, tolerance: 'reference' },
  { date: '2023-12-16', km: 21.43, pace: '6:26', hr: 167, tolerance: 'reference' },
  { date: '2023-12-31', km: 16.05, pace: '6:43', hr: 161, tolerance: 'reference' },
  { date: '2024-02-04', km: 18.01, pace: '6:56', hr: 161, tolerance: 'reference' },
  { date: '2024-04-14', km: 10.54, pace: '6:06', hr: 174, tolerance: 'reference' },
  { date: '2024-05-26', km: 17.99, pace: '7:05', hr: 161, tolerance: 'reference' },
  { date: '2024-06-15', km: 20.79, pace: '6:33', hr: 167, tolerance: 'reference' },

  // Vlak vóór of rond een nieuwe ziekteperiode. Snel, maar geen gezonde basis.
  { date: '2024-08-18', km: 5.01, pace: '5:28', hr: 176, tolerance: 'pre_relapse',
    note: 'Snelle 5 km vlak vóór of rond een nieuwe ziekteperiode. Geen gezonde duurzame basis.' },
  { date: '2024-09-10', km: 6.15, pace: '6:07', hr: 179, tolerance: 'pre_relapse',
    note: 'Hoge cardiovasculaire prijs kort na een nieuwe ziekteperiode.' },

  { date: '2024-11-10', km: 21.07, pace: '6:43', hr: 168, tolerance: 'unknown' },
  { date: '2024-12-14', km: 10.24, pace: '6:29', hr: 171, tolerance: 'unknown' },

  // De sessie die het patroon het scherpst laat zien.
  { date: '2025-01-12', km: 21.32, pace: '7:06', hr: 163, tolerance: 'failed',
    postExertional: 'RED',
    note: 'Voltooid, niet verdragen. Na de finish instorten, koud en klam zweet, verhoging en het gevoel ziek te worden. Een vergelijkbaar patroon deed zich in de twee jaar daarvoor nog twee tot drie keer voor.' },
];

export const TOLERANCE_LABELS = {
  reference: { label: 'Referentie', color: 'var(--sage)',
    meaning: 'Uitgevoerd in een periode waarin het herstel nog meebewoog.' },
  pre_relapse: { label: 'Pre-relapse output', color: 'var(--gold)',
    meaning: 'Hoge acute prestatie vlak voor of tijdens een terugval. Geen bewijs van belastbaarheid.' },
  failed: { label: 'Niet verdragen', color: 'var(--rust)',
    meaning: 'Fysiek voltooid, maar de respons erna was afwijkend. Telt niet als bewezen afstand.' },
  unknown: { label: 'Onbekend verdragen', color: 'var(--ghost)',
    meaning: 'Geen betrouwbare herstelgegevens uit die periode.' },
};

// De langste afstand die ooit is voltooid, en de langste die is verdragen.
// Dat verschil is de hele les.
export function historicalCapacity() {
  const completed = HISTORICAL_RUNS.reduce((m, r) => r.km > (m?.km || 0) ? r : m, null);
  const tolerated = HISTORICAL_RUNS
    .filter(r => r.tolerance === 'reference')
    .reduce((m, r) => r.km > (m?.km || 0) ? r : m, null);
  const failed = HISTORICAL_RUNS.filter(r => r.tolerance === 'failed');
  return {
    longestCompleted: completed, longestTolerated: tolerated, failed,
    lesson: completed && tolerated && completed.km > tolerated.km
      ? `Je langste voltooide afstand is ${completed.km} km, je langste in een gezonde periode gelopen afstand ${tolerated.km} km. Afstand volbrengen en afstand verdragen zijn hier niet hetzelfde.`
      : 'Afstand volbrengen en afstand verdragen zijn niet hetzelfde.',
  };
}

// ── CPET: historische fysiologische baseline ────────────────────
// Fietsergometrisch, afgenomen tijdens de long-COVID-periode. Hij toont wat
// het systeem tijdens één test kon. Hij bewijst niet dat herhaalde
// looptraining werd verdragen. Daarom: anker, geen trainingszone.
export const CPET = {
  date: '2025-02-04',
  modality: 'fietsergometrie',
  vt1Hr: 132, vt2Hr: 156,
  peakHr: [170, 174],
  vo2peak: 38,
  vt1Watt: 114, vt2Watt: 163,
  vo2AtVt1: 24, vo2AtVt2: 31,
  zones: [
    { id: 'recovery', label: 'Herstel', to: 106 },
    { id: 'extensive', label: 'Extensieve duur', from: 106, to: 132 },
    { id: 'intensive', label: 'Intensieve duur', from: 132, to: 144 },
    { id: 'threshold', label: 'Omslagpunt', from: 144, to: 156 },
    { id: 'max', label: 'Maximaal', from: 156 },
  ],
  caveat: 'Fietsergometrisch, afgenomen tijdens de long-COVID-periode. Dit toont je acute fysiologische capaciteit tijdens één test. Het bewijst niet dat herhaalde looptraining destijds duurzaam werd verdragen — daarvoor is de herstelrespons de maat, niet de test.',
};

// ── HR-kalibratie 2026 ──────────────────────────────────────────
// Niet blind 106-132 aanhouden. De veilige aerobe band wordt afgeleid uit
// echte runsegmenten van dit jaar, met het CPET-VT1 als bovengrens-anker.
export function calibrateHr({ logs = {}, currentDate = todayLocal(), sinceDays = 90 } = {}) {
  const since = addDays(currentDate, -sinceDays);
  const rows = allBreakdowns({ limit: 40, currentDate })
    .filter(b => b.workout.date >= since && b.runHr != null && b.runPace != null)
    .map(b => ({
      date: b.workout.date, hr: b.runHr, pace: b.runPace,
      tolerance: exertionalResponse({ workoutDate: b.workout.date, logs, currentDate }).status,
      headache: headacheAfter(b.workout.date, logs),
    }));

  // Alleen sessies die goed zijn verdragen én zonder noemenswaardige
  // hoofdpijn erna tellen mee voor "veilig".
  const safe = rows.filter(r => r.tolerance === 'good' && (r.headache ?? 0) <= 1);

  const hr = loadHrSettings();
  if (safe.length < 3) {
    return {
      enough: false, observations: rows.length, safeObservations: safe.length,
      historicalVt1: CPET.vt1Hr,
      currentRange: { low: hr.easyLow, high: hr.easyHigh },
      ceiling: hr.walkTrigger,
      confidence: 'LOW',
      note: `Nog ${Math.max(0, 3 - safe.length)} goed verdragen run(s) met hartslag nodig om je band uit eigen data af te leiden. Tot dan geldt je huidige instelling ${hr.easyLow}–${hr.easyHigh}, met het CPET-VT1 van ${CPET.vt1Hr} als bovengrens-anker.`,
      supporting: safe,
    };
  }

  const hrs = safe.map(r => r.hr).sort((a, b) => a - b);
  const q = (p) => hrs[Math.min(hrs.length - 1, Math.floor(hrs.length * p))];
  const low = Math.round(q(0.1));
  const high = Math.round(q(0.9));

  // De bovengrens gaat nooit boven het CPET-VT1: dat is het punt waarboven
  // het aerobe karakter verdwijnt, en precies waar het in 2024 misging.
  const ceiling = Math.min(CPET.vt1Hr, high + 4);

  const confidence = safe.length >= 8 ? 'HIGH' : safe.length >= 5 ? 'MEDIUM' : 'LOW';

  return {
    enough: true, observations: rows.length, safeObservations: safe.length,
    historicalVt1: CPET.vt1Hr,
    currentRange: { low, high },
    ceiling,
    confidence,
    supporting: safe.slice(-6),
    note: `Afgeleid uit ${safe.length} goed verdragen runs met hartslag in de loopblokken. Je huidige veilige band ligt op ${low}–${high}; boven ${ceiling} ga je wandelen. Het CPET-VT1 van ${CPET.vt1Hr} is de harde bovengrens, ook als je data hoger uitkomt.`,
    differsFromSetting: low !== hr.easyLow || high !== hr.easyHigh,
  };
}

// De gekalibreerde band overnemen in de instellingen — expliciet, nooit
// stilzwijgend.
export function applyCalibration(cal) {
  if (!cal?.enough) return null;
  return saveHrSettings({
    easyLow: cal.currentRange.low,
    easyHigh: cal.currentRange.high,
    walkTrigger: cal.ceiling,
  });
}

// Hulpje: de zwaarste hoofdpijn in de 48 uur na een sessie.
function headacheAfter(date, logs) {
  let worst = null;
  for (let i = 0; i <= 2; i++) {
    const l = logs?.[addDays(date, i)];
    const v = l?.headache_severity ?? (l?.symptom_headache ? 2 : null);
    if (v != null) worst = Math.max(worst ?? 0, Number(v));
  }
  return worst;
}

// ── Wat we van de geschiedenis geleerd hebben ───────────────────
// Deze regels staan in de app zodat ze niet in de code verdwijnen.
export const LESSONS = [
  'Eén goede sessie is geen bewijs van herstel.',
  'Eén snelle 5 km is geen bewijs van duurzame fitheid.',
  'Eén hoge VO2peak is geen bewijs dat de belasting herhaalbaar is.',
  'Een afstand volbrengen is niet hetzelfde als hem verdragen.',
];

export const PROGRESSION_RULE =
  'Progressie vraagt herhaalde tolerantie over meerdere sessies, niet één geslaagde training.';

// ── Vroege waarschuwingssignalen ────────────────────────────────
// Vijf trends die samen het patroon van 2024-2025 vormden. Twee of meer
// tegelijk betekent: niet doorbouwen.
export function earlyWarnings({ logs = {}, currentDate = todayLocal() } = {}) {
  const rows = allBreakdowns({ limit: 20, currentDate })
    .filter(b => b.runPace != null)
    .map(b => ({
      date: b.workout.date, pace: b.runPace, hr: b.runHr ?? b.workout.averageHR,
      tolerance: exertionalResponse({ workoutDate: b.workout.date, logs, currentDate }).status,
      headache: headacheAfter(b.workout.date, logs),
      drift: b.workout.hrFirstHalf != null && b.workout.hrSecondHalf != null
        ? b.workout.hrSecondHalf - b.workout.hrFirstHalf : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length < 4) {
    return { enough: false, signals: [], count: 0,
      note: `Nog ${4 - rows.length} sessie(s) nodig om trends te kunnen zien.` };
  }

  const half = Math.floor(rows.length / 2);
  const older = rows.slice(0, half), recent = rows.slice(half);
  const avg = (a, k) => {
    const v = a.map(x => x[k]).filter(x => x != null);
    return v.length ? v.reduce((s, y) => s + y, 0) / v.length : null;
  };

  const signals = [];

  // A. Economie gaat achteruit: zelfde hartslag, structureel trager
  const pO = avg(older, 'pace'), pR = avg(recent, 'pace');
  const hO = avg(older, 'hr'), hR = avg(recent, 'hr');
  if (pO && pR && hO && hR && pR > pO * 1.03 && Math.abs(hR - hO) <= 3) {
    signals.push({ id: 'economy', label: 'Loopeconomie gaat achteruit',
      detail: `Bij vergelijkbare hartslag ben je ${Math.round((pR - pO) * 60)} sec/km trager geworden.` });
  }

  // B. Cardiovasculaire prijs stijgt: zelfde tempo, hogere hartslag
  if (pO && pR && hO && hR && hR > hO + 4 && Math.abs(pR - pO) < pO * 0.03) {
    signals.push({ id: 'cost', label: 'Hogere hartslag bij hetzelfde tempo',
      detail: `Je hartslag ligt gemiddeld ${Math.round(hR - hO)} slagen hoger bij vergelijkbaar tempo.` });
  }

  // C. Durability: meer drift binnen de sessie
  const dO = avg(older, 'drift'), dR = avg(recent, 'drift');
  if (dO != null && dR != null && dR > dO + 3) {
    signals.push({ id: 'drift', label: 'Je zakt sneller weg binnen een sessie',
      detail: `Je hartslag loopt tijdens een sessie gemiddeld ${Math.round(dR - dO)} slagen meer op dan eerder.` });
  }

  // D. Herstel gaat achteruit: meer hoofdpijn of slechter verdragen
  const headO = avg(older, 'headache'), headR = avg(recent, 'headache');
  const poorR = recent.filter(r => r.tolerance === 'poor').length;
  if ((headO != null && headR != null && headR > headO + 0.5) || poorR >= 2) {
    signals.push({ id: 'recovery', label: 'Herstel gaat achteruit',
      detail: headR > (headO ?? 0)
        ? 'Meer post-exertionele hoofdpijn dan in de periode ervoor.'
        : `${poorR} van je recente sessies werden niet goed verdragen.` });
  }

  // E. Cumulatieve achteruitgang ondanks doortrainen
  if (signals.length >= 2 && rows.length >= 6) {
    signals.push({ id: 'cumulative', label: 'Meerdere signalen tegelijk',
      detail: 'Dit is het patroon uit 2024–2025: blijven trainen terwijl de trend twee tot vier weken achteruitgaat.' });
  }

  const severe = signals.length >= 2;
  return {
    enough: true, signals, count: signals.length, severe,
    verdict: severe
      ? 'Meerdere waarschuwingssignalen tegelijk. Niet doorbouwen: houd het niveau vast of schaal terug, en zoek eerst de oorzaak.'
      : signals.length === 1
        ? 'Eén signaal om in de gaten te houden. Nog geen reden om terug te schalen, wel om niet te versnellen.'
        : 'Geen waarschuwingssignalen in je recente trend.',
    rows,
  };
}
