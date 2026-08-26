// Foto's die werkelijk bekeken worden.
//
// ─────────────────────────────────────────────────────────────────
// WAT IK AANTROF, EN WAAROM DIT BESTAND ER IS
//
// In ai.js stond al een functie die base64-afbeeldingen als image-blokken
// naar het model stuurde. Die functie werd nergens aangeroepen. Geen enkel
// scherm, geen enkele knop. Wat de coach over haar lichaam "zag" waren
// uitsluitend haar eigen tekstnotities uit gc_photo_observations.
//
// Dat is precies het verschil dat de opdracht verbiedt te vervagen: een
// opgeslagen zin als "taille lijkt smaller" is een herinnering aan een
// waarneming, geen waarneming. Twee foto's naast elkaar leggen en zeggen
// wat er anders is, is iets anders — en dat gebeurde niet.
//
// Dit bestand maakt het wél waar, en is even expliciet over de grenzen:
//
//   · het model krijgt de daadwerkelijke beelden, gelabeld met datum en
//     aanzicht, in een vaste volgorde (oud → nieuw);
//   · het antwoord komt terug als velden, niet als proza, zodat het over
//     maanden vergelijkbaar blijft;
//   · elke vergelijking draagt een vergelijkbaarheidsscore die uit de
//     omstandigheden komt, niet uit de stelligheid van de tekst;
//   · uit beeld komt nooit een percentage, een kilo of een centimeter.
//     Wat je op een foto ziet is vorm, contour en houding.
//
// De eerlijkheid over beperkingen staat in analysisCapability(). Die tekst
// hoort in de app te staan, niet alleen in dit commentaar.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { cycleDayOf } from './bodyReview';

const SESSION_KEY = 'gc_photo_sessions';    // omstandigheden per fotomoment
const ANALYSIS_KEY = 'gc_photo_analyses';   // uitkomsten van echte vergelijkingen

// ── De aanzichten ───────────────────────────────────────────────
// Het gezicht is toegevoegd omdat vocht daar het eerst en het duidelijkst
// zichtbaar is — precies het signaal dat in de perimenopauze met een
// hormonale fase meebeweegt en dat een weegschaal niet los kan trekken van
// werkelijke vetverandering.
export const VIEWS = [
  { key: 'voor', label: 'Voor', en: 'front',
    aim: 'Recht van voren, armen los langs het lichaam, voeten op heupbreedte.' },
  { key: 'zij', label: 'Zij', en: 'side',
    aim: 'Een kwartslag gedraaid, dezelfde kant elke keer, armen langs het lichaam.' },
  { key: 'achter', label: 'Achter', en: 'back',
    aim: 'Recht van achteren, schouders ontspannen.' },
  { key: 'gezicht', label: 'Gezicht', en: 'face',
    aim: 'Recht van voren, neutrale uitdrukking, geen lachen — vocht in het gezicht is anders niet te volgen.' },
];

export const VIEW_KEYS = VIEWS.map(v => v.key);

// ── Standaardisatie vóór de opname ──────────────────────────────
// Deze stappen worden getoond vóórdat er een foto gemaakt wordt, niet erna.
// Elke stap is ook een veld: wat je hebt aangehouden bepaalt straks hoeveel
// een vergelijking waard is.
export const STANDARD_STEPS = [
  { id: 'sameSpot', label: 'Zelfde plek en achtergrond',
    hint: 'Kies één muur en blijf daarbij. Markeer desnoods de plek op de vloer.' },
  { id: 'sameLight', label: 'Zelfde licht',
    hint: 'Daglicht van opzij is het meest constant. Geen tegenlicht, geen plafondspot recht boven je.' },
  { id: 'sameDistance', label: 'Zelfde afstand en camerahoogte',
    hint: 'Camera op ongeveer heuphoogte, telefoon rechtop, niet gekanteld.' },
  { id: 'sameClothing', label: 'Vergelijkbare kleding',
    hint: 'Strak genoeg om de contour te zien. Steeds hetzelfde setje werkt het best.' },
  { id: 'relaxed', label: 'Ontspannen staan',
    hint: 'Niet aanspannen, niet inhouden, niet rechttrekken. Anders vergelijk je houding.' },
  { id: 'morning', label: "'s Ochtends, vóór het eten",
    hint: 'Het moment op de dag verandert je buikomvang meer dan een week trainen dat doet.' },
];

// Wat er per fotomoment wordt vastgelegd naast de beelden zelf.
export const CONTEXT_FIELDS = [
  { id: 'timeOfDay', label: 'Tijdstip', type: 'choice',
    options: ['ochtend nuchter', 'ochtend na ontbijt', 'middag', 'avond'] },
  { id: 'light', label: 'Licht', type: 'choice',
    options: ['daglicht', 'kunstlicht', 'gemengd'] },
  { id: 'clothing', label: 'Kleding', type: 'text',
    hint: 'Bijvoorbeeld: zwarte sportbeha + korte legging' },
  { id: 'note', label: 'Bijzonderheden', type: 'text',
    hint: 'Opgeblazen gevoel, slecht geslapen, net gesport — alles wat het beeld kan kleuren.' },
];

// ── Opslag van de omstandigheden ────────────────────────────────
function lees(key, terug) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? terug;
  } catch { return terug; }
}

export function loadSessionMeta() {
  const v = lees(SESSION_KEY, {});
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

// observedAt is de datum waarop de foto gemaakt is; enteredAt is wanneer
// hij is ingevoerd. Die twee lopen uiteen zodra je een oude serie alsnog
// toevoegt, en dan hoort de tijdlijn de opnamedatum te gebruiken.
export function saveSessionMeta(date, velden) {
  const alles = loadSessionMeta();
  const bestaand = alles[date] || {};
  alles[date] = {
    ...bestaand, ...velden,
    observedAt: date,
    enteredAt: bestaand.enteredAt || new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(alles));
  return alles[date];
}

export function deleteSessionMeta(date) {
  const alles = loadSessionMeta();
  delete alles[date];
  localStorage.setItem(SESSION_KEY, JSON.stringify(alles));
}

export function sessionMeta(date) {
  return loadSessionMeta()[date] || null;
}

// ── Vergelijkbaarheid ───────────────────────────────────────────
// De kern van eerlijk vergelijken. Twee foto's onder verschillend licht,
// op een ander tijdstip, in andere kleding zeggen weinig — en dan hoort de
// uitspraak zwakker te zijn, niet mooier.
//
// De score is geen natuurkunde maar een kalibratie: een gewogen aftreksom
// vanaf 1,0. De gewichten staan hier expliciet zodat ze te bespreken zijn.
export const COMPARABILITY_PENALTY = {
  ONBEKEND: 0.25,       // van één van beide sessies is niets vastgelegd
  ANDER_LICHT: 0.20,
  ANDER_TIJDSTIP: 0.20,
  ANDERE_KLEDING: 0.10,
  NIET_ONTSPANNEN: 0.15,
  ANDERE_PLEK: 0.20,
  KORT_INTERVAL: 0.25,  // minder dan twee weken ertussen
};

export const CONFIDENCE = {
  HIGH: 'hoog',
  MEDIUM: 'redelijk',
  LOW: 'laag',
  NONE: 'geen',
};

export function comparability(dateA, dateB) {
  const a = sessionMeta(dateA);
  const b = sessionMeta(dateB);
  const dagen = Math.abs(daysBetween(dateA, dateB));
  const redenen = [];
  let score = 1;

  const straf = (p, reden) => { score -= p; redenen.push(reden); };

  if (!a || !b) {
    straf(COMPARABILITY_PENALTY.ONBEKEND,
      'Van minstens één van beide momenten zijn de omstandigheden niet vastgelegd.');
  } else {
    if (a.light && b.light && a.light !== b.light) {
      straf(COMPARABILITY_PENALTY.ANDER_LICHT, `Ander licht (${a.light} tegenover ${b.light}).`);
    }
    if (a.timeOfDay && b.timeOfDay && a.timeOfDay !== b.timeOfDay) {
      straf(COMPARABILITY_PENALTY.ANDER_TIJDSTIP,
        `Ander tijdstip (${a.timeOfDay} tegenover ${b.timeOfDay}) — dat verandert je buikomvang meer dan een week trainen.`);
    }
    if (a.clothing && b.clothing && a.clothing.trim() !== b.clothing.trim()) {
      straf(COMPARABILITY_PENALTY.ANDERE_KLEDING, 'Andere kleding.');
    }
    if (a.sameSpot === false || b.sameSpot === false) {
      straf(COMPARABILITY_PENALTY.ANDERE_PLEK, 'Niet dezelfde plek of achtergrond.');
    }
    if (a.relaxed === false || b.relaxed === false) {
      straf(COMPARABILITY_PENALTY.NIET_ONTSPANNEN,
        'Bij minstens één opname was de houding niet ontspannen — dan vergelijk je spanning, geen vorm.');
    }
  }

  if (dagen < 14) {
    straf(COMPARABILITY_PENALTY.KORT_INTERVAL,
      `Er zit maar ${dagen} dagen tussen. Onder de twee weken zie je vooral vocht, licht en houding.`);
  }

  score = Math.max(0, Math.min(1, +score.toFixed(2)));
  // De drempels liggen hoog met opzet. 'Hoog' hoort te betekenen dat er
  // werkelijk niets in de weg zit; twee gewone afwijkingen — ander licht en
  // een ander tijdstip — moeten samen genoeg zijn om op 'laag' uit te komen.
  const niveau = score >= 0.85 ? CONFIDENCE.HIGH
    : score >= 0.65 ? CONFIDENCE.MEDIUM
      : score > 0 ? CONFIDENCE.LOW : CONFIDENCE.NONE;

  return {
    score, level: niveau, daysApart: dagen, reasons: redenen,
    note: redenen.length
      ? `Vergelijkbaarheid ${niveau} (${score}). ${redenen.join(' ')}`
      : `Vergelijkbaarheid ${niveau} (${score}). Zelfde omstandigheden, ${dagen} dagen ertussen.`,
  };
}

// ── De vijf tijdschalen ─────────────────────────────────────────
// Verandering over een week ziet er anders uit dan verandering over een
// kwartaal, en beide zijn iets waard. Wat hier gebeurt is dat elke schaal
// zijn eigen referentieserie krijgt — en zijn eigen mate van zekerheid.
export const TRACK = {
  WEEK: 'week',
  MONTH: 'maand',
  QUARTER: 'kwartaal',
  START: 'begin',
  CYCLE: 'zelfde cyclusfase',
};

const TRACK_SPEC = [
  { id: TRACK.WEEK, label: 'Ten opzichte van vorige week', target: 7, tol: 4,
    reads: 'vocht, houding en licht — nog niet je vorm' },
  { id: TRACK.MONTH, label: 'Ten opzichte van vier weken terug', target: 28, tol: 7,
    reads: 'de eerste zichtbare verandering in contour' },
  { id: TRACK.QUARTER, label: 'Ten opzichte van drie maanden terug', target: 84, tol: 21,
    reads: 'werkelijke verandering in vorm en verdeling' },
];

// Alle series met minstens één foto, oplopend in tijd.
function bruikbareSeries(sessions, asOf) {
  return (sessions || [])
    .filter(s => s?.date && s.date <= asOf && Object.keys(s.views || {}).length)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function dichtstbij(series, doelDatum, tolerantie) {
  let beste = null, besteGat = Infinity;
  for (const s of series) {
    const gat = Math.abs(daysBetween(s.date, doelDatum));
    if (gat <= tolerantie && gat < besteGat) { beste = s; besteGat = gat; }
  }
  return beste;
}

export function comparisonTracks(sessions = [], { asOf = todayLocal() } = {}) {
  const series = bruikbareSeries(sessions, asOf);
  if (!series.length) {
    return { available: false, tracks: [],
      note: 'Nog geen foto\'s. Eén serie is genoeg om te beginnen — over vier weken heb je er iets aan.' };
  }
  const huidig = series[series.length - 1];
  const eerder = series.slice(0, -1);

  const sporen = [];

  for (const spec of TRACK_SPEC) {
    const doel = addDays(huidig.date, -spec.target);
    const ref = dichtstbij(eerder, doel, spec.tol);
    if (!ref) {
      sporen.push({ id: spec.id, label: spec.label, available: false,
        reason: `Geen serie rond ${doel}. Deze vergelijking bestaat pas als daar een fotomoment ligt.` });
      continue;
    }
    sporen.push({
      id: spec.id, label: spec.label, available: true,
      from: ref, to: huidig, reads: spec.reads,
      comparability: comparability(ref.date, huidig.date),
    });
  }

  // Het begin. Altijd beschikbaar zodra er twee series zijn, en altijd de
  // meest overtuigende — de afstand in tijd doet hier het werk.
  const start = eerder[0];
  if (start) {
    sporen.push({
      id: TRACK.START, label: 'Ten opzichte van je eerste serie', available: true,
      from: start, to: huidig,
      reads: 'het hele verhaal tot nu toe',
      comparability: comparability(start.date, huidig.date),
    });
  } else {
    sporen.push({ id: TRACK.START, label: 'Ten opzichte van je eerste serie', available: false,
      reason: 'Dit ís je eerste serie. Vanaf hier telt hij als ijkpunt.' });
  }

  // Dezelfde hormonale context. Zonder deze vergelijking ligt elke uitspraak
  // over "voller" of "strakker" op één hoop met de cyclus (§26).
  const nuDag = cycleDayOf(huidig.date, { asOf });
  if (nuDag == null) {
    sporen.push({ id: TRACK.CYCLE, label: 'Ten opzichte van dezelfde cyclusfase', available: false,
      reason: 'Geen menstruatiedata rond deze datums, dus geen hormonaal vergelijkbare serie.' });
  } else {
    const kandidaten = eerder
      .map(s => ({ s, dag: cycleDayOf(s.date, { asOf }) }))
      .filter(k => k.dag != null && Math.abs(k.dag - nuDag) <= 3);
    const beste = kandidaten.sort((a, b) =>
      Math.abs(a.dag - nuDag) - Math.abs(b.dag - nuDag) ||
      b.s.date.localeCompare(a.s.date))[0];
    if (!beste) {
      sporen.push({ id: TRACK.CYCLE, label: 'Ten opzichte van dezelfde cyclusfase', available: false,
        currentCycleDay: nuDag,
        reason: `Nog geen eerdere serie rond cyclusdag ${nuDag}. Die vergelijking ontstaat vanzelf als je dit volhoudt.` });
    } else {
      sporen.push({
        id: TRACK.CYCLE, label: 'Ten opzichte van dezelfde cyclusfase', available: true,
        from: beste.s, to: huidig,
        currentCycleDay: nuDag, referenceCycleDay: beste.dag,
        reads: `beide rond cyclusdag ${nuDag} — hormonaal het eerlijkste beeld`,
        comparability: comparability(beste.s.date, huidig.date),
      });
    }
  }

  return {
    available: true,
    current: huidig,
    seriesCount: series.length,
    tracks: sporen,
    usable: sporen.filter(t => t.available).length,
    note: sporen.every(t => !t.available)
      ? 'Er is één serie. Vergelijken kan pas vanaf de tweede.'
      : null,
  };
}

// ── Wat er uit een vergelijking terugkomt ───────────────────────
// Vaste velden, zodat de uitspraak van vandaag over drie maanden nog naast
// die van toen te leggen is. Vrije tekst is prettig om te lezen en waardeloos
// om te vergelijken.
export const ANALYSIS_FIELDS = [
  { id: 'waist_definition', label: 'Taillecontour',
    scale: ['duidelijk minder', 'iets minder', 'gelijk', 'iets meer', 'duidelijk meer'],
    ask: 'Is de inham tussen ribbenboog en heup duidelijker of vlakker geworden?' },
  { id: 'abdominal_profile', label: 'Buikprofiel',
    scale: ['duidelijk vlakker', 'iets vlakker', 'gelijk', 'iets boller', 'duidelijk boller'],
    ask: 'Hoe loopt de lijn van borstbeen naar schaambeen in zijaanzicht?' },
  { id: 'hip_thigh_volume', label: 'Heup en dijen',
    scale: ['duidelijk minder', 'iets minder', 'gelijk', 'iets meer', 'duidelijk meer'],
    ask: 'Verandert het volume rond heup en bovenbenen?' },
  { id: 'muscle_definition', label: 'Spierdefinitie',
    scale: ['duidelijk minder', 'iets minder', 'gelijk', 'iets meer', 'duidelijk meer'],
    ask: 'Tekenen schouders, rug, billen of benen zich duidelijker af?' },
  { id: 'posture', label: 'Houding',
    scale: ['duidelijk slechter', 'iets slechter', 'gelijk', 'iets beter', 'duidelijk beter'],
    ask: 'Staat ze rechter, schouders meer naar achteren, bekken neutraler?' },
  { id: 'facial_fluid', label: 'Vocht in het gezicht',
    scale: ['duidelijk minder', 'iets minder', 'gelijk', 'iets meer', 'duidelijk meer'],
    ask: 'Kaaklijn, oogleden en wangen: voller of scherper?' },
  { id: 'overall_direction', label: 'Algemene richting',
    scale: ['duidelijk ongunstig', 'iets ongunstig', 'geen verandering', 'iets gunstig', 'duidelijk gunstig'],
    ask: 'Wat is de richting als je alles bij elkaar neemt?' },
];

export const SCALE_NEUTRAL = 'gelijk';

// De JSON-vorm die het model moet aanhouden.
export function analysisSchema() {
  const velden = {};
  for (const f of ANALYSIS_FIELDS) {
    velden[f.id] = `één van: ${f.scale.map(s => `"${s}"`).join(' | ')}`;
    velden[`${f.id}_evidence`] = 'in één zin: wat je in het beeld ziet waaruit dat blijkt, of "niet te zien"';
  }
  velden.comparison_confidence = 'één van: "hoog" | "redelijk" | "laag" | "geen"';
  velden.confidence_reason = 'in één zin: wat de zekerheid beperkt (licht, houding, kleding, tijd ertussen, aanzicht ontbreekt)';
  velden.not_visible = 'lijst van velden die op deze beelden werkelijk niet te beoordelen zijn';
  velden.summary = 'maximaal drie zinnen, Nederlands, zonder getallen';
  return velden;
}

// ── De aanvraag die naar het model gaat ─────────────────────────
// Volgorde is onderdeel van de vraag: eerst de referentie, dan het heden.
// Het model moet weten wélke afbeelding welke is, anders vergelijkt het
// twee anonieme plaatjes.
export function buildComparisonRequest(track, photosByDate, { asOf = todayLocal() } = {}) {
  if (!track?.available) {
    return { ok: false, reason: track?.reason || 'Deze vergelijking is niet beschikbaar.' };
  }
  const refDatum = track.from.date;
  const nuDatum = track.to.date;

  const beelden = [];
  const labels = [];
  for (const rol of [{ datum: refDatum, rol: 'REFERENTIE' }, { datum: nuDatum, rol: 'NU' }]) {
    for (const v of VIEWS) {
      const foto = photosByDate?.[rol.datum]?.[v.key];
      if (!foto?.base64) continue;
      beelden.push({ base64: foto.base64, mimeType: foto.mimeType || 'image/jpeg' });
      labels.push(`afbeelding ${beelden.length}: ${rol.rol} ${rol.datum} — ${v.label.toLowerCase()}`);
    }
  }

  // Eén beeld is geen vergelijking. Dat hoort een weigering te zijn, geen
  // aanroep die iets plausibels terugpraat.
  const refAantal = labels.filter(l => l.includes('REFERENTIE')).length;
  const nuAantal = labels.filter(l => l.includes('NU')).length;
  if (!refAantal || !nuAantal) {
    return { ok: false,
      reason: `Voor deze vergelijking ontbreken beelden (${refAantal} van ${refDatum}, ${nuAantal} van ${nuDatum}).` };
  }

  // Alleen aanzichten die aan béíde kanten bestaan zijn te vergelijken.
  const aanwezig = (datum) => VIEW_KEYS.filter(k => photosByDate?.[datum]?.[k]);
  const gedeeld = aanwezig(refDatum).filter(k => aanwezig(nuDatum).includes(k));
  const eenzijdig = [...new Set([...aanwezig(refDatum), ...aanwezig(nuDatum)])]
    .filter(k => !gedeeld.includes(k));

  return {
    ok: true,
    track: track.id,
    from: refDatum, to: nuDatum,
    images: beelden,
    labels,
    sharedViews: gedeeld,
    unpairedViews: eenzijdig,
    comparability: track.comparability,
    asOf,
  };
}

// ── Het antwoord binnenhalen zonder het te geloven ──────────────
// Een model kan een veld verzinnen, een schaalwaarde net anders schrijven of
// een zekerheid opschroeven. Alle drie worden hier afgevangen: onbekende
// waarden vallen terug op neutraal, en de vergelijkbaarheid mag alleen
// omlaag ten opzichte van wat de omstandigheden toelaten.
const CONF_ORDER = [CONFIDENCE.NONE, CONFIDENCE.LOW, CONFIDENCE.MEDIUM, CONFIDENCE.HIGH];

export function normalizeAnalysis(raw, request) {
  const velden = {};
  const bewijs = {};
  const nietZichtbaar = new Set(
    Array.isArray(raw?.not_visible) ? raw.not_visible : []);

  for (const f of ANALYSIS_FIELDS) {
    const w = typeof raw?.[f.id] === 'string' ? raw[f.id].trim().toLowerCase() : null;
    const treffer = f.scale.find(s => s.toLowerCase() === w);
    if (!treffer || nietZichtbaar.has(f.id)) {
      velden[f.id] = f.scale[Math.floor(f.scale.length / 2)];
      if (!treffer && w) nietZichtbaar.add(f.id);
    } else {
      velden[f.id] = treffer;
    }
    const e = raw?.[`${f.id}_evidence`];
    if (typeof e === 'string' && e.trim()) bewijs[f.id] = e.trim();
  }

  // De vergelijkbaarheid uit de omstandigheden is het plafond.
  const plafond = request?.comparability?.level || CONFIDENCE.LOW;
  const gemeld = typeof raw?.comparison_confidence === 'string'
    ? raw.comparison_confidence.trim().toLowerCase() : null;
  const gemeldGeldig = CONF_ORDER.includes(gemeld) ? gemeld : plafond;
  const zekerheid = CONF_ORDER.indexOf(gemeldGeldig) < CONF_ORDER.indexOf(plafond)
    ? gemeldGeldig : plafond;

  return {
    fields: velden,
    evidence: bewijs,
    notVisible: [...nietZichtbaar],
    confidence: zekerheid,
    confidenceReason: typeof raw?.confidence_reason === 'string' && raw.confidence_reason.trim()
      ? raw.confidence_reason.trim()
      : (request?.comparability?.reasons?.[0] || null),
    // Als het plafond lager is dan wat het model claimde, hoort dat zichtbaar
    // te zijn: het is een correctie, geen detail.
    cappedFrom: gemeldGeldig !== zekerheid ? gemeldGeldig : null,
    summary: typeof raw?.summary === 'string' ? raw.summary.trim() : null,
    model: raw?._model || null,
    imageCount: raw?._images ?? request?.images?.length ?? 0,
  };
}

// ── Uitkomsten bewaren ──────────────────────────────────────────
export function loadAnalyses() {
  const a = lees(ANALYSIS_KEY, []);
  return Array.isArray(a) ? a : [];
}

export function saveAnalysis(entry) {
  const arr = loadAnalyses();
  const id = entry.id || `pa_${entry.to}_${entry.track}`;
  const rij = {
    id,
    track: entry.track,
    from: entry.from, to: entry.to,
    observedAt: entry.to,
    enteredAt: entry.enteredAt || new Date().toISOString().slice(0, 10),
    fields: entry.fields || {},
    evidence: entry.evidence || {},
    notVisible: entry.notVisible || [],
    confidence: entry.confidence || null,
    confidenceReason: entry.confidenceReason || null,
    comparability: entry.comparability || null,
    // Zonder dit veld is over een half jaar niet meer vast te stellen of een
    // uitspraak uit beeld of uit tekst kwam.
    method: entry.method || 'visual',
    model: entry.model || null,
    viewsCompared: entry.viewsCompared || [],
    summary: entry.summary || null,
  };
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr[i] = rij; else arr.unshift(rij);
  arr.sort((a, b) => (b.to || '').localeCompare(a.to || ''));
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(arr.slice(0, 60)));
  return rij;
}

export function deleteAnalysis(id) {
  const arr = loadAnalyses().filter(x => x.id !== id);
  localStorage.setItem(ANALYSIS_KEY, JSON.stringify(arr));
}

export function analysesFor(date) {
  return loadAnalyses().filter(a => a.to === date);
}

// Wat is er over een reeks vergelijkingen heen consistent gezien?
// Eén analyse is een waarneming; hetzelfde antwoord op meerdere tijdschalen
// is een aanwijzing.
export function convergentFindings({ asOf = todayLocal(), date = null } = {}) {
  const rijen = (date ? analysesFor(date) : loadAnalyses())
    .filter(a => a.to <= asOf && a.method === 'visual');
  if (rijen.length < 2) {
    return { known: false, n: rijen.length,
      note: rijen.length
        ? 'Eén visuele vergelijking. Een tweede tijdschaal maakt het pas een aanwijzing.'
        : 'Nog geen visuele vergelijkingen uitgevoerd.' };
  }

  const uit = [];
  for (const f of ANALYSIS_FIELDS) {
    const waarden = rijen.map(r => r.fields?.[f.id]).filter(Boolean);
    if (waarden.length < 2) continue;
    const nietNeutraal = waarden.filter(w => w !== SCALE_NEUTRAL && !/geen verandering/.test(w));
    if (nietNeutraal.length < 2) continue;
    // Alle niet-neutrale waarden aan dezelfde kant van het midden?
    const kant = (w) => f.scale.indexOf(w) - Math.floor(f.scale.length / 2);
    const richtingen = nietNeutraal.map(w => Math.sign(kant(w)));
    if (richtingen.every(r => r === richtingen[0])) {
      uit.push({ field: f.id, label: f.label, values: nietNeutraal,
        direction: richtingen[0] > 0 ? 'toename' : 'afname', n: nietNeutraal.length });
    }
  }

  return {
    known: uit.length > 0,
    n: rijen.length,
    findings: uit,
    note: uit.length
      ? `Over ${rijen.length} tijdschalen wijst hetzelfde de kant op: ${uit.map(u => `${u.label} (${u.direction})`).join(', ')}.`
      : `Over ${rijen.length} tijdschalen is er geen consistente richting. Dat is zelf ook een uitkomst: er verandert nog niet genoeg om te zien.`,
  };
}

// ── Eerlijk over wat dit wel en niet is ─────────────────────────
// Deze tekst hoort in de app te staan naast elke uitkomst. De opdracht is
// er expliciet over: doe niet alsof een opgeslagen zin hetzelfde is als
// kijken.
export function analysisCapability({ hasVision = true } = {}) {
  if (!hasVision) {
    return {
      visual: false,
      title: 'Geen visuele vergelijking',
      lines: [
        'De foto\'s zijn op dit toestel en in de cloud opgeslagen, maar er is nu geen model dat ze werkelijk bekijkt.',
        'Wat je hieronder ziet zijn jouw eigen tekstobservaties. Dat is een herinnering aan wat je zag, geen vergelijking van de beelden.',
        'Zolang dit zo staat, is elke uitspraak over "zichtbaar veranderd" gebaseerd op wat jij hebt opgeschreven.',
      ],
    };
  }
  return {
    visual: true,
    title: 'Wat hier werkelijk gebeurt',
    lines: [
      'De beelden zelf gaan mee — gelabeld per datum en aanzicht, referentie eerst, vandaag daarna.',
      'Het antwoord komt terug in vaste velden op een schaal, zodat het over maanden vergelijkbaar blijft.',
      'Uit een foto komt geen vetpercentage, geen kilo\'s en geen centimeters. Wat je ziet is contour, vorm en houding.',
      'Bij verschillend licht, tijdstip of kleding daalt de zekerheid — dat staat bij elke uitkomst.',
    ],
  };
}
