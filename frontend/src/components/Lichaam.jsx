import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { USER } from '../config';

function daysSinceStart(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now - start) / 86400000);
}

const CYCLE_PHASES = [
  { id: 'menstruatie',  label: 'Menstruatie',   emoji: '🔴', info: 'Rust heeft prioriteit. Lichte beweging is prima. Extra ijzerbehoefte.' },
  { id: 'folliculair',  label: 'Folliculair',   emoji: '🌱', info: 'Energie stijgt na menstruatie. Goed moment voor opbouw in training.' },
  { id: 'ovulatie',     label: 'Ovulatie',      emoji: '✨', info: 'Piekenergie. Hogere pijntolerantie. Ideaal voor iets intensievere sessies.' },
  { id: 'luteaal',      label: 'Luteaal',        emoji: '🌙', info: 'Energie daalt. Meer behoefte aan rust, eiwitten en magnesium.' },
  { id: 'weet-niet',   label: 'Weet niet',      emoji: '❓', info: 'Perimenopauze maakt cycli onregelmatig — dat is normaal.' },
];

export default function Lichaam({ log, saveField, currentDate, logs }) {
  const [measurements, setMeasurements] = useState([]);
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [saved, setSaved] = useState(false);

  const dayNum = daysSinceStart(USER.startDate) + 1;
  const isWeeklyPrompt = dayNum > 0 && dayNum % 7 === 0;

  useEffect(() => {
    api.getMeasurements().then(setMeasurements).catch(() => {});
  }, []);

  const saveMeasurements = async () => {
    if (!waist && !hip && !arm && !thigh) return;
    await api.saveMeasurements(currentDate, {
      waist: parseFloat(waist) || null,
      hip: parseFloat(hip) || null,
      arm: parseFloat(arm) || null,
      thigh: parseFloat(thigh) || null,
      photo_reminder: isWeeklyPrompt ? 1 : 0,
    });
    const updated = await api.getMeasurements();
    setMeasurements(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const cyclePhase = log?.cycle_phase;
  const setCyclePhase = (v) => saveField('cycle_phase', v);
  const phaseInfo = CYCLE_PHASES.find(p => p.id === cyclePhase);

  const latestMeasurement = measurements[0];

  return (
    <div className="pane">
      {/* Wekelijkse maten prompt */}
      {isWeeklyPrompt && (
        <div className="alert-box orange" style={{ marginBottom: 12 }}>
          <span className="alert-icon">📏</span>
          <div className="alert-text">
            <strong>Week {Math.floor(dayNum / 7)} meting!</strong>
            Vul vandaag je maten in en maak een progressiefoto in dezelfde hoek/licht als vorige week.
          </div>
        </div>
      )}

      {/* Maten invoeren */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">📏 Maten invoeren</div>
        </div>
        <div className="card-body">
          <div className="measure-grid">
            {[['waist', setWaist, waist, 'Taille'], ['hip', setHip, hip, 'Heup'], ['arm', setArm, arm, 'Arm'], ['thigh', setThigh, thigh, 'Dij']].map(([id, setter, val, label]) => (
              <div key={id} className="measure-field">
                <label>{label} (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="—"
                  value={val}
                  onChange={e => setter(e.target.value)}
                />
              </div>
            ))}
          </div>
          <button className="btn btn-rust btn-full" onClick={saveMeasurements}>
            💾 Sla maten op
          </button>
          {saved && <div className="saved-note">✓ Maten opgeslagen</div>}
          {isWeeklyPrompt && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--gold-l)', borderRadius: 9, fontSize: 11, color: 'var(--gold)' }}>
              📸 Vergeet niet je progressiefoto te maken! Zelfde plek, zelfde licht, zelfde houding.
            </div>
          )}
        </div>
      </div>

      {/* Maten geschiedenis */}
      {measurements.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">📈 Maten geschiedenis</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4,1fr)', gap: '4px 8px', fontSize: 11 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 700 }}>Datum</div>
              {['Taille','Heup','Arm','Dij'].map(l => (
                <div key={l} style={{ color: 'var(--muted)', fontWeight: 700, textAlign: 'center' }}>{l}</div>
              ))}
              {measurements.slice(0, 8).map(m => (
                <React.Fragment key={m.date}>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{m.date.slice(5)}</div>
                  {[m.waist, m.hip, m.arm, m.thigh].map((v, i) => (
                    <div key={i} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {v ?? '—'}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cyclus tracker */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">🌙 Cyclus & hormonen</div>
        </div>
        <div className="card-body">
          <div className="section-title">Fase vandaag</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
            {CYCLE_PHASES.map(p => (
              <button
                key={p.id}
                className="btn"
                style={{
                  background: cyclePhase === p.id ? 'var(--rust)' : 'var(--bg)',
                  color: cyclePhase === p.id ? 'white' : 'var(--text)',
                  border: `1.5px solid ${cyclePhase === p.id ? 'var(--rust)' : 'var(--border)'}`,
                  padding: '8px 6px',
                  fontSize: 11,
                }}
                onClick={() => setCyclePhase(cyclePhase === p.id ? null : p.id)}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
          {phaseInfo && (
            <div style={{ background: 'var(--rust-l)', borderRadius: 9, padding: '10px 12px', fontSize: 11, color: 'var(--rust)', lineHeight: 1.6 }}>
              <strong>{phaseInfo.emoji} {phaseInfo.label}:</strong> {phaseInfo.info}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
            Perimenopauze betekent onregelmatige cycli — track voor inzicht, niet voor druk.
          </div>
        </div>
      </div>

      {/* Slaap 7 dagen */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">😴 Slaappatroon — 7 dagen</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 50 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              const dk = d.toISOString().slice(0, 10);
              const v = logs[dk]?.sleep_quality;
              const labels = ['😫','😕','🙂','😴'];
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{v != null ? labels[v] : '·'}</div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>
                    {['6d','5d','4d','3d','2d','gis','van'][i]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)' }}>
            Perimenopauze + long covid: slaap is medisch, niet luxe.
          </div>
        </div>
      </div>
    </div>
  );
}
