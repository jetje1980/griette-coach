// Wat beperkt je deze week — en hoe zeker is dat?
//
// ─────────────────────────────────────────────────────────────────
// WAAROM ÉÉN LIMITER, EN NIET EEN LIJST
//
// Een coach die zeven dingen tegelijk noemt, noemt niets. De week heeft één
// vraag: waar loopt het nu op vast? Alles wat daarna komt — hoeveel je
// traint, waarop je let, wat je deze week probeert te veranderen — volgt uit
// dat ene antwoord.
//
// Maar één antwoord zonder tweede is ook misleidend, want beperkingen komen
// zelden alleen. Daarom: een primaire limiter die de week stuurt, een
// secundaire die er direct achter zit en meekijkt, een zekerheid die uit de
// gegevens komt in plaats van uit de toon, en de signalen die eronder liggen.
//
// ─────────────────────────────────────────────────────────────────
// DE VOLGORDE IS EEN KEUZE, GEEN RANGSCHIKKING OP ERNST
//
// Veiligheid eerst, dan herstel, dan capaciteit, dan doelen. Gewichtstempo
// staat onderaan — niet omdat het niet telt, maar omdat het nooit de reden
// mag zijn dat een trainingsprikkel omlaag gaat (§28).
//
// En helemaal onderaan staat NONE_READY_TO_BUILD: geen beperking is zelf een
// uitkomst, en een coach die dat niet durft te zeggen produceert stilstand.
// ─────────────────────────────────────────────────────────────────

import { todayLocal, addDays } from './datetime';
import { series, rollingMean } from './timeline';
import { peseState, attributeSymptoms, ATTRIBUTION, PESE, dailyFunction,
  selfReportedPem, PEM_REPORT_WINDOW } from './pese';
import { cyclePosition, phasePattern, PATTERN_CONFIDENCE, PHASE } from './cyclePatterns';
import { recompositionSignal } from './bodyReview';

// De twaalf waarden uit §22, letterlijk.
export const LIMITER = {
  PESE: 'PESE',
  DELAYED_RECOVERY: 'DELAYED_RECOVERY',
  HORMONAL_PERIMENOPAUSE: 'HORMONAL_PERIMENOPAUSE',
  SLEEP: 'SLEEP',
  HEAT: 'HEAT',
  MUSCULAR_FATIGUE: 'MUSCULAR_FATIGUE',
  DISTANCE_TOLERANCE: 'DISTANCE_TOLERANCE',
  AEROBIC_ECONOMY: 'AEROBIC_ECONOMY',
  STRENGTH_RECOVERY: 'STRENGTH_RECOVERY',
  ENERGY_AVAILABILITY: 'ENERGY_AVAILABILITY',
  STRESS: 'STRESS',
  NONE_READY_TO_BUILD: 'NONE_READY_TO_BUILD',
};

export const LIMITER_NL = {
  PESE: 'post-exertionele belastbaarheid',
  DELAYED_RECOVERY: 'vertraagd herstel',
  HORMONAL_PERIMENOPAUSE: 'hormonale fase',
  SLEEP: 'slaap',
  HEAT: 'warmte',
  MUSCULAR_FATIGUE: 'spiervermoeidheid',
  DISTANCE_TOLERANCE: 'afstandstolerantie',
  AEROBIC_ECONOMY: 'aerobe economie',
  STRENGTH_RECOVERY: 'krachtherstel en spierbehoud',
  ENERGY_AVAILABILITY: 'energiebeschikbaarheid',
  STRESS: 'stress',
  NONE_READY_TO_BUILD: 'niets — er is ruimte om op te bouwen',
};

export const CONFIDENCE = { HIGH: 'hoog', MEDIUM: 'redelijk', LOW: 'laag' };

const rond = (x, n = 1) => (x == null ? null : +Number(x).toFixed(n));

// De prioriteit. Lager getal wint.
const PRIORITEIT = {
  [LIMITER.PESE]: 1,
  [LIMITER.DELAYED_RECOVERY]: 2,
  [LIMITER.SLEEP]: 3,
  [LIMITER.STRESS]: 4,
  [LIMITER.HEAT]: 5,
  [LIMITER.HORMONAL_PERIMENOPAUSE]: 6,
  [LIMITER.MUSCULAR_FATIGUE]: 7,
  [LIMITER.ENERGY_AVAILABILITY]: 8,
  [LIMITER.STRENGTH_RECOVERY]: 9,
  [LIMITER.DISTANCE_TOLERANCE]: 10,
  [LIMITER.AEROBIC_ECONOMY]: 11,
  [LIMITER.NONE_READY_TO_BUILD]: 99,
};

export function weeklyLimiter({ logs = {}, currentDate = todayLocal() } = {}) {
  const asOf = currentDate;
  const pese = peseState({ logs, currentDate });
  const attributie = attributeSymptoms({ logs, currentDate });
  const functie = dailyFunction({ currentDate });
  const positie = cyclePosition(asOf, { asOf });

  const tel = (m, dagen) => series(m, { asOf, since: addDays(asOf, -dagen) }).length;
  const laatste = (m, dagen = 5) => {
    const s = series(m, { asOf, since: addDays(asOf, -dagen) });
    return s.length ? s[s.length - 1].value : null;
  };

  const kandidaten = [];
  const voeg = (limiter, zekerheid, signalen, uitleg) =>
    kandidaten.push({ limiter, confidence: zekerheid, signals: signalen,
      explanation: uitleg, priority: PRIORITEIT[limiter] });

  // ── 1. Post-exertionele belastbaarheid ───────────────────────
  //
  // Twee ingangen, met opzet. De responslaag kijkt naar geregistreerde
  // sessies; daarnaast telt een dag die zij zélf als PEM heeft aangevinkt,
  // ook zonder bijbehorende workout. Dat tweede pad ontbrak eerst, en
  // daardoor viel een PEM-melding zonder horlogesessie stilzwijgend weg.
  const zelfPem = selfReportedPem({ currentDate: asOf });
  if (pese.state === PESE.RED) {
    voeg(LIMITER.PESE, pese.confidence, pese.signals, pese.reason);
  } else if (zelfPem.any) {
    voeg(LIMITER.PESE, zelfPem.fresh ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
      [`PEM-signaal in de afgelopen twee weken: ${zelfPem.count}×, laatste ${zelfPem.lastDate} (${zelfPem.daysAgo} dagen geleden)`,
        ...pese.signals],
      `Je hebt zelf PEM gemeld binnen ${PEM_REPORT_WINDOW} dagen. Zolang dat zo vers is, is je belastbaarheid de beperking en niet je conditie.`);
  } else if (pese.state === PESE.ORANGE && attributie.delayedWorsening) {
    voeg(LIMITER.DELAYED_RECOVERY, pese.confidence, pese.signals, pese.reason);
  }

  // ── 2. Vertraagd herstel zonder volledige PESE ───────────────
  const vertraagd = tel('delayed_fatigue', 7) + tel('delayed_brainfog', 7) +
    tel('delayed_breathless', 7);
  if (vertraagd > 0 && pese.state !== PESE.RED) {
    voeg(LIMITER.DELAYED_RECOVERY,
      vertraagd >= 2 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
      [`${vertraagd} melding(en) van vertraagde klachten in zeven dagen`],
      'Er zijn vertraagde klachten na inspanning gemeld. Dat is de vroegste marker die je hebt.');
  }

  // ── 3. Slaap ─────────────────────────────────────────────────
  const slaap5 = rollingMean('sleep_hours', 5, { asOf });
  const slaapBasis = rollingMean('sleep_hours', 42, { asOf });
  const slaapN = tel('sleep_hours', 5);
  if (slaap5 != null && slaap5 < 6.5) {
    voeg(LIMITER.SLEEP,
      slaapN >= 4 ? CONFIDENCE.HIGH : slaapN >= 2 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
      [`slaap gemiddeld ${rond(slaap5, 1)} u over ${slaapN} nacht(en)` +
        (slaapBasis != null ? `, je eigen basislijn is ${rond(slaapBasis, 1)} u` : '')],
      'Onder de zes en een half uur is herstel de beperkende factor, niet je conditie.');
  }

  // ── 4. Stress ────────────────────────────────────────────────
  const stressDagen = tel('stress_high', 7);
  if (stressDagen >= 2) {
    voeg(LIMITER.STRESS,
      stressDagen >= 4 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
      [`${stressDagen} dagen met hoge stress in een week`],
      'Stress kost hetzelfde herstel als training. Wat je aan de ene kant uitgeeft, is er aan de andere kant niet.');
  }

  // ── 5. Warmte ────────────────────────────────────────────────
  const opvliegers = laatste('hot_flashes');
  const nachtzweten = laatste('night_sweats');
  if ((opvliegers && Number(opvliegers) >= 2) || (nachtzweten && Number(nachtzweten) >= 2)) {
    // Opvliegers en nachtzweten zijn hormonaal, niet omgevingswarmte. Ze
    // horen daarom bij de hormonale fase — behalve als ze zó zwaar zijn dat
    // ze de slaap breken; dat is hierboven al afgevangen.
    voeg(LIMITER.HEAT,
      CONFIDENCE.LOW,
      [`opvliegers ${opvliegers ?? '—'}, nachtzweten ${nachtzweten ?? '—'}`],
      'Warmteregulatie kost inspanning die niet in je trainingsdata zichtbaar is. Loop koeler en op een koeler moment; de prikkel hoeft niet kleiner.');
  }

  // ── 6. Hormonale fase ────────────────────────────────────────
  // Alleen als er een herhaald patroon in haar eigen data onder zit. Zonder
  // dat is het een losse klachtendag en geen limiter (§17, §24).
  const hormonaalSignalen = ['bloating', 'puffiness', 'hot_flashes', 'night_sweats',
    'breast_tenderness', 'cravings'].filter(m => laatste(m));
  if (hormonaalSignalen.length >= 2 && attributie.attribution === ATTRIBUTION.HORMONAL) {
    const patroon = positie.phase !== PHASE.UNKNOWN
      ? ['weight', 'hr_rest', 'bloating']
        .map(m => phasePattern(m, positie.phase, { asOf }))
        .find(p => p.known && p.confidence !== PATTERN_CONFIDENCE.NONE)
      : null;
    voeg(LIMITER.HORMONAL_PERIMENOPAUSE,
      patroon ? (patroon.confidence === PATTERN_CONFIDENCE.STRONG ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM)
        : CONFIDENCE.LOW,
      [`${hormonaalSignalen.length} hormonale signalen: ${hormonaalSignalen.join(', ')}`,
        positie.phase !== PHASE.UNKNOWN
          ? `cyclusdag ${positie.day}, ${positie.phase} (${positie.certainty})`
          : `cyclusdag ${positie.day ?? '?'}, fase onbekend`,
        patroon ? patroon.note : 'nog geen herhaald patroon in je eigen data'],
      patroon
        ? `Dit herhaalt zich in je eigen cyclusdata. ${patroon.note}`
        : 'Hormonale signalen zonder herhaald patroon in je eigen data. Dat maakt dit een waarschijnlijkheid, geen vaststelling.');
  }

  // ── 7. Spiervermoeidheid ─────────────────────────────────────
  const spier = tel('symptom_pain', 6);
  if (spier >= 2) {
    voeg(LIMITER.MUSCULAR_FATIGUE,
      spier >= 3 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
      [`${spier} dagen spierpijn in zes dagen`],
      'Gewone spierpijn is een normale trainingsrespons, geen PEM. Maar meerdere dagen achter elkaar betekent dat het herstel het niet bijhoudt.');
  }

  // ── 8. Energiebeschikbaarheid ────────────────────────────────
  // Te weinig eten voor wat je doet. Het signaal: dalende energie én dalend
  // gewicht sneller dan bedoeld, zonder dat er iets anders speelt.
  const recomp = recompositionSignal({ asOf });
  const energie5 = rollingMean('energy', 5, { asOf });
  const energieBasis = rollingMean('energy', 42, { asOf });
  if ((recomp.signal === 'TE_SNEL' || recomp.signal === 'SNEL') &&
      energie5 != null && energieBasis != null && energie5 < energieBasis - 0.3) {
    voeg(LIMITER.ENERGY_AVAILABILITY, CONFIDENCE.MEDIUM,
      [recomp.note, `energie ${rond(energie5, 1)} tegenover je basislijn ${rond(energieBasis, 1)}`],
      'Je valt sneller af dan bedoeld én je energie zakt. Dat is te weinig brandstof voor wat je vraagt, niet te weinig discipline.');
  }

  // ── 9. Krachtherstel en spierbehoud ──────────────────────────
  const krachtSessies = tel('strength_volume', 14);
  if (krachtSessies === 0) {
    voeg(LIMITER.STRENGTH_RECOVERY, CONFIDENCE.HIGH,
      ['geen krachtsessies in veertien dagen'],
      'Zonder kracht is spierbehoud de beperking, niet je conditie. In deze fase van je leven is dat het duurste wat je kunt laten liggen.');
  } else if (krachtSessies === 1) {
    voeg(LIMITER.STRENGTH_RECOVERY, CONFIDENCE.MEDIUM,
      ['één krachtsessie in veertien dagen'],
      'Eén sessie per twee weken houdt niets in stand. Twee per week is de ondergrens die iets doet.');
  }

  // ── 10. Afstandstolerantie ───────────────────────────────────
  // De langste sessie die schoon verdragen werd, tegenover wat je doel vraagt.
  const runs = series('distance', { asOf, since: addDays(asOf, -42) })
    .filter(o => typeof o.value === 'number');
  const langste = runs.length ? Math.max(...runs.map(o => o.value)) : null;
  if (langste != null && langste < 5 && pese.state === PESE.GREEN) {
    voeg(LIMITER.DISTANCE_TOLERANCE,
      runs.length >= 4 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
      [`langste sessie in zes weken: ${rond(langste, 1)} km over ${runs.length} sessies`],
      'Je herstel houdt het bij; de afstand nog niet. Dat is de plek waar deze weken winst zit.');
  }

  // ── 11. Aerobe economie ──────────────────────────────────────
  const hrRust = rollingMean('hr_rest', 7, { asOf });
  const hrBasis = rollingMean('hr_rest', 56, { asOf });
  if (pese.state === PESE.GREEN && hrRust != null && hrBasis != null &&
      hrRust > hrBasis + 3 && !attributie.delayedWorsening) {
    voeg(LIMITER.AEROBIC_ECONOMY, CONFIDENCE.LOW,
      [`rusthartslag ${Math.round(hrRust)} tegenover je basislijn ${Math.round(hrBasis)}`],
      'Je hartslag ligt hoger dan je gewend bent zonder dat het herstel eronder lijdt. Rustig volume is hier het antwoord, niet harder lopen.');
  }

  // ── Geen beperking ───────────────────────────────────────────
  if (!kandidaten.length) {
    return {
      primary: LIMITER.NONE_READY_TO_BUILD,
      primaryLabel: LIMITER_NL.NONE_READY_TO_BUILD,
      secondary: null, secondaryLabel: null,
      confidence: pese.confidence,
      signals: pese.signals,
      explanation: pese.reason,
      pese: pese.state,
      attribution: attributie.attribution,
      cycleDay: positie.day ?? null,
      cyclePhase: positie.phase,
      dailyFunction: functie,
      all: [],
      note: 'Er is geen beperkende factor aanwijsbaar. Te weinig prikkel is óók een coachfout: bij dit beeld hoort een stap, geen herhaling.',
    };
  }

  kandidaten.sort((a, b) => a.priority - b.priority);
  const primair = kandidaten[0];
  const secundair = kandidaten[1] || null;

  return {
    primary: primair.limiter,
    primaryLabel: LIMITER_NL[primair.limiter],
    secondary: secundair?.limiter || null,
    secondaryLabel: secundair ? LIMITER_NL[secundair.limiter] : null,
    confidence: primair.confidence,
    signals: primair.signals,
    explanation: primair.explanation,
    secondaryExplanation: secundair?.explanation || null,
    pese: pese.state,
    attribution: attributie.attribution,
    attributionExplanation: attributie.explanation,
    cycleDay: positie.day ?? null,
    cyclePhase: positie.phase,
    dailyFunction: functie,
    all: kandidaten.map(k => ({ limiter: k.limiter, confidence: k.confidence })),
    note: primair.limiter === LIMITER.HORMONAL_PERIMENOPAUSE
      ? attributie.note
      : primair.limiter === LIMITER.PESE
        ? 'Dit gaat vóór elk doel en elke planning.'
        : null,
  };
}
