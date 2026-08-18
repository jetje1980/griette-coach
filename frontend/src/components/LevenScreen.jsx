import React, { useState, useEffect, useRef } from 'react';
import SubTabs from './SubTabs';
import { dreamStore, fileToDreamImage } from '../dreamStore';
import CaptureCenter from './CaptureCenter';
import GoalSettings from './GoalSettings';

// Leven = levensorganisatie en Future Self. Taken bundelt Capture en
// projecten zodat er geen concurrerende taakmodules meer zijn.
const SUBTABS = ['Taken', 'Focus', 'Routines', 'Geld', 'Toekomst', 'Glow', 'Eten'];

// ═══════════════════════════════════════════════════════════════
// FOCUS SEASONS — twee expliciet gescheiden modellen
// ═══════════════════════════════════════════════════════════════
// gc_executive_focus  : de huidige werkperiode (één seizoen, drie velden)
// gc_future_focus_seasons : per levensdomein een stand (PRIMARY/MAINTAIN/NOT_NOW)
// Ze delen bewust GEEN storage en overschrijven elkaar nooit.
const EXEC_FOCUS_KEY   = 'gc_executive_focus';
const FUTURE_FOCUS_KEY = 'gc_future_focus_seasons';
const LEGACY_SEASON_KEY = 'gc_focus_season';   // alleen gelezen, nooit overschreven

export const FOCUS_STATES = [
  { id: 'PRIMARY',  label: 'Primary',  emoji: '🔺', desc: 'Hier gaat energie heen' },
  { id: 'MAINTAIN', label: 'Maintain', emoji: '➖', desc: 'Op peil houden, niet uitbouwen' },
  { id: 'NOT_NOW',  label: 'Not now',  emoji: '💤', desc: 'Bewust even niet' },
];

const FOCUS_DOMAINS = [
  { id: 'BODY',    emoji: '💪', label: 'Body' },
  { id: 'RUN',     emoji: '🏃', label: 'Run' },
  { id: 'WORK',    emoji: '💼', label: 'Work' },
  { id: 'MONEY',   emoji: '💰', label: 'Money' },
  { id: 'FREEDOM', emoji: '🌊', label: 'Freedom' },
  { id: 'GLOW',    emoji: '✨', label: 'Glow' },
];

export function loadExecutiveFocus() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXEC_FOCUS_KEY) || 'null');
    if (saved) return saved;
    // Eenmalige, niet-destructieve overname van de oude seizoensnaam
    const legacy = JSON.parse(localStorage.getItem(LEGACY_SEASON_KEY) || 'null');
    return { seasonName: legacy?.name || '', primaryFocus: '', maintainFocus: '', notNowFocus: '' };
  } catch { return { seasonName: '', primaryFocus: '', maintainFocus: '', notNowFocus: '' }; }
}
function saveExecutiveFocus(obj) { localStorage.setItem(EXEC_FOCUS_KEY, JSON.stringify(obj)); }

function loadFutureFocus() {
  try { return JSON.parse(localStorage.getItem(FUTURE_FOCUS_KEY) || '{}'); } catch { return {}; }
}
function saveFutureFocus(obj) { localStorage.setItem(FUTURE_FOCUS_KEY, JSON.stringify(obj)); }

function TabFocus({ logs }) {
  const [view, setView] = useState('focus');
  const [exec, setExec] = useState(loadExecutiveFocus);
  const [domains, setDomains] = useState(loadFutureFocus);

  function updExec(key, val) {
    const next = { ...exec, [key]: val };
    saveExecutiveFocus(next); setExec(next);
  }
  function setDomain(id, state) {
    const next = { ...domains, [id]: domains[id] === state ? null : state };
    saveFutureFocus(next); setDomains(next);
  }

  const EXEC_FIELDS = [
    { key: 'primaryFocus',  label: 'Primary — waar energie heen gaat', ph: 'Bijv. hardloopopbouw afmaken' },
    { key: 'maintainFocus', label: 'Maintain — op peil houden',        ph: 'Bijv. krachttraining 2× per week' },
    { key: 'notNowFocus',   label: 'Not now — bewust even niet',        ph: 'Bijv. nieuwe projecten aannemen' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ id: 'focus', label: '🎯 Focus' }, { id: 'goals', label: '📐 Doelen' }].map(v => (
          <button key={v.id} className={`os-scale-btn ${view === v.id ? 'active' : ''}`}
            onClick={() => setView(v.id)} style={{ flex: 1, padding: '9px 4px', fontSize: 12 }}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'goals' && <GoalSettings logs={logs} />}

      {view === 'focus' && (<>
      <div className="os-section-label" style={{ marginTop: 0 }}>Huidig seizoen</div>
      <div className="os-card">
        <input className="os-input" value={exec.seasonName || ''}
          onChange={e => updExec('seasonName', e.target.value)}
          placeholder="Naam van dit seizoen…" style={{ marginBottom: 12 }} />
        {EXEC_FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.4px', fontWeight: 700, marginBottom: 3 }}>{f.label}</div>
            <input className="os-input" value={exec[f.key] || ''}
              onChange={e => updExec(f.key, e.target.value)} placeholder={f.ph} />
          </div>
        ))}
      </div>

      <div className="os-section-label">Levensdomeinen dit seizoen</div>
      <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
        Niet alles kan tegelijk primary. Dit staat los van je seizoensnaam hierboven.
      </div>
      {FOCUS_DOMAINS.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', borderBottom: '1px solid var(--divide)' }}>
          <span style={{ fontSize: 16, minWidth: 24 }}>{d.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 62 }}>{d.label}</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FOCUS_STATES.map(s => (
              <button key={s.id}
                className={`os-toggle-chip ${domains[d.id] === s.id ? 'active green' : ''}`}
                onClick={() => setDomain(d.id, s.id)}
                style={{ fontSize: 11 }}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 10, lineHeight: 1.5 }}>
        {FOCUS_STATES.map(s => `${s.emoji} ${s.label}: ${s.desc}`).join(' · ')}
      </div>
      </>)}
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
// TAB: GLOW
// ═══════════════════════════════════════════════════════════════
const GLOW_KEY = 'gc_glow_events';

const INTERVAL_OPTIONS = [
  { days: 7, label: '1 week' }, { days: 14, label: '2 weken' },
  { days: 21, label: '3 weken' }, { days: 28, label: '4 weken' },
  { days: 42, label: '6 weken' }, { days: 56, label: '8 weken' },
  { days: 84, label: '12 weken' }, { days: 182, label: '6 maanden' },
];

const BODY_VITAL_ITEMS = [
  { id: 'wenkbrauwen_harsen', label: 'Wenkbrauwen harsen' },
  { id: 'wenkbrauwen_verven', label: 'Wenkbrauwen verven' },
  { id: 'kin',   label: 'Kin' },
  { id: 'bovenlip', label: 'Bovenlip' },
];
const BOTOX_ZONES = [
  { id: 'voorhoofd', label: 'Voorhoofd' },
  { id: 'glabella',  label: 'Glabella (fronsrimpel)' },
  { id: 'kraaienpoot', label: 'Kraaienpootjes' },
  { id: 'kin_botox', label: 'Kin/jaw' },
];
const LPG_ZONES = [
  { id: 'buik', label: 'Buik' }, { id: 'flanken', label: 'Flanken/taille' },
  { id: 'benen', label: 'Benen/dijen' }, { id: 'billen', label: 'Billen' },
  { id: 'armen', label: 'Armen' }, { id: 'rug', label: 'Rug' },
  { id: 'decollete', label: 'Décolleté' }, { id: 'gezicht_hals', label: 'Gezicht/hals' },
];

const GLOW_TYPES = [
  { id: 'lpg',           emoji: '💪', label: 'LPG',           subItems: LPG_ZONES,   hasDuration: true, notesLabel: 'Bijzonderheden?' },
  { id: 'kapper',        emoji: '✂️', label: 'Kapper',        notesLabel: 'Wat gedaan?' },
  { id: 'botox',         emoji: '✨', label: 'Botox',         subItems: BOTOX_ZONES, defaultInterval: 182, notesLabel: 'Bijzonderheden / units?' },
  { id: 'microneedling', emoji: '🪡', label: 'Microneedling', defaultInterval: 28, notesLabel: 'Diepte / zone?' },
  { id: 'body_vital',    emoji: '🪒', label: 'Body & Vital',  subItems: BODY_VITAL_ITEMS },
  { id: 'skinbooster',   emoji: '💉', label: 'Skinbooster',   notesLabel: 'Type / locatie' },
  { id: 'gezichtsbeh',   emoji: '💆', label: 'Gezichtsbehandeling', notesLabel: 'Behandeling / salon?' },
  { id: 'zonnebank',     emoji: '☀️', label: 'Zonnebank',     notesLabel: 'Minuten / stand' },
  { id: 'tandarts',      emoji: '🦷', label: 'Tandarts',      notesLabel: 'Behandeling?' },
  { id: 'mondhygieniste',emoji: '🪥', label: 'Mondhygieniste' },
];

function glowAddDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function loadGlowEvents() {
  try {
    const raw = localStorage.getItem(GLOW_KEY);
    if (raw) return JSON.parse(raw);
    const seed = [{ id: 1, type: 'botox', date: '2025-11-25', notes: '1e keer', subItems: [], nextDate: '2026-05-25', intervalDays: 182 }];
    localStorage.setItem(GLOW_KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
}
function saveGlowEvents(arr) { localStorage.setItem(GLOW_KEY, JSON.stringify(arr)); }

function TabGlow() {
  const today = new Date().toISOString().slice(0, 10);
  const [events, setEvents] = useState(loadGlowEvents);
  const [adding, setAdding] = useState(null);
  const [form, setForm] = useState({});

  function persist(arr) { saveGlowEvents(arr); setEvents(arr); }

  const upcoming = events
    .filter(e => e.nextDate)
    .sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''))
    .slice(0, 6);

  function startAdd(typeId) {
    const tp = GLOW_TYPES.find(t => t.id === typeId);
    setAdding(typeId);
    setForm({
      type: typeId, date: today, notes: '',
      subItems: [],
      intervalDays: tp?.defaultInterval || 28,
      editingId: null,
    });
  }

  function startEdit(ev) {
    setAdding(ev.type);
    setForm({
      type: ev.type, date: ev.date, notes: ev.notes || '',
      subItems: ev.subItems || [],
      intervalDays: ev.intervalDays || 28,
      editingId: ev.id,
    });
  }

  function saveAdd() {
    const tp = GLOW_TYPES.find(t => t.id === form.type);
    const event = {
      id: form.editingId || Date.now(),
      type: form.type,
      date: form.date,
      notes: form.notes,
      subItems: form.subItems || [],
      intervalDays: form.intervalDays || 28,
      nextDate: glowAddDays(form.date, form.intervalDays || 28),
      label: tp?.label,
    };
    const rest = events.filter(e => e.id !== event.id);
    persist([event, ...rest].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    setAdding(null);
  }

  function removeEvent(id) {
    if (!window.confirm('Deze behandeling verwijderen?')) return;
    persist(events.filter(e => e.id !== id));
  }

  function daysUntil(dateStr) {
    const diff = Math.ceil((new Date(dateStr) - new Date(today)) / 86400000);
    if (diff === 0) return 'Vandaag';
    if (diff < 0)  return `${Math.abs(diff)}d geleden`;
    if (diff === 1) return 'Morgen';
    return `${diff}d`;
  }

  const tp = GLOW_TYPES.find(t => t.id === adding);

  return (
    <div>
      {upcoming.length > 0 && (
        <>
          <div className="os-section-label" style={{ marginTop: 0 }}>Aankomend</div>
          <div className="os-card">
            {upcoming.map(e => {
              const gType = GLOW_TYPES.find(t => t.id === e.type);
              const due = daysUntil(e.nextDate);
              const overdue = new Date(e.nextDate) < new Date(today);
              return (
                <div key={e.id} className="os-detail-row">
                  <span className="os-dk">{gType?.emoji || '●'} {gType?.label || e.type}</span>
                  <span className="os-dv" style={{ color: overdue ? 'var(--rust)' : 'var(--text)' }}>
                    {due}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {adding && tp && (
        <>
          <div className="os-section-label">{tp.emoji} {tp.label} vastleggen</div>
          <div className="os-card">
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
                letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Datum</label>
              <input type="date" className="os-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            {tp.subItems && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Zones</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {tp.subItems.map(si => (
                    <button key={si.id}
                      className={`os-toggle-chip ${(form.subItems || []).includes(si.id) ? 'active green' : ''}`}
                      onClick={() => {
                        const cur = form.subItems || [];
                        setForm(f => ({ ...f, subItems: cur.includes(si.id) ? cur.filter(x => x !== si.id) : [...cur, si.id] }));
                      }}
                      style={{ fontSize: 12 }}>
                      {si.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tp.notesLabel && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>{tp.notesLabel}</label>
                <input className="os-input" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optioneel…" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
                letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Volgende over</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {INTERVAL_OPTIONS.map(opt => (
                  <button key={opt.days}
                    className={`os-toggle-chip ${form.intervalDays === opt.days ? 'active green' : ''}`}
                    onClick={() => setForm(f => ({ ...f, intervalDays: opt.days }))}
                    style={{ fontSize: 12 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="os-btn-save" onClick={saveAdd}>Opslaan</button>
              <button className="os-toggle-chip" onClick={() => setAdding(null)} style={{ fontSize: 13 }}>Annuleer</button>
            </div>
          </div>
        </>
      )}

      <div className="os-section-label">Behandeling vastleggen</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {GLOW_TYPES.map(tp => (
          <button key={tp.id}
            onClick={() => startAdd(tp.id)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '12px 10px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{tp.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tp.label}</div>
          </button>
        ))}
      </div>

      {events.length > 0 && (
        <ExpandSection label={`Geschiedenis (${events.length}) — bewerken kan`}>
          <div>
            {events.slice(0, 30).map(e => {
              const gType = GLOW_TYPES.find(t => t.id === e.type);
              return (
                <div key={e.id} className="os-detail-row">
                  <span className="os-dk">{gType?.emoji} {gType?.label || e.type}
                    {e.notes ? <span style={{ color: 'var(--ghost)', fontSize: 11 }}> — {e.notes.slice(0, 24)}</span> : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="os-dv">{e.date}</span>
                    <button onClick={() => startEdit(e)}
                      style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
                    <button onClick={() => removeEvent(e.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
                  </span>
                </div>
              );
            })}
          </div>
        </ExpandSection>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: PROJECTEN
// ═══════════════════════════════════════════════════════════════
const PROJECTS_KEY = 'gc_projecten';
const PROJECT_STATUS = [
  { id: 'actief',   label: 'Actief',   color: 'var(--sage)' },
  { id: 'wacht',    label: 'Wacht op', color: 'var(--gold)' },
  { id: 'park',     label: 'Geparkeerd', color: 'var(--sub)' },
  { id: 'klaar',    label: 'Klaar',    color: 'var(--green)' },
];

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]'); } catch { return []; }
}
function saveProjects(arr) { localStorage.setItem(PROJECTS_KEY, JSON.stringify(arr)); }

// WIP-limiet: max aantal actieve projecten (configureerbaar, standaard 3)
const WIP_LIMIT_KEY = 'gc_wip_limit';
export function getWipLimit() {
  const v = parseInt(localStorage.getItem(WIP_LIMIT_KEY), 10);
  return Number.isFinite(v) && v >= 1 ? v : 3;
}

function TabProjecten() {
  const [projects, setProjects] = useState(loadProjects);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', outcome: '', status: 'actief', nextAction: '' });
  const [wipLimit, setWipLimit] = useState(getWipLimit);
  const [wipMsg, setWipMsg] = useState('');

  function persist(arr) { saveProjects(arr); setProjects(arr); }

  function activeCount(excludeId = null) {
    return projects.filter(p => p.status === 'actief' && p.id !== excludeId).length;
  }

  function blockByWip() {
    setWipMsg(`Je hebt je actieve limiet (${wipLimit}) bereikt. Parkeer of rond eerst iets af.`);
    setTimeout(() => setWipMsg(''), 4000);
  }

  function add() {
    if (!form.name.trim()) return;
    if (form.status === 'actief' && activeCount() >= wipLimit) { blockByWip(); return; }
    persist([{ id: Date.now().toString(), ...form, createdAt: new Date().toISOString().slice(0, 10) }, ...projects]);
    setForm({ name: '', outcome: '', status: 'actief', nextAction: '' });
    setAdding(false);
  }

  function updateStatus(id, status) {
    if (status === 'actief' && activeCount(id) >= wipLimit) { blockByWip(); return; }
    persist(projects.map(p => p.id === id ? { ...p, status } : p));
  }

  function updateProject(id, patch) {
    persist(projects.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  function removeProject(id) {
    if (!window.confirm('Dit project verwijderen?')) return;
    persist(projects.filter(p => p.id !== id));
  }

  function changeWipLimit(v) {
    const n = Math.max(1, Math.min(9, parseInt(v, 10) || 3));
    localStorage.setItem(WIP_LIMIT_KEY, String(n));
    setWipLimit(n);
  }

  const active   = projects.filter(p => p.status === 'actief');
  const waiting  = projects.filter(p => p.status === 'wacht');
  const parked   = projects.filter(p => p.status === 'park');
  const done     = projects.filter(p => p.status === 'klaar');

  return (
    <div>
      {wipMsg && (
        <div style={{ background: 'rgba(179,94,69,0.08)', border: '1px solid var(--rust)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13,
          color: 'var(--rust)', fontWeight: 600, lineHeight: 1.4 }}>
          ⚠️ {wipMsg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--sub)' }}>
          WIP-limiet: <span style={{ fontWeight: 700, color: active.length >= wipLimit ? 'var(--rust)' : 'var(--text)' }}>
            {active.length}/{wipLimit} actief
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="os-toggle-chip" style={{ fontSize: 12, width: 28, padding: '4px 0', textAlign: 'center' }}
            onClick={() => changeWipLimit(wipLimit - 1)}>−</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{wipLimit}</span>
          <button className="os-toggle-chip" style={{ fontSize: 12, width: 28, padding: '4px 0', textAlign: 'center' }}
            onClick={() => changeWipLimit(wipLimit + 1)}>+</button>
        </div>
      </div>

      {!adding && (
        <button className="os-btn-save" style={{ marginBottom: 16, width: '100%' }}
          onClick={() => setAdding(true)}>
          + Nieuw project
        </button>
      )}

      {adding && (
        <div className="os-card" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Projectnaam</label>
            <input className="os-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Bijv. Website herschrijven…" autoFocus />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Gewenst resultaat</label>
            <input className="os-input" value={form.outcome}
              onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
              placeholder="Als het klaar is, dan…" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Eerstvolgende actie</label>
            <input className="os-input" value={form.nextAction}
              onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))}
              placeholder="De kleinste volgende stap…" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="os-btn-save" onClick={add}>Toevoegen</button>
            <button className="os-toggle-chip" onClick={() => setAdding(false)} style={{ fontSize: 13 }}>Annuleer</button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="os-section-label" style={{ marginTop: 0 }}>Actief ({active.length})</div>
          {active.map(p => <ProjectCard key={p.id} project={p} updateStatus={updateStatus} updateProject={updateProject} removeProject={removeProject} />)}
        </>
      )}
      {waiting.length > 0 && (
        <>
          <div className="os-section-label">Wacht op…</div>
          {waiting.map(p => <ProjectCard key={p.id} project={p} updateStatus={updateStatus} updateProject={updateProject} removeProject={removeProject} />)}
        </>
      )}
      {parked.length > 0 && (
        <ExpandSection label={`Geparkeerd (${parked.length})`}>
          {parked.map(p => <ProjectCard key={p.id} project={p} updateStatus={updateStatus} updateProject={updateProject} removeProject={removeProject} />)}
        </ExpandSection>
      )}
      {done.length > 0 && (
        <ExpandSection label={`Afgerond (${done.length})`}>
          {done.map(p => <ProjectCard key={p.id} project={p} updateStatus={updateStatus} updateProject={updateProject} removeProject={removeProject} />)}
        </ExpandSection>
      )}
      {projects.length === 0 && !adding && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--sub)', fontSize: 13 }}>
          Nog geen projecten.<br />
          <span style={{ fontSize: 11, color: 'var(--ghost)' }}>
            Alles wat meer dan één stap nodig heeft, is een project.
          </span>
        </div>
      )}
    </div>
  );
}

// Module-level zodat de kaart niet remount (en dichtklapt) bij elke wijziging
function ProjectCard({ project, updateStatus, updateProject, removeProject }) {
  const [open, setOpen] = useState(false);
  const statusInfo = PROJECT_STATUS.find(s => s.id === project.status);
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setOpen(o => !o)}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{project.name}</div>
            {project.nextAction && (
              <div style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}>→ {project.nextAction}</div>
            )}
          </div>
          <div style={{ background: statusInfo?.color + '22', color: statusInfo?.color,
            borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {statusInfo?.label}
          </div>
        </div>
        {open && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--divide)' }}>
            {/* Volledig bewerkbaar: naam, outcome, next action */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Naam</div>
              <input className="os-input" defaultValue={project.name}
                onBlur={e => e.target.value.trim() && updateProject(project.id, { name: e.target.value.trim() })} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Gewenst resultaat</div>
              <input className="os-input" defaultValue={project.outcome || ''}
                onBlur={e => updateProject(project.id, { outcome: e.target.value })} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase', marginBottom: 3 }}>Eerstvolgende actie</div>
              <input className="os-input" defaultValue={project.nextAction || ''}
                onBlur={e => updateProject(project.id, { nextAction: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {PROJECT_STATUS.map(s => (
                <button key={s.id}
                  className={`os-toggle-chip ${project.status === s.id ? 'active green' : ''}`}
                  onClick={() => updateStatus(project.id, s.id)}
                  style={{ fontSize: 11 }}>
                  {s.label}
                </button>
              ))}
              <button onClick={() => removeProject(project.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--rust)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                🗑 verwijder
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }


// ═══════════════════════════════════════════════════════════════
// TAB: GELD
// ═══════════════════════════════════════════════════════════════
const GELD_KEY = 'gc_geld';
const BUFFER_DOEL = 15000;

function loadGeld() {
  try {
    const stored = JSON.parse(localStorage.getItem(GELD_KEY) || 'null');
    if (stored) return stored;
    const defaults = { buffer: 0, income: 0, expenses: [], notes: '' };
    localStorage.setItem(GELD_KEY, JSON.stringify(defaults));
    return defaults;
  } catch { return { buffer: 0, income: 0, expenses: [], notes: '' }; }
}
function saveGeld(data) { localStorage.setItem(GELD_KEY, JSON.stringify(data)); }

// Bufferhistorie: { id, date, amount, monthlySaving?, note? } — backdaten kan gewoon
const GELD_HIST_KEY = 'gc_geld_history';
export function loadGeldHistory() {
  try {
    return JSON.parse(localStorage.getItem(GELD_HIST_KEY) || '[]')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { return []; }
}
function saveGeldHistory(arr) {
  localStorage.setItem(GELD_HIST_KEY, JSON.stringify(
    [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  ));
}

function TabGeld() {
  const [data, setData] = useState(loadGeld);
  const [bufferInput, setBufferInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [expForm, setExpForm] = useState({ label: '', amount: '', type: 'vast' });
  const [addingExp, setAddingExp] = useState(false);
  const [history, setHistory] = useState(loadGeldHistory);
  const [histForm, setHistForm] = useState(null); // {id?, date, amount, note}

  function persist(updated) { saveGeld(updated); setData(updated); }

  function persistHistory(arr) {
    saveGeldHistory(arr);
    const sorted = loadGeldHistory();
    setHistory(sorted);
    // Buffer = meest recente stand uit de historie
    if (sorted.length) persist({ ...data, buffer: sorted[0].amount });
  }

  function saveBuffer() {
    const val = parseFloat(bufferInput.replace(',', '.'));
    if (isNaN(val)) return;
    persist({ ...data, buffer: val });
    // Historie bijhouden zodat groei/tempo/ETA berekend kan worden
    const today = new Date().toISOString().slice(0, 10);
    persistHistory([{ id: `gh_${Date.now()}`, date: today, amount: val },
      ...history.filter(h => h.date !== today)]);
    setBufferInput('');
    setEditing(false);
  }

  function saveHistEntry() {
    const amount = parseFloat(String(histForm.amount || '').replace(',', '.'));
    if (isNaN(amount) || !histForm.date) return;
    const entry = { id: histForm.id || `gh_${Date.now()}`, date: histForm.date, amount, note: histForm.note || '' };
    persistHistory([entry, ...history.filter(h => h.id !== entry.id)]);
    setHistForm(null);
  }

  function addExpense() {
    const amount = parseFloat(expForm.amount.replace(',', '.'));
    if (!expForm.label.trim() || isNaN(amount)) return;
    const expense = { id: Date.now().toString(), label: expForm.label, amount, type: expForm.type };
    persist({ ...data, expenses: [...(data.expenses || []), expense] });
    setExpForm({ label: '', amount: '', type: 'vast' });
    setAddingExp(false);
  }

  function removeExpense(id) {
    persist({ ...data, expenses: (data.expenses || []).filter(e => e.id !== id) });
  }

  const buffer = data.buffer || 0;
  const bufferPct = Math.min(100, (buffer / BUFFER_DOEL) * 100);
  const vastMaand = (data.expenses || []).filter(e => e.type === 'vast').reduce((s, e) => s + e.amount, 0);
  const varMaand  = (data.expenses || []).filter(e => e.type === 'variabel').reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {/* Buffer tile */}
      <div className="os-section-label" style={{ marginTop: 0 }}>Buffer doel: €{BUFFER_DOEL.toLocaleString('nl-NL')}</div>
      <div className="os-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: buffer >= BUFFER_DOEL ? 'var(--green)' : 'var(--rust)' }}>
            €{buffer.toLocaleString('nl-NL')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--sub)' }}>
            van €{BUFFER_DOEL.toLocaleString('nl-NL')}
          </div>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${bufferPct}%`,
            background: buffer >= BUFFER_DOEL ? 'var(--green)' : 'var(--sage)',
            borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 12 }}>
          {bufferPct < 100
            ? `Nog €${(BUFFER_DOEL - buffer).toLocaleString('nl-NL')} te gaan (${Math.round(bufferPct)}%)`
            : '🎉 Buffer doel bereikt!'}
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="os-input" type="number" value={bufferInput}
              onChange={e => setBufferInput(e.target.value)}
              placeholder="Huidig bedrag (€)…"
              onKeyDown={e => e.key === 'Enter' && saveBuffer()} />
            <button className="os-btn-save" onClick={saveBuffer}>Opslaan</button>
          </div>
        ) : (
          <button className="os-toggle-chip" onClick={() => { setEditing(true); setBufferInput(String(buffer)); }}
            style={{ fontSize: 13 }}>
            Buffer bijwerken
          </button>
        )}
      </div>

      {/* Bufferhistorie — ook oude standen met datum toevoegen */}
      <div className="os-section-label">Bufferhistorie</div>
      <div className="os-card">
        {history.length === 0 && !histForm && (
          <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 8 }}>
            Nog geen historie. Voeg ook oude standen toe (met datum) — dan kan Progressie
            groei en verwachte doelmaand berekenen.
          </div>
        )}
        {history.slice(0, 8).map(h => (
          <div key={h.id} className="os-detail-row">
            <span className="os-dk">{h.date}{h.note ? <span style={{ color: 'var(--ghost)', fontSize: 11 }}> — {h.note}</span> : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="os-dv" style={{ fontWeight: 700 }}>€{h.amount.toLocaleString('nl-NL')}</span>
              <button onClick={() => setHistForm({ id: h.id, date: h.date, amount: String(h.amount), note: h.note || '' })}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
              <button onClick={() => { if (window.confirm('Deze stand verwijderen?')) persistHistory(history.filter(x => x.id !== h.id)); }}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </span>
          </div>
        ))}
        {histForm ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--divide)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <input type="date" className="os-input" value={histForm.date}
                onChange={e => setHistForm(f => ({ ...f, date: e.target.value }))} />
              <input className="os-input" type="number" placeholder="bedrag (€)"
                value={histForm.amount}
                onChange={e => setHistForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <input className="os-input" placeholder="notitie (optioneel)" value={histForm.note}
              onChange={e => setHistForm(f => ({ ...f, note: e.target.value }))}
              style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="os-btn-save" onClick={saveHistEntry}>{histForm.id ? 'Bijwerken' : 'Toevoegen'}</button>
              <button className="os-toggle-chip" onClick={() => setHistForm(null)}>Annuleer</button>
            </div>
          </div>
        ) : (
          <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 6 }}
            onClick={() => setHistForm({ date: new Date().toISOString().slice(0, 10), amount: '', note: '' })}>
            + Stand toevoegen (datum vrij te kiezen)
          </button>
        )}
      </div>

      {/* Vaste lasten */}
      <div className="os-section-label">Maandlasten overzicht</div>
      <div className="os-card">
        {(data.expenses || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', padding: '12px 0' }}>
            Nog geen uitgaven toegevoegd.
          </div>
        ) : (
          <>
            {(data.expenses || []).map(e => (
              <div key={e.id} className="os-detail-row">
                <span className="os-dk">
                  <span style={{ fontSize: 10, background: 'var(--border)', borderRadius: 4,
                    padding: '2px 5px', marginRight: 6, color: 'var(--sub)' }}>
                    {e.type === 'vast' ? 'vast' : 'var'}
                  </span>
                  {e.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="os-dv">€{e.amount.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  <button onClick={() => removeExpense(e.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--divide)', marginTop: 8, paddingTop: 8 }}>
              <div className="os-detail-row">
                <span className="os-dk" style={{ fontWeight: 700 }}>Totaal vast</span>
                <span className="os-dv" style={{ fontWeight: 700 }}>€{vastMaand.toLocaleString('nl-NL')}/mnd</span>
              </div>
              {varMaand > 0 && (
                <div className="os-detail-row">
                  <span className="os-dk" style={{ fontWeight: 700 }}>Totaal variabel</span>
                  <span className="os-dv" style={{ fontWeight: 700 }}>€{varMaand.toLocaleString('nl-NL')}/mnd</span>
                </div>
              )}
            </div>
          </>
        )}

        {addingExp ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--divide)' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input className="os-input" value={expForm.label}
                onChange={e => setExpForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Omschrijving…" style={{ flex: 2 }} />
              <input className="os-input" type="number" value={expForm.amount}
                onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Bedrag (€)" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['vast', 'variabel'].map(t => (
                <button key={t}
                  className={`os-toggle-chip ${expForm.type === t ? 'active green' : ''}`}
                  onClick={() => setExpForm(f => ({ ...f, type: t }))}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="os-btn-save" onClick={addExpense}>Toevoegen</button>
              <button className="os-toggle-chip" onClick={() => setAddingExp(false)}>Annuleer</button>
            </div>
          </div>
        ) : (
          <button className="os-toggle-chip" onClick={() => setAddingExp(true)}
            style={{ marginTop: 10, fontSize: 12 }}>
            + Uitgavepost toevoegen
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ROUTINES
// ═══════════════════════════════════════════════════════════════
const ROUTINES_KEY = 'gc_routines';
const ROUTINE_STAGES = [
  { id: 'learning',  label: 'Aan het leren',   emoji: '🌱', desc: 'Bewust aandacht nodig, niet vanzelf.' },
  { id: 'stable',    label: 'Stabiel',          emoji: '🌿', desc: 'Gaat meestal goed, soms nog vergeten.' },
  { id: 'automatic', label: 'Automatisch',      emoji: '🌳', desc: 'Gaat vanzelf, geen energie voor nodig.' },
];

function loadRoutines() {
  try { return JSON.parse(localStorage.getItem(ROUTINES_KEY) || '[]'); } catch { return []; }
}
function saveRoutines(arr) { localStorage.setItem(ROUTINES_KEY, JSON.stringify(arr)); }

function TabRoutines() {
  const [routines, setRoutines] = useState(loadRoutines);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', stage: 'learning', trigger: '', time: '' });

  function persist(arr) { saveRoutines(arr); setRoutines(arr); }

  function updateRoutine(id, patch) {
    persist(routines.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function add() {
    if (!form.name.trim()) return;
    persist([...routines, { id: Date.now().toString(), ...form, createdAt: new Date().toISOString().slice(0, 10) }]);
    setForm({ name: '', stage: 'learning', trigger: '', time: '' });
    setAdding(false);
  }

  function setStage(id, stage) {
    persist(routines.map(r => r.id === id ? { ...r, stage } : r));
  }

  function remove(id) { persist(routines.filter(r => r.id !== id)); }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 16 }}>
        Routines worden automatisch pas als ze vanzelf gaan. Drie stadia: leren → stabiel → automatisch.
      </div>

      {ROUTINE_STAGES.map(stage => {
        const stageRoutines = routines.filter(r => r.stage === stage.id);
        return (
          <React.Fragment key={stage.id}>
            <div className="os-section-label" style={{ marginTop: stage.id === 'learning' ? 0 : undefined }}>
              {stage.emoji} {stage.label}
              <span style={{ fontSize: 11, color: 'var(--ghost)', marginLeft: 8, fontWeight: 400 }}>
                {stage.desc}
              </span>
            </div>
            {stageRoutines.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ghost)', marginBottom: 8, paddingLeft: 4 }}>
                Geen routines in dit stadium.
              </div>
            ) : (
              stageRoutines.map(r => (
                <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    {editingId === r.id ? (
                      <div style={{ flex: 1, marginRight: 8 }}>
                        <input className="os-input" defaultValue={r.name} autoFocus
                          style={{ marginBottom: 6 }}
                          onBlur={e => e.target.value.trim() && updateRoutine(r.id, { name: e.target.value.trim() })} />
                        <input className="os-input" defaultValue={r.trigger || ''}
                          placeholder="Trigger (na…)"
                          onBlur={e => updateRoutine(r.id, { trigger: e.target.value })} />
                        <input className="os-input" defaultValue={r.time || ''}
                          placeholder="Moment/frequentie (bijv. dagelijks 8:00)"
                          style={{ marginTop: 6 }}
                          onBlur={e => updateRoutine(r.id, { time: e.target.value })} />
                        <button className="os-toggle-chip" style={{ fontSize: 11, marginTop: 6 }}
                          onClick={() => setEditingId(null)}>Klaar</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: r.trigger || r.time ? 2 : 0 }}>{r.name}</div>
                        {r.trigger && (
                          <div style={{ fontSize: 12, color: 'var(--sub)' }}>Na: {r.trigger}</div>
                        )}
                        {r.time && (
                          <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{r.time}</div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
                      <button onClick={() => window.confirm('Routine verwijderen?') && remove(r.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {ROUTINE_STAGES.map(s => (
                      <button key={s.id}
                        className={`os-toggle-chip ${r.stage === s.id ? 'active green' : ''}`}
                        onClick={() => setStage(r.id, s.id)}
                        style={{ fontSize: 11 }}>
                        {s.emoji} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </React.Fragment>
        );
      })}

      {adding && (
        <div className="os-card" style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Routine</label>
            <input className="os-input" value={form.name} autoFocus
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Bijv. 5 min wandelen na lunch…" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Trigger (optioneel)</label>
            <input className="os-input" value={form.trigger}
              onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
              placeholder="Bijv. na het ontbijt…" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Stadium</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {ROUTINE_STAGES.map(s => (
                <button key={s.id}
                  className={`os-toggle-chip ${form.stage === s.id ? 'active green' : ''}`}
                  onClick={() => setForm(f => ({ ...f, stage: s.id }))}
                  style={{ fontSize: 12 }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="os-btn-save" onClick={add}>Toevoegen</button>
            <button className="os-toggle-chip" onClick={() => setAdding(false)} style={{ fontSize: 13 }}>Annuleer</button>
          </div>
        </div>
      )}

      <button className="os-btn-save" style={{ marginTop: 12, width: '100%' }}
        onClick={() => setAdding(true)}>
        + Nieuwe routine
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DREAM BOARD — rustige visuele future self, eigen afbeeldingen
// ═══════════════════════════════════════════════════════════════
const DREAMBOARD_KEY = 'gc_dreamboard';

export const DREAM_DOMAINS = [
  { id: 'body',    emoji: '💪', label: 'Body' },
  { id: 'style',   emoji: '👗', label: 'Style / Model' },
  { id: 'sport',   emoji: '🏃', label: 'Sport' },
  { id: 'work',    emoji: '💼', label: 'Work' },
  { id: 'money',   emoji: '💰', label: 'Money' },
  { id: 'freedom', emoji: '🌊', label: 'Freedom / Life' },
];

function loadDreamboard() {
  try { return JSON.parse(localStorage.getItem(DREAMBOARD_KEY) || '{}'); } catch { return {}; }
}
function saveDreamboard(data) { localStorage.setItem(DREAMBOARD_KEY, JSON.stringify(data)); }

function DreamBoard() {
  const [board, setBoard] = useState(loadDreamboard);
  const [images, setImages] = useState({});
  const [openDomain, setOpenDomain] = useState(null);
  const fileRef = useRef(null);
  const uploadTarget = useRef(null);

  useEffect(() => {
    dreamStore.getAll().then(setImages).catch(() => {});
  }, []);

  function updDomain(domainId, field, val) {
    const next = { ...board, [domainId]: { ...(board[domainId] || {}), [field]: val } };
    saveDreamboard(next);
    setBoard(next);
  }

  function pickImage(domainId) {
    uploadTarget.current = domainId;
    fileRef.current?.click();
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    const domainId = uploadTarget.current;
    e.target.value = '';
    if (!file || !domainId) return;
    try {
      const { base64, mimeType } = await fileToDreamImage(file);
      await dreamStore.save(domainId, base64, mimeType);
      const all = await dreamStore.getAll();
      setImages(all);
    } catch { /* stil falen — geen crash op rare bestanden */ }
  }

  async function removeImage(id) {
    await dreamStore.delete(id);
    setImages(await dreamStore.getAll());
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="os-section-label" style={{ marginTop: 0 }}>Dream Board</div>
      <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
        Jouw eigen beelden van waar je naartoe leeft — per levensdomein, met een future-self zin en doelen.
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />

      {DREAM_DOMAINS.map(dom => {
        const imgs = (images[dom.id] || []).slice(0, 3);
        const data = board[dom.id] || {};
        const open = openDomain === dom.id;
        const hasContent = imgs.length > 0 || data.sentence || data.goal1y;
        return (
          <div key={dom.id} style={{ border: '1px solid var(--border)', borderRadius: 12,
            marginBottom: 8, overflow: 'hidden', background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer' }}
              onClick={() => setOpenDomain(open ? null : dom.id)}>
              <span style={{ fontSize: 18 }}>{dom.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.3px' }}>{dom.label}</div>
                {data.sentence && !open && (
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                    {data.sentence}
                  </div>
                )}
              </div>
              {!open && imgs.length > 0 && (
                <div style={{ display: 'flex', gap: 3 }}>
                  {imgs.slice(0, 3).map(img => (
                    <img key={img.id} src={`data:${img.mimeType};base64,${img.base64}`} alt=""
                      style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 6 }} />
                  ))}
                </div>
              )}
              {!hasContent && !open && <span style={{ fontSize: 11, color: 'var(--ghost)' }}>leeg</span>}
              <span style={{ color: 'var(--ghost)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
            </div>

            {open && (
              <div style={{ padding: '0 14px 14px' }}>
                {/* Afbeeldingen */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {imgs.map(img => (
                    <div key={img.id} style={{ position: 'relative' }}>
                      <img src={`data:${img.mimeType};base64,${img.base64}`} alt=""
                        style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10 }} />
                      <button onClick={() => removeImage(img.id)}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                          borderRadius: 99, border: 'none', background: 'var(--rust)', color: '#fff',
                          fontSize: 12, cursor: 'pointer', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  {imgs.length < 3 && (
                    <button onClick={() => pickImage(dom.id)}
                      style={{ width: 88, height: 88, borderRadius: 10, border: '1px dashed var(--border)',
                        background: 'transparent', color: 'var(--ghost)', cursor: 'pointer', fontSize: 22 }}>
                      +
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: 3 }}>Future-self zin</div>
                  <input className="os-input" value={data.sentence || ''}
                    onChange={e => updDomain(dom.id, 'sentence', e.target.value)}
                    placeholder={`Ik ben iemand die… (${dom.label.toLowerCase()})`} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: 3 }}>Doel over 1 jaar</div>
                  <input className="os-input" value={data.goal1y || ''}
                    onChange={e => updDomain(dom.id, 'goal1y', e.target.value)}
                    placeholder="Waar sta je over 1 jaar…" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
                      letterSpacing: '0.5px', marginBottom: 3 }}>6 mnd milestone</div>
                    <input className="os-input" value={data.goal6m || ''}
                      onChange={e => updDomain(dom.id, 'goal6m', e.target.value)}
                      placeholder="Optioneel…" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
                      letterSpacing: '0.5px', marginBottom: 3 }}>3 mnd milestone</div>
                    <input className="os-input" value={data.goal3m || ''}
                      onChange={e => updDomain(dom.id, 'goal3m', e.target.value)}
                      placeholder="Optioneel…" />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: TOEKOMST
// ═══════════════════════════════════════════════════════════════
const TOEKOMST_KEY = 'gc_future_self';

function loadToekomst() {
  try {
    return JSON.parse(localStorage.getItem(TOEKOMST_KEY) || 'null') || {
      vision: '',
      identity: '',
      values: [],
      goals_1y: '',
      goals_3y: '',
      letters: [],
    };
  } catch { return { vision: '', identity: '', values: [], goals_1y: '', goals_3y: '', letters: [] }; }
}
function saveToekomst(data) { localStorage.setItem(TOEKOMST_KEY, JSON.stringify(data)); }

const VALUE_OPTIONS = [
  'Vrijheid', 'Gezondheid', 'Creativiteit', 'Familie', 'Avontuur',
  'Groei', 'Rust', 'Onafhankelijkheid', 'Verbinding', 'Discipline',
];

function TabToekomst() {
  const [data, setData] = useState(loadToekomst);
  const [saved, setSaved] = useState(false);
  const [writingLetter, setWritingLetter] = useState(false);
  const [letterText, setLetterText] = useState('');

  function persist(updated) { saveToekomst(updated); setData(updated); }

  function save() {
    persist(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function toggleValue(v) {
    const cur = data.values || [];
    persist({ ...data, values: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  }

  function addLetter() {
    if (!letterText.trim()) return;
    const letter = { id: Date.now().toString(), text: letterText, date: new Date().toISOString().slice(0, 10) };
    persist({ ...data, letters: [letter, ...(data.letters || [])] });
    setLetterText('');
    setWritingLetter(false);
  }

  return (
    <div>
      <DreamBoard />

      <div className="os-section-label" style={{ marginTop: 0 }}>Identiteit</div>
      <div className="os-card">
        <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 8 }}>
          Ik ben iemand die…
        </div>
        <textarea
          style={{ width: '100%', minHeight: 60, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={data.identity || ''}
          onChange={e => setData(d => ({ ...d, identity: e.target.value }))}
          placeholder="Bijv. elke dag beweegt, gezond eet, grenzen bewaakt…"
        />
      </div>

      <div className="os-section-label">Kernwaarden</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {VALUE_OPTIONS.map(v => (
          <button key={v}
            className={`os-toggle-chip ${(data.values || []).includes(v) ? 'active green' : ''}`}
            onClick={() => toggleValue(v)}
            style={{ fontSize: 13 }}>
            {v}
          </button>
        ))}
      </div>

      <div className="os-section-label">Visie</div>
      <div className="os-card">
        <textarea
          style={{ width: '100%', minHeight: 80, background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={data.vision || ''}
          onChange={e => setData(d => ({ ...d, vision: e.target.value }))}
          placeholder="Hoe ziet je leven eruit als het goed voelt? Beschrijf je gewenste dag over 2 jaar…"
        />
      </div>

      <div className="os-section-label">Doelen</div>
      <div className="os-card">
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 4 }}>Over 1 jaar</div>
          <textarea
            style={{ width: '100%', minHeight: 52, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={data.goals_1y || ''}
            onChange={e => setData(d => ({ ...d, goals_1y: e.target.value }))}
            placeholder="Wat wil je bereikt hebben…" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 4 }}>Over 3 jaar</div>
          <textarea
            style={{ width: '100%', minHeight: 52, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box' }}
            value={data.goals_3y || ''}
            onChange={e => setData(d => ({ ...d, goals_3y: e.target.value }))}
            placeholder="Wat wil je bereikt hebben…" />
        </div>
      </div>

      <button className="os-btn-save" onClick={save} style={{ marginBottom: 16 }}>
        {saved ? '✓ Opgeslagen' : 'Opslaan'}
      </button>

      {/* Letters to future self */}
      <div className="os-section-label">Brief aan toekomstige ik</div>
      {writingLetter ? (
        <div className="os-card">
          <textarea
            style={{ width: '100%', minHeight: 120, background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text)', resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }}
            value={letterText}
            onChange={e => setLetterText(e.target.value)}
            placeholder="Lieve toekomstige ik…"
            autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="os-btn-save" onClick={addLetter}>Versturen</button>
            <button className="os-toggle-chip" onClick={() => setWritingLetter(false)}>Annuleer</button>
          </div>
        </div>
      ) : (
        <button className="os-toggle-chip" style={{ marginBottom: 12, fontSize: 13 }}
          onClick={() => setWritingLetter(true)}>
          + Brief schrijven
        </button>
      )}
      {(data.letters || []).length > 0 && (
        <div>
          {data.letters.slice(0, 5).map(l => (
            <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
              padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 6 }}>{l.date}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {l.text.length > 200 ? l.text.slice(0, 200) + '…' : l.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: ETEN (Food Preferences)
// ═══════════════════════════════════════════════════════════════
const FOOD_PREF_KEY = 'gc_food_prefs';

const EXCLUDE_OPTIONS = [
  { key: 'bonen',     emoji: '🫘', label: 'Bonen' },
  { key: 'banaan',    emoji: '🍌', label: 'Banaan' },
  { key: 'ei_veel',  emoji: '🥚', label: '>2 eieren/dag' },
  { key: 'rood_vlees',emoji: '🥩', label: 'Rood vlees' },
  { key: 'vis',       emoji: '🐟', label: 'Vis' },
  { key: 'lactose',  emoji: '🥛', label: 'Lactose' },
  { key: 'gluten',   emoji: '🌾', label: 'Gluten' },
  { key: 'noten',    emoji: '🥜', label: 'Noten' },
];
const PREFER_OPTIONS = [
  { key: 'smoothies', emoji: '🥤', label: 'Smoothies' },
  { key: 'shakes',   emoji: '🧃', label: 'Shakes' },
  { key: 'soep',     emoji: '🍲', label: 'Soep' },
  { key: 'salades',  emoji: '🥗', label: 'Salades' },
  { key: 'kip',      emoji: '🍗', label: 'Kip' },
  { key: 'vis_zee',  emoji: '🐟', label: 'Vis/zee' },
  { key: 'pasta',    emoji: '🍝', label: 'Pasta' },
  { key: 'rijst_wok',emoji: '🍚', label: 'Rijst/wok' },
];

function loadFoodPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOOD_PREF_KEY) || 'null');
    if (stored) return stored;
    const defaults = { excluded: ['bonen', 'banaan', 'ei_veel'], preferred: ['smoothies', 'shakes', 'soep', 'salades'], notes: '' };
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(defaults));
    return defaults;
  } catch { return { excluded: [], preferred: [], notes: '' }; }
}

function TabEten() {
  const [prefs, setPrefs] = useState(loadFoodPrefs);
  const [saved, setSaved] = useState(false);

  function savePrefs(updated) {
    setPrefs(updated);
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function toggleExclude(key) {
    const next = new Set(prefs.excluded);
    if (next.has(key)) next.delete(key); else next.add(key);
    savePrefs({ ...prefs, excluded: [...next] });
  }

  function togglePrefer(key) {
    const next = new Set(prefs.preferred);
    if (next.has(key)) next.delete(key); else next.add(key);
    savePrefs({ ...prefs, preferred: [...next] });
  }

  const excluded  = new Set(prefs.excluded  || []);
  const preferred = new Set(prefs.preferred || []);

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 16 }}>
        Jouw voorkeuren worden meegenomen bij menu-suggesties en coach-advies.
      </div>

      <div className="os-section-label" style={{ marginTop: 0 }}>Niet eten / vermijden</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {EXCLUDE_OPTIONS.map(opt => (
          <button key={opt.key}
            className={`os-toggle-chip ${excluded.has(opt.key) ? 'active' : ''}`}
            style={{ fontSize: 13, ...(excluded.has(opt.key) ? { background: 'var(--rust-bg, rgba(179,94,69,0.1))', color: 'var(--rust)', borderColor: 'var(--rust)' } : {}) }}
            onClick={() => toggleExclude(opt.key)}>
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      <div className="os-section-label">Voorkeur voor</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {PREFER_OPTIONS.map(opt => (
          <button key={opt.key}
            className={`os-toggle-chip ${preferred.has(opt.key) ? 'active green' : ''}`}
            style={{ fontSize: 13 }}
            onClick={() => togglePrefer(opt.key)}>
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>

      <div className="os-section-label">Extra notities</div>
      <div className="os-card">
        <textarea
          style={{ width: '100%', minHeight: 70, background: 'transparent', border: 'none',
            padding: 0, fontSize: 14, color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box' }}
          value={prefs.notes || ''}
          onChange={e => savePrefs({ ...prefs, notes: e.target.value })}
          placeholder="Allergieën, wensen, bijzonderheden…"
        />
      </div>

      {saved && (
        <div style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
          ✓ Opgeslagen
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
// Taken = één plek voor Capture (inbox met statussen) én projecten met
// WIP-limiet. Geen concurrerende taakmodules meer.
function TabTaken() {
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState('capture');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{ id: 'capture', label: '📥 Capture' }, { id: 'projects', label: '📁 Projecten' }].map(v => (
          <button key={v.id} className={`os-scale-btn ${view === v.id ? 'active' : ''}`}
            onClick={() => setView(v.id)} style={{ flex: 1, padding: '9px 4px', fontSize: 12 }}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'capture' ? <CaptureCenter currentDate={today} /> : <TabProjecten />}
    </div>
  );
}

export default function LevenScreen({ logs = {} }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="os-content">
      <SubTabs tabs={SUBTABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 0 && <TabTaken />}
      {activeTab === 1 && <TabFocus logs={logs} />}
      {activeTab === 2 && <TabRoutines />}
      {activeTab === 3 && <TabGeld />}
      {activeTab === 4 && <TabToekomst />}
      {activeTab === 5 && <TabGlow />}
      {activeTab === 6 && <TabEten />}
    </div>
  );
}
