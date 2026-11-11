// Doel tegen uitkomst, per training — en wat er daarna moet veranderen.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG
//
// "Ik wil dat er een tabel komt per training met doel hartslag en tempo
// en wat mijn hartslag en tempo was in die training. En geef per
// volgende training aan wat er aangepast moet worden om dat doel van 35
// min Ameland te halen."
//
// Het eerste bestond nergens. Het dagplan loopt van vandáág tot de race;
// gelopen trainingen staan er niet in, en het voorschrift van een
// voorbije dag werd nergens bewaard. Er was dus geen enkele plek waar
// "wat was het doel" en "wat werd het" naast elkaar stonden — terwijl
// dat de enige manier is om te zien of een plan werkt.
//
// ─────────────────────────────────────────────────────────────────
// HET VOORSCHRIFT VAN TOEN, NIET VAN NU
//
// De valkuil zit in het reconstrueren. Het doeltempo van 18 oktober kwam
// uit haar efficiëntie zoals die op 17 oktober bekend was. Wie dat
// naslaat met de gegevens van vandaag, berekent een doel dat zij die dag
// nooit heeft gezien — en vergelijkt haar prestatie met een lat die
// achteraf is verlegd. Dat is precies het soort stille oneerlijkheid
// waar deze app al een paar keer op is vastgelopen.
//
// Daarom rekent elke rij met `currentDate` op de dag vóór de training.
// Dat is trager, en het is het enige dat klopt.
//
// Eén ding valt niet te reconstrueren: welk sóórt sessie het die dag was.
// Het plan bestond toen nog niet, dus er is geen opgeslagen rol. Deze
// tabel neemt daarom overal EASY_ECONOMY aan — wat voor haar klopt
// (alles onder het plafond, geen intervalsessies in de hele reeks), maar
// het is een aanname en niet een meting. Staat er ooit een kwaliteits-
// sessie in haar historie, dan hoort de rol bij de training opgeslagen
// te worden in plaats van hier geraden.
//
// ─────────────────────────────────────────────────────────────────
// EN DE BIJSTURING
//
// Haar doel van 35:00 haalt 12 december niet; dat staat elders met de
// som erbij. Hier zou het verleidelijk zijn om per sessie toch een
// "nodig voor 35:00"-tempo te zetten. Dat doet dit bestand niet. Het
// benoemt per training de bindende beperking — hartslag, frequentie,
// bloklengte of kracht — en zegt wat daaraan moet veranderen. Dat zijn
// dezelfde vier knoppen die haar uiteindelijk naar 35:00 brengen; alleen
// de datum verschuift, niet de weg.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';
import { loadWorkouts, fmtPace } from './workouts';
import { steadyEfficiency } from './gemetenTempo';
import { efficiencyTrend } from './efficiency';
import { sessionTarget, hrUitVoorschrift } from './sessionTarget';
import { hrPrescription } from './hrModel';
import { benodigdeEfficientie } from './doelPad';
import { TERREIN } from './progressExpectation';
import { krachtBeeld, alleKracht, SOORT } from './krachtBronnen';

const fmtTijd = (sec) => (sec == null || !Number.isFinite(sec) ? null
  : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

// Hoeveel mag het afwijken en nog "op doel" heten? Bij hartslag vier
// slagen — een hartslagband is geen scherpe lijn en een optische meter
// al helemaal niet.
export const HR_MARGE = 4;

// Wanneer is te hard geen incident meer maar een gewoonte? Bij de helft.
export const PATROON_DEEL = 0.5;

// Hoeveel trainingen staan er in de tabel? Dit getal staat hier en nergens
// anders, want de bijsturing citeert de tabel ("mediaan 17 slagen over de
// laatste zeven") en rekende die eerst zelf uit over een ander venster.
// Dan staan er twee verschillende aantallen op één scherm over dezelfde
// vraag — precies de fout die deze app al een paar keer heeft gemaakt.
export const TABEL_AANTAL = 10;

// ── Eén gelopen training tegen het doel van die dag ─────────────
export function sessieRij(workout, { logs = {}, workouts = null } = {}) {
  const gemeten = steadyEfficiency(workout);
  if (!gemeten) {
    return {
      date: workout.date, known: false,
      why: 'Geen loopblok van vijf minuten of langer — geen betrouwbaar tempo bij '
        + 'hartslag uit te lezen.',
    };
  }

  // Het voorschrift zoals het die dag gold: gerekend met de gegevens van
  // de dag ervóór. Zie de toelichting bovenaan.
  const vooraf = addDays(workout.date, -1);
  let regel = null;
  try {
    regel = hrPrescription({ purpose: 'EASY_ECONOMY', logs, currentDate: vooraf }).line;
  } catch { regel = null; }
  const doelHr = hrUitVoorschrift(regel, { fallback: 132 });

  let doel = null;
  try {
    doel = sessionTarget({ date: workout.date, hr: doelHr, currentDate: vooraf, workouts });
  } catch { doel = null; }

  const hrDelta = Math.round(gemeten.avgHr - doelHr);
  const doelTempo = doel?.known ? doel.targetPace : null;
  const tempoDelta = doelTempo != null ? +(gemeten.paceMin - doelTempo).toFixed(2) : null;
  const teHard = hrDelta > HR_MARGE;

  // Een leeg doeltempo is geen storing en mag niet als streepje in de
  // tabel blijven staan: op dat moment waren er simpelweg nog niet genoeg
  // gemeten sessies om een tempo uit te rekenen. Die reden hoort erbij,
  // anders leest een gat als een fout.
  const doelTempoWhy = doelTempo != null ? null
    : (doel?.why || 'Op die datum waren er nog niet genoeg gemeten sessies om een '
      + 'doeltempo uit te rekenen.');

  // Het oordeel gaat over de hartslag, niet over het tempo. Bij een
  // hartslagplafond is tempo de uitkomst, niet de opdracht: wie op tempo
  // stuurt en daardoor boven de band uitkomt, heeft de sessie niet
  // gehaald maar overschreden. Dat onderscheid is de hele reden dat deze
  // tabel bestaat.
  return {
    date: workout.date,
    known: true,
    doelHr,
    doelTempo,
    doelTempoWhy,
    echteHr: gemeten.avgHr,
    echtTempo: gemeten.paceMin,
    ef: gemeten.ef,
    blokMin: +(gemeten.seconds / 60).toFixed(1),
    blokken: gemeten.blocks,
    // Het langste aaneengesloten blok, niet de som. Hierop wordt
    // beoordeeld of een voorgeschreven duur al eens gehaald is.
    langsteBlokMin: +(gemeten.langsteBlokSec / 60).toFixed(1),
    hrDelta,
    tempoDelta,
    hrSuspect: !!gemeten.hrSuspect,
    teHard,
    oordeel: gemeten.hrSuspect ? 'meting onbetrouwbaar'
      : teHard ? 'te hard' : 'binnen de band',
    uitleg: gemeten.hrSuspect
      ? gemeten.hrSuspectWhy
      : teHard
        ? `Hartslag ${gemeten.avgHr} tegen een doel van ${doelHr}. Het tempo van `
          + `${fmtPace(gemeten.paceMin)}/km is dan geen prestatie maar het gevolg: je `
          + 'hebt harder gewerkt, niet economischer gelopen.'
        : `Hartslag ${gemeten.avgHr} tegen doel ${doelHr}`
          + (doelTempo != null
            ? `, tempo ${fmtPace(gemeten.paceMin)} tegen doel ${fmtPace(doelTempo)}.`
            : '.'),
  };
}

// ── De tabel: de laatste trainingen, doel naast uitkomst ────────
export function sessieTabel({ currentDate = todayLocal(), logs = {}, workouts = null,
  aantal = TABEL_AANTAL } = {}) {
  const alle = workouts || loadWorkouts();
  const runs = alle
    .filter(w => w?.date && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, aantal);

  // Welke sessies gooit de trendmotor weg als uitbijter? Die hoort de
  // tabel niet als "goed" te bestempelen: de motor die haar doeltempo
  // bepaalt, rekent er niet mee.
  let uitbijters = new Set();
  try {
    const t = efficiencyTrend({ currentDate, workouts: alle });
    uitbijters = new Set((t.outliers || []).map(o => o.date));
  } catch { uitbijters = new Set(); }

  const rows = runs.map(w => {
    const r = sessieRij(w, { logs, workouts: alle });
    if (!r.known || !uitbijters.has(r.date)) return r;
    return {
      ...r,
      uitbijter: true,
      oordeel: 'telt niet mee',
      uitleg: `Deze sessie wijkt zo ver af van je andere metingen dat de trend hem `
        + 'niet meerekent. Dat is niet hetzelfde als een slechte sessie — het betekent '
        + 'dat er iets aan de meting of de omstandigheden anders was, en dat je er geen '
        + 'conclusie over je vorm aan kunt hangen.',
    };
  });
  const bruikbaar = rows.filter(r => r.known && !r.hrSuspect && !r.uitbijter);
  const teHard = bruikbaar.filter(r => r.teHard);
  const patroon = bruikbaar.length >= 3
    && teHard.length >= bruikbaar.length * PATROON_DEEL;

  // Hoe ver zit ze er structureel boven? Dat getal is de kern van de
  // bijsturing: niet "iets te hard" maar een mediaan van zoveel slagen.
  const overschot = teHard.length
    ? teHard.map(r => r.hrDelta).sort((a, b) => a - b)[Math.floor(teHard.length / 2)]
    : 0;

  return {
    known: rows.length > 0,
    rows,
    bruikbaar: bruikbaar.length,
    teHard: teHard.length,
    patroon,
    overschot,
    // Het patroon over de rijen heen. Dit is waar de tabel voor dient:
    // één sessie te hard is een dag, zeven van de tien is een gewoonte.
    samenvatting: bruikbaar.length
      ? `${teHard.length} van de ${bruikbaar.length} sessies lagen meer dan `
        + `${HR_MARGE} slagen boven het doel.`
        + (patroon
          ? ` De mediaan van die sessies zat ${overschot} slagen te hoog. Dat is geen `
            + 'incident maar hoe je traint — en het is de meest waarschijnlijke reden '
            + 'dat je tempo bij gelijke hartslag niet zakt.'
          : '')
      : 'Nog geen sessie met een bruikbaar loopblok om te vergelijken.',
  };
}

// ── Dezelfde tabel, doorgetrokken tot de race ───────────────────
//
// Zij vroeg het blok "alvast in te vullen tot en met de race, met
// doeltempo en hartslag", en dat het zich telkens bijwerkt: de doelen bij
// nieuwe trainingen, en het werkelijke tempo en de hartslag erbij zodra
// een training gelopen is.
//
// Dat is één tabel, geen twee. Een aparte "planning" naast een aparte
// "logboek" zou betekenen dat dezelfde training op twee plekken staat met
// twee verschillende doelen — en dan loopt het uit elkaar zodra er iets
// verschuift. Hier staat elke training één keer: een toekomstige rij
// heeft alleen een doel, een gelopen rij heeft een doel én een uitkomst,
// en vandaag kan allebei zijn.
//
// Het bijwerken hoeft nergens te worden aangezet. Een toekomstige rij
// haalt zijn doeltempo uit `sessionTarget` van die dag, en dat rekent met
// de gemeten efficiëntie van nú. Loopt zij een goede sessie, dan schuift
// de hele rechterkolom mee bij de eerstvolgende keer dat dit scherm
// opent. Dat is nagerekend: EF 0,716 → 0,748 na één sessie op 0,80, en
// het doeltempo van 10:35 naar 10:02/km.
export function volledigeTabel({ currentDate = todayLocal(), logs = {},
  workouts = null, dagen = [], aantal = TABEL_AANTAL } = {}) {
  const terug = sessieTabel({ currentDate, logs, workouts, aantal });

  // Heb ik die dag ook kracht gedaan? Uit alleKracht, want dat is de
  // bron die krachtmodule, het circuit van acht minuten en een vinkje in
  // het dagboek bij elkaar leest. Eén van die drie los lezen is hier al
  // twee keer misgegaan: de app meldde "nul krachtsessies" terwijl zij er
  // veertien had gedaan.
  const krachtOp = new Map();
  try {
    for (const sessie of alleKracht({ currentDate, logs, venster: 180 }).sessies) {
      const al = krachtOp.get(sessie.date);
      // Twee sessies op één dag: de zwaarste wint, want dat is wat de
      // dag karakteriseert. Een zware les met daarnaast het circuit is
      // een krachtdag, geen circuitdag.
      const rang = { kort: 1, matig: 2, zwaar: 3 };
      if (!al || (rang[sessie.soort] || 0) > (rang[al.soort] || 0)) {
        krachtOp.set(sessie.date, sessie);
      }
    }
  } catch { /* geen kracht te lezen: de kolom blijft dan gewoon leeg */ }

  // Hoe de kolom leest. Een circuit van acht minuten is iets anders dan
  // een zware sessie, en dat verschil is precies waar haar economie van
  // afhangt — dus staat het er, in plaats van één vinkje voor allebei.
  const krachtVan = (datum, gepland) => {
    const g = krachtOp.get(datum);
    if (g) {
      return {
        gedaan: true,
        soort: g.soort,
        weergave: g.soort === SOORT.ZWAAR ? 'zwaar'
          : g.soort === SOORT.MATIG ? 'kracht' : 'circuit',
        bron: g.bronLabel || null,
      };
    }
    if (datum > currentDate && gepland) {
      return { gedaan: false, gepland: true, soort: null, weergave: 'gepland' };
    }
    return { gedaan: false, gepland: false, soort: null, weergave: null };
  };

  // Gelopen trainingen, oudste eerst — zodat de tabel van verleden naar
  // toekomst leest en "vandaag" er middenin staat.
  const gelopen = [...terug.rows].sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ ...r, status: r.known ? 'gelopen' : 'onmeetbaar', gepland: false,
      blokWeergave: r.known && r.langsteBlokMin ? `${r.langsteBlokMin}′` : null,
      kracht: krachtVan(r.date, false) }));
  const gelopenOp = new Map(gelopen.map(r => [r.date, r]));

  const vooruit = [];
  for (const d of dagen) {
    if (d.date < currentDate || !d.run) continue;
    // Het getal zelf als het plan het meegeeft; alleen anders uit de zin
    // gelezen. Zie racePlanDays: op de racedag levert de zin het verkeerde
    // getal op.
    const doelHr = d.run.targetHr ?? hrUitVoorschrift(d.run.hr, { fallback: 132 });
    const doelTempo = d.run.target?.known ? d.run.target.targetPace : (d.run.paceMin ?? null);
    const basis = {
      date: d.date,
      dayShort: d.dayShort,
      rol: d.role || null,
      beschrijving: d.run.description || null,
      blokMin: d.run.blockMin ?? null,
      reps: d.run.reps ?? null,
      isRace: !!d.run.isRace,
      // Hoe het blok te lezen is: een doorlopend blok van twaalf minuten
      // is iets anders dan zes keer twee, en de race is geen blok maar een
      // afstand.
      blokWeergave: d.run.isRace ? 'race'
        : d.run.reps > 1 ? `${d.run.reps}×${d.run.blockMin}′`
          : d.run.blockMin != null ? `${d.run.blockMin}′` : null,
      doelHr,
      doelTempo,
      kracht: krachtVan(d.date, !!d.strength),
      gated: !!d.gated,
      gateReason: d.gateReason || null,
      gepland: true,
      known: true,
    };

    // Vandaag kan al gelopen zijn. Dan is het één rij met allebei, niet
    // twee rijen die elkaar tegenspreken.
    const al = gelopenOp.get(d.date);
    if (al) {
      gelopenOp.set(d.date, { ...al, ...basis, ...{
        echteHr: al.echteHr, echtTempo: al.echtTempo, ef: al.ef,
        hrDelta: al.known ? Math.round(al.echteHr - doelHr) : null,
        langsteBlokMin: al.langsteBlokMin,
        teHard: al.teHard, hrSuspect: al.hrSuspect, uitbijter: al.uitbijter,
        oordeel: al.oordeel, uitleg: al.uitleg, known: al.known,
        status: al.known ? 'gelopen' : 'onmeetbaar',
        // Is hij gelopen, dan telt wat er werkelijk gelopen is, niet wat
        // er was voorgenomen.
        blokWeergave: al.blokWeergave || basis.blokWeergave,
      } });
      continue;
    }
    vooruit.push({ ...basis, status: d.date === currentDate ? 'vandaag' : 'gepland',
      echteHr: null, echtTempo: null });
  }

  const rows = [...gelopenOp.values(), ...vooruit]
    .sort((a, b) => a.date.localeCompare(b.date));

  const teGaan = rows.filter(r => r.status === 'gepland' || r.status === 'vandaag');
  return {
    known: rows.length > 0,
    rows,
    gelopen: rows.filter(r => r.status === 'gelopen').length,
    teGaan: teGaan.length,
    // Hetzelfde oordeel over het verleden als in sessieTabel: één bron,
    // zodat er geen tweede samenvatting ontstaat die iets anders zegt.
    bruikbaar: terug.bruikbaar,
    teHard: terug.teHard,
    patroon: terug.patroon,
    overschot: terug.overschot,
    samenvatting: terug.samenvatting,
    tabel: terug,
  };
}

// ── Wat er aan de volgende training moet veranderen ─────────────
//
// Vier knoppen, en per training degene die op dat moment bindt. De
// volgorde is niet willekeurig: hartslag eerst, want zolang zij elke
// sessie boven VT1 loopt, levert meer volume of meer kracht niets op —
// dan stapelt ze alleen belasting op een prikkel die niet aanslaat.
export function bijsturing({ currentDate = todayLocal(), dagen = [], logs = {},
  workouts = null, hrCap = 145, targetSec = 2100, distanceKm = 5,
  terrain = 'trail', runDagenPerWeek = null, tabel: gegeven = null } = {}) {
  // Een race zonder streeftijd of zonder afstand heeft geen doelpad. Dan
  // staat er geen kader, in plaats van een som over ontbrekende getallen.
  const heeftDoel = Number.isFinite(targetSec) && Number.isFinite(distanceKm)
    && targetSec > 0 && distanceKm > 0;
  // De tabel wordt bij voorkeur doorgegeven door het scherm dat hem al
  // toont, zodat de getallen in de bijsturing letterlijk uit de tabel
  // ernaast komen. Wordt hij niet gegeven, dan is het hetzelfde venster.
  const tabel = gegeven || sessieTabel({ currentDate, logs, workouts });
  const nodig = heeftDoel
    ? benodigdeEfficientie({ targetSec, distanceKm, hrCap, terrain }) : null;
  const terreinInfo = TERREIN[terrain] || TERREIN.trail;

  let kracht = null;
  try { kracht = krachtBeeld({ currentDate, logs, dagen: 28 }); } catch { kracht = null; }

  // Haar werkelijke loopfrequentie. Dit getal moet hier gemeten worden en
  // niet door het scherm worden aangereikt: een scherm dat het doorgeeft,
  // is een tweede plek waar het uitgerekend wordt, en dan verschijnen er
  // twee antwoorden op één vraag.
  const VENSTER = 28;
  const vanaf = addDays(currentDate, -(VENSTER - 1));
  const loopdagen = new Set((workouts || loadWorkouts())
    .filter(w => w?.date && w.date >= vanaf && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null))
    .map(w => w.date));
  const frequentie = runDagenPerWeek != null
    ? runDagenPerWeek
    : +((loopdagen.size / VENSTER) * 7).toFixed(1);

  // Het langste bewezen aaneengesloten loopblok. Een sessie die een
  // langer blok voorschrijft dan zij ooit achter elkaar heeft gelopen, is
  // geen plan maar een gok — dat is eerder misgegaan met een
  // strandwandeling die als loopblok werd gelezen. Het gaat hier om het
  // langste losse blok en niet om de som van de blokken: twee keer tien
  // minuten bewijst geen blok van twintig.
  const langsteBlok = tabel.rows
    .filter(r => r.known && !r.hrSuspect)
    .reduce((a, r) => Math.max(a, r.langsteBlokMin || 0), 0);

  const komend = dagen.filter(d => d.date >= currentDate && d.run && !d.gated).slice(0, 3);

  // De bindende knop is meestal voor elke aanstaande sessie dezelfde — bij
  // haar is dat de hartslag, en dat hoort ook zo: één beperking die drie
  // sessies lang bindt, is één beperking en niet drie. Maar dezelfde
  // alinea drie keer onder elkaar leest als een sjabloon en wordt dus niet
  // meer gelezen. Daarom staat de onderbouwing één keer, bij de eerste
  // sessie waar die knop bindt, en krijgen de volgende de korte vorm met
  // hun eigen getallen.
  const uitgelegd = new Set();

  const items = komend.map(d => {
    const doelHr = d.run.targetHr ?? hrUitVoorschrift(d.run.hr, { fallback: 132 });
    const doelTempo = d.run.target?.known ? d.run.target.targetPace : d.run.paceMin;
    const blok = d.run.blockMin ?? null;
    const tempoTekst = doelTempo ? `${fmtPace(doelTempo)}/km` : 'het geplande tempo';

    // De bindende knop voor déze dag. De volgorde is de kern: zolang zij
    // elke sessie boven VT1 loopt, levert meer volume of meer kracht
    // niets op, dus staat hartslag voorop.
    let knop, kort, waarom = null;
    if (tabel.patroon) {
      knop = 'hartslag';
      kort = `Op ${doelHr} of lager. Wordt je tempo daardoor trager dan ${tempoTekst}: `
        + 'dat is de bedoeling van deze sessie, niet het falen ervan.';
      waarom = `Je laatste ${tabel.bruikbaar} meetbare sessies zaten mediaan `
        + `${tabel.overschot} slagen boven het doel. Boven VT1 groeit de aerobe motor `
        + 'nauwelijks, dus zolang dat zo blijft is er geen prikkel om economischer te '
        + 'gaan lopen — hoeveel je ook doet. Dit is de enige knop die nu iets verandert.';
    } else if (frequentie < 3) {
      knop = 'frequentie';
      kort = 'Deze sessie hoeft niet beter te zijn, hij moet er zijn — en de volgende '
        + 'twee ook.';
      waarom = `Je loopt ${frequentie} keer per week; de opbouw rekent op drie tot `
        + 'vier. Met minder dan drie vervalt de aanpassing tussen de sessies sneller dan '
        + 'hij wordt opgebouwd, en dan is elke losse training weggegooid werk.';
    } else if (blok != null && langsteBlok > 0 && blok > langsteBlok + 3) {
      knop = 'bloklengte';
      kort = `Begin met ${Math.round(langsteBlok + 2)} min aaneengesloten en wandel de `
        + `rest van de ${blok} min aan.`;
      waarom = `Je langste bewezen aaneengesloten blok is ${langsteBlok} min. Een blok `
        + 'dat je halverwege afbreekt levert minder op dan een korter blok dat je '
        + 'afmaakt.';
    } else if (kracht && kracht.zwaar === 0) {
      knop = 'kracht';
      kort = 'Aan deze loopsessie niets. De winst zit ernaast: zware kracht.';
      waarom = 'In de laatste vier weken staat geen enkele zware krachtsessie. Zware, '
        + 'lage herhalingen zijn de snelste weg naar een lagere hartslag bij hetzelfde '
        + 'tempo. Je circuit van acht minuten blijft daarnaast gewoon staan.';
    } else {
      knop = 'niets';
      kort = `Niets. Op ${doelHr} of lager, blok van ${blok ?? '—'} min, en klaar.`;
    }

    const eerste = !uitgelegd.has(knop);
    uitgelegd.add(knop);

    return {
      date: d.date, dayShort: d.dayShort, rol: d.role,
      beschrijving: d.run.description,
      doelHr, doelTempo, blokMin: blok,
      knop,
      aanpassing: kort,
      // De onderbouwing staat alleen bij de eerste sessie waar deze knop
      // bindt; daarna is hij al gegeven.
      waarom: eerste ? waarom : null,
    };
  });

  return {
    known: items.length > 0,
    items,
    doel: {
      known: heeftDoel,
      tijd: fmtTijd(targetSec),
      tempoOpTerrein: heeftDoel ? (targetSec / 60) / distanceKm : null,
      tempoVlak: nodig?.vlakTempo ?? null,
      benodigdeEf: nodig?.ef ?? null,
      onmogelijk: !!nodig?.onmogelijk,
      hrCap,
      terrein: terreinInfo.label,
    },
    // De eerlijke zin erbij. Zonder deze zou de lijst suggereren dat deze
    // aanpassingen 35:00 op 12 december dichterbij brengen, en dat doen ze
    // niet — ze brengen de beste tijd dichterbij die er wél in zit, langs
    // precies dezelfde weg.
    kader: nodig?.ef
      ? `${fmtTijd(targetSec)} over ${distanceKm} km op ${terreinInfo.label} vraagt `
        + `${fmtPace(nodig.vlakTempo)}/km op vlakke weg bij hartslag ${hrCap}, oftewel `
        + `efficiëntie ${nodig.ef}. De aanpassingen hieronder brengen je niet naar dat `
        + 'getal op 12 december — ze brengen je naar de beste tijd die er wél in zit, en '
        + 'het zijn dezelfde aanpassingen die je er uiteindelijk wel brengen.'
      : nodig?.onmogelijk
        ? `${fmtTijd(targetSec)} is op ${terreinInfo.label} sneller dan de ondergrond `
          + 'toelaat: er is geen hartslag en geen efficiëntie die dat haalt.'
        : null,
    patroon: tabel.samenvatting,
    frequentie,
    langsteBlok,
    tabel,
  };
}
