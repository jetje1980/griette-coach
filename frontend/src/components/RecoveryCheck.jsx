import React from 'react';
import { lastRunWorkout, logAdaptiveEvent } from '../workouts';

// Ochtend-herstelcheck: de dag na een training vraagt de coach expliciet
// "Hoe reageerde je lichaam op gisteren?" — pas daarna wordt de volgende
// sessie vrijgegeven (BUILD) of herhaald (REPEAT). Closed-loop coaching.

export default function RecoveryCheck({ log, logs, currentDate, saveField }) {
  const yest = (() => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const yestLog = logs?.[yest];
  const lastW = lastRunWorkout(currentDate);
  const trainedYesterday = yestLog?.run_done || yestLog?.strength_done || yestLog?.core_done ||
    (lastW && lastW.date === yest);

  if (!trainedYesterday) return null;

  const sessionNr = (lastW && lastW.date === yest ? lastW.plannedSessionId : null) || yestLog?.run_session || null;
  const answered = log?.recovery_check;

  function answer(val) {
    saveField('recovery_check', val);
    if (sessionNr) {
      logAdaptiveEvent({
        date: currentDate, sessionNr: Number(sessionNr),
        event: val === 'good' ? 'tolerated' : 'poorly_tolerated',
        note: val === 'good' ? 'herstelcheck: goed hersteld' : 'herstelcheck: niet goed hersteld',
      });
    }
  }

  if (answered) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
        color: answered === 'good' ? 'var(--green)' : 'var(--rust)', fontWeight: 600,
        padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 10, marginBottom: 10 }}>
        {answered === 'good'
          ? '💚 Herstelcheck: goed hersteld van gisteren — volgende sessie kan vrijgegeven worden'
          : '🟠 Herstelcheck: niet goed hersteld — de coach bouwt vandaag niet verder'}
        <button onClick={() => saveField('recovery_check', null)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ghost)',
            cursor: 'pointer', fontSize: 11 }}>wijzig</button>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--gold)', borderRadius: 10,
      padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
        🌅 Hoe reageerde je lichaam op gisteren{sessionNr ? ` (T${sessionNr})` : ''}?
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', marginBottom: 10, lineHeight: 1.4 }}>
        Een training is pas succesvol als die ook achteraf goed werd verdragen.
        Ik geef de volgende sessie pas vrij na deze check.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="os-btn-save" style={{ flex: 1, background: 'var(--green)' }}
          onClick={() => answer('good')}>
          💚 Goed hersteld
        </button>
        <button className="os-btn-save" style={{ flex: 1, background: 'var(--rust)' }}
          onClick={() => answer('bad')}>
          🟠 Niet goed
        </button>
      </div>
    </div>
  );
}
