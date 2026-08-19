// Eén kalenderdatum voor de hele app, altijd in Europe/Amsterdam.
//
// Waarom dit bestand bestaat: `new Date().toISOString().slice(0, 10)` geeft
// de UTC-datum. Tussen middernacht en 02:00 zomertijd (01:00 wintertijd) is
// dat in Nederland nog de vórige dag. Een run die je om 21:09 loopt en om
// 00:30 registreert belandde dan op de verkeerde kalenderdag, waarna de
// weekkalender hem op de ene dag zocht en de coach op de andere.
//
// Alle datums in de app zijn strings van de vorm 'JJJJ-MM-DD' die een
// kalenderdag in Amsterdam voorstellen — nooit een tijdstip, nooit UTC.

export const TZ = 'Europe/Amsterdam';

// 'en-CA' levert precies JJJJ-MM-DD; dat is de reden voor die locale.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

// De kalenderdag van nu in Amsterdam.
export function todayLocal() {
  return dayFormatter.format(new Date());
}

// De kalenderdag in Amsterdam van een willekeurig moment (Date, epoch-ms of
// ISO-string). Voor tijdstippen zónder zone-informatie — zoals Strava's
// start_date_local, dat een lokale tijd is maar wel een 'Z' meedraagt —
// nemen we de datum letterlijk over in plaats van hem om te rekenen.
export function localDayOf(input) {
  if (input == null) return null;
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return null;
    // Kale datum, of een lokale tijdstempel: de dag staat er al.
    if (input.length <= 10 || !/[+-]\d{2}:?\d{2}$/.test(input)) return m[1];
  }
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : dayFormatter.format(d);
}

// Rekenen met kalenderdagen doen we om 12:00 lokaal, ver van elke
// zomertijdsprong; anders levert een dag optellen soms 23 of 25 uur op.
function noon(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

export function addDays(dateStr, n) {
  const d = noon(dateStr);
  d.setDate(d.getDate() + n);
  return toDayString(d);
}

// Lokale velden uitlezen, niet via toISOString — die zou weer naar UTC gaan.
function toDayString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Hele kalenderdagen tussen twee datums; positief als `to` later is.
export function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  return Math.round((noon(toStr) - noon(fromStr)) / 86400000);
}

// Maandag van de week waarin `dateStr` valt.
export function startOfWeek(dateStr) {
  const d = noon(dateStr);
  const dow = d.getDay();                 // 0 = zondag
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toDayString(d);
}

export function endOfWeek(dateStr) {
  return addDays(startOfWeek(dateStr), 6);
}

// Datumstrings zijn lexicografisch vergelijkbaar; deze helpers maken de
// bedoeling zichtbaar op de plek waar het telt.
export function isPast(dateStr, today = todayLocal()) { return dateStr < today; }
export function isToday(dateStr, today = todayLocal()) { return dateStr === today; }
export function isFuture(dateStr, today = todayLocal()) { return dateStr > today; }

export const NL_DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
export const NL_DAYS = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
export const NL_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function dayOfWeek(dateStr) { return noon(dateStr).getDay(); }
export function dayName(dateStr) { return NL_DAYS[dayOfWeek(dateStr)]; }
export function dayNameShort(dateStr) { return NL_DAYS_SHORT[dayOfWeek(dateStr)]; }

export function formatNLShort(dateStr) {
  const d = noon(dateStr);
  return `${NL_DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
}

export function formatNLLong(dateStr) {
  const d = noon(dateStr);
  return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`;
}

// Reeks kalenderdagen, inclusief begin en eind.
export function dateRange(fromStr, toStr) {
  const out = [];
  for (let d = fromStr; d <= toStr; d = addDays(d, 1)) out.push(d);
  return out;
}

// De laatste `n` dagen tot en met `dateStr`, oudste eerst.
export function lastNDays(dateStr, n) {
  return Array.from({ length: n }, (_, i) => addDays(dateStr, -(n - 1 - i)));
}
