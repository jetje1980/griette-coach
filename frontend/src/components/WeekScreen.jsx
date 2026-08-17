import React from 'react';
import { computeHeadCoach } from './CoachAdvice';
import { PERSONAL_EVENTS } from '../config';

const NL_DAYS   = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
const NL_MONTHS_SHORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekNum(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
}

const DOT = { GREEN: 'os-dot-green', AMBER: 'os-dot-amber', BLUE: 'os-dot-blue', RED: 'os-dot-red' };
const DECISION_NL = { GREEN: 'Groen', AMBER: 'Amber', BLUE: 'Blauw', RED: 'Rood' };

export default function WeekScreen({ logs }) {
  const tod = todayStr();
  const monday = getMondayOf(tod);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date  = addDays(monday, i);
    const d     = new Date(date + 'T12:00:00');
    const log   = logs?.[date];
    const past  = date < tod;
    const isToday = date === tod;
    const future = date > tod;

    let dotClass = 'os-dot-empty';
    let headline = future ? 'Gepland' : 'Geen data';
    let sub = '';

    if ((past || isToday) && log) {
      const coach = computeHeadCoach(log, logs, date);
      dotClass = DOT[coach.decision] || 'os-dot-empty';
      headline = DECISION_NL[coach.decision] || '—';
      if (log.run_done)  sub = 'Hardlopen gedaan';
      else if (log.core_done) sub = 'Core gedaan';
      else if (coach.decision === 'BLUE' || coach.decision === 'RED') sub = 'Rustdag';
    } else if (isToday && !log) {
      dotClass = 'os-dot-amber';
      headline = 'Vandaag';
      sub = 'Data nog invullen';
    }

    return { date, d, isToday, dotClass, headline, sub };
  });

  const upcoming = PERSONAL_EVENTS
    .filter(e => e.startDate >= tod)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5)
    .map(e => ({
      ...e,
      daysTo: Math.ceil((new Date(e.startDate) - new Date(tod)) / 86400000),
    }));

  const monday_d = new Date(monday + 'T12:00:00');

  return (
    <div className="os-content">
      <div className="os-section-label" style={{ marginTop: 0 }}>
        Week {weekNum(monday)} — {NL_MONTHS_SHORT[monday_d.getMonth()]} {monday_d.getFullYear()}
      </div>

      {days.map(({ date, d, isToday, dotClass, headline, sub }) => (
        <div key={date} className={`os-week-row ${isToday ? 'today' : ''}`}>
          <div>
            <div className="os-wd-name">{NL_DAYS[d.getDay()]}</div>
            <div className="os-wd-num">{d.getDate()}</div>
          </div>
          <div className="os-week-divider" />
          <div style={{ paddingLeft: 2 }}>
            <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 600, marginBottom: 2 }}>{headline}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--sub)' }}>{sub}</div>}
          </div>
          <div className={`os-week-dot ${dotClass}`} />
        </div>
      ))}

      {upcoming.length > 0 && (
        <>
          <div className="os-section-label">Aankomende momenten</div>
          <div className="os-card">
            {upcoming.map(e => (
              <div key={e.id} className="os-detail-row">
                <span className="os-dk">{e.emoji} {e.title}</span>
                <span className="os-dv">
                  {e.daysTo === 0 ? 'Vandaag' : e.daysTo === 1 ? 'Morgen' : `${e.daysTo} d`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
