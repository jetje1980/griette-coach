// De ijksessie: één schone meting in plaats van zes weken schatten.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DEZE SESSIE BESTAAT
//
// Zij vroeg of haar hartslag niet sneller zou zakken dan het model
// aanneemt. Dat is een empirische vraag, en de app kon hem niet
// beantwoorden: na het weren van korte blokken en van één sessie met een
// onbetrouwbare hartslag bleven er te weinig metingen over die kort
// genoeg op elkaar stonden. Niet "je hebt ongelijk" dus, maar "dit is nu
// niet te meten".
//
// Een discussie die op meetgegevens stukloopt, los je op met een meting.
// Eén doelbewust opgezette sessie geeft wat twintig losse sessies niet
// geven: één blok, één hartslag, één getal.
//
// ─────────────────────────────────────────────────────────────────
// DE OPZET, EN WAAROM ELK ONDERDEEL ERIN ZIT
//
//   · Doorlopend, niet in blokjes. Loop-wandel levert per definitie geen
//     steady state op.
//   · Op hartslag, niet op tempo. Zij houdt de hartslag vast en laat het
//     tempo doen wat het doet; andersom meet je iets anders.
//   · Vlak en verhard. Duinen en zand maken de meting onvergelijkbaar
//     met de vorige.
//   · Dezelfde meter als altijd — bij haar de Garmin om de pols.
//
//     Hier stond eerst "borstband, want nauwkeuriger". Dat advies was
//     verkeerd om, en zij zag het meteen: zij meet alles met de Garmin.
//     Haar hele reeks is polsmeting. Dit model rekent niet met absolute
//     waarden maar met de verándering van efficiëntie over de tijd, en
//     dan is consistentie van meetmethode belangrijker dan absolute
//     nauwkeurigheid. Midden in een reeks van meter wisselen zet een
//     sprong in de getallen die geen fysiologie is.
//
//     De zwakke plek van een optische meter blijft wel bestaan — 4
//     oktober was er een — maar die los je niet op met een ander apparaat
//     dat zij toch niet draagt. Je lost hem op met twee dingen: een
//     protocol dat de bekende faalgevallen vermijdt (koude pols, losse
//     band, intervallen) en controles achteraf die een onbetrouwbare
//     meting herkennen in plaats van hem door te laten. Zie
//     IJK_PIEK_MARGE en de hartslagdalingstoets in gemetenTempo.js.
//   · En de duur past bij wat ze aankan. Twintig minuten doorlopend is
//     bij haar langste blok van tien een stap die de meting zelf tot
//     training maakt — dan meet je vermoeidheid, niet economie.
//
// ─────────────────────────────────────────────────────────────────
// EN WANNEER
//
// Niet "zo snel mogelijk". Een ijkpunt dat op een slechte dag gemeten
// wordt, ijkt niets: dan staat er voortaan een te lage waarde waar alles
// aan wordt opgehangen. Vier voorwaarden, alle vier uit haar eigen
// gegevens, staan hieronder in GESCHIKT.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { loadWorkouts } from './workouts';
import { steadyEfficiency } from './gemetenTempo';
import { paceAtHr } from './efficiency';

const KEY = 'gc_ijksessie';

// De hartslag waarop geijkt wordt: haar plafond voor rustige duurlopen.
// Daar gaat haar vraag over — sneller worden bij gelijkblijvende, lage
// hartslag — dus daar hoort het ijkpunt te liggen.
export const IJK_HR_MARGE = 4;

// Minimaal deze tijd doorlopend, anders is er geen steady state; hooguit
// twintig minuten, want langer voegt niets toe aan de meting.
export const IJK_MIN_MIN = 10;
export const IJK_MAX_MIN = 20;

// Hoeveel mag de rusthartslag boven haar eigen basis liggen en de dag nog
// bruikbaar heten? Vier slagen erboven is precies de toestand waarin zij
// nu zit, en dan meet je herstelschuld in plaats van vorm.
export const IJK_MAX_RHR_BOVEN = 2;

// ── Hoe zie je achteraf of de polsmeting deugde? ────────────────
//
// Zij meet met de Garmin, en dat blijft zo. Een optische meter faalt niet
// willekeurig maar herkenbaar: hij verliest het signaal en pakt het weer
// op, en dan staan er pieken in een verder vlak blok. Haar Garmin levert
// per lap zowel de gemiddelde als de maximale hartslag, en dat is precies
// genoeg om dat te zien.
//
// Bij twaalf minuten doorlopend op gelijk tempo hoort de maximale
// hartslag dicht bij het gemiddelde te liggen. Zit er meer dan dit
// verschil tussen, dan is er iets gebeurd wat geen inspanning was.
export const IJK_PIEK_MARGE = 15;

export function loadIjk() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveIjk(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* opslag vol of geblokkeerd */ }
  return v;
}
export function clearIjk() {
  try { localStorage.removeItem(KEY); } catch { /* idem */ }
}

// ── Hoe lang moet de ijksessie zijn? ────────────────────────────
//
// Twee minuten boven haar langste doorlopende blok: genoeg om een stap te
// zijn, te weinig om een test in een zware training te veranderen. De
// eerste drie minuten tellen niet mee in de meting — daarin klimt de
// hartslag nog — dus onder de tien minuten blijft er te weinig over.
export function ijkDuur({ currentDate = todayLocal(), workouts = null } = {}) {
  const runs = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null)
      && daysBetween(w.date, currentDate) <= 60);
  let langste = 0;
  for (const w of runs) {
    for (const l of (Array.isArray(w.laps) ? w.laps : [])) {
      const sec = Number(l.movingTime ?? l.moving_time ?? 0);
      const meter = Number(l.distance ?? 0);
      if (sec > langste && meter / (sec / 60) >= 95) langste = sec;
    }
  }
  const basis = langste ? langste / 60 : IJK_MIN_MIN;
  return Math.round(Math.min(IJK_MAX_MIN, Math.max(IJK_MIN_MIN, basis + 2)));
}

// ── Is een dag geschikt om op te ijken? ─────────────────────────
export function geschiktOp({ datum, logs = {}, drift = null, lateLuteal = false,
  isRunDag = true, dagEnLogs = null } = {}) {
  const redenen = [];
  if (!isRunDag) redenen.push('dit is geen loopdag');
  if (lateLuteal) {
    redenen.push('je laatluteale week — je hartslag ligt dan 3 tot 8 slagen hoger bij '
      + 'hetzelfde tempo, dus het ijkpunt zou te laag uitvallen');
  }
  const log = (dagEnLogs || logs)[datum] || null;
  const rhr = Number(log?.hr_rest);
  // De basis is haar laagst gemeten blok, niet haar huidige stand: wie
  // tegen een al verhoogde waarde vergelijkt, noemt verhoogd normaal.
  const basis = drift?.lowest?.median ?? null;
  if (Number.isFinite(rhr) && Number.isFinite(basis) && rhr > basis + IJK_MAX_RHR_BOVEN) {
    redenen.push(`je rusthartslag staat op ${rhr} tegen een basis van ${basis} — dan meet je `
      + 'herstelschuld en geen vorm');
  }
  // ── Goedgekeurd op afwezigheid van gegevens is geen goedkeuring ──
  //
  // Voor een dag in de toekomst is de rusthartslag er nog niet. Dan
  // slaagt de toets hierboven omdat er niets te toetsen viel, en dat is
  // iets anders dan slagen. Zij staat vandaag op 66 tegen een basis van
  // 62; als dat morgen nog zo is, ijkt de sessie haar herstelschuld.
  // Dus komt de voorwaarde mee in plaats van stilzwijgend te vervallen.
  const onbekend = !Number.isFinite(rhr) && Number.isFinite(basis);
  return {
    geschikt: redenen.length === 0,
    redenen,
    voorwaardelijk: redenen.length === 0 && onbekend,
    voorwaarde: redenen.length === 0 && onbekend
      ? `Je rusthartslag van die ochtend is er nog niet. Staat hij boven `
        + `${basis + IJK_MAX_RHR_BOVEN}, sla de ijksessie dan over en loop gewoon rustig — `
        + 'dan meet je herstelschuld en zet je een te laag ijkpunt neer waar alles '
        + 'daarna aan wordt opgehangen.'
      : null,
  };
}

// ── Het voorschrift ─────────────────────────────────────────────
export function ijkVoorschrift({ hr = 145, minuten = 12 } = {}) {
  return {
    hr,
    minuten,
    titel: `IJksessie — ${minuten} min doorlopend op hartslag ${hr}`,
    stappen: [
      '10 minuten inlopen of stevig wandelen, rustig opbouwen.',
      `${minuten} minuten doorlopend. Houd je hartslag op ${hr - IJK_MARGE_TEKST()}–`
        + `${hr + IJK_MARGE_TEKST()} en laat je tempo doen wat het doet — je stuurt op `
        + 'hartslag, niet op tempo.',
      '5 minuten uitwandelen.',
    ],
    eisen: [
      'Vlakke verharde weg. Geen duin, geen zand, geen trap.',
      'Je Garmin om de pols, zoals altijd — niet opeens een andere meter. Dit model '
        + 'rekent met verandering over de tijd, en dan telt dezelfde meetmethode zwaarder '
        + 'dan absolute nauwkeurigheid.',
      'Band strak genoeg: een vingerbreedte boven het polsbotje, niet eroverheen, en niet '
        + 'zo los dat hij schuift. Een losse band is de hoofdoorzaak van onzin-hartslagen.',
      'De tien minuten inlopen zijn hier geen opwarming maar onderdeel van de meting: een '
        + 'koude pols geeft een optische meter geen goed signaal. Mouw niet over het horloge.',
      'Niet in je laatluteale week en niet op een dag dat je rusthartslag verhoogd is.',
      'Geen zware krachtsessie in de 24 uur ervoor.',
    ],
    waarom: 'Eén blok, één hartslag, één getal. Dit beslecht in één training wat anders '
      + 'zes weken schatten blijft — en het is meteen het eerste punt van je nieuwe reeks.',
  };
}
function IJK_MARGE_TEKST() { return IJK_HR_MARGE / 2; }

// ── De uitslag lezen ────────────────────────────────────────────
//
// Niet "er is die dag gelopen, dus het is gelukt". Alleen een doorlopend
// blok van de afgesproken lengte op de afgesproken hartslag telt; anders
// heet het niet gelukt en staat erbij waarom. Een test die zichzelf altijd
// geslaagd verklaart, meet niets.
export function ijkUitslag({ datum, hr = 145, minuten = 12, workouts = null } = {}) {
  if (!datum) return null;
  const w = (workouts || loadWorkouts())
    .find(x => x?.date === datum && (x.activityType === 'run' || x.activityType == null));
  if (!w) return { gedaan: false, why: 'Nog geen loopsessie op deze datum.' };

  const laps = (Array.isArray(w.laps) ? w.laps : []).map(l => ({
    sec: Number(l.movingTime ?? l.moving_time ?? 0),
    meter: Number(l.distance ?? 0),
    hr: Number(l.avgHr ?? l.average_heartrate ?? 0),
    maxHr: Number(l.maxHr ?? l.max_heartrate ?? 0) || null,
  })).filter(l => l.sec > 0 && l.meter > 0 && l.hr > 0);

  const nodig = Math.max(IJK_MIN_MIN, minuten - 2) * 60;
  const blok = laps.filter(l => l.sec >= nodig)
    .sort((a, b) => b.sec - a.sec)[0] || null;

  if (!blok) {
    return { gedaan: false,
      why: `Er staat wel een sessie op ${datum}, maar geen doorlopend blok van minstens `
        + `${Math.round(nodig / 60)} minuten. Zonder zo'n blok is er geen steady state en `
        + 'dus geen ijkpunt.' };
  }
  const afwijking = Math.abs(blok.hr - hr);
  const mpm = blok.meter / (blok.sec / 60);
  const ef = +(mpm / blok.hr).toFixed(3);
  const opDoelHr = +(ef * hr).toFixed(1);

  // Deugde de polsmeting? Bij een vlak blok hoort de piek dicht bij het
  // gemiddelde te liggen. Doet hij dat niet, dan heeft de optische meter
  // het signaal verloren en weer opgepakt — en dan is dit geen ijkpunt
  // maar een schatting. Dat moet zij weten vóór ze er conclusies aan
  // verbindt, niet nadat het getal ergens in een curve verdwenen is.
  const piek = blok.maxHr ? Math.round(blok.maxHr - blok.hr) : null;
  const pieken = piek != null && piek > IJK_PIEK_MARGE;

  return {
    gedaan: true,
    binnenBand: afwijking <= IJK_HR_MARGE,
    ef,
    hr: Math.round(blok.hr),
    maxHr: blok.maxHr ? Math.round(blok.maxHr) : null,
    spread: piek,
    betrouwbaar: !pieken,
    minuten: +(blok.sec / 60).toFixed(1),
    pace: +(1000 / mpm).toFixed(2),
    paceOpDoelHr: +(1000 / opDoelHr).toFixed(2),
    meetWaarschuwing: pieken
      ? `Je hartslag piekte in dit blok ${piek} slagen boven het gemiddelde, terwijl je `
        + 'tempo gelijk bleef. Dat is het patroon van een optische meter die even geen '
        + 'signaal had. Het getal blijft staan, maar reken er niet te hard op: zat de '
        + 'band los of was je pols koud, loop de ijksessie dan nog een keer.'
      : null,
    why: afwijking <= IJK_HR_MARGE
      ? `${Math.round(blok.sec / 60)} minuten doorlopend op hartslag ${Math.round(blok.hr)}.`
      : `Gelopen op hartslag ${Math.round(blok.hr)} in plaats van ${hr}. Het getal telt `
        + 'wel mee, maar omgerekend naar je doelhartslag — dat is iets minder nauwkeurig '
        + 'dan een blok dat er meteen op lag.',
  };
}

// ── Wat betekent de uitslag voor het doel? ──────────────────────
export function ijkTegenDoel({ ef, hrCap = 145, benodigdeEf = null } = {}) {
  if (!ef) return null;
  const tempo = paceAtHr(ef, hrCap);
  const gat = benodigdeEf ? Math.round((benodigdeEf / ef - 1) * 100) : null;
  return {
    ef, hrCap, tempo,
    requiredEf: benodigdeEf,
    gapPct: gat,
    line: benodigdeEf
      ? `Gemeten ${ef} — dat is ${Math.floor(tempo)}:${String(Math.round((tempo % 1) * 60))
        .padStart(2, '0')}/km bij hartslag ${hrCap}. Je doel vraagt ${benodigdeEf}, dus `
        + `${gat}% te gaan.`
      : `Gemeten ${ef} — dat is ${Math.floor(tempo)}:${String(Math.round((tempo % 1) * 60))
        .padStart(2, '0')}/km bij hartslag ${hrCap}.`,
  };
}

// ── Alles bij elkaar: wanneer, wat, en wat eruit kwam ───────────
export function ijksessie({ currentDate = todayLocal(), dagen = [], logs = {},
  drift = null, hrCap = 145, workouts = null, benodigdeEf = null } = {}) {
  const opgeslagen = loadIjk();
  const minuten = ijkDuur({ currentDate, workouts });

  // Al gepland en al gelopen? Dan telt de uitslag.
  if (opgeslagen?.date) {
    const uit = ijkUitslag({ datum: opgeslagen.date, hr: opgeslagen.hr ?? hrCap,
      minuten: opgeslagen.minuten ?? minuten, workouts });
    if (uit?.gedaan) {
      return {
        status: 'gedaan', date: opgeslagen.date, minuten: opgeslagen.minuten ?? minuten,
        hr: opgeslagen.hr ?? hrCap, uitslag: uit,
        tegenDoel: ijkTegenDoel({ ef: uit.ef, hrCap, benodigdeEf }),
        voorschrift: ijkVoorschrift({ hr: opgeslagen.hr ?? hrCap,
          minuten: opgeslagen.minuten ?? minuten }),
      };
    }
    if (opgeslagen.date >= currentDate) {
      return {
        status: 'gepland', date: opgeslagen.date, minuten: opgeslagen.minuten ?? minuten,
        hr: opgeslagen.hr ?? hrCap, uitslag: uit,
        voorschrift: ijkVoorschrift({ hr: opgeslagen.hr ?? hrCap,
          minuten: opgeslagen.minuten ?? minuten }),
      };
    }
    // Datum voorbij en niets gelopen: opnieuw voorstellen.
  }

  // De eerste geschikte dag voorstellen.
  const kandidaten = dagen.filter(d => d.date >= currentDate);
  let voorstel = null;
  let oordeelVoorstel = null;
  const afgewezen = [];
  for (const d of kandidaten) {
    const oordeel = geschiktOp({ datum: d.date, logs, drift,
      lateLuteal: !!d.lateLuteal,
      isRunDag: !!d.run && !d.gated });
    if (oordeel.geschikt) { voorstel = d; oordeelVoorstel = oordeel; break; }
    if (afgewezen.length < 4) afgewezen.push({ date: d.date, redenen: oordeel.redenen });
  }

  return {
    status: voorstel ? 'voorstel' : 'geen',
    date: voorstel?.date || null,
    minuten, hr: hrCap,
    afgewezen,
    conditional: !!oordeelVoorstel?.voorwaardelijk,
    condition: oordeelVoorstel?.voorwaarde || null,
    voorschrift: ijkVoorschrift({ hr: hrCap, minuten }),
    why: voorstel
      ? 'De eerste dag die aan alle voorwaarden voldoet.'
      : 'Geen geschikte dag gevonden in de komende weken — de voorwaarden staan hierboven.',
  };
}
