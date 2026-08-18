import React, { useEffect, useState } from 'react';

const WEEK_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const STORAGE_KEY_PREFIX = 'gc_week_focus_';

const STRESS_OPTIONS = [
  { id: 'werk', label: 'Werk / deadlines', emoji: '💼' },
  { id: 'kids', label: 'Kinderen / gezin', emoji: '👨‍👩‍👧' },
  { id: 'social', label: 'Sociale verplichtingen', emoji: '🗓️' },
  { id: 'health', label: 'Gezondheid / klachten', emoji: '❤️‍🩹' },
  { id: 'finance', label: 'Financieel', emoji: '💸' },
  { id: 'nothing', label: 'Weinig stress', emoji: '😊' },
];

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const d = parseDateKey(dateStr);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

function getMondayOfWeek(dateStr) {
  const d = parseDateKey(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return dateKey(d);
}

function getISOWeek(dateStr) {
  const d = parseDateKey(dateStr);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function formatDateShort(dateStr) {
  return parseDateKey(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function buildWeekPlan(answers, monday) {
  const { energy, freeSlots, stressors, sleepQuality } = answers;
  const sessions = [
    { id: 'strength_a', day: 0, label: 'Krachtcircuit A', duration: '15 min', emoji: '💪', type: 'strength' },
    { id: 'run_1', day: 1, label: 'Hardlopen rustig / zone B', duration: energy >= 3 ? '30 min' : '20 min', emoji: '🏃', type: 'run' },
    { id: 'strength_b', day: 2, label: 'Krachtcircuit B', duration: '15 min', emoji: '💪', type: 'strength' },
    { id: 'run_2', day: 3, label: 'Hardlopen rustig / zone B', duration: energy >= 3 ? '35 min' : '20 min', emoji: '🏃', type: 'run' },
    { id: 'mobility', day: 4, label: 'Mobility / yoga', duration: '10 min', emoji: '🧘', type: 'mobility' },
    { id: 'run_3', day: 5, label: 'Rustige duurloop', duration: energy >= 4 ? '50 min' : energy >= 3 ? '40 min' : '30 min', emoji: '🏃', type: 'run' },
    { id: 'walk', day: 6, label: 'Actieve rust / wandelen', duration: '20 min', emoji: '🚶', type: 'walk' },
  ];

  let pool = [...sessions];
  if (energy <= 2) {
    pool = pool.filter(s => s.type !== 'run' || s.id === 'run_3');
    pool = pool.map(s => s.id === 'run_3' ? { ...s, label: 'Rustige wandelduur', duration: '30 min', type: 'walk', emoji: '🚶' } : s);
  }
  if (energy === 1) {
    pool = pool.filter(s => s.type === 'walk' || s.type === 'mobility');
    pool.unshift({ id: 'recovery', day: 0, label: 'Rust / herstel', duration: 'herstel als prioriteit', emoji: '🛌', type: 'rest' });
  }

  if (sleepQuality <= 2) {
    pool = pool.map(s => s.type === 'run' ? { ...s, label: `${s.label} — licht`, duration: '20 min' } : s);
  }

  const highStress = stressors.includes('health') || stressors.includes('werk') || (!stressors.includes('nothing') && stressors.length >= 2);
  if (highStress && energy < 4) {
    pool = pool.map(s => s.type === 'run' ? { ...s, label: `${s.label} — extra rustig`, duration: '20 min' } : s);
  }

  const maxSessions = Math.min(pool.length, freeSlots <= 2 ? 3 : freeSlots <= 4 ? 5 : 7);
  pool = pool.slice(0, maxSessions);

  return WEEK_DAYS.map((day, i) => ({
    day,
    date: addDays(monday, i),
    sessions: pool.filter(s => s.day === i),
  }));
}

export default function WeekFocus() {
  const today = localDateKey();
  const weekKey = getISOWeek(today);
  const storageKey = STORAGE_KEY_PREFIX + weekKey;
  const monday = getMondayOfWeek(today);
  const sunday = addDays(monday, 6);

  const [phase, setPhase] = useState('form');
  const [answers, setAnswers] = useState({ energy: 3, freeSlots: 4, stressors: [], sleepQuality: 3, commitments: '' });
  const [plan, setPlan] = useState(null);
  const [checked, setChecked] = useState({});
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved.plan) {
        const fixedPlan = saved.plan.map((d, i) => ({ ...d, day: WEEK_DAYS[i], date: addDays(monday, i) }));
        setPlan(fixedPlan);
        setChecked(saved.checked || {});
        setNote(saved.note || '');
        setAnswers(saved.answers || answers);
        setPhase('plan');
        localStorage.setItem(storageKey, JSON.stringify({ ...saved, plan: fixedPlan }));
      }
    } catch {}
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(next = {}) {
    const payload = {
      plan: next.plan ?? plan,
      checked: next.checked ?? checked,
      note: next.note ?? note,
      answers: next.answers ?? answers,
      savedAt: localDateKey(),
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }

  function generatePlan() {
    const nextPlan = buildWeekPlan(answers, monday);
    setPlan(nextPlan);
    setChecked({});
    setPhase('plan');
    save({ plan: nextPlan, checked: {}, answers });
  }

  function toggleCheck(id) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    save({ checked: next });
  }

  function toggleStressor(id) {
    const nextStress = answers.stressors.includes(id)
      ? answers.stressors.filter(s => s !== id)
      : [...answers.stressors.filter(s => s !== 'nothing'), id];
    const normalized = id === 'nothing' && !answers.stressors.includes(id) ? ['nothing'] : nextStress;
    setAnswers(prev => ({ ...prev, stressors: normalized }));
  }

  const totalSessions = plan ? plan.flatMap(d => d.sessions || []).length : 0;
  const doneSessions = Object.values(checked).filter(Boolean).length;

  return (
    <div className="pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px 12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>📋 Weekfocus</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Week {weekKey.split('-W')[1]} · {formatDateShort(monday)} – {formatDateShort(sunday)}</div>
        </div>
        {phase === 'plan' && <button className="btn btn-sm" onClick={() => setPhase('form')}>✏️ Aanpassen</button>}
      </div>

      {phase === 'form' ? (
        <>
          <div className="card" style={{ marginBottom: 10 }}><div className="card-body">
            <div className="card-title" style={{ marginBottom: 8 }}>⚡ Energie deze week</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => <button key={n} onClick={() => setAnswers(p => ({ ...p, energy: n }))} style={{ flex: 1, padding: 9, border: 0, borderRadius: 8, background: answers.energy === n ? 'var(--sage)' : 'var(--border)', color: answers.energy === n ? '#fff' : 'var(--text)', fontWeight: 700 }}>{['😴','😐','🙂','😊','🔥'][n-1]}</button>)}
            </div>
          </div></div>

          <div className="card" style={{ marginBottom: 10 }}><div className="card-body">
            <div className="card-title" style={{ marginBottom: 8 }}>😴 Slaapkwaliteit</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1,2,3,4,5].map(n => <button key={n} onClick={() => setAnswers(p => ({ ...p, sleepQuality: n }))} style={{ flex: 1, padding: 8, border: 0, borderRadius: 8, background: answers.sleepQuality === n ? '#1D4ED8' : 'var(--border)', color: answers.sleepQuality === n ? '#fff' : 'var(--text)', fontWeight: 700 }}>{n}</button>)}
            </div>
          </div></div>

          <div className="card" style={{ marginBottom: 10 }}><div className="card-body">
            <div className="card-title">🗓️ Vrije trainingsmomenten: {answers.freeSlots}</div>
            <input type="range" min="1" max="7" value={answers.freeSlots} onChange={e => setAnswers(p => ({ ...p, freeSlots: Number(e.target.value) }))} style={{ width: '100%', accentColor: 'var(--sage)', marginTop: 10 }} />
          </div></div>

          <div className="card" style={{ marginBottom: 10 }}><div className="card-body">
            <div className="card-title" style={{ marginBottom: 8 }}>💭 Belastende factoren</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {STRESS_OPTIONS.map(o => {
                const active = answers.stressors.includes(o.id);
                return <button key={o.id} onClick={() => toggleStressor(o.id)} style={{ padding: '6px 10px', borderRadius: 20, border: 0, background: active ? 'var(--rust)' : 'var(--border)', color: active ? '#fff' : 'var(--text)', fontSize: 12 }}>{o.emoji} {o.label}</button>;
              })}
            </div>
          </div></div>

          <div className="card" style={{ marginBottom: 14 }}><div className="card-body">
            <div className="card-title" style={{ marginBottom: 6 }}>📌 Afspraken / context</div>
            <textarea rows="3" value={answers.commitments} onChange={e => setAnswers(p => ({ ...p, commitments: e.target.value }))} placeholder="Bijv. drukke werkdag, reis, afspraak…" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontFamily: 'inherit' }} />
          </div></div>

          <button className="btn btn-rust btn-full" onClick={generatePlan}>Maak weekfocus</button>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 10 }}><div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{doneSessions}/{totalSessions} sessies afgevinkt</div>
            {plan?.map(day => (
              <div key={day.date} style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: day.sessions?.length ? 6 : 0 }}>
                  <strong style={{ width: 24 }}>{day.day}</strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDateShort(day.date)}</span>
                </div>
                {day.sessions?.length ? day.sessions.map(s => (
                  <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 32, padding: '4px 0', fontSize: 12 }}>
                    <input type="checkbox" checked={!!checked[s.id]} onChange={() => toggleCheck(s.id)} />
                    <span>{s.emoji} {s.label} · {s.duration}</span>
                  </label>
                )) : <div style={{ marginLeft: 32, fontSize: 11, color: 'var(--muted)' }}>Geen training gepland</div>}
              </div>
            ))}
          </div></div>

          <div className="card"><div className="card-body">
            <div className="card-title" style={{ marginBottom: 6 }}>📝 Weeknotitie</div>
            <textarea rows="3" value={note} onChange={e => { setNote(e.target.value); save({ note: e.target.value }); }} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontFamily: 'inherit' }} />
          </div></div>
        </>
      )}
    </div>
  );
}
