// Daily Aliveness — het leven dat je wilt, vandaag al een beetje.
//
// De coach adviseert niet alleen taken. Soms is de beste zet een kleine
// ervaring die je toestand verandert. Het verschil zit in de formulering:
//
//   niet  "Eet een appel."
//   wel   "Pak een frisse appel, ga even buiten zitten en eet hem zonder
//          telefoon. Maak er twee minuten zomer van."
//
//   niet  "Beweeg vijf minuten."
//   wel   "Zet één nummer van Charlotte de Witte aan en dans tot het
//          afgelopen is."
//
// Toon: volwassen, warm, scherp, licht, soms speels. Niet zweverig, niet
// infantiel, geen uitroeptekens.
//
// Alles wat hier staat is een voorstel, nooit een opdracht. Structuur
// dient autonomie.

import { todayLocal, addDays } from './datetime';

const ANCHOR_KEY = 'gc_anchors';
const FEEDBACK_KEY = 'gc_aliveness_feedback';

// ── Toestanden ──────────────────────────────────────────────────
export const STATES = [
  { id: 'ENERGIZE',  emoji: '⚡', label: 'Energie',        cost: 'medium' },
  { id: 'SOFTEN',    emoji: '🫧', label: 'Verzachten',     cost: 'low' },
  { id: 'GROUND',    emoji: '🌍', label: 'Aarden',         cost: 'low' },
  { id: 'PLAY',      emoji: '🎈', label: 'Spelen',         cost: 'medium' },
  { id: 'BEAUTIFUL', emoji: '💄', label: 'Mooi voelen',    cost: 'low' },
  { id: 'FREE',      emoji: '🕊', label: 'Vrij voelen',    cost: 'low' },
  { id: 'STRONG',    emoji: '💪', label: 'Sterk voelen',   cost: 'high' },
  { id: 'RECEIVE',   emoji: '🤲', label: 'Ontvangen',      cost: 'low' },
  { id: 'CREATE',    emoji: '✏️', label: 'Maken',          cost: 'medium' },
  { id: 'ESCAPE',    emoji: '🌅', label: 'Verbeelden',     cost: 'low' },
  { id: 'CONNECT',   emoji: '💬', label: 'Verbinden',      cost: 'medium' },
  { id: 'RECOVER',   emoji: '🛌', label: 'Herstellen',     cost: 'none' },
];

export const stateById = (id) => STATES.find(s => s.id === id) || null;

export const DURATIONS = [1, 5, 10, 20];

// Waar kun je zijn? Bepaalt wat er überhaupt mogelijk is.
export const PLACES = [
  { id: 'home', label: 'Thuis' },
  { id: 'outside', label: 'Buiten' },
  { id: 'away', label: 'Onderweg' },
];

// ── De bibliotheek ──────────────────────────────────────────────
// Elk voorstel is een ervaring, geen taak. `cost` zegt wat het van je
// systeem vraagt; bij PEM of rood blijft alleen 'none' en 'low' over.
const LIBRARY = [
  // ENERGIZE
  { id: 'dance_track', state: 'ENERGIZE', minutes: 5, cost: 'medium', place: ['home'],
    needs: ['music'],
    text: (a) => `Zet één nummer van ${a.music || 'iets met stevige beat'} aan en dans tot het afgelopen is. Niets meten, niets tellen.`,
    tag: 'dansen' },
  { id: 'cold_face', state: 'ENERGIZE', minutes: 1, cost: 'low', place: ['home', 'away'],
    text: () => 'Koud water over je polsen en je gezicht. Dertig seconden. Je systeem schakelt hoorbaar om.',
    tag: 'reset' },
  { id: 'stairs_song', state: 'ENERGIZE', minutes: 5, cost: 'medium', place: ['home'],
    text: () => 'Zet één nummer op en beweeg door het huis alsof je ergens heen moet. Opruimen telt.',
    tag: 'beweging' },

  // SOFTEN
  { id: 'bocelli_rome', state: 'ESCAPE', minutes: 5, cost: 'none', place: ['home'],
    needs: ['music', 'place'],
    text: (a) => `Doe je ogen dicht, zet ${a.music || 'Andrea Bocelli'} op en waan je vijf minuten in ${a.place || 'Rome'}. Liggen mag.`,
    tag: 'verbeelding' },
  { id: 'warm_drink', state: 'SOFTEN', minutes: 10, cost: 'none', place: ['home'],
    needs: ['drink'],
    text: (a) => `Maak ${a.drink || 'iets warms'} in je mooiste kop en drink hem zonder er iets bij te doen. Geen telefoon, geen scherm.`,
    tag: 'zintuiglijk' },
  { id: 'lie_down', state: 'RECOVER', minutes: 20, cost: 'none', place: ['home'],
    text: () => 'Ga plat liggen met je benen tegen de muur. Twintig minuten. Dit is geen luiheid, dit is de investering van vandaag.',
    tag: 'herstel' },
  { id: 'dark_room', state: 'RECOVER', minutes: 10, cost: 'none', place: ['home'],
    text: () => 'Tien minuten in een donkere, stille kamer. Geen podcast, geen muziek. Je hoofd heeft leegte nodig, geen andere input.',
    tag: 'herstel' },

  // GROUND
  { id: 'outside_sit', state: 'GROUND', minutes: 5, cost: 'low', place: ['outside', 'home'],
    text: () => 'Ga vijf minuten buiten zitten. Kijk naar iets dat verder weg is dan drie meter. Meer is het niet.',
    tag: 'buiten' },
  { id: 'apple_summer', state: 'GROUND', minutes: 5, cost: 'none', place: ['home', 'outside'],
    text: () => 'Pak een frisse appel, ga even buiten zitten en eet hem zonder telefoon. Maak er twee minuten zomer van.',
    tag: 'zintuiglijk' },
  { id: 'feet_grass', state: 'GROUND', minutes: 1, cost: 'low', place: ['outside'],
    text: () => 'Schoenen uit, voeten op gras of zand. Eén minuut. Je voeten zijn je eerste contact met de wereld.',
    tag: 'buiten' },

  // PLAY
  { id: 'swing', state: 'PLAY', minutes: 5, cost: 'low', place: ['outside'],
    text: () => 'Ga op een schommel. Hoog. Niemand kijkt, en als ze kijken is dat hun probleem.',
    tag: 'spelen' },
  { id: 'voice_note', state: 'CONNECT', minutes: 1, cost: 'low', place: ['home', 'away', 'outside'],
    text: () => 'Stuur een vriendin een spraakbericht van één minuut. Iets grappigs, niets nuttigs.',
    tag: 'warmte' },
  { id: 'detour', state: 'PLAY', minutes: 10, cost: 'medium', place: ['outside', 'away'],
    text: () => 'Neem onderweg een straat die je niet kent. Tien minuten omweg, meer niet.',
    tag: 'nieuwsgierig' },
  { id: 'loud_kitchen', state: 'PLAY', minutes: 5, cost: 'medium', place: ['home'],
    needs: ['music'],
    text: (a) => `Zet ${a.music || 'iets met een stevige beat'} hard aan in de keuken en zing mee. Vals mag.`,
    tag: 'spelen' },
  { id: 'barefoot_house', state: 'PLAY', minutes: 1, cost: 'low', place: ['home'],
    text: () => 'Loop één rondje door het huis op blote voeten en raak onderweg drie dingen aan die je mooi vindt.',
    tag: 'spelen' },
  { id: 'silly_photo', state: 'PLAY', minutes: 1, cost: 'none', place: ['home', 'away'],
    text: () => 'Maak één belachelijke selfie en stuur hem naar iemand die erom zal lachen.',
    tag: 'spelen' },

  // BEAUTIFUL
  { id: 'tonsurton', state: 'BEAUTIFUL', minutes: 10, cost: 'low', place: ['home'],
    text: () => 'Kies een ton-sur-ton outfit voor vandaag. Niet voor een gelegenheid — gewoon omdat je jezelf tegenkomt in de spiegel.',
    tag: 'stijl' },
  { id: 'table', state: 'BEAUTIFUL', minutes: 10, cost: 'low', place: ['home'],
    text: () => 'Dek de tafel mooi voor een doodgewone maaltijd. Servet, een kaars, iets groens. Sfeer is geen luxe.',
    tag: 'warmte' },
  { id: 'flowers', state: 'BEAUTIFUL', minutes: 5, cost: 'low', place: ['home', 'away'],
    text: () => 'Zet bloemen neer waar je ze de hele dag ziet. Ook als er geen reden voor is.',
    tag: 'schoonheid' },

  // FREE
  { id: 'say_no', state: 'FREE', minutes: 5, cost: 'low', place: ['home', 'away'],
    text: () => 'Zeg één ding af waar je geen zin in hebt. Zonder uitleg, zonder compensatie.',
    tag: 'autonomie' },
  { id: 'empty_block', state: 'FREE', minutes: 1, cost: 'none', place: ['home', 'away'],
    text: () => 'Blokkeer één avond deze week volledig. Niets invullen. De lege ruimte ís het doel.',
    tag: 'autonomie' },
  { id: 'window_open', state: 'FREE', minutes: 1, cost: 'none', place: ['home'],
    text: () => 'Zet een raam wijd open en ga er even voor staan. Eén minuut buitenlucht binnen.',
    tag: 'ruimte' },

  // STRONG
  { id: 'posture', state: 'STRONG', minutes: 1, cost: 'low', place: ['home', 'away'],
    text: () => 'Sta een minuut lang zoals je zou staan als je je al sterk voelde. Schouders open, gewicht op beide voeten. Houding gaat vooraf aan gevoel.',
    tag: 'lichaam' },
  { id: 'carry', state: 'STRONG', minutes: 5, cost: 'high', place: ['home'],
    text: () => 'Pak iets zwaars en draag het rechtop door het huis. Twee keer heen en weer. Je romp weet meteen weer wat hij is.',
    tag: 'kracht' },

  // RECEIVE
  { id: 'let_choose', state: 'RECEIVE', minutes: 1, cost: 'none', place: ['home', 'away'],
    text: () => 'Laat vandaag iemand anders kiezen. Wat er gegeten wordt, welke route, welke film. En zeg er niets bij.',
    tag: 'leunen' },
  { id: 'accept_help', state: 'RECEIVE', minutes: 1, cost: 'none', place: ['home', 'away'],
    text: () => 'Neem hulp aan zonder er iets voor terug te doen. Geen compensatie, geen grap om het weg te lachen.',
    tag: 'leunen' },
  { id: 'compliment', state: 'RECEIVE', minutes: 1, cost: 'none', place: ['home', 'away'],
    text: () => 'Krijg je vandaag een compliment, zeg dan alleen dank je wel. Niets afzwakken.',
    tag: 'leunen' },

  // CREATE
  { id: 'three_lines', state: 'CREATE', minutes: 5, cost: 'low', place: ['home', 'away'],
    text: () => 'Schrijf drie regels over iets dat je vandaag opviel. Niet voor iemand, niet om te bewaren.',
    tag: 'maken' },
  { id: 'one_photo', state: 'CREATE', minutes: 1, cost: 'none', place: ['outside', 'away', 'home'],
    text: () => 'Maak één foto van iets moois dat je toch al zag. Alleen voor jezelf.',
    tag: 'maken' },

  // CONNECT
  { id: 'walk_call', state: 'CONNECT', minutes: 20, cost: 'medium', place: ['outside'],
    text: () => 'Bel een vriendin tijdens een wandeling. Twee dingen die je allebei goeddoen in één beweging.',
    tag: 'warmte' },
  { id: 'real_question', state: 'CONNECT', minutes: 5, cost: 'low', place: ['home'],
    text: () => 'Stel je kind één echt geïnteresseerde vraag en luister het antwoord helemaal uit. Geen vervolgvraag over school.',
    tag: 'warmte' },
  { id: 'music_before', state: 'CONNECT', minutes: 1, cost: 'none', place: ['home'],
    needs: ['music'],
    text: (a) => `Zet ${a.music || 'muziek'} aan vóórdat iedereen thuiskomt. De sfeer staat er dan al.`,
    tag: 'warmte' },
];

// ── Persoonlijke ankers ─────────────────────────────────────────
// Wat de coach van jou weet: welke muziek, welke plek, welke smaak.
// Zonder ankers werkt alles nog steeds, maar generieker.
export const ANCHOR_TYPES = [
  { id: 'music', emoji: '🎵', label: 'Muziek', hint: 'Artiest, nummer of playlist',
    example: 'Charlotte de Witte → energie · Andrea Bocelli → Italië, zachtheid' },
  { id: 'place', emoji: '📍', label: 'Plek in je hoofd', hint: 'Waar je heen gaat als je je ogen sluit',
    example: 'Rome · Parijs · de zee · het strand' },
  { id: 'sensory', emoji: '🕯', label: 'Zintuiglijk', hint: 'Geur, eten, drinken, servies, licht, bloemen',
    example: 'Verse munt · je mooiste kop · kaarslicht' },
  { id: 'activity', emoji: '🏃', label: 'Activiteit', hint: 'Wat je vanzelf doet als je je goed voelt',
    example: 'Dansen · schommelen · zwemmen · lezen · bakken' },
];

export function loadAnchors() {
  try {
    const a = JSON.parse(localStorage.getItem(ANCHOR_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

// anchor = { id, type, label, state, cost, minutes, place, rating, createdAt }
export function saveAnchor(anchor) {
  const arr = loadAnchors();
  const entry = {
    id: anchor.id || `an_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type: anchor.type || 'music',
    label: (anchor.label || '').trim(),
    state: anchor.state || null,
    cost: anchor.cost || 'low',
    minutes: anchor.minutes || 5,
    place: anchor.place || 'home',
    rating: anchor.rating ?? null,
    createdAt: anchor.createdAt || new Date().toISOString(),
  };
  if (!entry.label) return null;
  const i = arr.findIndex(a => a.id === entry.id);
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  localStorage.setItem(ANCHOR_KEY, JSON.stringify(arr));
  return entry;
}

export function deleteAnchor(id) {
  localStorage.setItem(ANCHOR_KEY, JSON.stringify(loadAnchors().filter(a => a.id !== id)));
}

// De ankers die bij een bepaalde toestand passen, als invulwaarden.
function anchorValues(state) {
  const all = loadAnchors();
  // Een anker dat aan deze toestand hangt heeft voorrang, maar een anker
  // zonder toestand — of met een andere — blijft bruikbaar. Anders zou een
  // muziekanker dat je aan 'energie' hebt gekoppeld onzichtbaar zijn zodra
  // de coach iets anders voorstelt.
  const pick = (type) => {
    const candidates = all.filter(a => a.type === type && a.rating !== 0);
    if (!candidates.length) return null;
    // Een anker dat aan een ándere toestand hangt past hier niet: muziek
    // voor verstilling hoort niet in een voorstel om te dansen. Ankers
    // zonder toestand zijn wel altijd bruikbaar.
    const fitting = state
      ? candidates.filter(a => !a.state || a.state === state)
      : candidates;
    const pool = fitting.length ? fitting : candidates.filter(a => !a.state);
    if (!pool.length) return null;
    const score = (a) => (a.state === state ? 100 : 0) + (a.rating ?? 0);
    pool.sort((a, b) => score(b) - score(a));
    return pool[0].label;
  };
  return {
    music: pick('music'),
    place: pick('place'),
    drink: pick('sensory'),
    activity: pick('activity'),
  };
}

// ── Feedback ────────────────────────────────────────────────────
export const FEEDBACK_OPTIONS = [
  { id: 'much', label: 'Veel', score: 2 },
  { id: 'some', label: 'Beetje', score: 1 },
  { id: 'none', label: 'Niet', score: 0 },
  { id: 'annoying', label: 'Irritant — niet meer voorstellen', score: -3 },
];

export function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}'); } catch { return {}; }
}

export function recordFeedback(suggestionId, optionId, { date = todayLocal() } = {}) {
  const all = loadFeedback();
  const prev = all[suggestionId] || { score: 0, count: 0, history: [] };
  const opt = FEEDBACK_OPTIONS.find(o => o.id === optionId);
  all[suggestionId] = {
    score: prev.score + (opt?.score ?? 0),
    count: prev.count + 1,
    blocked: optionId === 'annoying' || prev.blocked === true,
    lastDate: date,
    history: [...(prev.history || []).slice(-9), { date, optionId }],
  };
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
  return all;
}

// ── Context-bewuste keuze ───────────────────────────────────────
// Wat past er nú? Op energie, herstel, PEM, tijd, plek en toestand.
const COST_ORDER = { none: 0, low: 1, medium: 2, high: 3 };

export function suggestExperience({
  log = {}, logs = {}, currentDate = todayLocal(),
  minutes = null, place = 'home', state = null, coach = null,
  wanted = null,          // gevraagde toestand, bijv. 'PLAY'
  exclude = [],
} = {}) {
  const feedback = loadFeedback();

  // Wat mag het kosten? Bij PEM of rood alleen wat niets vraagt.
  const pem = !!(log.symptom_pem || log.training_recovery === 2);
  const decision = coach?.decision || null;
  const energy = log.energy;
  const maxCost = pem || decision === 'RED' ? 'none'
    : decision === 'BLUE' || energy === 0 ? 'low'
    : decision === 'AMBER' || energy === 1 ? 'medium' : 'high';

  // Welke toestand ligt voor de hand als er niets gevraagd is?
  const defaultState = pem || decision === 'RED' ? 'RECOVER'
    : decision === 'BLUE' ? 'SOFTEN'
    : state === 'UIT' ? 'GROUND'
    : state === 'AAN' ? 'PLAY'
    : energy >= 3 ? 'ENERGIZE'
    : 'GROUND';

  const target = wanted || defaultState;

  const scored = LIBRARY
    .filter(x => !exclude.includes(x.id))
    .filter(x => !feedback[x.id]?.blocked)
    .filter(x => COST_ORDER[x.cost] <= COST_ORDER[maxCost])
    .filter(x => minutes == null || x.minutes <= minutes)
    .filter(x => x.place.includes(place))
    .map(x => {
      let score = 0;
      // De juiste toestand weegt zwaarder dan of er een anker bij past:
      // Bocelli op een energieke dag is het verkeerde antwoord.
      if (x.state === target) score += 16;
      // Een voorstel dat een ontbrekend anker nodig heeft werkt wel, maar
      // minder persoonlijk — dus iets lager gewogen.
      // Ankers worden opgehaald voor de toestand van dít voorstel, niet
      // voor het dagdoel. Anders belandt de muziek die je bij verstilling
      // hoort in een voorstel om de keuken bij elkaar te zingen.
      const anchors = anchorValues(x.state);
      if (x.needs?.length) {
        const have = x.needs.filter(n => anchors[n]).length;
        score += have * 4 - (x.needs.length - have) * 2;
      }
      const f = feedback[x.id];
      if (f) score += Math.max(-4, Math.min(6, f.score));
      // Variatie: iets dat je pas nog kreeg staat achteraan.
      if (f?.lastDate && f.lastDate >= addDays(currentDate, -3)) score -= 6;
      return { ...x, score };
    })
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return { available: false,
      reason: pem
        ? 'Vandaag vraagt je systeem alleen rust. Dat is het voorstel.'
        : 'Geen passend voorstel binnen deze tijd en plek.' };
  }

  const pickOne = (x) => {
    const anchors = anchorValues(x.state);
    return {
      id: x.id, state: stateById(x.state), minutes: x.minutes, cost: x.cost, tag: x.tag,
      text: x.text(anchors),
      usesAnchor: (x.needs || []).some(n => anchors[n]),
    };
  };

  return {
    available: true,
    maxCost, target: stateById(target),
    suggestion: pickOne(scored[0]),
    alternatives: scored.slice(1, 4).map(pickOne),
    context: pem ? 'Je hebt vandaag een PEM-signaal gemeld; alleen wat niets van je vraagt.'
      : decision === 'BLUE' ? 'Herstelkleur blauw — iets kleins en zachts.'
      : decision === 'AMBER' ? 'Gemengde dag — iets dat zeker lukt.'
      : null,
  };
}

// ── De vier knoppen ─────────────────────────────────────────────
export const BUTTONS = [
  { id: 'reset', label: 'Geef me een mini-reset', minutes: 5, count: 1 },
  { id: 'dream5', label: 'Geef me 5 minuten van mijn droomleven', minutes: 5, count: 1, prefer: 'ESCAPE' },
  { id: 'dream3', label: 'Geef me vandaag 3 stukjes van mijn droomleven', minutes: 10, count: 3 },
  { id: 'onepct', label: 'Geef me vandaag 1% Future Self', minutes: 10, count: 1 },
];

export function runButton(buttonId, ctx = {}) {
  const btn = BUTTONS.find(b => b.id === buttonId);
  if (!btn) return null;

  if (btn.count === 1) {
    const r = suggestExperience({ ...ctx, minutes: btn.minutes, wanted: btn.prefer || ctx.wanted });
    return { button: btn, ...r, items: r.available ? [r.suggestion] : [] };
  }

  // Drie stukjes: bewust uit verschillende toestanden, zodat het een dag
  // wordt en geen herhaling.
  const items = [];
  const used = [];
  const usedStates = new Set();
  for (let i = 0; i < btn.count; i++) {
    const r = suggestExperience({ ...ctx, minutes: btn.minutes, exclude: used });
    if (!r.available) break;
    let pick = r.suggestion;
    const alt = r.alternatives?.find(a => !usedStates.has(a.state?.id));
    if (usedStates.has(pick.state?.id) && alt) pick = alt;
    items.push(pick);
    used.push(pick.id);
    usedStates.add(pick.state?.id);
  }
  return { button: btn, available: items.length > 0, items,
    reason: items.length ? null : 'Vandaag past er niets — en dat is ook een antwoord.' };
}

// ── Wat maakt mij levend ────────────────────────────────────────
// Verlangens zijn ook data. Deze lijst is van jou, niet van de coach.
export const ALIVENESS_CATEGORIES = [
  { id: 'movement', emoji: '🏃', label: 'Bewegen' },
  { id: 'water', emoji: '🌊', label: 'Water' },
  { id: 'beauty', emoji: '🌸', label: 'Schoonheid' },
  { id: 'music', emoji: '🎵', label: 'Muziek' },
  { id: 'immersion', emoji: '📚', label: 'Opgaan in iets' },
  { id: 'creation', emoji: '✏️', label: 'Maken' },
  { id: 'solitude', emoji: '🌙', label: 'Alleen zijn' },
  { id: 'resonance', emoji: '💫', label: 'Resonantie' },
  { id: 'play', emoji: '🎈', label: 'Spelen' },
  { id: 'novelty', emoji: '🧭', label: 'Nieuw' },
  { id: 'intimacy', emoji: '🤍', label: 'Nabijheid' },
  { id: 'contribution', emoji: '🌱', label: 'Bijdragen' },
];

export const ALIVENESS_PROMPTS = [
  'Waar krijg ik spontaan energie van?',
  'Wat geeft vlinders?',
  'Waar vergeet ik de tijd?',
  'Wat mis ik als het wegvalt?',
  'Wat voelt als "dit ben ik"?',
  'Welke verlangens keren al jaren terug?',
];

const ALIVE_KEY = 'gc_aliveness_list';

export function loadAlivenessList() {
  try {
    const a = JSON.parse(localStorage.getItem(ALIVE_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

export function saveAlivenessItem(item) {
  const arr = loadAlivenessList();
  const entry = {
    id: item.id || `al_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    category: item.category || 'play',
    text: (item.text || '').trim(),
    recurring: !!item.recurring,
    createdAt: item.createdAt || new Date().toISOString(),
  };
  if (!entry.text) return null;
  const i = arr.findIndex(a => a.id === entry.id);
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  localStorage.setItem(ALIVE_KEY, JSON.stringify(arr));
  return entry;
}

export function deleteAlivenessItem(id) {
  localStorage.setItem(ALIVE_KEY, JSON.stringify(loadAlivenessList().filter(a => a.id !== id)));
}
