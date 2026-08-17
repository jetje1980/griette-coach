import React, { useState, useEffect } from 'react';
import { PERSONAL_EVENTS } from '../config';

const today = () => new Date().toISOString().slice(0, 10);

// Sort and filter to upcoming events (from 2026-08-17 onwards)
const EVENTS_SORTED = [...PERSONAL_EVENTS]
  .filter(e => e.endDate >= '2026-08-17')
  .sort((a, b) => a.startDate.localeCompare(b.startDate));

const YEAR_START = '2026-08-01';
const YEAR_END   = '2027-01-31';

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function pct(dateStr) {
  const total = daysBetween(YEAR_START, YEAR_END);
  const pos   = daysBetween(YEAR_START, dateStr);
  return Math.max(0, Math.min(100, (pos / total) * 100));
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function daysFrom(dateStr) {
  const diff = daysBetween(today(), dateStr);
  if (diff < 0) return 'voorbij';
  if (diff === 0) return 'vandaag!';
  return `over ${diff}d`;
}

const WEEK_RHYTHM = [
  { day: 'Ma', emoji: '💪', blocks: ['AM: Krachtcircuit A (15 min)', 'PM: Wandelen of rust'], color: '#8B5CF6' },
  { day: 'Di', emoji: '🏃', blocks: ['AM: Hardlopen zone B (20–35 min)', 'PM: Foam roll + stretchen'], color: '#E07A3B' },
  { day: 'Wo', emoji: '💪', blocks: ['AM: Krachtcircuit B (15 min)', 'PM: Actieve herstel / wandelen'], color: '#8B5CF6' },
  { day: 'Do', emoji: '🏃', blocks: ['AM: Hardlopen zone B (25–40 min)', 'PM: Optioneel circuit C (10 min)'], color: '#E07A3B' },
  { day: 'Vr', emoji: '🧘', blocks: ['AM: Mobility / yoga (10 min)', 'PM: Mounjaro prikdag — rust'], color: '#06B6D4' },
  { day: 'Za', emoji: '🏃', blocks: ['AM: Lange duurloop (30–50 min)', 'PM: Wandelen + sociale tijd'], color: '#E07A3B' },
  { day: 'Zo', emoji: '♻️', blocks: ['Actief herstel of volledige rust', 'Voorbereiding week: maaltijdprep'], color: '#6B7280' },
];

const DAY_RHYTHM = [
  { time: '06:30', label: 'Opstaan + water (500 ml)', emoji: '☀️', editable: false },
  { time: '07:00', label: 'ADHD-meds + Candesartan', emoji: '💊', editable: false },
  { time: '07:15', label: 'Training AM (zie weekschema)', emoji: '🏋️', editable: true, key: 'am_training' },
  { time: '08:00', label: 'Eiwitrijk ontbijt', emoji: '🥚', editable: true, key: 'breakfast' },
  { time: '09:00', label: 'Focusblok werk / taken', emoji: '💻', editable: true, key: 'morning_focus' },
  { time: '12:30', label: 'Lunch met groente + eiwit', emoji: '🥗', editable: false },
  { time: '13:00', label: 'Korte wandeling (10 min)', emoji: '🚶', editable: false },
  { time: '14:00', label: 'Focusblok 2 of afspraken', emoji: '📋', editable: true, key: 'afternoon' },
  { time: '17:00', label: 'PM training of wandelen', emoji: '🏃', editable: true, key: 'pm_training' },
  { time: '18:00', label: 'Avondeten vóór 19:00', emoji: '🍽️', editable: false },
  { time: '20:00', label: 'Winddown: geen eten, rustig', emoji: '🌙', editable: false },
  { time: '22:30', label: 'Slaap (doel: 8 uur)', emoji: '😴', editable: false },
];

const STORAGE_KEY = 'gc_ritme_notes';

export default function Ritme() {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);

  const saveNote = (key, value) => {
    const updated = { ...notes, [key]: value };
    setNotes(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const todayStr = today();
  const todayPct = pct(todayStr);

  return (
    <div className="pane">
      {/* === JAAROVERZICHT === */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header" style={{ background: 'var(--sage)', color: '#fff' }}>
          <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>📅 Jaaroverzicht</span>
        </div>
        <div className="card-body" style={{ paddingTop: 8 }}>
          {/* Timeline bar */}
          <div style={{ position: 'relative', height: 36, marginBottom: 8, marginTop: 16 }}>
            <div style={{
              position: 'absolute', top: '50%', left: 0, right: 0,
              height: 4, background: 'var(--border)', borderRadius: 2, transform: 'translateY(-50%)',
            }} />
            {/* Today marker */}
            <div style={{
              position: 'absolute', top: '50%', left: `${todayPct}%`,
              width: 12, height: 12, borderRadius: '50%',
              background: 'var(--rust)', border: '2px solid #fff',
              transform: 'translate(-50%, -50%)', zIndex: 5,
            }} title="Vandaag" />
            {/* Event dots */}
            {EVENTS_SORTED.map(ev => {
              const p = pct(ev.startDate);
              const isPast = ev.endDate < todayStr;
              return (
                <button
                  key={ev.id}
                  onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
                  title={ev.title}
                  style={{
                    position: 'absolute', top: '50%', left: `${p}%`,
                    width: 22, height: 22, borderRadius: '50%',
                    background: isPast ? 'var(--border)' : ev.color,
                    border: '2px solid var(--bg)',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer', zIndex: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, lineHeight: 1,
                    opacity: isPast ? 0.5 : 1,
                    boxShadow: expandedEvent === ev.id ? `0 0 0 3px ${ev.color}44` : 'none',
                    transition: 'box-shadow 0.15s',
                    padding: 0, outline: 'none',
                  }}
                >
                  {ev.emoji?.slice(0, 1)}
                </button>
              );
            })}
          </div>

          {/* Month labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
            {['Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'].map(m => (
              <span key={m}>{m}</span>
            ))}
          </div>

          {/* Expanded event detail */}
          {expandedEvent && (() => {
            const ev = EVENTS_SORTED.find(e => e.id === expandedEvent);
            if (!ev) return null;
            const isPast = ev.endDate < todayStr;
            return (
              <div style={{
                padding: '10px 12px', borderRadius: 8, marginTop: 4,
                background: `${ev.color}18`,
                borderLeft: `3px solid ${ev.color}`,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  {ev.emoji} {ev.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                  {formatDate(ev.startDate)}{ev.startDate !== ev.endDate ? ` – ${formatDate(ev.endDate)}` : ''} · {isPast ? 'voorbij' : daysFrom(ev.startDate)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>{ev.description}</div>
                {ev.goal && (
                  <div style={{ fontSize: 12, color: ev.color, fontStyle: 'italic' }}>🎯 {ev.goal}</div>
                )}
              </div>
            );
          })()}

          {/* Event list */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EVENTS_SORTED.map(ev => {
              const isPast = ev.endDate < todayStr;
              return (
                <button
                  key={ev.id}
                  onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 8,
                    background: expandedEvent === ev.id ? `${ev.color}18` : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    opacity: isPast ? 0.5 : 1,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16, minWidth: 24, textAlign: 'center' }}>{ev.emoji?.slice(0, 2)}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{ev.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(ev.startDate)}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 12,
                    background: isPast ? 'var(--border)' : `${ev.color}22`,
                    color: isPast ? 'var(--muted)' : ev.color,
                    whiteSpace: 'nowrap', fontWeight: 600,
                  }}>
                    {daysFrom(ev.startDate)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* === WEEK RITME === */}
      <div className="card" style={{ marginTop: 12, marginBottom: 0 }}>
        <div className="card-header" style={{ background: '#2D6047', color: '#fff' }}>
          <span style={{ fontWeight: 700 }}>📆 Weekritme</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {WEEK_RHYTHM.map(({ day, emoji, blocks, color }) => (
            <div key={day} style={{
              display: 'flex', alignItems: 'flex-start', gap: 0,
              borderBottom: '1px solid var(--border)',
              padding: '10px 14px',
            }}>
              <div style={{
                minWidth: 40, fontWeight: 700, fontSize: 13, color,
                paddingTop: 2,
              }}>{emoji} {day}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {blocks.map((b, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === DAG RITME === */}
      <div className="card" style={{ marginTop: 12, marginBottom: 0 }}>
        <div className="card-header" style={{ background: '#1D4ED8', color: '#fff' }}>
          <span style={{ fontWeight: 700 }}>⏰ Dagritme</span>
          <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 6 }}>tik op tijd om aan te passen</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {DAY_RHYTHM.map(({ time, label, emoji, editable, key }) => (
            <div key={time} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px',
              borderBottom: '1px solid var(--border)',
              background: editingBlock === key ? 'var(--card)' : 'transparent',
            }}>
              <span style={{
                fontSize: 11, fontVariantNumeric: 'tabular-nums',
                color: 'var(--muted)', minWidth: 38, fontWeight: 600,
              }}>{time}</span>
              <span style={{ fontSize: 16 }}>{emoji}</span>
              {editingBlock === key ? (
                <input
                  autoFocus
                  defaultValue={notes[key] || label}
                  onBlur={e => { saveNote(key, e.target.value); setEditingBlock(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { saveNote(key, e.target.value); setEditingBlock(null); } }}
                  style={{
                    flex: 1, fontSize: 13, border: '1px solid var(--sage)',
                    borderRadius: 6, padding: '3px 8px', background: 'var(--bg)', color: 'var(--text)',
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4,
                    cursor: editable ? 'pointer' : 'default',
                    borderBottom: editable && notes[key] ? '1px dashed var(--sage)' : 'none',
                  }}
                  onClick={() => editable && setEditingBlock(key)}
                >
                  {editable && notes[key] ? notes[key] : label}
                </span>
              )}
              {editable && !editingBlock && (
                <button
                  onClick={() => setEditingBlock(key)}
                  style={{
                    fontSize: 12, color: 'var(--muted)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '2px 4px',
                    opacity: 0.5,
                  }}
                >✏️</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* === JAARNOTITIES === */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header" style={{ background: 'var(--gold)', color: '#fff' }}>
          <span style={{ fontWeight: 700 }}>📝 Notities & intenties</span>
        </div>
        <div className="card-body">
          <textarea
            value={notes.year_intentions || ''}
            onChange={e => saveNote('year_intentions', e.target.value)}
            placeholder="Wat wil jij dit jaar bereiken? Noteer hier je intenties, dromen en ankerpunten…"
            style={{
              width: '100%', minHeight: 80, resize: 'vertical',
              fontSize: 13, lineHeight: 1.6, padding: '8px 10px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg)', color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>
    </div>
  );
}
