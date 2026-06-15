import React, { useState } from 'react';
import { PERSONAL_EVENTS } from '../config';

const NL_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const NL_DAYS = ['Ma','Di','Wo','Do','Vr','Za','Zo'];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

function logDots(log) {
  if (!log) return [];
  const dots = [];
  if (log.run_done) dots.push({ label: '🏃', color: 'var(--sage)' });
  if (log.core_done) dots.push({ label: '💪', color: 'var(--rust)' });
  if (log.weight) dots.push({ label: `${log.weight}`, color: 'var(--gold)' });
  return dots.slice(0, 3);
}

function isDayComplete(log) {
  if (!log) return false;
  const habits = ['water','protein','no_sugar','no_salt','bed_on_time','low_stress'];
  return log.candesartan && log.adhd_meds && habits.filter(h => log[h]).length >= 4;
}

function getEventForDay(dk) {
  return PERSONAL_EVENTS.find(e => dk >= e.startDate && dk <= e.endDate) || null;
}

export default function Calendar({ currentDate, logs, onSelectDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState(new Date(currentDate));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return `${year}-${pad2(month + 1)}-${pad2(d)}`; }

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    if (next <= new Date()) setViewDate(next);
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const nextIsInFuture = new Date(year, month + 1, 1) > new Date();

  return (
    <div className="pane">
      <div className="card">
        <div className="card-body">
          <div className="cal-nav">
            <button onClick={prevMonth}>‹</button>
            <span className="cal-title">{NL_MONTHS[month]} {year}</span>
            <button onClick={nextMonth} disabled={nextIsInFuture}>›</button>
          </div>

          <div className="cal-grid">
            {NL_DAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const dk = dateKey(day);
              const isFuture = dk > today;
              const isToday = dk === today;
              const isSel = dk === currentDate;
              const log = logs[dk];
              const complete = isDayComplete(log);
              const dots = logDots(log);
              const event = getEventForDay(dk);

              return (
                <div
                  key={dk}
                  className={`cal-day ${isToday ? 'today' : ''} ${isSel && !isToday ? 'selected' : ''} ${dk < today && !isToday ? 'past' : ''}`}
                  onClick={() => !isFuture && onSelectDate(dk)}
                  style={{
                    cursor: isFuture ? 'default' : 'pointer',
                    opacity: isFuture ? 0.3 : undefined,
                    background: event ? `${event.color}18` : undefined,
                    outline: event ? `2px solid ${event.color}` : undefined,
                    outlineOffset: -2,
                  }}
                >
                  {complete && <span className="cal-done-mark">✓</span>}
                  <div className="cal-date">{day}</div>
                  {event && (
                    <div style={{ fontSize: 10, lineHeight: 1, textAlign: 'center', marginTop: 1 }}>
                      {event.emoji}
                    </div>
                  )}
                  <div className="cal-dots">
                    {dots.map((dot, i) => (
                      <div key={i} className="cal-dot" style={{ background: dot.color + '22', color: dot.color }}>
                        {dot.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
          <div>🏃 = loop gedaan &nbsp;·&nbsp; 💪 = core gedaan &nbsp;·&nbsp; ✓ = dag compleet</div>
          <div>Tik op een dag om er naartoe te navigeren.</div>
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {PERSONAL_EVENTS.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{e.emoji}</span>
                <span style={{ fontWeight: 700, color: e.color }}>{e.title}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {e.startDate === e.endDate
                    ? new Date(e.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                    : `${new Date(e.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}–${new Date(e.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
