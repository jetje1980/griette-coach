import React, { useState, useEffect } from 'react';
import { photoStore } from '../photoStore';
import { dreamStore } from '../dreamStore';
import { USER, PERSONAL_EVENTS } from '../config';
import { RUNS } from '../data/runningSchema';
import { loadStrengthSessions, findExercise } from '../data/strengthSchema';
import { protectedHours } from './WeekScreen';
import { store } from '../store';
import SubTabs from './SubTabs';

// Zeven domeinen: Body · Run · Strength · Fresh · Money · Freedom · Routines
const SUBTABS = ['Overzicht', 'Body', 'Run', 'Strength', 'Fresh', 'Money', 'Freedom', 'Routines', 'Tijdlijn'];

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

function getRunWeekStreak(logs) {
  function weekMonday(d) {
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }
  const now = new Date();
  const currentMonday = weekMonday(now);
  const runDates = new Set(
    Object.values(logs).filter(l => l.run_done && l.date).map(l => l.date)
  );
  let streak = 0;
  for (let w = 0; w < 8; w++) {
    const mon = new Date(currentMonday);
    mon.setDate(currentMonday.getDate() - w * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const monStr = mon.toISOString().slice(0, 10);
    const sunStr = sun.toISOString().slice(0, 10);
    const hasRun = [...runDates].some(d => d >= monStr && d <= sunStr);
    if (hasRun) {
      streak++;
    } else if (w === 0) {
      continue; // current week may not have a run yet — don't break the streak
    } else {
      break;
    }
  }
  return streak;
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
function TabOverzicht({ logs, streak, sessions, goToTab }) {
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
      <div className="os-card" style={{ cursor: 'pointer' }} onClick={() => goToTab(8)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Progressiefoto's</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {sessions.length > 0
                ? `${sessions.length} sessie${sessions.length !== 1 ? 's' : ''} opgeslagen`
                : "Nog geen foto's — bekijk tijdlijn"}
            </div>
          </div>
          <span style={{ fontSize: 18, color: 'var(--muted)' }}>→</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: LICHAAM
// ═══════════════════════════════════════════════════════════════
function TabLichaam({ logs, sessions }) {
  const [measurements, setMeasurements] = useState([]);
  const [dreamImgs, setDreamImgs] = useState([]);

  useEffect(() => {
    store.getMeasurements().then(m => setMeasurements(Array.isArray(m) ? m : [])).catch(() => {});
    dreamStore.getAll().then(all => setDreamImgs(all.body || [])).catch(() => {});
  }, []);

  // Future → Start → Now
  const sortedSessions = [...(sessions || [])].sort((a, b) => a.date.localeCompare(b.date));
  const startPhoto = sortedSessions[0]?.views?.voor || Object.values(sortedSessions[0]?.views || {})[0];
  const lastSession = sortedSessions[sortedSessions.length - 1];
  const nowPhoto = sortedSessions.length > 1
    ? (lastSession?.views?.voor || Object.values(lastSession?.views || {})[0])
    : null;
  const futureImg = dreamImgs[0];
  const showFSN = futureImg || startPhoto;

  const weightEntries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = weightEntries[0]?.weight || null;
  const weightLost = latestWeight ? +(USER.startWeight - latestWeight).toFixed(1) : 0;
  const weightToGo = latestWeight ? +(latestWeight - USER.goalWeight).toFixed(1) : null;
  const weightPct = latestWeight
    ? Math.min(100, Math.max(0, ((USER.startWeight - latestWeight) / (USER.startWeight - USER.goalWeight)) * 100))
    : 0;

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

      {/* Future → Start → Now */}
      {showFSN && (
        <>
          <div className="os-section-label">Future → Start → Now</div>
          <div className="os-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Future', img: futureImg ? `data:${futureImg.mimeType};base64,${futureImg.base64}` : null, hint: 'Dream Board' },
                { label: 'Start', img: startPhoto ? `data:${startPhoto.mimeType};base64,${startPhoto.base64}` : null, hint: sortedSessions[0]?.date?.slice(5) },
                { label: 'Now', img: nowPhoto ? `data:${nowPhoto.mimeType};base64,${nowPhoto.base64}` : null, hint: lastSession?.date?.slice(5) },
              ].map(({ label, img, hint }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  {img ? (
                    <img src={img} alt={label} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <div style={{ height: 110, background: 'var(--bg)', borderRadius: 8,
                      border: '1px dashed var(--border)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, color: 'var(--ghost)', padding: 4, lineHeight: 1.3 }}>
                      {label === 'Future' ? 'Upload in Leven → Toekomst' : 'Nog geen foto'}
                    </div>
                  )}
                  {hint && img && <div style={{ fontSize: 9, color: 'var(--ghost)', marginTop: 3 }}>{hint}</div>}
                </div>
              ))}
            </div>
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
    .slice(0, 8);

  const totalKm = Object.values(logs)
    .filter(l => l.run_done && l.run_session)
    .reduce((sum, l) => {
      const run = RUNS.find(r => r.nr === l.run_session);
      if (!run) return sum;
      const km = run.km_estimate ? parseFloat(run.km_estimate) : 0;
      return sum + (isNaN(km) ? 0 : km);
    }, 0);

  const runWeekStreak = getRunWeekStreak(logs);
  const trailDays = daysBetween(tod, TRAIL_DATE);
  const trailPct = (() => {
    const totalDays = daysBetween(USER.startDate, TRAIL_DATE);
    const elapsed = daysBetween(USER.startDate, tod);
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  })();

  // Langste comfortabele run (duur van gedane sessies)
  const longestRun = Object.values(logs)
    .filter(l => l.run_done && l.run_session)
    .reduce((max, l) => {
      const run = RUNS.find(r => r.nr === Number(l.run_session));
      return run && run.duration > max ? run.duration : max;
    }, 0);

  // 5K tests (handmatig vastgelegd)
  const [tests, setTests] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gc_5k_tests') || '[]'); } catch { return []; }
  });
  function addTest() {
    const t = window.prompt('5K tijd in minuten (bijv. 42.5):');
    const min = parseFloat((t || '').replace(',', '.'));
    if (isNaN(min) || min <= 0) return;
    const next = [{ date: todayStr(), minutes: min }, ...tests];
    localStorage.setItem('gc_5k_tests', JSON.stringify(next));
    setTests(next);
  }

  // Trainingsbelasting: runs per week, laatste 4 weken
  const loadWeeks = (() => {
    const runDates = Object.values(logs).filter(l => l.run_done && l.date).map(l => l.date);
    const monday = (() => {
      const d = new Date(tod + 'T12:00:00');
      const dow = d.getDay();
      d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
      return d;
    })();
    return Array.from({ length: 4 }, (_, i) => {
      const mon = new Date(monday); mon.setDate(monday.getDate() - (3 - i) * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const ms = mon.toISOString().slice(0, 10), ss = sun.toISOString().slice(0, 10);
      return { label: ms.slice(5), count: runDates.filter(d => d >= ms && d <= ss).length };
    });
  })();

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
        {runWeekStreak > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}>
            {runWeekStreak} week{runWeekStreak !== 1 ? 'en' : ''} op rij getraind
          </div>
        )}
      </div>

      {/* Langste run + belasting */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px', marginBottom: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--sage)' }}>
            {longestRun || '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.3 }}>min<br />langste sessie</div>
        </div>
        <div className="os-card" style={{ flex: 2, padding: '12px 12px', marginBottom: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.4px', marginBottom: 6 }}>Belasting — runs/week</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 34 }}>
            {loadWeeks.map(w => (
              <div key={w.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: Math.max(3, w.count * 10), background: w.count > 3 ? 'var(--rust)' : 'var(--sage)',
                  borderRadius: 3, marginBottom: 2 }} />
                <div style={{ fontSize: 8, color: 'var(--ghost)' }}>{w.count}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: 'var(--ghost)', marginTop: 2, textAlign: 'center' }}>laatste 4 weken · &gt;3 = hoog</div>
        </div>
      </div>

      {/* 5K tests */}
      <div className="os-section-label">5K test</div>
      <div className="os-card">
        {tests.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 8 }}>
            Nog geen 5K-test gelogd. Komt in het TEST-blok van de roadmap.
          </div>
        ) : (
          tests.slice(0, 5).map((t, i) => (
            <div key={i} className="os-detail-row">
              <span className="os-dk">{t.date}</span>
              <span className="os-dv" style={{ fontWeight: 700 }}>
                {Math.floor(t.minutes)}:{String(Math.round((t.minutes % 1) * 60)).padStart(2, '0')} min
                {i < tests.length - 1 && tests[i + 1] && t.minutes < tests[i + 1].minutes ? ' ▲' : ''}
              </span>
            </div>
          ))
        )}
        <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 4 }} onClick={addTest}>
          + 5K tijd vastleggen
        </button>
      </div>

      {/* Next run */}
      {nextRun && (
        <>
          <div className="os-section-label">Volgende sessie</div>
          <div className="os-card" style={{ borderLeft: '3px solid var(--sage)' }}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              T{nextRunNr}/{TOTAL_RUNS}
            </div>
            {nextRun.goal && (
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, fontFamily: 'var(--font-serif)' }}>
                {nextRun.goal}
              </div>
            )}
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
// TAB: STRENGTH
// ═══════════════════════════════════════════════════════════════
function TabStrength({ logs }) {
  const sessions = loadStrengthSessions();
  const fullSessions = sessions.filter(s => s.program !== 'snack');
  const snacks = sessions.filter(s => s.program === 'snack');
  const legacyCore = Object.values(logs).filter(l => l.core_done && !l.strength_done).length;

  // Belangrijkste lifts: laatste + beste per hoofdoefening
  const KEY_LIFTS = ['a_squat', 'a_hinge', 'a_glutes', 'b_lunge', 'b_push', 'a_pull'];
  const lifts = KEY_LIFTS.map(id => {
    const ex = findExercise(id);
    let last = null, best = null;
    for (const s of sessions) {
      const e = (s.exercises || []).find(x => x.id === id && (x.done || x.weight));
      if (!e) continue;
      if (!last) last = { ...e, date: s.date };
      const w = parseFloat(e.weight) || 0;
      if (!best || w > (parseFloat(best.weight) || 0)) best = { ...e, date: s.date };
    }
    return last ? { ex, last, best } : null;
  }).filter(Boolean);

  // Volume per week (gewicht × sets × reps), laatste 4 weken
  const volWeeks = (() => {
    const tod = todayStr();
    const monday = (() => {
      const d = new Date(tod + 'T12:00:00');
      const dow = d.getDay();
      d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
      return d;
    })();
    return Array.from({ length: 4 }, (_, i) => {
      const mon = new Date(monday); mon.setDate(monday.getDate() - (3 - i) * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const ms = mon.toISOString().slice(0, 10), ss = sun.toISOString().slice(0, 10);
      const vol = sessions.filter(s => s.date >= ms && s.date <= ss)
        .reduce((sum, s) => sum + (s.exercises || []).reduce((v, e) => {
          const w = parseFloat(e.weight) || 0;
          return v + w * (parseInt(e.sets, 10) || 0) * (parseInt(e.reps, 10) || 0);
        }, 0), 0);
      const count = sessions.filter(s => s.date >= ms && s.date <= ss && s.program !== 'snack').length;
      return { label: ms.slice(5), vol: Math.round(vol), count };
    });
  })();
  const maxVol = Math.max(...volWeeks.map(w => w.vol), 1);

  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sub)', fontSize: 13, lineHeight: 1.7 }}>
        Nog geen krachtsessies gelogd.<br />
        <span style={{ fontSize: 11, color: 'var(--ghost)' }}>
          Start via Lichaam → Training → Kracht (programma A of B).
        </span>
        {legacyCore > 0 && (
          <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 10 }}>
            ({legacyCore} oudere core-sessies geregistreerd vóór de krachtmodule)
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Sessies</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px', marginBottom: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--blue)' }}>
            {fullSessions.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ghost)' }}>volledige sessies</div>
        </div>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px', marginBottom: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--gold)' }}>
            {snacks.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ghost)' }}>⚡ snacks</div>
        </div>
      </div>

      {lifts.length > 0 && (
        <>
          <div className="os-section-label">Belangrijkste lifts</div>
          <div className="os-card">
            {lifts.map(({ ex, last, best }) => (
              <div key={ex.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--divide)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                    {last.weight ? `${last.weight} kg · ` : ''}{last.sets}×{last.reps}
                    {last.rir != null ? ` · RIR ${last.rir}` : ''}
                  </span>
                </div>
                {best && parseFloat(best.weight) > 0 && best.weight !== last.weight && (
                  <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 1 }}>
                    beste: {best.weight} kg ({best.date.slice(5)})
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="os-section-label">Volume/load trend</div>
      <div className="os-card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 56 }}>
          {volWeeks.map(w => (
            <div key={w.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: Math.max(3, (w.vol / maxVol) * 44), background: 'var(--blue)',
                borderRadius: 3, marginBottom: 2, opacity: w.vol > 0 ? 1 : 0.25 }} />
              <div style={{ fontSize: 9, color: 'var(--ghost)' }}>{w.vol > 0 ? `${w.vol}` : '·'}</div>
              <div style={{ fontSize: 8, color: 'var(--ghost)' }}>{w.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 6, textAlign: 'center' }}>
          volume = kg × sets × reps per week
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: MONEY
// ═══════════════════════════════════════════════════════════════
function TabMoney() {
  const BUFFER_DOEL = 15000;
  const geld = (() => {
    try {
      const raw = localStorage.getItem('gc_geld');
      if (!raw) return { buffer: 0, expenses: [] };
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'number') return { buffer: parsed, expenses: [] };
      return { buffer: parsed?.buffer || 0, expenses: parsed?.expenses || [] };
    } catch { return { buffer: 0, expenses: [] }; }
  })();
  const pct = Math.min(100, (geld.buffer / BUFFER_DOEL) * 100);
  const vast = geld.expenses.filter(e => e.type === 'vast').reduce((s, e) => s + (e.amount || 0), 0);
  const maandenBuffer = vast > 0 ? (geld.buffer / vast) : null;

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Buffer → €{BUFFER_DOEL.toLocaleString('nl-NL')}</div>
      <div className="os-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 34, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: geld.buffer >= BUFFER_DOEL ? 'var(--green)' : 'var(--sage)' }}>
            €{geld.buffer.toLocaleString('nl-NL')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--sub)' }}>({Math.round(pct)}%)</div>
        </div>
        <ProgressBar pct={pct} color={geld.buffer >= BUFFER_DOEL ? 'var(--green)' : 'var(--sage)'} />
        <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 8 }}>
          {pct < 100
            ? `Nog €${(BUFFER_DOEL - geld.buffer).toLocaleString('nl-NL')} te gaan`
            : '🎉 Bufferdoel bereikt'}
        </div>
        {maandenBuffer != null && (
          <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>
            ≈ {maandenBuffer.toFixed(1)} maanden vaste lasten gedekt
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ghost)', lineHeight: 1.5 }}>
        Buffer bijwerken doe je in Leven → Geld.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: FREEDOM — beschermde vrije tijd
// ═══════════════════════════════════════════════════════════════
function TabFreedom() {
  const tod = todayStr();
  const monday = (() => {
    const d = new Date(tod + 'T12:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d;
  })();

  const weeks = Array.from({ length: 4 }, (_, i) => {
    const mon = new Date(monday); mon.setDate(monday.getDate() - (3 - i) * 7);
    let hours = 0, evenings = 0;
    for (let dd = 0; dd < 7; dd++) {
      const d = new Date(mon); d.setDate(mon.getDate() + dd);
      const key = `gc_day_plan_${d.toISOString().slice(0, 10)}`;
      let plan = {};
      try { plan = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* leeg */ }
      const fb = plan.freeBlocks || [];
      hours += protectedHours(fb);
      if (fb.includes('evening') || fb.includes('fullday')) evenings++;
    }
    return { label: mon.toISOString().slice(5, 10), hours, evenings, isCurrent: i === 3 };
  });
  const cur = weeks[3];
  const maxH = Math.max(...weeks.map(w => w.hours), 1);

  return (
    <div>
      <div className="os-section-label" style={{ marginTop: 0 }}>Deze week</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', marginBottom: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--green)' }}>
            {cur.hours}u
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>🌿 beschermde vrije tijd</div>
        </div>
        <div className="os-card" style={{ flex: 1, textAlign: 'center', padding: '14px 8px', marginBottom: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-serif)', color: 'var(--blue)' }}>
            {cur.evenings}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>🌙 vrije avonden</div>
        </div>
      </div>

      <div className="os-section-label">Trend — 4 weken</div>
      <div className="os-card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
          {weeks.map(w => (
            <div key={w.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: Math.max(3, (w.hours / maxH) * 46),
                background: w.isCurrent ? 'var(--green)' : 'var(--sage)',
                borderRadius: 3, marginBottom: 2, opacity: w.hours > 0 ? 1 : 0.25 }} />
              <div style={{ fontSize: 9, color: 'var(--ghost)' }}>{w.hours}u</div>
              <div style={{ fontSize: 8, color: 'var(--ghost)' }}>{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ghost)', lineHeight: 1.6, marginTop: 8 }}>
        Beschermde blokken markeer je in Week → dag → Beschermde vrije tijd.
        Ochtend/middag/avond tellen als 3 uur, een hele dag als 9 uur.
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
      {activeTab === 0 && <TabOverzicht logs={logs} streak={streak} sessions={sessions} goToTab={setActiveTab} />}
      {activeTab === 1 && <TabLichaam logs={logs} sessions={sessions} />}
      {activeTab === 2 && <TabHardlopen logs={logs} />}
      {activeTab === 3 && <TabStrength logs={logs} />}
      {activeTab === 4 && <TabEnergie logs={logs} />}
      {activeTab === 5 && <TabMoney />}
      {activeTab === 6 && <TabFreedom />}
      {activeTab === 7 && <TabRoutines />}
      {activeTab === 8 && <TabTijdlijn sessions={sessions} />}
    </div>
  );
}
