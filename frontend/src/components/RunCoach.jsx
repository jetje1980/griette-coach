import React, { useMemo, useState } from 'react';
import { planNextSession } from '../raceplan';
import { restDayDecision } from '../restday';
import { recoveryBudget, budgetLine } from '../recoveryBudget';
import { activeRunGoals } from '../runGoalModel';
import {
  allRunGoalStatuses, sessionSupport, whyNotMore, whatThisProves,
  STATUS_META, LOW_CONFIDENCE_NOTE,
} from '../runGoalStatus';
import { sessionMath, fmtPaceSec, paceToSec, fmtSec } from '../sessionMath';
import { hrPrescription } from '../hrModel';
import { easyRunPace } from '../easyPace';
import { todayLocal } from '../datetime';
import RunGoalEditor from './RunGoalEditor';

// De hardloopcoach — één sessie, gekozen door de engine.
//
// Wat hier NIET meer staat: de oude plankop met een sessieteller en een
// verplichte volgorde van genummerde trainingen. Die
// suggereerde dat training zes automatisch na vijf komt, en dat is al een tijd
// niet meer waar. De sessie van vandaag komt uit planNextSession(), die kijkt
// naar de poort, je herstel, de fase waarin je zit en welk doel er speelt.
//
// De nummers bestaan intern nog als sjabloon voor de terugval. Ze zijn geen
// volgorde en horen daarom niet op het scherm.

const TONE = { good: 'var(--sage)', warn: 'var(--gold)', bad: 'var(--rust)', neutral: 'var(--ghost)' };

const PURPOSE_LABEL = {
  RECOVERY: 'Herstel',
  EASY_ECONOMY: 'Easy economy',
  DURABILITY: 'Duurvermogen',
  QUALITY_LITE: 'Quality-lite',
  FIVE_K_SPECIFIC: '5 km-specifiek',
  TEN_K_SPECIFIC: '10 km-specifiek',
  TAPER: 'Taper',
};

const LEVEL_TONE = { HIGH: 'good', MEDIUM: 'warn', LOW: 'neutral' };

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 6px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

function Chip({ children, tone = 'neutral' }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
      color: TONE[tone], border: `1px solid ${TONE[tone]}`, borderRadius: 99,
      padding: '1.5px 7px', whiteSpace: 'nowrap' }}>{children}</span>
  );
}

// Eén regel: label links, waarde rechts, cijfers uitgelijnd.
function Row({ k, v, sub }) {
  if (v == null || v === '') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '5px 0',
      borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', flex: 1, minWidth: 0 }}>{k}</div>
      <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        textAlign: 'right' }}>
        {v}
        {sub && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--ghost)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── De sessie van vandaag ───────────────────────────────────────
function NextSession({ plan, budget, statuses, limiter, easy }) {
  const [why, setWhy] = useState(false);
  const run = plan?.run;

  if (!run) {
    return (
      <div className="os-card" style={{ borderLeft: '4px solid var(--gold)', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Volgende looptraining
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-serif)',
          marginBottom: 4 }}>
          Vandaag geen loopsessie
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.55 }}>
          {plan?.why || plan?.reason || budgetLine(budget)}
        </div>
      </div>
    );
  }

  // De afstand komt uit sessionMath, met het tempo dat de planner voorschrijft.
  const math = plan.targetPace ? sessionMath({
    runMin: run.runMin, walkMin: run.walkMin, reps: run.reps, duration: run.duration,
    runPace: plan.targetPace, walkPace: plan.walkPace || null,
  }) : null;

  const steun = sessionSupport(plan.purpose, statuses);
  const nietMeer = whyNotMore({ plan, budget, limiter, statuses });
  const bewijs = whatThisProves({ plan, limiter, statuses });

  return (
    <div className="os-card" style={{ borderLeft: '4px solid var(--sage)', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Volgende looptraining
        </div>
        <Chip tone="good">{PURPOSE_LABEL[plan.purpose] || plan.purpose}</Chip>
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-serif)',
        lineHeight: 1.2, marginBottom: 8 }}>
        {run.description}
      </div>

      <Row k="Looptempo" v={plan.targetPace ? `${fmtPaceSec(paceToSec(plan.targetPace))}/km` : '—'}
        sub={plan.paceSource ? bronTekst(plan.paceSource, easy) : null} />
      <Row k="Wandeltempo"
        v={plan.walkPace ? `${fmtPaceSec(paceToSec(plan.walkPace))}/km` : 'rustig, langzamer dan je loopblok'} />
      <Row k="Hartslag" v={plan.hrZone} />
      <Row k="Duur" v={`${run.duration} min`} />
      <Row k="Verwachte loopminuten" v={math ? `${Math.round(math.runMinutes)} min` : null} />
      <Row k="Verwachte loopafstand" v={math?.runKm ? `${math.runKm.toFixed(1)} km` : null} />
      <Row k="Verwachte totale afstand" v={math?.km ? `${math.km.toFixed(1)} km` : null} />
      <Row k="Hefboom" v={(plan.levers || []).join(' · ') || 'niveau vasthouden'} />
      {/* RPE alleen als je hem werkelijk hebt ingevuld — een verwachte
          inspanning verzinnen zegt niets. */}
      <Row k="Verwachte RPE" v={easy?.avgRpe != null ? `~${easy.avgRpe}` : null}
        sub={easy?.avgRpe != null ? 'gemiddelde van je eigen sessies op dit tempo' : null} />

      {bewijs && (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--border)',
          borderRadius: 8, padding: '9px 11px', marginTop: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
            letterSpacing: '0.4px', marginBottom: 3 }}>
            WAT MOET DEZE TRAINING BEWIJZEN?
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.55 }}>{bewijs}</div>
          <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 4 }}>
            Progressie gaat niet vanzelf: hij hangt aan je herstelcheck van 24 tot 48 uur later.
          </div>
        </div>
      )}

      {steun.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
            letterSpacing: '0.4px', marginBottom: 5 }}>DEZE TRAINING ONDERSTEUNT</div>
          {steun.slice(0, 4).map(s => (
            <div key={s.goalId} style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.label}{s.when ? ` · ${s.when}` : ''}
              </span>
              <Chip tone={LEVEL_TONE[s.level]}>{s.level}</Chip>
            </div>
          ))}
        </div>
      )}

      {nietMeer.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 10,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <strong style={{ color: 'var(--text)' }}>Waarom niet sneller of langer vandaag? </strong>
          {nietMeer.join(' ')}
        </div>
      )}

      <div onClick={() => setWhy(v => !v)}
        style={{ fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
        <span>Waarom deze training?</span><span>{why ? '▲' : '▼'}</span>
      </div>
      {why && (
        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6, marginTop: 4 }}>
          {plan.why || 'Geen aanvullende toelichting.'}
          {plan.proven && (
            <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 6 }}>
              Gebaseerd op je laatst goed verdragen structuur: {plan.proven.runMin}/{plan.proven.walkMin} × {plan.proven.reps}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Waar dit tempo vandaan komt — met het aantal sessies erbij.
//
// "uit je goed verdragen sessies" is te vaag om te kunnen wegen. Of er drie
// metingen onder liggen of tien maakt uit voor hoeveel je aan dit getal moet
// hechten, dus dat aantal hoort erbij te staan.
function bronTekst(source, easy) {
  const n = easy?.available ? easy.usable : null;
  const uitMeting = n
    ? `uit ${n} goed verdragen ${n === 1 ? 'sessie' : 'sessies'} met te scheiden loopblokken`
    : 'uit je goed verdragen sessies';
  const map = {
    measured: uitMeting,
    easy: uitMeting,
    capability: uitMeting,
    goal: 'uit je racedoel',
    race_goal: 'uit je racedoel',
    between: 'tussen easy en racetempo in',
    fallback: 'voorlopig, nog geen meting',
    schema: 'voorlopig, nog geen meting',
    unknown: 'nog geen gemeten easy tempo',
  };
  return map[source] || source;
}

// ── Eén doel op het dashboard ───────────────────────────────────
function GoalRow({ s, onEdit }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[s.status] || STATUS_META.NOT_ENOUGH_DATA;
  const laag = s.confidence === 'LOW' || s.confidence === 'NONE';

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6,
      borderLeft: `3px solid ${TONE[meta.tone]}` }}>
      <div onClick={() => setOpen(o => !o)} data-goal-row={s.goal.id}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 6,
            alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.goal.name}
            </span>
            <Chip>{s.goal.kindLabel}</Chip>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ghost)', fontVariantNumeric: 'tabular-nums' }}>
            {s.goal.distanceKm} km
            {s.goal.targetTimeLabel ? ` · ${s.goal.targetTimeLabel}` : ''}
            {s.goal.outcomeAvgHr ? ` · HR ≤ ${s.goal.outcomeAvgHr}` : ''}
            {s.goal.windowLabel ? ` · ${s.goal.windowLabel}` : ''}
          </div>
        </div>
        <Chip tone={meta.tone}>{meta.label}</Chip>
        <span style={{ color: 'var(--ghost)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <Row k="Huidige schatting" v={s.currentLabel || '—'} />
          <Row k="Zekerheid" v={s.confidence} />
          <Row k="Beperkende factor" v={s.limiter?.label} sub={s.limiter?.note} />
          <Row k="Afstandsdekking"
            v={s.coverage?.available ? `${s.coverage.pct}%` : '—'}
            sub={s.coverage?.available
              ? `${s.coverage.tolerated} km verdragen van ${s.goal.distanceKm} km` : null} />
          <Row k="Tempo bij gelijke hartslag" v={s.paceAtHr?.label || '—'} />
          <Row k="Langste goed verdragen" v={`${s.longestTolerated} km`} />
          {s.goal.criteria?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
                letterSpacing: '0.4px', marginBottom: 4 }}>WANNEER IS DIT GEHAALD?</div>
              {s.goal.criteria.map(c => (
                <div key={c.id} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
                  · {c.label}
                  {c.secondary && <span style={{ color: 'var(--ghost)' }}> (secundair)</span>}
                  {c.outcomeOnly && (
                    <div style={{ fontSize: 10.5, color: 'var(--ghost)', paddingLeft: 10 }}>
                      {c.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.55, marginTop: 8 }}>
            {s.reason}
          </div>

          {laag && (
            <div style={{ fontSize: 11, color: 'var(--gold)', lineHeight: 1.5, marginTop: 6,
              border: '1px solid var(--gold)', borderRadius: 6, padding: '6px 8px' }}>
              ⚡ {LOW_CONFIDENCE_NOTE}
            </div>
          )}

          {s.nextMilestone && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
                letterSpacing: '0.4px', marginBottom: 3 }}>VOLGENDE TUSSENSTAP</div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.nextMilestone.label}</div>
              <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
                {s.nextMilestone.why}
              </div>
            </div>
          )}

          <button className="os-toggle-chip" style={{ fontSize: 11, marginTop: 10 }}
            onClick={() => onEdit(s.goal)}>Bewerken</button>
        </div>
      )}
    </div>
  );
}

// ── Het scherm ──────────────────────────────────────────────────
export default function RunCoach({ log = {}, logs = {}, currentDate = todayLocal() }) {
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(null);

  const { plan, budget, statuses, limiter, easy } = useMemo(() => {
    const runGate = restDayDecision({ log, logs, currentDate, coach: {} });
    const b = recoveryBudget({ log, logs, currentDate, runGate });
    const p = planNextSession({ log, logs, currentDate });
    const goals = activeRunGoals({ currentDate });
    const { rows, driving } = allRunGoalStatuses({ goals, logs, currentDate, budget: b });
    // Het gemeten easy-tempo: nodig om te tonen op hoeveel sessies het
    // voorgeschreven tempo rust, en wat je er zelf voor RPE bij gaf.
    const e = easyRunPace({ logs, currentDate });
    return { plan: p, budget: b, statuses: rows, limiter: driving?.limiter || null, easy: e };
  }, [log, logs, currentDate, tick]);

  return (
    <div>
      <NextSession plan={plan} budget={budget} statuses={statuses} limiter={limiter} easy={easy} />

      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55 }}>
          {budgetLine(budget)}
        </div>
      </div>

      <Label right={
        <button onClick={() => setEditing({})}
          style={{ background: 'none', border: 'none', color: 'var(--sage)', fontSize: 11,
            fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ doel</button>
      }>Mijn loopdoelen</Label>

      {statuses.length === 0 ? (
        <div className="os-card" style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
          Nog geen loopdoelen. Eén doel is genoeg om de coach richting te geven.
        </div>
      ) : statuses.map(s => (
        <GoalRow key={s.goal.id} s={s} onEdit={setEditing} />
      ))}

      {editing && (
        <RunGoalEditor goal={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setTick(t => t + 1); }} />
      )}
    </div>
  );
}
