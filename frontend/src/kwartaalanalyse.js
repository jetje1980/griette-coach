// Het kwartaaldossier: alles bij elkaar, één keer per drie maanden.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG
//
// "Per kwartaal wellicht ook bij analyse van coach? Dat daar echt
// patroon qua slaap, HRV, alle data van cyclus tot gewicht tot hartslag
// tot toning van lichaam worden meegenomen, en er een analyse en
// patroonherkenning kan komen met mogelijk advies en observaties."
//
// De coach kreeg tot nu toe een samenvatting van de laatste dertig dagen
// en wat losse recente cijfers. Prima voor "hoe gaat het deze week", en
// ongeschikt voor de vraag die zij stelt. Een cyclus duurt vier weken;
// in dertig dagen zie je er één en dus geen patroon. Loopeconomie beweegt
// in maanden. Lichaamsverandering al helemaal. Wie over die dingen iets
// wil zeggen, moet een kwartaal kunnen overzien.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAND GEEN PROMPT IS
//
// De verleiding is om de ruwe gegevens aan het model te geven en te
// vragen of het iets ziet. Dat levert vloeiende tekst op die niet te
// controleren is, en bij haar is dat precies het verkeerde: zij heeft al
// twee keer een uitspraak moeten weerleggen die nergens op rustte.
//
// Dus de verdeling hier: dit bestand rékent, en het model duidt. Elk
// getal in de analyse komt uit een functie die ook los te testen is;
// wat niet berekend kan worden staat er als "onbekend" en niet als een
// voorzichtige formulering. Het model krijgt dat dossier en mag er
// verbanden in zoeken — maar geen cijfers aan toevoegen.
//
// Daarmee staat er ook iets zinnigs op het scherm als de AI-aanroep
// mislukt of nog niet is ingesteld. Dat is het verschil tussen een
// analyse en een praatje.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series } from './timeline';
import { trends } from './trends';
import { CYCLE_METRICS, phasePattern, PHASE_ORDER } from './cyclePatterns';
import { steadyEfficiency, gemetenProgressie } from './gemetenTempo';
import { krachtBeeld } from './krachtBronnen';
import { loadWorkouts } from './workouts';
import { readSymptoms, pemFreeWeeks } from './symptoms';
import { loadAnalyses } from './photoAnalysis';
import { intensityDistribution } from './intensityDistribution';

export const KWARTAAL_DAGEN = 90;

const mediaan = (a) => {
  const v = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const rond = (x, n = 1) => (x == null ? null : +x.toFixed(n));

// ── Wat de cyclus met elke maat doet ────────────────────────────
//
// Niet één metriek maar alle, want dat is wat zij vroeg. Alleen de
// patronen die over minstens twee cycli dezelfde kant op wijzen komen
// erin; één cyclus is een waarneming en geen patroon.
function cyclusPatronen({ currentDate }) {
  const uit = [];
  for (const m of CYCLE_METRICS) {
    for (const fase of PHASE_ORDER) {
      let p;
      try { p = phasePattern(m.id, fase, { asOf: currentDate }); } catch { continue; }
      if (!p?.known || p.cycles < 2) continue;
      uit.push({
        metric: m.id, label: m.label, unit: m.unit,
        // De fase-id is al Nederlands ('laatluteaal'); geen aparte tabel.
        phase: fase, phaseLabel: fase,
        delta: p.meanDelta, cycles: p.cycles, confidence: p.confidence, note: p.note,
      });
    }
  }
  return uit;
}

// ── Het lichaam: maten en de beoordeelde foto's ─────────────────
function lichaam({ currentDate, vanaf }) {
  const maten = ['weight', 'waist', 'navel', 'hip', 'chest', 'thigh', 'arm'];
  const uit = [];
  for (const id of maten) {
    const rijen = series(id, { asOf: currentDate })
      .filter(o => o.observedAt >= vanaf && typeof o.value === 'number');
    if (rijen.length < 2) {
      uit.push({ id, known: false, n: rijen.length });
      continue;
    }
    const eerst = rijen[0], laatst = rijen[rijen.length - 1];
    uit.push({ id, known: true, n: rijen.length,
      from: eerst.value, to: laatst.value,
      fromDate: eerst.observedAt, toDate: laatst.observedAt,
      delta: rond(laatst.value - eerst.value, 1), unit: eerst.unit || null });
  }
  // De beoordeelde fotoparen in dit kwartaal — met hun zekerheid, want
  // een beoordeling van twee onvergelijkbare beelden hoort niet even
  // zwaar te wegen als een van een nette serie.
  const fotos = loadAnalyses()
    .filter(a => a.to >= vanaf && a.to <= currentDate)
    .map(a => ({ from: a.from, to: a.to, confidence: a.confidence || null,
      fields: a.fields || {}, summary: a.summary || null }));
  return { maten: uit, fotos };
}

// ── Training over het kwartaal ──────────────────────────────────
function training({ currentDate, vanaf, logs, workouts }) {
  const runs = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date >= vanaf && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null));
  const dagen = [...new Set(runs.map(w => w.date))].sort();
  const weken = Math.max(1, KWARTAAL_DAGEN / 7);
  const minuten = runs.reduce((a, w) => a + (Number(w.duration) || 0), 0);
  const km = runs.reduce((a, w) => a + (Number(w.distance) || 0), 0);

  // Gaten: hoe vaak viel het stil? Dat is bij haar de kern van het
  // verhaal, en het verdwijnt in een gemiddelde per week.
  const gaten = dagen.slice(1).map((d, i) => daysBetween(dagen[i], d));
  const ef = runs.map(steadyEfficiency).filter(x => x && !x.hrSuspect);

  let verdeling = null;
  try { verdeling = intensityDistribution({ logs, currentDate }); } catch { /* geen data */ }

  return {
    runDays: dagen.length,
    perWeek: rond(dagen.length / weken, 2),
    minutes: Math.round(minuten),
    km: rond(km, 1),
    largestGap: gaten.length ? Math.max(...gaten) : null,
    gapsOverWeek: gaten.filter(g => g > 7).length,
    efficiency: ef.length ? { n: ef.length, from: ef[0]?.ef, to: ef[ef.length - 1]?.ef,
      best: Math.max(...ef.map(x => x.ef)) } : { n: 0 },
    rate: gemetenProgressie({ currentDate, workouts }),
    strength: krachtBeeld({ currentDate, logs, dagen: KWARTAAL_DAGEN }),
    intensity: verdeling?.available ? {
      easyShare: verdeling.shares?.herstel + verdeling.shares?.rustig,
      guideline: 80, note: verdeling.label || null,
    } : null,
  };
}

// ── Herstel en gezondheid ───────────────────────────────────────
function herstel({ currentDate, vanaf, logs }) {
  const inVenster = Object.entries(logs || {})
    .map(([k, l]) => ({ ...l, date: l?.date || k }))
    .filter(l => l.date >= vanaf && l.date <= currentDate);

  const med = (veld) => mediaan(inVenster.map(l => Number(l[veld])).filter(Number.isFinite));
  const tel = (f) => inVenster.filter(f).length;

  const infecties = inVenster.filter(l => readSymptoms(l).infection?.present)
    .map(l => l.date);
  const migraines = inVenster.filter(l => readSymptoms(l).migraine?.present)
    .map(l => l.date);

  return {
    hrv: { median: med('hrv'), n: inVenster.filter(l => l.hrv != null).length },
    hrRest: { median: med('hr_rest'), n: inVenster.filter(l => l.hr_rest != null).length },
    sleep: { median: med('sleep_hours'),
      n: inVenster.filter(l => l.sleep_hours != null).length,
      onder7: tel(l => Number(l.sleep_hours) < 7) },
    pemFree: pemFreeWeeks({ logs, currentDate }),
    infections: { days: infecties.length, dates: infecties.slice(0, 8) },
    migraines: { days: migraines.length, dates: migraines.slice(0, 8) },
    loggedDays: inVenster.length,
  };
}

// ── Het dossier ─────────────────────────────────────────────────
export function kwartaalDossier({ currentDate = todayLocal(), logs = {},
  workouts = null } = {}) {
  const vanaf = addDays(currentDate, -(KWARTAAL_DAGEN - 1));
  const t = (() => {
    try { return trends({ currentDate, logs, workouts }); } catch { return null; }
  })();

  const dossier = {
    van: vanaf, tot: currentDate, dagen: KWARTAAL_DAGEN,
    trends: t,
    cyclus: cyclusPatronen({ currentDate }),
    lichaam: lichaam({ currentDate, vanaf }),
    training: training({ currentDate, vanaf, logs, workouts }),
    herstel: herstel({ currentDate, vanaf, logs }),
  };

  // ── Wat ontbreekt ─────────────────────────────────────────────
  //
  // Dit hoort in het dossier en niet in een voetnoot: een model dat niet
  // weet wat er mist, vult het gat met iets plausibels. En zij hoort te
  // zien waarom een conclusie uitblijft, zodat invullen een keuze wordt
  // in plaats van huiswerk zonder zichtbaar nut.
  const gaten = [];
  const nodig = Math.round(KWARTAAL_DAGEN / 3);
  if (dossier.herstel.hrv.n < nodig) {
    gaten.push(`HRV op ${dossier.herstel.hrv.n} van de ${KWARTAAL_DAGEN} dagen — te `
      + 'weinig voor een uitspraak over je autonome herstel.');
  }
  if (dossier.herstel.sleep.n < nodig) {
    gaten.push(`Slaap op ${dossier.herstel.sleep.n} dagen ingevuld.`);
  }
  if (!dossier.cyclus.length) {
    gaten.push('Nog geen enkele maat die over twee cycli hetzelfde patroon laat zien — '
      + 'daarvoor zijn twee afgesloten cycli met metingen nodig.');
  }
  if (!dossier.lichaam.fotos.length) {
    gaten.push('Geen beoordeeld fotopaar in dit kwartaal.');
  }
  if (dossier.training.efficiency.n < 6) {
    gaten.push(`${dossier.training.efficiency.n} bruikbare economiemetingen — een `
      + 'loopblok van vijf minuten of langer levert er een op.');
  }
  dossier.gaten = gaten;

  // ── De observaties die de code zelf hard kan maken ───────────
  //
  // Dit is het deel dat ook zonder AI blijft staan, en het is bewust
  // kaal: alleen wat uit een berekening volgt, met het getal erbij.
  const obs = [];
  const tr = (id) => t?.metrics?.find(m => m.id === id);
  for (const id of ['hrv', 'hr_rest', 'efficientie', 'loopdagen', 'kracht']) {
    const m = tr(id);
    if (!m) continue;
    if (/^richting_/.test(m.duiding.id)) {
      obs.push({ id: `trend_${id}`, zwaar: true,
        tekst: `${m.label}: ${m.duiding.tekst}` });
    }
  }
  if (dossier.training.largestGap > 7) {
    obs.push({ id: 'gaten', zwaar: true,
      tekst: `${dossier.training.gapsOverWeek} onderbreking(en) langer dan een week, de `
        + `langste ${dossier.training.largestGap} dagen. Aanpassing vraagt herhaling `
        + 'binnen twee à drie dagen; een gat van meer dan een week zet de teller terug.' });
  }
  if (dossier.training.strength.zwaar === 0 && dossier.training.strength.dagenMetKracht > 0) {
    obs.push({ id: 'kracht_licht', zwaar: false,
      tekst: `${dossier.training.strength.dagenMetKracht} krachtdagen, waarvan geen enkele `
        + 'zwaar. De loopeconomiewinst uit de literatuur komt van zware, lage '
        + 'herhalingen.' });
  }
  if (dossier.herstel.infections.days) {
    obs.push({ id: 'ziek', zwaar: false,
      tekst: `${dossier.herstel.infections.days} dag(en) met een gemelde infectie. Die `
        + 'tellen niet mee als reactie op je training en breken je PEM-vrije reeks niet.' });
  }
  for (const c of dossier.cyclus.slice(0, 4)) {
    obs.push({ id: `cyclus_${c.metric}_${c.phase}`, zwaar: false,
      tekst: `${c.label} in je ${c.phaseLabel}: ${c.note}` });
  }
  dossier.observaties = obs;

  return dossier;
}

// ── Het dossier als tekst, voor het model ───────────────────────
//
// Expliciet en kaal. Elk getal met zijn eenheid en het aantal metingen
// waarop het rust, zodat het model kan zien wat zwaar weegt en wat niet.
export function dossierAlsTekst(d) {
  if (!d) return '';
  const L = [];
  const zeg = (s) => L.push(s);
  zeg(`KWARTAALDOSSIER ${d.van} t/m ${d.tot} (${d.dagen} dagen)`);
  zeg('');
  zeg('TRENDS (elk venster tegen de periode ervoor van dezelfde lengte):');
  for (const m of (d.trends?.metrics || [])) {
    const rij = m.horizons.filter(h => h.known)
      .map(h => `${h.kort} ${h.weergave} (${h.richting})`).join(' · ');
    zeg(`  ${m.label}: ${rij || 'te weinig metingen'} — ${m.duiding.tekst}`);
  }
  zeg('');
  zeg('CYCLUSPATRONEN (alleen patronen over minstens twee cycli):');
  if (!d.cyclus.length) zeg('  geen');
  for (const c of d.cyclus) {
    zeg(`  ${c.label} · ${c.phaseLabel}: ${c.delta > 0 ? '+' : ''}${c.delta} ${c.unit}`
      + ` over ${c.cycles} cycli (zekerheid ${c.confidence})`);
  }
  zeg('');
  zeg('TRAINING:');
  const tr = d.training;
  zeg(`  ${tr.runDays} loopdagen (${tr.perWeek}/week), ${tr.minutes} min, ${tr.km} km`);
  zeg(`  grootste gat ${tr.largestGap ?? '—'} dagen, ${tr.gapsOverWeek} onderbrekingen > 1 week`);
  zeg(`  economie: ${tr.efficiency.n} metingen`
    + (tr.efficiency.n ? `, ${tr.efficiency.from} → ${tr.efficiency.to} (beste ${tr.efficiency.best})` : ''));
  zeg(`  gemeten tempo van vooruitgang: ${tr.rate?.known ? `${tr.rate.pctPerWeek}%/week` : 'niet te meten'}`);
  zeg(`  kracht: ${tr.strength.regel}`);
  if (tr.intensity) zeg(`  intensiteit: ${tr.intensity.easyShare}% rustig (richtlijn ${tr.intensity.guideline}%)`);
  zeg('');
  zeg('HERSTEL:');
  const h = d.herstel;
  zeg(`  HRV mediaan ${h.hrv.median ?? '—'} ms (${h.hrv.n} metingen)`);
  zeg(`  rusthartslag mediaan ${h.hrRest.median ?? '—'} bpm (${h.hrRest.n} metingen)`);
  zeg(`  slaap mediaan ${h.sleep.median ?? '—'} uur, ${h.sleep.onder7} nachten onder 7`);
  zeg(`  PEM-vrij: ${h.pemFree?.weeks ?? '—'} weken`);
  zeg(`  infecties: ${h.infections.days} dagen · migraine: ${h.migraines.days} dagen`);
  zeg('');
  zeg('LICHAAM:');
  for (const m of d.lichaam.maten) {
    zeg(`  ${m.id}: ${m.known ? `${m.from} → ${m.to} (${m.delta > 0 ? '+' : ''}${m.delta})`
      : `te weinig metingen (${m.n})`}`);
  }
  for (const f of d.lichaam.fotos) {
    zeg(`  fotopaar ${f.from} → ${f.to} (zekerheid ${f.confidence || 'onbekend'}): `
      + `${f.fields.overall_direction || 'geen oordeel'}`);
  }
  zeg('');
  zeg('WAT ONTBREEKT (hierover geen conclusies trekken):');
  if (!d.gaten.length) zeg('  niets wezenlijks');
  for (const g of d.gaten) zeg(`  - ${g}`);
  return L.join('\n');
}
