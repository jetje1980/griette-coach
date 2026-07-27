import React, { useState, useEffect } from 'react';
import { HABITS, MEDS, BP, PERSONAL_EVENTS, PRN_MEDS, SUPPLEMENTS, USER } from '../config';

const AJOVI_KEY    = 'gc_ajovi_next';
const AJOVI_HIST   = 'gc_ajovi_history';
const MIGRAINE_TRIGGERS = [
  { id: 'hormonen',  label: 'Hormonen/cyclus', emoji: '🌙' },
  { id: 'slaap',     label: 'Slaap',            emoji: '😴' },
  { id: 'inspanning',label: 'Inspanning',        emoji: '🏃' },
  { id: 'stress',    label: 'Stress',            emoji: '😤' },
  { id: 'weer',      label: 'Weer/barometer',    emoji: '🌩️' },
  { id: 'voeding',   label: 'Voeding',           emoji: '🍷' },
  { id: 'onbekend',  label: 'Onbekend',          emoji: '❓' },
];

function nextFirstOfMonth(from) {
  const d = new Date(from);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
}

function AjoviTracker() {
  const today = new Date().toISOString().slice(0, 10);
  const [nextDate, setNextDate] = useState(() => localStorage.getItem(AJOVI_KEY) || '2026-06-01');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AJOVI_HIST) || '[]'); } catch { return []; }
  });
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(nextDate);
  const [confirmed, setConfirmed] = useState(false);

  const daysTo = Math.floor((new Date(nextDate) - new Date(today)) / 86400000);
  const lastGiven = history[0];
  const daysSinceLast = lastGiven ? Math.floor((new Date(today) - new Date(lastGiven.date)) / 86400000) : null;

  function markGiven() {
    const updated = [{ date: today }, ...history].slice(0, 24);
    const nxt = nextFirstOfMonth(today);
    localStorage.setItem(AJOVI_HIST, JSON.stringify(updated));
    localStorage.setItem(AJOVI_KEY, nxt);
    setHistory(updated);
    setNextDate(nxt);
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  }

  function saveDate() {
    localStorage.setItem(AJOVI_KEY, editVal);
    setNextDate(editVal);
    setEditing(false);
  }

  const urgent = daysTo >= -2 && daysTo <= 2;
  const overdue = daysTo < -2;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#7C3AED' }} />
        <div className="card-title">💜 Ajovi (migrainepreventie)</div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
          background: overdue ? 'var(--alert-l)' : urgent ? '#F3E8FF' : 'var(--border)',
          color: overdue ? 'var(--alert)' : urgent ? '#7C3AED' : 'var(--muted)',
        }}>
          {overdue ? `${Math.abs(daysTo)}d te laat` : daysTo === 0 ? 'vandaag!' : `over ${daysTo}d`}
        </span>
      </div>
      <div className="card-body">
        {!editing ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12 }}>
                Volgende prik: <strong style={{ color: urgent || overdue ? '#7C3AED' : 'var(--text)' }}>{nextDate}</strong>
              </div>
              {daysSinceLast != null && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Laatste: {lastGiven.date} ({daysSinceLast} dagen geleden)
                </div>
              )}
            </div>
            <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setEditVal(nextDate); setEditing(true); }}>
              ✏️ Aanpassen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
            <input type="date" value={editVal} onChange={e => setEditVal(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-rust btn-sm" onClick={saveDate}>✓</button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-full"
            style={{ background: '#7C3AED', color: 'white', fontWeight: 700, fontSize: 12 }}
            onClick={markGiven}
          >
            💜 Ajovi vandaag gegeven
          </button>
        </div>
        {confirmed && <div className="saved-note">✓ Geregistreerd! Volgende: {nextDate}</div>}
        {history.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
            Eerdere prikken: {history.slice(0, 6).map(h => h.date).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

const SYMPTOMS = [
  { id: 'symptom_brainfog',   label: 'Hersenmist',    emoji: '🌫️' },
  { id: 'symptom_exhaustion', label: 'Zware moeheid', emoji: '🪫'  },
  { id: 'symptom_breathless', label: 'Kortademig',    emoji: '💨'  },
  { id: 'symptom_pain',       label: 'Spier/gewricht',emoji: '🦴'  },
  { id: 'symptom_headache',   label: 'Hoofdpijn',     emoji: '🤕'  },
  { id: 'symptom_hayfever',   label: 'Hooikoorts',    emoji: '🌿'  },
  { id: 'symptom_overdrive',  label: 'Overdrive/hyper',emoji: '🔴🧠'},
  { id: 'symptom_pem',        label: 'PEM-crash',     emoji: '⚡🛑' },
];

const PRIK_SCHEMA = [
  { date: '2026-06-05', nr: 5,  label: 'vr 5 jun'  },
  { date: '2026-06-16', nr: 6,  label: 'ma 16 jun' },
  { date: '2026-06-23', nr: 7,  label: 'ma 23 jun' },
  { date: '2026-06-30', nr: 8,  label: 'ma 30 jun' },
  { date: '2026-07-06', nr: 9,  label: 'ma 6 jul'  },
  { date: '2026-07-17', nr: 10, label: 'vr 17 jul' },
  { date: '2026-07-25', nr: 11, label: 'vr 25 jul' },
];
const VACATION_DATE = '2026-07-25';
const GOAL_WEIGHT   = 55;

function BpAlert({ sys, dia }) {
  if (!sys) return null;
  if (sys >= BP.red_sys || dia >= BP.red_dia) return (
    <div className="alert-box red">
      <span className="alert-icon">🚨</span>
      <div className="alert-text">
        <strong>Bloeddruk ROOD — bel direct uw arts</strong>
        Systolisch ≥{BP.red_sys} of diastolisch ≥{BP.red_dia} mmHg vereist onmiddellijke actie.
      </div>
    </div>
  );
  if (sys >= BP.orange_sys || dia >= BP.orange_dia) return (
    <div className="alert-box orange">
      <span className="alert-icon">⚠️</span>
      <div className="alert-text">
        <strong>Bloeddruk verhoogd — let op</strong>
        Verlaag zout, rust, en meld dit bij uw volgende artsbezoek.
      </div>
    </div>
  );
  return null;
}

function GlassTracker({ glasses, onChange }) {
  const count = glasses || 0;
  return (
    <div>
      <div className="glass-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <button
            key={i}
            className={`glass-btn ${i < count ? 'filled' : ''}`}
            onClick={() => onChange(i < count ? i : i + 1)}
            title={`${(i + 1) * 250}ml`}
          >
            💧
          </button>
        ))}
      </div>
      <div className="glass-meta">{count}/8 glazen · {count * 250}ml</div>
    </div>
  );
}

export default function CheckIn({ log, saveField, saveFields, currentDate, logs, tip, isFuture, deleteLog, syncStatus }) {
  const [weight, setWeight] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [bpHr, setBpHr] = useState('');
  const [bpTime, setBpTime] = useState('');
  const [steps, setSteps] = useState('');
  const [hrRest, setHrRest] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [batteryStart, setBatteryStart] = useState('');
  const [batteryEnd, setBatteryEnd] = useState('');
  const [trainingDuration, setTrainingDuration] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteTimer, setNoteTimer] = useState(null);
  const [cycleStart, setCycleStart] = useState(() => localStorage.getItem('gc_cycle_start') || null);
  const [cycleHistory, setCycleHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gc_cycle_history') || '[]'); } catch { return []; }
  });
  const [cycleManualDate, setCycleManualDate] = useState('');
  const [showCycleHistory, setShowCycleHistory] = useState(false);

  useEffect(() => {
    setWeight(log?.weight ?? '');
    setBpSys(log?.bp_sys ?? '');
    setBpDia(log?.bp_dia ?? '');
    setBpHr(log?.bp_hr ?? '');
    setBpTime(log?.bp_time ?? '');
    setSteps(log?.steps ?? '');
    setHrRest(log?.hr_rest ?? '');
    setSleepHours(log?.sleep_hours ?? '');
    setBatteryStart(log?.battery_start ?? '');
    setBatteryEnd(log?.battery_end ?? '');
    setTrainingDuration(log?.training_duration ?? '');
  }, [log, currentDate]);

  // Sprint calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const daysToVacation = Math.max(0, Math.floor((new Date(VACATION_DATE) - new Date(todayStr)) / 86400000));
  const weeksToVacation = (daysToVacation / 7).toFixed(1);

  const START_DATE  = '2026-05-27';
  const MIN_WEIGHT  = 45;

  const weightEntries = Object.values(logs || {})
    .filter(l => l.weight && l.date >= START_DATE)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weightEntries.length ? weightEntries[weightEntries.length - 1].weight : null;

  const projectedWeight = (() => {
    if (weightEntries.length < 2) return null;
    const first = weightEntries[0], last = weightEntries[weightEntries.length - 1];
    const days = Math.max(1, Math.floor((new Date(last.date) - new Date(first.date)) / 86400000));
    const dailyChange = (last.weight - first.weight) / days;
    // Cap at max realistic loss: 1 kg/week = 0.143 kg/day
    const cappedChange = Math.max(dailyChange, -0.143);
    return +(last.weight + cappedChange * daysToVacation).toFixed(1);
  })();

  const weeklyNeeded = latestWeight && daysToVacation > 0
    ? +(((latestWeight - GOAL_WEIGHT) / daysToVacation) * 7).toFixed(2)
    : null;

  // Prik calculations
  const volgendePrik = PRIK_SCHEMA.find(p => p.date > todayStr);
  const huidigePrikNr = PRIK_SCHEMA.filter(p => p.date <= todayStr).slice(-1)[0]?.nr ?? 4;
  const dagenTotPrik = volgendePrik
    ? Math.floor((new Date(volgendePrik.date) - new Date(todayStr)) / 86400000)
    : null;

  // Cycle — single source of truth: all dates merged, sorted desc, max 36
  const allCycleDates = [...new Set([
    ...(cycleStart ? [cycleStart] : []),
    ...cycleHistory,
  ])].sort((a, b) => b.localeCompare(a));

  const saveAllCycleDates = (dates) => {
    const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a)).slice(0, 36);
    const newStart = sorted[0] || null;
    const newHist  = sorted.slice(1);
    if (newStart) localStorage.setItem('gc_cycle_start', newStart);
    else localStorage.removeItem('gc_cycle_start');
    localStorage.setItem('gc_cycle_history', JSON.stringify(newHist));
    setCycleStart(newStart);
    setCycleHistory(newHist);
  };

  const cycleDay = cycleStart
    ? Math.floor((new Date(todayStr) - new Date(cycleStart)) / 86400000) + 1
    : null;

  // Average cycle length from intervals (filter outliers 18-55 days)
  const avgCycleLength = (() => {
    const sorted = [...allCycleDates].sort((a, b) => a.localeCompare(b));
    if (sorted.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < sorted.length; i++)
      intervals.push(Math.floor((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000));
    const valid = intervals.filter(d => d >= 18 && d <= 55);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
  })();

  const nextExpectedPeriod = cycleStart && avgCycleLength
    ? (() => { const d = new Date(cycleStart); d.setDate(d.getDate() + avgCycleLength); return d.toISOString().slice(0, 10); })()
    : null;

  const daysToNextPeriod = nextExpectedPeriod
    ? Math.floor((new Date(nextExpectedPeriod) - new Date(todayStr)) / 86400000)
    : null;

  const startMenstruatie = (date = todayStr) => saveAllCycleDates([...allCycleDates, date]);

  const addCycleDate = () => {
    if (!cycleManualDate) return;
    saveAllCycleDates([...allCycleDates, cycleManualDate]);
    setCycleManualDate('');
  };

  const deleteCycleDate = (date) => saveAllCycleDates(allCycleDates.filter(d => d !== date));

  // Cycle-weight deviation map: cycleDay → avg kg above/below that cycle's mean
  const cycleWeightDeviationMap = (() => {
    if (allCycleDates.length < 3) return {};
    const allStartsSorted = [...allCycleDates].sort((a, b) => a.localeCompare(b));
    const entries = Object.values(logs || {}).filter(e => e.weight && e.date).sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length < 10) return {};
    const withDay = entries.map(e => {
      const starts = allStartsSorted.filter(s => s <= e.date);
      if (!starts.length) return null;
      const start = starts[starts.length - 1];
      const day = Math.floor((new Date(e.date) - new Date(start)) / 86400000) + 1;
      return day >= 1 && day <= 35 ? { weight: e.weight, cycleDay: day, cycleStart: start } : null;
    }).filter(Boolean);
    if (!withDay.length) return {};
    const means = {};
    withDay.forEach(e => { if (!means[e.cycleStart]) means[e.cycleStart] = []; means[e.cycleStart].push(e.weight); });
    Object.keys(means).forEach(k => { const v = means[k]; means[k] = v.reduce((s, x) => s + x, 0) / v.length; });
    const devs = {};
    withDay.forEach(e => {
      const m = means[e.cycleStart]; if (!m) return;
      if (!devs[e.cycleDay]) devs[e.cycleDay] = [];
      devs[e.cycleDay].push(+(e.weight - m).toFixed(2));
    });
    const result = {};
    Object.entries(devs).forEach(([d, arr]) => {
      result[parseInt(d)] = +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2);
    });
    return result;
  })();

  // Project which cycle day it will be on a future date (wraps through full cycles)
  const getCycleDayAt = (targetDate) => {
    if (!cycleStart || !avgCycleLength) return null;
    const days = Math.floor((new Date(targetDate) - new Date(cycleStart)) / 86400000);
    if (days < 0) return null;
    return (days % avgCycleLength) + 1;
  };

  // Get phase-average deviation for a cycle day (falls back to phase mean when exact day unknown)
  const getCycleDeviation = (cycleDay) => {
    if (!cycleDay || Object.keys(cycleWeightDeviationMap).length === 0) return null;
    if (cycleWeightDeviationMap[cycleDay] !== undefined) return cycleWeightDeviationMap[cycleDay];
    // Fallback: average of the phase this day belongs to
    const phases = [[1, 5], [6, 13], [14, 16], [17, 35]];
    for (const [from, to] of phases) {
      if (cycleDay >= from && cycleDay <= to) {
        const vals = Object.entries(cycleWeightDeviationMap)
          .filter(([d]) => parseInt(d) >= from && parseInt(d) <= to)
          .map(([, v]) => v);
        return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : null;
      }
    }
    return null;
  };

  const saveWeight = () => {
    const w = parseFloat(weight);
    if (!isNaN(w) && w > 30 && w < 200) saveField('weight', w);
  };

  const saveBP = () => {
    const s = parseInt(bpSys), d = parseInt(bpDia);
    if (!isNaN(s) && !isNaN(d) && s > 50 && d > 30) {
      const hr = parseInt(bpHr);
      saveFields({
        bp_sys: s,
        bp_dia: d,
        bp_hr: !isNaN(hr) && hr > 30 ? hr : null,
        bp_time: bpTime || null,
      });
    }
  };

  const saveNote = (val) => {
    if (noteTimer) clearTimeout(noteTimer);
    const t = setTimeout(() => {
      saveField('notes', val);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }, 800);
    setNoteTimer(t);
  };

  const toggleHabit   = (id) => saveField(id, log?.[id] ? 0 : 1);
  const toggleMed     = (id) => saveField(id, log?.[id] ? 0 : 1);
  const toggleSymptom = (id) => saveField(id, log?.[id] ? 0 : 1);
  const toggleEiwit   = (id) => saveField(id, log?.[id] ? 0 : 1);

  const saveSteps = () => {
    const v = parseInt(steps);
    if (!isNaN(v) && v >= 0) saveField('steps', v);
  };

  const saveHrRest = () => {
    const v = parseInt(hrRest);
    if (!isNaN(v) && v > 30 && v < 200) saveField('hr_rest', v);
  };

  const saveBattery = (field, raw) => {
    const v = parseInt(raw);
    if (!isNaN(v) && v >= 0 && v <= 100) saveField(field, v);
  };

  const saveSleepHours = (v) => saveField('sleep_hours', parseFloat(v));

  const saveTrainingDuration = () => {
    const v = parseInt(trainingDuration);
    if (!isNaN(v) && v > 0) saveField('training_duration', v);
  };

  function batteryColor(v) {
    if (v == null) return 'var(--border)';
    if (v >= 70) return 'var(--sage)';
    if (v >= 40) return 'var(--gold)';
    return 'var(--alert)';
  }

  function batteryLabel(v) {
    if (v == null) return '';
    if (v >= 80) return 'uitstekend';
    if (v >= 60) return 'goed';
    if (v >= 40) return 'matig';
    if (v >= 20) return 'laag';
    return 'uitgeput';
  }

  const checkedHabits  = HABITS.filter(h => log?.[h.id]).length;
  const checkedMeds    = MEDS.filter(m => !m.weekly && log?.[m.id]).length;
  const activeSymptoms = SYMPTOMS.filter(s => log?.[s.id]).length;

  const stepGoal  = 8000;
  const stepPct   = Math.min(100, Math.round(((log?.steps || 0) / stepGoal) * 100));
  const stepColor = stepPct >= 100 ? 'var(--sage)' : stepPct >= 60 ? 'var(--gold)' : 'var(--rust)';

  const eiwitItems = [
    { id: 'protein_breakfast', emoji: '🥚', label: 'Eiwitrijk ontbeten' },
    { id: 'protein_lunch',     emoji: '🍗', label: 'Eiwitrijke lunch'   },
    { id: 'protein_day',       emoji: '🫙', label: 'Dagdoel gehaald'    },
  ];
  const checkedEiwit = eiwitItems.filter(e => log?.[e.id]).length;

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setConfirmDelete(false);
    if (deleteLog) await deleteLog();
  };

  const NL_DAYS_FULL   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const NL_MONTHS_FULL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const parsedDate = new Date(currentDate + 'T12:00:00');
  const dateLabel  = `${NL_DAYS_FULL[parsedDate.getDay()]} ${parsedDate.getDate()} ${NL_MONTHS_FULL[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
  const isActuallyToday = currentDate === todayStr;
  const isPast = currentDate < todayStr;

  return (
    <div className="pane">

      {/* Datum banner — altijd zichtbaar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: isFuture ? '#FEF3C7' : isPast ? 'var(--card)' : 'var(--sage-l)',
        border: `1.5px solid ${isFuture ? '#F59E0B' : isPast ? 'var(--border)' : 'var(--sage)'}`,
        borderRadius: 12, padding: '10px 14px', marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>
            {isFuture ? '📅' : isPast ? '📋' : '✏️'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: isFuture ? '#92400E' : 'var(--text)' }}>
              {isFuture ? 'Toekomstige datum — plannen' : isPast ? 'Eerdere dag — aanvullen of corrigeren' : 'Vandaag invullen'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: isFuture ? '#78350F' : 'var(--text)', marginTop: 1 }}>
              {dateLabel}
            </div>
          </div>
        </div>
        {isFuture && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FDE68A', padding: '3px 10px', borderRadius: 99 }}>
            gepland
          </span>
        )}
      </div>

      {/* Sprint-widget */}
      {daysToVacation > 0 && (
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--card) 0%, var(--gold-l) 100%)' }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--gold)' }} />
            <div className="card-title">🏖️ Sprint naar vakantie</div>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>{daysToVacation} dagen</span>
          </div>
          <div className="card-body">
            {/* Gewicht rij */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Nu</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--rust)' }}>{latestWeight ?? '—'} kg</div>
              </div>
              <div style={{ textAlign: 'center', alignSelf: 'center', color: 'var(--muted)', fontSize: 16 }}>→</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Doel</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--sage)' }}>{GOAL_WEIGHT} kg</div>
              </div>
              {projectedWeight && (
                <>
                  <div style={{ textAlign: 'center', alignSelf: 'center', color: 'var(--muted)', fontSize: 16 }}>→</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Prognose 25/7</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: projectedWeight <= 55 ? 'var(--sage)' : 'var(--gold)' }}>{projectedWeight} kg</div>
                  </div>
                </>
              )}
            </div>

            {weeklyNeeded != null && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                Voor doel 55 kg: <strong style={{ color: 'var(--rust)' }}>−{weeklyNeeded} kg/week</strong> nodig · {weeksToVacation} weken te gaan
                {weightEntries.length < 7 && <span style={{ color: 'var(--muted)', fontSize: 10 }}> (prognose accurater na meer wegingen)</span>}
              </div>
            )}

            {/* Prik-reminder */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11 }}>
                💉 Prik <strong>#{huidigePrikNr}</strong> huidig
                {volgendePrik && (
                  <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                    · #{volgendePrik.nr} op {volgendePrik.label}
                  </span>
                )}
              </div>
              {dagenTotPrik != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: dagenTotPrik <= 2 ? 'var(--rust-l)' : 'var(--border)',
                  color: dagenTotPrik <= 2 ? 'var(--rust)' : 'var(--muted)',
                }}>
                  over {dagenTotPrik} dag{dagenTotPrik !== 1 ? 'en' : ''}
                </span>
              )}
              {!volgendePrik && (
                <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700 }}>laatste prik voor vakantie!</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persoonlijke events */}
      {(() => {
        const upcoming = PERSONAL_EVENTS
          .filter(e => e.endDate >= todayStr)
          .map(e => ({
            ...e,
            daysTo: Math.max(0, Math.floor((new Date(e.startDate) - new Date(todayStr)) / 86400000)),
            active: e.startDate <= todayStr && e.endDate >= todayStr,
          }));
        if (!upcoming.length) return null;
        return (
          <div className="card">
            <div className="card-header">
              <div className="card-accent" style={{ background: 'var(--rust)' }} />
              <div className="card-title">🗓️ Aankomende events</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map(e => {
                // Weight projection
                const eventWeightEntries = Object.values(logs || {})
                  .filter(l => l.weight && l.date >= START_DATE)
                  .sort((a, b) => a.date.localeCompare(b.date));
                const lastW = eventWeightEntries.length ? eventWeightEntries[eventWeightEntries.length - 1].weight : null;
                const projAtEvent = (() => {
                  if (!e.daysTo && !e.active) return null;
                  const daysAhead = e.active ? 0 : e.daysTo;
                  if (eventWeightEntries.length >= 2) {
                    // Use actual logged trend
                    const first = eventWeightEntries[0], last2 = eventWeightEntries[eventWeightEntries.length - 1];
                    const days = Math.max(1, Math.floor((new Date(last2.date) - new Date(first.date)) / 86400000));
                    const rate = Math.max((last2.weight - first.weight) / days, -0.143);
                    return +(last2.weight + rate * daysAhead).toFixed(1);
                  }
                  // Fallback: use start weight + expected programme rate
                  const programDays = Math.max(1, Math.floor((new Date(todayStr) - new Date(START_DATE)) / 86400000));
                  const expectedRate = (GOAL_WEIGHT - USER.startWeight) / USER.durationDays; // e.g. (55-62.7)/70
                  const estNow = +(USER.startWeight + expectedRate * programDays).toFixed(1);
                  const proj = +(estNow + Math.max(expectedRate, -0.143) * daysAhead).toFixed(1);
                  return proj;
                })();
                const wkNeeded = lastW && e.daysTo > 0 ? +(((lastW - GOAL_WEIGHT) / e.daysTo) * 7).toFixed(2) : null;

                // Cycle context at event date
                const eventCycleDay = getCycleDayAt(e.startDate);
                const eventCycleDev = getCycleDeviation(eventCycleDay);
                const cyclePhaseAtEvent = eventCycleDay
                  ? eventCycleDay <= 5 ? '🩸 menstruatie'
                  : eventCycleDay <= 13 ? '🌱 folliculair'
                  : eventCycleDay <= 16 ? '✨ ovulatie'
                  : '🌙 luteaal'
                  : null;
                // Adjusted prognosis (trend - cycle deviation = underlying weight)
                const projAdjusted = projAtEvent && eventCycleDev != null && Math.abs(eventCycleDev) >= 0.15
                  ? +(projAtEvent - eventCycleDev).toFixed(1)
                  : null;

                const strategy = (() => {
                  if (!e.daysTo || e.active) return null;
                  if (e.daysTo <= 7) return 'Focus: herstel, lichte beweging, voldoende slaap en eiwitten.';
                  if (e.daysTo <= 14) return 'Bouw training af de laatste week. Prioriteit: goed slapen, eiwitten, hydratatie.';
                  return 'Regulier schema. 3×/week zone B training, dagelijks eiwitdoel halen.';
                })();

                return (
                <div key={e.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  padding: '10px', borderRadius: 10,
                  background: e.active ? `${e.color}18` : 'var(--bg)',
                  border: `1.5px solid ${e.active ? e.color : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 22, lineHeight: 1 }}>{e.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: e.color }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {e.startDate === e.endDate
                          ? new Date(e.startDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
                          : `${new Date(e.startDate).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })} – ${new Date(e.endDate).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' })}`
                        }
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>{e.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>🎯 {e.goal}</div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                      {e.active ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: e.color, background: `${e.color}20`, padding: '3px 7px', borderRadius: 99 }}>NU!</span>
                      ) : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: e.color, lineHeight: 1 }}>{e.daysTo}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted)' }}>dag{e.daysTo !== 1 ? 'en' : ''}</div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Strategy + cycle strip */}
                  {(projAtEvent || strategy || cyclePhaseAtEvent) && !e.active && (
                    <div style={{ background: `${e.color}10`, borderRadius: 7, padding: '6px 8px', fontSize: 11 }}>
                      {projAtEvent && (
                        <div style={{ marginBottom: 3 }}>
                          📊 Prognose op {e.startDate.slice(5).replace('-', '/')}: <strong style={{ color: projAtEvent < MIN_WEIGHT ? 'var(--alert)' : e.color }}>{projAtEvent} kg</strong>
                          {eventWeightEntries.length < 2 && <span style={{ color: 'var(--muted)', fontSize: 10 }}> (schatting o.b.v. startgewicht)</span>}
                          {projAtEvent < MIN_WEIGHT
                            ? <span style={{ color: 'var(--alert)', fontWeight: 700 }}> ⚠️ onder jouw minimum (45 kg) — tempo mag omlaag</span>
                            : wkNeeded > 0 && <span style={{ color: 'var(--muted)' }}> · nodig: −{wkNeeded} kg/wk</span>
                          }
                        </div>
                      )}
                      {cyclePhaseAtEvent && (
                        <div style={{ color: 'var(--muted)', marginBottom: strategy ? 3 : 0 }}>
                          🌙 Cyclus dag {eventCycleDay} ({cyclePhaseAtEvent})
                          {eventCycleDev != null && Math.abs(eventCycleDev) >= 0.15 && (
                            <span style={{ color: eventCycleDev > 0 ? 'var(--alert)' : 'var(--sage)', fontWeight: 600, marginLeft: 4 }}>
                              · typisch {eventCycleDev > 0 ? '+' : ''}{eventCycleDev} kg vocht
                            </span>
                          )}
                          {projAdjusted && (
                            <span style={{ color: 'var(--muted)', marginLeft: 4 }}>
                              → onderliggende trend: <strong>{projAdjusted} kg</strong>
                            </span>
                          )}
                        </div>
                      )}
                      {strategy && <div style={{ color: 'var(--muted)' }}>💡 {strategy}</div>}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <AjoviTracker />

      <BpAlert sys={log?.bp_sys} dia={log?.bp_dia} />

      {/* Gewicht */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">⚖️ Gewicht</div>
        </div>
        <div className="card-body">
          <div className="input-row">
            <input
              type="number"
              step="0.1"
              placeholder="kg"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveWeight()}
              style={{ flex: 1 }}
            />
            <span className="unit">kg</span>
            <button className="btn btn-rust btn-sm" onClick={saveWeight}>✓</button>
          </div>
          {log?.weight && <div className="saved-note">✓ {log.weight} kg opgeslagen</div>}
        </div>
      </div>

      {/* Lichaamssignalen */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#8B5CF6' }} />
          <div className="card-title">🫁 Lichaamssignalen</div>
          {(log?.body_bloat > 0 || log?.body_hotflash || log?.body_nightsweat) && (
            <span style={{ fontSize: 10, background: '#F3E8FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 99 }}>gelogd</span>
          )}
        </div>
        <div className="card-body">
          <div className="scale-label">OPGEBLAZEN GEVOEL</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 12 }}>
            {[
              { v: 0, label: 'Geen',  emoji: '😊' },
              { v: 1, label: 'Licht', emoji: '😐' },
              { v: 2, label: 'Matig', emoji: '😕' },
              { v: 3, label: 'Sterk', emoji: '😣' },
            ].map(opt => (
              <button key={opt.v} className="btn" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 4px', gap: 2,
                background: log?.body_bloat === opt.v ? '#F3E8FF' : 'var(--bg)',
                borderColor: log?.body_bloat === opt.v ? '#8B5CF6' : 'var(--border)',
                color: log?.body_bloat === opt.v ? '#6D28D9' : 'var(--text)',
              }} onClick={() => saveField('body_bloat', log?.body_bloat === opt.v ? null : opt.v)}>
                <span style={{ fontSize: 14 }}>{opt.emoji}</span>
                <span style={{ fontSize: 10 }}>{opt.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'body_hotflash',   label: 'Opvliegers vandaag',            emoji: '🔥' },
              { id: 'body_nightsweat', label: 'Nachtelijk zweten (gisternacht)', emoji: '💦' },
            ].map(item => (
              <div key={item.id}
                className={`habit-btn ${log?.[item.id] ? 'on' : ''}`}
                style={{
                  width: '100%', justifyContent: 'flex-start', gap: 10,
                  ...(log?.[item.id] ? { background: '#F3E8FF', borderColor: '#8B5CF6', color: '#6D28D9' } : {}),
                }}
                onClick={() => saveField(item.id, log?.[item.id] ? 0 : 1)}
              >
                <div className="habit-emoji">{item.emoji}</div>
                <div className="habit-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
            Opgeblazen gevoel en opvliegers corrigeren het gewichtspatroon voor vocht en perimenopauzale schommelingen.
          </div>
        </div>
      </div>

      {/* Cyclus */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#C084FC' }} />
          <div className="card-title">🌙 Cyclus</div>
          {cycleDay != null && (
            <span style={{ fontSize: 11, color: '#9333EA', fontWeight: 700, background: '#F3E8FF', padding: '2px 8px', borderRadius: 99 }}>
              {cycleDay <= 5 ? `🩸 Dag ${cycleDay}` : cycleDay > 45 ? `${cycleDay}d — peri` : `Dag ${cycleDay}`}
            </span>
          )}
        </div>
        <div className="card-body">

          {/* Huidige fase */}
          {cycleStart && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              Laatste menstruatie: <strong>{cycleStart}</strong>
              {cycleDay > 45 && <span style={{ color: '#9333EA', marginLeft: 6 }}>· langere cyclus (perimenopauzaal)</span>}
              {cycleDay <= 5 && <span style={{ color: 'var(--alert)', marginLeft: 6 }}>· ongesteld</span>}
              {cycleDay > 5 && cycleDay <= 13 && <span style={{ color: 'var(--sage)', marginLeft: 6 }}>· folliculaire fase</span>}
              {cycleDay >= 14 && cycleDay <= 16 && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· mogelijke ovulatie</span>}
              {cycleDay > 16 && cycleDay <= 28 && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>· luteale fase</span>}
            </div>
          )}

          {/* Verwachte volgende menstruatie */}
          {nextExpectedPeriod && (
            <div style={{ background: '#F3E8FF', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED' }}>
                🩸 Verwacht: {nextExpectedPeriod}
                {daysToNextPeriod != null && (
                  <span style={{ fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                    {daysToNextPeriod < 0
                      ? `(${Math.abs(daysToNextPeriod)}d te laat)`
                      : daysToNextPeriod === 0
                        ? '(vandaag)'
                        : `(over ${daysToNextPeriod} dagen)`}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#9333EA', marginTop: 2 }}>
                Gem. cycluslengte: {avgCycleLength} dagen · op basis van {allCycleDates.length} geregistreerde cycli
              </div>
            </div>
          )}

          {/* Ongesteld vandaag knop */}
          <button
            className="btn btn-full"
            style={{ background: '#F3E8FF', color: '#7C3AED', border: '1.5px solid #C084FC', fontWeight: 700, fontSize: 13 }}
            onClick={() => startMenstruatie()}
          >
            🩸 Ongesteld geworden vandaag
          </button>

          {!cycleStart && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
              Tik als je ongesteld bent geworden — de app bijhoudt dan je cyclusdag automatisch.
            </div>
          )}

          {/* Datum toevoegen — altijd zichtbaar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="date"
              value={cycleManualDate}
              onChange={e => setCycleManualDate(e.target.value)}
              max={todayStr}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
            <button
              className="btn btn-rust btn-sm"
              onClick={addCycleDate}
              disabled={!cycleManualDate}
            >
              + Toevoegen
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Voeg datums van afgelopen jaar toe — ze worden allemaal bewaard.
          </div>

          {/* Geschiedenis lijst */}
          {allCycleDates.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 6 }}
                onClick={() => setShowCycleHistory(v => !v)}
              >
                <div className="scale-label" style={{ margin: 0 }}>
                  GESCHIEDENIS ({allCycleDates.length} cycli)
                  {avgCycleLength && <span style={{ fontWeight: 400, marginLeft: 6 }}>· gem. {avgCycleLength}d</span>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{showCycleHistory ? '▲' : '▼'}</span>
              </div>
              {showCycleHistory && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {allCycleDates.map((date, i) => {
                    const olderDate = allCycleDates[i + 1];
                    const cycleLen = olderDate
                      ? Math.floor((new Date(date) - new Date(olderDate)) / 86400000)
                      : null;
                    const isCurrent = date === cycleStart;
                    return (
                      <div key={date} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 10, color: isCurrent ? '#9333EA' : 'var(--muted)', minWidth: 8 }}>
                          {isCurrent ? '●' : '○'}
                        </span>
                        <span style={{
                          flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)',
                          fontWeight: isCurrent ? 700 : 400,
                          color: isCurrent ? '#7C3AED' : 'var(--text)',
                        }}>
                          {date}
                          {isCurrent && <span style={{ fontSize: 10, color: '#9333EA', marginLeft: 6 }}>huidig</span>}
                        </span>
                        {cycleLen && (
                          <span style={{
                            fontSize: 10, color: cycleLen > 45 ? '#9333EA' : cycleLen < 21 ? 'var(--alert)' : 'var(--muted)',
                            minWidth: 42, textAlign: 'right',
                          }}>
                            {cycleLen}d
                          </span>
                        )}
                        <button
                          onClick={() => deleteCycleDate(date)}
                          style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bloeddruk */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--alert)' }} />
          <div className="card-title">❤️ Bloeddruk</div>
        </div>
        <div className="card-body">
          <div className="input-row">
            <input type="number" placeholder="120" value={bpSys} onChange={e => setBpSys(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
            <span className="unit" style={{ fontSize: 18, fontWeight: 800 }}>/</span>
            <input type="number" placeholder="80" value={bpDia} onChange={e => setBpDia(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
            <span className="unit">mmHg</span>
          </div>
          <div className="input-row" style={{ marginTop: 6 }}>
            <input type="number" placeholder="HS bijv. 68" value={bpHr} onChange={e => setBpHr(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
            <span className="unit">bpm</span>
            <input type="time" value={bpTime} onChange={e => setBpTime(e.target.value)} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
            <button className="btn btn-rust btn-sm" onClick={saveBP}>✓</button>
          </div>
          {log?.bp_sys && (
            <div className="saved-note">
              ✓ {log.bp_sys}/{log.bp_dia} mmHg
              {log.bp_hr ? ` · ${log.bp_hr} bpm` : ''}
              {log.bp_time ? ` · ${log.bp_time}` : ''}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
            ⚠️ Direct arts: sys &gt;160 · dia &gt;100 · hoge BD + hoofdpijn
          </div>
        </div>
      </div>

      {/* Activiteit & herstel */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">👣 Activiteit & herstel</div>
        </div>
        <div className="card-body">
          <div className="scale-label">STAPPEN VANDAAG</div>
          <div className="input-row" style={{ marginBottom: 6 }}>
            <input
              type="number"
              step="100"
              placeholder="bijv. 7500"
              value={steps}
              onChange={e => setSteps(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveSteps()}
              style={{ flex: 1 }}
            />
            <span className="unit">stap</span>
            <button className="btn btn-rust btn-sm" onClick={saveSteps}>✓</button>
          </div>
          {log?.steps != null && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>
                <span style={{ color: stepColor, fontWeight: 700 }}>{log.steps.toLocaleString('nl')} stappen</span>
                <span>{stepGoal.toLocaleString('nl')} doel</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stepPct}%`, background: stepColor, borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                {stepPct >= 100 ? '✓ Dagtarget gehaald!' : stepPct >= 60 ? `Nog ${(stepGoal - log.steps).toLocaleString('nl')} stappen` : 'Lichte beweging ook goed voor long covid herstel'}
              </div>
            </div>
          )}

          <div className="scale-label" style={{ marginTop: 4 }}>RUST-HARTSLAG (ochtend)</div>
          <div className="input-row">
            <input
              type="number"
              placeholder="bijv. 62"
              value={hrRest}
              onChange={e => setHrRest(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveHrRest()}
              style={{ flex: 1 }}
            />
            <span className="unit">bpm</span>
            <button className="btn btn-rust btn-sm" onClick={saveHrRest}>✓</button>
          </div>
          {log?.hr_rest && (
            <div className="saved-note">
              ✓ {log.hr_rest} bpm
              {log.hr_rest > 75 && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>⚠️ verhoogd — neem extra rust</span>}
            </div>
          )}

          <div className="scale-label" style={{ marginTop: 12 }}>🔋 BODY BATTERY (Garmin)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {[['Ochtend', 'battery_start', batteryStart, setBatteryStart], ['Avond', 'battery_end', batteryEnd, setBatteryEnd]].map(([label, field, val, setter]) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0" max="100"
                    placeholder="0–100"
                    value={val}
                    onChange={e => setter(e.target.value)}
                    onBlur={() => saveBattery(field, val)}
                    onKeyDown={e => e.key === 'Enter' && saveBattery(field, val)}
                    style={{ flex: 1, textAlign: 'center' }}
                  />
                </div>
                {log?.[field] != null && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${log[field]}%`, background: batteryColor(log[field]), borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 10, color: batteryColor(log[field]), marginTop: 2, fontWeight: 700 }}>
                      {log[field]}% — {batteryLabel(log[field])}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {log?.battery_start != null && log?.battery_end != null && (
            <div className="saved-note" style={{ color: log.battery_end < log.battery_start ? 'var(--alert)' : 'var(--sage)' }}>
              {log.battery_end < log.battery_start
                ? `⚠️ Battery daalde ${log.battery_start - log.battery_end}% vandaag — herstel prioriteit`
                : `✓ Battery +${log.battery_end - log.battery_start}% — goed herstel vandaag`}
            </div>
          )}

          <div className="scale-label" style={{ marginTop: 14 }}>🏋️ TRAINING VANDAAG</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[
              { v: 'A',    label: 'Zone A',  sub: 'Herstel'   },
              { v: 'B',    label: 'Zone B',  sub: 'Aerobic'   },
              { v: 'C',    label: 'Zone C',  sub: 'Intensief' },
              { v: 'rust', label: 'Rust',    sub: 'Geen'      },
            ].map(opt => (
              <button key={opt.v} className="btn" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 4px', gap: 2,
                background: log?.training_zone === opt.v ? 'var(--sage-l)' : 'var(--bg)',
                borderColor: log?.training_zone === opt.v ? 'var(--sage)' : 'var(--border)',
                color: log?.training_zone === opt.v ? 'var(--sage)' : 'var(--text)',
              }} onClick={() => saveField('training_zone', log?.training_zone === opt.v ? null : opt.v)}>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{opt.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{opt.sub}</span>
              </button>
            ))}
          </div>
          {log?.training_zone && log.training_zone !== 'rust' && (
            <div className="input-row" style={{ marginTop: 8 }}>
              <input
                type="number"
                placeholder="minuten"
                value={trainingDuration}
                onChange={e => setTrainingDuration(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTrainingDuration()}
                onBlur={saveTrainingDuration}
                style={{ flex: 1 }}
              />
              <span className="unit">min</span>
              <button className="btn btn-rust btn-sm" onClick={saveTrainingDuration}>✓</button>
            </div>
          )}
          {log?.training_duration > 0 && <div className="saved-note">✓ {log.training_duration} min — Zone {log.training_zone}</div>}

          <div className="scale-label" style={{ marginTop: 12 }}>😤 HERSTELGEVOEL NA GISTEREN</div>
          <div className="scale-row">
            {['😴 Goed', '😐 Matig', '⚡ PEM-achtig'].map((l, i) => (
              <button key={i}
                className={`scale-btn ${log?.training_recovery === i ? 'selected-s' : ''}`}
                style={{ fontSize: 11, padding: '6px 8px' }}
                onClick={() => saveField('training_recovery', log?.training_recovery === i ? null : i)}
              >{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Hoe voel je je */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">⚡ Hoe voel je je?</div>
        </div>
        <div className="card-body">
          <div className="scale-label">ENERGIE</div>
          <div className="scale-row">
            {['🪫','😐','⚡','🚀'].map((e, i) => (
              <button key={i} className={`scale-btn ${log?.energy === i ? 'selected-e' : ''}`} onClick={() => saveField('energy', i)}>{e}</button>
            ))}
          </div>
          <div className="scale-label">MOTIVATIE</div>
          <div className="scale-row">
            {['😩','😑','🙂','🔥'].map((e, i) => (
              <button key={i} className={`scale-btn ${log?.mood === i ? 'selected-m' : ''}`} onClick={() => saveField('mood', i)}>{e}</button>
            ))}
          </div>
          <div className="scale-label">SLAAP KWALITEIT</div>
          <div className="scale-row">
            {['😫','😕','🙂','😴'].map((e, i) => (
              <button key={i} className={`scale-btn ${log?.sleep_quality === i ? 'selected-s' : ''}`} onClick={() => saveField('sleep_quality', i)}>{e}</button>
            ))}
          </div>
          <div className="scale-label" style={{ marginTop: 10 }}>SLAAPUREN</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(h => (
              <button
                key={h}
                className="btn"
                style={{
                  padding: '5px 10px', fontSize: 12, minWidth: 44,
                  background: log?.sleep_hours === h ? 'var(--gold)' : 'var(--bg)',
                  color: log?.sleep_hours === h ? 'white' : 'var(--text)',
                  border: `1.5px solid ${log?.sleep_hours === h ? 'var(--gold)' : 'var(--border)'}`,
                }}
                onClick={() => saveSleepHours(h)}
              >
                {h}u
              </button>
            ))}
          </div>
          {log?.sleep_hours && (
            <div className="saved-note">
              ✓ {log.sleep_hours} uur
              {log.sleep_hours < 6 && <span style={{ color: 'var(--alert)', marginLeft: 6 }}>⚠️ te weinig voor herstel</span>}
              {log.sleep_hours >= 7 && <span style={{ color: 'var(--sage)', marginLeft: 6 }}>✓ goed!</span>}
            </div>
          )}
        </div>
      </div>

      {/* Klachten vandaag */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: activeSymptoms > 0 ? 'var(--alert)' : 'var(--muted)' }} />
          <div className="card-title">
            🩺 Klachten vandaag
            {activeSymptoms > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--alert-l)', color: 'var(--alert)', padding: '1px 6px', borderRadius: 99 }}>{activeSymptoms} actief</span>}
          </div>
        </div>
        <div className="card-body">
          <div className="habit-grid">
            {SYMPTOMS.map(s => (
              <div key={s.id} className={`habit-btn ${log?.[s.id] ? 'on' : ''}`}
                style={log?.[s.id] ? { background: 'var(--alert-l)', borderColor: 'var(--alert)', color: 'var(--alert)' } : {}}
                onClick={() => toggleSymptom(s.id)}
              >
                <div className="habit-emoji">{s.emoji}</div>
                <div className="habit-label">{s.label}</div>
              </div>
            ))}
          </div>
          {log?.symptom_pem && (
            <div className="alert-box orange" style={{ marginTop: 10 }}>
              <span className="alert-icon">⚡</span>
              <div className="alert-text">
                <strong>PEM gemarkeerd</strong> — overweeg morgen rust of alleen lichte wandeling. Long covid vereist pacing.
              </div>
            </div>
          )}
          {activeSymptoms === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Klachtenvrije dag — tik aan wat er speelt</div>
          )}
        </div>
      </div>

      {/* ADHD & pacing */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#6366F1' }} />
          <div className="card-title">🧩 ADHD & pacing</div>
          {log?.adhd_overwhelmed ? (
            <span style={{ fontSize: 10, background: 'var(--alert-l)', color: 'var(--alert)', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>overprikkeld</span>
          ) : log?.adhd_task_load === 2 ? (
            <span style={{ fontSize: 10, background: '#EEF2FF', color: '#4338CA', padding: '1px 6px', borderRadius: 99 }}>veel acties</span>
          ) : null}
        </div>
        <div className="card-body">
          <div className="scale-label">HOEVEEL ACTIES VANDAAG?</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, marginBottom: 12 }}>
            {[
              { v: 0, label: '1–2', sub: 'Rustig' },
              { v: 1, label: '3–4', sub: 'Normaal' },
              { v: 2, label: '5+',  sub: 'Veel' },
            ].map(opt => (
              <button key={opt.v} className="btn" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 4px', gap: 2,
                background: log?.adhd_task_load === opt.v ? '#EEF2FF' : 'var(--bg)',
                borderColor: log?.adhd_task_load === opt.v ? '#6366F1' : 'var(--border)',
                color: log?.adhd_task_load === opt.v ? '#4338CA' : 'var(--text)',
              }} onClick={() => saveField('adhd_task_load', log?.adhd_task_load === opt.v ? null : opt.v)}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{opt.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{opt.sub}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'adhd_break',       label: 'Bewust pauzemoment genomen', emoji: '☕', warn: false },
              { id: 'adhd_one_focus',   label: 'Één ding tegelijk gedaan',   emoji: '🎯', warn: false },
              { id: 'adhd_overwhelmed', label: 'Overprikkeld / verlamd gevoel', emoji: '😵', warn: true  },
            ].map(item => (
              <div key={item.id}
                className={`habit-btn ${log?.[item.id] ? 'on' : ''}`}
                style={{
                  width: '100%', justifyContent: 'flex-start', gap: 10,
                  ...(item.warn && log?.[item.id]
                    ? { background: 'var(--alert-l)', borderColor: 'var(--alert)', color: 'var(--alert)' }
                    : log?.[item.id]
                    ? { background: '#EEF2FF', borderColor: '#6366F1', color: '#4338CA' }
                    : {}),
                }}
                onClick={() => saveField(item.id, log?.[item.id] ? 0 : 1)}
              >
                <div className="habit-emoji">{item.emoji}</div>
                <div className="habit-label">{item.label}</div>
              </div>
            ))}
          </div>

          {log?.adhd_overwhelmed ? (
            <div className="alert-box orange" style={{ marginTop: 10 }}>
              <span className="alert-icon">🧩</span>
              <div className="alert-text">
                <strong>Overprikkeld gemarkeerd</strong> — morgen bewust minder acties. Eén stap is genoeg. Serie kijken is ook herstel.
              </div>
            </div>
          ) : log?.adhd_task_load === 2 ? (
            <div style={{ fontSize: 10, color: '#4338CA', marginTop: 8, background: '#EEF2FF', padding: '8px 10px', borderRadius: 8, lineHeight: 1.6 }}>
              💡 Veel acties = risico op verlammend gevoel. Morgen: max. 2–3 bewuste keuzes plannen.
            </div>
          ) : null}
        </div>
      </div>

      {/* Migraine */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#7C3AED' }} />
          <div className="card-title">
            🧠 Migraine
            {log?.migraine && <span style={{ marginLeft: 6, fontSize: 10, background: '#F3E8FF', color: '#7C3AED', padding: '1px 6px', borderRadius: 99 }}>actief</span>}
          </div>
        </div>
        <div className="card-body">
          <div
            className={`habit-btn ${log?.migraine ? 'on' : ''}`}
            style={{
              width: '100%', justifyContent: 'flex-start', gap: 10,
              ...(log?.migraine ? { background: '#F3E8FF', borderColor: '#7C3AED', color: '#7C3AED' } : {}),
            }}
            onClick={() => saveField('migraine', log?.migraine ? 0 : 1)}
          >
            <div className="habit-emoji">🧠</div>
            <div className="habit-label">Vandaag migraine gehad</div>
          </div>

          {log?.migraine ? (
            <div style={{ marginTop: 10 }}>
              <div className="scale-label">ERNST</div>
              <div className="scale-row">
                {['😬 Licht', '😣 Matig', '🤯 Zwaar'].map((l, i) => (
                  <button key={i}
                    className={`scale-btn ${log?.migraine_severity === i + 1 ? 'selected-m' : ''}`}
                    style={{ fontSize: 11, padding: '6px 8px' }}
                    onClick={() => saveField('migraine_severity', i + 1)}
                  >{l}</button>
                ))}
              </div>

              <div className="scale-label" style={{ marginTop: 8 }}>DUUR (uren)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[1, 2, 4, 6, 8, 12, 24, 48].map(h => (
                  <button key={h} className="btn" style={{
                    padding: '5px 10px', fontSize: 12,
                    background: log?.migraine_hours === h ? '#7C3AED' : 'var(--bg)',
                    color: log?.migraine_hours === h ? 'white' : 'var(--text)',
                    border: `1.5px solid ${log?.migraine_hours === h ? '#7C3AED' : 'var(--border)'}`,
                  }} onClick={() => saveField('migraine_hours', h)}>{h}u</button>
                ))}
              </div>

              <div className="scale-label" style={{ marginTop: 8 }}>MOGELIJKE TRIGGERS (meerdere mogelijk)</div>
              <div className="habit-grid" style={{ marginTop: 4 }}>
                {MIGRAINE_TRIGGERS.map(tr => {
                  const active = log?.migraine_triggers || (log?.migraine_trigger ? [log.migraine_trigger] : []);
                  const isOn = active.includes(tr.id);
                  return (
                    <div key={tr.id}
                      className={`habit-btn ${isOn ? 'on' : ''}`}
                      style={isOn ? { background: '#F3E8FF', borderColor: '#7C3AED', color: '#7C3AED' } : {}}
                      onClick={() => {
                        const cur = log?.migraine_triggers || (log?.migraine_trigger ? [log.migraine_trigger] : []);
                        saveField('migraine_triggers', cur.includes(tr.id) ? cur.filter(x => x !== tr.id) : [...cur, tr.id]);
                      }}
                    >
                      <div className="habit-emoji">{tr.emoji}</div>
                      <div className="habit-label">{tr.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Geen migraine vandaag — tik aan als je er last van hebt</div>
          )}
        </div>
      </div>

      {/* Medicatie */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💊 Medicatie</div>
        </div>
        <div className="card-body">
          {MEDS.map(med => {
            const isPlanned = isFuture && med.id === 'mounjaro' && log?.[med.id];
            return (
              <div key={med.id} className={`med-item ${log?.[med.id] ? 'checked' : ''}`} onClick={() => toggleMed(med.id)}
                style={isPlanned ? { background: '#FEF3C7', borderColor: '#F59E0B' } : {}}>
                <div className={`checkbox`}>{log?.[med.id] ? '✓' : ''}</div>
                <div style={{ flex: 1 }}>
                  <div className="med-label">{med.label}</div>
                  <div className="med-detail">{med.detail}</div>
                </div>
                {isPlanned
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FDE68A', padding: '2px 8px', borderRadius: 99 }}>📅 gepland</span>
                  : med.weekly && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--border)', padding: '2px 6px', borderRadius: 99 }}>wekelijks</span>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Mounjaro details */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#06B6D4' }} />
          <div className="card-title">💉 Mounjaro details</div>
        </div>
        <div className="card-body">
          <div className="scale-label">VERZADIGING VANDAAG (eetlust)</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {[
              { v: 1, emoji: '🚫', label: 'Geen eetlust'   },
              { v: 2, emoji: '😌', label: 'Heel weinig'    },
              { v: 3, emoji: '😐', label: 'Matig'          },
              { v: 4, emoji: '🍽️', label: 'Normaal'        },
              { v: 5, emoji: '😋', label: 'Volle eetlust'  },
            ].map(opt => (
              <button key={opt.v} className="btn" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 2px', gap: 2,
                background: log?.mounjaro_satiation === opt.v ? '#CFFAFE' : 'var(--bg)',
                borderColor: log?.mounjaro_satiation === opt.v ? '#06B6D4' : 'var(--border)',
                color: log?.mounjaro_satiation === opt.v ? '#0E7490' : 'var(--text)',
              }} onClick={() => saveField('mounjaro_satiation', log?.mounjaro_satiation === opt.v ? null : opt.v)}>
                <span style={{ fontSize: 14 }}>{opt.emoji}</span>
                <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2 }}>{opt.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, marginBottom: 10 }}>
            1 = Mounjaro werkt sterk · 5 = eetlust bijna normaal. Varieert per dag na injectie.
          </div>
          {log?.mounjaro && (
            <>
              <div className="scale-label">BIJWERKINGEN NA PRIK</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[
                  { id: 'misselijkheid', emoji: '🤢', label: 'Misselijkheid' },
                  { id: 'vermoeidheid',  emoji: '😴', label: 'Vermoeidheid'  },
                  { id: 'maagklachten', emoji: '🫄', label: 'Maagklachten'  },
                  { id: 'geen',         emoji: '✓',  label: 'Geen'          },
                ].map(se => {
                  const cur = log?.mounjaro_side_effects || [];
                  const isOn = cur.includes(se.id);
                  return (
                    <button key={se.id} className="btn" style={{
                      padding: '6px 12px', fontSize: 12,
                      background: isOn ? '#CFFAFE' : 'var(--bg)',
                      color: isOn ? '#0E7490' : 'var(--text)',
                      border: `1.5px solid ${isOn ? '#06B6D4' : 'var(--border)'}`,
                    }} onClick={() => {
                      if (se.id === 'geen') {
                        saveField('mounjaro_side_effects', isOn ? [] : ['geen']);
                      } else {
                        const without = cur.filter(x => x !== 'geen' && x !== se.id);
                        saveField('mounjaro_side_effects', isOn ? without : [...without, se.id]);
                      }
                    }}>
                      {se.emoji} {se.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* PRN Medicatie */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--alert)' }} />
          <div className="card-title">💊 Zo-nodig medicatie</div>
        </div>
        <div className="card-body">
          {PRN_MEDS.map(med => (
            <div key={med.id} style={{ marginBottom: 10 }}>
              <div
                className={`med-item ${log?.[`${med.id}_taken`] ? 'checked' : ''}`}
                onClick={() => saveField(`${med.id}_taken`, log?.[`${med.id}_taken`] ? 0 : 1)}
              >
                <div className={`checkbox`}>{log?.[`${med.id}_taken`] ? '✓' : ''}</div>
                <div style={{ flex: 1 }}>
                  <div className="med-label">{med.label}</div>
                  <div className="med-detail">{med.detail}</div>
                </div>
              </div>
              {log?.[`${med.id}_taken`] ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, paddingLeft: 36 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Tijdstip:</span>
                  <input
                    type="time"
                    defaultValue={log?.[`${med.id}_time`] || ''}
                    key={`${currentDate}-${med.id}-time`}
                    onBlur={e => e.target.value && saveField(`${med.id}_time`, e.target.value)}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 90 }}
                  />
                  {log?.[`${med.id}_time`] && (
                    <span style={{ fontSize: 10, color: 'var(--sage)' }}>✓ {log[`${med.id}_time`]}</span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Tijdstip helpt de coach correlaties zien (bijv. preventief paracetamol 's ochtends vs spierpijn/migraine later).
          </div>
        </div>
      </div>

      {/* Supplementen */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#10B981' }} />
          <div className="card-title">🌿 Supplementen</div>
        </div>
        <div className="card-body">
          {SUPPLEMENTS.map(sup => (
            <div key={sup.id} style={{ marginBottom: 8 }}>
              <div
                className={`med-item ${log?.[`${sup.id}_taken`] ? 'checked' : ''}`}
                onClick={() => saveField(`${sup.id}_taken`, log?.[`${sup.id}_taken`] ? 0 : 1)}
              >
                <div className="checkbox">{log?.[`${sup.id}_taken`] ? '✓' : ''}</div>
                <div style={{ flex: 1 }}>
                  <div className="med-label">{sup.label}</div>
                  <div className="med-detail">{sup.detail}</div>
                </div>
              </div>
              {log?.[`${sup.id}_taken`] ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, paddingLeft: 36 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Tijdstip:</span>
                  <input
                    type="time"
                    defaultValue={log?.[`${sup.id}_time`] || ''}
                    key={`${currentDate}-${sup.id}-time`}
                    onBlur={e => e.target.value && saveField(`${sup.id}_time`, e.target.value)}
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 90 }}
                  />
                  {log?.[`${sup.id}_time`] && (
                    <span style={{ fontSize: 10, color: 'var(--sage)' }}>✓ {log[`${sup.id}_time`]}</span>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Water */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">💧 Water — doel 2L</div>
        </div>
        <div className="card-body">
          <GlassTracker glasses={log?.glasses} onChange={(v) => saveField('glasses', v)} />
        </div>
      </div>

      {/* Eiwitfocus */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#F97316' }} />
          <div className="card-title">🥩 Eiwitfocus — {checkedEiwit}/3</div>
        </div>
        <div className="card-body">
          <div className="habit-grid">
            {eiwitItems.map(e => (
              <div key={e.id}
                className={`habit-btn ${log?.[e.id] ? 'on' : ''}`}
                style={log?.[e.id] ? { background: '#FFF7ED', borderColor: '#F97316', color: '#C2410C' } : {}}
                onClick={() => toggleEiwit(e.id)}
              >
                <div className="habit-emoji">{e.emoji}</div>
                <div className="habit-label">{e.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
            Eiwitgewoontes zijn je anker — ook op vakantie zonder Mounjaro op volle kracht.
          </div>
        </div>
      </div>

      {/* Eetgedrag */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#F97316' }} />
          <div className="card-title">🍽️ Eetgedrag</div>
          {(log?.eating_late || log?.eating_emotional) && (
            <span style={{ fontSize: 10, background: 'var(--gold-l)', color: '#92400E', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>let op</span>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { id: 'eating_late',      label: 'Gegeten na 20:00',    emoji: '🌙' },
              { id: 'eating_emotional', label: 'Emotie-eten vandaag', emoji: '😔' },
            ].map(item => (
              <div key={item.id}
                className={`habit-btn ${log?.[item.id] ? 'on' : ''}`}
                style={{
                  width: '100%', justifyContent: 'flex-start', gap: 10,
                  ...(log?.[item.id] ? { background: 'var(--gold-l)', borderColor: 'var(--gold)', color: '#92400E' } : {}),
                }}
                onClick={() => saveField(item.id, log?.[item.id] ? 0 : 1)}
              >
                <div className="habit-emoji">{item.emoji}</div>
                <div className="habit-label">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="scale-label" style={{ marginTop: 12 }}>CRAVING</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[
              { v: 'geen',  emoji: '✓',  label: 'Geen'     },
              { v: 'zoet',  emoji: '🍫', label: 'Zoet'     },
              { v: 'zout',  emoji: '🥨', label: 'Zout'     },
              { v: 'alles', emoji: '🤤', label: 'Alles'    },
            ].map(opt => (
              <button key={opt.v} className="btn" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 4px', gap: 2,
                background: log?.eating_craving === opt.v ? 'var(--gold-l)' : 'var(--bg)',
                borderColor: log?.eating_craving === opt.v ? 'var(--gold)' : 'var(--border)',
                color: log?.eating_craving === opt.v ? '#92400E' : 'var(--text)',
              }} onClick={() => saveField('eating_craving', log?.eating_craving === opt.v ? null : opt.v)}>
                <span style={{ fontSize: 14 }}>{opt.emoji}</span>
                <span style={{ fontSize: 10 }}>{opt.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
            Laat eten en emotie-eten correleren sterk met gewichtsstagnatie. Craving varieert met cyclusdag en Mounjaro-effect.
          </div>
        </div>
      </div>

      {/* Gewoontes */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">✅ Gewoontes — {checkedHabits}/{HABITS.length}</div>
        </div>
        <div className="card-body">
          <div className="habit-grid">
            {HABITS.map(h => (
              <div key={h.id} className={`habit-btn ${log?.[h.id] ? 'on' : ''}`} onClick={() => toggleHabit(h.id)}>
                <div className="habit-emoji">{h.emoji}</div>
                <div className="habit-label">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alcohol */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: log?.alcohol_had ? 'var(--gold)' : 'var(--border)' }} />
          <div className="card-title">🍷 Alcohol</div>
          {log?.alcohol_had && log?.alcohol_units > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, background: 'var(--gold-l)', padding: '2px 8px', borderRadius: 99 }}>
              {log.alcohol_units} glas{log.alcohol_units !== 1 ? 'zen' : ''}
            </span>
          )}
        </div>
        <div className="card-body">
          <div
            className={`habit-btn ${log?.alcohol_had ? 'on' : ''}`}
            style={{
              width: '100%', justifyContent: 'flex-start', gap: 10,
              ...(log?.alcohol_had ? { background: 'var(--gold-l)', borderColor: 'var(--gold)', color: '#92400E' } : {}),
            }}
            onClick={() => { saveField('alcohol_had', log?.alcohol_had ? 0 : 1); if (log?.alcohol_had) saveField('alcohol_units', 0); }}
          >
            <div className="habit-emoji">🍷</div>
            <div className="habit-label">Vandaag alcohol gedronken</div>
          </div>
          {log?.alcohol_had ? (
            <div style={{ marginTop: 10 }}>
              <div className="scale-label">AANTAL GLAZEN</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} className="btn" style={{
                    padding: '6px 12px', fontSize: 13, minWidth: 40,
                    background: log?.alcohol_units === n ? 'var(--gold)' : 'var(--bg)',
                    color: log?.alcohol_units === n ? 'white' : 'var(--text)',
                    border: `1.5px solid ${log?.alcohol_units === n ? 'var(--gold)' : 'var(--border)'}`,
                  }} onClick={() => saveField('alcohol_units', n)}>{n}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                Coach gebruikt dit om slaap, energie en huidkwaliteit te correleren met alcoholgebruik.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Geen alcohol vandaag — tik aan als je iets drinkt</div>
          )}
        </div>
      </div>

      {/* Notitie */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--muted)' }} />
          <div className="card-title">📝 Notitie</div>
        </div>
        <div className="card-body">
          <textarea
            rows={3}
            placeholder="Hoe was je dag? Bijzonderheden, hoe je je voelt…"
            defaultValue={log?.notes || ''}
            key={`${currentDate}-note`}
            onChange={e => saveNote(e.target.value)}
          />
          {noteSaved && <div className="saved-note">✓ Opgeslagen</div>}
        </div>
      </div>

      {/* Dagelijkse tip */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💡 Tip van vandaag</div>
        </div>
        <div className="card-body">
          <div className="tip-box">{tip}</div>
        </div>
      </div>

      {/* Verwijder dagdata */}
      {log && Object.keys(log).filter(k => k !== 'date').length > 0 && (
        <div style={{ padding: '4px 0 16px', textAlign: 'center' }}>
          {!confirmDelete ? (
            <button onClick={handleDelete} style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', fontSize: 11, padding: '6px 16px',
              borderRadius: 99, cursor: 'pointer',
            }}>
              🗑️ Verwijder alle data voor deze dag
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--alert)' }}>Zeker weten? Dit verwijdert ook uit de cloud.</span>
              <button onClick={handleDelete} style={{
                background: 'var(--alert)', border: 'none', color: 'white',
                fontSize: 11, padding: '6px 14px', borderRadius: 99, cursor: 'pointer',
              }}>Ja, verwijder</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 11, padding: '6px 14px',
                borderRadius: 99, cursor: 'pointer',
              }}>Annuleer</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
