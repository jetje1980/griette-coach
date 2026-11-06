// Loopt je rusthartslag over weken op? En wat kan dat verklaren?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ERBIJ MOEST
//
// Zij vroeg wat er voorafging aan haar beste sessie: slaap, rust, stress.
// Bij het nazoeken kwam er iets groters boven water dan het antwoord op die
// vraag.
//
// Haar rusthartslag in de week van 15 september: 53, 54, 57, 58, 59. In de
// week van 4 oktober: 59, 61. Eind oktober: 62, 63, 63, 63. Deze week: 62,
// 62, 66. Dat is een stijging van ongeveer acht slagen in zeven weken, en
// precies in die periode zakte haar loopeconomie.
//
// Een rusthartslag die over wéken oploopt is een van de weinige signalen
// die je zonder laboratorium hebt, en hij is bruikbaar juist omdat hij
// traag is: dagvariatie zegt weinig, een drift van zes weken zegt veel.
//
// Hij bestond niet in deze app. Er stond een trend over 28 dagen die het
// eerste meetpunt van het laatste aftrok — met haar lege weken erin is dat
// twee willekeurige dagen, geen trend.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT WEL EN NIET ZEGT
//
// Dit bestand stelt geen diagnose. Het meet de drift, zet de factoren
// ernaast die in háár gegevens staan (gewichtsverloop, medicatie,
// slaapduur, trainingsvolume), en noemt de verklaringen die bij zo'n
// patroon horen — in volgorde van hoe goed ze bij háár data passen.
//
// Dat onderscheid is wezenlijk. "Je rusthartslag stijgt" is een meting.
// "Je eet te weinig" is een conclusie die een mens moet trekken, met de
// gegevens erbij. Deze module levert het eerste en benoemt het tweede als
// mogelijkheid, niet als feit.
// ─────────────────────────────────────────────────────────────────

import { series } from './timeline';
import { todayLocal, addDays, daysBetween } from './datetime';

// Blokken van twee weken: kort genoeg om een verandering te zien, lang
// genoeg om niet op één slechte nacht te leunen.
export const BLOK_DAGEN = 14;
export const VENSTER_DAGEN = 70;     // vijf blokken

// Minder dan drie metingen in een blok en het is geen mediaan maar een gok.
const MIN_PER_BLOK = 3;

// Vanaf hoeveel slagen stijging is er iets te melden? Twee slagen is ruis
// (meetmoment, kamertemperatuur, vollere blaas). Vier is een signaal, acht
// is er een dat je niet moet laten liggen.
export const DRIFT_SIGNAAL = 4;
export const DRIFT_STERK = 8;

const mediaan = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rond = (x, n = 1) => (x == null ? null : +x.toFixed(n));

export function restingDrift({ currentDate = todayLocal(), window = VENSTER_DAGEN } = {}) {
  const vanaf = addDays(currentDate, -window);
  const metingen = series('hr_rest', { asOf: currentDate, since: vanaf })
    .filter(o => typeof o.value === 'number' && o.value > 30 && o.value < 120);

  if (metingen.length < MIN_PER_BLOK * 2) {
    return { known: false, count: metingen.length,
      why: `${metingen.length} rusthartslagmetingen in ${window} dagen. Voor een drift `
        + `over weken zijn er minstens ${MIN_PER_BLOK * 2} nodig, verdeeld over de periode.` };
  }

  // In blokken van twee weken, oudste eerst.
  const blokken = [];
  for (let eind = window; eind > 0; eind -= BLOK_DAGEN) {
    const tot = addDays(currentDate, -(eind - BLOK_DAGEN));
    const van = addDays(currentDate, -eind);
    const waarden = metingen
      .filter(o => o.observedAt > van && o.observedAt <= tot)
      .map(o => o.value);
    blokken.push({ van, tot, n: waarden.length,
      median: waarden.length >= MIN_PER_BLOK ? mediaan(waarden) : null });
  }

  const bruikbaar = blokken.filter(b => b.median != null);
  if (bruikbaar.length < 2) {
    return { known: false, count: metingen.length, blocks: blokken,
      why: 'Er is maar één periode van twee weken met genoeg metingen. Twee van die '
        + 'periodes zijn nodig om een richting te zien.' };
  }

  const eerste = bruikbaar[0];
  const laatste = bruikbaar[bruikbaar.length - 1];
  const delta = laatste.median - eerste.median;
  const weken = Math.max(1, Math.round(daysBetween(eerste.tot, laatste.tot) / 7));

  // Wat stond er in dezelfde periode nog meer?
  const gewicht = series('weight', { asOf: currentDate, since: vanaf })
    .filter(o => typeof o.value === 'number');
  const gewichtDelta = gewicht.length >= 2
    ? rond(gewicht[gewicht.length - 1].value - gewicht[0].value) : null;
  const slaap = series('sleep_hours', { asOf: currentDate, since: vanaf })
    .filter(o => typeof o.value === 'number').map(o => o.value);
  const slaapMediaan = slaap.length >= 3 ? rond(mediaan(slaap)) : null;

  const richting = delta >= DRIFT_STERK ? 'sterk_omhoog'
    : delta >= DRIFT_SIGNAAL ? 'omhoog'
      : delta <= -DRIFT_SIGNAAL ? 'omlaag'
        : 'stabiel';

  return {
    known: true,
    count: metingen.length,
    blocks: blokken,
    from: { median: rond(eerste.median), n: eerste.n, until: eerste.tot },
    to: { median: rond(laatste.median), n: laatste.n, until: laatste.tot },
    delta: rond(delta),
    weeks: weken,
    direction: richting,
    weightDelta: gewichtDelta,
    sleepMedian: slaapMediaan,
    line: richting === 'stabiel'
      ? `Rusthartslag stabiel rond ${rond(laatste.median)} over ${weken} weken.`
      : `Rusthartslag ${delta > 0 ? '+' : ''}${rond(delta)} over ${weken} weken `
        + `(${rond(eerste.median)} → ${rond(laatste.median)}).`,
    verdict: verdictVoor(richting, rond(delta), weken),
    causes: richting === 'omhoog' || richting === 'sterk_omhoog'
      ? oorzaken({ gewichtDelta, slaapMediaan }) : [],
  };
}

function verdictVoor(richting, delta, weken) {
  if (richting === 'stabiel') {
    return 'Dat is wat je wilt zien: je herstel houdt gelijke tred met je training.';
  }
  if (richting === 'omlaag') {
    return `Je rusthartslag zakte ${Math.abs(delta)} slagen in ${weken} weken. Dat is het `
      + 'duidelijkste teken dat je aerobe systeem meegroeit met wat je ervan vraagt.';
  }
  const zwaarte = richting === 'sterk_omhoog'
    ? 'Dit is te groot om aan meetruis toe te schrijven'
    : 'Dit is nog klein, maar het gaat de verkeerde kant op';
  return `${zwaarte}: ${delta} slagen hoger dan ${weken} weken geleden. Een rusthartslag `
    + 'die over weken oploopt betekent bijna altijd dat de optelsom van belasting en '
    + 'herstel niet meer klopt — en zolang dat zo is, wordt je tempo bij een gegeven '
    + 'hartslag niet beter, hoe goed je ook traint.';
}

// De mogelijke verklaringen, op volgorde van hoe goed ze passen bij wat er
// in haar eigen gegevens staat. Nadrukkelijk mogelijkheden: dit is geen
// diagnose, en de volgorde is een aanwijzing waar je het eerst kijkt.
function oorzaken({ gewichtDelta, slaapMediaan }) {
  const uit = [];
  if (gewichtDelta != null && gewichtDelta <= -1) {
    uit.push({
      id: 'tekort',
      label: 'Een energietekort',
      why: `Je bent in deze periode ${Math.abs(gewichtDelta)} kg afgevallen. Afvallen `
        + 'terwijl je traint betekent dat je lichaam te weinig brandstof heeft voor '
        + 'allebei, en dat laat zich onder andere zien als een hogere rusthartslag. Dit '
        + 'is de meest voorkomende reden dat conditie stilstaat bij iemand die juist '
        + 'harder haar best doet.',
      wat: 'Overweeg je gewicht een paar weken vast te houden in plaats van verder te '
        + 'zakken, met koolhydraten rond je trainingen en 1,6–2 g eiwit per kilo. Je '
        + 'kunt geen motor bouwen in een tekort.',
    });
  }
  if (slaapMediaan != null && slaapMediaan < 7) {
    uit.push({
      id: 'slaap',
      label: 'Te weinig slaap',
      why: `Je slaapt in deze periode gemiddeld ${slaapMediaan} uur. Onder de zeven uur `
        + 'blijft je hartslag ’s nachts hoger en herstel je minder van wat je overdag doet.',
      wat: 'Eén uur eerder naar bed doet hier meer dan een extra training.',
    });
  }
  uit.push({
    id: 'belasting',
    label: 'Meer belasting dan herstel',
    why: 'Trainingen, werk en spanning tellen bij elkaar op; je lichaam kent het verschil '
      + 'niet. Een oplopende rusthartslag is daar de vroegste meetbare uiting van.',
    wat: 'Een week met de helft van het volume laat zien of dit het is: zakt je '
      + 'rusthartslag dan binnen zeven tot tien dagen, dan was het dit.',
  });
  uit.push({
    id: 'medisch',
    label: 'Iets wat niet met training te maken heeft',
    why: 'IJzertekort, schildklier, een virus, medicatie en de overgang verhogen alle vier '
      + 'je rusthartslag. Ze zijn geen van alle uit te sluiten met de gegevens in deze app.',
    wat: 'Blijft de stijging staan terwijl je rustiger traint en voldoende eet, laat dan '
      + 'bloed prikken — ferritine, schildklier, vitamine B12 en D.',
  });
  return uit;
}
