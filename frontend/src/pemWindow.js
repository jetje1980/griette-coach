// Hoe ver mag de app terugkijken voor een PEM-oordeel?
//
// ─────────────────────────────────────────────────────────────────
// ÉÉN REGEL, OP ÉÉN PLEK
//
// Dit stond verspreid over vier bestanden met vier verschillende getallen:
// veertien dagen voor een zelfgemelde PEM, zeven voor "vers", tien voor een
// tegenvallende respons, achtentwintig voor het algemene beeld. Elk getal
// was op zichzelf te verdedigen en samen leverden ze een coach op die
// "deze week" zei terwijl hij drie weken terugkeek.
//
// De regel is nu:
//
//   Een PEM-waarschuwing mag uitsluitend steunen op vandaag plus de
//   voorafgaande zeven dagen. Niets ouders mag tot een waarschuwing leiden.
//
// Historie mag langer getoond worden — dat is nuttige context, en daar is
// HISTORY_DAYS voor. Maar tonen is iets anders dan waarschuwen, en dat
// onderscheid is precies wat hier ontbrak.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays, daysBetween } from './datetime';
import { series } from './timeline';

// Het venster dat een waarschuwing mag dragen. Vandaag telt mee, dus acht
// kalenderdagen: vandaag en de zeven ervoor.
export const PEM_WARNING_DAYS = 7;

// Wat er getoond mag worden zonder te waarschuwen. Tien dagen, zoals
// afgesproken: genoeg om te zien dat er iets wás, te weinig om er vandaag
// een rem op te zetten.
export const HISTORY_DAYS = 10;

// De vroegste datum die nog mag meewegen voor een oordeel.
export function warningSince(asOf = todayLocal()) {
  return addDays(asOf, -PEM_WARNING_DAYS);
}

// Telt deze datum mee voor een waarschuwing?
export function withinWarningWindow(datum, asOf = todayLocal()) {
  if (!datum) return false;
  const dagen = daysBetween(datum, asOf);
  return dagen >= 0 && dagen <= PEM_WARNING_DAYS;
}

// ── De enige plek die "is er PEM" beantwoordt ───────────────────
//
// `warning` is wat een besluit mag sturen. `history` is wat een scherm mag
// laten zien. Ze zijn met opzet twee velden: wie ze door elkaar haalt,
// bouwt de fout terug die dit bestand oplost.
export function pemSignals({ asOf = todayLocal() } = {}) {
  const alles = series('symptom_pem', { asOf, since: addDays(asOf, -HISTORY_DAYS) })
    .map(o => o.observedAt);
  const binnen = alles.filter(d => withinWarningWindow(d, asOf));
  const erbuiten = alles.filter(d => !withinWarningWindow(d, asOf));

  const laatsteBinnen = binnen.length ? binnen[binnen.length - 1] : null;
  const laatsteOoit = alles.length ? alles[alles.length - 1] : null;

  return {
    // Voor besluiten:
    warning: binnen.length > 0,
    count: binnen.length,
    lastDate: laatsteBinnen,
    daysAgo: laatsteBinnen ? daysBetween(laatsteBinnen, asOf) : null,
    dates: binnen,

    // Alleen om te tonen:
    history: { dates: alles, outsideWindow: erbuiten, lastDate: laatsteOoit },

    windowDays: PEM_WARNING_DAYS,
    note: binnen.length
      ? `PEM-melding op ${laatsteBinnen} (${daysBetween(laatsteBinnen, asOf)} dagen geleden), binnen het venster van ${PEM_WARNING_DAYS} dagen.`
      : erbuiten.length
        ? `Laatste PEM-melding was ${daysBetween(erbuiten[erbuiten.length - 1], asOf)} dagen geleden — buiten het venster van ${PEM_WARNING_DAYS} dagen, dus geen actueel signaal.`
        : `Geen PEM-melding in de afgelopen ${HISTORY_DAYS} dagen.`,
  };
}

// Hetzelfde onderscheid voor een respons op een sessie: een tegenvallende
// sessie stuurt alleen zolang hij binnen het venster valt.
export function responseCountsAsWarning(sessieDatum, asOf = todayLocal()) {
  return withinWarningWindow(sessieDatum, asOf);
}
