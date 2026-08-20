import React, { useState } from 'react';
import {
  GOAL_DOMAINS, GOAL_METRICS, GOAL_PRIORITIES, metricInfo,
  loadGoals, saveGoal, deleteGoal, feasibilityCheck,
  loadHrSettings, saveHrSettings, HR_DEFAULT_VALUES,
} from '../goals';

// Alle doelen op één plek bewerkbaar. Coachlogica leest hieruit;
// er staan geen persoonlijke targets meer hardcoded in de code.

const VERDICT_STYLE = {
  'haalbaar':            { color: 'var(--green)', emoji: '✓' },
  'ambitieus':           { color: 'var(--gold)',  emoji: '⚡' },
  'nu niet verantwoord': { color: 'var(--rust)',  emoji: '⚠️' },
  'te kort':             { color: 'var(--rust)',  emoji: '⚠️' },
  'onbekend':            { color: 'var(--sub)',   emoji: '·' },
};

function GoalRow({ goal, logs, onChange }) {
  const [open, setOpen] = useState(false);
  const info = metricInfo(goal.domain, goal.metric);
  const check = open ? feasibilityCheck(goal, logs) : null;

  function upd(patch) { saveGoal({ id: goal.id, ...patch }); onChange(); }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{info.label}</div>
          {goal.target_date && (
            <div style={{ fontSize: 11, color: 'var(--ghost)' }}>streefdatum {goal.target_date}</div>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)' }}>
          {goal.target_value ?? '—'} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--sub)' }}>{info.unit}</span>
        </div>
        <span style={{ color: 'var(--ghost)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>
                Doel ({info.unit || 'waarde'})
              </div>
              <input className="os-input" defaultValue={goal.target_value ?? ''}
                onBlur={e => upd({ target_value: e.target.value === '' ? null : (isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value)) })} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Streefdatum</div>
              <input className="os-input" type="date" defaultValue={goal.target_date || ''}
                onBlur={e => upd({ target_date: e.target.value || null })} />
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 4 }}>Prioriteit</div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
            {GOAL_PRIORITIES.map(p => (
              <button key={p} className={`os-toggle-chip ${goal.priority === p ? 'active green' : ''}`}
                onClick={() => upd({ priority: p })} style={{ fontSize: 11 }}>{p}</button>
            ))}
          </div>

          <input className="os-input" placeholder="Notitie / strategie (optioneel)"
            defaultValue={goal.notes || ''} onBlur={e => upd({ notes: e.target.value })}
            style={{ marginBottom: 8 }} />

          {check && (
            <div style={{ background: 'var(--card)', border: `1px solid ${VERDICT_STYLE[check.verdict]?.color || 'var(--border)'}`,
              borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.4px', marginBottom: 3 }}>Haalbaarheidscheck</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: VERDICT_STYLE[check.verdict]?.color,
                marginBottom: 3 }}>
                {VERDICT_STYLE[check.verdict]?.emoji} {check.verdict}
              </div>
              <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{check.reason}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="os-toggle-chip" style={{ fontSize: 11 }}
              onClick={() => upd({ status: goal.status === 'active' ? 'paused' : 'active' })}>
              {goal.status === 'active' ? 'Pauzeer' : 'Activeer'}
            </button>
            <button className="os-toggle-chip" style={{ fontSize: 11, color: 'var(--rust)' }}
              onClick={() => { if (window.confirm('Dit doel verwijderen?')) { deleteGoal(goal.id); onChange(); } }}>
              🗑 Verwijder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoalSettings({ logs }) {
  const [goals, setGoals] = useState(loadGoals);
  const [domain, setDomain] = useState('RUN');
  const [adding, setAdding] = useState(false);
  const [hr, setHr] = useState(loadHrSettings);

  function refresh() { setGoals(loadGoals()); }

  function addGoal(metric) {
    const info = metricInfo(domain, metric);
    saveGoal({ domain, metric, unit: info.unit, target_value: null, priority: 'secondary' });
    setAdding(false);
    refresh();
  }

  function updHr(key, val) {
    const n = val === '' ? null : parseFloat(val);
    setHr(saveHrSettings({ [key]: n }));
  }

  const shown = goals.filter(g => g.domain === domain && g.status !== 'dropped');
  const available = (GOAL_METRICS[domain] || []).filter(m => !shown.some(g => g.metric === m.id));

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 12 }}>
        Alle doelen staan hier — de coach rekent hiermee. Wijzig je een doel, dan verandert het
        advies mee; de veiligheidsregels blijven altijd staan.
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {GOAL_DOMAINS.map(d => (
          <button key={d.id} className={`os-toggle-chip ${domain === d.id ? 'active green' : ''}`}
            onClick={() => { setDomain(d.id); setAdding(false); }} style={{ fontSize: 11.5 }}>
            {d.emoji} {d.label}
          </button>
        ))}
      </div>

      {shown.map(g => <GoalRow key={g.id} goal={g} logs={logs} onChange={refresh} />)}
      {shown.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ghost)', padding: '10px 0' }}>
          Nog geen doelen in dit domein.
        </div>
      )}

      {adding ? (
        <div className="os-card" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Welk doel?</div>
          {available.map(m => (
            <button key={m.id} className="os-toggle-chip" onClick={() => addGoal(m.id)}
              style={{ fontSize: 12, marginRight: 5, marginBottom: 5 }}>
              {m.label}{m.unit ? ` (${m.unit})` : ''}
            </button>
          ))}
          {available.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ghost)' }}>Alle doelen van dit domein bestaan al.</div>
          )}
          <div><button className="os-toggle-chip" style={{ fontSize: 11, marginTop: 8 }}
            onClick={() => setAdding(false)}>Annuleer</button></div>
        </div>
      ) : (
        <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 8 }}
          onClick={() => setAdding(true)}>+ Doel toevoegen</button>
      )}

      {/* Hartslag- en RPE-kaders */}
      {domain === 'RUN' && (
        <>
          <div className="os-section-label">Hartslag &amp; RPE-kaders</div>
          <div className="os-card">
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
              Je easy-band en je RPE-ankers. Wat op een gegeven dag werkelijk mag,
              komt niet hiervandaan maar uit je hartslagmodel — CPET-context,
              recente goed verdragen runs, en de respons van de vorige sessie.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { k: 'easyLow',     label: 'Easy HR onder',     unit: 'bpm' },
                { k: 'easyHigh',    label: 'Easy HR boven',     unit: 'bpm' },
                { k: 'resumeBelow', label: 'Hervatten onder',   unit: 'bpm' },
                { k: 'rpeEasy',     label: 'RPE easy',          unit: '/10' },
                { k: 'rpeThreshold', label: 'RPE grens',        unit: '/10' },
              ].map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>
                    {f.label} ({f.unit})
                  </div>
                  <input className="os-input" type="number" defaultValue={hr[f.k] ?? ''}
                    onBlur={e => updHr(f.k, e.target.value)} />
                </div>
              ))}
            </div>
            <button className="os-toggle-chip" style={{ fontSize: 11, marginTop: 10 }}
              onClick={() => setHr(saveHrSettings(HR_DEFAULT_VALUES))}>
              Terug naar standaard ({HR_DEFAULT_VALUES.easyLow}–{HR_DEFAULT_VALUES.easyHigh})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
