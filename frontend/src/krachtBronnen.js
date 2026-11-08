// Alle krachttraining, uit alle plekken waar zij hem vastlegt.
//
// ─────────────────────────────────────────────────────────────────
// MIJN FOUT
//
// Ik schreef dat zij zeven weken geleden met krachttraining was gestopt.
// Dat klopte niet, en zij zei het meteen: "ik ben niet gestopt met
// kracht, ik heb Les Mills gedaan en die 8 min kracht."
//
// Ik had één bron gelezen — gc_strength_sessions — en daar staat sinds
// 21 september niets meer in. Haar circuit van acht minuten staat ergens
// anders: in de 75-dagen-challenge, als afgevinkte dag. Acht dagen sinds
// 23 oktober, waaronder vandaag. Een krachtsessie die ergens anders is
// afgevinkt is nog steeds een krachtsessie.
//
// Dit is dezelfde fout die deze app al vaker maakte, nu in mijn eigen
// analyse: één vraag, meerdere opslagplaatsen, en een lezer die er maar
// één kent. Met als gevolg niet "ik weet het niet" maar een stellige,
// verkeerde conclusie — en die is erger, want daar handel je naar.
//
// ─────────────────────────────────────────────────────────────────
// EN WAT HET NIET OPLOST
//
// Meetellen is niet hetzelfde als gelijkstellen. Acht minuten circuit en
// dertig minuten zwaar met lage herhalingen zijn allebei kracht en doen
// niet hetzelfde: de economiewinst in de literatuur komt van het tweede.
// Als ik na deze correctie zou zeggen "je doet genoeg kracht", had ik
// dezelfde fout nog een keer gemaakt, alleen de andere kant op.
//
// Daarom telt elke bron mee én houdt elke sessie zijn soort.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import { loadStrengthSessions } from './data/strengthSchema';
import { loadChallenge, DONE_KIND } from './challenge75';

// Vanaf hoeveel minuten noemen we het een volwaardige sessie? Het
// circuit van acht minuten is echt en telt, maar het is onderhoud.
export const VOLWAARDIG_MIN = 15;

// Zwaar genoeg om loopeconomie te verbeteren: lage herhalingen dicht bij
// wat je nog net kunt. RPE 4 of hoger, of expliciet "kon niet meer".
export const ZWAAR_RPE = 4;

export const SOORT = {
  ZWAAR: 'zwaar',       // de prikkel die loopeconomie verbetert
  MATIG: 'matig',       // volwaardige sessie, maar niet tot dicht bij de grens
  KORT: 'kort',         // circuit van acht minuten, core-snack
};

export const SOORT_LABEL = {
  zwaar: 'zwaar', matig: 'matig', kort: 'kort (circuit)',
};

function soortVan({ minuten, rpe, couldDoMore }) {
  const zwaar = (Number(rpe) || 0) >= ZWAAR_RPE
    || couldDoMore === 'nee' || couldDoMore === 'niet';
  if ((minuten ?? 0) < VOLWAARDIG_MIN) return SOORT.KORT;
  return zwaar ? SOORT.ZWAAR : SOORT.MATIG;
}

// ── Alles bij elkaar, ontdubbeld op datum+bron ─────────────────
export function alleKracht({ currentDate = todayLocal(), logs = {},
  venster = 180 } = {}) {
  const uit = new Map();
  const binnen = (d) => d && d <= currentDate && daysBetween(d, currentDate) <= venster;
  const zet = (rec) => {
    const sleutel = `${rec.date}_${rec.bron}`;
    if (!uit.has(sleutel)) uit.set(sleutel, rec);
  };

  // 1. De krachtmodule zelf: losse oefeningen of een gevolgde les.
  for (const s of loadStrengthSessions()) {
    if (!binnen(s?.date)) continue;
    const minuten = Number(s.duration) || (Array.isArray(s.exercises) ? 25 : null);
    zet({
      date: s.date, bron: 'module',
      bronLabel: s.videoUrl ? 'les' : s.program ? 'eigen programma' : 'les',
      minuten, rpe: Number(s.rpe) || null,
      soort: soortVan({ minuten, rpe: s.rpe, couldDoMore: s.couldDoMore }),
    });
  }

  // 2. Het circuit van acht minuten uit de 75-dagen-challenge. Dit is de
  //    bron die ontbrak.
  const ch = loadChallenge();
  for (const [datum, rec] of Object.entries(ch?.days || {})) {
    if (!binnen(datum) || !rec?.doneAt) continue;
    const kind = rec.kind || DONE_KIND?.CIRCUIT || 'circuit';
    zet({
      date: datum, bron: 'challenge', bronLabel: '75 dagen · circuit',
      minuten: 8, rpe: null, soort: SOORT.KORT, kind,
    });
  }

  // 3. Een vinkje in het dagboek, zonder sessie erachter. Minder detail,
  //    maar het is wel gebeurd — en stilzwijgend negeren is precies wat
  //    hier misging.
  for (const [sleutel, l] of Object.entries(logs || {})) {
    const datum = l?.date || sleutel;
    if (!binnen(datum)) continue;
    if (l?.strength_done) {
      zet({ date: datum, bron: 'dagboek', bronLabel: 'afgevinkt in je dag',
        minuten: null, rpe: null, soort: SOORT.MATIG });
    } else if (l?.core_done) {
      zet({ date: datum, bron: 'dagboek-core', bronLabel: 'core afgevinkt',
        minuten: 8, rpe: null, soort: SOORT.KORT });
    }
  }

  const lijst = [...uit.values()].sort((a, b) => a.date.localeCompare(b.date));
  // Eén dag kan uit twee bronnen komen (les én circuit). Dat zijn twee
  // sessies, maar voor "heb ik die dag kracht gedaan" is het één dag.
  const dagen = [...new Set(lijst.map(s => s.date))];
  return {
    sessies: lijst,
    dagen,
    laatste: dagen.length ? dagen[dagen.length - 1] : null,
    zwaar: lijst.filter(s => s.soort === SOORT.ZWAAR),
    matig: lijst.filter(s => s.soort === SOORT.MATIG),
    kort: lijst.filter(s => s.soort === SOORT.KORT),
  };
}

// Samenvatting over een venster: hoeveel, waarvan zwaar, en uit welke
// bronnen. De bronnen staan erbij zodat zichtbaar is wat wél en niet
// geteld is — dan is deze fout de volgende keer te zien in plaats van te
// moeten worden gemeld.
export function krachtBeeld({ currentDate = todayLocal(), logs = {}, dagen = 28 } = {}) {
  const alles = alleKracht({ currentDate, logs, venster: dagen });
  // "Wanneer was de laatste" hoort verder terug te kijken dan het
  // telvenster. Deed zij zeven weken geleden haar laatste sessie, dan is
  // dat het antwoord — niet "nog geen krachtsessie geregistreerd", wat
  // een telvenster van vier weken ervan maakte.
  const ooit = alleKracht({ currentDate, logs, venster: 365 });
  const perWeek = +(alles.dagen.length / (dagen / 7)).toFixed(2);
  const zwaarPerWeek = +(alles.zwaar.length / (dagen / 7)).toFixed(2);
  const bronnen = [...new Set(alles.sessies.map(s => s.bronLabel))];
  return {
    dagenMetKracht: alles.dagen.length,
    perWeek, zwaarPerWeek,
    zwaar: alles.zwaar.length, matig: alles.matig.length, kort: alles.kort.length,
    laatste: ooit.laatste,
    sinds: ooit.laatste ? daysBetween(ooit.laatste, currentDate) : null,
    bronnen,
    regel: alles.dagen.length === 0
      ? 'Geen krachttraining gevonden in deze periode.'
      : `${alles.dagen.length} dagen met kracht in ${Math.round(dagen / 7)} weken`
        + ` (${perWeek}/week)`
        + (alles.zwaar.length
          ? `, waarvan ${alles.zwaar.length} zwaar`
          : ', waarvan geen enkele zwaar')
        + (bronnen.length ? ` · uit: ${bronnen.join(', ')}` : ''),
  };
}
