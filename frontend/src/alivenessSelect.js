// Hoe een mini-moment gekozen wordt.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM HET STEEDS HETZELFDE WAS
//
// De oude keuze was: filter, scoreer, sorteer, neem `scored[0]`. Bij een
// gelijkblijvende context is dat een deterministische functie — dezelfde dag
// geeft hetzelfde antwoord, elke keer. De enige variatie was een straf van
// −6 als hetzelfde item in de afgelopen drie dagen was gegeven, en dat was te
// weinig: een item dat op de juiste toestand +16 scoorde en drie punten
// positieve feedback had, stond ook met −6 nog steeds bovenaan.
//
// Erger nog: die straf hing aan `feedback.lastDate`. Kreeg je een voorstel
// zonder erop te reageren, dan wist de app niet dat het getoond was. Vijf keer
// hetzelfde zien zonder te klikken telde als nul keer.
//
// Drie dingen repareren dat:
//   1. een eigen historie van wat er GETOOND is, los van feedback;
//   2. harde cooldowns op id en straffen op tag en toestand;
//   3. een gewogen keuze uit de beste paar, in plaats van altijd de eerste.
//
// De volgorde blijft: veiligheid en context eerst, dan personalisatie, dan
// variatie, en pas dan de gewogen keuze. Novelty mag nooit een filter
// overrulen — het herschikt alleen wat al door de poort mocht.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';

const SHOWN_KEY = 'gc_aliveness_shown';

// ── Kalibratieparameters ────────────────────────────────────────
// Geen van deze getallen komt uit gemeten gedrag; ze zijn gekozen om variatie
// af te dwingen zonder de context te verliezen. Ze horen bijgesteld te worden
// zodra er genoeg getoonde voorstellen met feedback zijn.
export const CALIB = {
  // Exact hetzelfde item: hard uitgesloten binnen dit venster.
  SAME_ID_COOLDOWN_DAYS: 7,
  // Zelfde tag kort geleden: zware straf, geen uitsluiting. Anders zou een dag
  // met drie muziekvoorstellen de hele categorie een week blokkeren.
  SAME_TAG_WINDOW_DAYS: 3,
  SAME_TAG_PENALTY: 12,
  // Zelfde toestand meerdere keren achter elkaar: lichte straf.
  SAME_STATE_WINDOW_DAYS: 2,
  SAME_STATE_PENALTY: 5,
  // Uit hoeveel van de besten wordt gewogen gekozen.
  TOP_N: 4,
  // Feedback. "Veel" tilt de tag méér dan het item zelf — je vond dit soort
  // dingen fijn, niet per se dit ene zinnetje nog een keer.
  MUCH_TAG_BONUS: 6,
  MUCH_ID_BONUS_CAP: 4,
  NONE_ID_PENALTY: 4,
  NONE_TAG_PENALTY: 3,
};

// ── Wat is er getoond? ──────────────────────────────────────────
// Los van feedback, want een voorstel kan vijf keer langskomen zonder dat er
// ooit op geklikt wordt. Zonder deze lijst is "recent getoond" onbekend.
export function loadShown() {
  try {
    const a = JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

export function recordShown(entry, { date = todayLocal(), at = null } = {}) {
  if (!entry?.id) return null;
  const arr = loadShown();
  const row = {
    date, at: at || new Date().toISOString(),
    buttonId: entry.buttonId || null,
    id: entry.id,
    state: entry.state?.id || entry.state || null,
    tag: entry.tag || null,
    source: entry.source || 'fixed_library',
  };
  // Ruim genoeg om zeven dagen te dekken, klein genoeg om niet te groeien.
  arr.unshift(row);
  localStorage.setItem(SHOWN_KEY, JSON.stringify(arr.slice(0, 300)));
  return row;
}

export function clearShown() { localStorage.removeItem(SHOWN_KEY); }

// Handig voor het scherm: wat kreeg ik de laatste dagen?
export function shownSince(days, currentDate = todayLocal()) {
  const grens = addDays(currentDate, -days);
  return loadShown().filter(r => r.date >= grens && r.date <= currentDate);
}

// ── Deterministisch toeval ──────────────────────────────────────
// Een gewogen keuze moet in tests herhaalbaar zijn, anders test je ruis.
// mulberry32: klein, snel, en met een zaadje volledig voorspelbaar.
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : (seed | 0)) >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── De variatielaag ─────────────────────────────────────────────
// Krijgt kandidaten die al door alle veiligheids- en contextfilters zijn
// gekomen, met hun ruwe score. Wat hier gebeurt is uitsluiten wat te recent
// is, straffen wat te veel op elkaar lijkt, en dan gewogen kiezen.
export function applyNovelty(candidates, {
  currentDate = todayLocal(), shown = null, exclude = [],
} = {}) {
  const historie = shown || loadShown();
  const naId  = addDays(currentDate, -CALIB.SAME_ID_COOLDOWN_DAYS);
  const naTag = addDays(currentDate, -CALIB.SAME_TAG_WINDOW_DAYS);
  const naSt  = addDays(currentDate, -CALIB.SAME_STATE_WINDOW_DAYS);

  const recentIds   = new Set(historie.filter(r => r.date >= naId).map(r => r.id));
  const recentTags  = new Set(historie.filter(r => r.date >= naTag && r.tag).map(r => r.tag));
  const recentSts   = new Set(historie.filter(r => r.date >= naSt && r.state).map(r => r.state));

  const bruikbaar = candidates.filter(c => !exclude.includes(c.id));

  const gestraft = bruikbaar.map(c => {
    let score = c.score;
    const tooSoon = recentIds.has(c.id);
    if (recentTags.has(c.tag)) score -= CALIB.SAME_TAG_PENALTY;
    if (recentSts.has(c.state)) score -= CALIB.SAME_STATE_PENALTY;
    return { ...c, score, tooSoon };
  });

  // Eerst alles wat niet in de cooldown zit. Alleen als dat leeg is vallen we
  // terug op de rest — en dan zonder te doen alsof het variatie was.
  const vers = gestraft.filter(c => !c.tooSoon);
  const pool = vers.length ? vers : gestraft;

  return {
    pool: pool.sort((a, b) => b.score - a.score),
    fellBack: vers.length === 0 && gestraft.length > 0,
  };
}

// Gewogen keuze uit de beste paar. Hogere score is waarschijnlijker, maar
// nummer vier maakt een echte kans — anders is het alsnog altijd dezelfde.
export function weightedPick(pool, { rng = Math.random, topN = CALIB.TOP_N } = {}) {
  if (!pool.length) return null;
  const top = pool.slice(0, Math.max(1, topN));
  if (top.length === 1) return top[0];

  // Scores kunnen negatief zijn; verschuif naar boven nul en geef ook de
  // laagste nog een kleine kans.
  const laagste = Math.min(...top.map(c => c.score));
  const gewichten = top.map(c => (c.score - laagste) + 1);
  const totaal = gewichten.reduce((a, b) => a + b, 0);

  let r = rng() * totaal;
  for (let i = 0; i < top.length; i++) {
    r -= gewichten[i];
    if (r <= 0) return top[i];
  }
  return top[top.length - 1];
}

// De zaadwaarde voor een klik. Dezelfde dag en dezelfde knop geven zonder
// meer klikken hetzelfde resultaat; elke volgende klik schuift op.
export function seedFor({ currentDate = todayLocal(), buttonId = '', nth = 0 } = {}) {
  return `${currentDate}|${buttonId}|${nth}`;
}
