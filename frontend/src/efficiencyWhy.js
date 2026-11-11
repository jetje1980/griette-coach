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
import { loadWorkouts } from './workouts';
import { alleKracht } from './krachtBronnen';

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
  // HRV beweegt eerder en sterker dan rusthartslag: haar rusthartslag
  // schommelt zo'n tien procent, HRV makkelijk twintig tot dertig. Een
  // factor die eerder uitslaat verdient een plek in deze vergelijking.
  { id: 'hrv', label: 'HRV', eenheid: 'ms', omlaagIsBeter: false,
    uit: (p) => p.hrv },
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
  // ── De factoren die uit de training zelf komen ──────────────
  //
  // Zij vroeg hier expliciet om: "ik wil dat je elk onderdeel meeweegt —
  // afstand, hartslag, snelheid, kracht, slaap, cyclus — om patronen te
  // herkennen." De vier hierboven komen uit het dagboek; deze vier komen
  // uit de training en stonden er nog niet in. Zonder die vier kon de
  // analyse niet zien of haar betere sessies kort of lang waren, of ze
  // uitgerust aan de start stonden, en of er kracht aan voorafging.
  { id: 'afstand', label: 'afstand van de sessie', eenheid: 'km', omlaagIsBeter: null,
    uit: (p) => p.distanceKm },
  { id: 'rustdagen', label: 'dagen sinds je vorige loop', eenheid: '', omlaagIsBeter: null,
    uit: (p) => p.daysSincePrevRun },
  { id: 'kracht_voor', label: 'krachtdagen in de drie dagen ervoor', eenheid: '',
    omlaagIsBeter: null, uit: (p) => p.strengthBefore },
  { id: 'gewicht', label: 'gewicht', eenheid: 'kg', omlaagIsBeter: true,
    uit: (p) => p.weight },
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
// De context van één dag, nu ook met wat er uit de training zelf komt:
// hoe lang de sessie was, hoeveel rust eraan voorafging en of er kracht
// in de drie dagen ervoor zat. Dat laatste is geen bijzaak — het is de
// enige manier om te zien of kracht haar lopen helpt of juist in de weg
// zit, en dat is precies waar zij naar vroeg.
function contextVan(datum, logs, asOf, extra = {}) {
  const log = logs[datum] || null;
  const volgende = logs[nextDay(datum)] || null;
  const dag = cycleDayOf(datum, { asOf });
  return {
    date: datum,
    log,
    hr_rest: num(log?.hr_rest) ?? num(volgende?.hr_rest),
    // Net als de rusthartslag wordt HRV 's nachts gemeten, dus hij hoort
    // bij de ochtend ná een avondloop. Dezelfde terugval dus.
    hrv: num(log?.hrv) ?? num(volgende?.hrv),
    hrFromNextDay: num(log?.hr_rest) == null && num(volgende?.hr_rest) != null,
    sleep_hours: num(log?.sleep_hours),
    sleep_quality: num(log?.sleep_quality),
    energy: num(log?.energy),
    stress_load: num(log?.stress_load),
    fuel_quality: num(log?.fuel_quality),
    cycleDay: dag,
    phase: dag ? phaseOfDay(dag, AANNAME_CYCLUSLENGTE) : PHASE.UNKNOWN,
    weight: num(log?.weight),
    ...extra,
  };
}

// Dagen tussen deze loop en de vorige, en hoeveel krachtdagen er in de
// drie dagen ervoor zaten.
function trainingContext(datums, krachtDagen) {
  const set = new Set(krachtDagen || []);
  const terug = (d, n) => {
    const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() - n);
    return x.toISOString().slice(0, 10);
  };
  const perDatum = new Map();
  datums.forEach((d, i) => {
    const vorige = i > 0 ? datums[i - 1] : null;
    const dagen = vorige
      ? Math.round((new Date(`${d}T12:00:00`) - new Date(`${vorige}T12:00:00`)) / 86400000)
      : null;
    let kracht = 0;
    for (let k = 1; k <= 3; k++) if (set.has(terug(d, k))) kracht++;
    perDatum.set(d, { daysSincePrevRun: dagen, strengthBefore: kracht });
  });
  return perDatum;
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

  const opDatum = [...trend.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const kracht = alleKracht({ currentDate, logs, venster: 365 }).dagen;
  const tc = trainingContext(opDatum.map(s => s.date), kracht);
  const afstanden = new Map((workouts || loadWorkouts())
    .filter(w => w?.date).map(w => [w.date, Number(w.distance) || null]));
  const punten = trend.sessions
    .map(s => ({ ...s,
      ...contextVan(s.date, logs, currentDate, {
        ...(tc.get(s.date) || {}),
        distanceKm: afstanden.get(s.date) ?? null,
      }) }))
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
    // Elke factor heeft zijn eigen maat. Een halve kilometer verschil in
    // afstand zegt niets; een halve kilo gewicht wel.
    const DREMPELS = { hr_rest: 2, hrv: 5, sleep_hours: 0.5, cycleDay: 5,
      afstand: 0.8, rustdagen: 1, kracht_voor: 0.5, gewicht: 0.5 };
    const drempel = DREMPELS[f.id] ?? 0.4;
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
