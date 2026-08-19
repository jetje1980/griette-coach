import React, { useState, useRef, useEffect, useMemo } from 'react';
import { computeHeadCoach, computeNextSession } from './CoachAdvice';
import { nextSessionForecast } from '../forecast';
import StrengthToday from './StrengthToday';
import LeverageCard from './LeverageCard';
import AlivenessCard from './AlivenessCard';
import { strengthDecision } from '../strengthGate';
import { photoStore } from '../photoStore';
import { dueCheckpoint, checkpointPrompt } from '../bodyProgress';
import { fmtPace } from '../workouts';
import RecoveryCheck from './RecoveryCheck';
import CaptureCenter from './CaptureCenter';
import { USER } from '../config';
import { loadTasks, dueFollowUps, getDayActions, saveDayActions, completeTask } from '../tasks';
import { loadExecutiveFocus } from './LevenScreen';
import { recoveryScore, runBuildScore, shapeScore, capacityLevel } from '../performance';
import { todayLocal } from '../datetime';

// ── Performance strip ───────────────────────────────────────────
// Alleen percentages met een verdedigbare berekening; bij te weinig
// data een streepje in plaats van een verzonnen getal.
function PerformanceStrip({ log, logs, currentDate }) {
  const rec   = recoveryScore(logs, currentDate);
  const build = runBuildScore(logs);
  const shape = shapeScore(logs);
  const cap   = capacityLevel(log, logs, currentDate);

  const cells = [
    { label: 'Herstel',   value: rec.value != null ? `${rec.value}%` : '—',
      pct: rec.value, color: 'var(--sage)', sub: rec.value == null ? rec.reason : `${rec.n} dagen` },
    { label: 'Run build', value: `${build.value}%`, pct: build.value,
      color: 'var(--blue)', sub: build.label },
    { label: 'Shape',     value: shape.value != null ? `${shape.value}%` : '—',
      pct: shape.value, color: 'var(--rust)', sub: shape.value == null ? shape.reason : shape.label },
    { label: 'Capaciteit', value: cap.word, pct: null, color: cap.color, sub: null },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
      {cells.map(c => (
        <div key={c.label} style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '9px 7px' }}>
          <div style={{ fontSize: 9, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.4px',
            textTransform: 'uppercase', marginBottom: 3 }}>{c.label}</div>
          <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'var(--font-serif)',
            color: c.color, lineHeight: 1.1 }}>{c.value}</div>
          {c.pct != null && (
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, c.pct)}%`, background: c.color, borderRadius: 99 }} />
            </div>
          )}
          {c.sub && (
            <div style={{ fontSize: 9, color: 'var(--ghost)', marginTop: 3, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const NL_DAYS   = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const NL_MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus',
                   'september','oktober','november','december'];

function formatNL(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return { dayName: NL_DAYS[d.getDay()], day: d.getDate(), month: NL_MONTHS[d.getMonth()] };
}

const todayStr = todayLocal;
function getHour()  { return new Date().getHours(); }

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

// ── Beslissings-mapping ─────────────────────────────────────────
const VERDICT_MAP = {
  GREEN: { cls: 'v-green', word: 'Groen', sub: 'Klaar voor training', notToday: null },
  AMBER: { cls: '',        word: 'Amber', sub: 'Voorzichtig vandaag',
    notToday: { title: 'Zone C training', desc: 'Blijf in zone B of lager — herstel gaat voor intensiteit.' } },
  BLUE:  { cls: 'v-blue',  word: 'Blauw', sub: 'Hersteldag',
    notToday: { title: 'Intensieve training', desc: 'Lichte beweging is oké, prestatiegericht sporten niet.' } },
  RED:   { cls: 'v-red',   word: 'Rood',  sub: 'Rust is de training',
    notToday: { title: 'Alle training', desc: 'Je lichaam vraagt volledige rust. Morgen is er weer een kans.' } },
};

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

// ── Wat Nu? — exact één actie ───────────────────────────────────
// Weegt: readiness, tijd van de dag, trainingsstatus, Top 3, open taken,
// follow-ups van gedelegeerde taken en beschermde vrije tijd.
function computeWatNu({ log, coach, nextSession, currentDate, hasData }) {
  const hour = getHour();
  const decision = coach?.decision || 'AMBER';
  const trained = log?.run_done || log?.core_done || log?.strength_done;
  const plan = getDayPlan(currentDate);
  const freeBlocks = plan.freeBlocks || [];

  // Beschermde vrije tijd nu actief? Dan is niets doen de actie.
  const inFreeBlock =
    freeBlocks.includes('fullday') ||
    (freeBlocks.includes('morning') && hour >= 6 && hour < 12) ||
    (freeBlocks.includes('midday') && hour >= 12 && hour < 17) ||
    (freeBlocks.includes('evening') && hour >= 17 && hour < 23);

  if (!hasData) {
    return { emoji: '📊', action: 'Vul je ochtendcheck in',
      context: 'Slaap, energie en herstel — hieronder, duurt een minuut.', color: 'var(--gold)' };
  }

  if (inFreeBlock) {
    return { emoji: '🌿', action: 'Dit blok is beschermde vrije tijd',
      context: 'Geen werk, geen todo\'s, geen training. Dat is nu precies de bedoeling.', color: 'var(--green)' };
  }

  // Vertraagde herstelcheck openstaand
  if (coach?.pendingRecoveryCheck) {
    return { emoji: '🌅', action: 'Beantwoord je herstelcheck',
      context: 'Hoe reageerde je lichaam op de vorige training? Daarna geef ik je volgende sessie vrij.',
      color: 'var(--gold)' };
  }

  // Follow-up van gedelegeerde taak
  const followUp = dueFollowUps(currentDate)[0];
  if (followUp) {
    return { emoji: '🤝', action: `Check bij ${followUp.delegatedTo || 'de ander'}`,
      context: `"${followUp.title}" — je wilde hier vandaag op terugkomen.`, color: 'var(--gold)' };
  }

  // De rustdagpoort gaat vóór het trainingsadvies: zonder dit blok bleef
  // "Wat nu?" een run voorstellen terwijl de coach net rust voorschreef.
  const gate = coach?.gate;
  if (!trained && gate && gate.action !== 'RUN_TODAY' && hour < 21) {
    const COLOR = {
      STRENGTH_TODAY: '#7A5AA8', ACTIVE_RECOVERY: 'var(--blue)',
      FULL_REST: 'var(--rust)', WAIT_FOR_RESPONSE: 'var(--gold)',
    };
    return {
      emoji: gate.emoji,
      action: gate.action === 'STRENGTH_TODAY' ? 'Krachttraining in plaats van lopen'
        : gate.action === 'ACTIVE_RECOVERY' ? 'Wandelen — geen trainingsprikkel'
        : gate.action === 'WAIT_FOR_RESPONSE' ? 'Beantwoord eerst je herstelcheck'
        : 'Rust is vandaag de training',
      context: gate.blockers[0] || gate.headline,
      color: COLOR[gate.action] || 'var(--blue)',
    };
  }

  // Training als die vandaag past en nog niet gedaan is
  if (!trained && (decision === 'GREEN' || decision === 'AMBER') && hour < 19) {
    const label = nextSession?.run ? `T${nextSession.nr}` : 'je sessie';
    return {
      emoji: decision === 'GREEN' ? '🏃' : '🚶',
      action: decision === 'GREEN' ? `Training ${label} doen` : 'Aangepaste sessie of wandeling',
      context: nextSession?.run
        ? `${nextSession.run.description} · ${nextSession.run.duration} min`
        : 'Lichte beweging helpt je herstel vandaag.',
      color: decision === 'GREEN' ? 'var(--sage)' : 'var(--gold)',
    };
  }

  if (!trained && (decision === 'BLUE' || decision === 'RED')) {
    return { emoji: '🛌', action: 'Rust is vandaag de training',
      context: 'Je lichaam geeft een hersteldag aan. Geen prestatiedruk.', color: 'var(--blue)' };
  }

  // ── Ranking engine: kies EXACT één beste actie ──
  // Weegt beschikbare tijd, cognitieve energie, prioriteit en herkomst.
  if (hour < 21) {
    const energy = log?.energy;                       // 0-3 fysiek/mentaal
    const cognitiveOk = energy == null || energy >= 2;
    const minutesLeftToday = Math.max(0, (21 - hour) * 60);

    const candidates = [];
    getTop3(currentDate).filter(i => !i.done).forEach((t, idx) => {
      candidates.push({ title: t.text, source: 'Top 3', emoji: '🎯',
        score: 100 - idx * 5, needsFocus: true });
    });
    getDayActions(currentDate).filter(a => !a.done).forEach(a => {
      candidates.push({ title: a.title, source: 'Capture', emoji: '✅',
        score: 60, needsFocus: false });
    });

    if (candidates.length) {
      // Bij lage cognitieve energie eerst iets kleins, anders de zwaarste prioriteit
      candidates.sort((a, b) => cognitiveOk
        ? b.score - a.score
        : (a.needsFocus === b.needsFocus ? b.score - a.score : (a.needsFocus ? 1 : -1)));
      const pick = candidates[0];
      const block = !cognitiveOk ? 15 : Math.min(45, Math.max(20, minutesLeftToday));
      return {
        emoji: pick.emoji,
        action: pick.title,
        context: cognitiveOk
          ? `Uit ${pick.source}. Zet ${block} minuten opzij en doe alleen de eerste stap.`
          : `Je energie is laag — pak dit in een blok van ${block} minuten, of verplaats het bewust.`,
        color: 'var(--text)',
      };
    }
  }

  if (trained && hour < 14) {
    return { emoji: '💧', action: 'Herstel: water en eiwitten',
      context: 'Training gedaan — zorg voor herstel in de komende twee uur.', color: 'var(--sage)' };
  }

  if (hour >= 20) {
    return { emoji: '🌙', action: 'Shutdown starten',
      context: 'Sluit het werkblok af — morgen is ook een dag.', color: 'var(--blue)' };
  }

  const openInbox = loadTasks().filter(t => t.status === 'inbox').length;
  if (openInbox > 0) {
    return { emoji: '📥', action: `${openInbox} item${openInbox > 1 ? 's' : ''} in je inbox verwerken`,
      context: 'Geef elk item een bestemming: vandaag, deze week, later of klaar.', color: 'var(--text)' };
  }

  return { emoji: '☕', action: 'Niets dringends',
    context: 'Alles is verwerkt. Dit is ruimte, geen leegte.', color: 'var(--sub)' };
}

// ── Gedeelde UI ─────────────────────────────────────────────────
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

// ── 1. Decision Cockpit ─────────────────────────────────────────
// Eén geïntegreerd besluit: status, actie, reden, en wat je bewust NIET doet.
function DecisionCockpit({ coach, nextSession, hasData, isFuture }) {
  const v = VERDICT_MAP[coach?.decision] || VERDICT_MAP.AMBER;

  if (isFuture) {
    return (
      <div className="os-card" style={{ textAlign: 'center', padding: '26px 20px' }}>
        <div style={{ fontSize: 14, color: 'var(--sub)' }}>Toekomstige dag — nog geen advies.</div>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div className="os-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Nog geen data vandaag</div>
        <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
          Vul je check-in hieronder in — dan bereken ik je advies.
        </div>
      </div>
    );
  }

  // De rustdagpoort gaat vóór de sessiekeuze: staat lopen op slot, dan is
  // dát het besluit van vandaag — niet de sessie die het schema klaar had.
  const gate = coach.gate;
  const gated = gate && gate.action !== 'RUN_TODAY';

  const actie = gated
    ? `${gate.emoji} ${gate.label}`
    : nextSession?.state === 'SWAP'
      ? 'Wandelen of zwemmen — geen hardlopen'
      : nextSession?.run
        ? `T${nextSession.nr} — ${nextSession.run.description}`
        : coach.trainingDesc;

  return (
    <div className={`os-card os-verdict ${v.cls}`} style={{ marginBottom: 10 }}>
      {/* De kleur beschrijft je toestand; bij een gesloten poort mag de
          ondertitel niet alsnog "klaar voor training" beloven. */}
      <div className="os-v-status">
        {v.word} — {gated ? 'trainen staat op slot' : v.sub}
      </div>
      <div className="os-v-head">{actie}</div>

      {gated && (
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.45, marginBottom: 8 }}>
          {gate.headline}
          {gate.daysUntilRun > 0 && (
            <> Volgende loopmoment op zijn vroegst <strong>{gate.earliestRunDate.slice(5)}</strong>.</>
          )}
        </div>
      )}

      {coach.adaptive && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '4px 10px',
          fontSize: 12, fontWeight: 600, marginBottom: 8, marginTop: 2 }}>
          <span>{coach.adaptive.emoji}</span>
          <span>{coach.adaptive.label}</span>
        </div>
      )}

      <ul className="os-v-list">
        {(coach.why || []).slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
      </ul>

      {v.notToday && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10,
          paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ color: 'var(--rust)', fontWeight: 800, fontSize: 13, lineHeight: 1.4 }}>✕</span>
          <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700 }}>Niet vandaag: {v.notToday.title}.</span>{' '}
            <span style={{ color: 'var(--sub)' }}>{v.notToday.desc}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 1b. Kleine forecast — Vandaag blijft compact ────────────────
// Alleen de vier getallen die je vóór het vertrek wilt weten, plus hoe
// zeker ze zijn. De volledige onderbouwing staat onder Progressie → Run.
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
            ? `Verwachting — T${f.run.nr}, vanaf ${f.earliestDate.slice(5)}`
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
          ? `hartslag ${f.targetHR.low}–${f.targetHR.high}, boven ${f.targetHR.hardLimit} wandelen. Het tempo hierboven is een verwachting, geen doel.`
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

// ── 2. Wat Nu? ──────────────────────────────────────────────────
function WatNuCard({ watNu }) {
  if (!watNu) return null;
  return (
    <>
      <div className="os-section-label">Wat nu?</div>
      <div className="os-card" style={{ borderLeft: `4px solid ${watNu.color}`, paddingLeft: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 26, lineHeight: 1, marginTop: 2 }}>{watNu.emoji}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-serif)',
              color: 'var(--text)', marginBottom: 3, lineHeight: 1.25 }}>
              {watNu.action}
            </div>
            <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>{watNu.context}</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 3. Top 3 ────────────────────────────────────────────────────
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
      note: trainDone ? 'gedaan' : nextSession?.run ? `T${nextSession.nr} · ${nextSession.run.duration} min` : 'gepland',
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
        Nog niets gepland vandaag.{' '}
        <button onClick={() => goToTab?.(1)}
          style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, padding: 0 }}>
          Plan je week →
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

function CompactCheckIn({ log, saveField, goToTab }) {
  const [weight, setWeight] = useState('');
  useEffect(() => { setWeight(log?.weight ? String(log.weight) : ''); }, [log]);

  function saveWeight() {
    const v = parseFloat(weight);
    if (!isNaN(v) && v > 30 && v < 200) saveField('weight', v);
  }

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
export default function VandaagScreen({ log, logs, currentDate, saveField, saveFields, shiftDay, isFuture, goToTab }) {
  const [inboxCount, setInboxCount] = useState(0);

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
  const watNu = !isFuture ? computeWatNu({ log, coach, nextSession, currentDate, hasData }) : null;

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
          <button className="os-nav-arrow" onClick={() => shiftDay(-1)}>‹</button>
          {!isToday && (
            <button className="os-nav-arrow" style={{ width: 'auto', padding: '0 10px', fontSize: 11,
              color: 'var(--green)', borderColor: 'var(--green)' }}
              onClick={() => shiftDay(0)}>vandaag</button>
          )}
          <button className="os-nav-arrow" onClick={() => shiftDay(1)} disabled={currentDate >= maxFuture}>›</button>
        </div>
      </div>

      {/* Herstelcheck — alleen na een training gisteren */}
      {!isFuture && (
        <RecoveryCheck log={log} logs={logs} currentDate={currentDate} saveField={saveField} />
      )}

      {/* 1. Decision Cockpit + performance strip */}
      <DecisionCockpit coach={coach} nextSession={nextSession} hasData={hasData} isFuture={isFuture} />
      {!isFuture && hasData && (
        <ForecastMini log={log} logs={logs} currentDate={currentDate}
          coach={coach} nextSession={nextSession} />
      )}
      {/* Kracht is de tweede pijler en verschijnt hier alleen als hij
          vandaag daadwerkelijk aan de beurt is — één les, één knop. */}
      {!isFuture && <PhotoCheckpointCard currentDate={currentDate} goToTab={goToTab} />}

      {!isFuture && hasData && (
        <StrengthToday log={log} logs={logs} currentDate={currentDate}
          runGate={coach?.gate} coach={coach}
          onSaved={() => saveFields?.({ strength_done: true })} />
      )}
      {!isFuture && hasData && (
        <PerformanceStrip log={log} logs={logs} currentDate={currentDate} />
      )}

      {/* 2. Wat nu? */}
      <WatNuCard watNu={watNu} />

      {/* 2b. De grootste hefboom van vandaag — waarom juist dit.
             Bewust ná Wat Nu: dat blijft de enige echte volgende actie. */}
      {!isFuture && hasData && (
        <LeverageCard log={log} logs={logs} currentDate={currentDate}
          coach={coach} runGate={coach?.gate}
          strengthGate={strengthDecision({ log: log || {}, logs, currentDate,
            runGate: coach?.gate, coach })} />
      )}

      {/* 2c. Eén klein stukje van het leven dat je wilt, vandaag al. */}
      {!isFuture && hasData && (
        <AlivenessCard log={log} logs={logs} currentDate={currentDate}
          coach={coach} state={log?.adhd_state} />
      )}

      {/* 3. Top 3 */}
      {!isFuture && (
        <>
          <div className="os-section-label">Top 3 van vandaag</div>
          <div className="os-card"><Top3 currentDate={currentDate} /></div>
        </>
      )}

      {/* 4. Dagplanning */}
      {!isFuture && (
        <>
          <div className="os-section-label">Vandaag gepland</div>
          <div className="os-card">
            <DagPlanning currentDate={currentDate} log={log} nextSession={nextSession} goToTab={goToTab} />
          </div>
        </>
      )}

      {/* 5. Transition coach — alleen als relevant */}
      {!isFuture && transitionsRelevant && (
        <ExpandSection label="Overgangsmomenten">
          <Transitions currentDate={currentDate} />
        </ExpandSection>
      )}

      {/* 6. Compacte check-in */}
      {!isFuture && (
        <>
          <div className="os-section-label">Check-in</div>
          <div className="os-card">
            <CompactCheckIn log={log} saveField={saveField} goToTab={goToTab} />
          </div>
        </>
      )}

      {/* Achter progressive disclosure */}
      <ExpandSection label="Capture — inbox" badge={inboxCount}>
        <CaptureCenter currentDate={currentDate} onChange={() => setInboxCount(loadTasks().filter(t => t.status === 'inbox').length)} />
      </ExpandSection>

      {!isFuture && (
        <ExpandSection label="Dagtype &amp; energie per dagdeel">
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
          </div>
        </ExpandSection>
      )}

      {!isFuture && (
        <ExpandSection label="Werk afsluiten — shutdown">
          <ShutdownProtocol currentDate={currentDate} />
        </ExpandSection>
      )}
    </div>
  );
}
