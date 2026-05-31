import React, { useState } from 'react';

const GLOW_KEY = 'gc_glow_events';

const BODY_VITAL_ITEMS = [
  { id: 'wenkbrauwen_harsen', label: 'Wenkbrauwen harsen' },
  { id: 'wenkbrauwen_verven', label: 'Wenkbrauwen verven' },
  { id: 'kin',                label: 'Kin' },
  { id: 'bovenlip',           label: 'Bovenlip' },
];

const INTERVAL_OPTIONS = [
  { days: 14,  label: '2 weken' },
  { days: 21,  label: '3 weken' },
  { days: 28,  label: '4 weken' },
  { days: 42,  label: '6 weken' },
  { days: 56,  label: '8 weken' },
  { days: 84,  label: '12 weken' },
  { days: 182, label: '6 maanden' },
  { days: 365, label: '1 jaar' },
];

const GLOW_TYPES = [
  { id: 'kapper',         emoji: '✂️',  label: 'Kapper',           hasNotes: true,  notesLabel: 'Wat gedaan? (knippen, kleur...)' },
  { id: 'body_vital',     emoji: '🪒',  label: 'Body & Vital',     hasNotes: false, subItems: BODY_VITAL_ITEMS },
  { id: 'skinbooster',    emoji: '💉',  label: 'Skinbooster',      hasNotes: true,  notesLabel: 'Type / locatie' },
  { id: 'zonnebank',      emoji: '☀️',  label: 'Zonnebank',        hasNotes: true,  notesLabel: 'Minuten / stand' },
  { id: 'tandarts',       emoji: '🦷',  label: 'Tandarts',         hasNotes: true,  notesLabel: 'Behandeling?' },
  { id: 'mondhygieniste', emoji: '🪥',  label: 'Mondhygieniste',   hasNotes: false },
  { id: 'tandenbleker',   emoji: '✨',  label: 'Tandenbleker',     hasNotes: true,  notesLabel: 'Type / sessie?' },
];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadEvents() {
  try { return JSON.parse(localStorage.getItem(GLOW_KEY) || '[]'); } catch { return []; }
}
function saveEvents(arr) {
  localStorage.setItem(GLOW_KEY, JSON.stringify(arr));
}

const typeMap = Object.fromEntries(GLOW_TYPES.map(t => [t.id, t]));

export default function Glow({ log, saveField, currentDate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [events, setEvents]         = useState(loadEvents);
  const [addType, setAddType]       = useState(null);
  const [addDate, setAddDate]       = useState(currentDate);
  const [addNotes, setAddNotes]     = useState('');
  const [subSel, setSubSel]         = useState([]);      // selected body_vital sub-items
  const [planNext, setPlanNext]     = useState(false);
  const [nextDate, setNextDate]     = useState('');
  const [intervalDays, setIntervalDays] = useState(null);
  const [saved, setSaved]           = useState(false);

  function toggleSub(id) {
    setSubSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function selectType(id) {
    if (addType === id) { setAddType(null); return; }
    setAddType(id);
    setAddNotes('');
    setSubSel([]);
    setPlanNext(false);
    setNextDate('');
    setIntervalDays(null);
  }

  function applyInterval(days) {
    setIntervalDays(days);
    setNextDate(addDays(addDate, days));
  }

  function logEvent() {
    if (!addType) return;
    const ev = {
      id: Date.now(),
      type: addType,
      date: addDate,
      notes: addNotes.trim(),
      subItems: subSel.length ? subSel : undefined,
      nextDate: planNext && nextDate ? nextDate : undefined,
      intervalDays: planNext && intervalDays ? intervalDays : undefined,
    };
    const updated = [ev, ...events].sort((a, b) => b.date.localeCompare(a.date));
    saveEvents(updated);
    setEvents(updated);
    setAddType(null); setAddNotes(''); setSubSel([]);
    setPlanNext(false); setNextDate(''); setIntervalDays(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function removeEvent(id) {
    const updated = events.filter(e => e.id !== id);
    saveEvents(updated);
    setEvents(updated);
  }

  // Upcoming reminders: events with nextDate set
  const upcoming = events
    .filter(e => e.nextDate)
    .map(e => {
      const daysTo = Math.floor((new Date(e.nextDate) - new Date(today)) / 86400000);
      return { ...e, daysTo };
    })
    .sort((a, b) => a.daysTo - b.daysTo)
    .filter(e => e.daysTo <= 14); // show within 2 weeks or overdue

  // Last per category
  const statsByType = GLOW_TYPES.map(t => {
    const evs = events.filter(e => e.type === t.id);
    const last = evs[0];
    const daysSince = last ? Math.floor((new Date(today) - new Date(last.date)) / 86400000) : null;
    // Find the active nextDate (most recent event with nextDate for this type)
    const withNext = evs.find(e => e.nextDate);
    const daysToNext = withNext ? Math.floor((new Date(withNext.nextDate) - new Date(today)) / 86400000) : null;
    return { ...t, count: evs.length, last, daysSince, nextDate: withNext?.nextDate, daysToNext };
  }).filter(t => t.count > 0);

  const t = typeMap[addType];

  return (
    <div className="pane">

      {/* Reminders */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: '#EC4899' }} />
            <div className="card-title">🔔 Aankomende behandelingen</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(e => {
              const tp = typeMap[e.type];
              const overdue = e.daysTo < 0;
              const today_ = e.daysTo === 0;
              return (
                <div key={`r-${e.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: overdue ? 'var(--alert-l)' : today_ ? '#FDF2F8' : 'var(--bg)',
                  border: `1.5px solid ${overdue ? 'var(--alert)' : today_ ? '#EC4899' : 'var(--border)'}`,
                }}>
                  <span style={{ fontSize: 18 }}>{tp?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: overdue ? 'var(--alert)' : '#BE185D' }}>
                      {tp?.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Gepland: {e.nextDate}
                      {e.intervalDays && <span> · elke {INTERVAL_OPTIONS.find(o => o.days === e.intervalDays)?.label || `${e.intervalDays}d`}</span>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 99,
                    background: overdue ? 'var(--alert)' : today_ ? '#EC4899' : 'var(--border)',
                    color: overdue || today_ ? 'white' : 'var(--muted)',
                  }}>
                    {overdue ? `${Math.abs(e.daysTo)}d te laat` : today_ ? 'vandaag!' : `over ${e.daysTo}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dagelijks ritual */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#EC4899' }} />
          <div className="card-title">✨ Glow & verzorging</div>
        </div>
        <div className="card-body">
          <div className="scale-label">DAGELIJKS RITUAL</div>
          <div className="habit-grid" style={{ marginTop: 6 }}>
            {[
              { id: 'moisturizer',   emoji: '🧴', label: 'Ingesmeerd' },
              { id: 'spf',           emoji: '☀️', label: 'SPF gebruikt' },
              { id: 'glow_vitamins', emoji: '💊', label: 'Vitamines' },
              { id: 'glow_water',    emoji: '💧', label: 'Genoeg water' },
            ].map(h => (
              <div key={h.id}
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

      {/* Log een event */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#8B5CF6' }} />
          <div className="card-title">➕ Log een behandeling</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {GLOW_TYPES.map(tp => (
              <button key={tp.id} className="btn" style={{
                padding: '6px 10px', fontSize: 12,
                background: addType === tp.id ? '#8B5CF6' : 'var(--bg)',
                color: addType === tp.id ? 'white' : 'var(--text)',
                border: `1.5px solid ${addType === tp.id ? '#8B5CF6' : 'var(--border)'}`,
              }} onClick={() => selectType(tp.id)}>
                {tp.emoji} {tp.label}
              </button>
            ))}
          </div>

          {addType && (
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t?.emoji} {t?.label}</div>

              {/* Sub-items for body_vital */}
              {t?.subItems && (
                <div style={{ marginBottom: 10 }}>
                  <div className="scale-label" style={{ marginBottom: 6 }}>WAT IS GEDAAN?</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.subItems.map(s => (
                      <button key={s.id} className="btn" style={{
                        padding: '5px 10px', fontSize: 12,
                        background: subSel.includes(s.id) ? '#8B5CF6' : 'var(--bg)',
                        color: subSel.includes(s.id) ? 'white' : 'var(--text)',
                        border: `1.5px solid ${subSel.includes(s.id) ? '#8B5CF6' : 'var(--border)'}`,
                      }} onClick={() => toggleSub(s.id)}>
                        {subSel.includes(s.id) ? '✓ ' : ''}{s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Date */}
              <div className="input-row" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 50 }}>Datum</span>
                <input type="date" value={addDate} max={today}
                  onChange={e => { setAddDate(e.target.value); if (planNext && intervalDays) setNextDate(addDays(e.target.value, intervalDays)); }}
                  style={{ flex: 1, fontSize: 13 }} />
              </div>

              {/* Notes */}
              {t?.hasNotes && (
                <input type="text" placeholder={t.notesLabel || 'Notitie...'} value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, fontSize: 12 }} />
              )}

              {/* Plan next */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: planNext ? 10 : 0 }}>
                  <div
                    style={{
                      width: 36, height: 20, borderRadius: 99, cursor: 'pointer', transition: 'background 0.2s',
                      background: planNext ? '#8B5CF6' : 'var(--border)', position: 'relative', flexShrink: 0,
                    }}
                    onClick={() => setPlanNext(p => !p)}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: planNext ? 18 : 2, width: 16, height: 16,
                      borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>Volgende behandeling plannen</span>
                </div>

                {planNext && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="scale-label">HERHAALINTERVAL</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {INTERVAL_OPTIONS.map(o => (
                        <button key={o.days} className="btn" style={{
                          padding: '5px 9px', fontSize: 11,
                          background: intervalDays === o.days ? '#8B5CF6' : 'var(--bg)',
                          color: intervalDays === o.days ? 'white' : 'var(--text)',
                          border: `1.5px solid ${intervalDays === o.days ? '#8B5CF6' : 'var(--border)'}`,
                        }} onClick={() => applyInterval(o.days)}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <div className="input-row">
                      <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 50 }}>Of datum</span>
                      <input type="date" value={nextDate} min={today}
                        onChange={e => { setNextDate(e.target.value); setIntervalDays(null); }}
                        style={{ flex: 1, fontSize: 13 }} />
                    </div>
                    {nextDate && (
                      <div style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 600 }}>
                        📅 Reminder: {nextDate}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="btn btn-full" style={{ background: '#8B5CF6', color: 'white', fontWeight: 700, marginTop: 10 }}
                onClick={logEvent}>
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
            <div className="card-title">📊 Laatste keer</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {statsByType.map(tp => (
              <div key={tp.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16, marginTop: 1 }}>{tp.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{tp.label}</div>
                  {tp.last?.subItems?.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {tp.last.subItems.map(id => BODY_VITAL_ITEMS.find(s => s.id === id)?.label).filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {tp.last?.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{tp.last.notes}</div>}
                  {tp.nextDate && (
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                      <span style={{
                        color: tp.daysToNext != null && tp.daysToNext < 0 ? 'var(--alert)' : tp.daysToNext != null && tp.daysToNext <= 7 ? '#D97706' : '#8B5CF6',
                        fontWeight: 600,
                      }}>
                        📅 Volgende: {tp.nextDate}
                        {tp.daysToNext != null && (
                          tp.daysToNext < 0 ? ` (${Math.abs(tp.daysToNext)}d te laat)` :
                          tp.daysToNext === 0 ? ' (vandaag!)' :
                          ` (over ${tp.daysToNext}d)`
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {tp.last.date === today ? 'vandaag' : tp.daysSince === 1 ? 'gisteren' : `${tp.daysSince}d geleden`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geschiedenis */}
      {events.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: '#6B7280' }} />
            <div className="card-title">📅 Geschiedenis</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {events.slice(0, 25).map(e => {
              const tp = typeMap[e.type];
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 15, marginTop: 1 }}>{tp?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{tp?.label}</div>
                    {e.subItems?.length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {e.subItems.map(id => BODY_VITAL_ITEMS.find(s => s.id === id)?.label).filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {e.notes && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.notes}</div>}
                    {e.nextDate && <div style={{ fontSize: 10, color: '#8B5CF6' }}>📅 Volgende: {e.nextDate}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{e.date}</div>
                  <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 2px', fontSize: 14 }}
                    onClick={() => removeEvent(e.id)}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>
            Log je eerste behandeling hierboven ↑<br />
            <span style={{ fontSize: 10 }}>kapper, body &amp; vital, skinbooster, tandarts...</span>
          </div>
        </div>
      )}
    </div>
  );
}
