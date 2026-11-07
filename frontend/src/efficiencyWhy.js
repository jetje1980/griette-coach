// Waaróm was de ene sessie efficiënter dan de andere?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAAT
//
// Zij vroeg het letterlijk: kan het cyclusgerelateerd zijn, of een
// combinatie van goed slapen en zo — en kun je dat terugleiden?
//
// Dat is precies de goede vraag, want een efficiëntiegetal zonder context
// is een thermometer zonder weerbericht. Haar sessie van 4 oktober staat
// op 1,007 en die van 24 oktober op 0,711. Als de app alleen dát toont,
// lijkt het alsof er iets onverklaarbaars gebeurt met haar lichaam. Terwijl
// de verklaring in haar eigen dagboek staat: op 4 oktober was haar
// rusthartslag 59 — de laagste ooit gemeten — en zat ze op cyclusdag 6.
//
// Dit bestand legt elk efficiëntiepunt naast de dag waarop het gemeten is:
// cyclusdag en fase, rusthartslag ten opzichte van haar eigen gemiddelde,
// slaapduur en slaapkwaliteit. Daarna vergelijkt het haar beste helft met
// haar slechtste helft en zegt welke factor meebeweegt.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT UITDRUKKELIJK NIET IS
//
// Geen oorzaak. Met zes tot tien sessies is elk verband een aanwijzing,
// geen bevinding — en twee factoren die samen oplopen (slecht slapen én
// laatluteaal) zijn hier niet uit elkaar te trekken. Het enige wat deze
// module eerlijk kan zeggen is: dit ging samen, kijk daar eens naar.
//
// Daarom staat bij elke uitspraak hoeveel sessies eronder liggen, en wordt
// een factor met minder dan drie metingen per kant niet getoond in plaats
// van met een slag om de arm gepresenteerd.
// ─────────────────────────────────────────────────────────────────

import { efficiencyTrend } from './efficiency';
import { cycleDayOf } from './bodyReview';
import { phaseOfDay, PHASE } from './cyclePatterns';
import { todayLocal, daysBetween } from './datetime';

// Minder dan dit aan elke kant en er valt niets te vergelijken.
const MIN_PER_KANT = 3;

// Typische cycluslengte als er nog te weinig cycli bekend zijn om er een
// te meten. 28 is een aanname en wordt ook zo benoemd.
const AANNAME_CYCLUSLENGTE = 28;

const FACTOREN = [
  // Lezen uit het samengestelde punt en niet uit het ruwe dagboek: de
  // rusthartslag van een avondloop staat in het log van de ochtend erna, en
  // contextVan() heeft dat al uitgezocht. Deze functies lazen eerst het ruwe
  // log, waardoor precies die sessies wegvielen — en dan meldt de app "te
  // weinig ingevuld" terwijl het getal er wél is.
  { id: 'hr_rest', label: 'rusthartslag', eenheid: 'bpm', omlaagIsBeter: true,
    uit: (p) => p.hr_rest },
  { id: 'sleep_hours', label: 'slaapuren', eenheid: 'uur', omlaagIsBeter: false,
    uit: (p) => p.sleep_hours },
  { id: 'sleep_quality', label: 'slaapkwaliteit', eenheid: '(0–2)', omlaagIsBeter: false,
    uit: (p) => p.sleep_quality },
  { id: 'energy', label: 'energie', eenheid: '(0–2)', omlaagIsBeter: false,
    uit: (p) => p.energy },
  { id: 'cycleDay', label: 'cyclusdag', eenheid: '', omlaagIsBeter: null,
    uit: (p) => p.cycleDay },
  // De twee velden die zij er zelf bij vroeg. Ze stonden wel in het
  // dagplan om in te vullen, maar werden door geen enkele analyse gelezen —
  // dan is invullen werk zonder opbrengst.
  { id: 'stress_load', label: 'spanning', eenheid: '(0–2)', omlaagIsBeter: true,
    uit: (p) => p.stress_load },
  { id: 'fuel_quality', label: 'genoeg gegeten', eenheid: '(0–2)', omlaagIsBeter: false,
    uit: (p) => p.fuel_quality },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const gem = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const rond = (x, n = 1) => x == null ? null : +x.toFixed(n);

const fmtPace = (min) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const t = Math.round(min * 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// De context van één dag. De rusthartslag van de dag zelf; staat die er
// niet, dan die van de ochtend erna — want een rusthartslag wordt 's
// ochtends gemeten en een avondloop valt daar tussenin.
function contextVan(datum, logs, asOf) {
  const log = logs[datum] || null;
  const volgende = logs[nextDay(datum)] || null;
  const dag = cycleDayOf(datum, { asOf });
  return {
    date: datum,
    log,
    hr_rest: num(log?.hr_rest) ?? num(volgende?.hr_rest),
    hrFromNextDay: num(log?.hr_rest) == null && num(volgende?.hr_rest) != null,
    sleep_hours: num(log?.sleep_hours),
    sleep_quality: num(log?.sleep_quality),
    energy: num(log?.energy),
    stress_load: num(log?.stress_load),
    fuel_quality: num(log?.fuel_quality),
    cycleDay: dag,
    phase: dag ? phaseOfDay(dag, AANNAME_CYCLUSLENGTE) : PHASE.UNKNOWN,
  };
}

function nextDay(datum) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function efficiencyFactors({ currentDate = todayLocal(), logs = {},
  workouts = null } = {}) {
  const trend = efficiencyTrend({ currentDate, workouts });
  if (!trend.known) return { known: false, why: trend.why };

  const punten = trend.sessions
    .map(s => ({ ...s, ...contextVan(s.date, logs, currentDate) }))
    .sort((a, b) => b.ef - a.ef);

  if (punten.length < MIN_PER_KANT * 2) {
    return {
      known: false, points: punten,
      why: `${punten.length} sessies met een efficiëntiegetal. Vanaf ${MIN_PER_KANT * 2} `
        + 'kan ik je betere helft naast je mindere helft leggen en kijken wat er '
        + 'meebeweegt; daaronder is elk verband toeval.',
    };
  }

  const helft = Math.floor(punten.length / 2);
  const beste = punten.slice(0, helft);
  const minste = punten.slice(-helft);

  const bevindingen = [];
  for (const f of FACTOREN) {
    const b = beste.map(p => f.uit(p)).filter(v => v != null);
    const m = minste.map(p => f.uit(p)).filter(v => v != null);
    if (b.length < MIN_PER_KANT || m.length < MIN_PER_KANT) {
      bevindingen.push({ id: f.id, label: f.label, enough: false,
        note: `${f.label}: te weinig ingevuld om te vergelijken (${b.length} vs ${m.length} sessies).` });
      continue;
    }
    const gb = gem(b), gm = gem(m);
    const verschil = gb - gm;
    // Hoe groot moet een verschil zijn om het te noemen? Eén eenheid voor
    // de schalen van 0–2, twee slagen voor hartslag, een half uur slaap.
    const drempel = f.id === 'hr_rest' ? 2 : f.id === 'sleep_hours' ? 0.5
      : f.id === 'cycleDay' ? 5 : 0.4;
    bevindingen.push({
      id: f.id, label: f.label, enough: true,
      best: rond(gb), worst: rond(gm), delta: rond(verschil),
      unit: f.eenheid,
      meaningful: Math.abs(verschil) >= drempel,
      note: Math.abs(verschil) < drempel
        ? `${f.label}: vrijwel gelijk in je betere en mindere sessies (${rond(gb)} vs ${rond(gm)}) — dit verklaart het verschil niet.`
        : `${f.label}: ${rond(gb)}${f.eenheid ? ' ' + f.eenheid : ''} in je ${helft} beste sessies tegen `
          + `${rond(gm)} in je ${helft} mindere. ${duiding(f, gb, gm)}`,
    });
  }

  const sterkste = bevindingen.filter(b => b.enough && b.meaningful)
    .sort((a, b) => Math.abs(b.delta / (b.worst || 1)) - Math.abs(a.delta / (a.worst || 1)))[0] || null;

  return {
    known: true,
    points: punten,
    findings: bevindingen,
    strongest: sterkste,
    halfSize: helft,
    best: { ef: punten[0].ef, date: punten[0].date },
    worst: { ef: punten[punten.length - 1].ef, date: punten[punten.length - 1].date },
    line: sterkste
      ? `Wat het sterkst meebeweegt met je betere sessies: ${sterkste.label}.`
      : 'Geen van de ingevulde factoren beweegt duidelijk mee met je betere sessies.',
    caveat: `Gebaseerd op ${punten.length} sessies. Dit is een aanwijzing en geen oorzaak: `
      + 'factoren die samen oplopen — slecht slapen in je laatluteale week bijvoorbeeld — '
      + 'zijn hier niet uit elkaar te halen.',
    spread: `Je beste sessie (${punten[0].date}, ${punten[0].ef}) tegen je mindere `
      + `(${punten[punten.length - 1].date}, ${punten[punten.length - 1].ef}): dat is het `
      + `verschil tussen ${fmtPace(1000 / (punten[0].ef * trend.targetHr))} en `
      + `${fmtPace(1000 / (punten[punten.length - 1].ef * trend.targetHr))} per kilometer `
      + `bij hartslag ${trend.targetHr}.`,
  };
}

function duiding(f, best, worst) {
  if (f.id === 'hr_rest') {
    return best < worst
      ? 'Een lagere rusthartslag op de ochtend van je loop gaat bij jou samen met een '
        + 'efficiëntere sessie. Dat is bruikbaar: je weet het vóór je de deur uitgaat.'
      : 'Dat is de omgekeerde richting van wat je zou verwachten — kijk of er iets anders speelde.';
  }
  if (f.id === 'sleep_hours' || f.id === 'sleep_quality') {
    return best > worst
      ? 'Beter geslapen hoort bij je betere sessies. Van alle factoren is dit degene '
        + 'waar je het meest aan kunt doen.'
      : 'Dat is de omgekeerde richting van wat je zou verwachten; waarschijnlijk toeval bij dit aantal sessies.';
  }
  if (f.id === 'stress_load') {
    return best < worst
      ? 'Minder spanning hoort bij je betere sessies. Werkdruk telt mee als belasting; '
        + 'je lichaam kent het verschil met trainingsbelasting niet.'
      : 'Dat is de omgekeerde richting van wat je zou verwachten; kijk er pas naar als '
        + 'het over meer sessies standhoudt.';
  }
  if (f.id === 'fuel_quality') {
    return best > worst
      ? 'Genoeg gegeten hoort bij je betere sessies. Dat is de knop waar je het meest '
        + 'aan kunt doen en die op Mounjaro het makkelijkst ongemerkt misgaat.'
      : 'Dat is de omgekeerde richting van wat je zou verwachten; waarschijnlijk toeval '
        + 'bij dit aantal sessies.';
  }
  if (f.id === 'cycleDay') {
    return best < worst
      ? 'Je betere sessies vallen vroeger in je cyclus. Dat past bij wat er hormonaal '
        + 'gebeurt: in de tweede helft ligt je hartslag bij hetzelfde tempo een paar slagen hoger.'
      : 'Je betere sessies vallen juist later in je cyclus — dat is niet het gebruikelijke '
        + 'patroon, dus kijk hier pas naar als het over meer cycli standhoudt.';
  }
  return '';
}
