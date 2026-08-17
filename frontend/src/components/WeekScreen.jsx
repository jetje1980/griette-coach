import React, { useState, useEffect } from 'react';
import { computeHeadCoach } from './CoachAdvice';
import { PERSONAL_EVENTS } from '../config';

const NL_DAYS   = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
const NL_DAYS_FULL = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const NL_MONTHS_SHORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

// ── date helpers ────────────────────────────────────────────────
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

// ── localStorage helpers ────────────────────────────────────────
function getPriorities(monday) {
  try { return JSON.parse(localStorage.getItem(`gc_week_prio_${monday}`) || '[]'); } catch { return []; }
}
function savePriorities(monday, arr) { localStorage.setItem(`gc_week_prio_${monday}`, JSON.stringify(arr)); }

function getDayPlan(date) {
  try { return JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}'); } catch { return {}; }
}
function saveDayPlan(date, obj) { localStorage.setItem(`gc_day_plan_${date}`, JSON.stringify(obj)); }

function getWeekReview(monday) {
  try { return JSON.parse(localStorage.getItem(`gc_week_review_${monday}`) || '{}'); } catch { return {}; }
}
function saveWeekReview(monday, obj) { localStorage.setItem(`gc_week_review_${monday}`, JSON.stringify(obj)); }

// ── dot colors ──────────────────────────────────────────────────
const DOT = { GREEN: 'os-dot-green', AMBER: 'os-dot-amber', BLUE: 'os-dot-blue', RED: 'os-dot-red' };
const DECISION_NL = { GREEN: 'Groen', AMBER: 'Amber', BLUE: 'Blauw', RED: 'Rood' };

// ── training types ──────────────────────────────────────────────
const TRAIN_TYPES = [
  { id: 'run',   emoji: '🏃', label: 'Hardlopen' },
  { id: 'walk',  emoji: '🚶', label: 'Wandelen' },
  { id: 'swim',  emoji: '🏊', label: 'Zwemmen' },
  { id: 'bike',  emoji: '🚴', label: 'Fietsen' },
  { id: 'core',  emoji: '💪', label: 'Core' },
  { id: 'rest',  emoji: '🛌', label: 'Rust' },
  { id: 'free',  emoji: '🌿', label: 'Vrij' },
];

const FREE_BLOCKS = [
  { id: 'morning',  emoji: '🌅', label: 'Ochtend' },
  { id: 'midday',   emoji: '☀️', label: 'Middag' },
  { id: 'evening',  emoji: '🌙', label: 'Avond' },
  { id: 'fullday',  emoji: '📅', label: 'Hele dag' },
];

// ── WIP check ───────────────────────────────────────────────────
function computeWipWarning(priorities, days) {
  const activePlanned = days.filter(d => {
    const plan = getDayPlan(d);
    return plan.training && plan.training !== 'rest' && plan.training !== 'free';
  }).length;
  const priorityCount = priorities.filter(p => !p.done).length;
  const wip = activePlanned + priorityCount;
  return wip > 5 ? { warn: true, total: wip, msg: `${wip} actieve zaken — risico op overbelasting` } : { warn: false };
}

// ── Sub-components ──────────────────────────────────────────────
function ExpandSection({ label, children, initialOpen = false, badge }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button className={`os-expand-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        {badge && (
          <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 99,
            fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 8 }}>{badge}</span>
        )}
        <span className="os-expand-arrow">↓</span>
      </button>
      {open && <div className="os-card" style={{ marginBottom: 8 }}>{children}</div>}
    </>
  );
}

// ── Weekprioriteiten ────────────────────────────────────────────
function WeekPriorities({ monday }) {
  const [items, setItems] = useState(() => getPriorities(monday));
  const [text, setText] = useState('');
  const inputRef = React.useRef(null);

  useEffect(() => { setItems(getPriorities(monday)); }, [monday]);

  function persist(arr) { savePriorities(monday, arr); setItems(arr); }
  function add() {
    const t = text.trim();
    if (!t || items.length >= 3) return;
    persist([...items, { id: Date.now().toString(), text: t, done: false }]);
    setText('');
  }
  function toggle(id) { persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i)); }
  function remove(id) { persist(items.filter(i => i.id !== id)); }

  const allDone = items.length > 0 && items.every(i => i.done);

  return (
    <div>
      {allDone && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)',
          borderRadius: 10, padding: '8px 12px', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          Weekprioriteiten afgerond ✓
        </div>
      )}
      {items.map((item, idx) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 8, marginBottom: 8,
          borderBottom: idx < items.length - 1 ? '1px solid var(--divide)' : 'none' }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, minWidth: 14,
            textAlign: 'center' }}>{idx + 1}</div>
          <div className={`os-check-box ${item.done ? 'checked' : ''}`}
            style={{ flexShrink: 0 }} onClick={() => toggle(item.id)}>
            {item.done ? '✓' : ''}
          </div>
          <span style={{ flex: 1, fontSize: 14,
            color: item.done ? 'var(--sub)' : 'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none' }}>
            {item.text}
          </span>
          <button onClick={() => remove(item.id)}
            style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer',
              fontSize: 16, padding: '0 2px' }}>×</button>
        </div>
      ))}
      {items.length < 3 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} className="os-input" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={`Weekprioriteit ${items.length + 1} van 3…`} />
          <button className="os-btn-save" onClick={add} style={{ flexShrink: 0 }}>+</button>
        </div>
      )}
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>
          Max 3 prioriteiten voor deze week — kies wat écht telt.
        </div>
      )}
    </div>
  );
}

// ── Day planner modal ───────────────────────────────────────────
function DayPlanEditor({ date, onClose }) {
  const d = new Date(date + 'T12:00:00');
  const dayLabel = `${NL_DAYS_FULL[d.getDay()]} ${d.getDate()} ${NL_MONTHS_SHORT[d.getMonth()]}`;
  const [plan, setPlan] = useState(() => getDayPlan(date));

  function update(key, val) {
    const updated = { ...plan, [key]: val };
    saveDayPlan(date, updated);
    setPlan(updated);
  }

  function toggleFree(blockId) {
    const cur = plan.freeBlocks || [];
    const next = cur.includes(blockId) ? cur.filter(x => x !== blockId) : [...cur, blockId];
    update('freeBlocks', next);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: '20px 16px 32px',
        width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, fontFamily: 'var(--font-serif)' }}>{dayLabel}</div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              color: 'var(--sub)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.5px', fontWeight: 700, marginBottom: 8 }}>Training gepland</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {TRAIN_TYPES.map(t => (
              <button key={t.id}
                className={`os-scale-btn ${plan.training === t.id ? 'active' : ''}`}
                onClick={() => update('training', plan.training === t.id ? null : t.id)}
                style={{ padding: '10px 4px' }}>
                <div style={{ fontSize: 18 }}>{t.emoji}</div>
                <div style={{ fontSize: 10, marginTop: 3 }}>{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.5px', fontWeight: 700, marginBottom: 8 }}>Beschermde vrije tijd</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FREE_BLOCKS.map(b => (
              <button key={b.id}
                className={`os-toggle-chip ${(plan.freeBlocks || []).includes(b.id) ? 'active green' : ''}`}
                onClick={() => toggleFree(b.id)}
                style={{ fontSize: 12 }}>
                {b.emoji} {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.5px', fontWeight: 700, marginBottom: 6 }}>Notitie (optioneel)</div>
          <input className="os-input" value={plan.note || ''}
            onChange={e => update('note', e.target.value)}
            placeholder="Afspraken, bijzonderheden…" />
        </div>

        <button className="os-btn-save" style={{ width: '100%' }} onClick={onClose}>Klaar</button>
      </div>
    </div>
  );
}

// ── Weekafsluiting ──────────────────────────────────────────────
function WeekReview({ monday }) {
  const [review, setReview] = useState(() => getWeekReview(monday));

  function update(key, val) {
    const updated = { ...review, [key]: val };
    saveWeekReview(monday, updated);
    setReview(updated);
  }

  const RATING_OPTS = [
    { val: 1, label: '😞' }, { val: 2, label: '😐' },
    { val: 3, label: '🙂' }, { val: 4, label: '😊' }, { val: 5, label: '🚀' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
          letterSpacing: '0.5px', fontWeight: 700, marginBottom: 8 }}>Hoe voelde deze week?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {RATING_OPTS.map(opt => (
            <button key={opt.val}
              onClick={() => update('rating', opt.val)}
              style={{ fontSize: 22, background: review.rating === opt.val ? 'var(--green-bg)' : 'transparent',
                border: `1px solid ${review.rating === opt.val ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 10, padding: '6px 8px', cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
          letterSpacing: '0.5px', fontWeight: 700, marginBottom: 6 }}>Wat ging goed?</div>
        <textarea
          style={{ width: '100%', minHeight: 52, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={review.good || ''}
          onChange={e => update('good', e.target.value)}
          placeholder="Successen, momenten die energie gaven…" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
          letterSpacing: '0.5px', fontWeight: 700, marginBottom: 6 }}>Wat kan beter?</div>
        <textarea
          style={{ width: '100%', minHeight: 52, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={review.improve || ''}
          onChange={e => update('improve', e.target.value)}
          placeholder="Wat zou je volgend week anders doen?" />
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
          letterSpacing: '0.5px', fontWeight: 700, marginBottom: 6 }}>Topprioriteit volgende week</div>
        <input className="os-input" value={review.nextWeek || ''}
          onChange={e => update('nextWeek', e.target.value)}
          placeholder="Het belangrijkste voor komende week…" />
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────
export default function WeekScreen({ logs }) {
  const tod = todayStr();
  const monday = getMondayOf(tod);
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const currentMonday = addDays(monday, weekOffset * 7);
  const currentMonday_d = new Date(currentMonday + 'T12:00:00');

  const days = Array.from({ length: 7 }, (_, i) => {
    const date  = addDays(currentMonday, i);
    const d     = new Date(date + 'T12:00:00');
    const log   = logs?.[date];
    const past  = date < tod;
    const isToday = date === tod;
    const future = date > tod;
    const dayPlan = getDayPlan(date);

    let dotClass = 'os-dot-empty';
    let headline = '';
    let sub = '';

    if ((past || isToday) && log) {
      const coach = computeHeadCoach(log, logs, date);
      dotClass = DOT[coach.decision] || 'os-dot-empty';
      headline = DECISION_NL[coach.decision] || '—';
      if (log.run_done)       sub = '🏃 Getraind';
      else if (log.core_done) sub = '💪 Core';
      else if (coach.decision === 'BLUE' || coach.decision === 'RED') sub = 'Rustdag';
    } else if (isToday && !log) {
      dotClass = 'os-dot-amber';
      headline = 'Vandaag';
      sub = 'Data invullen';
    } else if (future) {
      const planned = dayPlan.training;
      if (planned) {
        const t = TRAIN_TYPES.find(x => x.id === planned);
        headline = t ? `${t.emoji} ${t.label}` : 'Gepland';
        dotClass = 'os-dot-empty';
      } else {
        headline = '—';
      }
    }

    const freeBlocks = dayPlan.freeBlocks || [];
    const hasProtected = freeBlocks.length > 0;

    return { date, d, isToday, past, future, dotClass, headline, sub, dayPlan, hasProtected };
  });

  const priorities = getPriorities(currentMonday);
  const dayDates = days.map(d => d.date);
  const wip = computeWipWarning(priorities, dayDates);

  // Count training days this week
  const trainedThisWeek = days.filter(d => {
    const log = logs?.[d.date];
    return log && (log.run_done || log.core_done);
  }).length;
  const plannedTraining = days.filter(d => {
    const plan = getDayPlan(d.date);
    return plan.training && plan.training !== 'rest' && plan.training !== 'free';
  }).length;

  const upcoming = PERSONAL_EVENTS
    .filter(e => e.startDate >= tod)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4)
    .map(e => ({
      ...e,
      daysTo: Math.ceil((new Date(e.startDate) - new Date(tod)) / 86400000),
    }));

  const isPastWeek = addDays(currentMonday, 6) < tod;

  return (
    <div className="os-content">

      {/* Week header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="os-eyebrow">
            Week {weekNum(currentMonday)}
          </div>
          <h1 className="os-date-heading" style={{ marginBottom: 0 }}>
            {NL_MONTHS_SHORT[currentMonday_d.getMonth()]} {currentMonday_d.getFullYear()}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="os-nav-arrow" onClick={() => setWeekOffset(o => o - 1)}>‹</button>
          {weekOffset !== 0 && (
            <button className="os-nav-arrow" onClick={() => setWeekOffset(0)}
              style={{ width: 'auto', padding: '0 10px', fontSize: 11, color: 'var(--green)', borderColor: 'var(--green)' }}>
              nu
            </button>
          )}
          <button className="os-nav-arrow" onClick={() => setWeekOffset(o => o + 1)}>›</button>
        </div>
      </div>

      {/* WIP warning */}
      {wip.warn && (
        <div style={{ background: 'rgba(179,94,69,0.08)', border: '1px solid var(--rust)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--rust)' }}>Overbelastingswaarschuwing</div>
            <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 2 }}>{wip.msg}</div>
          </div>
        </div>
      )}

      {/* Week summary bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--sage)' }}>
            {trainedThisWeek}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>getraind</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--blue)' }}>
            {plannedTraining}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>gepland</div>
        </div>
        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: priorities.filter(p => p.done).length === priorities.length && priorities.length > 0 ? 'var(--green)' : 'var(--text)' }}>
            {priorities.filter(p => p.done).length}/{priorities.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>prio's klaar</div>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Weekoverzicht</div>
      {days.map(({ date, d, isToday, past, future, dotClass, headline, sub, hasProtected }) => (
        <div key={date}
          className={`os-week-row ${isToday ? 'today' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedDay(date)}>
          <div style={{ minWidth: 36 }}>
            <div className="os-wd-name">{NL_DAYS[d.getDay()]}</div>
            <div className="os-wd-num">{d.getDate()}</div>
          </div>
          <div className="os-week-divider" />
          <div style={{ flex: 1, paddingLeft: 2 }}>
            <div style={{ fontSize: 14, fontWeight: isToday ? 700 : 600, marginBottom: 2 }}>{headline}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--sub)' }}>{sub}</div>}
          </div>
          {hasProtected && (
            <span style={{ fontSize: 11, color: 'var(--green)', marginRight: 6 }}>🌿</span>
          )}
          <div className={`os-week-dot ${dotClass}`} />
          <div style={{ fontSize: 16, color: 'var(--ghost)', marginLeft: 4 }}>›</div>
        </div>
      ))}

      {/* Weekprioriteiten */}
      <ExpandSection label="Weekprioriteiten" initialOpen={priorities.length > 0}>
        <WeekPriorities monday={currentMonday} />
      </ExpandSection>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <>
          <div className="os-section-label">Aankomende momenten</div>
          <div className="os-card">
            {upcoming.map(e => (
              <div key={e.id} className="os-detail-row">
                <span className="os-dk">{e.emoji} {e.title}</span>
                <span className="os-dv" style={{ color: e.daysTo <= 7 ? 'var(--rust)' : 'var(--text)' }}>
                  {e.daysTo === 0 ? 'Vandaag' : e.daysTo === 1 ? 'Morgen' : `${e.daysTo}d`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Weekafsluiting */}
      <ExpandSection label={isPastWeek ? 'Weekreview — deze week' : 'Weekafsluiting'} initialOpen={isPastWeek}>
        <WeekReview monday={currentMonday} />
      </ExpandSection>

      {/* Day planner modal */}
      {selectedDay && (
        <DayPlanEditor date={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
