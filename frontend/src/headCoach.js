// De Head Coach: één besluit, geen zeven meningen.
//
// Onder deze laag zitten losse engines — hardlopen, kracht, herstel,
// lichaam, glow, ADHD/werk, Future Self. Die mogen ingewikkeld zijn. Wat
// de gebruiker ziet mag dat niet. Zij krijgt één antwoord op één vraag:
//
//   Wat doe ik nu, en wat hoef ik vandaag níet te doen?
//
// De keten die dat oplevert:
//
//   STATE → BOTTLENECK → TRADE-OFF → HIGHEST LEVERAGE ACTION → PROTECT → REVIEW
//
// Conflicten worden hier opgelost, niet doorgeschoven naar het scherm.
// Als hardlopen zegt "ja" en herstel zegt "nee", dan wint herstel en staat
// dat in de trade-off. De gebruiker ziet nooit twee adviezen naast elkaar.

import { computeHeadCoach, computeNextSession } from './components/CoachAdvice';
import { strengthDecision } from './strengthGate';
import { highestLeverageAction, analyseDomain, activeDomainIds } from './leverage';
import { suggestExperience } from './aliveness';
import { dueCheckpoint } from './bodyProgress';
import { todayLocal, addDays } from './datetime';
import { loadTasks, dueFollowUps } from './tasks';

// Rangorde van besluiten. Hoe hoger, hoe harder het advies andere
// overrulet. Herstel staat bovenaan omdat het bij long COVID het enige is
// dat je écht kwijt kunt raken.
const PRIORITY = {
  MEDICAL: 100,      // rood, PEM, meerdere symptomen
  RECOVERY: 80,      // herstel gaat voor prikkel
  RESPONSE: 70,      // wachten op de 24–48u-respons
  PROTECT: 60,       // beschermde tijd is al ingepland
  TRAINING: 40,      // trainen mag
  WORK: 30,          // werk en taken
  EXPERIENCE: 20,    // Future Self / aliveness
};

function readDayPlan(date) {
  try { return JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}'); }
  catch { return {}; }
}

function getHour() { return new Date().getHours(); }

/**
 * Eén integraal besluit voor vandaag.
 *
 * Levert precies de zes elementen die Vandaag mag tonen:
 *   status, action, priorities, protect, experience, why
 */
export function headCoachDecision({
  log = {}, logs = {}, currentDate = todayLocal(), hour = null, minutes = null,
} = {}) {
  const h = hour ?? getHour();

  // ── STATE ─────────────────────────────────────────────────────
  const coach = computeHeadCoach(log, logs, currentDate);
  const runGate = coach.gate;
  const nextSession = computeNextSession(log, logs, currentDate);
  const strength = strengthDecision({ log, logs, currentDate, runGate, coach, minutes });

  const plan = readDayPlan(currentDate);
  const freeBlocks = plan.freeBlocks || [];
  const inFreeBlock =
    freeBlocks.includes('fullday') ||
    (freeBlocks.includes('morning') && h >= 6 && h < 12) ||
    (freeBlocks.includes('midday') && h >= 12 && h < 17) ||
    (freeBlocks.includes('evening') && h >= 17 && h < 23);

  const trained = !!(log.run_done || log.strength_done || log.core_done);

  // ── De statuskleur mag de poorten niet tegenspreken ───────────
  // De dagkleur komt uit slaap, energie en symptomen van vandaag. Maar als
  // de respons op de vorige sessie afwijkend was, kan de dag niet groen
  // heten terwijl er volledige rust uit rolt. Anders leest ze een groene
  // balk boven een rustadvies — precies het signaal dat ze in 2024 negeerde.
  const forcedRest = runGate?.action === 'FULL_REST' || strength?.action === 'FULL_REST';
  const status = (() => {
    if (!forcedRest || coach.decision === 'RED' || coach.decision === 'BLUE') {
      return { decision: coach.decision, word: coach.label, color: coach.color, emoji: coach.emoji };
    }
    return { decision: 'BLUE', word: 'Herstel', color: 'var(--blue, var(--gold))', emoji: '🛌' };
  })();

  // ── BOTTLENECK ────────────────────────────────────────────────
  // De hefboom-engine bepaalt wat er op dit moment het meest in de weg
  // staat, over alle actieve doelen heen.
  const leverage = highestLeverageAction({
    logs, currentDate, coach, runGate, strengthGate: strength, minutes,
  });

  // ── TRADE-OFF ─────────────────────────────────────────────────
  // Welke engines wilden iets, en wie wint? Dit is het blok dat voorkomt
  // dat er zeven adviezen naast elkaar op het scherm staan.
  const claims = [];

  if (runGate?.action === 'RUN_TODAY' && nextSession?.run) {
    claims.push({ id: 'run', priority: PRIORITY.TRAINING, wants: 'hardlopen',
      label: `T${nextSession.nr} — ${nextSession.run.description}`,
      minutes: nextSession.run.duration });
  } else if (runGate) {
    claims.push({ id: 'run', priority: runGate.action === 'FULL_REST' ? PRIORITY.MEDICAL
      : runGate.action === 'WAIT_FOR_RESPONSE' ? PRIORITY.RESPONSE : PRIORITY.RECOVERY,
      wants: 'geen run', label: runGate.label, blocked: true, reason: runGate.blockers[0] });
  }

  if (strength?.mayTrain && strength.recommendedClass) {
    claims.push({ id: 'strength', priority: PRIORITY.TRAINING, wants: 'kracht',
      label: `${strength.recommendedClass.title} — ${strength.recommendedClass.form || 'kracht'}`,
      minutes: strength.recommendedClass.duration });
  } else if (strength) {
    claims.push({ id: 'strength', priority: strength.action === 'FULL_REST' ? PRIORITY.MEDICAL
      : PRIORITY.RECOVERY, wants: 'geen kracht', label: strength.label,
      blocked: true, reason: strength.blockers[0] });
  }

  if (leverage.available) {
    claims.push({ id: 'leverage', priority: PRIORITY.WORK, wants: 'hefboomactie',
      label: leverage.action.text, minutes: leverage.action.minutes,
      driver: leverage.driver });
  }

  if (inFreeBlock) {
    claims.push({ id: 'protect', priority: PRIORITY.PROTECT, wants: 'niets',
      label: 'Beschermde vrije tijd', blocked: true });
  }

  // ── HIGHEST LEVERAGE ACTION ───────────────────────────────────
  // Precies één. Alle andere claims worden hieronder samengevat als
  // "wat je vandaag níet hoeft".
  const decision = resolveAction({
    coach, runGate, strength, nextSession, leverage, inFreeBlock, trained,
    log, logs, currentDate, hour: h,
  });

  // ── PROTECT ───────────────────────────────────────────────────
  const protect = resolveProtect({ coach, runGate, strength, log, plan, currentDate, h });

  // ── EXPERIENCE ────────────────────────────────────────────────
  // Hooguit één, en alleen als de dag het toelaat.
  const experience = suggestExperience({
    log, logs, currentDate, coach, place: 'home',
    state: log.adhd_state, minutes: h >= 21 ? 10 : 5,
  });

  // ── PRIORITIES ────────────────────────────────────────────────
  const priorities = resolvePriorities({ currentDate, decision });

  // ── REVIEW ────────────────────────────────────────────────────
  const review = resolveReview({ coach, runGate, strength, logs, currentDate });

  // ── Wat je vandaag níet hoeft ─────────────────────────────────
  const notToday = claims
    .filter(c => c.blocked && c.id !== decision.source)
    .map(c => ({ what: c.wants, why: c.reason || c.label }))
    .slice(0, 2);

  return {
    // De zes dingen die Vandaag mag tonen
    status: { ...status, sub: statusSub(status.decision, runGate, strength) },
    action: decision,
    priorities,
    protect,
    experience: experience.available ? experience.suggestion : null,
    why: decision.why,

    // Voor progressive disclosure, niet voor het eerste scherm
    detail: {
      coach, runGate, strength, nextSession, leverage,
      claims, notToday, review,
      trained, inFreeBlock,
    },
  };
}

function statusSub(decision, runGate, strength) {
  if (decision === 'RED') return 'rust is de training';
  if (runGate?.action === 'FULL_REST' || strength?.action === 'FULL_REST') return 'vandaag geen belasting';
  if (decision === 'BLUE') return 'herstel gaat voor';
  if (runGate?.action === 'RUN_TODAY') return 'lopen is vrijgegeven';
  if (strength?.mayTrain) return 'kracht is vrijgegeven';
  if (decision === 'AMBER') return 'voorzichtig vandaag';
  return 'bewegen mag, belasten niet';
}

// ── De ene actie ────────────────────────────────────────────────
// Volgorde van beslissen, van hard naar zacht. De eerste die aanslaat wint;
// er komt nooit meer dan één actie uit.
function resolveAction({
  coach, runGate, strength, nextSession, leverage, inFreeBlock, trained,
  log, logs, currentDate, hour,
}) {
  const mk = (o) => ({ minutes: null, source: null, ...o });

  // 1. Medisch: alles wijkt
  if (coach.decision === 'RED' || log.symptom_pem || log.training_recovery === 2) {
    return mk({
      emoji: '🛌', headline: 'Rust. Dat is vandaag de training.',
      detail: 'Geen prikkel, geen inhaalslag. Wat je vandaag niet doet, hoef je morgen niet terug te winnen.',
      source: 'medical', priority: PRIORITY.MEDICAL,
      why: [
        log.symptom_pem || log.training_recovery === 2
          ? 'Je meldde vandaag een PEM-signaal — trainen verlengt de terugslag.'
          : 'Je ochtendsignalen staan op rood.',
        'Herstel is de enige investering die vandaag rendeert.',
      ],
    });
  }

  // 2. Beschermde tijd loopt nu
  if (inFreeBlock) {
    return mk({
      emoji: '🌿', headline: 'Dit blok is van jou.',
      detail: 'Geen werk, geen taken, geen training. Dat is nu precies de bedoeling.',
      source: 'protect', priority: PRIORITY.PROTECT,
      why: ['Je hebt dit dagdeel zelf als vrij gemarkeerd.',
        'Structuur dient je autonomie; dit blok is waar dat op neerkomt.'],
    });
  }

  // 3. De vertraagde respons ontbreekt nog
  if (coach.pendingRecoveryCheck || runGate?.action === 'WAIT_FOR_RESPONSE') {
    return mk({
      emoji: '🌅', headline: 'Beantwoord eerst je herstelcheck.',
      detail: 'Hoe reageerde je lichaam op de vorige training? Daarna geef ik de volgende sessie vrij.',
      minutes: 1, source: 'response', priority: PRIORITY.RESPONSE,
      why: ['Het 24–48u-venster is de meetlat, niet je ochtendgevoel.',
        'Zonder dat antwoord kan ik de opbouw niet sturen.'],
    });
  }

  // 4. Training, als die is vrijgegeven en nog niet gedaan
  if (!trained && hour < 20) {
    if (runGate?.action === 'RUN_TODAY' && nextSession?.run) {
      return mk({
        emoji: '🏃', headline: `T${nextSession.nr} — ${nextSession.run.description}`,
        detail: `${nextSession.run.duration} min · ${nextSession.run.hrZone}`,
        minutes: nextSession.run.duration, source: 'run', priority: PRIORITY.TRAINING,
        why: [runGate.released?.[0] || 'Lopen is vrijgegeven.',
          'Hartslag is de instructie, tempo is de uitkomst.'],
      });
    }
    if (strength?.mayTrain && strength.recommendedClass) {
      const c = strength.recommendedClass;
      return mk({
        emoji: '🏋️', headline: `${c.title}${c.form ? ` — ${c.form.toUpperCase()}` : ''}`,
        detail: `${c.duration} min${strength.targetBand ? ` · ${strength.targetBand.replace('_', ' ')} band` : ''}${c.expectedRpe ? ` · RPE ${c.expectedRpe[0]}–${c.expectedRpe[1]}` : ''}`,
        minutes: c.duration, source: 'strength', priority: PRIORITY.TRAINING,
        why: [
          runGate && runGate.action !== 'RUN_TODAY'
            ? `Lopen staat op slot (${runGate.blockers[0]?.toLowerCase() || 'belasting'}), kracht is een andere prikkel.`
            : 'Kracht is vandaag vrijgegeven.',
          strength.classReason || 'Volledige dekking van je bewegingspatronen.',
        ],
      });
    }
  }

  // 5. De hefboom uit de doelen-engine
  if (leverage.available) {
    return mk({
      emoji: '🎯', headline: leverage.action.text,
      detail: leverage.alsoServes.length > 1
        ? `Dient ${leverage.alsoServes.join(' en ')}.`
        : `Dient ${leverage.domain.label.split('—')[0].trim()}.`,
      minutes: leverage.action.minutes, source: 'leverage', priority: PRIORITY.WORK,
      why: leverage.why.slice(0, 3),
      driver: leverage.driver,
    });
  }

  // 6. Al getraind of laat op de dag: afronden
  if (trained) {
    return mk({
      emoji: '✅', headline: 'Je training staat. Laat hem landen.',
      detail: 'Eten, drinken en niet doorstapelen. De winst van vandaag ontstaat in de uren erna.',
      source: 'recovery', priority: PRIORITY.RECOVERY,
      why: ['Je hebt vandaag getraind.',
        'Bij long COVID is wat je ná de sessie doet net zo bepalend als de sessie zelf.'],
    });
  }

  return mk({
    emoji: '🚶', headline: 'Wandelen, 20 minuten.',
    detail: 'Bewegen mag, belasten niet.',
    minutes: 20, source: 'recovery', priority: PRIORITY.RECOVERY,
    why: ['Geen trainingsprikkel vrijgegeven vandaag.',
      'Rustig bewegen ondersteunt je herstel zonder er iets van te vragen.'],
  });
}

// ── Eén ding om te beschermen ───────────────────────────────────
function resolveProtect({ coach, runGate, strength, log, plan, currentDate, h }) {
  const blocks = plan.freeBlocks || [];
  if (blocks.length) {
    const labels = { morning: 'je ochtend', midday: 'je middag',
      evening: 'je avond', fullday: 'deze hele dag' };
    return { what: labels[blocks[0]] || 'je vrije blok',
      why: 'Je hebt dit zelf vrijgehouden. Laat het staan.' };
  }
  if (coach.decision === 'RED' || log.symptom_pem) {
    return { what: 'je energie', why: 'Zeg vandaag één ding af. Dat is de belangrijkste zet die er is.' };
  }
  if (coach.decision === 'BLUE' || runGate?.action !== 'RUN_TODAY') {
    return { what: 'je avond', why: 'Geen extra afspraak, geen late training. Slaap is nu de hefboom.' };
  }
  const sleepH = log.sleep_hours;
  if (sleepH != null && sleepH < 7) {
    return { what: 'je bedtijd', why: `Je sliep ${sleepH} uur. Vanavond een half uur eerder afsluiten doet meer dan welke training ook.` };
  }
  return { what: 'één blok zonder afspraken',
    why: 'Lege ruimte is geen luxe maar de voorwaarde voor de rest.' };
}

// ── Maximaal drie prioriteiten ──────────────────────────────────
function resolvePriorities({ currentDate, decision }) {
  let top3 = [];
  try { top3 = JSON.parse(localStorage.getItem(`gc_top3_${currentDate}`) || '[]'); }
  catch { top3 = []; }

  const open = top3.filter(t => !t.done).slice(0, 3);
  const followUps = dueFollowUps(currentDate).slice(0, 1);

  const items = open.map(t => ({ text: t.text || t.title, kind: 'top3', done: false }));
  for (const f of followUps) {
    if (items.length >= 3) break;
    items.push({ text: `Check bij ${f.delegatedTo || 'de ander'}: ${f.title}`, kind: 'followup' });
  }
  return {
    items: items.slice(0, 3),
    empty: items.length === 0,
    hint: items.length === 0
      ? 'Nog geen prioriteiten. Kies er hooguit drie — de rest mag wachten.'
      : null,
  };
}

// ── Wanneer kijken we hier weer naar? ───────────────────────────
function resolveReview({ coach, runGate, strength, logs, currentDate }) {
  const items = [];
  if (runGate?.earliestRunDate && runGate.earliestRunDate > currentDate) {
    items.push({ when: runGate.earliestRunDate, what: 'eerstvolgende loopmoment' });
  }
  const lastRun = runGate?.load?.lastRunDate;
  if (lastRun) {
    const due = addDays(lastRun, 1);
    if (due >= currentDate && !logs?.[due]?.recovery_check) {
      items.push({ when: due, what: 'herstelcheck na je laatste run' });
    }
  }
  if (strength?.lastSession?.date) {
    const due = addDays(strength.lastSession.date, 1);
    if (due >= currentDate && !logs?.[due]?.recovery_check) {
      items.push({ when: due, what: 'herstelcheck na je krachtsessie' });
    }
  }
  return { items: items.slice(0, 2) };
}

// ── Conflictuitleg voor progressive disclosure ──────────────────
// Wat wilden de losse coaches, en waarom won deze?
export function explainConflicts(result) {
  const { claims } = result.detail;
  const winner = result.action.source;
  return claims.map(c => ({
    coach: { run: 'Hardloopcoach', strength: 'Strength Coach',
      leverage: 'Doelen-coach', protect: 'Autonomie' }[c.id] || c.id,
    wanted: c.wants,
    outcome: c.id === winner ? 'gekozen'
      : c.blocked ? 'geblokkeerd' : 'verschoven',
    reason: c.reason || (c.id === winner ? 'hoogste opbrengst binnen je capaciteit vandaag'
      : 'een andere keuze levert vandaag meer op'),
  }));
}
