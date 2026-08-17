import React, { useMemo } from 'react';

const BADGES = [
  { id: 'first_log',    emoji: '📝', name: 'Eerste log',       check: s => s.totalDays >= 1 },
  { id: 'week1',        emoji: '🗓️', name: '7 dagen',          check: s => s.totalDays >= 7 },
  { id: 'two_weeks',    emoji: '📅', name: '14 dagen',          check: s => s.totalDays >= 14 },
  { id: 'month',        emoji: '🏆', name: '30 dagen',          check: s => s.totalDays >= 30 },
  { id: 'streak3',      emoji: '🔥', name: '3 streak',          check: s => s.streak >= 3 },
  { id: 'streak7',      emoji: '🔥🔥', name: '7 streak',         check: s => s.streak >= 7 },
  { id: 'streak14',     emoji: '💫', name: '14 streak',          check: s => s.streak >= 14 },
  { id: 'first_run',    emoji: '👟', name: 'Eerste loop',        check: s => s.runs >= 1 },
  { id: 'runs5',        emoji: '🏃', name: '5 loops',            check: s => s.runs >= 5 },
  { id: 'runs10',       emoji: '🏃‍♀️', name: '10 loops',         check: s => s.runs >= 10 },
  { id: 'runs20',       emoji: '🥇', name: '20 loops',           check: s => s.runs >= 20 },
  { id: 'first_core',   emoji: '💪', name: 'Eerste core',        check: s => s.coreDays >= 1 },
  { id: 'core10',       emoji: '🧱', name: '10× core',           check: s => s.coreDays >= 10 },
  { id: 'weight1',      emoji: '⚖️', name: '-1 kg',              check: s => s.weightLoss >= 1 },
  { id: 'weight3',      emoji: '🎯', name: '-3 kg',              check: s => s.weightLoss >= 3 },
  { id: 'weight5',      emoji: '⭐', name: '-5 kg',              check: s => s.weightLoss >= 5 },
  { id: 'water7',       emoji: '💧', name: '7× water doel',      check: s => s.waterDays >= 7 },
  { id: 'meds7',        emoji: '💊', name: '7× medicatie',       check: s => s.medsDays >= 7 },
  { id: 'bp_week',      emoji: '❤️', name: '7× BD gemeten',      check: s => s.bpDays >= 7 },
  { id: 'all_habits',   emoji: '✨', name: 'Alle gewoontes dag',  check: s => s.perfectDays >= 1 },
  { id: 'halfway',      emoji: '🏁', name: 'Halverwege (dag 35)', check: s => s.totalDays >= 35 },
  { id: 'finish',       emoji: '🎉', name: '70 dagen voltooid',   check: s => s.totalDays >= 70 },
];

function getStats(logs) {
  const logArr = Object.values(logs);

  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dk = d.toISOString().slice(0, 10);
    const l = logs[dk];
    if (l && (l.run_done || l.core_done || l.candesartan || l.adhd_meds)) streak++;
    else if (i > 0) break;
  }

  const runs = logArr.filter(l => l.run_done).length;
  const coreDays = logArr.filter(l => l.core_done).length;
  const waterDays = logArr.filter(l => l.water).length;
  const medsDays = logArr.filter(l => l.candesartan && l.adhd_meds).length;
  const bpDays = logArr.filter(l => l.bp_sys).length;
  const totalDays = logArr.length;

  const weights = logArr.filter(l => l.weight).sort((a, b) => a.date.localeCompare(b.date));
  const firstW = weights[0]?.weight;
  const lastW = weights[weights.length - 1]?.weight;
  const weightLoss = firstW && lastW ? Math.max(0, firstW - lastW) : 0;

  const perfectDays = logArr.filter(l => {
    const habits = ['water','protein','no_sugar','no_salt','bed_on_time','low_stress'];
    return habits.every(h => l[h]) && l.candesartan && l.adhd_meds;
  }).length;

  return { streak, runs, coreDays, waterDays, medsDays, bpDays, totalDays, weightLoss, perfectDays };
}

export default function Badges({ logs, streak }) {
  const stats = useMemo(() => getStats(logs), [logs]);
  const earned = BADGES.filter(b => b.check(stats));
  const total = BADGES.length;

  return (
    <div className="pane">
      {/* Overzicht */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">🏅 Badges — {earned.length}/{total}</div>
        </div>
        <div className="card-body">
          <div className="habit-bar-bg" style={{ marginBottom: 8 }}>
            <div className="habit-bar-fill" style={{ width: `${(earned.length / total) * 100}%`, background: 'var(--gold)' }} />
          </div>
          <div className="badge-grid">
            {BADGES.map(b => {
              const got = b.check(stats);
              return (
                <div key={b.id} className={`badge-card ${got ? 'earned' : ''}`}>
                  <div className="badge-emoji">{b.emoji}</div>
                  <div className="badge-name">{b.name}</div>
                  {!got && <div style={{ fontSize: 9, color: 'rgba(122,110,105,0.4)', marginTop: 2 }}>🔒</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Statistieken */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">📊 Jouw statistieken</div>
        </div>
        <div className="card-body">
          {[
            ['🔥 Huidige streak', stats.streak, 'dagen'],
            ['🏃 Loops gedaan', stats.runs, '×'],
            ['💪 Core sessies', stats.coreDays, '×'],
            ['💊 Medicatie trouw', stats.medsDays, 'dagen'],
            ['❤️ BD gemeten', stats.bpDays, 'dagen'],
            ['💧 Water doel gehaald', stats.waterDays, 'dagen'],
            ['✨ Perfecte dagen', stats.perfectDays, 'dagen'],
          ].map(([label, val, unit]) => (
            <div key={label} className="stats-row">
              <span style={{ fontSize: 12 }}>{label}</span>
              <span className="stats-value">
                {val} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>{unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
