import React, { useState } from 'react';
import { USER } from '../config';
import { RUNS } from '../data/runningSchema';
import { lastRunWorkout, workoutWasHeavy, toleranceFor, workoutsForSession } from '../workouts';

// ─── helpers ────────────────────────────────────────────────────────────────

function prevDate(dateStr, n = 1) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function avg(arr) {
  const v = arr.filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Volgende logische sessie: hoogste gedane + 1 (niet "eerste gat" — wie
// midden in het schema instapt, hoeft niet terug naar T1)
function getNextRunNr(logs) {
  const doneNrs = Object.values(logs || {})
    .filter(l => l.run_done && l.run_session)
    .map(l => Number(l.run_session));
  if (!doneNrs.length) return 1;
  return Math.min(RUNS.length, Math.max(...doneNrs) + 1);
}

// ─── HEAD COACH decision engine ─────────────────────────────────────────────
// Returns { decision, color, bg, borderColor, trainingDesc, why[], sessionLabel }
// decision: 'GREEN' | 'AMBER' | 'BLUE' | 'RED'

export function computeHeadCoach(log, logs, currentDate) {
  const yest  = logs?.[prevDate(currentDate, 1)] ?? {};
  const d2    = logs?.[prevDate(currentDate, 2)] ?? {};
  const d3    = logs?.[prevDate(currentDate, 3)] ?? {};

  // ── raw signals ──────────────────────────────────────────────────────────

  // Sleep: quality 0-3 (0=bad, 3=great), hours float
  const sleepQ   = log?.sleep_quality;      // 0-3
  const sleepH   = log?.sleep_hours;
  const avgSleepH = avg([sleepH, yest.sleep_hours, d2.sleep_hours].filter(Boolean));

  // Energy: 0-3
  const energy   = log?.energy;

  // Recovery feeling: 0=goed, 1=matig, 2=PEM-achtig  ← BUG FIX (was string)
  const recovToday = log?.training_recovery;
  const recovYest  = yest?.training_recovery;
  const recovD2    = d2?.training_recovery;

  const pemToday = recovToday === 2 || log?.symptom_pem;
  const pemYest  = recovYest  === 2 || yest?.symptom_pem;
  const pemD2    = recovD2    === 2 || d2?.symptom_pem;

  // Symptoms (boolean fields)
  const symptomCount = [
    log?.symptom_pem, log?.symptom_exhaustion, log?.symptom_breathless,
    log?.symptom_brainfog, log?.symptom_pain,
  ].filter(Boolean).length;

  // Battery: battery_start (0-100)  ← BUG FIX (was log?.battery)
  const battStart = log?.battery_start;
  const battLow   = battStart != null && battStart <= 30;

  // Stress: low_stress is a habit boolean (1=stress laag, falsy=stress hoog)
  const stressHigh = log?.low_stress === 0 || log?.low_stress === false;
  const overwhelmed = log?.adhd_overwhelmed;

  // Delayed response: today's symptoms after yesterday's training
  const yestTrained = yest?.run_done || yest?.core_done || (yest?.training_zone && yest?.training_zone !== 'rust');
  const delayedBad  = yestTrained && (
    log?.delayed_fatigue || log?.delayed_brainfog || log?.delayed_breathless ||
    symptomCount >= 2
  );

  // Training load last 4 days
  const recentTrainDays = [log, yest, d2, d3].filter(l =>
    l?.run_done || l?.core_done || (l?.training_zone && l?.training_zone !== 'rust')
  ).length;

  // Zone C overtraining
  const zoneC2 = yest?.training_zone === 'C' && d2?.training_zone === 'C';

  // ── scoring (0-10 scale) ──────────────────────────────────────────────────
  // Start at 5, adjust based on signals
  let score = 5;

  if (sleepQ != null)  score += (sleepQ - 1.5) * 1.0;   // 0→-1.5, 3→+1.5
  if (energy  != null) score += (energy  - 1.5) * 1.0;

  if (recovToday === 2) score -= 4;
  else if (recovToday === 1) score -= 1.5;

  score -= symptomCount * 1.2;
  if (battLow) score -= 1;
  if (stressHigh) score -= 0.5;
  if (delayedBad) score -= 2.5;
  if (recentTrainDays >= 3) score -= 1;
  if (zoneC2) score -= 2;

  // ── safety layer (RED) ────────────────────────────────────────────────────
  const hardRed = pemToday || pemYest || symptomCount >= 3 || zoneC2 ||
    (sleepH != null && sleepH < 4.5);

  // ── decision ─────────────────────────────────────────────────────────────
  let decision;
  if (hardRed)       decision = 'RED';
  else if (score <= 1.5) decision = 'BLUE';
  else if (score <= 3.5) decision = 'AMBER';
  else                   decision = 'GREEN';

  // Day capacity override (user explicitly set the day type)
  const dayCapacity = log?.day_capacity;
  if (dayCapacity === 'herstel' && decision === 'GREEN') decision = 'BLUE';
  if (dayCapacity === 'herstel' && decision === 'AMBER') decision = 'BLUE';
  if (dayCapacity === 'minimum' && decision === 'GREEN') decision = 'AMBER';

  // ── training recommendation ───────────────────────────────────────────────
  const nextNr  = getNextRunNr(logs);
  const nextRun = RUNS.find(r => r.nr === nextNr) || RUNS[RUNS.length - 1];

  let trainingDesc, sessionLabel;

  if (decision === 'GREEN') {
    sessionLabel = `Training T${nextNr}/35`;
    trainingDesc = nextRun
      ? `${nextRun.description} — ${nextRun.duration} min | ${nextRun.hrZone}`
      : 'Geplande loopsessie — Zone B strikt';
  } else if (decision === 'AMBER') {
    sessionLabel = 'Aangepaste sessie';
    trainingDesc = nextRun
      ? `Korter: ${Math.round((nextRun.runMin || 1) * 0.7)} min lopen / ${nextRun.walkMin || 2} min wandelen × ${Math.max(3, Math.round((nextRun.reps || 5) * 0.7))} — ${nextRun.hrZone}`
      : 'Lichte wandeling 20-30 min — geen hardlopen';
  } else if (decision === 'BLUE') {
    sessionLabel = 'Hersteldag';
    trainingDesc = 'Wandelen 15–30 min rustig tempo + 5 min foam roll/stretching. Geen cardio of kracht.';
  } else {
    sessionLabel = 'Stop & Review';
    trainingDesc = 'Vandaag geen training. Rust, hydrateer goed, observeer symptomen. Neem contact op met arts bij verslechtering.';
  }

  // ── why bullets (2-4 signals) ─────────────────────────────────────────────
  const why = [];

  if (dayCapacity === 'herstel') why.unshift('Hersteldag ingesteld — rust heeft voorrang boven elke training');
  if (dayCapacity === 'minimum') why.unshift('Minimum dag — basisroutine is het doel, training is secundair');
  if (dayCapacity === 'hoog')    why.push('Hoge capaciteitsdag — goed moment voor de geplande training');

  if (pemToday)   why.push('PEM-achtig herstel vandaag gerapporteerd — hoogste prioriteit voor rust');
  if (pemYest)    why.push('Gisteren PEM-signalen — zenuwstelsel heeft 48u herstel nodig');
  if (pemD2 && !pemYest) why.push('PEM-signalen twee dagen geleden — vandaag voorzichtig opbouwen');
  if (delayedBad) why.push('Vertraagde klachten na gisteren training — tolerantie onvoldoende voor progressie');
  if (symptomCount >= 2) why.push(`${symptomCount} actieve symptomen — herstel vóór training`);
  if (zoneC2)     why.push('Twee opeenvolgende zone-C sessies — PEM-risico is hoog');
  if (sleepH != null && sleepH < 5.5) why.push(`Slaap ${sleepH}u — te weinig voor goede adaptatie`);
  if (avgSleepH != null && avgSleepH < 6.5 && sleepH >= 5.5) why.push(`Gemiddeld slaaptekort (${avgSleepH.toFixed(1)}u) — draagt bij aan verlaagde belastbaarheid`);
  if (energy === 0) why.push('Energie op 0 — vandaag is herstel de prestatie');
  if (energy === 1 && decision !== 'RED') why.push('Lage energie — lichtere sessie is verstandiger');
  if (energy >= 3 && decision === 'GREEN') why.push('Energie goed — goed moment om de geplande sessie te pakken');
  if (recentTrainDays >= 3) why.push(`${recentTrainDays} trainingsdagen in 4 dagen — even rustiger voor long-covid herstel`);
  if (battLow) why.push(`Batterijstand laag (${battStart}%) — signaal dat het systeem op is`);
  if (recovToday === 0 && decision === 'GREEN') why.push('Herstelgevoel goed — lichaam is klaar voor de geplande prikkel');
  if (recovToday === 1) why.push('Matig herstelgevoel — voorzichtig met intensiteit');

  // Guarantee 1-4 bullets
  if (why.length === 0) {
    if (decision === 'GREEN') why.push('Geen rode vlaggen — alle signalen wijzen richting trainen');
    else if (decision === 'AMBER') why.push('Gemengde signalen — lichtere variant is de veiligste keuze');
    else why.push('Herstel heeft vandaag prioriteit boven training');
  }
  // (whyFinal wordt ná het workout-blok bepaald zodat die signalen meetellen)

  // ── adaptive training state ──────────────────────────────────────────────
  // BUILD: ready to progress · HOLD: repeat current · REPEAT: redo last
  // DELOAD: reduce intensity · SWAP: change modality · TEST: re-entry check
  let adaptiveState = 'BUILD';

  const lastRunDone = Object.values(logs || {})
    .filter(l => l.run_done && l.run_session)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const sessionsSinceRest = [yest, d2, d3].filter(l => l?.run_done || l?.core_done).length;
  const recentAvgEnergy   = avg([yest?.energy, d2?.energy].filter(x => x != null));
  const recentPem         = pemYest || (log?.symptom_pem && d2?.symptom_pem);
  const highLoad          = recentTrainDays >= 3;

  if (decision === 'RED') {
    adaptiveState = 'DELOAD';
  } else if (decision === 'BLUE') {
    adaptiveState = recentPem ? 'DELOAD' : 'SWAP';
  } else if (decision === 'AMBER') {
    adaptiveState = (delayedBad || highLoad) ? (delayedBad ? 'REPEAT' : 'HOLD') : 'HOLD';
  } else {
    // GREEN
    adaptiveState = sessionsSinceRest >= 3 ? 'DELOAD' : 'BUILD';
  }

  // TEST state: long gap + green
  const daysSinceLastRun = lastRunDone
    ? Math.floor((new Date(currentDate) - new Date(lastRunDone.date)) / 86400000)
    : 999;
  if (decision === 'GREEN' && daysSinceLastRun >= 5 && !highLoad) {
    adaptiveState = 'TEST';
  }

  // ── WorkoutResult-signalen: echte trainingsdata stuurt de volgende beslissing ──
  // Bron-onafhankelijk (handmatig / screenshot / Strava).
  let pendingRecoveryCheck = false;
  let gateReason = null;
  const lastW = lastRunWorkout(currentDate);
  const lastWDays = lastW ? Math.floor((new Date(currentDate) - new Date(lastW.date)) / 86400000) : null;

  if (lastW && lastWDays != null && lastWDays <= 2) {
    const heavy = workoutWasHeavy(lastW);
    const tol = toleranceFor(lastW, logs);
    const todayRecovery = log?.recovery_check; // 'good' | 'bad' — ochtend-herstelcheck
    // Expliciet beantwoord op enige dag ná de workout?
    const checkAnswered = (() => {
      const d = new Date(lastW.date + 'T12:00:00');
      for (let i = 1; i <= 2; i++) {
        d.setDate(d.getDate() + 1);
        const l = logs?.[d.toISOString().slice(0, 10)];
        if (l && (l.recovery_check === 'good' || l.recovery_check === 'bad')) return l.recovery_check;
      }
      return null;
    })();

    if (tol === 'poor' || todayRecovery === 'bad') {
      // Slecht verdragen → nooit doorbouwen, ook niet bij groene ochtend
      if (adaptiveState === 'BUILD' || adaptiveState === 'TEST' || adaptiveState === 'HOLD') {
        adaptiveState = recentPem || log?.symptom_pem ? 'DELOAD' : 'REPEAT';
      }
      gateReason = `Je training van ${lastW.date.slice(5)} werd niet goed verdragen (vertraagde respons) — die sessie telt als onvoldoende verdragen, dus geen opbouw nu.`;
      why.push('Vorige training werd niet goed verdragen (vertraagde respons) — geen opbouw nu');
    } else if (heavy) {
      // Hoge RPE / zware benen / "nee" op meer gekund / gestopt → niet automatisch verder
      if (adaptiveState === 'BUILD' || adaptiveState === 'TEST') {
        adaptiveState = lastW.completedAsPlanned === 'stopped' ? 'DELOAD' : 'HOLD';
      }
      const signals = [
        lastW.rpe != null && lastW.rpe >= 7 ? `RPE ${lastW.rpe}` : null,
        lastW.legs === 'zwaar' ? 'zware benen' : null,
        lastW.couldDoMore === 'nee' ? 'geen reserve' : null,
        lastW.completedAsPlanned === 'stopped' ? 'gestopt' : null,
      ].filter(Boolean).join(', ');
      gateReason = `Je laatste sessie was zwaar (${signals}) — ook al is je ochtend groen, ik bouw niet automatisch verder.`;
      why.push(`Laatste sessie was zwaar (${signals}) — eerst laten landen`);
    } else if (lastWDays >= 1 && tol !== 'poor' && !checkAnswered) {
      // Herstelcheck nog niet expliciet beantwoord → sessie nog niet vrijgeven
      if (adaptiveState === 'BUILD') {
        adaptiveState = 'HOLD';
        pendingRecoveryCheck = true;
        gateReason = 'Herstelcheck na je laatste training nog niet ingevuld — vul die eerst in, dan geef ik de volgende sessie vrij.';
        why.push('Herstelcheck na je laatste training nog niet ingevuld — vul die eerst in, dan geef ik de volgende sessie vrij');
      }
    } else if (todayRecovery === 'good' && tol !== 'poor' && !heavy &&
               (decision === 'GREEN' || decision === 'AMBER') && adaptiveState === 'HOLD' && !delayedBad) {
      // Expliciet goed hersteld → vrijgeven
      adaptiveState = decision === 'GREEN' ? 'BUILD' : adaptiveState;
    }

    // Progressie-signaal: zelfde sessie 2× goed verdragen met lagere HR/RPE
    if (adaptiveState === 'BUILD' && lastW.plannedSessionId) {
      const sameSession = workoutsForSession(lastW.plannedSessionId)
        .filter(w => toleranceFor(w, logs) === 'good');
      if (sameSession.length >= 2) {
        const [b, a] = sameSession; // nieuwste eerst
        const lowerLoad = (b.averageHR != null && a.averageHR != null && b.averageHR <= a.averageHR) ||
                          (b.rpe != null && a.rpe != null && b.rpe <= a.rpe);
        if (lowerLoad) why.push('Zelfde sessie twee keer goed verdragen met lagere belasting — klaar voor de volgende stap');
      }
    }
  }

  const whyFinal = why.slice(0, 4);

  const ADAPTIVE_META = {
    BUILD:  { emoji: '📈', label: 'Bouwen',      desc: 'Je bent klaar voor de volgende sessie in het schema.' },
    HOLD:   { emoji: '⏸',  label: 'Houd tempo',  desc: 'Herhaal de huidige sessie — lichaam is nog niet klaar om te stappen.' },
    REPEAT: { emoji: '🔄', label: 'Herhalen',    desc: 'Doe de vorige sessie opnieuw — de vorige keer was te zwaar.' },
    DELOAD: { emoji: '📉', label: 'Terugschalen', desc: 'Vermoeidheid vraagt een stap terug — dit is goed herstelbeleid.' },
    SWAP:   { emoji: '🔀', label: 'Wissel sport', desc: 'Hardlopen is nu te veel — wandel of zwem vandaag als alternatief.' },
    TEST:   { emoji: '🧪', label: 'Test sessie',  desc: 'Je bent lang uit geweest — test belastbaarheid voorzichtig opnieuw.' },
  };

  // ── colors ────────────────────────────────────────────────────────────────
  const COLORS = {
    GREEN: { color: '#2A7A4F', bg: '#E0F0E8', border: '#2A7A4F', emoji: '🟢', label: 'GROEN — TRAIN' },
    AMBER: { color: '#B5831A', bg: '#FBF0DC', border: '#B5831A', emoji: '🟡', label: 'AMBER — AANPASSEN' },
    BLUE:  { color: '#2563AB', bg: '#E0EEFF', border: '#2563AB', emoji: '🔵', label: 'BLAUW — HERSTEL' },
    RED:   { color: '#C4622D', bg: '#FBE9E0', border: '#C4622D', emoji: '🔴', label: 'ROOD — STOP & REVIEW' },
  };
  const c = COLORS[decision];

  return {
    decision, trainingDesc, sessionLabel, why: whyFinal, ...c,
    score: Math.round(score * 10) / 10,
    adaptiveState,
    adaptive: ADAPTIVE_META[adaptiveState],
    pendingRecoveryCheck,
    gateReason,
    lastWorkout: lastW || null,
  };
}

// ─── Adaptieve sessiekeuze ──────────────────────────────────────────────────
// De volgende sessie is NIET simpelweg N+1: de adaptieve state bepaalt wat er komt.
// BUILD → volgende in bibliotheek · HOLD/REPEAT → laatste sessie opnieuw
// DELOAD → 2 stappen terug · TEST → 1 stap onder laatste niveau · SWAP → geen hardlopen
export function computeNextSession(log, logs, currentDate) {
  const coach = computeHeadCoach(log, logs, currentDate);
  const state = coach.adaptiveState || 'BUILD';

  const lastDone = Object.values(logs || {})
    .filter(l => l.run_done && l.run_session)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastNr = lastDone ? Number(lastDone.run_session) : 0;
  const nextNr = getNextRunNr(logs);

  let nr, note;
  switch (state) {
    case 'HOLD':
      nr = lastNr || nextNr;
      note = coach.pendingRecoveryCheck
        ? 'Vul eerst je herstelcheck in (hoe reageerde je lichaam op de vorige training?) — daarna geef ik de volgende sessie vrij.'
        : 'Zelfde niveau als je laatste sessie — bewust niet opbouwen vandaag.';
      break;
    case 'REPEAT':
      nr = lastNr || nextNr;
      note = 'Herhaal de vorige sessie — de vorige keer was (net) te zwaar.';
      break;
    case 'DELOAD':
      nr = Math.max(1, (lastNr || nextNr) - 2);
      note = 'Twee stappen terug in het schema — bewust lichter, dit is goed herstelbeleid.';
      break;
    case 'TEST':
      nr = Math.max(1, (lastNr || 2) - 1);
      note = 'Testsessie na een pauze: één stap onder je laatste niveau. Stop direct bij signalen.';
      break;
    case 'SWAP':
      return {
        state, nr: null, run: null, adaptive: coach.adaptive,
        note: 'Vandaag geen hardlopen — wandel 20–30 min rustig of zwem als alternatief.',
      };
    case 'BUILD':
    default:
      nr = nextNr;
      note = 'Je bent klaar voor de volgende stap in de opbouw.';
  }
  nr = Math.min(RUNS.length, Math.max(1, nr));
  return {
    state, nr, run: RUNS[nr - 1], adaptive: coach.adaptive, note,
    pendingRecoveryCheck: !!coach.pendingRecoveryCheck,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CoachAdvice({ log, logs, currentDate }) {
  const [showDetails, setShowDetails] = useState(false);

  const date = currentDate || new Date().toISOString().slice(0, 10);

  // Only show after minimal data is entered
  const hasData = log?.sleep_quality != null || log?.energy != null ||
    log?.training_recovery != null || log?.battery_start != null ||
    Object.values(logs || {}).some(l => l.run_done || l.core_done);

  if (!hasData) {
    return (
      <div style={{
        margin: '0 0 10px', padding: '12px 14px',
        borderLeft: '4px solid #2A7A4F', background: '#E0F0E820',
        borderRadius: 4, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5,
      }}>
        <strong style={{ color: '#2A7A4F', display: 'block', marginBottom: 4 }}>Head Coach</strong>
        Vul slaap en energie in — dan geef ik je een concreet coachbesluit voor vandaag.
      </div>
    );
  }

  const result = computeHeadCoach(log, logs, date);
  const { decision, trainingDesc, sessionLabel, why, color, bg, border, emoji, label } = result;

  return (
    <div style={{
      marginBottom: 12, borderRadius: 10, overflow: 'hidden',
      border: `2px solid ${border}`,
      background: bg + 'cc',
    }}>
      {/* Decision header */}
      <div style={{
        padding: '11px 14px 10px',
        background: color + '22',
        borderBottom: `1px solid ${border}33`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color, letterSpacing: 0.3 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{sessionLabel}</div>
        </div>
      </div>

      {/* Training prescription */}
      <div style={{ padding: '10px 14px 6px' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, fontWeight: 500 }}>
          {trainingDesc}
        </div>
      </div>

      {/* Why bullets */}
      <div style={{ padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>Waarom</div>
        {why.map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: 'var(--text)', lineHeight: 1.4 }}>
            <span style={{ color, flexShrink: 0, marginTop: 1 }}>·</span>
            <span>{w}</span>
          </div>
        ))}
      </div>

      {/* Toggle extra context */}
      <div
        onClick={() => setShowDetails(v => !v)}
        style={{ padding: '6px 14px', fontSize: 10, color: 'var(--muted)', cursor: 'pointer', borderTop: `1px solid ${border}22`, display: 'flex', justifyContent: 'space-between' }}
      >
        <span>Op basis van: slaap, energie, herstel, symptomen, recente belasting</span>
        <span>{showDetails ? '▲' : '▼'}</span>
      </div>

      {showDetails && (
        <div style={{ padding: '8px 14px 10px', fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6, borderTop: `1px solid ${border}22` }}>
          <div>Slaap: {log?.sleep_quality != null ? ['Slecht','Matig','Goed','Top'][log.sleep_quality] : '–'}{log?.sleep_hours ? ` (${log.sleep_hours}u)` : ''}</div>
          <div>Energie: {log?.energy != null ? ['Leeg','Laag','Goed','Hoog'][log.energy] : '–'}</div>
          <div>Herstelgevoel: {log?.training_recovery != null ? ['Goed','Matig','PEM-achtig'][log.training_recovery] : '–'}</div>
          <div>Actieve symptomen: {[log?.symptom_pem,log?.symptom_exhaustion,log?.symptom_breathless,log?.symptom_brainfog,log?.symptom_pain].filter(Boolean).length}</div>
          <div>Batterijstart: {log?.battery_start != null ? `${log.battery_start}%` : '–'}</div>
          {log?.delayed_fatigue || log?.delayed_brainfog || log?.delayed_breathless
            ? <div style={{ color: '#C4622D', fontWeight: 700 }}>⚠ Vertraagde klachten na gisteren gemeld</div>
            : null}
        </div>
      )}
    </div>
  );
}
