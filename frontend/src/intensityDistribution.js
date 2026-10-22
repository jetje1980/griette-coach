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

  // ── Welke grens telt: het werkplafond, niet de meting ─────────
  //
  // Eerst stond hier VT1 uit de CPET als enige grens. Maar zij en haar
  // begeleiding hebben een werkplafond afgesproken (145), en dat besluit is
  // de grens waaraan haar training getoetst hoort te worden. De gemeten VT1
  // blijft ernaast staan als tweede getal, zodat het verschil zichtbaar is
  // in plaats van weggerekend — met een CPET van februari 2025 kan die
  // meting verouderd zijn, en dan is de afspraak het betere anker.
  const plafond = m.easyTargetHigh || m.vt1Hr;
  const emmer = (hr) => {
    if (hr < plafond - 26) return 'herstel';
    if (hr <= plafond) return 'rustig';
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
    // De grens waaraan getoetst is, en waar die vandaan komt.
    ceiling: plafond,
    ceilingSource: m.easyCeilingSource || 'cpet',
    ceilingVsVt1: plafond - m.vt1Hr,
    // Ook het aandeel onder de gemeten VT1, voor wie dat wil weten. Twee
    // getallen naast elkaar is eerlijker dan één getal met een voetnoot.
    underVt1Share: rond(blokken.filter(b => b.hr < m.vt1Hr)
      .reduce((s2, b) => s2 + b.minutes, 0) / totaal * 100),
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
  const grens = d.ceilingSource === 'afspraak'
    ? `je afgesproken werkplafond van ${d.ceiling} bpm`
    : `VT1 (${d.vt1} bpm)`;
  const naast = d.ceilingSource === 'afspraak' && d.ceilingVsVt1 !== 0
    ? ` Gemeten aan je VT1 van ${d.vt1} uit de CPET van februari 2025 zou dat ${d.underVt1Share}% zijn; die meting is inmiddels ruim anderhalf jaar oud, dus de afspraak is hier het betere anker.`
    : '';
  const basis = `${d.easyShare}% van je ${d.runMinutes} loopminuten lag binnen ${grens}, over ${d.sessions} sessies in vier weken. Voor duuropbouw is ${d.target}% de richtlijn.${naast}`;

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
        `Loop je volgende sessie met het hartslagalarm op ${d.ceiling} bpm. Zakt je tempo daardoor: dat is de bedoeling, niet een probleem.`,
        `Lukt het niet om onder ${d.ceiling} te blijven terwijl je loopt, dan is de eerlijke conclusie dat doorlopend lopen nu nog te zwaar is voor rustig — wandel dan langer en loop korter, met hetzelfde hartslagplafond.`,
      ],
    };
  }
  return {
    available: true, level: 'te_hard',
    label: 'Te veel van je lopen is te hard',
    detail: `${basis} ${d.shares.tussen}% lag boven de band maar onder VT2, en ${d.shares.drempel + d.shares.boven}% op of boven VT2 (${d.vt2}).`,
    advice: [
      `Breng het grootste deel terug onder ${d.ceiling} bpm. Tempo is hier de uitkomst, niet het doel.`,
      'Wil je harder werken, doe dat dan in één aparte sessie per week, bewust en kort — niet verspreid over alles.',
    ],
  };
}

// Voor de coachprompt: één blok tekst, dezelfde bron als het scherm.
export function distributionAsText(d, r) {
  if (!d?.available) return `INTENSITEITSVERDELING: onbekend — ${d?.note || 'geen data'}`;
  const L = [];
  L.push('INTENSITEITSVERDELING (vier weken, per loopblok gewogen op minuten):');
  L.push(`  grens waaraan getoetst: ${d.ceiling} bpm (${d.ceilingSource === 'afspraak' ? 'afgesproken werkplafond' : 'gemeten VT1'})` +
    (d.ceilingVsVt1 ? ` · gemeten VT1 ligt op ${d.vt1}, verschil ${d.ceilingVsVt1 > 0 ? '+' : ''}${d.ceilingVsVt1}` : ''));
  L.push(`  binnen de band: ${d.shares.herstel + d.shares.rustig}% · erboven onder VT2: ${d.shares.tussen}% · rond VT2: ${d.shares.drempel}% · boven VT2: ${d.shares.boven}%`);
  L.push(`  (onder de gemeten VT1 van ${d.vt1}: ${d.underVt1Share}%)`);
  L.push(`  ${d.easyMinutes} van ${d.runMinutes} loopminuten rustig · richtlijn ${d.target}% · uitspraak: ${d.verdict}`);
  L.push(`  ${r.detail}`);
  for (const a of (r.advice || [])) L.push(`  advies: ${a}`);
  L.push('  REGEL: is de verdeling omgekeerd of te hard, dan is dát de eerste knop —');
  L.push('  vóór langere blokken, vóór kortere pauzes en vóór meer kilometers. Noem het');
  L.push('  expliciet en reken haar tempo niet af: langzamer lopen is hier het doel.');
  return L.join('\n');
}
