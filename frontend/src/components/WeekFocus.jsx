import React, { useState, useEffect } from 'react';

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function today() { return new Date().toISOString().slice(0, 10); }
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

const WEEK_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const STRESS_OPTIONS = [
  { id: 'werk',    label: 'Werk / deadlines', emoji: '💼' },
  { id: 'kids',    label: 'Kinderen / gezin',  emoji: '👨‍👩‍👧' },
  { id: 'social',  label: 'Sociale verplichtingen', emoji: '🗓️' },
  { id: 'health',  label: 'Gezondheid / klachten',  emoji: '❤️‍🩹' },
  { id: 'finance', label: 'Financieel',              emoji: '💸' },
  { id: 'nothing', label: 'Weinig stress',            emoji: '😊' },
];

// Generate a rule-based week plan from answers
function buildWeekPlan(answers, monday) {
  const { energy, freeSlots, stressors, sleepQuality, commitments } = answers;
  const plan = [];

  // Base session pool
  const sessions = [
    { id: 'run_tu',  day: 1, label: 'Hardlopen zone B', duration: energy >= 3 ? '30 min' : '20 min', emoji: '🏃', type: 'run' },
    { id: 'str_mo',  day: 0, label: 'Krachtcircuit A',   duration: '15 min', emoji: '💪', type: 'strength' },
    { id: 'str_we',  day: 2, label: 'Krachtcircuit B',   duration: '15 min', emoji: '💪', type: 'strength' },
    { id: 'run_th',  day: 3, label: 'Hardlopen zone B', duration: energy >= 3 ? '35 min' : '25 min', emoji: '🏃', type: 'run' },
    { id: 'mob_fr',  day: 4, label: 'Mobility / yoga',   duration: '10 min', emoji: '🧘', type: 'mobility' },
    { id: 'run_sa',  day: 5, label: 'Lange loop',        duration: energy >= 4 ? '50 min' : energy >= 3 ? '40 min' : '30 min', emoji: '🏃', type: 'run' },
    { id: 'walk_su', day: 6, label: 'Actieve rust / wandelen', duration: '20 min', emoji: '🚶', type: 'walk' },
  ];

  // Adjustments based on energy
  let pool = [...sessions];
  if (energy <= 2) {
    pool = pool.filter(s => s.type !== 'run' || s.id === 'run_sa');
    pool = pool.map(s => s.id === 'run_sa' ? { ...s, label: 'Rustige wandelduur', duration: '30 min' } : s);
  }
  if (energy === 1) {
    pool = pool.filter(s => s.type === 'walk' || s.type === 'mobility');
    pool.push({ id: 'rest_ex', day: 0, label: 'Rust / herstel', duration: 'heel de dag', emoji: '🛌', type: 'rest' });
  }

  // Adjustments based on sleep
  if (sleepQuality <= 2) {
    pool = pool.map(s => s.type === 'run' ? { ...s, duration: '20 min', label: s.label + ' (licht)' } : s);
  }

  // Adjustments based on free slots
  const maxSessions = Math.min(pool.length, freeSlots <= 2 ? 3 : freeSlots <= 4 ? 5 : 7);
  pool = pool.slice(0, maxSessions);

  // Adjust for high stress
  const highStress = stressors.includes('health') || stressors.includes('work') || (!stressors.includes('nothing') && stressors.length >= 2);
  if (highStress && energy < 4) {
    pool = pool.map(s => s.type === 'run' ? { ...s, label: s.label + ' — extra rustig', duration: '20 min' } : s);
  }

  // Build day plan
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const sessionsToday = pool.filter(s => s.day === i);
    return { day: WEEK_DAYS[i], date: dateStr, sessions: sessionsToday };
  });

  return days;
}

const STORAGE_KEY_PREFIX = 'gc_week_focus_';

export default function WeekFocus() {
  const weekKey = getISOWeek(today());
  const storageKey = STORAGE_KEY_PREFIX + weekKey;
  const monday = getMondayOfWeek(today());

  const [phase, setPhase] = useState('form'); // 'form' | 'plan'
  const [answers, setAnswers] = useState({
    energy: 3,
    freeSlots: 4,
    stressors: [],
    sleepQuality: 3,
    commitments: '',
  });
  const [plan, setPlan] = useState(null);
  const [checked, setChecked] = useState({});
  const [note, setNote] = useState('');

  // Load saved state for this week
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved.plan) {
        setPlan(saved.plan);
        setChecked(saved.checked || {});
        setNote(saved.note || '');
        setAnswers(saved.answers || answers);
        setPhase('plan');
      }
    } catch {}
  }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (newPlan, newChecked, newNote, newAnswers) => {
    localStorage.setItem(storageKey, JSON.stringify({
      plan: newPlan || plan,
      checked: newChecked !== undefined ? newChecked : checked,
      note: newNote !== undefined ? newNote : note,
      answers: newAnswers || answers,
      savedAt: today(),
    }));
  };

  const generatePlan = () => {
    const newPlan = buildWeekPlan(answers, monday);
    setPlan(newPlan);
    setChecked({});
    setPhase('plan');
    save(newPlan, {}, note, answers);
  };

  const toggleCheck = (sessionId) => {
    const updated = { ...checked, [sessionId]: !checked[sessionId] };
    setChecked(updated);
    save(null, updated);
  };

  const toggleStressor = (id) => {
    const current = answers.stressors;
    const updated = current.includes(id) ? current.filter(s => s !== id) : [...current, id];
    setAnswers(prev => ({ ...prev, stressors: updated }));
  };

  // How many sessions done this week
  const totalSessions = plan ? plan.flatMap(d => d.sessions).length : 0;
  const doneSessions = Object.values(checked).filter(Boolean).length;

  return (
    <div className="pane">
      {/* Week header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px 12px',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📋 Weekfocus</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Week {weekKey.split('-W')[1]} · {formatDateShort(monday)} – {formatDateShort((() => {
              const d = new Date(monday + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10);
            })())}
          </div>
        </div>
        {phase === 'plan' && (
          <button
            onClick={() => setPhase('form')}
            className="btn btn-sm"
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            ✏️ Aanpassen
          </button>
        )}
      </div>

      {phase === 'form' && (
        <>
          {/* Energy */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 8 }}>⚡ Hoe is je energie deze week?</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setAnswers(p => ({ ...p, energy: n }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
                      background: answers.energy === n ? 'var(--sage)' : 'var(--border)',
                      color: answers.energy === n ? '#fff' : 'var(--muted)',
                      fontWeight: 700, fontSize: 16, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {['😴', '😐', '🙂', '😊', '🔥'][n - 1]}
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                      {['laag', 'matig', 'goed', 'prima', 'top'][n - 1]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sleep quality */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 8 }}>😴 Hoe heb je afgelopen nacht geslapen?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: 1, l: 'Slecht', e: '😫' },
                  { v: 2, l: 'Matig', e: '😕' },
                  { v: 3, l: 'OK', e: '😐' },
                  { v: 4, l: 'Goed', e: '😊' },
                  { v: 5, l: 'Super', e: '😴' },
                ].map(({ v, l, e }) => (
                  <button
                    key={v}
                    onClick={() => setAnswers(p => ({ ...p, sleepQuality: v }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none',
                      background: answers.sleepQuality === v ? '#1D4ED8' : 'var(--border)',
                      color: answers.sleepQuality === v ? '#fff' : 'var(--muted)',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {e}
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>{l}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Free slots */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 8 }}>
                🗓️ Hoeveel vrije trainingsslots heb je deze week?
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>
                  {answers.freeSlots} {answers.freeSlots === 1 ? 'moment' : 'momenten'}
                </span>
              </div>
              <input
                type="range" min={1} max={7} value={answers.freeSlots}
                onChange={e => setAnswers(p => ({ ...p, freeSlots: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--sage)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                <span>1 (heel druk)</span><span>4 (normaal)</span><span>7 (vrij)</span>
              </div>
            </div>
          </div>

          {/* Stressors */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 8 }}>💭 Waar heb je stress van deze week?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STRESS_OPTIONS.map(({ id, label, emoji }) => {
                  const active = answers.stressors.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleStressor(id)}
                      style={{
                        padding: '6px 12px', borderRadius: 20, border: 'none',
                        background: active ? 'var(--rust)' : 'var(--border)',
                        color: active ? '#fff' : 'var(--text)',
                        fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        transition: 'background 0.15s',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span>{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Commitments */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 6 }}>📌 Vaste afspraken / verplichtingen deze week?</div>
              <textarea
                value={answers.commitments}
                onChange={e => setAnswers(p => ({ ...p, commitments: e.target.value }))}
                placeholder="Bijv: dinsdag vergadering 14-16u, vrijdag schoolfeest..."
                rows={3}
                style={{
                  width: '100%', fontSize: 13, padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: 8, resize: 'none',
                  background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>
          </div>

          <button
            onClick={generatePlan}
            className="btn btn-rust btn-full"
            style={{ fontWeight: 700, fontSize: 15, padding: '13px' }}
          >
            🗓️ Maak mijn weekplan
          </button>
        </>
      )}

      {phase === 'plan' && plan && (
        <>
          {/* Progress bar */}
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-body" style={{ paddingTop: 10, paddingBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  ✅ {doneSessions} / {totalSessions} sessies gedaan
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: doneSessions === totalSessions && totalSessions > 0 ? 'var(--gold)' : 'var(--sage)',
                  width: `${totalSessions > 0 ? (doneSessions / totalSessions) * 100 : 0}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
              {doneSessions === totalSessions && totalSessions > 0 && (
                <div style={{ textAlign: 'center', marginTop: 6, fontSize: 14, color: 'var(--gold)' }}>
                  🎉 Week compleet! Geweldig gedaan!
                </div>
              )}
            </div>
          </div>

          {/* Day-by-day plan */}
          {plan.map(({ day, date, sessions }) => {
            const isToday_ = date === today();
            const isPast = date < today();
            return (
              <div
                key={date}
                className="card"
                style={{
                  marginBottom: 8,
                  opacity: isPast ? 0.75 : 1,
                  borderLeft: isToday_ ? '3px solid var(--sage)' : '3px solid transparent',
                }}
              >
                <div style={{
                  padding: '8px 14px 4px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    fontWeight: 700, fontSize: 14,
                    color: isToday_ ? 'var(--sage)' : 'var(--text)',
                  }}>
                    {day}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateShort(date)}</span>
                  {isToday_ && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                      background: 'var(--sage)', color: '#fff',
                    }}>vandaag</span>
                  )}
                </div>
                <div style={{ padding: '0 14px 10px' }}>
                  {sessions.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Rustdag 🛋️</div>
                  ) : sessions.map(s => {
                    const isDone = checked[s.id];
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleCheck(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          width: '100%', padding: '7px 10px', marginBottom: 4, borderRadius: 8,
                          background: isDone ? 'var(--sage)11' : 'var(--border)',
                          border: isDone ? '1px solid var(--sage)' : '1px solid transparent',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{isDone ? '✅' : s.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--text)',
                            textDecoration: isDone ? 'line-through' : 'none',
                            opacity: isDone ? 0.6 : 1,
                          }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.duration}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Week note */}
          <div className="card" style={{ marginTop: 4 }}>
            <div className="card-body">
              <div className="card-title" style={{ marginBottom: 6 }}>📝 Weeknotitie</div>
              <textarea
                value={note}
                onChange={e => { setNote(e.target.value); save(null, null, e.target.value); }}
                placeholder="Hoe gaat het? Wat merk je? Wat wil je onthouden van deze week?"
                rows={3}
                style={{
                  width: '100%', fontSize: 13, padding: '8px 10px',
                  border: '1px solid var(--border)', borderRadius: 8, resize: 'none',
                  background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
