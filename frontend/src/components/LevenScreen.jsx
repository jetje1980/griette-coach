import React, { useState, useEffect } from 'react';
import SubTabs from './SubTabs';

const SUBTABS = ['Glow', 'Projecten', 'Geld', 'Routines', 'Toekomst', 'Eten'];

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
    });
  }

  function saveAdd() {
    const tp = GLOW_TYPES.find(t => t.id === form.type);
    const newEvent = {
      id: Date.now(),
      type: form.type,
      date: form.date,
      notes: form.notes,
      subItems: form.subItems || [],
      intervalDays: form.intervalDays || 28,
      nextDate: glowAddDays(form.date, form.intervalDays || 28),
      label: tp?.label,
    };
    persist([newEvent, ...events]);
    setAdding(null);
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
        <ExpandSection label={`Geschiedenis (${events.length})`}>
          <div>
            {events.slice(0, 20).map(e => {
              const gType = GLOW_TYPES.find(t => t.id === e.type);
              return (
                <div key={e.id} className="os-detail-row">
                  <span className="os-dk">{gType?.emoji} {gType?.label || e.type}</span>
                  <span className="os-dv">{e.date}</span>
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

function TabProjecten() {
  const [projects, setProjects] = useState(loadProjects);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', outcome: '', status: 'actief', nextAction: '' });

  function persist(arr) { saveProjects(arr); setProjects(arr); }

  function add() {
    if (!form.name.trim()) return;
    persist([{ id: Date.now().toString(), ...form, createdAt: new Date().toISOString().slice(0, 10) }, ...projects]);
    setForm({ name: '', outcome: '', status: 'actief', nextAction: '' });
    setAdding(false);
  }

  function updateStatus(id, status) {
    persist(projects.map(p => p.id === id ? { ...p, status } : p));
  }

  const active   = projects.filter(p => p.status === 'actief');
  const waiting  = projects.filter(p => p.status === 'wacht');
  const parked   = projects.filter(p => p.status === 'park');
  const done     = projects.filter(p => p.status === 'klaar');

  function ProjectCard({ project }) {
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
            {project.outcome && (
              <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 10 }}>
                <span style={{ fontWeight: 700 }}>Doel:</span> {project.outcome}
              </div>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {PROJECT_STATUS.map(s => (
                <button key={s.id}
                  className={`os-toggle-chip ${project.status === s.id ? 'active green' : ''}`}
                  onClick={() => updateStatus(project.id, s.id)}
                  style={{ fontSize: 11 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
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
          {active.map(p => <ProjectCard key={p.id} project={p} />)}
        </>
      )}
      {waiting.length > 0 && (
        <>
          <div className="os-section-label">Wacht op…</div>
          {waiting.map(p => <ProjectCard key={p.id} project={p} />)}
        </>
      )}
      {parked.length > 0 && (
        <ExpandSection label={`Geparkeerd (${parked.length})`}>
          {parked.map(p => <ProjectCard key={p.id} project={p} />)}
        </ExpandSection>
      )}
      {done.length > 0 && (
        <ExpandSection label={`Afgerond (${done.length})`}>
          {done.map(p => <ProjectCard key={p.id} project={p} />)}
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

function TabGeld() {
  const [data, setData] = useState(loadGeld);
  const [bufferInput, setBufferInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [expForm, setExpForm] = useState({ label: '', amount: '', type: 'vast' });
  const [addingExp, setAddingExp] = useState(false);

  function persist(updated) { saveGeld(updated); setData(updated); }

  function saveBuffer() {
    const val = parseFloat(bufferInput.replace(',', '.'));
    if (isNaN(val)) return;
    persist({ ...data, buffer: val });
    setBufferInput('');
    setEditing(false);
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
  const [form, setForm] = useState({ name: '', stage: 'learning', trigger: '', time: '' });

  function persist(arr) { saveRoutines(arr); setRoutines(arr); }

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
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: r.trigger ? 2 : 0 }}>{r.name}</div>
                      {r.trigger && (
                        <div style={{ fontSize: 12, color: 'var(--sub)' }}>Na: {r.trigger}</div>
                      )}
                    </div>
                    <button onClick={() => remove(r.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 16 }}>×</button>
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
export default function LevenScreen() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="os-content">
      <SubTabs tabs={SUBTABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 0 && <TabGlow />}
      {activeTab === 1 && <TabProjecten />}
      {activeTab === 2 && <TabGeld />}
      {activeTab === 3 && <TabRoutines />}
      {activeTab === 4 && <TabToekomst />}
      {activeTab === 5 && <TabEten />}
    </div>
  );
}
