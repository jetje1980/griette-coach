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
import { sessionTarget, hrUitVoorschrift } from './sessionTarget';
import { trainingsAlarm, loadHrModel, zoneOf } from './hrModel';
import { efficiencyTrend as trendVanEfficientie } from './efficiency';
import { benodigdeEfficientie } from './doelPad';
import { TERREIN } from './progressExpectation';
import { krachtBeeld, alleKracht, SOORT } from './krachtBronnen';

const fmtTijd = (sec) => (sec == null || !Number.isFinite(sec) ? null
  : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

// Hoeveel mag het afwijken en nog "op doel" heten? Bij hartslag vier
// slagen — een hartslagband is geen scherpe lijn en een optische meter
// al helemaal niet.
export const HR_MARGE = 4;

// ── Wanneer was een sessie goed? ────────────────────────────────
//
// Hier stond: boven het doel van 132 is "te hard". Dat was fout, en zij
// zag het eerder dan ik: "is het niet reëler om de hartslag tussen 132 en
// 150 goed te keuren? Als de app vooral kijkt of ik sneller word bij
// gelijkblijvende hartslag, is dat niet beter?"
//
// Ja. Twee redenen, en de tweede is de zwaarste.
//
// Ten eerste sprak de tabel het zonemodel van de app zelf tegen. Dat
// noemt het gebied tussen VT1 en VT2 letterlijk "trainbaar gebied, geen
// verboden gebied". Zes van haar zes sessies werden afgekeurd omdat ze
// daarin lagen. Twee delen van één app die iets anders zeggen over
// dezelfde meting — precies het soort tegenspraak dat hier steeds terug
// blijft komen.
//
// Ten tweede: een hartslag is geen prestatie. Het doel van rustig lopen
// is sneller worden bij gelijke hartslag, en dát is te meten. Een sessie
// afkeuren op het middel terwijl het doel gemeten kan worden, is sturen
// op de verkeerde knop. Dus beschrijft dit bestand nu per sessie in welk
// gebied ze lag, en komt het oordeel van de trend: gaat haar economie
// omhoog, ja of nee.
//
// Wat blijft: boven het afgesproken plafond is wél te hard. Niet als
// morele categorie maar als feit — daar kost een sessie meer herstel dan
// hij oplevert, en dat is zichtbaar in de dagen erna.
export const OORDEEL = {
  BASIS: 'basis',          // onder VT1: waar de aerobe opbouw het meest oplevert
  OP_DOEL: 'op doel',      // tussen VT1 en haar alarm: waar ze op stuurt
  BAND: 'binnen de band',  // tussen alarm en plafond: goedgekeurd, bovenkant
  TE_HARD: 'te hard',      // boven het afgesproken plafond
};

export function hrKader(model = null) {
  const m = model || loadHrModel();
  return { vt1: m.vt1Hr, vt2: m.vt2Hr, alarm: trainingsAlarm(m), plafond: m.easyTargetHigh };
}

export function oordeelOverHr(hr, kader) {
  if (hr == null) return null;
  if (hr > kader.plafond) return OORDEEL.TE_HARD;
  if (hr > kader.alarm) return OORDEEL.BAND;
  if (hr > kader.vt1) return OORDEEL.OP_DOEL;
  return OORDEEL.BASIS;
}

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
    // ── Een gelopen training met lege kolommen is geen antwoord ──
    //
    // Strava levert een activiteit soms zonder ronden aan. Dan is er geen
    // blok van vijf minuten te lezen en stond hier alleen "niet te meten",
    // met lege vakjes bij hartslag en tempo — terwijl zij in Strava gewoon
    // ziet dat ze 3,78 km liep op hartslag 163. Een app die van een
    // bestaande training niets weet te zeggen, lijkt stuk.
    //
    // Dus: als de sessie totalen heeft, staan die er. Wél apart gemerkt,
    // want een gemiddelde over de hele sessie is iets anders dan een
    // gemeten loopblok — er zitten stops, wandelstukken en de opstart in,
    // en daarom telt het niet mee in de loopeconomie.
    const km = Number(workout.distance) || null;
    const min = Number(workout.duration) || null;
    const hr = Number(workout.averageHR ?? workout.average_heartrate) || null;
    if (!km || !min || !hr) {
      return {
        date: workout.date, known: false,
        why: 'Geen loopblok van vijf minuten of langer — geen betrouwbaar tempo bij '
          + 'hartslag uit te lezen.',
      };
    }
    const kaderL = hrKader();
    const oordeelL = oordeelOverHr(hr, kaderL);
    return {
      date: workout.date,
      known: true,
      heleSessie: true,
      kader: kaderL,
      doelHr: kaderL.alarm,
      doelTempo: null,
      echteHr: hr,
      echtTempo: +(min / km).toFixed(2),
      hrDelta: Math.round(hr - kaderL.alarm),
      maxHr: Number(workout.maxHR ?? workout.max_heartrate) || null,
      zone: zoneOf(hr, { vt1Hr: kaderL.vt1, vt2Hr: kaderL.vt2 })?.id || null,
      zoneLabel: zoneOf(hr, { vt1Hr: kaderL.vt1, vt2Hr: kaderL.vt2 })?.label || null,
      bovenVt1: hr > kaderL.vt1,
      teHard: oordeelL === OORDEEL.TE_HARD,
      oordeel: oordeelL,
      blokMin: null, langsteBlokMin: null, blokken: 0, ef: null,
      uitleg: `Gemiddelde over de hele sessie: ${min / km < 100 ? fmtPace(min / km) : '—'}/km `
        + `bij hartslag ${hr}. Deze training kwam binnen zonder ronden, dus er is geen `
        + 'los loopblok uit te lezen. Daarom telt hij niet mee in je loopeconomie: een '
        + 'gemiddelde met stops en wandelstukken erin is niet te vergelijken met een '
        + 'gemeten blok.',
    };
  }

  // Het voorschrift zoals het die dag gold: gerekend met de gegevens van
  // de dag ervóór. Zie de toelichting bovenaan.
  const vooraf = addDays(workout.date, -1);

  // Het doel waar zij op stuurt is haar alarm, niet VT1. Zie OORDEEL
  // hierboven: VT1 is waar het het meest oplevert, het alarm is wat ze
  // werkelijk kan aanhouden, en op dát getal hoort de vergelijking te
  // staan. Vergelijken met 132 betekende dat de tabel haar elke week
  // afrekende op een lat die ze nooit haalt, en dan zegt een tabel steeds
  // hetzelfde en stuurt hij niets meer.
  //
  // Het doeltempo hoort bij diezelfde hartslag: een tempo berekend op 132
  // terwijl ze op 140 loopt, is een tempo dat nergens bij hoort.
  const kader = hrKader();
  const doelHr = kader.alarm;

  let doel = null;
  try {
    doel = sessionTarget({ date: workout.date, hr: doelHr, currentDate: vooraf, workouts });
  } catch { doel = null; }

  const hrDelta = Math.round(gemeten.avgHr - kader.alarm);
  const doelTempo = doel?.known ? doel.targetPace : null;
  const tempoDelta = doelTempo != null ? +(gemeten.paceMin - doelTempo).toFixed(2) : null;
  const oordeelHr = oordeelOverHr(gemeten.avgHr, kader);
  const teHard = oordeelHr === OORDEEL.TE_HARD;
  const zone = zoneOf(gemeten.avgHr, { vt1Hr: kader.vt1, vt2Hr: kader.vt2 });

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
    zone: zone?.id || null,
    zoneLabel: zone?.label || null,
    bovenVt1: gemeten.avgHr > kader.vt1,
    kader,
    oordeel: gemeten.hrSuspect ? 'meting onbetrouwbaar' : oordeelHr,
    uitleg: gemeten.hrSuspect
      ? gemeten.hrSuspectWhy
      : teHard
        ? `Hartslag ${gemeten.avgHr}, boven je afgesproken plafond van ${kader.plafond}. `
          + 'Dat is geen rustige sessie meer; die kost meer herstel dan hij oplevert, en '
          + 'dat zie je terug in de dagen erna.'
        : oordeelHr === OORDEEL.BASIS
          ? `Hartslag ${gemeten.avgHr}, onder VT1 (${kader.vt1}). Dit is het gebied waar `
            + 'aerobe opbouw het meeste oplevert.'
          : oordeelHr === OORDEEL.OP_DOEL
            ? `Hartslag ${gemeten.avgHr}, onder je alarm van ${kader.alarm}. Precies waar `
              + 'je op stuurt.'
            : `Hartslag ${gemeten.avgHr}: boven je alarm van ${kader.alarm}, maar binnen `
              + `je plafond van ${kader.plafond}. Goedgekeurd; het telt als de bovenkant `
              + 'van je band, niet als een rustige sessie.',
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
    const t = trendVanEfficientie({ currentDate, workouts: alle });
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
  // Sessies zonder gemeten blok tellen niet mee in het patroon: hun
  // hartslag klopt wel, maar hun tempo is een gemiddelde met stops erin
  // en dus niet te vergelijken met de rest.
  const bruikbaar = rows.filter(r => r.known && !r.hrSuspect && !r.uitbijter
    && !r.heleSessie);
  const teHard = bruikbaar.filter(r => r.teHard);
  const patroon = bruikbaar.length >= 3
    && teHard.length >= bruikbaar.length * PATROON_DEEL;

  // Hoe ver zit ze er structureel boven? Dat getal is de kern van de
  // bijsturing: niet "iets te hard" maar een mediaan van zoveel slagen.
  const overschot = teHard.length
    ? teHard.map(r => r.hrDelta).sort((a, b) => a - b)[Math.floor(teHard.length / 2)]
    : 0;

  // ── Het eigenlijke oordeel ────────────────────────────────────
  //
  // Niet "hoe vaak zat je te hoog" maar "word je sneller bij gelijke
  // hartslag". Dat was haar eigen voorstel en het is het juiste: de
  // hartslag is het middel, de economie is het doel, en het doel is
  // meetbaar. Een tabel die het middel beoordeelt terwijl het doel
  // gemeten kan worden, kijkt de verkeerde kant op.
  const kader = hrKader();
  let trend = null;
  try { trend = trendVanEfficientie({ currentDate, workouts: alle }); } catch { trend = null; }

  // En de verdeling: hoeveel sessies lagen waar. Dit vervangt het
  // pass/fail niet door niets — het vervangt het door het beeld waar 80/20
  // werkelijk over gaat.
  const verdeling = { basis: 0, op_doel: 0, band: 0, te_hard: 0 };
  for (const r of bruikbaar) {
    if (r.oordeel === OORDEEL.BASIS) verdeling.basis++;
    else if (r.oordeel === OORDEEL.OP_DOEL) verdeling.op_doel++;
    else if (r.oordeel === OORDEEL.BAND) verdeling.band++;
    else if (r.oordeel === OORDEEL.TE_HARD) verdeling.te_hard++;
  }
  const binnenBand = verdeling.basis + verdeling.op_doel + verdeling.band;

  return {
    known: rows.length > 0,
    rows,
    bruikbaar: bruikbaar.length,
    teHard: teHard.length,
    patroon,
    overschot,
    kader,
    verdeling,
    binnenBand,
    // De trend is het oordeel. `known` staat erbij want met minder dan zes
    // sessies is een richting een toevalstreffer, en dat hoort gezegd.
    trend: trend?.known ? {
      known: true,
      genoeg: !!trend.enough,
      richting: trend.direction,
      deltaPct: trend.deltaPct,
      nu: trend.current,
      tempoNu: trend.paceAtTarget,
      tempoToen: trend.paceAtTargetBefore,
      bijHr: trend.targetHr,
      regel: trend.verdict,
    } : { known: false, regel: trend?.why || null },
    // Het patroon over de rijen heen. Dit is waar de tabel voor dient:
    // één sessie te hard is een dag, zeven van de tien is een gewoonte.
    // De samenvatting begint bij het doel en niet bij het middel.
    samenvatting: !bruikbaar.length
      ? 'Nog geen sessie met een bruikbaar loopblok om te vergelijken.'
      : [
        trend?.known ? trend.verdict : null,
        `${binnenBand} van de ${bruikbaar.length} sessies lagen binnen je band tot `
          + `${kader.plafond}`
          + (verdeling.basis
            ? `, waarvan ${verdeling.basis} onder VT1 (${kader.vt1}).`
            : `. Geen daarvan onder VT1 (${kader.vt1}) — dat is het gebied waar aerobe `
              + 'opbouw het meest oplevert, en het is nu helemaal leeg.'),
        teHard.length
          ? (teHard.length === 1
            ? `Eén sessie lag boven je plafond van ${kader.plafond}; die kostte meer `
              + 'herstel dan hij opleverde.'
            : `${teHard.length} sessies lagen boven je plafond van ${kader.plafond}; die `
              + 'kosten meer herstel dan ze opleveren.')
          : null,
      ].filter(Boolean).join(' '),
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
  workouts = null, hrCap = null, targetSec = 2100, distanceKm = 5,
  terrain = 'trail', runDagenPerWeek = null, tabel: gegeven = null } = {}) {
  // Een race zonder streeftijd of zonder afstand heeft geen doelpad. Dan
  // staat er geen kader, in plaats van een som over ontbrekende getallen.
  const heeftDoel = Number.isFinite(targetSec) && Number.isFinite(distanceKm)
    && targetSec > 0 && distanceKm > 0;
  // Het plafond komt uit haar instellingen en niet uit een getal in de
  // code. Stond hier 145 terwijl haar plafond op 150 staat, dan rekent
  // het kader met een grens die nergens meer geldt.
  const plafondNu = hrCap ?? hrKader().plafond;
  // De tabel wordt bij voorkeur doorgegeven door het scherm dat hem al
  // toont, zodat de getallen in de bijsturing letterlijk uit de tabel
  // ernaast komen. Wordt hij niet gegeven, dan is het hetzelfde venster.
  const tabel = gegeven || sessieTabel({ currentDate, logs, workouts });
  const nodig = heeftDoel
    ? benodigdeEfficientie({ targetSec, distanceKm, hrCap: plafondNu, terrain }) : null;
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
    // ── De volgorde van de knoppen ────────────────────────────
    //
    // Hier stond hartslag altijd voorop. Dat was fout zodra de beoordeling
    // veranderde: als haar economie stijgt, is er niets te repareren — hoe
    // hoog haar hartslag ook stond. Het doel is sneller worden bij gelijke
    // hartslag, dus begint de volgorde bij de vraag of dát gebeurt.
    //
    // Pas als het antwoord nee is, komt de vraag waaróm niet, en dan in
    // deze volgorde: boven het plafond, geen basis onder VT1, te weinig
    // loopdagen, een blok dat ze nooit liep, geen zware kracht.
    const groeit = tabel.trend?.known && tabel.trend.genoeg
      && tabel.trend.richting === 'beter';
    const geenBasis = (tabel.verdeling?.basis ?? 0) === 0 && tabel.bruikbaar >= 3;
    // Eén sessie per week onder VT1, niet alle drie. Het advies gaat over
    // de verdeling van de week; het bij elke training herhalen maakt er
    // een opdracht van om voortaan alles traag te lopen, en dat is iets
    // anders dan wat er staat.
    const eersteVrije = komend[0]?.date;

    let knop, kort, waarom = null;
    if (groeit) {
      knop = 'niets';
      kort = `Niets. Houd je alarm op ${doelHr} en loop deze zoals hij er staat.`;
      waarom = `${tabel.trend.regel} Dat is precies waar rustig lopen voor bedoeld is, `
        + 'dus er valt nu niets bij te sturen. Verander pas iets als dit stilvalt.';
    } else if (tabel.patroon) {
      knop = 'hartslag';
      // Het doeltempo hoort in de korte vorm: zonder dat getal staat er bij
      // elke sessie dezelfde zin, en dan is het geen advies per training
      // meer maar een sjabloon.
      kort = `Houd hem onder je plafond van ${tabel.kader.plafond}; mikken doe je op `
        + `${doelHr}, en dat komt bij jou uit rond ${tempoTekst}.`;
      waarom = `${tabel.teHard} van je laatste ${tabel.bruikbaar} meetbare sessies lagen `
        + `boven ${tabel.kader.plafond}. Dat is geen rustige training meer maar `
        + 'wedstrijdinspanning, en drie of vier keer per week kost dat meer herstel dan '
        + 'het oplevert.';
    } else if (geenBasis && d.date === eersteVrije) {
      knop = 'verdeling';
      kort = `Loop deze bewust onder ${tabel.kader.vt1}, ook al voelt dat traag — `
        + `reken op trager dan ${tempoTekst}.`;
      waarom = `Al je meetbare sessies lagen boven VT1 (${tabel.kader.vt1}). Dat is `
        + 'toegestaan en het is geen fout, maar het betekent dat je nooit traint in het '
        + 'gebied waar de aerobe motor het hardst groeit. Eén sessie per week daar is '
        + 'waarschijnlijk het verschil tussen een economie die stilstaat en een die '
        + 'stijgt — déze sessie dus, en de andere lopen gewoon op je alarm.';
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
      kort = `Niets. Alarm op ${doelHr}, blok van ${blok ?? '—'} min, en klaar.`;
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
      hrCap: plafondNu,
      terrein: terreinInfo.label,
    },
    // De eerlijke zin erbij. Zonder deze zou de lijst suggereren dat deze
    // aanpassingen 35:00 op 12 december dichterbij brengen, en dat doen ze
    // niet — ze brengen de beste tijd dichterbij die er wél in zit, langs
    // precies dezelfde weg.
    kader: nodig?.ef
      ? `${fmtTijd(targetSec)} over ${distanceKm} km op ${terreinInfo.label} vraagt `
        + `${fmtPace(nodig.vlakTempo)}/km op vlakke weg bij hartslag ${plafondNu}, oftewel `
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
