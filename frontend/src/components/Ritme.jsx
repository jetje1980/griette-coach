import React, { useState, useEffect } from 'react';
import { PERSONAL_EVENTS } from '../config';

function today() { return new Date().toISOString().slice(0, 10); }

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function formatDate(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function weeksStr(days) {
  const w = days / 7;
  return w.toFixed(1).replace('.0', '') + ' wk';
}

const PLAN_START = '2026-08-17';
const PLAN_END   = '2026-12-13';

const PHASES = [
  {
    id: 'opbouw',
    label: 'Fase 1 · Opbouw',
    start: '2026-08-17',
    end: '2026-09-14',
    color: '#2A7A4F',
    dark: '#1B3A2D',
    focus: 'Basisconditie bouwen. Zone B elke sessie (max 132 bpm). Lichaam wennen aan ritme na vakantie.',
    keys: [
      { date: '2026-08-18', label: 'Eerste hardloopdag — 20 min zone B' },
      { date: '2026-08-21', label: '💉 Mounjaro herstart prik 1' },
      { date: '2026-08-23', label: 'Eerste lange loop (25–30 min)' },
      { date: '2026-09-02', label: '💍 22 jaar getrouwd — trouwjurk passen!' },
    ],
  },
  {
    id: 'build',
    label: 'Fase 2 · Build',
    start: '2026-09-15',
    end: '2026-09-28',
    color: '#C4622D',
    dark: '#7A3618',
    focus: 'Meer kilometers, eerste temposessies. Zaterdag richting 7–8 km. Kracht progressie.',
    keys: [
      { date: '2026-09-15', label: 'Loop 35 min zone B + temposessies starten' },
      { date: '2026-09-22', label: 'Tapering-week: lichte sessies' },
    ],
  },
  {
    id: 'race1',
    label: '🏔️ Race · Trail 10 km',
    start: '2026-09-29',
    end: '2026-10-03',
    color: '#C4622D',
    dark: '#7A3618',
    isRace: true,
    focus: 'Benen fris houden. Vertrouw het opbouwwerk. Zone B vasthouden — niet sprinten.',
    keys: [
      { date: '2026-09-29', label: 'Taperingweek: 20 min easy max' },
      { date: '2026-10-02', label: 'Nacht voor race: goed eten, vroeg slapen' },
      { date: '2026-10-03', label: '🏆 TRAIL 10 KM — Startschot!' },
    ],
  },
  {
    id: 'bereloop',
    label: 'Fase 3 · Bereloop prep',
    start: '2026-10-04',
    end: '2026-11-01',
    color: '#1A6E8E',
    dark: '#0D3D50',
    focus: 'Herstelweek, dan opbouw voor Bereloop (strand + duin = zwaarder dan weg). Kracht extra fokus.',
    keys: [
      { date: '2026-10-04', label: 'Herstelweek — 25 min easy max' },
      { date: '2026-10-12', label: 'Bereloop opbouw: 30 min zone B + strides' },
      { date: '2026-10-26', label: 'Tapering week voor Bereloop' },
      { date: '2026-10-30', label: '🏃 Bereloop Terschelling — 10 km strand/duin' },
    ],
  },
  {
    id: 'ameland',
    label: 'Fase 4 · Ameland eindspurt',
    start: '2026-11-02',
    end: '2026-12-13',
    color: '#6B35B5',
    dark: '#3D1A70',
    focus: 'Conditie vasthouden, kracht verder bouwen. Doel: 57 kg + strak gespierd bij de eindstreep.',
    keys: [
      { date: '2026-11-06', label: 'Loop 35 min — vergelijk met week 1' },
      { date: '2026-12-06', label: 'Tapering: laatste zware week voorbij' },
      { date: '2026-12-13', label: '🏝️ AMELAND 5 KM — Seizoenfinale!' },
    ],
  },
];

const UPCOMING_EVENTS = PERSONAL_EVENTS
  .filter(e => e.endDate >= today())
  .sort((a, b) => a.startDate.localeCompare(b.startDate))
  .slice(0, 6);

const STORAGE_KEY = 'gc_ritme_notes';

function TimelineBar() {
  const todayStr = today();
  const totalDays = daysBetween(PLAN_START, PLAN_END);

  function pct(d) {
    return Math.max(0, Math.min(100, (daysBetween(PLAN_START, d) / totalDays) * 100));
  }

  return (
    <div style={{ position: 'relative', padding: '8px 0 20px' }}>
      {/* Track */}
      <div style={{
        height: 10, borderRadius: 5,
        background: 'var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        {PHASES.map(ph => {
          const left = pct(ph.start);
          const width = pct(ph.end) - left;
          return (
            <div key={ph.id} style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              top: 0, bottom: 0,
              background: ph.isRace ? ph.color : ph.color + 'CC',
              borderRight: ph.isRace ? 'none' : `1.5px solid ${ph.dark}33`,
            }} />
          );
        })}
      </div>

      {/* Today marker */}
      {todayStr >= PLAN_START && todayStr <= PLAN_END && (
        <div style={{
          position: 'absolute',
          left: `${pct(todayStr)}%`,
          top: 4,
          transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: 14, height: 18, borderRadius: '50% 50% 50% 0',
            background: '#111', border: '2px solid #fff',
            transform: 'rotate(-45deg)',
          }} />
        </div>
      )}

      {/* Month labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: 'var(--muted)',
        fontWeight: 700, letterSpacing: 0.5,
        marginTop: 6, textTransform: 'uppercase',
      }}>
        {['Aug', 'Sep', 'Okt', 'Nov', 'Dec'].map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

export default function Ritme() {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [expanded, setExpanded] = useState(null);
  const todayStr = today();

  const saveNote = (key, value) => {
    const updated = { ...notes, [key]: value };
    setNotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Find current phase
  const currentPhase = PHASES.find(ph => todayStr >= ph.start && todayStr <= ph.end);
  const nextRaceEvent = UPCOMING_EVENTS.find(e => e.id === 'trail_10k' || e.id === 'bereloop' || e.id === 'ameland_5k' || e.id === 'oud_nieuw');

  useEffect(() => {
    if (currentPhase && expanded === null) setExpanded(currentPhase.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pane" style={{ padding: 0 }}>

      {/* ---- HEADER ---- */}
      <div style={{
        padding: '20px 16px 14px',
        background: 'var(--green, #1B3A2D)',
        color: '#fff',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, opacity: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
          Sport &amp; lifestyle coach · Griette
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 2 }}>
          Waar sta ik<br/>in mijn training?
        </div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
          17 aug – 13 dec · 3 races · {daysBetween(todayStr, PLAN_END)} dagen te gaan
        </div>
        <TimelineBar />
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: -6 }}>
          {PHASES.map(ph => (
            <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, opacity: 0.8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ph.color, display: 'inline-block' }} />
              {ph.label.split(' · ')[1] ?? ph.label}
            </div>
          ))}
        </div>
      </div>

      {/* ---- FASE BLOKKEN ---- */}
      <div style={{ padding: '12px 0 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 16px 8px' }}>
          Trainingsblokken
        </div>

        {PHASES.map(ph => {
          const isPast = ph.end < todayStr;
          const isCurrent = ph.start <= todayStr && todayStr <= ph.end;
          const isFuture = ph.start > todayStr;
          const isOpen = expanded === ph.id;
          const days = daysBetween(ph.start, ph.end);
          const upcomingKeys = ph.keys.filter(k => k.date >= todayStr);
          const pastKeys = ph.keys.filter(k => k.date < todayStr);

          return (
            <div
              key={ph.id}
              style={{
                marginBottom: 1,
                opacity: isPast ? 0.55 : 1,
              }}
            >
              {/* Phase header row */}
              <button
                onClick={() => setExpanded(isOpen ? null : ph.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 0,
                  padding: '12px 16px',
                  background: isCurrent ? `${ph.color}12` : 'var(--card)',
                  border: 'none', borderBottom: `1px solid var(--border)`,
                  borderLeft: `4px solid ${isCurrent ? ph.color : isPast ? 'var(--border)' : ph.color + '66'}`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontWeight: 800, fontSize: 14, color: isCurrent ? ph.color : isPast ? 'var(--muted)' : 'var(--text)',
                    }}>
                      {ph.label}
                    </span>
                    {isCurrent && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: ph.color, color: '#fff', letterSpacing: 0.5,
                      }}>NU</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8 }}>
                    <span>{formatDate(ph.start)} – {formatDate(ph.end)}</span>
                    <span style={{ color: ph.color, fontWeight: 700 }}>{weeksStr(days)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 16, color: 'var(--muted)', marginLeft: 8 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{
                  background: `${ph.color}09`,
                  borderLeft: `4px solid ${ph.color}`,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5, borderBottom: `1px solid ${ph.color}22` }}>
                    {ph.focus}
                  </div>

                  {isCurrent && upcomingKeys.length > 0 && (
                    <div style={{ padding: '8px 16px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ph.color, marginBottom: 8 }}>
                        Komende sleutelmomenten
                      </div>
                      {upcomingKeys.map(k => (
                        <div key={k.date} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '4px 0', borderTop: `1px solid ${ph.color}22` }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', minWidth: 58, fontVariantNumeric: 'tabular-nums' }}>
                            {formatDate(k.date)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{k.label}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {daysBetween(todayStr, k.date)}d
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isPast && pastKeys.length > 0 && (
                    <div style={{ padding: '8px 16px' }}>
                      {pastKeys.map(k => (
                        <div key={k.date} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '3px 0' }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 58 }}>{formatDate(k.date)}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1, textDecoration: 'line-through', opacity: 0.6 }}>{k.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isFuture && (
                    <div style={{ padding: '8px 16px' }}>
                      {ph.keys.map(k => (
                        <div key={k.date} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '4px 0', borderTop: `1px solid ${ph.color}22` }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 58 }}>{formatDate(k.date)}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{k.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- AGENDA EVENTS ---- */}
      <div style={{ padding: '16px 0 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 16px 8px' }}>
          Persoonlijke agenda
        </div>
        {UPCOMING_EVENTS.map(ev => {
          const daysTo = daysBetween(todayStr, ev.startDate);
          const isClose = daysTo <= 14;
          return (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--card)',
              borderLeft: `4px solid ${ev.color}`,
            }}>
              <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>{ev.emoji?.slice(0, 2)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{ev.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {formatDate(ev.startDate)}{ev.startDate !== ev.endDate ? ` – ${formatDate(ev.endDate)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: isClose ? ev.color : 'var(--muted)',
                }}>
                  {daysTo === 0 ? 'vandaag!' : daysTo === 1 ? 'morgen' : `${daysTo}d`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{weeksStr(daysTo)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- WEEKRITME ---- */}
      <div style={{ padding: '16px 0 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', padding: '0 16px 8px' }}>
          Standaard weekritme
        </div>
        {[
          { day: 'Ma', tag: 'Kracht A', note: '15 min circuit · AM', color: '#6B35B5' },
          { day: 'Di', tag: 'Lopen', note: '20–35 min zone B · AM', color: '#C4622D' },
          { day: 'Wo', tag: 'Kracht B', note: '15 min circuit · AM', color: '#6B35B5' },
          { day: 'Do', tag: 'Lopen', note: '25–40 min zone B · AM', color: '#C4622D' },
          { day: 'Vr', tag: 'Mounjaro / rust', note: '10 min mobility · geen zware sessie', color: '#1A6E8E' },
          { day: 'Za', tag: 'Lange loop', note: '30–50 min zone B', color: '#C4622D' },
          { day: 'Zo', tag: 'Actief herstel', note: 'Wandelen · maaltijdprep', color: '#2A7A4F' },
        ].map(({ day, tag, note, color }) => (
          <div key={day} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
          }}>
            <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--muted)', minWidth: 22 }}>{day}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: color + '18', color,
            }}>{tag}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>{note}</span>
          </div>
        ))}
      </div>

      {/* ---- INTENTIES ---- */}
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
          Mijn intenties voor dit seizoen
        </div>
        <textarea
          value={notes.intentions || ''}
          onChange={e => saveNote('intentions', e.target.value)}
          placeholder="57 kg · slank en gespierd · platte buik · 3 races uitlopen · sterk het nieuwe jaar in"
          style={{
            width: '100%', minHeight: 72, resize: 'vertical',
            fontSize: 13, lineHeight: 1.6, padding: '10px 12px',
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
      </div>

    </div>
  );
}
