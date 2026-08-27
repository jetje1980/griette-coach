import React, { useState, useRef, useEffect, useMemo } from 'react';
import { computeHeadCoach, computeNextSession } from './CoachAdvice';
import { nextSessionForecast } from '../forecast';
import StrengthToday from './StrengthToday';
import LeverageCard from './LeverageCard';
import CockpitCard from './CockpitCard';
import WhyPanel from './WhyPanel';
import AlivenessCard from './AlivenessCard';
import { strengthDecision } from '../strengthGate';
import { photoStore } from '../photoStore';
import { dueCheckpoint, checkpointPrompt } from '../bodyProgress';
import { fmtPace } from '../workouts';
import RecoveryCheck from './RecoveryCheck';
import CaptureCenter from './CaptureCenter';
import { USER } from '../config';
// getDayActions ontbrak hier.
//
// DagPlanning riep hem aan, hij was nooit geïmporteerd, en dus wierp het
// scherm "getDayActions is not defined" zodra je de lade "Mijn dag plannen"
// opende. React haalt dan de hele boom weg: je ziet een leeg scherm, en op
// een telefoon voelt dat als uit de app gegooid worden.
//
// Het viel niet op omdat geen enkele test die lade ooit opende.
import { loadTasks, getDayActions } from '../tasks';
import { loadExecutiveFocus } from './LevenScreen';
import { todayLocal, formatNLLong } from '../datetime';

const NL_DAYS   = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const NL_MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus',
                   'september','oktober','november','december'];

function formatNL(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return { dayName: NL_DAYS[d.getDay()], day: d.getDate(), month: NL_MONTHS[d.getMonth()] };
}

const todayStr = todayLocal;

// ── localStorage helpers ────────────────────────────────────────
const SEASON_KEY = 'gc_focus_season';
const DEFAULT_SEASON = { name: 'Strong · Lean · Structured' };

function getShutdownState(date) {
  try { return JSON.parse(localStorage.getItem(`gc_shutdown_${date}`) || '{}'); } catch { return {}; }
}
function saveShutdownState(date, s) {
  localStorage.setItem(`gc_shutdown_${date}`, JSON.stringify(s));
}
function getTop3(date) {
  try { return JSON.parse(localStorage.getItem(`gc_top3_${date}`) || '[]'); } catch { return []; }
}
function saveTop3(date, items) {
  localStorage.setItem(`gc_top3_${date}`, JSON.stringify(items));
}
function getTransitions(date) {
  try { return JSON.parse(localStorage.getItem(`gc_transitions_${date}`) || '[]'); } catch { return []; }
}
function saveTransitions(date, items) {
  localStorage.setItem(`gc_transitions_${date}`, JSON.stringify(items));
}
function getDayPlan(date) {
  try { return JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}'); } catch { return {}; }
}
function saveDayPlan(date, obj) {
  localStorage.setItem(`gc_day_plan_${date}`, JSON.stringify(obj));
}

const DAY_CAP = [
  { id: 'minimum', label: 'Minimum', emoji: '🪫' },
  { id: 'normaal', label: 'Normaal', emoji: '⚡' },
  { id: 'hoog',    label: 'Hoog',    emoji: '🚀' },
  { id: 'herstel', label: 'Herstel', emoji: '🛌' },
];
const ENERGIE_OPTS = ['Zwaar','Middel','Licht','Fysiek','Vrij'];
const ENERGIE_KEYS = ['energy_morning', 'energy_middag', 'energy_avond'];
const ENERGIE_SLOT_LABELS = ['Ochtend', 'Middag', 'Avond'];

const FREE_BLOCK_LABELS = { morning: 'Ochtend', midday: 'Middag', evening: 'Avond', fullday: 'Hele dag' };
const TRAIN_LABELS = { run: '🏃 Hardlopen', walk: '🚶 Wandelen', swim: '🏊 Zwemmen',
  bike: '🚴 Fietsen', core: '💪 Kracht', rest: '🛌 Rust', free: '🌿 Vrij' };

function ExpandSection({ label, children, initialOpen = false, badge }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button className={`os-expand-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span>{label}</span>
        {badge != null && badge > 0 && (
          <span style={{ background: 'var(--rust)', color: '#fff', borderRadius: 99,
            fontSize: 11, fontWeight: 700, padding: '1px 7px', marginLeft: 8 }}>{badge}</span>
        )}
        <span className="os-expand-arrow">↓</span>
      </button>
      {open && <div className="os-card" style={{ marginBottom: 8 }}>{children}</div>}
    </>
  );
}

function ForecastMini({ log, logs, currentDate, coach, nextSession }) {
  const f = useMemo(
    () => nextSessionForecast({
      run: nextSession?.run || nextSession?.previewRun,
      logs, currentDate, gate: coach?.gate,
    }),
    [logs, currentDate, nextSession?.run?.nr, nextSession?.previewRun?.nr, coach?.gate?.action]);

  if (!f.available) return null;

  const CONF = {
    HIGH: { label: 'hoog', color: 'var(--green)' },
    MEDIUM: { label: 'gemiddeld', color: 'var(--gold)' },
    LOW: { label: 'laag', color: 'var(--ghost)' },
  }[f.confidence];

  const cell = (label, value) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  return (
    <div className="os-card" style={{ marginBottom: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          {f.deferred
            ? `Verwachting — vanaf ${f.earliestDate.slice(5)}`
            : 'Verwachting deze sessie'}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: CONF.color,
          border: `1px solid ${CONF.color}`, borderRadius: 99, padding: '1px 7px' }}>
          {CONF.label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(74px, 1fr))', gap: 10 }}>
        {cell('Duur', f.duration ? `${f.duration} min` : '–')}
        {cell('Afstand', f.distanceKm ? `${f.distanceKm.low}–${f.distanceKm.high} km` : '–')}
        {cell('Tempo', f.sessionPace ? `${fmtPace(f.sessionPace.low)}–${fmtPace(f.sessionPace.high)}` : '–')}
        {cell('Hartslag', f.expectedHR
          ? `${Math.round(f.expectedHR.low)}–${Math.round(f.expectedHR.high)}`
          : `${f.targetHR.low}–${f.targetHR.high}`)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45, marginTop: 8,
        paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <strong>Advies:</strong> {f.safe.runToday
          ? `richtgebied ${f.targetHR.low}–${f.targetHR.high} bpm. Het tempo hierboven is een verwachting, geen doel.`
          : f.safe.detail}
      </div>
    </div>
  );
}

// ── 1c. Fotomoment ──────────────────────────────────────────────
// Verschijnt alleen op een ijkpunt. Twaalf weken later is de vergelijking
// het enige echte bewijs van lichaamsverandering — die momenten mogen niet
// stilletjes voorbijgaan.
function PhotoCheckpointCard({ currentDate, goToTab }) {
  const [cp, setCp] = useState(null);

  useEffect(() => {
    let alive = true;
    photoStore.getAll()
      .then(sessions => { if (alive) setCp(dueCheckpoint(sessions, currentDate)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentDate]);

  if (!cp) return null;
  const prompt = checkpointPrompt(cp);

  return (
    <div className="os-card" style={{ marginBottom: 10, borderLeft: '4px solid var(--rust)' }}>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)', marginBottom: 3 }}>
        {prompt.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
        {prompt.text}
      </div>
      <button className="btn-primary" onClick={() => goToTab?.(4)}
        style={{ fontSize: 12.5, whiteSpace: 'normal' }}>
        Naar Mijn verandering
      </button>
    </div>
  );
}


function Top3({ currentDate }) {
  const [items, setItems] = useState(() => getTop3(currentDate));
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setItems(getTop3(currentDate)); }, [currentDate]);

  function persist(updated) { saveTop3(currentDate, updated); setItems(updated); }

  function add() {
    const t = text.trim();
    if (!t || items.length >= 3) return;
    persist([...items, { id: Date.now().toString(), text: t, done: false }]);
    setText('');
    inputRef.current?.focus();
  }
  function toggle(id) {
    const item = items.find(i => i.id === id);
    persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
    // Komt deze prioriteit uit Capture? Dan taak meteen afronden.
    if (item?.taskId && !item.done) completeTask(item.taskId, currentDate);
  }
  function remove(id) { persist(items.filter(i => i.id !== id)); }

  const allDone = items.length > 0 && items.every(i => i.done);

  return (
    <div>
      {allDone && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)',
          borderRadius: 10, padding: '9px 12px', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
          Top 3 afgerond. Sterk.
        </div>
      )}
      {items.map((item, idx) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
          paddingBottom: 9, marginBottom: 9,
          borderBottom: idx < items.length - 1 ? '1px solid var(--divide)' : 'none' }}>
          <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, minWidth: 12,
            textAlign: 'center' }}>{idx + 1}</div>
          <div className={`os-check-box ${item.done ? 'checked' : ''}`}
            style={{ flexShrink: 0 }} onClick={() => toggle(item.id)}>
            {item.done ? '✓' : ''}
          </div>
          <span style={{ flex: 1, fontSize: 14, color: item.done ? 'var(--sub)' : 'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none' }}>
            {item.text}
          </span>
          {item.taskId && <span style={{ fontSize: 10, color: 'var(--ghost)' }}>📥</span>}
          <button onClick={() => remove(item.id)}
            style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer',
              fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
        </div>
      ))}
      {items.length < 3 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} className="os-input" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={`Prioriteit ${items.length + 1} van 3…`} />
          <button className="os-btn-save" onClick={add} style={{ flexShrink: 0 }}>+</button>
        </div>
      )}
      {items.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 6 }}>
          Max 3 prioriteiten — kies wat écht telt vandaag.
        </div>
      )}
    </div>
  );
}

// ── 4. Dagplanning — compacte tijdsweergave ─────────────────────
function DagPlanning({ currentDate, log, nextSession, goToTab }) {
  const plan = getDayPlan(currentDate);
  const actions = getDayActions(currentDate);
  const rows = [];

  const trainDone = log?.run_done || log?.strength_done || log?.core_done;
  if (plan.training && plan.training !== 'rest' && plan.training !== 'free') {
    rows.push({ icon: TRAIN_LABELS[plan.training]?.slice(0, 2) || '🏃',
      label: TRAIN_LABELS[plan.training]?.slice(2) || 'Training',
      note: trainDone ? 'gedaan' : nextSession?.run ? `${nextSession.run.duration} min` : 'gepland',
      done: !!trainDone });
  }
  if (plan.kracht) {
    rows.push({ icon: '🏋️', label: plan.kracht === 'snack' ? 'Strength snack' : `Kracht ${plan.kracht}`,
      note: log?.strength_done ? 'gedaan' : 'gepland', done: !!log?.strength_done });
  }
  for (const b of plan.workBlocks || []) {
    rows.push({ icon: '💼', label: `Werkblok ${FREE_BLOCK_LABELS[b] || b}`, note: null, done: false });
  }
  for (const b of plan.freeBlocks || []) {
    rows.push({ icon: '🌿', label: `Beschermd — ${FREE_BLOCK_LABELS[b] || b}`,
      note: 'niet vullen', done: false, protected: true });
  }
  if (plan.recovery) {
    rows.push({ icon: '🌊', label: 'Herstelmoment', note: null, done: false });
  }
  for (const a of actions) {
    rows.push({ icon: '✅', label: a.title, note: a.trelloUrl ? 'Trello' : 'uit Capture', done: a.done, actionId: a.id });
  }

  if (!rows.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
        Nog niets gepland vandaag — zet hierboven je training, kracht of
        beschermde blokken.{' '}
        <button onClick={() => goToTab?.(1)}
          style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, padding: 0 }}>
          Of plan je hele week →
        </button>
      </div>
    );
  }

  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--divide)' : 'none',
          opacity: r.done ? 0.55 : 1 }}>
          <span style={{ fontSize: 15 }}>{r.icon}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: r.protected ? 700 : 500,
            color: r.protected ? 'var(--green)' : 'var(--text)',
            textDecoration: r.done ? 'line-through' : 'none' }}>
            {r.label}
          </span>
          {r.note && <span style={{ fontSize: 11, color: 'var(--ghost)' }}>{r.note}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Je dag plannen, binnen de app ───────────────────────────────
//
// "Mijn dag plannen" liet zien wát er gepland stond en bood daarnaast één
// uitweg: "Plan je week →", die naar het weekscherm sprong. Wie iets wilde
// plannen moest de app dus verlaten om terug te komen — en via de agenda-
// taken kon je zomaar in Google Calendar belanden.
//
// Dit is het scherm dat er hoorde te zijn: training, kracht, herstel en
// beschermde blokken voor déze dag, hier in te stellen. De agenda blijft
// bestaan, maar alleen achter een knop die zegt dat hij de agenda opent.
function PlanEditor({ currentDate, onClose, onSaved }) {
  const [plan, setPlan] = useState(() => getDayPlan(currentDate));
  const [bewaard, setBewaard] = useState(false);

  useEffect(() => { setPlan(getDayPlan(currentDate)); setBewaard(false); }, [currentDate]);

  function zet(veld, waarde) {
    setPlan(p => ({ ...p, [veld]: p[veld] === waarde ? null : waarde }));
    setBewaard(false);
  }
  function wissel(veld, waarde) {
    setPlan(p => {
      const lijst = new Set(p[veld] || []);
      if (lijst.has(waarde)) lijst.delete(waarde); else lijst.add(waarde);
      return { ...p, [veld]: [...lijst] };
    });
    setBewaard(false);
  }
  function bewaar() {
    saveDayPlan(currentDate, plan);
    setBewaard(true);
    onSaved?.(plan);
  }

  const Rij = ({ label, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  );
  const Chip = ({ actief, onClick, children, kleur }) => (
    <button type="button" onClick={onClick}
      style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 10px', borderRadius: 99,
        border: `1px solid ${actief ? (kleur || 'var(--sage)') : 'var(--border)'}`,
        background: actief ? (kleur || 'var(--sage)') : 'var(--card)',
        color: actief ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
      {children}
    </button>
  );

  // De agendaknop bouwt een gewone Google Calendar-link. Hij staat apart,
  // hij zegt wat hij doet, en hij is het enige dat de app verlaat.
  const agendaUrl = (() => {
    const t = TRAIN_LABELS[plan.training];
    const titel = t ? `${t.slice(2)} — Coach G` : 'Coach G — dagplanning';
    const d = currentDate.replace(/-/g, '');
    const p = new URLSearchParams({
      action: 'TEMPLATE', text: titel, dates: `${d}/${d}`,
      details: 'Gepland in Coach G.',
    });
    return `https://calendar.google.com/calendar/render?${p}`;
  })();

  return (
    <div className="os-card" data-plan-editor style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)', flex: 1 }}>
          {formatNLLong(currentDate)} plannen
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--ghost)', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
        )}
      </div>

      <Rij label="Training">
        {['run', 'walk', 'swim', 'bike', 'core', 'rest', 'free'].map(k => (
          <Chip key={k} actief={plan.training === k} onClick={() => zet('training', k)}>
            {TRAIN_LABELS[k]}
          </Chip>
        ))}
      </Rij>

      <Rij label="Kracht">
        {[['snack', 'Strength snack'], ['30', 'Kracht 30'], ['45', 'Kracht 45']].map(([k, l]) => (
          <Chip key={k} actief={plan.kracht === k} onClick={() => zet('kracht', k)}>{l}</Chip>
        ))}
      </Rij>

      <Rij label="Beschermde blokken — niet vullen">
        {Object.entries(FREE_BLOCK_LABELS).map(([k, l]) => (
          <Chip key={k} kleur="var(--green)" actief={(plan.freeBlocks || []).includes(k)}
            onClick={() => wissel('freeBlocks', k)}>{l}</Chip>
        ))}
      </Rij>

      <Rij label="Werkblokken">
        {Object.entries(FREE_BLOCK_LABELS).map(([k, l]) => (
          <Chip key={k} kleur="var(--gold)" actief={(plan.workBlocks || []).includes(k)}
            onClick={() => wissel('workBlocks', k)}>{l}</Chip>
        ))}
      </Rij>

      <Rij label="Herstel">
        <Chip actief={!!plan.recovery} onClick={() => setPlan(p => ({ ...p, recovery: !p.recovery }))}>
          🌊 Herstelmoment inplannen
        </Chip>
      </Rij>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <button className="btn-primary" data-plan-bewaar onClick={bewaar}
          style={{ fontSize: 13 }}>Plan bewaren</button>
        {bewaard && (
          <span style={{ fontSize: 11.5, color: 'var(--sage)', fontWeight: 700 }}
            data-plan-bevestiging>
            Plan voor {formatNLLong(currentDate)} bewaard
          </span>
        )}
      </div>

      {/* De enige knop die de app verlaat, en hij zegt het erbij. */}
      <a href={agendaUrl} target="_blank" rel="noopener noreferrer" data-agenda-knop
        style={{ display: 'inline-block', marginTop: 10, fontSize: 11,
          color: 'var(--muted)', textDecoration: 'underline' }}>
        Toevoegen aan Google Agenda ↗
      </a>
    </div>
  );
}

// ── 5. Transition coach ─────────────────────────────────────────
const TRANSITION_TEMPLATES = [
  { emoji: '🏃', label: 'Voor training (5 min)' },
  { emoji: '🧘', label: 'Na training — cooling down (10 min)' },
  { emoji: '☕', label: 'Ochtendstart (10 min)' },
  { emoji: '🌙', label: 'Avondovergang (15 min)' },
  { emoji: '📞', label: 'Voor gesprek — focus (5 min)' },
  { emoji: '💤', label: 'Naar slaap (20 min schermen uit)' },
];

function Transitions({ currentDate }) {
  const [items, setItems] = useState(() => getTransitions(currentDate));
  useEffect(() => { setItems(getTransitions(currentDate)); }, [currentDate]);

  function persist(updated) { saveTransitions(currentDate, updated); setItems(updated); }
  function toggle(id) { persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i)); }
  function addTemplate(tpl) {
    if (items.some(i => i.label === tpl.label)) return;
    persist([...items, { id: Date.now().toString(), ...tpl, done: false }]);
  }
  function remove(id) { persist(items.filter(i => i.id !== id)); }

  const activeItems = items.filter(i => !i.done);
  const doneItems   = items.filter(i => i.done);

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 10, lineHeight: 1.5 }}>
        Voorbereiden → overgang → doen → herstellen. Buffermomenten voorkomen overgang-stress.
      </div>
      {activeItems.map(item => (
        <div key={item.id} className="os-check-item" onClick={() => toggle(item.id)}>
          <div className="os-check-box">{''}</div>
          <span style={{ fontSize: 13 }}>{item.emoji} {item.label}</span>
          <button onClick={e => { e.stopPropagation(); remove(item.id); }}
            style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer',
              marginLeft: 'auto', fontSize: 15, padding: '0 4px' }}>×</button>
        </div>
      ))}
      {doneItems.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 6, marginBottom: 6 }}>
          {doneItems.length} overgang{doneItems.length > 1 ? 'en' : ''} gedaan
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase', margin: '10px 0 6px' }}>Toevoegen</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {TRANSITION_TEMPLATES.filter(t => !items.some(i => i.label === t.label)).map(tpl => (
          <button key={tpl.label} className="os-toggle-chip" onClick={() => addTemplate(tpl)}
            style={{ fontSize: 12 }}>
            {tpl.emoji} {tpl.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 6. Compacte check-in ────────────────────────────────────────
// Vier primaire inputs + gewicht-shortcut. Alle detailvelden staan in
// Lichaam; deze schrijven naar exact dezelfde velden (één databron).
const SLAAP_OPTS   = [{ v: 0, label: 'Slecht' }, { v: 1, label: 'Matig' }, { v: 2, label: 'Goed' }, { v: 3, label: 'Top' }];
const ENERGY_OPTS  = [{ v: 0, label: 'Leeg' }, { v: 1, label: 'Laag' }, { v: 2, label: 'Goed' }, { v: 3, label: 'Hoog' }];
const HERSTEL_OPTS = [{ v: 0, label: 'Fris' }, { v: 1, label: 'Matig' }, { v: 2, label: 'PEM-achtig' }];
const KLACHT_CHIPS = [
  { id: 'symptom_pem',        label: 'PEM' },
  { id: 'symptom_exhaustion', label: 'Moeheid' },
  { id: 'symptom_brainfog',   label: 'Hersenmist' },
  { id: 'symptom_pain',       label: 'Pijn' },
];

// ── Rusthartslag ───────────────────────────────────────────────────
//
// Dit veld zat in de check-in, en dat leek genoeg. Het was het niet.
//
// De check-in staat namelijk alleen open zolang je die dag nog niets hebt
// ingevuld. Zij vult elke ochtend slaap en energie in, dus vanaf de eerste
// tik klapte het hele blok dicht tot "Check-in bijwerken" — en daarmee ook
// de rusthartslag. Niet verstopt achter een muisklik: werkelijk niet in de
// pagina aanwezig. Ze kon hem dus niet vinden omdat hij er niet stond.
//
// Een ochtendmeting hoort niet achter een uitklapper. Hij staat nu boven-
// aan Vandaag, altijd, op de dag die je hebt gekozen. Eén veld op het hele
// scherm, want twee velden met elk hun eigen invoer lopen uiteen zodra je
// in de ene typt en op de andere opslaat.
function Rusthartslag({ log, saveField, currentDate }) {
  const [hr, setHr] = useState('');
  const [melding, setMelding] = useState(null);
  const [bezig, setBezig] = useState(false);

  // Wat er al staat, staat er als waarde — niet als vraag.
  useEffect(() => { setHr(log?.hr_rest != null ? String(log.hr_rest) : ''); }, [log]);
  useEffect(() => { setMelding(null); }, [currentDate]);

  const dag = formatNLLong(currentDate || todayStr());
  const isVandaag = (currentDate || todayStr()) === todayStr();
  const bestaat = log?.hr_rest != null;

  async function bewaar() {
    const v = parseInt(hr, 10);
    if (isNaN(v) || v < 25 || v > 140) {
      setMelding({ fout: true, tekst: '⚠ Een rusthartslag tussen 25 en 140 bpm graag.' });
      return;
    }
    setBezig(true);
    try {
      const r = await saveField('hr_rest', v);
      const cloud = r?._cloud;
      if (cloud && cloud.ok === false) {
        setMelding({ fout: true,
          tekst: `⚠ ${v} bpm voor ${dag} staat op dit toestel, maar niet online (${cloud.reason}). Je invoer is niet kwijt.` });
      } else {
        setMelding({ fout: false,
          tekst: `${v} bpm opgeslagen voor ${dag}${cloud?.where === 'cloud' ? ' en online bewaard' : ''}` });
      }
    } catch (e) {
      setMelding({ fout: true,
        tekst: `⚠ Kon niet opslaan: ${e?.message || 'onbekende fout'}. Je invoer staat nog in het veld.` });
    } finally { setBezig(false); }
  }

  return (
    <div className="os-card" data-rusthartslag
      style={{ marginBottom: 10, borderLeft: `4px solid ${bestaat ? 'var(--sage)' : 'var(--border)'}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>
        Rusthartslag {isVandaag ? 'vanochtend' : `op ${dag}`} (bpm)
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="os-input-num" type="number" inputMode="numeric"
          data-veld="hr_rest" aria-label="Rusthartslag in bpm"
          placeholder="bpm" value={hr} onChange={e => setHr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && bewaar()} style={{ width: 84 }} />
        <button className="os-btn-save" onClick={bewaar} disabled={bezig}
          data-opslaan="hr_rest" style={{ padding: '7px 12px' }}>
          {bezig ? '…' : 'Sla op'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--ghost)' }}>
          {bestaat ? `staat nu op ${log.hr_rest} bpm` : 'nog niets voor deze dag'}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
        Gemeten vóór het opstaan. Telt mee in je herstelbeeld, je PEM-signalen
        en je cycluspatronen. Een eerdere dag vul je in met de pijltjes hierboven.
      </div>
      {melding && (
        <div data-hr-melding
          style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 8, padding: '7px 9px',
            borderRadius: 6, border: `1px solid ${melding.fout ? 'var(--rust)' : 'var(--sage)'}`,
            color: melding.fout ? 'var(--rust)' : 'var(--sage)' }}>
          {melding.tekst}
        </div>
      )}
    </div>
  );
}

function CompactCheckIn({ log, saveField, goToTab, currentDate }) {
  const [weight, setWeight] = useState('');
  const [melding, setMelding] = useState(null);
  const [bezig, setBezig] = useState(null);

  // De bestaande waarde van déze dag staat in het veld — niet als vraag maar
  // als wat er al is.
  useEffect(() => {
    setWeight(log?.weight != null ? String(log.weight) : '');
  }, [log]);

  // De bevestiging verdwijnt alleen bij het wisselen van dag.
  //
  // Hij hing eerst aan `log`, en dat is precies de waarde die door het
  // opslaan verandert: de melding werd gewist door de save die hem net had
  // gezet. Je zag dus nooit of het gelukt was — het scherm knipperde en was
  // weer leeg.
  useEffect(() => { setMelding(null); }, [currentDate]);

  // Eén plek die meldt wat er werkelijk gebeurde, mét de datum. Zonder die
  // datum weet je bij een historische invoer niet of hij goed geland is.
  async function bewaar(veld, waarde, naam) {
    setBezig(veld);
    try {
      const r = await saveField(veld, waarde);
      const cloud = r?._cloud;
      const dag = formatNLLong(currentDate || todayStr());
      if (cloud && cloud.ok === false) {
        setMelding({ fout: true,
          tekst: `⚠ ${naam} voor ${dag} staat op dit toestel, maar niet online (${cloud.reason}). Je invoer is niet kwijt.` });
      } else {
        setMelding({ fout: false, tekst: `${naam} voor ${dag} opgeslagen${cloud?.where === 'cloud' ? ' en online bewaard' : ''}` });
      }
    } catch (e) {
      setMelding({ fout: true,
        tekst: `⚠ ${naam} kon niet worden opgeslagen: ${e?.message || 'onbekende fout'}. Je invoer staat nog in het veld.` });
    } finally { setBezig(null); }
  }

  function saveWeight() {
    const v = parseFloat(weight);
    if (!isNaN(v) && v > 30 && v < 200) bewaar('weight', v, 'Gewicht');
  }

  // De rusthartslag stond hier ook. Hij staat nu bovenaan het scherm, buiten
  // deze uitklapper, omdat die dichtklapt zodra je iets hebt ingevuld.

  const Row = ({ label, value, opts, field }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div className="os-scale-btns">
        {opts.map(o => (
          <button key={o.v} className={`os-scale-btn ${value === o.v ? 'active' : ''}`}
            onClick={() => saveField(field, o.v)}>{o.label}</button>
        ))}
      </div>
    </div>
  );

  const klachten = KLACHT_CHIPS.filter(k => log?.[k.id]).length;

  return (
    <div>
      <Row label="Slaap" value={log?.sleep_quality} opts={SLAAP_OPTS} field="sleep_quality" />
      <Row label="Energie" value={log?.energy} opts={ENERGY_OPTS} field="energy" />
      <Row label="Herstelgevoel" value={log?.training_recovery} opts={HERSTEL_OPTS} field="training_recovery" />

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px',
          textTransform: 'uppercase', marginBottom: 5 }}>
          Klachten {klachten > 0 ? `(${klachten})` : ''}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {KLACHT_CHIPS.map(k => (
            <button key={k.id} className={`os-toggle-chip ${log?.[k.id] ? 'active' : ''}`}
              onClick={() => saveField(k.id, !log?.[k.id])} style={{ fontSize: 12 }}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px',
          textTransform: 'uppercase' }}>Gewicht</span>
        <input className="os-input-num" type="number" step="0.1" inputMode="decimal"
          placeholder={log?.weight ? String(log.weight) : 'kg'}
          value={weight} onChange={e => setWeight(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveWeight()} style={{ width: 78 }} />
        <button className="os-btn-save" onClick={saveWeight} style={{ padding: '7px 12px' }}>Sla op</button>
      </div>

      {melding && (
        <div data-checkin-melding
          style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 12, padding: '7px 9px',
            borderRadius: 6, border: `1px solid ${melding.fout ? 'var(--rust)' : 'var(--sage)'}`,
            color: melding.fout ? 'var(--rust)' : 'var(--sage)' }}>
          {melding.tekst}
        </div>
      )}

      <button className="os-toggle-chip" onClick={() => goToTab?.(2)}
        style={{ fontSize: 13, width: '100%', padding: '9px 0' }}>
        Meer registreren → Lichaam
      </button>
    </div>
  );
}

// ── Shutdown ────────────────────────────────────────────────────
function ShutdownProtocol({ currentDate }) {
  const [state, setState] = useState(() => getShutdownState(currentDate));
  useEffect(() => { setState(getShutdownState(currentDate)); }, [currentDate]);

  function toggle(i) {
    const upd = { ...state, [i]: !state[i] };
    saveShutdownState(currentDate, upd); setState(upd);
  }
  const STEPS = [
    'Alle openstaande zaken vastgelegd in Capture',
    'Topprioriteit voor morgen gekozen',
    'Agenda gecheckt voor morgen',
    'Ideeën geparkeerd',
    'Werkapps gesloten en notificaties uit',
  ];
  const allDone = STEPS.every((_, i) => state[i]);
  return (
    <div>
      {allDone && (
        <div style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)',
          borderRadius: 10, padding: '10px 14px', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          Werk is klaar. Goed gedaan.
        </div>
      )}
      {STEPS.map((step, i) => (
        <div key={i} className="os-check-item" onClick={() => toggle(i)}>
          <div className={`os-check-box ${state[i] ? 'checked' : ''}`}>{state[i] ? '✓' : ''}</div>
          <span style={{ fontSize: 14, color: state[i] ? 'var(--sub)' : 'var(--text)',
            textDecoration: state[i] ? 'line-through' : 'none' }}>{step}</span>
        </div>
      ))}
    </div>
  );
}

// ── Hoofdcomponent ──────────────────────────────────────────────
export default function VandaagScreen({ log, logs, currentDate, saveField, saveFields, shiftDay, setDate, isFuture, goToTab }) {
  const [inboxCount, setInboxCount] = useState(0);
  // Zodat het overzicht eronder meteen laat zien wat je net hebt ingesteld.
  const [planVersie, setPlanVersie] = useState(0);
  const [openCheckIn, setOpenCheckIn] = useState(false);
  const checkInRef = useRef(null);

  // De enige knop op het scherm moet ook echt ergens heen. Een primaire actie
  // die niets doet is erger dan geen knop: dan denk je dat je klaar bent.
  function handleCta(cta) {
    if (!cta) return;
    if (cta.kind === 'training') { goToTab?.(cta.tab); return; }
    if (cta.kind === 'checkin' || cta.kind === 'recovery') {
      setOpenCheckIn(true);
      requestAnimationFrame(() => {
        checkInRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // Executive focus is canoniek; de oude seizoenssleutel wordt alleen
  // nog gelezen als terugval, nooit overschreven.
  const season = (() => {
    const exec = loadExecutiveFocus();
    if (exec?.seasonName) return { name: exec.seasonName, primary: exec.primaryFocus };
    try { return JSON.parse(localStorage.getItem(SEASON_KEY) || 'null') || DEFAULT_SEASON; }
    catch { return DEFAULT_SEASON; }
  })();

  const { dayName, day, month } = formatNL(currentDate);
  const isToday = currentDate === todayStr();
  const maxFuture = (() => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  })();

  const coach = computeHeadCoach(log, logs, currentDate);
  const nextSession = computeNextSession(log, logs, currentDate);
  const hasData = log && Object.keys(log).filter(k => k !== 'date').length > 1;

  useEffect(() => {
    setInboxCount(loadTasks().filter(t => t.status === 'inbox').length);
  }, [currentDate]);

  // Overgangsmomenten alleen tonen als ze relevant zijn: er staat er al één,
  // of er is vandaag een training gepland waar een buffer bij hoort.
  const transitionsRelevant = getTransitions(currentDate).length > 0 ||
    (!!getDayPlan(currentDate).training && getDayPlan(currentDate).training !== 'rest');

  return (
    <div className="os-content">

      {/* Datum + seizoen */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="os-eyebrow">{dayName}</div>
          <h1 className="os-date-heading" style={{ marginBottom: 4 }}>{day} {month}</h1>
          <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{season.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button className="os-nav-arrow" onClick={() => shiftDay(-1)}
            title="Een dag terug" data-dag-terug>‹</button>
          {!isToday && (
            <button className="os-nav-arrow" style={{ width: 'auto', padding: '0 10px', fontSize: 11,
              color: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={() => shiftDay(0)}>vandaag</button>
          )}
          <button className="os-nav-arrow" onClick={() => shiftDay(1)} disabled={currentDate >= maxFuture}>›</button>
        </div>
      </div>

      {/* ── Een eerdere dag invullen ────────────────────────────
          De pijltjes deden dit al, maar niemand raadt dat: twee kleine
          driehoekjes naast een datum zien er uit als navigatie, niet als
          "hier kun je gisteren alsnog invullen". Daarom staat het er nu
          met zoveel woorden, met een datumkiezer die rechtstreeks springt.

          En zodra je op een andere dag staat, hoort dat onmiskenbaar te
          zijn — anders vul je per ongeluk gisteren in terwijl je denkt dat
          het vandaag is. */}
      {!isToday ? (
        <div className="os-card" data-andere-dag
          style={{ marginBottom: 10, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>
            Je vult {isFuture ? 'een toekomstige dag' : 'een eerdere dag'} in: {formatNLLong(currentDate)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
            Alles wat je hier invult komt op deze datum te staan en telt meteen
            mee in je trends en in de coachanalyse.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8,
            flexWrap: 'wrap' }}>
            <input type="date" className="os-input" value={currentDate} max={maxFuture}
              data-datumkiezer
              onChange={e => e.target.value && setDate?.(e.target.value)}
              style={{ width: 'auto', fontSize: 12 }} />
            <button onClick={() => shiftDay(0)}
              style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--green)', background: 'var(--card)',
                color: 'var(--green)', cursor: 'pointer' }}>
              terug naar vandaag
            </button>
          </div>
        </div>
      ) : (
        <button data-eerdere-dag onClick={() => shiftDay(-1)}
          style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none',
            border: 'none', padding: '0 0 10px', cursor: 'pointer',
            fontSize: 11.5, color: 'var(--muted)' }}>
          ← Een eerdere dag alsnog invullen
        </button>
      )}

      {/* De ochtendmeting staat vóór het advies, want het advies rekent
          ermee. En buiten elke uitklapper, want die klapt dicht. */}
      {!isFuture && (
        <Rusthartslag log={log} saveField={saveField} currentDate={currentDate} />
      )}

      {/* De herstelcheck staat boven het advies zolang hij open is: zonder
          die respons is elk advies een gok, en dat zegt de kaart eronder ook. */}
      {!isFuture && (
        <RecoveryCheck log={log} logs={logs} currentDate={currentDate} saveField={saveField} />
      )}

      {/* Eén besluit. Alles wat de losse coaches vinden is hierboven al
          tegen elkaar afgewogen; de gebruiker krijgt niet zeven meningen. */}
      <CockpitCard log={log} logs={logs} currentDate={currentDate}
        hasData={hasData} isFuture={isFuture}
        saveFields={saveFields} onCta={handleCta} />

      {/* Direct onder het besluit, ingeklapt: waar het op gebaseerd is en —
          net zo belangrijk — wat er níet in zat. Alleen voor dagen die al
          geweest zijn of vandaag; over een toekomstige dag valt niets te
          verantwoorden. */}
      {!isFuture && <WhyPanel asOf={currentDate} compact />}

      {/* De override staat bewust hier: onder het coachadvies, nooit erboven,
          en nooit als primaire knop zolang de coach rust adviseert. */}

      {/* Vier laden. Het waren er tien; dat las als een dashboard met een
          advies erboven in plaats van andersom. Wat hier staat is compleet —
          het staat alleen niet in de weg. */}
      {!isFuture && hasData && (
        <ExpandSection label="Training &amp; kracht">
          <ForecastMini log={log} logs={logs} currentDate={currentDate}
            coach={coach} nextSession={nextSession} />
          <StrengthToday log={log} logs={logs} currentDate={currentDate}
            runGate={coach?.gate} coach={coach}
            onSaved={() => saveFields?.({ strength_done: true })} />
          <LeverageCard log={log} logs={logs} currentDate={currentDate}
            coach={coach} runGate={coach?.gate}
            strengthGate={strengthDecision({ log: log || {}, logs, currentDate,
              runGate: coach?.gate, coach })} />
        </ExpandSection>
      )}

      {!isFuture && (
        <ExpandSection label="Mijn dag plannen">
          {/* Plannen gebeurt hier, niet in het weekscherm en niet in Google
              Agenda. Wat er al staat komt eronder. */}
          <PlanEditor currentDate={currentDate} onSaved={() => setPlanVersie(v => v + 1)} />
          <DagPlanning key={planVersie} currentDate={currentDate} log={log}
            nextSession={nextSession} goToTab={goToTab} />
          <Top3 currentDate={currentDate} />
          {transitionsRelevant && <Transitions currentDate={currentDate} />}
        </ExpandSection>
      )}

      {/* Zonder check-in is er geen advies, dus die staat open zolang
          er nog niets is ingevuld. */}
      {!isFuture && (hasData ? (
        <ExpandSection label="Check-in bijwerken" initialOpen={openCheckIn}>
          <div ref={checkInRef} />
          <CompactCheckIn log={log} saveField={saveField} goToTab={goToTab}
            currentDate={currentDate} />
          <div className="os-section-label">Type dag</div>
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
                textTransform: 'uppercase', marginBottom: 5 }}>{ENERGIE_SLOT_LABELS[i]}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ENERGIE_OPTS.map(opt => (
                  <button key={opt}
                    className={`os-toggle-chip ${log?.[key] === opt.toLowerCase() ? 'active green' : ''}`}
                    onClick={() => saveField(key, opt.toLowerCase())}
                    style={{ fontSize: 12, padding: '5px 10px' }}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
        </ExpandSection>
      ) : (
        <>
          <div className="os-section-label" ref={checkInRef}>Check-in</div>
          <div className="os-card">
            <CompactCheckIn log={log} saveField={saveField} goToTab={goToTab}
            currentDate={currentDate} />
          </div>
        </>
      ))}

      {!isFuture && (
        <ExpandSection label="Meer" badge={inboxCount}>
          <PhotoCheckpointCard currentDate={currentDate} goToTab={goToTab} />
          <AlivenessCard log={log} logs={logs} currentDate={currentDate}
            coach={coach} state={log?.adhd_state} />
          <CaptureCenter currentDate={currentDate}
            onChange={() => setInboxCount(loadTasks().filter(t => t.status === 'inbox').length)} />
          <ShutdownProtocol currentDate={currentDate} />
        </ExpandSection>
      )}

    </div>
  );
}
