import React, { useState, useEffect } from 'react';
import { photoStore } from '../photoStore';
import { USER, PERSONAL_EVENTS } from '../config';
import { RUNS } from '../data/runningSchema';
import { store } from '../store';
import SubTabs from './SubTabs';

const SUBTABS = ['Overzicht', 'Lichaam', 'Hardlopen', 'Energie', 'Routines', 'Tijdlijn'];

const TRAIL_DATE = '2026-10-03';
const TOTAL_RUNS = 35;

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysBetween(fromStr, toStr) {
  return Math.ceil((new Date(toStr) - new Date(fromStr)) / 86400000);
}

function avg(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function getNextRunNr(logs) {
  const done = new Set(Object.values(logs || {}).filter(l => l.run_done && l.run_session).map(l => l.run_session));
  for (let nr = 1; nr <= RUNS.length; nr++) if (!done.has(nr)) return nr;
  return RUNS.length;
}

// ── Shared components ───────────────────────────────────────────
function ProgressBar({ pct, color = 'var(--sage)' }) {
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`,
        background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  );
}

function ExpandSection({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`os-expand-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        {label}
        <span className="os-expand-arrow">↓</span>
      </button>
      {open && <div className="os-card" style={{ marginBottom: 8 }}>{children}</div>}
    </>
  );
}

// ── Weight sparkline ────────────────────────────────────────────
function MiniWeightLine({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length < 2) return null;

  const GOAL = USER.goalWeight;
  const W = 320, H = 60;
  const PL = 4, PR = 4, PT = 8, PB = 8;
  const cW = W - PL - PR, cH = H - PT - PB;

  const weights = entries.map(e => e.weight);
  const maxW = Math.max(...weights, USER.startWeight + 1);
  const minW = Math.min(GOAL - 0.5, ...weights);
  const rangeW = maxW - minW;

  const totalDays = Math.max(1, daysBetween(entries[0].date, entries[entries.length - 1].date));
  const xFor = (date) => PL + (daysBetween(entries[0].date, date) / totalDays) * cW;
  const yFor = (w) => PT + (1 - (w - minW) / rangeW) * cH;

  const goalY = yFor(GOAL);
  const points = entries.map(e => ({ x: xFor(e.date), y: yFor(e.weight), w: e.weight }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60, display: 'block', marginTop: 12 }}>
      <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke="var(--sage)" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
      <path d={path} fill="none" stroke="var(--rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {last && (
        <>
          <circle cx={last.x} cy={last.y} r="3" fill="var(--rust)" />
          <text x={last.x} y={last.y - 6} fontSize="9" fill="var(--rust)" textAnchor="middle" fontWeight="700">{last.w}</text>
        </>
      )}
      <text x={W - PR} y={goalY - 3} fontSize="8" fill="var(--sage)" textAnchor="end">doel {GOAL} kg</text>
    </svg>
  );
}

// ── Energy sparkline ────────────────────────────────────────────
function EnergySparkline({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.energy != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (entries.length < 3) return null;

  const W = 320, H = 48;
  const PL = 4, PR = 4, PT = 6, PB = 6;
  const cW = W - PL - PR, cH = H - PT - PB;
  const n = entries.length;

  const xFor = (i) => PL + (i / (n - 1)) * cW;
  const yFor = (v) => PT + (1 - v / 3) * cH;

  const points = entries.map((e, i) => ({ x: xFor(i), y: yFor(e.energy) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 48, display: 'block', marginTop: 8 }}>
      {[0, 1, 2, 3].map(v => {
        const y = yFor(v);
        return <line key={v} x1={PL} y1={y} x2={W - PR} y2={y}
          stroke="var(--border)" strokeWidth="0.5" opacity="0.6" />;
      })}
      <path d={path} fill="none" stroke="var(--sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill="var(--sage)" />
      )}
    </svg>
  );
}

// ── Photo timeline ──────────────────────────────────────────────
const PHOTO_TYPES = [
  { key: 'voor', label: 'Voor' },
  { key: 'zij',  label: 'Zij' },
  { key: 'achter', label: 'Achter' },
];

function PhotoTimeline({ sessions }) {
  const [expandedDate, setExpandedDate] = useState(null);

  if (!sessions.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
      Nog geen progressiefoto's.<br />
      <span style={{ fontSize: 11 }}>Maak foto's via Lichaam → Training.</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sessions.map(({ date, views }) => {
        const isOpen = expandedDate === date;
        const photoCount = PHOTO_TYPES.filter(({ key }) => views[key]).length;
        const d = new Date(date + 'T12:00:00');
        const label = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        return (
          <div key={date}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5,
              cursor: photoCount > 0 ? 'pointer' : 'default' }}
              onClick={() => setExpandedDate(isOpen ? null : date)}>
              {PHOTO_TYPES.map(({ key, label: pl }) => {
                const photo = views[key];
                return photo ? (
                  <img key={key} src={`data:${photo.mimeType};base64,${photo.base64}`}
                    alt={`${date} ${pl}`}
                    style={{ width: '100%', borderRadius: 8, objectFit: 'cover',
                      height: isOpen ? 140 : 80, transition: 'height 0.2s' }} />
                ) : (
                  <div key={key} style={{ height: isOpen ? 140 : 80, background: 'var(--bg)', borderRadius: 8,
                    border: '1px dashed var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 9, color: 'var(--border)' }}>
                    {pl}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 0: OVERZICHT
// ═══════════════════════════════════════════════════════════════
function TabOverzicht({ logs, streak, sessions }) {
  const tod = todayStr();
  const latestWeight = (() => {
    const sorted = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.weight || null;
  })();
  const completedRuns = Object.values(logs).filter(l => l.run_done).length;
  const trailDays = daysBetween(tod, TRAIL_DATE);
  const weightPct = latestWeight
    ? Math.min(100, Math.max(0, ((USER.startWeight - latestWeight) / (USER.startWeight - USER.goalWeight)) * 100))
    : 0;
  const runPct = Math.min(100, (completedRuns / TOTAL_RUNS) * 100);
  const trailPct = (() => {
    const totalDays = daysBetween(USER.startDate, TRAIL_DATE);
    const elapsed = daysBetween(USER.startDate, tod);
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  })();
  const weightLost = latestWeight ? +(USER.startWeight - latestWeight).toFixed(1) : 0;
  const weightToGo = latestWeight ? +(latestWeight - USER.goalWeight).toFixed(1) : null;

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Resultaten</div>
      <div className="os-outcomes">
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Gewicht</div>
          <div className="os-outcome-num" style={{ color: 'var(--rust)' }}>{latestWeight || '—'}</div>
          <div className="os-outcome-sub">{latestWeight ? `kg · doel ${USER.goalWeight}` : 'nog niet ingevuld'}</div>
          <ProgressBar pct={weightPct} color="var(--rust)" />
        </div>
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Trainingen</div>
          <div className="os-outcome-num" style={{ color: 'var(--sage)' }}>{completedRuns}</div>
          <div className="os-outcome-sub">van {TOTAL_RUNS} gelopen</div>
          <ProgressBar pct={runPct} color="var(--sage)" />
        </div>
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Trail 10 km</div>
          <div className="os-outcome-num" style={{ color: trailDays < 14 ? 'var(--gold)' : 'var(--text)' }}>
            {trailDays > 0 ? trailDays : '!'}
          </div>
          <div className="os-outcome-sub">{trailDays > 0 ? 'dagen' : 'nu!'}</div>
          <ProgressBar pct={trailPct} color="var(--gold)" />
        </div>
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Streak</div>
          <div className="os-outcome-num" style={{ color: streak > 0 ? 'var(--green)' : 'var(--muted)' }}>{streak}</div>
          <div className="os-outcome-sub">{streak === 1 ? 'dag op rij' : 'dagen op rij'}</div>
          <ProgressBar pct={Math.min(100, streak * 5)} color="var(--green)" />
        </div>
      </div>

      {latestWeight && (
        <ExpandSection label="Gewicht — details">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              {[
                { label: 'Start', val: `${USER.startWeight} kg` },
                { label: 'Nu', val: `${latestWeight} kg`, accent: 'var(--rust)' },
                { label: 'Doel', val: `${USER.goalWeight} kg` },
              ].map(({ label, val, accent }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: accent ? 20 : 15, fontWeight: 800,
                    color: accent || 'var(--text)', fontFamily: 'var(--font-serif)' }}>{val}</div>
                </div>
              ))}
            </div>
            <MiniWeightLine logs={logs} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
              <span style={{ color: weightLost > 0 ? 'var(--sage)' : 'var(--muted)' }}>
                {weightLost > 0 ? `−${weightLost} kg afgevallen` : weightLost < 0 ? `+${Math.abs(weightLost)} kg` : 'geen verandering'}
              </span>
              {weightToGo !== null && (
                <span style={{ color: 'var(--muted)' }}>nog {weightToGo} kg te gaan</span>
              )}
            </div>
          </div>
        </ExpandSection>
      )}

      <div className="os-section-label">Foto-tijdlijn</div>
      <div className="os-card">
        <PhotoTimeline sessions={sessions} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: LICHAAM
// ═══════════════════════════════════════════════════════════════
function TabLichaam({ logs }) {
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    store.getMeasurements().then(m => setMeasurements(Array.isArray(m) ? m : [])).catch(() => {});
  }, []);

  const weightEntries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = weightEntries[0]?.weight || null;
  const weightLost = latestWeight ? +(USER.startWeight - latestWeight).toFixed(1) : 0;
  const weightToGo = latestWeight ? +(latestWeight - USER.goalWeight).toFixed(1) : null;
  const weightPct = latestWeight
    ? Math.min(100, Math.max(0, ((USER.startWeight - latestWeight) / (USER.startWeight - USER.goalWeight)) * 100))
    : 0;

  // Buffer from Leven→Geld
  const geldData = (() => {
    try { return JSON.parse(localStorage.getItem('gc_geld') || 'null'); } catch { return null; }
  })();

  return (
    <div>
      {/* Weight big card */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Gewicht</div>
      <div className="os-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--rust)' }}>
            {latestWeight ? `${latestWeight}` : '—'}
          </div>
          {latestWeight && <div style={{ fontSize: 14, color: 'var(--sub)' }}>kg</div>}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--sub)', marginBottom: 8 }}>
          <span>Start: {USER.startWeight} kg</span>
          <span>Doel: {USER.goalWeight} kg</span>
        </div>
        <ProgressBar pct={weightPct} color="var(--rust)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
          <span style={{ color: weightLost > 0 ? 'var(--sage)' : 'var(--muted)' }}>
            {weightLost > 0 ? `−${weightLost} kg afgevallen` : weightLost < 0 ? `+${Math.abs(weightLost)} kg` : '—'}
          </span>
          {weightToGo !== null && weightToGo > 0 && (
            <span style={{ color: 'var(--muted)' }}>nog {weightToGo} kg</span>
          )}
        </div>
        <MiniWeightLine logs={logs} />
      </div>

      {/* Weight history */}
      {weightEntries.length > 0 && (
        <ExpandSection label={`Weeghistorie (${weightEntries.length})`}>
          <div>
            {weightEntries.slice(0, 20).map(e => (
              <div key={e.date} className="os-detail-row">
                <span className="os-dk">{e.date}</span>
                <span className="os-dv">{e.weight} kg</span>
              </div>
            ))}
          </div>
        </ExpandSection>
      )}

      {/* Measurements */}
      {measurements.length > 0 && (
        <>
          <div className="os-section-label">Maten (cm)</div>
          <div className="os-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Datum', 'Taille', 'Heup', 'Arm', 'Dij'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 6px',
                        color: 'var(--ghost)', fontWeight: 700, fontSize: 11,
                        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 8).map(m => (
                    <tr key={m.date} style={{ borderTop: '1px solid var(--divide)' }}>
                      <td style={{ padding: '6px 6px', color: 'var(--sub)' }}>{m.date?.slice(5)}</td>
                      <td style={{ padding: '6px 6px' }}>{m.waist || '—'}</td>
                      <td style={{ padding: '6px 6px' }}>{m.hip || '—'}</td>
                      <td style={{ padding: '6px 6px' }}>{m.arm || '—'}</td>
                      <td style={{ padding: '6px 6px' }}>{m.thigh || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Geld buffer */}
      {geldData && geldData.buffer > 0 && (
        <>
          <div className="os-section-label">Buffer</div>
          <div className="os-card">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-serif)',
                color: geldData.buffer >= 15000 ? 'var(--green)' : 'var(--sage)' }}>
                €{geldData.buffer.toLocaleString('nl-NL')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--sub)' }}>van €15.000</div>
            </div>
            <ProgressBar pct={Math.min(100, (geldData.buffer / 15000) * 100)} color="var(--green)" />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: HARDLOPEN
// ═══════════════════════════════════════════════════════════════
function TabHardlopen({ logs }) {
  const tod = todayStr();
  const completedRuns = Object.values(logs).filter(l => l.run_done).length;
  const runPct = Math.min(100, (completedRuns / TOTAL_RUNS) * 100);
  const nextRunNr = getNextRunNr(logs);
  const nextRun = RUNS[nextRunNr - 1];

  const recentRuns = Object.values(logs)
    .filter(l => l.run_done && l.run_session)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const totalKm = recentRuns.reduce((sum, l) => {
    const run = RUNS.find(r => r.nr === l.run_session);
    if (!run) return sum;
    const km = run.km_estimate ? parseFloat(run.km_estimate) : 0;
    return sum + (isNaN(km) ? 0 : km);
  }, 0);

  const trailDays = daysBetween(tod, TRAIL_DATE);
  const trailPct = (() => {
    const totalDays = daysBetween(USER.startDate, TRAIL_DATE);
    const elapsed = daysBetween(USER.startDate, tod);
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  })();

  // Core/kracht sessions
  const coreSessions = Object.values(logs).filter(l => l.core_done).length;

  return (
    <div>
      {/* Progress */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Schema-voortgang</div>
      <div className="os-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 40, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--sage)' }}>
            {completedRuns}
          </div>
          <div style={{ fontSize: 16, color: 'var(--sub)' }}>/ {TOTAL_RUNS} sessies</div>
        </div>
        <ProgressBar pct={runPct} color="var(--sage)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--sub)' }}>
          <span>{TOTAL_RUNS - completedRuns} sessies te gaan</span>
          {totalKm > 0 && <span>~{totalKm.toFixed(1)} km gelopen</span>}
        </div>
      </div>

      {/* Kracht */}
      {coreSessions > 0 && (
        <div className="os-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--blue)' }}>
            {coreSessions}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Core sessies</div>
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>krachtsessies gedaan</div>
          </div>
        </div>
      )}

      {/* Next run */}
      {nextRun && (
        <>
          <div className="os-section-label">Volgende sessie</div>
          <div className="os-card" style={{ borderLeft: '3px solid var(--sage)' }}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              T{nextRunNr}/{TOTAL_RUNS}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, fontFamily: 'var(--font-serif)' }}>
              {nextRun.title || `Training ${nextRunNr}`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.4, marginBottom: 4 }}>
              {nextRun.description}
            </div>
            {nextRun.duration && (
              <div style={{ fontSize: 12, color: 'var(--ghost)' }}>
                {nextRun.duration} min · {nextRun.hrZone} · {nextRun.km_estimate}
              </div>
            )}
          </div>
        </>
      )}

      {/* Trail countdown */}
      <div className="os-section-label">Trail 10 km — {TRAIL_DATE}</div>
      <div className="os-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: trailDays < 14 ? 'var(--gold)' : 'var(--text)' }}>
            {trailDays > 0 ? trailDays : '!'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--sub)' }}>{trailDays > 0 ? 'dagen' : 'nu!'}</div>
        </div>
        <ProgressBar pct={trailPct} color="var(--gold)" />
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <>
          <div className="os-section-label">Recente sessies</div>
          <div className="os-card">
            {recentRuns.map(l => {
              const run = RUNS.find(r => r.nr === l.run_session);
              return (
                <div key={l.date} className="os-detail-row">
                  <span className="os-dk">T{l.run_session} · {l.date.slice(5)}</span>
                  <span className="os-dv" style={{ fontSize: 12 }}>
                    {run?.km_estimate || '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: ENERGIE
// ═══════════════════════════════════════════════════════════════
function TabEnergie({ logs }) {
  const allLogs = Object.values(logs).sort((a, b) => b.date.localeCompare(a.date));
  const recent30 = allLogs.slice(0, 30);

  const avgEnergy = avg(recent30.map(l => l.energy).filter(x => x != null));
  const avgSleep  = avg(recent30.map(l => l.sleep_hours).filter(x => x != null));
  const avgBatt   = avg(recent30.map(l => l.battery_start).filter(x => x != null));

  const pemDays = recent30.filter(l => l.symptom_pem).length;

  // Sleep quality breakdown
  const sleepCounts = [0, 1, 2, 3].map(q => ({
    val: q,
    label: ['Slecht', 'Matig', 'Goed', 'Top'][q],
    count: recent30.filter(l => l.sleep_quality === q).length,
  }));
  const maxSleepCount = Math.max(...sleepCounts.map(s => s.count), 1);

  // Consecutive logged streak
  let logStreak = 0;
  const tod = todayStr();
  for (let i = 0; i < 90; i++) {
    const d = new Date(tod);
    d.setDate(d.getDate() - i);
    const dk = d.toISOString().slice(0, 10);
    if (logs[dk]) logStreak++;
    else if (i > 0) break;
  }

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Gemiddelden (30 dagen)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Energie', val: avgEnergy != null ? avgEnergy.toFixed(1) : '—', sub: 'van 3', color: 'var(--sage)' },
          { label: 'Slaap', val: avgSleep != null ? avgSleep.toFixed(1) : '—', sub: 'uren', color: 'var(--blue)' },
          { label: 'Batterij', val: avgBatt != null ? Math.round(avgBatt) + '%' : '—', sub: 'start', color: 'var(--gold)' },
        ].map(({ label, val, sub, color }) => (
          <div key={label} className="os-card" style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)', color }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 2 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--ghost)' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="os-section-label">Energie — 30 dagen</div>
      <div className="os-card">
        <EnergySparkline logs={logs} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ghost)', marginTop: 4 }}>
          <span>leeg (0)</span>
          <span>hoog (3)</span>
        </div>
      </div>

      <div className="os-section-label">Slaapkwaliteit (30 dagen)</div>
      <div className="os-card">
        {sleepCounts.map(({ label, count }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
              color: 'var(--sub)', marginBottom: 3 }}>
              <span>{label}</span>
              <span>{count}×</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(count / maxSleepCount) * 100}%`,
                background: 'var(--blue)', borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: pemDays > 2 ? 'var(--rust)' : 'var(--text)' }}>{pemDays}</div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>PEM-dagen (30d)</div>
        </div>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--green)' }}>{logStreak}</div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>dagen gelogd (rij)</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: ROUTINES
// ═══════════════════════════════════════════════════════════════
function TabRoutines() {
  const routines = (() => {
    try { return JSON.parse(localStorage.getItem('gc_routines') || '[]'); } catch { return []; }
  })();

  const stages = [
    { id: 'learning',  emoji: '🌱', label: 'Aan het leren',   color: 'var(--gold)' },
    { id: 'stable',    emoji: '🌿', label: 'Stabiel',          color: 'var(--sage)' },
    { id: 'automatic', emoji: '🌳', label: 'Automatisch',      color: 'var(--green)' },
  ];

  if (routines.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sub)', fontSize: 13 }}>
        Nog geen routines bijgehouden.<br />
        <span style={{ fontSize: 11, color: 'var(--ghost)' }}>Voeg ze toe via Leven → Routines.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Stage counts */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Status</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {stages.map(s => {
          const count = routines.filter(r => r.stage === s.id).length;
          return (
            <div key={s.id} className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 22, marginBottom: 2 }}>{s.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)', color: s.color }}>
                {count}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.3 }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per stage lists */}
      {stages.map(s => {
        const stageRoutines = routines.filter(r => r.stage === s.id);
        if (!stageRoutines.length) return null;
        return (
          <React.Fragment key={s.id}>
            <div className="os-section-label">{s.emoji} {s.label}</div>
            <div className="os-card">
              {stageRoutines.map(r => (
                <div key={r.id} className="os-detail-row">
                  <span className="os-dk">{r.name}</span>
                  {r.trigger && <span className="os-dv" style={{ fontSize: 11, color: 'var(--ghost)' }}>
                    na: {r.trigger}
                  </span>}
                </div>
              ))}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: TIJDLIJN
// ═══════════════════════════════════════════════════════════════
function TabTijdlijn({ sessions }) {
  const tod = todayStr();
  const sorted = [...PERSONAL_EVENTS].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Mijlpalen</div>
      <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 16 }}>
        {/* Vertical timeline line */}
        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2,
          background: 'var(--border)', borderRadius: 2 }} />

        {sorted.map(e => {
          const isPast = e.startDate < tod;
          const isToday = e.startDate === tod || (e.endDate && e.startDate <= tod && e.endDate >= tod);
          const daysTo = Math.ceil((new Date(e.startDate) - new Date(tod)) / 86400000);
          const d = new Date(e.startDate + 'T12:00:00');
          const dateLabel = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

          return (
            <div key={e.startDate + e.title} style={{ position: 'relative', marginBottom: 16 }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: -20, top: 4, width: 12, height: 12,
                borderRadius: '50%', border: `2px solid ${isPast ? 'var(--divide)' : isToday ? 'var(--rust)' : 'var(--sage)'}`,
                background: isToday ? 'var(--rust)' : isPast ? 'var(--bg)' : 'var(--card)',
              }} />

              <div style={{ opacity: isPast ? 0.55 : 1 }}>
                <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 2 }}>{dateLabel}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: isToday ? 'var(--rust)' : 'var(--text)', marginBottom: 2 }}>
                  {e.emoji} {e.title}
                </div>
                {e.description && (
                  <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.4 }}>{e.description}</div>
                )}
                {!isPast && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--rust)' : 'var(--sage)', marginTop: 3 }}>
                    {isToday ? 'Vandaag!' : daysTo === 1 ? 'Morgen' : `over ${daysTo} dagen`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photos */}
      <div className="os-section-label">Progressiefoto's</div>
      <div className="os-card">
        <PhotoTimeline sessions={sessions} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ProgressieScreen({ logs, streak }) {
  const [activeTab, setActiveTab] = useState(0);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    photoStore.getAll().then(s => setSessions(s.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => {});
  }, []);

  return (
    <div className="os-content">
      <SubTabs tabs={SUBTABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 0 && <TabOverzicht logs={logs} streak={streak} sessions={sessions} />}
      {activeTab === 1 && <TabLichaam logs={logs} />}
      {activeTab === 2 && <TabHardlopen logs={logs} />}
      {activeTab === 3 && <TabEnergie logs={logs} />}
      {activeTab === 4 && <TabRoutines />}
      {activeTab === 5 && <TabTijdlijn sessions={sessions} />}
    </div>
  );
}
