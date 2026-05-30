import React, { useState, useEffect } from 'react';
import { photoStore } from '../photoStore';
import { store } from '../store';
import { USER } from '../config';

const PHOTO_TYPES = [
  { key: 'voor',   label: 'Voorkant' },
  { key: 'zij',    label: 'Zijkant'  },
  { key: 'achter', label: 'Achterkant' },
];

const CYCLE_LABEL = {
  menstruatie: '🔴 Menstruatie',
  folliculair: '🌱 Folliculair',
  ovulatie:    '✨ Ovulatie',
  luteaal:     '🌙 Luteaal',
  'weet-niet': '❓ Onbekend',
};

const SYMPTOM_LABELS = {
  symptom_brainfog:   '🌫️ Hersenmist',
  symptom_exhaustion: '🪫 Moeheid',
  symptom_breathless: '💨 Kortademig',
  symptom_pain:       '🦴 Pijn',
  symptom_headache:   '🤕 Hoofdpijn',
  symptom_hayfever:   '🌿 Hooikoorts',
  symptom_overdrive:  '🔴🧠 Overdrive',
  symptom_pem:        '⚡🛑 PEM',
};

function dayNum(date) {
  return Math.max(1, Math.floor((new Date(date) - new Date(USER.startDate)) / 86400000) + 1);
}

function WeightProgress({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return null;

  const current = entries[entries.length - 1].weight;
  const start   = USER.startWeight;
  const goal    = USER.goalWeight;
  const lost    = +(start - current).toFixed(1);
  const toGo    = +(current - goal).toFixed(1);
  const pct     = Math.min(100, Math.max(0, ((start - current) / (start - goal)) * 100));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--rust)' }} />
        <div className="card-title">⚖️ Gewichtprogressie</div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Start</div>
            <div style={{ fontWeight: 700 }}>{start} kg</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Nu</div>
            <div style={{ fontWeight: 700, color: 'var(--rust)', fontSize: 15 }}>{current} kg</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Doel</div>
            <div style={{ fontWeight: 700 }}>{goal} kg</div>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rust)', borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--sage)', fontWeight: 700 }}>−{lost} kg afgevallen</span>
          <span style={{ color: 'var(--muted)' }}>nog {toGo} kg te gaan</span>
          <span style={{ color: 'var(--muted)' }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function MeasurementRow({ meas, label }) {
  if (!meas) return null;
  const fields = [
    ['Taille', meas.waist],
    ['Heup',   meas.hip],
    ['Borst',  meas.chest],
    ['Arm',    meas.arm],
    ['Dij',    meas.thigh],
  ].filter(([, v]) => v != null);
  if (!fields.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
        📏 Maten{label ? ` (${label})` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {fields.map(([name, val]) => (
          <span key={name} style={{ fontSize: 11 }}>
            <span style={{ color: 'var(--muted)' }}>{name} </span>
            <strong>{val} cm</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Progressie({ logs }) {
  const [sessions, setSessions] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    photoStore.getAll().then(setSessions).catch(() => {});
    store.getMeasurements().then(setMeasurements).catch(() => {});
  }, []);

  function closestMeasurement(date) {
    const onDate = measurements.find(m => m.date === date);
    if (onDate) return { meas: onDate, label: null };
    const prev = measurements.filter(m => m.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) return { meas: prev, label: prev.date };
    return null;
  }

  const allLogs = Object.values(logs);
  const photoSessions = sessions.sort((a, b) => b.date.localeCompare(a.date));

  // Datums met gewicht maar zonder foto — om ook te tonen in een compacte weergave
  const photoDateSet = new Set(sessions.map(s => s.date));
  const weightOnlyDates = allLogs
    .filter(l => l.weight && !photoDateSet.has(l.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="pane">
      <WeightProgress logs={logs} />

      {/* Foto-tijdlijn */}
      {photoSessions.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7, background: 'var(--card)', borderRadius: 12 }}>
          📸 Nog geen progressiefoto's.<br />
          Ga naar <strong>Coach → Progressiefoto's</strong> om je eerste foto te maken.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            📸 {photoSessions.length} foto-sessie{photoSessions.length !== 1 ? 's' : ''}
          </div>
          {photoSessions.map(({ date, views }) => {
            const log       = logs[date] ?? {};
            const dn        = dayNum(date);
            const measInfo  = closestMeasurement(date);
            const analysis  = localStorage.getItem(`gc_photo_analysis_${date}`);
            const isOpen    = expanded[date];

            const activeSymptoms = Object.keys(SYMPTOM_LABELS).filter(k => log[k]);
            const photoCount = PHOTO_TYPES.filter(({ key }) => views[key]).length;

            return (
              <div key={date} className="card" style={{ marginBottom: 12 }}>
                {/* Header — klikbaar voor uitvouwen */}
                <div
                  className="card-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(e => ({ ...e, [date]: !e[date] }))}
                >
                  <div className="card-accent" style={{ background: 'var(--gold)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14 }}>
                      Dag {dn}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{date}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {log.weight && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--rust)' }}>{log.weight} kg</span>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                      {photoCount} foto{photoCount !== 1 ? "'s" : ''} {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Thumbnail preview — altijd zichtbaar */}
                <div style={{ padding: '0 12px 8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                    {PHOTO_TYPES.map(({ key, label }) => {
                      const photo = views[key];
                      return (
                        <div key={key}>
                          {photo ? (
                            <img
                              src={`data:${photo.mimeType};base64,${photo.base64}`}
                              alt={`${date} ${label}`}
                              style={{ width: '100%', borderRadius: 8, objectFit: 'cover', height: isOpen ? 160 : 100 }}
                            />
                          ) : (
                            <div style={{ height: isOpen ? 160 : 100, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--border)' }}>
                              {label}
                            </div>
                          )}
                          {isOpen && (
                            <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail — uitvouwbaar */}
                {isOpen && (
                  <div className="card-body" style={{ paddingTop: 4 }}>
                    {/* Maten */}
                    {measInfo && (
                      <MeasurementRow meas={measInfo.meas} label={measInfo.label} />
                    )}

                    {/* Vitals rij */}
                    {(log.bp_sys || log.hr_rest || log.steps || log.battery_start != null) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8, fontSize: 11 }}>
                        {log.bp_sys && (
                          <span>❤️ <strong>{log.bp_sys}/{log.bp_dia}</strong>{log.bp_hr ? ` ${log.bp_hr}bpm` : ''}</span>
                        )}
                        {log.hr_rest && (
                          <span>💓 rust <strong>{log.hr_rest} bpm</strong></span>
                        )}
                        {log.steps != null && (
                          <span>👣 <strong>{log.steps.toLocaleString('nl')}</strong> stap</span>
                        )}
                        {log.battery_start != null && (
                          <span>🔋 <strong>{log.battery_start}%</strong>{log.battery_end != null ? ` → ${log.battery_end}%` : ''}</span>
                        )}
                      </div>
                    )}

                    {/* Bijzonderheden */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 8 }}>
                      {log.cycle_phase && CYCLE_LABEL[log.cycle_phase] && (
                        <span style={{ fontSize: 11, background: 'var(--rust-l)', color: 'var(--rust)', padding: '2px 8px', borderRadius: 99 }}>
                          {CYCLE_LABEL[log.cycle_phase]}
                        </span>
                      )}
                      {log.energy != null && (
                        <span style={{ fontSize: 11, background: 'var(--gold-l)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 99 }}>
                          {['🪫','😐','⚡','🚀'][log.energy]} energie
                        </span>
                      )}
                      {log.sleep_hours != null && (
                        <span style={{ fontSize: 11, background: 'var(--sage-l)', color: 'var(--sage)', padding: '2px 8px', borderRadius: 99 }}>
                          😴 {log.sleep_hours}u slaap
                        </span>
                      )}
                      {activeSymptoms.map(k => (
                        <span key={k} style={{ fontSize: 11, background: 'var(--alert-l)', color: 'var(--alert)', padding: '2px 8px', borderRadius: 99 }}>
                          {SYMPTOM_LABELS[k]}
                        </span>
                      ))}
                    </div>

                    {/* Notitie */}
                    {log.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6, marginBottom: 8, fontStyle: 'italic' }}>
                        "{log.notes}"
                      </div>
                    )}

                    {/* AI analyse */}
                    {analysis && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 10, color: 'var(--sage)', cursor: 'pointer', fontWeight: 700 }}>
                          🤖 AI-analyse bekijken
                        </summary>
                        <div style={{ marginTop: 6, background: 'var(--sage-l)', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--text)', borderLeft: '3px solid var(--sage)', whiteSpace: 'pre-wrap' }}>
                          {analysis}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Gewicht-only datums (geen foto) */}
      {weightOnlyDates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>⚖️ Weegmomenten (geen foto)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {weightOnlyDates.map(l => (
              <div key={l.date} style={{ background: 'var(--card)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Dag {dayNum(l.date)} · {l.date.slice(5)}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rust)', marginTop: 2 }}>{l.weight} kg</div>
                {l.cycle_phase && CYCLE_LABEL[l.cycle_phase] && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{CYCLE_LABEL[l.cycle_phase]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
