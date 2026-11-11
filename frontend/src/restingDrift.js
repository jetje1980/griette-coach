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
import { phasePattern, PHASE, PHASE_ORDER } from './cyclePatterns';
import { todayLocal, addDays, daysBetween } from './datetime';

// Blokken van twee weken: kort genoeg om een verandering te zien, lang
// genoeg om niet op één slechte nacht te leunen.
export const BLOK_DAGEN = 14;
// Twaalf weken: zes blokken. Tien weken was te kort toen haar historie nog
// uit een handvol metingen bestond; met tweeënzeventig dagen ingevuld laat
// twaalf weken het verloop zien in plaats van een momentopname.
export const VENSTER_DAGEN = 84;

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

// ── Rusthartslag per cyclusfase ─────────────────────────────────
//
// Dit kon pas toen zij haar rusthartslag met terugwerkende kracht invulde:
// met drieënzeventig metingen over drie cycli valt te zien of een fase bij
// háár structureel hoger of lager ligt. Eén cyclus is geen patroon, dus
// phasePattern geeft pas een uitspraak vanaf twee cycli die dezelfde kant
// op wijzen; wat daaronder valt wordt hier niet getoond in plaats van met
// een slag om de arm gebracht.
export function restingByPhase({ currentDate = todayLocal() } = {}) {
  const uit = [];
  for (const fase of PHASE_ORDER) {
    let p;
    try { p = phasePattern('hr_rest', fase, { asOf: currentDate }); }
    catch { continue; }
    if (!p?.known) continue;
    uit.push({
      phase: fase,
      delta: p.meanDelta,
      cycles: p.cycles,
      confidence: p.confidence,
      note: p.note,
    });
  }
  return {
    known: uit.length > 0,
    phases: uit,
    why: uit.length ? null
      : 'Nog geen cyclusfase waarin je rusthartslag over twee cycli dezelfde kant op '
        + 'wijst. Dat kan twee dingen betekenen: er is geen patroon, of er zijn nog te '
        + 'weinig cycli met metingen.',
  };
}

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

  // ── Het laagste punt telt mee ─────────────────────────────
  //
  // Alleen het eerste blok met het laatste vergelijken verbergt de vorm van
  // de lijn. Bij haar is dat precies wat er gebeurde: 63 in augustus, 58 in
  // september, 62 nu. Eerste tegen laatste zegt "stabiel"; wat er werkelijk
  // staat is dat ze vijf slagen won en ze weer heeft ingeleverd. Dat is een
  // ander verhaal, en het is het verhaal dat ertoe doet.
  const laagste = bruikbaar.reduce((m, b) => (b.median < m.median ? b : m), bruikbaar[0]);
  const sindsLaagste = laatste.median - laagste.median;
  const wekenSindsLaagste = Math.max(0,
    Math.round(daysBetween(laagste.tot, laatste.tot) / 7));
  // Een opleving telt alleen als hij én groot genoeg is én niet het laatste
  // blok zelf betreft.
  const opleving = laagste !== eerste && laagste !== laatste
    && sindsLaagste >= DRIFT_SIGNAAL;

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
    lowest: { median: rond(laagste.median), until: laagste.tot, n: laagste.n },
    sinceLowest: rond(sindsLaagste),
    weeksSinceLowest: wekenSindsLaagste,
    reboundFromLow: opleving,
    weightDelta: gewichtDelta,
    sleepMedian: slaapMediaan,
    // ── HRV naast de rusthartslag ─────────────────────────────
    //
    // Ze meten hetzelfde systeem en horen samen gelezen te worden. Dat is
    // ook het nut: gaan ze dezelfde kant op — rusthartslag omhoog, HRV
    // omlaag — dan is het beeld eenduidig en is er werkelijk
    // herstelschuld. Spreken ze elkaar tegen, dan is er aan één van de
    // twee iets anders aan de hand (een slechte nacht, een meetfout, de
    // cyclus) en is het geen reden om het schema terug te zetten.
    //
    // Eén waarschuwing hoort erbij: HRV is in absolute zin niet te
    // vergelijken tussen mensen. Alleen haar eigen verandering telt,
    // daarom staat hier een percentage en geen oordeel over de waarde.
    hrv: (() => {
      const h = series('hrv', { asOf: currentDate, since: vanaf })
        .filter(o => typeof o.value === 'number' && o.value > 3 && o.value < 250);
      if (h.length < MIN_PER_BLOK * 2) {
        return { known: false, count: h.length,
          why: `${h.length} HRV-metingen in ${window} dagen; vanaf ${MIN_PER_BLOK * 2} `
            + 'staat hier of hij meebeweegt met je rusthartslag.' };
      }
      const helft = Math.floor(h.length / 2);
      const med = (a) => {
        const v = a.map(x => x.value).sort((x, y) => x - y);
        return v.length ? v[Math.floor(v.length / 2)] : null;
      };
      const was = med(h.slice(0, helft));
      const nu = med(h.slice(-helft));
      const pct = was ? +(((nu - was) / was) * 100).toFixed(1) : null;
      const omlaag = pct != null && pct <= -8;
      const omhoog = pct != null && pct >= 8;
      // Wijzen ze samen dezelfde kant op? Rusthartslag omhoog hoort bij
      // HRV omlaag; dat samen is een eenduidig signaal.
      const samen = omlaag && delta >= DRIFT_SIGNAAL;
      return {
        known: true, count: h.length, from: rond(was), to: rond(nu), deltaPct: pct,
        direction: omlaag ? 'omlaag' : omhoog ? 'omhoog' : 'stabiel',
        agreesWithRestingHr: samen,
        line: `HRV ${rond(was)} → ${rond(nu)} ms (${pct > 0 ? '+' : ''}${pct}%) over `
          + `${weken} weken.`,
        why: samen
          ? 'Je rusthartslag loopt op én je HRV zakt. Twee metingen van hetzelfde '
            + 'systeem die dezelfde kant op wijzen — dit is een echt hersteltekort en '
            + 'geen ruis.'
          : omlaag
            ? 'Je HRV zakt, maar je rusthartslag beweegt niet mee. Kijk eerst naar '
              + 'slaap, alcohol, stress en je cyclusfase voordat je dit als '
              + 'trainingsschuld leest.'
            : omhoog
              ? 'Je HRV loopt op. Dat hoort bij een systeem dat herstelt van wat het '
                + 'krijgt.'
              : 'Je HRV ligt stabiel over deze periode.',
      };
    })(),
    line: opleving
      ? `Rusthartslag ${rond(eerste.median)} → ${rond(laagste.median)} → ${rond(laatste.median)} `
        + `over ${weken} weken.`
      : richting === 'stabiel'
        ? `Rusthartslag stabiel rond ${rond(laatste.median)} over ${weken} weken.`
        : `Rusthartslag ${delta > 0 ? '+' : ''}${rond(delta)} over ${weken} weken `
          + `(${rond(eerste.median)} → ${rond(laatste.median)}).`,
    verdict: opleving
      ? `Je laagste periode was rond ${laagste.tot}: mediaan ${rond(laagste.median)}. `
        + `Sindsdien ${rond(sindsLaagste)} slagen hoger, en de laatste weken vlak rond `
        + `${rond(laatste.median)}. Dat is geen alarm — je zit weer op je niveau van het `
        + 'begin — maar die lagere periode laat zien wat er voor jou in zit. Wat was er '
        + 'toen anders in training, slaap en eten?'
      : verdictVoor(richting, rond(delta), weken),
    causes: (richting === 'omhoog' || richting === 'sterk_omhoog' || opleving)
      ? oorzaken({ gewichtDelta, slaapMediaan }) : [],
    byPhase: restingByPhase({ currentDate }),
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
