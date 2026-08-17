import React, { useState } from 'react';
import { PERSONAL_EVENTS } from '../config';

const NL_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const NL_DAYS = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const ENERGY_LABEL = ['🪫 Uitgeput','😐 Matig','⚡ Goed','🚀 Top'];
const ZONE_LABEL = { A: 'Zone A (herstel)', B: 'Zone B (aeroob)', C: 'Zone C (intensief)', rust: 'Rust' };
const RECOVERY_LABEL = { goed: '✅ Goed herstel', matig: '〜 Matig herstel', slecht: '❌ Slecht herstel', 'pem-achtig': '⚠️ PEM-achtig' };

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function getEventForDay(dk) {
  return PERSONAL_EVENTS.find(e => dk >= e.startDate && dk <= e.endDate) || null;
}

function isTopDay(log) {
  if (!log) return false;
  const energyOk = (log.energy ?? -1) >= 2;
  const sleepOk = (log.sleep_hours ?? 0) >= 7;
  const trained = !!(log.run_done || log.core_done || log.swim_done || log.bike_done);
  const noPEM = !log.symptom_pem && log.training_recovery !== 'pem-achtig';
  const noMigraine = !log.migraine;
  return energyOk && sleepOk && trained && noPEM && noMigraine;
}

function dayScore(log) {
  if (!log) return 0;
  let s = 0;
  if ((log.energy ?? -1) >= 2) s += 2;
  if ((log.sleep_hours ?? 0) >= 7) s += 2;
  if (log.run_done || log.core_done || log.swim_done || log.bike_done) s += 2;
  if (log.water) s++;
  if (log.protein) s++;
  if (log.no_sugar) s++;
  if (log.bed_on_time) s++;
  if (log.low_stress) s++;
  if (log.symptom_pem || log.training_recovery === 'pem-achtig') s -= 3;
  if (log.migraine) s -= 2;
  return s;
}

function scoreColor(score) {
  if (score >= 8) return '#1B5E3B';
  if (score >= 5) return '#2A7A4F';
  if (score >= 3) return '#B5831A';
  if (score >= 1) return '#7A6E63';
  return '#C4622D';
}

function DayDetail({ dk, log, onNavigate }) {
  if (!dk) return null;
  const top = isTopDay(log);
  const score = dayScore(log);
  const hasData = !!log;
  const date = new Date(dk + 'T12:00:00');
  const label = date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const color = scoreColor(score);

  const trained = log && (log.run_done || log.core_done || log.swim_done || log.bike_done);
  const trainTypes = log ? [
    log.run_done && '🏃 Hardlopen',
    log.core_done && '💪 Core',
    log.swim_done && '🏊 Zwemmen',
    log.bike_done && '🚴 Fietsen',
  ].filter(Boolean) : [];

  return (
    <div style={{
      margin: '8px 0 0',
      borderRadius: 10,
      background: 'var(--card)',
      border: `2px solid ${top ? '#B5831A' : 'var(--border)'}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        background: top ? '#FBF0DC' : 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {top && <span style={{ fontSize: 18 }}>⭐</span>}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: top ? '#B5831A' : 'var(--text)', textTransform: 'capitalize' }}>
            {top ? 'Topdag — ' : ''}{label}
          </div>
          {hasData && (
            <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 1 }}>
              Score {score} · {top ? 'Perfecte combinatie van rust, training en gewoontes' : score >= 5 ? 'Goede dag' : score >= 3 ? 'Gemiddelde dag' : 'Zware dag'}
            </div>
          )}
        </div>
        <button
          onClick={() => onNavigate(dk)}
          style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            borderRadius: 20, border: '1.5px solid var(--sage)',
            background: 'var(--sage-l)', color: 'var(--sage)',
            cursor: 'pointer',
          }}
        >
          Naar dag →
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!hasData ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
            Geen data gelogd op deze dag.
          </div>
        ) : (
          <>
            {/* Key metrics row */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {log.energy != null && (
                <span style={{ fontSize: 11, background: 'var(--gold-l)', color: 'var(--gold)', padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
                  {ENERGY_LABEL[log.energy]}
                </span>
              )}
              {log.sleep_hours != null && (
                <span style={{ fontSize: 11, background: log.sleep_hours >= 7 ? 'var(--sage-l)' : 'var(--alert-l)', color: log.sleep_hours >= 7 ? 'var(--sage)' : 'var(--alert)', padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
                  😴 {log.sleep_hours}u
                </span>
              )}
              {log.weight && (
                <span style={{ fontSize: 11, background: 'var(--rust-l)', color: 'var(--rust)', padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>
                  ⚖️ {log.weight} kg
                </span>
              )}
            </div>

            {/* Training */}
            {trainTypes.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 700 }}>
                {trainTypes.join(' · ')}
                {log.training_zone && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>({ZONE_LABEL[log.training_zone] || log.training_zone})</span>}
                {log.run_duration && <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>{log.run_duration} min</span>}
              </div>
            )}

            {/* Recovery */}
            {log.training_recovery && (
              <div style={{ fontSize: 11, color: log.training_recovery === 'pem-achtig' ? 'var(--alert)' : 'var(--muted)' }}>
                {RECOVERY_LABEL[log.training_recovery] || log.training_recovery}
              </div>
            )}

            {/* Habits */}
            {(() => {
              const habits = [
                log.water && '💧 Water',
                log.protein && '🥩 Eiwit',
                log.no_sugar && '🚫 Geen suiker',
                log.bed_on_time && '🛏️ Op tijd bed',
                log.low_stress && '🧘 Weinig stress',
                log.mounjaro && '💉 Mounjaro',
              ].filter(Boolean);
              return habits.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
                  {habits.join(' · ')}
                </div>
              );
            })()}

            {/* Symptoms */}
            {(log.symptom_pem || log.migraine || log.symptom_brainfog || log.symptom_exhaustion) && (
              <div style={{ fontSize: 11, color: 'var(--alert)', fontWeight: 600 }}>
                {[
                  log.symptom_pem && '⚡ PEM',
                  log.migraine && '🧠 Migraine',
                  log.symptom_brainfog && '🌫️ Hersenmist',
                  log.symptom_exhaustion && '🪫 Moeheid',
                ].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Why topdag */}
            {top && (
              <div style={{
                marginTop: 4, padding: '8px 10px',
                background: '#FBF0DC', borderRadius: 8,
                fontSize: 11, color: '#7A5A0A', lineHeight: 1.5,
              }}>
                <strong>Waarom topdag:</strong> ⚡ energie {ENERGY_LABEL[log.energy]} · 😴 {log.sleep_hours}u slaap · training gedaan · geen PEM of migraine. Dit patroon herhalen = structureel beter worden.
              </div>
            )}

            {/* Notes */}
            {log.notes && (
              <div style={{ fontSize: 11, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '7px 10px', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{log.notes}"
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Calendar({ currentDate, logs, onSelectDate, maxDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const max = maxDate || today;
  const [viewDate, setViewDate] = useState(new Date(currentDate));
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return `${year}-${pad2(month + 1)}-${pad2(d)}`; }

  function prevMonth() {
    setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    const next = new Date(year, month + 1, 1);
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextKey = `${nextMonthYear}-${pad2(month + 2 > 12 ? 1 : month + 2)}-01`;
    if (nextKey <= max) { setViewDate(next); setSelectedDay(null); }
  }

  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonthKeyFull = `${nextMonthYear}-${pad2(month + 2 > 12 ? 1 : month + 2)}-01`;
  const nextIsOverMax = nextMonthKeyFull > max;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  // Count top days this month for the header
  const topDaysThisMonth = cells.filter(d => {
    if (!d) return false;
    const dk = dateKey(d);
    return dk <= today && isTopDay(logs[dk]);
  }).length;

  return (
    <div className="pane">
      <div className="card">
        <div className="card-body">
          <div className="cal-nav">
            <button onClick={prevMonth}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <span className="cal-title">{NL_MONTHS[month]} {year}</span>
              {topDaysThisMonth > 0 && (
                <div style={{ fontSize: 10, color: '#B5831A', fontWeight: 700 }}>
                  ⭐ {topDaysThisMonth} topdag{topDaysThisMonth !== 1 ? 'en' : ''} deze maand
                </div>
              )}
            </div>
            <button onClick={nextMonth} disabled={nextIsOverMax}>›</button>
          </div>

          <div className="cal-grid">
            {NL_DAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const dk = dateKey(day);
              const isFuture = dk > today;
              const isOverMax = dk > max;
              const isToday = dk === today;
              const isSel = dk === selectedDay;
              const log = logs[dk];
              const top = !isFuture && isTopDay(log);
              const score = !isFuture ? dayScore(log) : 0;
              const event = getEventForDay(dk);
              const hasPlanned = isFuture && log && Object.keys(log).filter(k => k !== 'date').length > 0;
              const hasData = !isFuture && !!log;

              return (
                <div
                  key={dk}
                  className={`cal-day ${isToday ? 'today' : ''} ${isSel && !isToday ? 'selected' : ''} ${dk < today && !isToday ? 'past' : ''}`}
                  onClick={() => {
                    if (isOverMax) return;
                    if (!isFuture) {
                      setSelectedDay(prev => prev === dk ? null : dk);
                    } else {
                      onSelectDate(dk);
                    }
                  }}
                  style={{
                    cursor: isOverMax ? 'default' : 'pointer',
                    opacity: isOverMax ? 0.2 : isFuture ? 0.7 : undefined,
                    background: top
                      ? '#FBF0DC'
                      : event ? `${event.color}18`
                      : isFuture && !isOverMax ? 'rgba(251,191,36,0.06)'
                      : undefined,
                    outline: isSel
                      ? '2px solid var(--sage)'
                      : top ? '2px solid #B5831A'
                      : event ? `2px solid ${event.color}`
                      : isFuture && hasPlanned ? '2px solid #F59E0B'
                      : undefined,
                    outlineOffset: -2,
                    position: 'relative',
                  }}
                >
                  {top && (
                    <span style={{ position: 'absolute', top: 1, right: 2, fontSize: 8, lineHeight: 1 }}>⭐</span>
                  )}
                  {hasPlanned && <span className="cal-done-mark" style={{ color: '#F59E0B' }}>📅</span>}
                  <div className="cal-date" style={{ color: top ? '#7A5A0A' : undefined, fontWeight: top ? 800 : undefined }}>
                    {day}
                  </div>
                  {event && (
                    <div style={{ fontSize: 10, lineHeight: 1, textAlign: 'center', marginTop: 1 }}>{event.emoji}</div>
                  )}
                  {/* Score bar for logged past days */}
                  {hasData && score > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 2, left: 3, right: 3,
                      height: 2, borderRadius: 1,
                      background: scoreColor(score),
                      opacity: 0.7,
                    }} />
                  )}
                  <div className="cal-dots">
                    {[
                      log?.run_done && { label: '🏃', color: 'var(--sage)' },
                      log?.core_done && { label: '💪', color: 'var(--rust)' },
                      log?.weight && { label: `${log.weight}`, color: 'var(--gold)' },
                    ].filter(Boolean).slice(0, 2).map((dot, i) => (
                      <div key={i} className="cal-dot" style={{ background: dot.color + '22', color: dot.color }}>
                        {dot.label}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day detail panel */}
          {selectedDay && (
            <DayDetail
              dk={selectedDay}
              log={logs[selectedDay]}
              onNavigate={(dk) => { onSelectDate(dk); }}
            />
          )}
        </div>
      </div>

      {/* Legend + events */}
      <div className="card">
        <div className="card-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 6 }}>
            <span>⭐ = topdag</span>
            <span>🏃 = loop</span>
            <span>💪 = core</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 16, height: 3, borderRadius: 2, background: '#1B5E3B', verticalAlign: 'middle' }} />
              score
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            Klik op een dag in het verleden om details te zien. Toekomstige dag: navigeert direct.
          </div>
          {PERSONAL_EVENTS.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
