import React, { useMemo, useState } from 'react';
import {
  assessAll, goalRelations, doMaintainDontPush, adjustmentSuggestions,
  nextMilestone, weeklyGoalReview, runLimiter, distanceCoverage,
  FEASIBILITY, FEASIBILITY_META, RELATION,
} from '../goalIntelligence';
import { saveGoal, saveMilestone, milestonesFor, SOURCE } from '../goalModel';
import { budgetLine } from '../recoveryBudget';
import { todayLocal } from '../datetime';

// Het doelendashboard — compact, en per doel het antwoord op één vraag:
// haal ik dit, en zo nee, wat houdt het tegen?
//
// Wat hier bewust NIET staat: rekenwerk. Geen formules, geen tussenstappen,
// geen technische onderbouwing in het normale zicht. Dat staat allemaal in
// goalIntelligence.js en is opvraagbaar, maar een dashboard dat zijn eigen
// wiskunde laat zien is een dashboard dat je moet interpreteren.

const TONE = {
  good:    'var(--sage)',
  warn:    'var(--gold)',
  bad:     'var(--rust)',
  neutral: 'var(--ghost)',
};

function Chip({ children, tone = 'neutral', title }) {
  return (
    <span title={title} style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
      color: TONE[tone], border: `1px solid ${TONE[tone]}`,
      borderRadius: 99, padding: '1.5px 7px', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Label({ children }) {
  return (
    <div className="os-section-label" style={{ marginTop: 16 }}>{children}</div>
  );
}

// ── Eén doel, dichtgeklapt ──────────────────────────────────────
function GoalRow({ a, budget, relations, onChange }) {
  const [open, setOpen] = useState(false);
  const meta = FEASIBILITY_META[a.feasibility] || FEASIBILITY_META.INSUFFICIENT_DATA;
  const guidance = open ? doMaintainDontPush(a, { budget, relations }) : null;
  const ms = a.milestones?.find(m => m.status === 'open');
  const rel = relations.filter(r => r.metrics?.includes(a.metric));

  const currentText = a.current == null ? '—'
    : typeof a.current === 'string' ? a.current
    : `${a.current} ${a.unit || ''}`.trim();
  const targetText = a.target == null ? '—'
    : typeof a.target === 'string' ? a.target
    : `${a.target} ${a.unit || ''}`.trim();

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6,
      borderLeft: `3px solid ${TONE[meta.tone]}` }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.label}
            </span>
            {a.kind === 'race' && <Chip tone="neutral">race</Chip>}
            {a.goal?.target_level === 'stretch' && <Chip tone="warn">stretch</Chip>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ghost)', fontVariantNumeric: 'tabular-nums' }}>
            {currentText} → {targetText}
            {a.weeks != null && a.weeks > 0 && ` · nog ${a.weeks} wk`}
          </div>
        </div>
        <Chip tone={meta.tone} title={a.reason}>{meta.emoji} {meta.label}</Chip>
        <span style={{ color: 'var(--ghost)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 10 }}>
            {a.reason}
          </div>

          {a.confidence && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 10 }}>
              Zekerheid van de meting: <strong>{a.confidence}</strong>
              {a.baseline?.note ? ` — ${a.baseline.note}` : ''}
            </div>
          )}

          {guidance && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {[['DO', guidance.do, 'var(--sage)'],
                ['HOUD VAST', guidance.maintain, 'var(--ghost)'],
                ['NIET FORCEREN', guidance.dontPush, 'var(--rust)']].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: c, letterSpacing: '0.4px',
                    minWidth: 74, flex: 'none' }}>{k}</span>
                  <span style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {ms && (
            <div style={{ background: 'var(--card)', border: '1px dashed var(--border)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
                letterSpacing: '0.4px', marginBottom: 3 }}>
                TUSSENSTAP VAN DE COACH — GEEN WIJZIGING VAN JE DOEL
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{ms.label}</div>
              <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 2 }}>
                {ms.rationale}
              </div>
            </div>
          )}

          {rel.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {rel.map((r, i) => (
                <div key={i} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5,
                  display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ flex: 'none' }}>
                    {r.relation === RELATION.SYNERGY ? '🤝'
                      : r.relation === RELATION.CONFLICT ? '⚠️' : '⚖️'}
                  </span>
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
          )}

          {a.kind === 'race' && a.readiness && (
            <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5 }}>
              Race readiness komt uit de hardloopengine: {a.readiness.label || a.readiness.level}
              {a.readiness.pct != null ? ` (${a.readiness.pct}%)` : ''}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Voorstellen ─────────────────────────────────────────────────
// De coach mag alles voorstellen en niets stilletjes doorvoeren. Elk voorstel
// heeft een knop; zonder die knop gebeurt er niets.
function Suggestions({ items, onApply }) {
  if (!items.length) return null;
  return (
    <>
      <Label>Voorstellen van de coach</Label>
      <div className="os-card">
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
          Deze doelen lopen niet op koers. Ik verander er niets aan — dat is aan jou.
        </div>
        {items.map((s, i) => (
          <div key={i} style={{ paddingBottom: 10, marginBottom: 10,
            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 6 }}>
              {s.rationale}
            </div>
            <button className="os-toggle-chip" style={{ fontSize: 11 }}
              onClick={() => onApply(s)}>Overnemen</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Het dashboard ───────────────────────────────────────────────
export default function GoalDashboard({ logs = {}, currentDate = todayLocal() }) {
  const [tick, setTick] = useState(0);
  const [showReview, setShowReview] = useState(false);

  const { all, races, generic, budget, state } = useMemo(
    () => assessAll({ logs, currentDate }), [logs, currentDate, tick]);
  const relations = useMemo(() => goalRelations(all), [all]);
  const suggestions = useMemo(() => adjustmentSuggestions(all, { currentDate }), [all, currentDate]);
  const review = useMemo(
    () => (showReview ? weeklyGoalReview({ logs, currentDate }) : null),
    [showReview, logs, currentDate, tick]);

  const primaryRace = races.find(r => r.goal?.raceGoal?.type !== 'STRETCH') || races[0] || null;
  const limiter = runLimiter({ state, budget,
    raceDistanceKm: primaryRace?.goal?.raceGoal?.distanceKm || null });
  const coverage = primaryRace
    ? distanceCoverage({ raceDistanceKm: primaryRace.goal.raceGoal.distanceKm, state })
    : null;

  function apply(s) {
    saveGoal({ id: s.goal_id, ...s.apply }, { by: SOURCE.USER });
    setTick(t => t + 1);
  }

  const offTrack = all.filter(a =>
    a.feasibility === FEASIBILITY.CURRENTLY_UNLIKELY ||
    a.feasibility === FEASIBILITY.NOT_SAFE_TO_CHASE).length;

  return (
    <div>
      {/* Wat de coach vandaag als beperkende factor ziet */}
      <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--sage)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Wat je doelen op dit moment tegenhoudt
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
          lineHeight: 1.25, marginBottom: 3 }}>
          {limiter.label}
        </div>
        {limiter.note && (
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{limiter.note}</div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {budgetLine(budget)}
        </div>
        {coverage?.available && (
          <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 4 }}>
            Afstandsdekking voor {primaryRace.label}: {coverage.pct}% — {coverage.note}
          </div>
        )}
      </div>

      {races.length > 0 && (<>
        <Label>Races</Label>
        {races.map(a => (
          <GoalRow key={a.goal.id} a={a} budget={budget} relations={relations}
            onChange={() => setTick(t => t + 1)} />
        ))}
      </>)}

      <Label>
        Mijn doelen{offTrack ? ` · ${offTrack} van koers` : ''}
      </Label>
      {generic.length === 0 ? (
        <div className="os-card" style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
          Nog geen doelen. Eén doel met een streefwaarde en een datum is genoeg om te beginnen.
        </div>
      ) : generic.map(a => (
        <GoalRow key={a.goal.id} a={a} budget={budget} relations={relations}
          onChange={() => setTick(t => t + 1)} />
      ))}

      <Suggestions items={suggestions} onApply={apply} />

      {/* Weekreview: bewust achter een klik. Niet elk doel elke dag. */}
      <div onClick={() => setShowReview(v => !v)}
        style={{ fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
        <span>Weekoverzicht van je doelen</span>
        <span>{showReview ? '▲' : '▼'}</span>
      </div>
      {showReview && review && (
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{review.summary}</div>
          {review.priorities.length > 0 ? (
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--sub)', lineHeight: 1.65 }}>
              {review.priorities.map((p, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <strong style={{ color: 'var(--text)' }}>{p.label}</strong>
                  <span style={{ color: 'var(--ghost)' }}> — {p.why}</span>
                  {p.action && <div style={{ marginTop: 2 }}>{p.action}</div>}
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
              Geen doel dat deze week aandacht vraagt. Dat is geen stilstand — het betekent dat
              de huidige aanpak mag doorlopen.
            </div>
          )}
          {review.missing.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 10,
              paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              Zonder meting, dus zonder oordeel: {review.missing.map(m => m.label).join(', ')}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
