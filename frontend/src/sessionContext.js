// Wat er rond een training speelde — gevraagd, niet geraden.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER IS
//
// De app trok conclusies uit tempo en hartslag alleen. "Loopeconomie gaat
// achteruit" kwam uit twee gemiddelden, zonder te weten dat de ene reeks
// 's avonds in de wind was gelopen na een slechte nacht, en de andere op een
// frisse ochtend. Dan vergelijk je omstandigheden en noemt het fysiologie.
//
// Er bestond al een notitieveld bij een training, maar dat werd nergens
// gelezen — net als de fotocontext eerder. Opgeslagen en genegeerd is erger
// dan niet gevraagd: je denkt dat het meetelt.
//
// Drie dingen staan hier:
//
//   1. de cyclusdag, afgeleid en niet gevraagd — die weet de app zelf;
//   2. gerichte vragen die pas verschijnen als er iets te verklaren valt,
//      en die per signaal verschillen: bij een tempoverschil vraag je naar
//      andere dingen dan bij een hoge hartslag;
//   3. een open veld voor wat zij zelf ziet, dat woordelijk meegaat.
//
// Wat hier níét gebeurt: vragen stellen bij elke training. Een vragenlijst
// na elke run is een vragenlijst die je na twee weken overslaat.
// ─────────────────────────────────────────────────────────────────

import { todayLocal } from './datetime';
import { cycleDayOf } from './bodyReview';

const KEY = 'gc_session_context';

// ── De vragen ───────────────────────────────────────────────────
//
// Elke vraag heeft een reden: waarom hij voor dít signaal relevant is. Die
// reden staat op het scherm, want een vraag zonder reden voelt als een
// formulier en wordt niet ingevuld.
export const VRAAG = {
  TIJDSTIP: {
    id: 'tijdstip', label: 'Hoe laat liep je?', kort: 'tijdstip',
    opties: ['vroege ochtend', 'ochtend', 'middag', 'avond'],
    waarom: 'Je tempo bij dezelfde hartslag ligt \'s avonds vaak anders dan \'s ochtends — temperatuur, eten, vermoeidheid van de dag.',
  },
  SLAAP: {
    id: 'slaap', label: 'Hoe sliep je de nacht ervoor?', kort: 'slaap',
    opties: ['goed', 'matig', 'slecht', 'weet ik niet'],
    waarom: 'Eén slechte nacht kost al tempo bij dezelfde hartslag, zonder dat er iets met je conditie is.',
  },
  ONDERGROND: {
    id: 'ondergrond', label: 'Waar liep je?', kort: 'ondergrond',
    opties: ['asfalt / vlak', 'bos / pad', 'zand', 'heuvelachtig'],
    waarom: 'Zand en heuvels kosten tientallen seconden per kilometer. Zonder dit zou dat als vormverlies worden gelezen.',
  },
  WEER: {
    id: 'weer', label: 'Wat voor weer was het?', kort: 'weer',
    opties: ['koel en windstil', 'warm', 'veel wind', 'regen / kou'],
    waarom: 'Warmte en wind tillen je hartslag op bij hetzelfde tempo.',
  },
  GEGETEN: {
    id: 'gegeten', label: 'Had je gegeten?', kort: 'gegeten',
    opties: ['nuchter', 'licht gegeten', 'normaal gegeten', 'vlak na een maaltijd'],
    waarom: 'Nuchter lopen voelt zwaarder en loopt trager, zeker langer dan een half uur.',
  },
  DRUKTE: {
    id: 'drukte', label: 'Hoe druk was je dag?', kort: 'drukte van de dag',
    opties: ['rustig', 'gewoon', 'druk', 'erg druk / gespannen'],
    waarom: 'Een drukke dag zit in je benen voordat je begint, en dat is geen trainingsprobleem.',
  },
  SCHOENEN: {
    id: 'schoenen', label: 'Andere schoenen dan anders?', kort: 'schoenen',
    opties: ['dezelfde als altijd', 'andere schoenen'],
    waarom: 'Een andere zool verandert je tempo en je cadans meer dan je denkt.',
  },
};

// Welke vragen horen bij welk signaal? Alleen wat werkelijk kan verklaren
// wat er gesignaleerd is — anders wordt het een enquête.
export const VRAGEN_BIJ_SIGNAAL = {
  economy: ['TIJDSTIP', 'SLAAP', 'ONDERGROND', 'WEER', 'GEGETEN', 'SCHOENEN'],
  cost: ['TIJDSTIP', 'SLAAP', 'WEER', 'DRUKTE', 'GEGETEN'],
  headache: ['SLAAP', 'DRUKTE', 'GEGETEN', 'WEER'],
  tolerance: ['SLAAP', 'DRUKTE', 'TIJDSTIP'],
  // Geen signaal: dan vraagt de app niets. Zie de kop van dit bestand.
  none: [],
};

export function vragenVoor(signaalIds = []) {
  const uit = [];
  for (const id of signaalIds) {
    for (const v of (VRAGEN_BIJ_SIGNAAL[id] || [])) {
      if (!uit.includes(v)) uit.push(v);
    }
  }
  return uit.map(k => VRAAG[k]).filter(Boolean);
}

// ── Opslag per trainingsdag ─────────────────────────────────────
export function loadAllContext() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

export function saveSessionContext(date, velden) {
  if (!date) return null;
  const alles = loadAllContext();
  alles[date] = { ...(alles[date] || {}), ...velden, date, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(alles));
  return alles[date];
}

// De context van één training, inclusief wat de app zelf al weet.
//
// De cyclusdag wordt afgeleid en niet gevraagd: die staat al in je data, en
// een vraag stellen waarvan je het antwoord hebt is een vraag te veel.
export function sessionContextFor(date, { logs = {}, asOf = todayLocal() } = {}) {
  const opgeslagen = loadAllContext()[date] || null;
  const log = logs[date] || null;

  let cyclusdag = null;
  try { cyclusdag = cycleDayOf(date, { asOf }); } catch { cyclusdag = null; }

  return {
    date,
    cycleDay: cyclusdag,
    // Slaap komt uit je ochtendcheck-in als je die invulde; alleen als die
    // ontbreekt is de vraag zinvol.
    sleepHours: log?.sleep_hours ?? null,
    sleepQuality: log?.sleep_quality ?? null,
    answers: opgeslagen ? { ...opgeslagen } : {},
    note: opgeslagen?.note || null,
    hasAnswers: !!opgeslagen && Object.keys(opgeslagen)
      .some(k => !['date', 'updatedAt', 'note'].includes(k)),
  };
}

// Welke vragen zijn nog zinvol? Wat de app al weet, wordt niet gevraagd.
export function openVragen(ctx, signaalIds = []) {
  const alle = vragenVoor(signaalIds);
  return alle.filter(v => {
    if (ctx.answers?.[v.id]) return false;             // al beantwoord
    if (v.id === 'slaap' && ctx.sleepQuality != null) return false;  // staat in de check-in
    return true;
  });
}

// ── De context als leesbare regels ──────────────────────────────
// Voor de analyse en voor het scherm: één opsomming, zodat er geen twee
// versies van hetzelfde verhaal ontstaan.
export function contextLines(ctx) {
  const regels = [];
  if (ctx.cycleDay != null) regels.push(`cyclusdag ${ctx.cycleDay}`);
  if (ctx.sleepHours != null) regels.push(`${ctx.sleepHours} uur geslapen`);
  for (const [k, v] of Object.entries(ctx.answers || {})) {
    if (['date', 'updatedAt', 'note'].includes(k) || !v) continue;
    const vraag = Object.values(VRAAG).find(x => x.id === k);
    // Het korte label, niet de hele vraag: "ondergrond: zand" leest als een
    // feit, "waar liep je: zand" leest als een formulier dat je invulde.
    regels.push(`${vraag?.kort || k}: ${v}`);
  }
  if (ctx.note) regels.push(`eigen opmerking: "${ctx.note}"`);
  return regels;
}
