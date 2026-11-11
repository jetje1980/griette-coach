// Wat remt je vooruitgang nu — gemeten, en op volgorde van grootte.
//
// ─────────────────────────────────────────────────────────────────
// DE VRAAG
//
// Zij vroeg om de allerbeste trainers: hoe maak ik écht meer progressie.
// Het eerlijke antwoord op die vraag is bijna nooit "harder lopen". Het is
// kijken welke knoppen al bestaan, meten welke daarvan níét aanstaan, en
// die op volgorde van opbrengst neerleggen.
//
// Dit bestand doet precies dat, en niets anders. Geen algemene adviezen:
// alleen remmen waarvan in háár gegevens te zien is dát ze er zijn, met
// erbij hoe groot het is en waar dat getal vandaan komt.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER UITKWAM TOEN IK HET DE EERSTE KEER DRAAIDE
//
// De grootste rem was niet haar trainingsschema maar iets wat helemaal
// niet in het schema stond: sinds 21 september geen enkele krachtsessie.
// Zeven weken. Krachttraining is in deze vijf weken de best onderbouwde
// route naar hetzelfde tempo bij een lagere hartslag — meta-analyses
// (Rønnestad & Mujika; Beattie e.a.) geven 2 tot 4% betere loopeconomie
// in acht tot twaalf weken zwaar krachtwerk. Dat lag onaangeroerd.
//
// En de kracht die ze er wél deed, was bandwerk op RPE 2–3 met "kon nog
// meer". Dat is geen verwijt — het is een ander product. De economiewinst
// komt uit zware, lage herhalingen dicht bij wat je nog net kunt, niet uit
// hoge herhalingen met een lichte band. Het plan schreef dat laatste al
// voor; alleen zei niemand dat er een verschil tussen de twee zit.
//
// Dat is waarom dit bestand bestaat: een knop die aanstaat in het plan maar
// uitstaat in het echt, is geen knop.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween, addDays } from './datetime';
import { loadWorkouts } from './workouts';
import { runDayCeiling } from './restday';
// Kracht komt uit meer dan één plek; zie krachtBronnen.js voor waarom.
import { krachtBeeld } from './krachtBronnen';
import { readSymptoms } from './symptoms';

// Hoe zwaar weegt elke rem? Niet gevoel maar een schatting met een bron,
// zodat de volgorde navolgbaar is en niet van mijn stemming afhangt.
export const REM_GEWICHT = {
  kracht: 3.0,        // 2–4% loopeconomie in 8–12 weken
  herstel: 2.5,       // slaap en rusthartslag bepalen of een prikkel landt
  tekort: 2.0,        // in een energietekort bouw je geen motor
  frequentie: 2.0,    // de prikkel die er niet was, telt niet mee
  cadans: 1.0,        // kleiner, maar gratis
};

const mediaan = (a) => {
  const s = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// De datum komt uit de sleutel als hij niet in het record staat. De
// logboekmap is op datum gesleuteld, dus die sleutel is er altijd; `date`
// in het record is een kopie. Las je alleen die kopie, dan verdween een
// dag zonder dat er iets misging — en dan staat er niet "geen meting"
// maar gewoon niets. Stil verdwijnen is de vervelendste soort fout.
const logsTussen = (logs, van, tot) => Object.entries(logs || {})
  .map(([sleutel, l]) => (l && typeof l === 'object'
    ? { ...l, date: l.date || sleutel } : null))
  .filter(l => l?.date && l.date >= van && l.date <= tot);

// ── De krachtrem ────────────────────────────────────────────────
//
// Twee vragen, niet één: is er kracht gedaan, en wás het kracht. Een
// bandles op RPE 2 telt wel als beweging en niet als economieprikkel, en
// het verschil tussen die twee is precies wat zij hier moet kunnen zien.
function krachtRem({ currentDate, logs = {} }) {
  // ── Alle bronnen, niet één ───────────────────────────────────
  //
  // Hier stond alleen loadStrengthSessions(), en die kent het circuit van
  // acht minuten uit de 75-dagen-challenge niet. Daardoor concludeerde
  // deze rem dat zij zeven weken geleden met kracht gestopt was, terwijl
  // ze het al die tijd dagelijks deed. Zij moest dat zelf melden. Een
  // stellige verkeerde conclusie is erger dan "ik weet het niet", want
  // daar handel je naar.
  const beeld = krachtBeeld({ currentDate, logs, dagen: 28 });
  const laatste = beeld.laatste;
  const dagenGeleden = beeld.sinds;
  const in28 = { length: beeld.dagenMetKracht };
  const zwaar = { length: beeld.zwaar };
  const licht = beeld.kort + beeld.matig;

  if (in28.length === 0) {
    return {
      id: 'kracht', label: 'Krachttraining', gewicht: REM_GEWICHT.kracht,
      stand: laatste
        ? `Laatste krachtsessie ${dagenGeleden} dagen geleden (${laatste})`
        : 'Nog geen krachtsessie geregistreerd',
      kost: 'Dit is in vijf weken de best onderbouwde route naar hetzelfde tempo bij '
        + 'een lagere hartslag: 2 tot 4% loopeconomie in acht tot twaalf weken zwaar '
        + 'krachtwerk. Zolang hij uitstaat, ligt die winst er onaangeroerd.',
      wat: 'Eén à twee keer per week, 20 tot 30 minuten, met gewichten: 3 × 5 goblet '
        + 'squat, 3 × 6 split squat per been, 3 × 8 romanian deadlift, 3 × 15 kuitheffen '
        + 'langzaam omlaag. De laatste herhaling moet moeilijk zijn — dat is wat het '
        + 'verschil maakt met een band of hoge herhalingen.',
      status: 'uit',
    };
  }
  if (zwaar.length === 0 && licht > 0) {
    return {
      id: 'kracht', label: 'Krachttraining — wel gedaan, niet zwaar',
      gewicht: REM_GEWICHT.kracht * 0.7,
      stand: beeld.regel,
      kost: 'Je doet het werk — en het telt, voor je ritme en je romp. Alleen komt de '
        + 'economiewinst uit de literatuur van zware, lage herhalingen dicht bij wat je '
        + 'nog net kunt, niet uit korte circuits of lichte hoge herhalingen. Dus je '
        + 'betaalt de tijd wel en krijgt die specifieke opbrengst niet.',
      wat: 'Je circuit mag blijven staan — dat is je dagelijkse ritme. Zet er één à twee '
        + 'keer per week 20 minuten MET GEWICHTEN naast: 3 × 5 goblet squat, 3 × 6 split '
        + 'squat per been, 3 × 8 romanian deadlift, 3 × 15 kuitheffen. Dumbbells of een '
        + 'kettlebell, geen band — zware lage herhalingen maken je pezen stugger als '
        + 'veer, en dát verlaagt je hartslag bij hetzelfde tempo. Kon je er nog drie bij, '
        + 'dan was het te licht.',
      status: 'half',
    };
  }
  return {
    id: 'kracht', label: 'Krachttraining', gewicht: 0,
    stand: beeld.regel,
    kost: null,
    wat: 'Zo houden: twee per week, zwaar en kort.',
    status: 'aan',
  };
}

// ── De herstelrem ───────────────────────────────────────────────
//
// Rusthartslag tegen háár eigen basis, niet tegen een tabel. Een stijging
// van vier slagen is bij de een niets en bij de ander een signaal; wat het
// hier betekent volgt uit haar eigen spreiding van de weken ervoor.
function herstelRem({ currentDate, logs }) {
  const recent = logsTussen(logs, addDays(currentDate, -2), currentDate)
    .map(l => Number(l.hr_rest)).filter(Number.isFinite);
  const basis = logsTussen(logs, addDays(currentDate, -16), addDays(currentDate, -3))
    .map(l => Number(l.hr_rest)).filter(Number.isFinite);
  const slaap = logsTussen(logs, addDays(currentDate, -6), currentDate)
    .map(l => Number(l.sleep_hours)).filter(Number.isFinite);

  const nu = mediaan(recent), was = mediaan(basis);
  const stijging = (nu != null && was != null) ? +(nu - was).toFixed(1) : null;
  const slaapGem = slaap.length ? +(slaap.reduce((a, b) => a + b, 0) / slaap.length).toFixed(1) : null;

  // ── Ziek zijn verklaart een hoge rusthartslag ────────────────
  //
  // Een infectie jaagt de rusthartslag met gemak vijf tot tien slagen
  // omhoog en drukt HRV. Dat als herstelschuld van de training lezen is
  // onjuist én schadelijk: dan staat er "je herstelt te weinig van je
  // opbouw" terwijl zij griep heeft. De rem blijft staan — ziek is ziek —
  // maar met de juiste verklaring en zonder conclusie over haar opbouw.
  const ziek = logsTussen(logs, addDays(currentDate, -6), currentDate)
    .some(l => readSymptoms(l).infection?.present);

  const hartTeHoog = stijging != null && stijging >= 3;
  const slaapTeKort = slaapGem != null && slaapGem < 7;
  if (ziek && (hartTeHoog || slaapTeKort)) {
    return {
      id: 'herstel', label: 'Herstel — je bent ziek', gewicht: REM_GEWICHT.herstel * 0.4,
      stand: [hartTeHoog ? `rusthartslag ${nu} tegen ${was} in de twee weken ervoor` : null,
        slaapTeKort ? `slaap ${String(slaapGem).replace('.', ',')} uur gemiddeld` : null]
        .filter(Boolean).join(' · ') + ' — met een gemelde infectie erbij',
      kost: 'Dit is wat een infectie doet met je rusthartslag en je slaap, en het zegt '
        + 'niets over je opbouw. Geen reden om je schema terug te zetten; wel reden om '
        + 'niet te trainen tot je beter bent.',
      wat: 'Uitzieken. Begin weer als je rusthartslag terug is bij je eigen basis en je '
        + 'een hele dag zonder klachten bent geweest — en begin dan één stap lager dan '
        + 'waar je was, niet waar je gebleven was.',
      status: 'uit',
    };
  }
  if (!hartTeHoog && !slaapTeKort) {
    return {
      id: 'herstel', label: 'Herstel', gewicht: 0,
      stand: [nu != null ? `rusthartslag ${nu}` : null,
        slaapGem != null ? `slaap ${String(slaapGem).replace('.', ',')} uur gemiddeld` : null]
        .filter(Boolean).join(' · ') || 'Nog te weinig gemeten',
      kost: null, wat: 'Zo houden.', status: 'aan',
    };
  }
  return {
    id: 'herstel', label: 'Herstel', gewicht: REM_GEWICHT.herstel,
    stand: [hartTeHoog ? `rusthartslag ${nu} tegen ${was} in de twee weken ervoor (+${stijging})` : null,
      slaapTeKort ? `slaap ${String(slaapGem).replace('.', ',')} uur gemiddeld over zeven dagen` : null]
      .filter(Boolean).join(' · '),
    kost: 'Een trainingsprikkel levert pas iets op in het herstel erna. Met een '
      + 'oplopende rusthartslag en korte nachten betaal je wel de kosten van de '
      + 'training en krijg je de aanpassing niet. Dit is ook de meest voorkomende '
      + 'reden dat iemand hard traint en niet sneller wordt.',
    wat: slaapTeKort
      ? 'Zeven en een half uur als ondergrens, en op de avond vóór een sleutelsessie '
        + 'acht en een half. Dat is hier geen leefstijladvies maar de goedkoopste '
        + 'prestatiewinst die er ligt.'
      : 'Twee rustige dagen; komt de rusthartslag dan niet terug, dan is het eten of '
        + 'een opkomende infectie en niet de training.',
    status: 'uit',
  };
}

// ── De tekortrem ────────────────────────────────────────────────
//
// Afvallen maakt je lichter en een tekort maakt je trager. Welke van de
// twee wint hangt af van het tempo, en vijf weken voor een race is dat
// tempo bijna altijd te hoog.
export const VEILIG_KG_PER_WEEK = 0.5;
function tekortRem({ currentDate, logs }) {
  const punten = logsTussen(logs, addDays(currentDate, -27), currentDate)
    .filter(l => Number.isFinite(Number(l.weight)))
    .map(l => ({ date: l.date, kg: Number(l.weight) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (punten.length < 4) {
    return { id: 'tekort', label: 'Eten', gewicht: 0,
      stand: 'Te weinig weegmomenten om een tempo te zien', kost: null,
      wat: 'Weeg een paar keer per week, dan staat hier wat het kost of oplevert.',
      status: 'onbekend' };
  }
  const eerste = punten[0], laatste = punten[punten.length - 1];
  const weken = Math.max(1, daysBetween(eerste.date, laatste.date)) / 7;
  const perWeek = +((eerste.kg - laatste.kg) / weken).toFixed(2);

  if (perWeek <= VEILIG_KG_PER_WEEK) {
    return { id: 'tekort', label: 'Eten', gewicht: 0,
      stand: `${String(Math.abs(perWeek)).replace('.', ',')} kg per week — binnen de grens`,
      kost: null, wat: 'Zo houden; koolhydraten rond je loopdagen.', status: 'aan' };
  }
  return {
    id: 'tekort', label: 'Eten', gewicht: REM_GEWICHT.tekort,
    stand: `${String(perWeek).replace('.', ',')} kg per week over de laatste vier weken `
      + `(${eerste.kg} → ${laatste.kg})`,
    kost: `Boven ${String(VEILIG_KG_PER_WEEK).replace('.', ',')} kg per week gaat het verlies `
      + 'voor een deel uit spier en glycogeen, en juist glycogeen is wat je loopeconomie '
      + 'draagt. Elke kilo scheelt grofweg één procent tempo; een tekort kost er in '
      + 'trainingskwaliteit makkelijk meer dan dat. Over vijf weken verlies je zo netto.',
    wat: 'Tot 12 december op onderhoud, niet in tekort. Daarna verder afvallen — dan kost '
      + 'het je geen race.',
    status: 'uit',
  };
}

// ── De frequentierem ────────────────────────────────────────────
// Haar regel, in haar woorden: "zet het plafond op 4 loopdagen waarbij
// het er ook 3 mogen zijn, dus ik mag max 1 training skippen in de week."
//
// Hier stond 3,4 per week als los getal, en een grootste gat van drie
// dagen. Allebei verzonnen drempels die niets wisten van haar plafond.
// Nu volgt de rem haar regel: de ondergrens is het plafond min één
// overgeslagen training, en één overgeslagen training in een cadans van
// twee dagen maakt het gat vier dagen in plaats van twee. Staat het
// plafond ooit ergens anders, dan schuift deze rem vanzelf mee in plaats
// van te blijven hangen op een getal uit een andere week.
export const SKIPS_PER_WEEK = 1;
export const GAT_NA_SKIP = 4;

function frequentieRem({ currentDate }) {
  const plafond = runDayCeiling();
  const ondergrens = Math.max(1, plafond - SKIPS_PER_WEEK);
  const runs = loadWorkouts()
    .filter(w => w?.date && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null))
    .filter(w => daysBetween(w.date, currentDate) <= 28);
  const dagen = [...new Set(runs.map(w => w.date))].sort();
  const perWeek = +(dagen.length / 4).toFixed(1);
  const gaten = dagen.slice(1).map((d, i) => daysBetween(dagen[i], d));
  const grootste = gaten.length ? Math.max(...gaten) : null;

  if (perWeek >= ondergrens && (grootste == null || grootste <= GAT_NA_SKIP)) {
    return { id: 'frequentie', label: 'Loopdagen', gewicht: 0,
      stand: `${String(perWeek).replace('.', ',')} per week, grootste gat ${grootste} dagen`,
      kost: null,
      wat: `Zo houden. Je plafond staat op ${plafond}; met ${ondergrens} per week zit je `
        + 'binnen de afspraak van hoogstens één overgeslagen training.',
      status: 'aan' };
  }
  return {
    id: 'frequentie', label: 'Loopdagen', gewicht: REM_GEWICHT.frequentie,
    stand: `${String(perWeek).replace('.', ',')} per week in vier weken`
      + (grootste ? `, grootste gat ${grootste} dagen` : ''),
    kost: 'Je economie piekte in de weken dat je om de dag liep en zakte in '
      + 'de weken met gaten. Een prikkel die er niet was, telt nergens mee — en dit is de '
      + 'knop die niets kost behalve plannen.',
    wat: `Om de dag. Je plafond staat op ${plafond} loopdagen; ${ondergrens} per week is `
      + 'nog binnen de afspraak, daaronder niet. Liever vier keer twintig minuten dan '
      + 'twee keer veertig: de frequentie is de winst, niet de lengte.',
    status: 'uit',
  };
}

// ── Alles bij elkaar, op volgorde van grootte ───────────────────
export function remmen({ currentDate = todayLocal(), logs = {} } = {}) {
  const alle = [
    krachtRem({ currentDate, logs }),
    herstelRem({ currentDate, logs }),
    tekortRem({ currentDate, logs }),
    frequentieRem({ currentDate }),
  ];
  const aan = alle.filter(r => r.gewicht > 0).sort((a, b) => b.gewicht - a.gewicht);
  return {
    remmen: aan,
    goed: alle.filter(r => r.gewicht === 0 && r.status === 'aan'),
    alle,
    // De kopregel is geen aanmoediging maar een samenvatting: waar zit het.
    kop: aan.length === 0
      ? 'Geen gemeten rem. Wat je nu nog wint komt uit de training zelf.'
      : aan.length === 1
        ? `Eén ding remt je nu: ${aan[0].label.toLowerCase()}.`
        : `${aan.length} dingen remmen je nu. De grootste: ${aan[0].label.toLowerCase()}.`,
  };
}
