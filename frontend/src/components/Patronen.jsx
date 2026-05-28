import React, { useMemo } from 'react';
import { USER, HABITS } from '../config';

function ago(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function WeightChart({ logs }) {
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = ago(13 - i);
    return { d, v: logs[d]?.weight || null };
  });
  const valid = data.filter(p => p.v);
  if (valid.length < 2) return <div className="empty-state">Vul dagelijks gewicht in om grafiek te zien</div>;

  const W = 340, H = 80;
  const ys = valid.map(p => p.v);
  const mn = Math.min(...ys, USER.goalWeight) - 0.5;
  const mx = Math.max(...ys) + 0.5;
  const py = v => H - ((v - mn) / (mx - mn)) * H;
  const px = i => (data.indexOf(valid[i]) / (data.length - 1)) * W;

  const path = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ');

  // Goal line
  const goalY = py(USER.goalWeight);
  const lastX = px(valid.length - 1);

  const diff = (valid[valid.length - 1].v - valid[0].v).toFixed(1);

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Goal line */}
        <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="var(--gold)" strokeWidth="1" strokeDasharray="5" opacity="0.6" />
        <text x="2" y={goalY - 3} fontSize="9" fill="var(--gold)">doel {USER.goalWeight}</text>
        {/* Data line */}
        <path d={path} fill="none" stroke="var(--rust)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {valid.map((p, i) => (
          <g key={i}>
            <circle cx={px(i)} cy={py(p.v)} r="3" fill="var(--rust)" />
            <text x={px(i)} y={py(p.v) - 6} textAnchor="middle" fontSize="8" fill="var(--muted)">{p.v}</text>
          </g>
        ))}
      </svg>
      <div className="chart-label" style={{ color: diff < 0 ? 'var(--sage)' : 'var(--rust)' }}>
        {diff < 0 ? `↓ ${Math.abs(diff)} kg in 14 dagen` : `↑ ${diff} kg`}
      </div>
    </div>
  );
}

function BpChart({ logs }) {
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = ago(13 - i);
    return { d, s: logs[d]?.bp_sys || null, dv: logs[d]?.bp_dia || null };
  });
  const valid = data.filter(p => p.s);
  if (valid.length < 2) return <div className="empty-state">Meet dagelijks bloeddruk om grafiek te zien</div>;

  const W = 340, H = 80;
  const ss = valid.map(p => p.s), ds = valid.map(p => p.dv);
  const mn = Math.min(...ds) - 5, mx = Math.max(...ss) + 10;
  const py = v => H - ((v - mn) / (mx - mn)) * H;
  const px = i => (data.indexOf(valid[i]) / (data.length - 1)) * W;

  const pathS = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.s).toFixed(1)}`).join(' ');
  const pathD = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.dv).toFixed(1)}`).join(' ');

  const y160 = py(160), y140 = py(140);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {y160 >= 0 && y160 <= H && <line x1="0" y1={y160} x2={W} y2={y160} stroke="var(--alert)" strokeWidth="1" strokeDasharray="4" opacity="0.7" />}
      {y140 >= 0 && y140 <= H && <line x1="0" y1={y140} x2={W} y2={y140} stroke="var(--gold)" strokeWidth="1" strokeDasharray="4" opacity="0.6" />}
      <text x="2" y={Math.max(10, y160 - 3)} fontSize="8" fill="var(--alert)">160</text>
      <text x="2" y={Math.max(10, y140 - 3)} fontSize="8" fill="var(--gold)">140</text>
      <path d={pathS} fill="none" stroke="var(--alert)" strokeWidth="2" strokeLinecap="round" />
      <path d={pathD} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
      {valid.map((p, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(p.s)} r="2.5" fill="var(--alert)" />
          <circle cx={px(i)} cy={py(p.dv)} r="2.5" fill="var(--gold)" />
        </g>
      ))}
    </svg>
  );
}

function HabitBars({ logs }) {
  return (
    <div>
      {HABITS.map(h => {
        const score = Array.from({ length: 7 }, (_, i) => (logs[ago(6 - i)]?.[h.id] ? 1 : 0)).reduce((a, b) => a + b, 0);
        const color = score >= 5 ? 'var(--sage)' : score >= 3 ? 'var(--gold)' : 'var(--alert)';
        return (
          <div key={h.id} className="habit-bar-row">
            <div className="habit-bar-header">
              <span>{h.emoji} {h.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{score}/7</span>
            </div>
            <div className="habit-bar-bg">
              <div className="habit-bar-fill" style={{ width: `${(score / 7) * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Patronen({ logs }) {
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => logs[ago(6 - i)]).filter(Boolean), [logs]);

  const trainDays = last7.filter(l => l.run_done || l.core_done).length;
  const avgEnergy = last7.filter(l => l.energy != null).length > 0
    ? (last7.filter(l => l.energy != null).reduce((a, l) => a + l.energy, 0) / last7.filter(l => l.energy != null).length).toFixed(1)
    : null;

  const weights = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
  const latest = weights[0]?.weight;
  const toGoal = latest ? (latest - USER.goalWeight).toFixed(1) : null;

  return (
    <div className="pane">
      {/* Samenvatting */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">📊 Week overzicht</div>
        </div>
        <div className="card-body">
          <div className="stats-row">
            <span>Trainingsdagen (7d)</span>
            <span className="stats-value">{trainDays}/7</span>
          </div>
          <div className="stats-row">
            <span>Gem. energie</span>
            <span className="stats-value">{avgEnergy ?? '—'}/3</span>
          </div>
          {latest && (
            <div className="stats-row">
              <span>Huidig gewicht</span>
              <span className="stats-value">{latest} kg</span>
            </div>
          )}
          {toGoal && (
            <div className="stats-row">
              <span>Nog naar doel</span>
              <span className="stats-value" style={{ color: 'var(--rust)' }}>−{toGoal} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Gewicht grafiek */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">⚖️ Gewicht — 14 dagen</div>
        </div>
        <div className="card-body">
          <WeightChart logs={logs} />
        </div>
      </div>

      {/* BD grafiek */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--alert)' }} />
          <div className="card-title">❤️ Bloeddruk — 14 dagen</div>
        </div>
        <div className="card-body">
          <BpChart logs={logs} />
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--alert)' }}>——</span> systolisch &nbsp;
            <span style={{ color: 'var(--gold)' }}>——</span> diastolisch &nbsp;
            <span style={{ color: 'var(--alert)' }}>- - -</span> 160 &nbsp;
            <span style={{ color: 'var(--gold)' }}>- - -</span> 140
          </div>
        </div>
      </div>

      {/* Gewoonte percentages */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">✅ Gewoontes — afgelopen 7 dagen</div>
        </div>
        <div className="card-body">
          <HabitBars logs={logs} />
        </div>
      </div>

      {/* Inzichten */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💡 Inzichten</div>
        </div>
        <div className="card-body">
          {trainDays >= 4 && (
            <div style={{ padding: '10px 12px', background: 'var(--sage-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--sage)' }}>
              <strong style={{ fontSize: 12 }}>🏆 Consequent aan het trainen!</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{trainDays} trainingsdagen deze week. Geweldig.</div>
            </div>
          )}
          {trainDays === 0 && (
            <div style={{ padding: '10px 12px', background: 'var(--gold-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--gold)' }}>
              <strong style={{ fontSize: 12 }}>👟 Nog niet getraind deze week</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Één keer lopen of core doet al veel.</div>
            </div>
          )}
          {last7.length < 5 && (
            <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, borderLeft: '3px solid var(--muted)' }}>
              <strong style={{ fontSize: 12 }}>📊 Meer data = betere inzichten</strong>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Vul 5+ dagen in om patronen te zien.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
