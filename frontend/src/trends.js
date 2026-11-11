// Week, maand en kwartaal naast elkaar — want dat verschil is de analyse.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG
//
// "Het gaat mij om patroon- en trendanalyse over week / weken /
// maanden."
//
// Elke analyse in deze app keek naar één venster. De drift naar twaalf
// weken, het voortgangsoordeel naar een half jaar in twee helften, de
// patroonvergelijking naar haar betere tegenover haar mindere sessies.
// Allemaal bruikbaar, en geen van drieën beantwoordt de vraag die zij
// stelt.
//
// Want één venster kan niet het verschil zien tussen een dip en een
// richting. Een HRV die deze week acht procent lager ligt betekent iets
// heel anders als de maand vlak is dan wanneer de maand óók zakt. Het
// eerste is een slechte week — te weinig geslapen, een luteale fase, een
// glas wijn. Het tweede is een trend, en dan moet er iets veranderen.
//
// ─────────────────────────────────────────────────────────────────
// HOE DIT HET LEEST
//
// Per maat drie vensters, elk tegen de periode daarvóór van dezelfde
// lengte: de laatste week tegen de week ervoor, de laatste vier weken
// tegen de vier daarvoor, de laatste drie maanden tegen de drie
// daarvoor. Mediaan en geen gemiddelde, zodat één uitschieter het beeld
// niet kantelt.
//
// En dan de enige stap die er echt toe doet: de drie vensters naast
// elkaar leggen. Wijzen ze dezelfde kant op, dan is het een richting.
// Spreken ze elkaar tegen, dan staat erbij welke je moet geloven — en
// dat is bijna altijd de langste.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series } from './timeline';
import { steadyEfficiency } from './gemetenTempo';
import { loadWorkouts } from './workouts';
import { alleKracht } from './krachtBronnen';

export const HORIZONS = [
  { id: 'week', label: 'week', lidwoord: 'de', dagen: 7, kort: '7 dgn' },
  { id: 'maand', label: 'maand', lidwoord: 'de', dagen: 28, kort: '4 wkn' },
  { id: 'kwartaal', label: 'kwartaal', lidwoord: 'het', dagen: 90, kort: '3 mnd' },
];

// Hoeveel verandering heet een verandering? Per maat anders, want een
// procent op een gewicht is iets anders dan een procent op HRV.
export const DREMPEL_PCT = {
  hrv: 6, hr_rest: 3, sleep_hours: 6, weight: 1.5,
  efficientie: 3, loopdagen: 15, kracht: 15,
};

const mediaan = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// ── De maten ────────────────────────────────────────────────────
//
// Elk levert per dag nul of één getal. Hoger-is-beter staat erbij, want
// een dalende rusthartslag is vooruitgang en een dalende HRV niet.
function metingen({ currentDate, logs, workouts }) {
  const uitTijdlijn = (metric) => {
    const m = new Map();
    for (const o of series(metric, { asOf: currentDate })) {
      if (typeof o.value === 'number') m.set(o.observedAt, o.value);
    }
    return m;
  };

  const runs = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null));

  // Efficiëntie per dag, alleen uit steady-state blokken en zonder de
  // metingen waarvan de hartslag niet deugt — dezelfde regels als elders.
  const ef = new Map();
  for (const w of runs) {
    const s = steadyEfficiency(w);
    if (s && !s.hrSuspect) ef.set(s.date, s.ef);
  }

  // Loopdagen en krachtdagen zijn geen dagwaarde maar een telling; die
  // worden hieronder apart behandeld.
  const loopDagen = new Set(runs.map(w => w.date));
  const krachtDagen = new Set(alleKracht({ currentDate, logs, venster: 400 }).dagen);

  return [
    { id: 'hrv', label: 'HRV', eenheid: 'ms', hoger: true, waarden: uitTijdlijn('hrv'),
      waarom: 'Beweegt eerder en sterker dan je rusthartslag. Alleen jouw eigen '
        + 'verloop telt; de absolute waarde zegt tussen mensen niets.' },
    { id: 'hr_rest', label: 'Rusthartslag', eenheid: 'bpm', hoger: false,
      waarden: uitTijdlijn('hr_rest'),
      waarom: 'Zakt als je systeem herstelt van wat het krijgt.' },
    { id: 'efficientie', label: 'Economie', eenheid: '', hoger: true, waarden: ef,
      waarom: 'Meters per minuut per hartslag. Dit is de maat die zegt of je sneller '
        + 'wordt zonder harder te werken.' },
    { id: 'sleep_hours', label: 'Slaap', eenheid: 'uur', hoger: true,
      waarden: uitTijdlijn('sleep_hours'),
      waarom: 'Bepaalt of een prikkel landt.' },
    { id: 'weight', label: 'Gewicht', eenheid: 'kg', hoger: false,
      waarden: uitTijdlijn('weight'),
      waarom: 'Het verloop telt, niet de losse dag.' },
    { id: 'loopdagen', label: 'Loopdagen per week', eenheid: '', hoger: true,
      telling: loopDagen,
      waarom: 'Bij jou de sterkste voorspeller van economiewinst.' },
    { id: 'kracht', label: 'Krachtdagen per week', eenheid: '', hoger: true,
      telling: krachtDagen,
      waarom: 'Uit alle bronnen: de krachtmodule, het circuit en je dagboek.' },
  ];
}

function vensterWaarde(maat, van, tot) {
  if (maat.telling) {
    let n = 0;
    for (const d of maat.telling) if (d >= van && d <= tot) n++;
    const weken = Math.max(1, (daysBetween(van, tot) + 1) / 7);
    return { waarde: +(n / weken).toFixed(2), n };
  }
  const v = [];
  for (const [d, w] of maat.waarden) if (d >= van && d <= tot) v.push(w);
  return { waarde: mediaan(v), n: v.length };
}

// ── Eén maat over drie vensters ─────────────────────────────────
export function trendVan(maat, { currentDate = todayLocal() } = {}) {
  const drempel = DREMPEL_PCT[maat.id] ?? 5;
  const per = [];
  for (const h of HORIZONS) {
    const nuVan = addDays(currentDate, -(h.dagen - 1));
    const eerderTot = addDays(nuVan, -1);
    const eerderVan = addDays(eerderTot, -(h.dagen - 1));
    const nu = vensterWaarde(maat, nuVan, currentDate);
    const was = vensterWaarde(maat, eerderVan, eerderTot);

    // Een telling mag met nul metingen; een dagwaarde niet. Bij twee
    // losse metingen in drie maanden is een mediaan geen trend maar een
    // toevalstreffer, en dan hoort hier niets te staan.
    const genoeg = maat.telling
      ? true
      : nu.n >= Math.max(2, Math.round(h.dagen / 14))
        && was.n >= Math.max(2, Math.round(h.dagen / 14));

    if (!genoeg || nu.waarde == null || was.waarde == null) {
      per.push({ ...h, known: false, n: nu.n, nWas: was.n,
        why: `${nu.n} metingen in deze ${h.label} tegen ${was.n} in de vorige — `
          + 'te weinig om te vergelijken.' });
      continue;
    }
    // ── Procenten op een bijna-nul basis zeggen niets ─────────
    //
    // Van 0,26 naar 1,14 loopdagen per week is "+338%", en dat getal
    // suggereert een explosie waar er een halve loopdag bij kwam. Bij
    // een telling is de absolute verandering de eerlijke maat, en bij
    // een basis van nul bestaat er geen percentage — dan is het
    // "begonnen" of "gestopt", net als bij kracht elders in de app.
    const absoluut = +(nu.waarde - was.waarde).toFixed(2);
    const vanNul = was.waarde === 0 || nu.waarde === 0;
    const pct = vanNul ? null
      : +(((nu.waarde - was.waarde) / Math.abs(was.waarde)) * 100).toFixed(1);

    let richting;
    if (vanNul) {
      const erbij = was.waarde === 0 && nu.waarde > 0;
      const eraf = nu.waarde === 0 && was.waarde > 0;
      const goed = maat.hoger ? erbij : eraf;
      const slecht = maat.hoger ? eraf : erbij;
      richting = goed ? 'vooruit' : slecht ? 'terug' : 'gelijk';
    } else if (maat.telling) {
      // Een telling beoordeel ik op de absolute stap: een kwart loopdag
      // per week erbij is ruis, een hele is een verandering.
      const winstAbs = maat.hoger ? absoluut : -absoluut;
      richting = winstAbs >= 0.5 ? 'vooruit' : winstAbs <= -0.5 ? 'terug' : 'gelijk';
    } else {
      const winst = maat.hoger ? pct : -pct;
      richting = winst >= drempel ? 'vooruit' : winst <= -drempel ? 'terug' : 'gelijk';
    }

    per.push({
      ...h, known: true, was: +was.waarde.toFixed(2), nu: +nu.waarde.toFixed(2),
      n: nu.n, nWas: was.n, deltaPct: pct, delta: absoluut,
      // Wat er op het scherm hoort te staan: een percentage waar dat
      // iets betekent, en anders gewoon de twee getallen.
      //
      // Dit heette eerst `label`, en dat is al de naam van het venster
      // ("week", "kwartaal"). De spread hierboven zette hem over, en toen
      // stond er in de duiding "geloof voorlopig het -21,6%" in plaats
      // van "het kwartaal". Twee betekenissen op één veldnaam.
      weergave: vanNul
        ? (was.waarde === 0 ? 'begonnen' : 'gestopt')
        : maat.telling
          ? `${was.waarde.toFixed(1)} → ${nu.waarde.toFixed(1)}`
          : `${pct > 0 ? '+' : ''}${pct}%`,
      richting,
    });
  }

  // ── De vensters tegen elkaar: dip of richting? ───────────────
  const bekend = per.filter(h => h.known);
  // ── Wat telt als "dezelfde kant op"? ────────────────────────
  //
  // Eerst moesten alle drie de vensters dezelfde richting geven. Dat is
  // te streng: een gestage daling van een procent per week registreert
  // over zeven dagen niet — te weinig verschil om boven de drempel uit
  // te komen — en dan veegde die vlakke week een duidelijke maand- en
  // kwartaaldaling van tafel. Een venster dat niets ziet is geen
  // tegenspraak; het is te kort.
  //
  // Dus: minstens twee vensters die hetzelfde zeggen, en geen enkel
  // venster dat het tegenovergestelde zegt.
  const bewegend = bekend.filter(h => h.richting !== 'gelijk');
  const richtingen = [...new Set(bewegend.map(h => h.richting))];
  const eensgezind = bewegend.length >= 2 && richtingen.length === 1;
  const week = per.find(h => h.id === 'week');
  const maand = per.find(h => h.id === 'maand');
  const langste = [...bekend].reverse()[0] || null;

  let duiding;
  if (!bekend.length) {
    duiding = { id: 'onbekend',
      tekst: `Nog te weinig metingen voor ${maat.label.toLowerCase()}.` };
  } else if (eensgezind) {
    duiding = { id: richtingen[0] === 'vooruit' ? 'richting_goed' : 'richting_slecht',
      tekst: `${bewegend.map(h => h.label).join(' en ')} wijzen dezelfde kant op en `
        + 'geen enkel venster spreekt dat tegen: dit is een richting, geen dip. '
        + `${richtingen[0] === 'vooruit' ? 'Doorgaan met wat je doet.'
          : 'Hier verandert iets structureels, en dat vraagt een ingreep.'}` };
  } else if (week?.known && maand?.known && week.richting !== 'gelijk'
    && maand.richting === 'gelijk') {
    duiding = { id: 'dip',
      tekst: `Deze week ${week.richting === 'vooruit' ? 'beter' : 'minder'}, maar over `
        + 'vier weken vlak. Dat is een losse week en nog geen trend — kijk naar slaap, '
        + 'je cyclusfase en wat er die week speelde voordat je je schema aanpast.' };
  } else if (week?.known && langste?.known && week.richting !== langste.richting
    && week.richting !== 'gelijk' && langste.richting !== 'gelijk') {
    duiding = { id: 'keert',
      tekst: `De laatste week gaat ${week.richting === 'vooruit' ? 'omhoog' : 'omlaag'} `
        + `terwijl ${langste.lidwoord} ${langste.label} de andere kant op wijst. Geloof `
        + `voorlopig ${langste.lidwoord} ${langste.label}: die rust op meer metingen. `
        + 'Houdt de week stand, dan is het een kering.' };
  } else {
    duiding = { id: 'gemengd',
      tekst: 'De vensters wijzen niet eenduidig. Dat is zelf ook een uitkomst: er is nu '
        + 'geen verandering groot genoeg om op te sturen.' };
  }

  return {
    id: maat.id, label: maat.label, eenheid: maat.eenheid, hoger: maat.hoger,
    waarom: maat.waarom, horizons: per, duiding,
  };
}

// ── Alles bij elkaar ────────────────────────────────────────────
export function trends({ currentDate = todayLocal(), logs = {}, workouts = null } = {}) {
  const maten = metingen({ currentDate, logs, workouts });
  const uit = maten.map(m => trendVan(m, { currentDate }));
  const metRichting = uit.filter(t => /^richting_/.test(t.duiding.id));
  return {
    known: uit.some(t => t.horizons.some(h => h.known)),
    metrics: uit,
    // Wat er over alles heen te zeggen valt: alleen de maten waar alle
    // vensters het eens zijn, want dat zijn de enige echte richtingen.
    directions: metRichting.map(t => ({ id: t.id, label: t.label,
      goed: t.duiding.id === 'richting_goed' })),
    line: metRichting.length === 0
      ? 'Geen enkele maat wijst over alle vensters dezelfde kant op — er is nu geen '
        + 'trend om op te sturen.'
      : `${metRichting.length} ${metRichting.length === 1 ? 'maat wijst' : 'maten wijzen'} `
        + 'over week, maand en kwartaal dezelfde kant op: '
        + metRichting.map(t => `${t.label.toLowerCase()} `
          + `${t.duiding.id === 'richting_goed' ? 'vooruit' : 'terug'}`).join(', ') + '.',
  };
}
