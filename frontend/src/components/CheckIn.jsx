import React, { useState, useEffect } from 'react';
import { HABITS, MEDS, BP, PERSONAL_EVENTS } from '../config';

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

export default function CheckIn({ log, saveField, saveFields, currentDate, logs, tip }) {
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
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteTimer, setNoteTimer] = useState(null);
  const [cycleStart, setCycleStart] = useState(() => localStorage.getItem('gc_cycle_start') || null);

  useEffect(() => {
    if (log) {
      setWeight(log.weight ?? '');
      setBpSys(log.bp_sys ?? '');
      setBpDia(log.bp_dia ?? '');
      setBpHr(log.bp_hr ?? '');
      setBpTime(log.bp_time ?? '');
      setSteps(log.steps ?? '');
      setHrRest(log.hr_rest ?? '');
      setSleepHours(log.sleep_hours ?? '');
      setBatteryStart(log.battery_start ?? '');
      setBatteryEnd(log.battery_end ?? '');
    }
  }, [log, currentDate]);

  // Sprint calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const daysToVacation = Math.max(0, Math.floor((new Date(VACATION_DATE) - new Date(todayStr)) / 86400000));
  const weeksToVacation = (daysToVacation / 7).toFixed(1);

  const weightEntries = Object.values(logs || {})
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weightEntries.length ? weightEntries[weightEntries.length - 1].weight : null;

  const projectedWeight = (() => {
    if (weightEntries.length < 2) return null;
    const first = weightEntries[0], last = weightEntries[weightEntries.length - 1];
    const days = Math.max(1, Math.floor((new Date(last.date) - new Date(first.date)) / 86400000));
    const dailyChange = (last.weight - first.weight) / days;
    return +(last.weight + dailyChange * daysToVacation).toFixed(1);
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

  // Cycle calculations
  const cycleDay = cycleStart
    ? Math.floor((new Date(todayStr) - new Date(cycleStart)) / 86400000) + 1
    : null;
  const startMenstruatie = () => {
    localStorage.setItem('gc_cycle_start', todayStr);
    setCycleStart(todayStr);
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

  return (
    <div className="pane">

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
              {upcoming.map(e => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: e.active ? `${e.color}18` : 'var(--bg)',
                  border: `1.5px solid ${e.active ? e.color : 'var(--border)'}`,
                }}>
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
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>Doel: {e.goal}</div>
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
              ))}
            </div>
          </div>
        );
      })()}

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
              placeholder="62.7"
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

      {/* Cyclus */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#C084FC' }} />
          <div className="card-title">🌙 Cyclus</div>
          {cycleDay != null && (
            <span style={{ fontSize: 11, color: '#9333EA', fontWeight: 700, background: '#F3E8FF', padding: '2px 8px', borderRadius: 99 }}>
              {cycleDay <= 5 ? `🩸 Dag ${cycleDay}` : cycleDay > 45 ? `${cycleDay} dagen — peri` : `Dag ${cycleDay}`}
            </span>
          )}
        </div>
        <div className="card-body">
          {cycleStart && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
              Laatste menstruatie: <strong>{cycleStart}</strong>
              {cycleDay > 45 && <span style={{ color: '#9333EA', marginLeft: 6 }}>· langere cyclus (perimenopauzaal)</span>}
              {cycleDay <= 5 && <span style={{ color: 'var(--alert)', marginLeft: 6 }}>· ongesteld</span>}
              {cycleDay > 5 && cycleDay <= 13 && <span style={{ color: 'var(--sage)', marginLeft: 6 }}>· folliculaire fase — meer energie verwacht</span>}
              {cycleDay >= 14 && cycleDay <= 16 && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>· mogelijke ovulatie</span>}
              {cycleDay > 16 && cycleDay <= 28 && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>· luteale fase</span>}
            </div>
          )}
          <button
            className="btn btn-full"
            style={{
              background: '#F3E8FF', color: '#7C3AED', border: '1.5px solid #C084FC',
              fontWeight: 700, fontSize: 13,
            }}
            onClick={startMenstruatie}
          >
            🩸 Ongesteld geworden vandaag
          </button>
          {!cycleStart && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
              Tik als je ongesteld bent geworden — de app bijhoudt dan je cyclusdag automatisch.
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

      {/* Medicatie */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💊 Medicatie</div>
        </div>
        <div className="card-body">
          {MEDS.map(med => (
            <div key={med.id} className={`med-item ${log?.[med.id] ? 'checked' : ''}`} onClick={() => toggleMed(med.id)}>
              <div className={`checkbox ${log?.[med.id] ? '' : ''}`}>{log?.[med.id] ? '✓' : ''}</div>
              <div style={{ flex: 1 }}>
                <div className="med-label">{med.label}</div>
                <div className="med-detail">{med.detail}</div>
              </div>
              {med.weekly && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--border)', padding: '2px 6px', borderRadius: 99 }}>wekelijks</span>}
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
    </div>
  );
}
