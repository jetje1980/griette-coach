import React from 'react';
import { USER } from '../config';

const NL_DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const NL_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${NL_DAYS[d.getDay()]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`;
}

export default function Header({ currentDate, log, streak, latestWeight, progressPct, quote, isToday, onShiftDay, dayNum }) {
  const today = new Date().toISOString().slice(0, 10);
  const bpColor = (() => {
    if (!log?.bp_sys) return null;
    if (log.bp_sys >= 160 || log.bp_dia >= 100) return 'var(--alert)';
    if (log.bp_sys >= 145 || log.bp_dia >= 90) return 'var(--gold)';
    return 'var(--sage)';
  })();

  return (
    <div className="app-header">
      <div className="header-top">
        <div>
          <div className="header-label">GRIETTE'S COACH · DAG {dayNum}</div>
          <div className="header-date">{formatDate(currentDate)}</div>
        </div>
        <div className="header-streak">
          <div className="streak-count">🔥 {streak}</div>
          <div className="streak-label">streak</div>
        </div>
      </div>

      <div className="goal-bar-wrap">
        <div className="goal-bar-labels">
          <span>{USER.startWeight} kg</span>
          <span style={{ color: 'rgba(251,248,242,0.7)', fontStyle: 'italic' }}>
            {latestWeight ? `${latestWeight} kg nu` : '—'}
          </span>
          <span>🎯 {USER.goalWeight} kg</span>
        </div>
        <div className="goal-bar-bg">
          <div className="goal-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="quick-stats">
        <div className="qs-item">
          <div className="qs-label">Gewicht</div>
          <div className="qs-value">{log?.weight ?? '—'}</div>
          <div className="qs-sub" style={{ color: 'rgba(251,248,242,0.5)' }}>kg</div>
        </div>
        <div className="qs-item">
          <div className="qs-label">Bloeddruk</div>
          <div className="qs-value" style={{ color: bpColor || '#FBF8F2', fontSize: 12 }}>
            {log?.bp_sys ? `${log.bp_sys}/${log.bp_dia}` : '—'}
          </div>
          <div className="qs-sub" style={{ color: 'rgba(251,248,242,0.5)' }}>mmHg</div>
        </div>
        <div className="qs-item">
          <div className="qs-label">Energie</div>
          <div className="qs-value" style={{ fontSize: 16 }}>
            {log?.energy != null ? ['🪫','😐','⚡','🚀'][log.energy] : '—'}
          </div>
        </div>
        <div className="qs-item">
          <div className="qs-label">Training</div>
          <div className="qs-value" style={{ fontSize: 14 }}>
            {log?.run_done ? '✅' : log?.core_done ? '💪' : '—'}
          </div>
        </div>
      </div>

      <div className="header-quote">"{quote}"</div>

      <div className="day-nav">
        <button onClick={() => onShiftDay(-1)}>‹</button>
        <span className="day-nav-label">{isToday ? 'Vandaag' : formatDate(currentDate)}</span>
        <button onClick={() => onShiftDay(1)} disabled={isToday}>›</button>
      </div>
    </div>
  );
}
