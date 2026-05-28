import React, { useState, useEffect } from 'react';
import { HABITS, MEDS, BP } from '../config';

const SYMPTOMS = [
  { id: 'symptom_brainfog',   label: 'Hersenmist',   emoji: '🌫️' },
  { id: 'symptom_exhaustion', label: 'Zware moeheid', emoji: '🪫' },
  { id: 'symptom_breathless', label: 'Kortademig',   emoji: '💨' },
  { id: 'symptom_pain',       label: 'Spier/gewricht',emoji: '🦴' },
  { id: 'symptom_headache',   label: 'Hoofdpijn',    emoji: '🤕' },
  { id: 'symptom_pem',        label: 'PEM-crash',    emoji: '⚡🛑' },
];

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

export default function CheckIn({ log, saveField, saveFields, currentDate, tip }) {
  const [weight, setWeight] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [steps, setSteps] = useState('');
  const [hrRest, setHrRest] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteTimer, setNoteTimer] = useState(null);

  useEffect(() => {
    if (log) {
      setWeight(log.weight ?? '');
      setBpSys(log.bp_sys ?? '');
      setBpDia(log.bp_dia ?? '');
      setSteps(log.steps ?? '');
      setHrRest(log.hr_rest ?? '');
      setSleepHours(log.sleep_hours ?? '');
    }
  }, [log, currentDate]);

  const saveWeight = () => {
    const w = parseFloat(weight);
    if (!isNaN(w) && w > 30 && w < 200) saveField('weight', w);
  };

  const saveBP = () => {
    const s = parseInt(bpSys), d = parseInt(bpDia);
    if (!isNaN(s) && !isNaN(d) && s > 50 && d > 30) saveFields({ bp_sys: s, bp_dia: d });
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

  const toggleHabit = (id) => saveField(id, log?.[id] ? 0 : 1);
  const toggleMed = (id) => saveField(id, log?.[id] ? 0 : 1);

  const saveSteps = () => {
    const v = parseInt(steps);
    if (!isNaN(v) && v >= 0) saveField('steps', v);
  };

  const saveHrRest = () => {
    const v = parseInt(hrRest);
    if (!isNaN(v) && v > 30 && v < 200) saveField('hr_rest', v);
  };

  const saveSleepHours = (v) => {
    saveField('sleep_hours', parseFloat(v));
  };

  const toggleSymptom = (id) => saveField(id, log?.[id] ? 0 : 1);

  const checkedHabits = HABITS.filter(h => log?.[h.id]).length;
  const checkedMeds = MEDS.filter(m => !m.weekly && log?.[m.id]).length;
  const activeSymptoms = SYMPTOMS.filter(s => log?.[s.id]).length;

  const stepGoal = 8000;
  const stepPct = Math.min(100, Math.round(((log?.steps || 0) / stepGoal) * 100));
  const stepColor = stepPct >= 100 ? 'var(--sage)' : stepPct >= 60 ? 'var(--gold)' : 'var(--rust)';

  return (
    <div className="pane">
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
            <button className="btn btn-rust btn-sm" onClick={saveBP}>✓</button>
          </div>
          {log?.bp_sys && <div className="saved-note">✓ {log.bp_sys}/{log.bp_dia} opgeslagen</div>}
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
          {/* Stappen */}
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

          {/* Rust-HS */}
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
