import React, { useState } from 'react';

const GLOW_KEY = 'gc_glow_events';

const GLOW_TYPES = [
  { id: 'kapper',         emoji: '✂️',  label: 'Kapper',           hasNotes: true,  notesLabel: 'Wat gedaan? (bijv. knippen + kl...) ' },
  { id: 'skinbooster',    emoji: '💉',  label: 'Skinbooster',      hasNotes: true,  notesLabel: 'Type / locatie' },
  { id: 'wenkbrauwen',    emoji: '🪒',  label: 'Wenkbrauwen harsen', hasNotes: false },
  { id: 'kin_harsen',     emoji: '🪒',  label: 'Kin harsen',       hasNotes: false },
  { id: 'zonnebank',      emoji: '☀️',  label: 'Zonnebank',        hasNotes: true,  notesLabel: 'Minuten / stand' },
  { id: 'tandarts',       emoji: '🦷',  label: 'Tandarts',         hasNotes: true,  notesLabel: 'Behandeling?' },
  { id: 'mondhygieniste', emoji: '🪥',  label: 'Mondhygieniste',   hasNotes: false },
  { id: 'tandenbleker',   emoji: '✨',  label: 'Tandenbleker',     hasNotes: true,  notesLabel: 'Type / sessie?' },
];

function loadEvents() {
  try { return JSON.parse(localStorage.getItem(GLOW_KEY) || '[]'); } catch { return []; }
}

function saveEvents(arr) {
  localStorage.setItem(GLOW_KEY, JSON.stringify(arr));
}

export default function Glow({ log, saveField, currentDate }) {
  const [events, setEvents] = useState(loadEvents);
  const [addType, setAddType] = useState(null);
  const [addDate, setAddDate] = useState(currentDate);
  const [addNotes, setAddNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  function logEvent() {
    if (!addType) return;
    const ev = { id: Date.now(), type: addType, date: addDate, notes: addNotes.trim() };
    const updated = [ev, ...events].sort((a, b) => b.date.localeCompare(a.date));
    saveEvents(updated);
    setEvents(updated);
    setAddType(null);
    setAddNotes('');
    setAddDate(currentDate);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function removeEvent(id) {
    const updated = events.filter(e => e.id !== id);
    saveEvents(updated);
    setEvents(updated);
  }

  const typeMap = Object.fromEntries(GLOW_TYPES.map(t => [t.id, t]));

  // Group by category for stats
  const statsByType = GLOW_TYPES.map(t => {
    const evs = events.filter(e => e.type === t.id);
    const last = evs[0];
    const daysSince = last ? Math.floor((new Date(today) - new Date(last.date)) / 86400000) : null;
    return { ...t, count: evs.length, last, daysSince };
  }).filter(t => t.count > 0);

  return (
    <div className="pane">

      {/* Dagelijkse huidverzorging */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#EC4899' }} />
          <div className="card-title">✨ Glow & verzorging</div>
        </div>
        <div className="card-body">
          <div className="scale-label">DAGELIJKS RITUAL</div>
          <div className="habit-grid" style={{ marginTop: 6 }}>
            {[
              { id: 'moisturizer',    emoji: '🧴', label: 'Ingesmeerd' },
              { id: 'spf',            emoji: '☀️', label: 'SPF gebruikt' },
              { id: 'glow_vitamins',  emoji: '💊', label: 'Vitamines' },
              { id: 'glow_water',     emoji: '💧', label: 'Genoeg water' },
            ].map(h => (
              <div
                key={h.id}
                className={`habit-btn ${log?.[h.id] ? 'on' : ''}`}
                style={log?.[h.id] ? { background: '#FDF2F8', borderColor: '#EC4899', color: '#BE185D' } : {}}
                onClick={() => saveField(h.id, log?.[h.id] ? 0 : 1)}
              >
                <div className="habit-emoji">{h.emoji}</div>
                <div className="habit-label">{h.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Log een glow-event */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#8B5CF6' }} />
          <div className="card-title">➕ Log een glow-event</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {GLOW_TYPES.map(t => (
              <button
                key={t.id}
                className="btn"
                style={{
                  padding: '6px 10px', fontSize: 12,
                  background: addType === t.id ? '#8B5CF6' : 'var(--bg)',
                  color: addType === t.id ? 'white' : 'var(--text)',
                  border: `1.5px solid ${addType === t.id ? '#8B5CF6' : 'var(--border)'}`,
                }}
                onClick={() => setAddType(addType === t.id ? null : t.id)}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {addType && (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                {typeMap[addType]?.emoji} {typeMap[addType]?.label}
              </div>
              <div className="input-row" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 36 }}>Datum</span>
                <input
                  type="date"
                  value={addDate}
                  max={today}
                  onChange={e => setAddDate(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }}
                />
              </div>
              {typeMap[addType]?.hasNotes && (
                <input
                  type="text"
                  placeholder={typeMap[addType]?.notesLabel || 'Notitie...'}
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontSize: 12 }}
                />
              )}
              <button
                className="btn btn-full"
                style={{ background: '#8B5CF6', color: 'white', fontWeight: 700 }}
                onClick={logEvent}
              >
                ✓ Opslaan
              </button>
            </div>
          )}
          {saved && <div className="saved-note">✓ Opgeslagen!</div>}
        </div>
      </div>

      {/* Overzicht per categorie */}
      {statsByType.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: '#EC4899' }} />
            <div className="card-title">📊 Laatste keer per categorie</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {statsByType.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                  {t.last?.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.last.notes}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {t.last.date === today ? 'vandaag' :
                     t.daysSince === 1 ? 'gisteren' :
                     `${t.daysSince} dagen geleden`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.last.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volledige geschiedenis */}
      {events.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: '#6B7280' }} />
            <div className="card-title">📅 Geschiedenis</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {events.slice(0, 20).map(e => {
              const t = typeMap[e.type];
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>{t?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t?.label}</div>
                    {e.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.notes}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.date}</div>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px', fontSize: 14 }}
                    onClick={() => removeEvent(e.id)}
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {events.length === 0 && statsByType.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
            Log je eerste glow-event hierboven ↑<br />
            <span style={{ fontSize: 10 }}>kapper, skinbooster, harsen, tandarts...</span>
          </div>
        </div>
      )}
    </div>
  );
}
