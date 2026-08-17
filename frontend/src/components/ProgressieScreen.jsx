import React, { useState, useEffect } from 'react';
import { photoStore } from '../photoStore';
import { USER, PERSONAL_EVENTS } from '../config';

const TRAIL_DATE = '2026-10-03';
const TOTAL_RUNS = 35;

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysBetween(fromStr, toStr) {
  return Math.ceil((new Date(toStr) - new Date(fromStr)) / 86400000);
}

function ProgressBar({ pct, color = 'var(--sage)' }) {
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
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

function MiniWeightLine({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length < 2) return null;

  const GOAL = USER.goalWeight;
  const W = 320, H = 60;
  const PL = 4, PR = 4, PT = 8, PB = 8;
  const cW = W - PL - PR, cH = H - PT - PB;

  const weights  = entries.map(e => e.weight);
  const maxW     = Math.max(...weights, USER.startWeight + 1);
  const minW     = Math.min(GOAL - 0.5, ...weights);
  const rangeW   = maxW - minW;

  const totalDays = Math.max(1, daysBetween(entries[0].date, entries[entries.length - 1].date));

  const xFor = (date) => PL + (daysBetween(entries[0].date, date) / totalDays) * cW;
  const yFor = (w)    => PT + (1 - (w - minW) / rangeW) * cH;

  const goalY  = yFor(GOAL);
  const points = entries.map(e => ({ x: xFor(e.date), y: yFor(e.weight), w: e.weight }));
  const path   = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last   = points[points.length - 1];

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

const PHOTO_TYPES = [
  { key: 'voor',   label: 'Voor' },
  { key: 'zij',    label: 'Zij'  },
  { key: 'achter', label: 'Achter' },
];

function PhotoTimeline({ sessions }) {
  const [expandedDate, setExpandedDate] = useState(null);

  if (!sessions.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
      Nog geen progressiefoto's.
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

export default function ProgressieScreen({ logs, streak }) {
  const [sessions, setSessions] = useState([]);
  const tod = todayStr();

  useEffect(() => {
    photoStore.getAll().then(s => setSessions(s.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => {});
  }, []);

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
    const elapsed   = daysBetween(USER.startDate, tod);
    return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  })();

  const weightLost = latestWeight ? +(USER.startWeight - latestWeight).toFixed(1) : 0;
  const weightToGo = latestWeight ? +(latestWeight - USER.goalWeight).toFixed(1) : null;

  return (
    <div className="os-content">

      {/* 4 outcome tiles */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Resultaten</div>
      <div className="os-outcomes">

        {/* Gewicht */}
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Gewicht</div>
          <div className="os-outcome-num" style={{ color: 'var(--rust)' }}>
            {latestWeight ? `${latestWeight}` : '—'}
          </div>
          <div className="os-outcome-sub">
            {latestWeight ? `kg · doel ${USER.goalWeight}` : 'nog niet ingevuld'}
          </div>
          <ProgressBar pct={weightPct} color="var(--rust)" />
        </div>

        {/* Trainingen */}
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Trainingen</div>
          <div className="os-outcome-num" style={{ color: 'var(--sage)' }}>
            {completedRuns}
          </div>
          <div className="os-outcome-sub">van {TOTAL_RUNS} gelopen</div>
          <ProgressBar pct={runPct} color="var(--sage)" />
        </div>

        {/* Trail 10 km */}
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Trail 10 km</div>
          <div className="os-outcome-num" style={{ color: trailDays < 14 ? 'var(--gold)' : 'var(--text)' }}>
            {trailDays > 0 ? trailDays : '!'}
          </div>
          <div className="os-outcome-sub">
            {trailDays > 0 ? 'dagen' : 'nu!'}
          </div>
          <ProgressBar pct={trailPct} color="var(--gold)" />
        </div>

        {/* Streak */}
        <div className="os-outcome-tile">
          <div className="os-outcome-label">Streak</div>
          <div className="os-outcome-num" style={{ color: streak > 0 ? 'var(--green)' : 'var(--muted)' }}>
            {streak}
          </div>
          <div className="os-outcome-sub">
            {streak === 1 ? 'dag op rij' : 'dagen op rij'}
          </div>
          <ProgressBar pct={Math.min(100, streak * 5)} color="var(--green)" />
        </div>

      </div>

      {/* Weight detail */}
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
                  <div style={{ fontSize: accent ? 20 : 15, fontWeight: 800, color: accent || 'var(--text)',
                    fontFamily: 'var(--font-serif)' }}>{val}</div>
                </div>
              ))}
            </div>

            <MiniWeightLine logs={logs} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
              <span style={{ color: weightLost > 0 ? 'var(--sage)' : 'var(--muted)' }}>
                {weightLost > 0 ? `−${weightLost} kg afgevallen` : weightLost < 0 ? `+${Math.abs(weightLost)} kg aangekomen` : 'nog geen verandering'}
              </span>
              {weightToGo !== null && (
                <span style={{ color: 'var(--muted)' }}>nog {weightToGo} kg te gaan</span>
              )}
            </div>
          </div>
        </ExpandSection>
      )}

      {/* Photo timeline */}
      <div className="os-section-label">Foto-tijdlijn</div>
      <div className="os-card">
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            Nog geen progressiefoto's.<br />
            <span style={{ fontSize: 11 }}>Maak foto's via Lichaam → Training vastleggen.</span>
          </div>
        ) : (
          <PhotoTimeline sessions={sessions} />
        )}
      </div>

    </div>
  );
}
