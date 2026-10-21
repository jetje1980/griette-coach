// Hoeveel van je lopen is werkelijk rustig?
//
// ─────────────────────────────────────────────────────────────────
// WAT HIER ONTBRAK
//
// De app had een veiligheidsmodel (PEM-bescherming), een vermogensmodel
// (blokken en niveaus) en sinds kort een as (bloklengte vóór dichtheid).
// Wat ontbrak is de maat die in duurtraining als eerste telt: welk deel van
// je loopminuten onder je eerste drempel ligt.
//
// Bij haar bleek dat nul procent te zijn. Haar loopblokken van 7, 11 en 18
// oktober lagen op hartslag 135 tot 160, met VT1 op 132: vijfenzestig
// procent tussen VT1 en VT2, achtentwintig procent rond VT2, zeven procent
// erboven. Geen enkele minuut rustig.
//
// En erger: intensityRelease() gaf haar méér intensiteit vrij juist omdát
// ze die sessies boven VT1 goed verdroeg. Drie sessies boven VT1 plus vier
// PEM-vrije weken en het plafond ging naar VT2. Zo belonen twee modellen
// elkaars bijwerking: de strategie zegt "bouw blokken op, rustig", de
// intensiteitspoort zegt "je mag harder", en de gebruiker loopt alles op
// drempeltempo.
//
// Zonder deze module kon de app niet zien wat elke hardloopcoach als eerste
// zou opmerken.
//
// ─────────────────────────────────────────────────────────────────
// DE REGEL DIE HIER GELDT
//
// Voor duuropbouw hoort het grootste deel van de loopminuten onder VT1.
// Tachtig procent is de gangbare vuistregel; hieronder staat 80 als doel en
// 65 als ondergrens waaronder het een bevinding wordt. Dat is geen wet maar
// een richtlijn, en hij staat er als richtlijn bij.
//
// Wat deze module níét doet: een trainingsvoorschrift geven. Hij meet en
// benoemt. Wat er mee gebeurt staat in strategy.js en hrModel.js.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';
import { allBreakdowns } from './pace';
import { SEGMENT } from './pace';
import { loadHrModel } from './hrModel';

// Het doel voor duuropbouw, en de grens waaronder het een bevinding wordt.
export const EASY_SHARE_TARGET = 0.80;
export const EASY_SHARE_FLOOR = 0.65;

// Hoeveel loopminuten zijn er minstens nodig voordat dit iets zegt?
export const MIN_RUN_MINUTES = 20;

// Hoeveel weken terug kijken we?
export const WINDOW_DAYS = 28;

const rond = (x, n = 0) => (x == null ? null : +x.toFixed(n));

// ── De verdeling over de zones ──────────────────────────────────
export function intensityDistribution({ currentDate = todayLocal(),
  windowDays = WINDOW_DAYS, model = null } = {}) {
  const m = model || loadHrModel();
  const vanaf = addDays(currentDate, -(windowDays - 1));

  const blokken = [];
  for (const b of allBreakdowns({ limit: 60, currentDate })) {
    if (!b.available || b.derived) continue;
    if (b.workout.date < vanaf) continue;
    for (const seg of b.segments) {
      if (seg.kind !== SEGMENT.RUN) continue;
      if (seg.avgHr == null || !seg.minutes) continue;
      blokken.push({ date: b.workout.date, minutes: seg.minutes, hr: seg.avgHr });
    }
  }

  const totaal = blokken.reduce((s, x) => s + x.minutes, 0);
  if (totaal < MIN_RUN_MINUTES) {
    return {
      available: false,
      runMinutes: rond(totaal),
      note: blokken.length
        ? `Nog ${Math.ceil(MIN_RUN_MINUTES - totaal)} loopminuten met hartslag per blok nodig voordat hier iets over te zeggen valt.`
        : 'Nog geen loopblokken met hartslag in de afgelopen vier weken. Zet de rondeknop aan bij elk loop- en wandelblok; dan verschijnt deze verdeling.',
    };
  }

  // Vier emmers, met VT1 als de grens die telt.
  const emmer = (hr) => {
    if (hr < m.vt1Hr - 26) return 'herstel';
    if (hr < m.vt1Hr) return 'rustig';
    if (hr < m.vt2Hr - 4) return 'tussen';
    if (hr <= m.vt2Hr + 4) return 'drempel';
    return 'boven';
  };
  const minuten = { herstel: 0, rustig: 0, tussen: 0, drempel: 0, boven: 0 };
  for (const b of blokken) minuten[emmer(b.hr)] += b.minutes;

  const easy = minuten.herstel + minuten.rustig;
  const easyDeel = easy / totaal;
  const hard = minuten.drempel + minuten.boven;

  return {
    available: true,
    from: vanaf,
    runMinutes: rond(totaal),
    sessions: new Set(blokken.map(b => b.date)).size,
    minutes: Object.fromEntries(Object.entries(minuten).map(([k, v]) => [k, rond(v)])),
    shares: Object.fromEntries(Object.entries(minuten)
      .map(([k, v]) => [k, rond(v / totaal * 100)])),
    easyMinutes: rond(easy),
    easyShare: rond(easyDeel * 100),
    hardMinutes: rond(hard),
    vt1: m.vt1Hr,
    vt2: m.vt2Hr,
    // De uitspraak. Drie niveaus, want "te hard" en "ernstig omgekeerd"
    // vragen niet om hetzelfde gesprek.
    verdict: easyDeel >= EASY_SHARE_TARGET ? 'goed'
      : easyDeel >= EASY_SHARE_FLOOR ? 'aandacht'
      : easy === 0 ? 'omgekeerd' : 'te_hard',
    target: EASY_SHARE_TARGET * 100,
  };
}

// ── Wat het betekent, in woorden ────────────────────────────────
export function distributionReading(d) {
  if (!d?.available) {
    return { available: false, label: 'Intensiteitsverdeling onbekend', detail: d?.note || null };
  }
  const basis = `${d.easyShare}% van je ${d.runMinutes} loopminuten lag onder VT1 (${d.vt1} bpm), over ${d.sessions} sessies in vier weken. Voor duuropbouw is ${d.target}% de richtlijn.`;

  if (d.verdict === 'goed') {
    return { available: true, level: 'goed', label: 'Je verdeling is in orde',
      detail: `${basis} Zo hoort het: het meeste rustig, het harde werk apart en bewust.`,
      advice: [] };
  }
  if (d.verdict === 'aandacht') {
    return { available: true, level: 'aandacht', label: 'Iets te veel in het middengebied',
      detail: `${basis} Niet alarmerend, wel de moeite om op te letten.`,
      advice: ['Houd bij de volgende twee sessies de hartslag onder VT1, ook als dat betekent dat je langzamer loopt dan voelt alsof het moet.'] };
  }
  if (d.verdict === 'omgekeerd') {
    return {
      available: true, level: 'omgekeerd',
      label: 'Geen enkele loopminuut was rustig',
      detail: `${basis} Je loopblokken lagen allemaal boven VT1: ${d.shares.tussen}% tussen VT1 en VT2, ${d.shares.drempel}% rond VT2, ${d.shares.boven}% erboven. Dat is geen rustige duurtraining met wandelpauzes, dat is intervaltraining op drempeltempo met herstelpauzes — een andere training, met een andere rekening.`,
      advice: [
        'Dit is de eerste knop om aan te draaien, vóór langere blokken. Langer worden op drempeltempo is precies het patroon dat in 2024–2025 tot terugval leidde.',
        `Loop je volgende sessie met het hartslagalarm op ${d.vt1} bpm. Zakt je tempo daardoor naar 9:30 of 10:00 per kilometer: dat is de bedoeling, niet een probleem.`,
        'Lukt het niet om onder VT1 te blijven terwijl je loopt, dan is de eerlijke conclusie dat doorlopend lopen nu nog te zwaar is voor rustig — wandel dan langer en loop korter, met hetzelfde hartslagplafond.',
      ],
    };
  }
  return {
    available: true, level: 'te_hard',
    label: 'Te veel van je lopen is te hard',
    detail: `${basis} ${d.shares.tussen}% lag tussen VT1 en VT2 en ${d.shares.drempel + d.shares.boven}% op of boven VT2.`,
    advice: [
      `Breng het grootste deel terug onder ${d.vt1} bpm. Tempo is hier de uitkomst, niet het doel.`,
      'Wil je harder werken, doe dat dan in één aparte sessie per week, bewust en kort — niet verspreid over alles.',
    ],
  };
}

// Voor de coachprompt: één blok tekst, dezelfde bron als het scherm.
export function distributionAsText(d, r) {
  if (!d?.available) return `INTENSITEITSVERDELING: onbekend — ${d?.note || 'geen data'}`;
  const L = [];
  L.push('INTENSITEITSVERDELING (vier weken, per loopblok gewogen op minuten):');
  L.push(`  rustig onder VT1 (${d.vt1}): ${d.shares.herstel + d.shares.rustig}% · tussen VT1 en VT2: ${d.shares.tussen}% · rond VT2: ${d.shares.drempel}% · boven VT2: ${d.shares.boven}%`);
  L.push(`  ${d.easyMinutes} van ${d.runMinutes} loopminuten rustig · richtlijn ${d.target}% · uitspraak: ${d.verdict}`);
  L.push(`  ${r.detail}`);
  for (const a of (r.advice || [])) L.push(`  advies: ${a}`);
  L.push('  REGEL: is de verdeling omgekeerd of te hard, dan is dát de eerste knop —');
  L.push('  vóór langere blokken, vóór kortere pauzes en vóór meer kilometers. Noem het');
  L.push('  expliciet en reken haar tempo niet af: langzamer lopen is hier het doel.');
  return L.join('\n');
}
