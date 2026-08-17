import React, { useState, useRef } from 'react';
import { computeHeadCoach } from './CoachAdvice';
import { USER, PERSONAL_EVENTS } from '../config';
import { RUNS } from '../data/runningSchema';

const NL_DAYS   = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const NL_MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus',
                   'september','oktober','november','december'];

function formatNL(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return { dayName: NL_DAYS[d.getDay()], day: d.getDate(), month: NL_MONTHS[d.getMonth()] };
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ── localStorage helpers ────────────────────────────────────────
const SEASON_KEY  = 'gc_focus_season';
const INBOX_KEY   = 'gc_inbox';
const DEFAULT_SEASON = { name: 'Strong · Lean · Structured' };

function getShutdownState(date) {
  try { return JSON.parse(localStorage.getItem(`gc_shutdown_${date}`) || '{}'); } catch { return {}; }
}
function saveShutdownState(date, s) {
  localStorage.setItem(`gc_shutdown_${date}`, JSON.stringify(s));
}

// ── Sub-components ──────────────────────────────────────────────

function ExpandSection({ label, children, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
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

const DAY_CAP = [
  { id: 'minimum', label: 'Minimum', emoji: '🪫' },
  { id: 'normaal',  label: 'Normaal',  emoji: '⚡' },
  { id: 'hoog',     label: 'Hoog',     emoji: '🚀' },
  { id: 'herstel',  label: 'Herstel',  emoji: '🛌' },
];
const ENERGIE_OPTS = ['Zwaar','Middel','Licht','Fysiek','Vrij'];
const ENERGIE_KEYS = ['energy_morning', 'energy_middag', 'energy_avond'];
const ENERGIE_SLOT_LABELS = ['Ochtend', 'Middag', 'Avond'];

const SHUTDOWN_STEPS = [
  'Alle openstaande zaken vastgelegd in de inbox',
  'Topprioriteit voor morgen gekozen',
  'Agenda gecheckt voor morgen',
  'Ideeën geparkeerd',
  'Werkapps gesloten en notificaties uit',
];

function CaptureInbox() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INBOX_KEY) || '[]'); } catch { return []; }
  });
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  function persist(updated) { localStorage.setItem(INBOX_KEY, JSON.stringify(updated)); setItems(updated); }
  function add() {
    const t = text.trim(); if (!t) return;
    persist([{ id: Date.now().toString(), text: t, date: todayStr(), status: 'open' }, ...items]);
    setText(''); inputRef.current?.focus();
  }
  function setStatus(id, status) { persist(items.map(i => i.id === id ? { ...i, status } : i)); }
  function remove(id)            { persist(items.filter(i => i.id !== id)); }

  const open = items.filter(i => i.status === 'open');
  const done = items.filter(i => i.status !== 'open');

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 10 }}>
        Capture now, decide later. Typ + Enter.
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          ref={inputRef} className="os-input" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Iets wat in je hoofd zit..."
        />
        <button className="os-btn-save" onClick={add} style={{ flexShrink: 0 }}>+ Zet</button>
      </div>
      {open.map(item => (
        <div key={item.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--divide)' }}>
          <div style={{ fontSize: 14, marginBottom: 6 }}>{item.text}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {['plannen','delegeer','park'].map(s => (
              <button key={s} className={`os-toggle-chip ${item.status === s ? 'active green' : ''}`}
                onClick={() => setStatus(item.id, s)} style={{ fontSize: 12 }}>
                {s}
              </button>
            ))}
            <button className="os-toggle-chip" onClick={() => setStatus(item.id, 'done')}
              style={{ fontSize: 12, color: 'var(--green)' }}>✓ klaar</button>
            <button className="os-toggle-chip" onClick={() => remove(item.id)}
              style={{ fontSize: 12 }}>🗑</button>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ghost)' }}>{done.length} verwerkt</div>
      )}
    </div>
  );
}

function ShutdownProtocol({ currentDate }) {
  const [state, setState] = useState(() => getShutdownState(currentDate));
  function toggle(i) {
    const upd = { ...state, [i]: !state[i] };
    saveShutdownState(currentDate, upd); setState(upd);
  }
  const allDone = SHUTDOWN_STEPS.every((_, i) => state[i]);
  return (
    <div>
      {allDone && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)',
          borderRadius: 10, padding: '10px 14px', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          Werk is klaar. Goed gedaan.
        </div>
      )}
      {SHUTDOWN_STEPS.map((step, i) => (
        <div key={i} className="os-check-item" onClick={() => toggle(i)}>
          <div className={`os-check-box ${state[i] ? 'checked' : ''}`}>{state[i] ? '✓' : ''}</div>
          <span style={{ fontSize: 14, color: state[i] ? 'var(--sub)' : 'var(--text)',
            textDecoration: state[i] ? 'line-through' : 'none' }}>
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Verdict mapping ─────────────────────────────────────────────
const VERDICT_MAP = {
  GREEN: {
    cls: 'v-green', label: 'Groen', sub: 'Klaar voor training',
    notToday: null,
  },
  AMBER: {
    cls: '',        label: 'Amber', sub: 'Voorzichtig vandaag',
    notToday: { title: 'Zone C training — niet nu', desc: 'Blijf in Zone B of lager. Herstel heeft voorrang over intensiteit.' },
  },
  BLUE: {
    cls: 'v-blue',  label: 'Blauw', sub: 'Hersteldag vandaag',
    notToday: { title: 'Intensieve training — niet nu', desc: 'Lichte beweging is oké. Geen prestatiegericht sporten vandaag.' },
  },
  RED: {
    cls: 'v-red',   label: 'Rood',  sub: 'Rust is de training vandaag',
    notToday: { title: 'Training — sla over vandaag', desc: 'Je lichaam vraagt om volledige rust. Morgen is er weer een kans.' },
  },
};

function getNextRun(logs) {
  const done = new Set(Object.values(logs || {}).filter(l => l.run_done && l.run_session).map(l => l.run_session));
  for (let n = 1; n <= RUNS.length; n++) if (!done.has(n)) return { nr: n, run: RUNS[n - 1] };
  return { nr: RUNS.length, run: RUNS[RUNS.length - 1] };
}

// ── Main component ──────────────────────────────────────────────
export default function VandaagScreen({ log, logs, currentDate, saveField, saveFields, shiftDay, isFuture }) {
  const season = (() => {
    try { return JSON.parse(localStorage.getItem(SEASON_KEY) || 'null') || DEFAULT_SEASON; }
    catch { return DEFAULT_SEASON; }
  })();

  const { dayName, day, month } = formatNL(currentDate);
  const isToday = currentDate === todayStr();
  const maxFuture = (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString().slice(0, 10); })();

  const coach = computeHeadCoach(log, logs, currentDate);
  const verdict = VERDICT_MAP[coach.decision] || VERDICT_MAP.AMBER;
  const { nr: nextRunNr, run: nextRun } = getNextRun(logs);
  const hasData = log && Object.keys(log).filter(k => k !== 'date').length > 1;

  return (
    <div className="os-content">

      {/* Date + navigation */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="os-eyebrow">{dayName}</div>
          <h1 className="os-date-heading" style={{ marginBottom: 0 }}>{day} {month}</h1>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="os-nav-arrow" onClick={() => shiftDay(-1)}>‹</button>
          {!isToday && (
            <button className="os-nav-arrow" style={{ width: 'auto', padding: '0 10px', fontSize: 11,
              color: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={() => shiftDay(0)}>vandaag</button>
          )}
          <button className="os-nav-arrow" onClick={() => shiftDay(1)} disabled={currentDate >= maxFuture}>›</button>
        </div>
      </div>

      {/* Season chip */}
      <div className="os-chip">
        <span className="os-chip-dot" />
        {season.name}
      </div>

      {/* Coach verdict */}
      {!isFuture ? (
        hasData ? (
          <div className={`os-card os-verdict ${verdict.cls}`}>
            <div className="os-v-status">{verdict.label} — {verdict.sub}</div>
            <div className="os-v-head">{coach.trainingDesc || 'Volg het schema van vandaag'}</div>
            <ul className="os-v-list">
              {(coach.why || []).slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        ) : (
          <div className="os-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nog geen data vandaag</div>
            <div style={{ fontSize: 14, color: 'var(--sub)', lineHeight: 1.5 }}>
              Vul je Lichaam-data in. Dan berekent de coach je advies.
            </div>
          </div>
        )
      ) : (
        <div className="os-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ fontSize: 14, color: 'var(--sub)' }}>Toekomstige dag — nog geen advies beschikbaar.</div>
        </div>
      )}

      {/* Wat doe je vandaag */}
      {!isFuture && nextRun && (
        <>
          <div className="os-section-label">Wat doe je vandaag</div>
          <div className="os-card">
            <div className="os-action">
              <div className="os-action-icon">🏃</div>
              <div>
                <div className="os-action-title">
                  {nextRun.title || `Training T${nextRunNr}/35`}
                </div>
                <div className="os-action-desc">
                  {nextRun.desc || nextRun.description || `Zone B · ${USER.hrZone.low}–${USER.hrZone.high} bpm`}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Wat doe je NIET */}
      {!isFuture && verdict.notToday && (
        <>
          <div className="os-section-label">Wat doe je niet vandaag</div>
          <div className="os-card">
            <div className="os-action">
              <div className="os-action-icon red" style={{ fontSize: 18 }}>✕</div>
              <div>
                <div className="os-action-title">{verdict.notToday.title}</div>
                <div className="os-action-desc">{verdict.notToday.desc}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Dag type + energie planning */}
      {!isFuture && (
        <ExpandSection label="Dag type &amp; energie planning">
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Type dag</div>
            <div className="os-scale-btns" style={{ marginBottom: 16 }}>
              {DAY_CAP.map(opt => (
                <button key={opt.id}
                  className={`os-scale-btn ${log?.day_capacity === opt.id ? 'active' : ''}`}
                  onClick={() => saveField('day_capacity', opt.id)}>
                  <div>{opt.emoji}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{opt.label}</div>
                </button>
              ))}
            </div>
            <div className="os-section-label">Energie per dagdeel</div>
            {ENERGIE_KEYS.map((key, i) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.6px',
                  textTransform: 'uppercase', marginBottom: 5 }}>
                  {ENERGIE_SLOT_LABELS[i]}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ENERGIE_OPTS.map(opt => (
                    <button key={opt}
                      className={`os-toggle-chip ${log?.[key] === opt.toLowerCase() ? 'active green' : ''}`}
                      onClick={() => saveField(key, opt.toLowerCase())}
                      style={{ fontSize: 12, padding: '5px 10px' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExpandSection>
      )}

      {/* Capture inbox */}
      <ExpandSection label="Capture — idee of taak toevoegen">
        <CaptureInbox />
      </ExpandSection>

      {/* Shutdown */}
      {!isFuture && (
        <ExpandSection label="Werk afsluiten — shutdown protocol">
          <ShutdownProtocol currentDate={currentDate} />
        </ExpandSection>
      )}
    </div>
  );
}
