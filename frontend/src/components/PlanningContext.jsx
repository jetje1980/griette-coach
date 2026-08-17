import React, { useState, useEffect } from 'react';

const FALLBACK = {
  updated: '2026-08-17',
  source: 'Trello + Google Agenda',
  soon: [
    { date: '2026-08-21', text: 'Mounjaro herstart (2,5 mg)', type: 'goal' },
    { date: '2026-08-21', text: 'Ameland gezinsvakantie (t/m 28 aug)', type: 'race' },
    { date: '2026-09-02', text: '22 jaar getrouwd 💍', type: 'goal' },
    { date: '2026-09-19', text: 'Spathoek betaling deadline', type: 'deadline' },
    { text: 'Tikkie vragen voor Terschelling', type: 'todo' },
    { text: '400 euro opname Peaks regelen', type: 'todo' },
    { text: 'Skinbooster + kapper betalen', type: 'todo' },
    { text: 'Kelder/schuur/kasten opruimen — vaste plekken', type: 'todo' },
  ],
  october: [
    { date: '2026-10-03', text: 'Trail 10 km 🏔️ — zone B vasthouden', type: 'race' },
    { date: '2026-10-30', text: 'Bereloop Terschelling 10 km 🏃', type: 'race' },
    { text: '55 kg wegen — tussencheck', type: 'goal' },
    { text: 'Reformer pilates starten', type: 'goal' },
    { text: 'Opleiding afzeggen (actie)', type: 'todo' },
  ],
  events_2027: [
    { date: '2026-12-13', text: 'Ameland run 5 km 🏝️', type: 'race' },
    { date: '2027-06-11', text: 'Oerol festival Terschelling 🎭 (t/m 14 jun)', type: 'goal' },
  ],
  goals_2026: [
    '57 kilo en sportief levensritme',
    'Financieel buffer 3 maanden',
    'Eigen plek en meer alleentijd',
    'Leven vanuit rust en autonomie',
    'Georganiseerd — alles vaste plekken',
  ],
  coach_note: 'Mounjaro herstart 21 aug — maag rustig opbouwen. Ameland: bewegen zonder prestatiedruk. Trail 10km op 3 okt is eerste echte race. Financieel: Spathoek vóór 19 sept betalen. Werk-situatie verdient aandacht: VSO en arbeidsrecht open.',
};

const TYPE_COLOR = {
  deadline: '#C4622D',
  race: '#2A7A4F',
  goal: '#1A6E8E',
  todo: 'var(--muted)',
};
const TYPE_ICON = {
  deadline: '⏰',
  race: '🏁',
  goal: '🎯',
  todo: '□',
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

export default function PlanningContext() {
  const [ctx, setCtx] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gc_planning_context');
      if (raw) setCtx(JSON.parse(raw));
      else setCtx(FALLBACK);
    } catch { setCtx(FALLBACK); }
  }, []);

  if (!ctx) return null;

  return (
    <div style={{
      margin: '0 0 8px',
      borderRadius: 10,
      background: 'var(--card)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'none', border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>🗂️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Leven context</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            Bron: {ctx.source} · bijgewerkt {ctx.updated}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Coach note */}
          {ctx.coach_note && (
            <div style={{
              fontSize: 11.5, lineHeight: 1.55, color: 'var(--text)',
              background: 'var(--bg)', borderRadius: 8, padding: '8px 10px',
              borderLeft: '3px solid var(--sage)',
            }}>
              {ctx.coach_note}
            </div>
          )}

          {/* Soon */}
          {ctx.soon?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Aug / Sept acties
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ctx.soon.map((item, i) => {
                  const days = daysUntil(item.date);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                      <span style={{ fontSize: 13, color: TYPE_COLOR[item.type] || 'var(--muted)', flexShrink: 0 }}>
                        {TYPE_ICON[item.type]}
                      </span>
                      <span style={{ flex: 1, color: 'var(--text)', lineHeight: 1.4 }}>{item.text}</span>
                      {days !== null && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                          color: days < 7 ? '#C4622D' : days < 21 ? '#B5831A' : 'var(--muted)',
                          background: 'var(--bg)', padding: '1px 6px', borderRadius: 10,
                        }}>
                          {days < 0 ? 'verlopen' : `${days}d`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* October */}
          {ctx.october?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Okt / Nov
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ctx.october.map((item, i) => {
                  const days = daysUntil(item.date);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                      <span style={{ fontSize: 13, color: TYPE_COLOR[item.type] || 'var(--muted)', flexShrink: 0 }}>
                        {TYPE_ICON[item.type]}
                      </span>
                      <span style={{ flex: 1, color: 'var(--text)', lineHeight: 1.4 }}>{item.text}</span>
                      {days !== null && days >= 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: days < 14 ? '#C4622D' : 'var(--muted)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 10 }}>
                          {days}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events 2027 */}
          {ctx.events_2027?.length > 0 && (
            <details style={{ fontSize: 11.5 }}>
              <summary style={{ fontWeight: 700, color: 'var(--muted)', cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Dec 2026 / 2027
              </summary>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ctx.events_2027.map((item, i) => {
                  const days = daysUntil(item.date);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                      <span style={{ fontSize: 13, color: TYPE_COLOR[item.type] || 'var(--muted)', flexShrink: 0 }}>
                        {TYPE_ICON[item.type]}
                      </span>
                      <span style={{ flex: 1, color: 'var(--text)', lineHeight: 1.4 }}>{item.text}</span>
                      {days !== null && days >= 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: 'var(--muted)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 10 }}>
                          {days}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Goals 2026 collapsed */}
          <details style={{ fontSize: 11.5 }}>
            <summary style={{ fontWeight: 700, color: 'var(--sage)', cursor: 'pointer', fontSize: 11, letterSpacing: 0.3 }}>
              🎯 Doelen 2026 ({ctx.goals_2026?.length})
            </summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ctx.goals_2026?.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, color: 'var(--text)', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--sage)', flexShrink: 0 }}>✓</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          </details>

          <div style={{ fontSize: 10, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            Zeg "vernieuw mijn planning context" in de chat om dit bij te werken vanuit Trello en agenda.
          </div>
        </div>
      )}
    </div>
  );
}
