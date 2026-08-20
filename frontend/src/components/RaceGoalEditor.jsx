import React, { useState, useMemo } from 'react';
import { loadRaceGoals, saveRaceGoal, deleteRaceGoal, resetRaceGoals,
  validateRaceGoal, previewGoal, GOAL_TYPES, GOAL_TYPE } from '../raceGoalModel';
import { raceFeasibility } from '../raceFeasibility';
import { todayLocal, addDays } from '../datetime';

// Racedoelen invoeren zoals je ze denkt: afstand, gewenste eindtijd, datum.
// Het tempo rekent de app uit. Jij hoeft nooit 35 door 5 te delen.

const VERDICT_COLOR = {
  ON_TRACK: 'var(--sage)', CLOSE: 'var(--sage)',
  AMBITIOUS: 'var(--gold)', OUT_OF_REACH: 'var(--rust)', UNKNOWN: 'var(--ghost)',
};

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ghost)',
        textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 3 }}>{hint}</div>}
    </label>
  );
}

function GoalForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(() => ({
    id: initial?.id || null,
    name: initial?.name || '',
    distanceKm: initial?.distanceKm ?? 5,
    targetTime: initial?.targetTimeLabel || '',
    date: initial?.date || addDays(todayLocal(), 90),
    type: initial?.type || 'TARGET',
    priority: initial?.priority ?? 3,
  }));
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  // Meteen doorrekenen terwijl je typt — dat is het hele punt.
  const preview = useMemo(() =>
    previewGoal({ distanceKm: f.distanceKm, targetTime: f.targetTime }),
    [f.distanceKm, f.targetTime]);

  const problems = preview
    ? validateRaceGoal({ ...f, targetTimeSec: preview.targetTimeSec })
    : [];

  return (
    <div className="os-card" style={{ marginBottom: 10 }}>
      <Field label="Naam">
        <input className="os-input" value={f.name} placeholder="Bijvoorbeeld: Bereloop"
          onChange={e => upd('name', e.target.value)} style={{ width: '100%' }} />
      </Field>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Field label="Afstand (km)">
          <input className="os-input-num" type="number" step="0.1" inputMode="decimal"
            value={f.distanceKm} onChange={e => upd('distanceKm', e.target.value)}
            style={{ width: 84 }} />
        </Field>
        <Field label="Gewenste tijd" hint="35:00 of 1:05:00">
          <input className="os-input" value={f.targetTime} placeholder="35:00"
            onChange={e => upd('targetTime', e.target.value)} style={{ width: 100 }} />
        </Field>
        <Field label="Datum">
          <input className="os-input" type="date" value={f.date}
            onChange={e => upd('date', e.target.value)} style={{ width: 150 }} />
        </Field>
      </div>

      {/* De uitkomst, live. Dit is wat je niet zelf hoeft te rekenen. */}
      <div style={{ background: 'var(--sage-bg, rgba(63,107,82,0.08))', padding: '10px 12px',
        borderRadius: 6, margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.5 }}>
        {preview ? (
          <>
            <strong style={{ fontSize: 17, fontFamily: 'var(--font-serif)' }}>
              {preview.targetPaceLabel}/km
            </strong>
            <div style={{ color: 'var(--sub)', fontSize: 11.5, marginTop: 2 }}>{preview.text}</div>
          </>
        ) : (
          <span style={{ color: 'var(--ghost)' }}>Vul afstand en gewenste tijd in.</span>
        )}
      </div>

      <Field label="Soort doel">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {GOAL_TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => upd('type', t.id)}
              style={{ fontSize: 11, fontWeight: f.type === t.id ? 700 : 500,
                padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${f.type === t.id ? 'var(--sage)' : 'var(--border)'}`,
                background: f.type === t.id ? 'var(--sage)' : 'transparent',
                color: f.type === t.id ? '#fff' : 'var(--sub)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: -6, marginBottom: 10,
        lineHeight: 1.45 }}>
        {GOAL_TYPE[f.type]?.meaning}
      </div>

      {problems.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--rust)', marginBottom: 10, lineHeight: 1.45 }}>
          {problems.map((p, i) => <div key={i}>{p.problem}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="os-btn-save" disabled={!preview || problems.length > 0}
          onClick={() => { saveRaceGoal(f); onSave?.(); }}
          style={{ flex: 1 }}>
          {f.id ? 'Opslaan' : 'Doel toevoegen'}
        </button>
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--ghost)',
            cursor: 'pointer', fontSize: 12 }}>
          annuleer
        </button>
      </div>
    </div>
  );
}

export default function RaceGoalEditor({ logs = {}, currentDate = todayLocal() }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);   // null | 'new' | goal
  const [tick, setTick] = useState(0);

  const goals = useMemo(() => loadRaceGoals(), [tick]);
  const feas = useMemo(() => goals
    .filter(g => g.enabled !== false && g.date >= currentDate)
    .map(g => raceFeasibility(g, { logs, currentDate })), [goals, logs, currentDate]);

  const refresh = () => { setEditing(null); setTick(t => t + 1); };

  return (
    <div>
      <div onClick={() => setOpen(v => !v)}
        style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', padding: '10px 0',
          display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
        <span>Racedoelen ({goals.length})</span><span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
            Vul afstand, gewenste eindtijd en datum in. Het tempo rekent de app uit —
            en je racetempo staat los van het rustige tempo waarop je nu traint.
          </div>

          {feas.map(f => (
            <div key={f.goal.id} className="os-card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{f.goal.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ghost)',
                  border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>
                  {GOAL_TYPE[f.goal.type]?.label || f.goal.type}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ghost)' }}>
                  {f.goal.date}
                </span>
              </div>

              <div style={{ fontSize: 13, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                <strong>{f.goal.distanceKm} km in {f.goal.targetTimeLabel}</strong>
                {' = '}
                <strong style={{ color: 'var(--sage)' }}>{f.goal.targetPaceLabel}/km</strong>
              </div>

              <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 6, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: VERDICT_COLOR[f.verdict] }}>
                  {f.label}.
                </span>{' '}{f.summary}
              </div>
              {f.detail && (
                <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 4, lineHeight: 1.45 }}>
                  {f.detail}
                </div>
              )}
              {f.advice && (
                <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 4, lineHeight: 1.45 }}>
                  {f.advice}
                </div>
              )}

              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                <button type="button" onClick={() => setEditing(f.goal)}
                  style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--sub)', cursor: 'pointer' }}>wijzig</button>
                <button type="button"
                  onClick={() => { saveRaceGoal({ id: f.goal.id, enabled: false }); refresh(); }}
                  style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--sub)', cursor: 'pointer' }}>op pauze</button>
                <button type="button"
                  onClick={() => { deleteRaceGoal(f.goal.id); refresh(); }}
                  style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--alert)', cursor: 'pointer' }}>verwijder</button>
              </div>
            </div>
          ))}

          {editing && (
            <GoalForm initial={editing === 'new' ? null : editing}
              onSave={refresh} onCancel={() => setEditing(null)} />
          )}

          {!editing && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="os-btn-save" onClick={() => setEditing('new')}
                style={{ fontSize: 12 }}>Doel toevoegen</button>
              <button onClick={() => { resetRaceGoals(); refresh(); }}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)',
                  cursor: 'pointer', fontSize: 11 }}>terug naar standaard</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
