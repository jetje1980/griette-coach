// Hoe snel gaat zíj vooruit? Gemeten, niet uit de literatuur.
//
// ─────────────────────────────────────────────────────────────────
// DE TEGENWERPING DIE HOUT SNEED
//
// "Maar ik ben een geoefende loper. Denk je niet dat mn hartslag sneller
// gaat zakken bij gelijkblijvend tempo?"
//
// Daar stond tot nu toe één getal tegenover: 1,25% efficiëntiewinst per
// week, het midden van wat in de literatuur haalbaar heet. Dat is een
// gemiddelde over andere mensen. Zij vroeg naar zichzelf, en daar had ik
// een antwoord op moeten hebben, want het staat in haar eigen reeks.
//
// Narekenen over de periode waarin ze wél consequent trainde — 17
// augustus tot 20 september, met alleen loopblokken van vijf minuten of
// langer, zodat de hartslag op niveau was — geeft 1,6% per week. Dus ja:
// sneller dan het boekgetal, en haar tegenwerping klopt.
//
// Over de hele reeks komt er −1,2% per week uit, en dat is geen
// tegenspraak maar hetzelfde verhaal: in de weken met gaten ging het
// achteruit. Een helling door een periode zonder training is geen tempo
// van vooruitgang; het is een beschrijving van een periode waarin er
// nauwelijks getraind is.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT BESTAND DOET, EN WAT NIET
//
// Het meet de helling door de sessies in blokken waarin ze daadwerkelijk
// regelmatig liep, en gebruikt die alleen als er genoeg punten zijn en de
// uitkomst binnen het fysiologisch plausibele valt. Daarbuiten blijft het
// boekgetal staan — een gemeten helling van 6% per week is geen
// supervermogen maar een meetfout, en een model dat zoiets overneemt
// belooft binnen een maand het onmogelijke.
//
// Korte loopblokken tellen niet mee. In de eerste minuten loopt de
// hartslag nog achter op de inspanning, dus meters per minuut gedeeld
// door hartslag valt dan te hoog uit. Precies dat maakte twee sessies
// kunstmatig goed; zie HR_VERDACHT_DALING hieronder.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, daysBetween } from './datetime';
import { loadWorkouts } from './workouts';
// De ondergrens voor "dit is lopen en geen wandeling" stond hier als los
// getal 95 én in efficiency.js als MIN_METER_PER_MIN. Twee kopieën van
// dezelfde drempel: verander je er één, dan gaat een strandwandeling op
// de ene plek wél en op de andere níét als loopblok door. Precies die
// fout liet het plan eerder "45 min doorlopend" voorschrijven op grond
// van een wandeling van 33 minuten.
import { MIN_METER_PER_MIN } from './efficiency';

// Een blok telt pas mee als de hartslag op niveau kan zijn gekomen.
export const STEADY_SECONDEN = 300;

// Hoeveel sessies zijn er minimaal nodig voor een helling? Onder de vier
// punten is een trend een lijn door ruis.
export const MIN_PUNTEN = 4;

// Een reeks is pas "consequent" als er niet meer dan dit aantal dagen
// tussen twee sessies zit. Grotere gaten knippen de reeks in stukken, en
// elk stuk wordt apart bekeken.
export const MAX_GAT_DAGEN = 8;

// Buiten deze grenzen is een gemeten helling geen fysiologie maar ruis.
export const PLAUSIBEL_MIN = 0.3;
export const PLAUSIBEL_MAX = 2.5;

// Zakt de hartslag binnen één sessie met dit aantal slagen terwijl het
// tempo gelijk blijft, dan klopt er iets niet aan de meting: hartslag
// drift tijdens inspanning omhoog, niet omlaag. Zo'n sessie telt niet mee
// in de helling. Dit is wat 4 oktober onderscheidt van een topdag.
export const HR_VERDACHT_DALING = 12;

function blokkenVan(w) {
  const laps = Array.isArray(w?.laps) ? w.laps : [];
  return laps.map((l) => {
    const sec = Number(l.movingTime ?? l.moving_time ?? l.elapsed_time ?? 0);
    const meter = Number(l.distance ?? 0);
    const hr = Number(l.avgHr ?? l.average_heartrate ?? 0);
    if (!(sec >= STEADY_SECONDEN) || !(meter > 0) || !(hr > 0)) return null;
    const mpm = meter / (sec / 60);
    if (mpm < MIN_METER_PER_MIN) return null;
    return { sec, mpm, hr, ef: mpm / hr };
  }).filter(Boolean);
}

// Eén sessie, alleen uit steady-state blokken — en met het oordeel of de
// hartslagmeting betrouwbaar oogt.
export function steadyEfficiency(w) {
  const b = blokkenVan(w);
  if (!b.length) return null;
  const T = b.reduce((a, x) => a + x.sec, 0);
  const ef = b.reduce((a, x) => a + x.ef * x.sec, 0) / T;
  const hr = b.reduce((a, x) => a + x.hr * x.sec, 0) / T;
  const mpm = b.reduce((a, x) => a + x.mpm * x.sec, 0) / T;

  // Daalt de hartslag door de sessie heen terwijl het tempo blijft staan?
  const eerste = b[0], laatste = b[b.length - 1];
  const hrDaling = eerste.hr - laatste.hr;
  const tempoGelijk = Math.abs(laatste.mpm - eerste.mpm) / eerste.mpm < 0.12;
  const verdacht = b.length >= 3 && tempoGelijk && hrDaling >= HR_VERDACHT_DALING;

  return {
    date: w.date,
    ef: +ef.toFixed(3),
    avgHr: Math.round(hr),
    paceMin: +(1000 / mpm).toFixed(2),
    blocks: b.length,
    seconds: T,
    // Het langste aaneengesloten blok, los van de som. Twee blokken van
    // tien minuten zijn twintig minuten lopen maar bewijzen geen blok van
    // twintig: wie daarop een voorschrift baseert, schrijft een duur voor
    // die nooit achter elkaar is gelopen.
    langsteBlokSec: b.reduce((a, x) => Math.max(a, x.sec), 0),
    hrSuspect: verdacht,
    hrSuspectWhy: verdacht
      ? `Je hartslag zakte in deze sessie ${Math.round(hrDaling)} slagen terwijl je `
        + 'tempo gelijk bleef. Tijdens inspanning loopt hartslag juist op; dit wijst op '
        + 'een band die loslaat of een optische meter die wegvalt, niet op een topdag.'
      : null,
  };
}

// Kleinste-kwadraten door de logaritme: een percentage per week.
function helling(punten) {
  const n = punten.length;
  const sx = punten.reduce((a, p) => a + p.x, 0);
  const sy = punten.reduce((a, p) => a + p.y, 0);
  const sxy = punten.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = punten.reduce((a, p) => a + p.x * p.x, 0);
  const noemer = n * sxx - sx * sx;
  if (!noemer) return null;
  const b = (n * sxy - sx * sy) / noemer;
  return +((Math.exp(b) - 1) * 100).toFixed(2);
}

// ── Het gemeten tempo van vooruitgang ───────────────────────────
export function gemetenProgressie({ currentDate = todayLocal(), workouts = null,
  venster = 180 } = {}) {
  const alle = (workouts || loadWorkouts())
    .filter(w => w?.date && w.date <= currentDate
      && (w.activityType === 'run' || w.activityType == null)
      && daysBetween(w.date, currentDate) <= venster)
    .map(steadyEfficiency)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  const bruikbaar = alle.filter(s => !s.hrSuspect);
  const genegeerd = alle.filter(s => s.hrSuspect);

  // Knip in reeksen zonder gat groter dan MAX_GAT_DAGEN.
  const reeksen = [];
  let huidig = [];
  for (const s of bruikbaar) {
    if (huidig.length && daysBetween(huidig[huidig.length - 1].date, s.date) > MAX_GAT_DAGEN) {
      reeksen.push(huidig); huidig = [];
    }
    huidig.push(s);
  }
  if (huidig.length) reeksen.push(huidig);

  // De langste aaneengesloten reeks is de eerlijkste schatting: daarin is
  // er daadwerkelijk getraind.
  const beste = reeksen.filter(r => r.length >= MIN_PUNTEN)
    .sort((a, b) => b.length - a.length)[0] || null;

  if (!beste) {
    return {
      known: false,
      why: `Nog geen aaneengesloten reeks van ${MIN_PUNTEN} sessies met blokken van `
        + 'vijf minuten of langer. Zolang die er niet is, rekent de verwachting met het '
        + 'literatuurgetal in plaats van met jouw eigen tempo.',
      sessions: alle, ignored: genegeerd,
    };
  }

  const start = beste[0].date;
  const pct = helling(beste.map(s => ({
    x: daysBetween(start, s.date) / 7, y: Math.log(s.ef),
  })));

  const plausibel = pct != null && pct >= PLAUSIBEL_MIN && pct <= PLAUSIBEL_MAX;
  return {
    known: plausibel,
    pctPerWeek: pct,
    usable: plausibel ? pct : null,
    from: start, to: beste[beste.length - 1].date, count: beste.length,
    sessions: alle, ignored: genegeerd,
    why: pct == null
      ? 'De reeks levert geen helling op.'
      : plausibel
        ? `${String(pct).replace('.', ',')}% per week, gemeten over ${beste.length} sessies `
          + `tussen ${start} en ${beste[beste.length - 1].date} — alleen loopblokken van `
          + 'vijf minuten of langer, zodat je hartslag op niveau was.'
        : `De gemeten helling is ${String(pct).replace('.', ',')}% per week en dat ligt `
          + `buiten wat fysiologisch kan (${PLAUSIBEL_MIN}–${PLAUSIBEL_MAX}%). `
          + 'Daar zit een meetfout of een periode zonder training in, dus de verwachting '
          + 'rekent met het literatuurgetal.',
  };
}
