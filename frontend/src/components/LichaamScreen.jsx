import React, { useState, useEffect, useCallback } from 'react';
import SubTabs from './SubTabs';
import { computeHeadCoach, computeNextSession } from './CoachAdvice';
import { USER, MEDS, SUPPLEMENTS, PRN_MEDS } from '../config';
import { RUNS } from '../data/runningSchema';
import {
  PROGRAMS, PATTERN_LABELS, suggestedProgram, lastPerformance, overloadAdvice,
  upsertStrengthSession, getSessionFor, loadStrengthSessions, exerciseHistory,
} from '../data/strengthSchema';
import { TRAINING_BLOCKS, getCurrentBlock, upcomingWeekFoci } from '../data/trainingBlocks';
import { api } from '../api';
import { store } from '../store';

// ── Constants ────────────────────────────────────────────────────
const SYMPTOMS_LIST = [
  { id: 'symptom_pem',        label: 'PEM-crash' },
  { id: 'symptom_exhaustion', label: 'Zware moeheid' },
  { id: 'symptom_breathless', label: 'Kortademig' },
  { id: 'symptom_brainfog',   label: 'Hersenmist' },
  { id: 'symptom_pain',       label: 'Spier/gewrichtspijn' },
  { id: 'symptom_headache',   label: 'Hoofdpijn' },
  { id: 'symptom_hayfever',   label: 'Hooikoorts' },
  { id: 'symptom_overdrive',  label: 'Overdrive' },
];

const MIGRAINE_TRIGGERS = [
  { id: 'hormonen',   label: 'Hormonen' },
  { id: 'slaap',      label: 'Slaap' },
  { id: 'inspanning', label: 'Inspanning' },
  { id: 'stress',     label: 'Stress' },
  { id: 'weer',       label: 'Weer' },
  { id: 'voeding',    label: 'Voeding' },
  { id: 'onbekend',   label: 'Onbekend' },
];

const CRAVING_OPTS = [
  { id: 'geen', label: 'Geen' }, { id: 'zoet', label: 'Zoet' },
  { id: 'zout', label: 'Zout' }, { id: 'alles', label: 'Alles' },
];

const TRAINING_ZONES = [
  { id: 'A', label: 'Zone A' }, { id: 'B', label: 'Zone B' },
  { id: 'C', label: 'Zone C' }, { id: 'rust', label: 'Rust' },
];

const SLAAPQ_OPTS = [
  { v: 0, label: 'Slecht' }, { v: 1, label: 'Wisselend' },
  { v: 2, label: 'Goed' }, { v: 3, label: 'Uitstekend' },
];
const SCALE3_OPTS = [
  { v: 0, label: 'Laag' }, { v: 1, label: 'Matig' },
  { v: 2, label: 'Goed' }, { v: 3, label: 'Hoog' },
];
const HERSTEL_OPTS = [
  { v: 0, label: 'Fris' }, { v: 1, label: 'Matig' }, { v: 2, label: 'PEM-achtig' },
];
const SLEEP_H_OPTS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

const CYCLUS_OPTS = [
  { id: 'menstruatie', label: 'Menstruatie' },
  { id: 'folliculair', label: 'Folliculair' },
  { id: 'ovulatie',    label: 'Ovulatie' },
  { id: 'luteaal',     label: 'Luteaal' },
  { id: 'weet-niet',   label: 'Weet niet' },
];

const READINESS_MAP = {
  GREEN: { word: 'Goed',  cls: 'good', sub: 'Klaar voor training vandaag' },
  AMBER: { word: 'Matig', cls: '',     sub: 'Voorzichtig bewegen' },
  BLUE:  { word: 'Rust',  cls: 'rest', sub: 'Herstel staat voorop' },
  RED:   { word: 'Laag',  cls: 'low',  sub: 'Volledige rust vandaag' },
};

const SUBTABS = ['Vandaag', 'Training', 'Herstel', 'Voeding', 'Cyclus', 'Maten', 'Medicatie'];

// ── Helpers ──────────────────────────────────────────────────────
function getNextRunNr(logs) {
  const done = new Set(
    Object.values(logs || {}).filter(l => l.run_done && l.run_session).map(l => Number(l.run_session))
  );
  for (let n = 1; n <= RUNS.length; n++) if (!done.has(n)) return n;
  return RUNS.length;
}

function ScaleBtns({ value, opts, onSelect }) {
  return (
    <div className="os-scale-btns">
      {opts.map(o => (
        <button key={o.v} className={`os-scale-btn ${value === o.v ? 'active' : ''}`}
          onClick={() => onSelect(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CheckItem({ checked, label, sub, onClick, colorClass = '' }) {
  return (
    <div className="os-check-item" onClick={onClick}>
      <div className={`os-check-box ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</div>
      <div>
        <div style={{ fontSize: 14, color: colorClass && checked ? `var(--${colorClass})` : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ghost)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionLabel({ children, style }) {
  return (
    <div className="os-section-label" style={{ marginTop: 12, ...style }}>{children}</div>
  );
}

// ── Ajovi tracker ────────────────────────────────────────────────
const AJOVI_KEY = 'gc_ajovi_next';
const AJOVI_HIST = 'gc_ajovi_history';

function nextFirstOfMonth(fromDate) {
  const d = new Date(fromDate);
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function AjoviTracker() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [next, setNext] = useState(() => localStorage.getItem(AJOVI_KEY) || null);
  const hist = (() => { try { return JSON.parse(localStorage.getItem(AJOVI_HIST) || '[]'); } catch { return []; } })();

  const daysTo = next ? Math.ceil((new Date(next) - new Date(todayStr)) / 86400000) : null;
  const isToday = daysTo === 0;
  const overdue = daysTo != null && daysTo < 0;

  function markGiven() {
    const given = next || todayStr;
    const newHist = [{ date: given, given: todayStr }, ...hist].slice(0, 12);
    localStorage.setItem(AJOVI_HIST, JSON.stringify(newHist));
    const newNext = nextFirstOfMonth(given);
    localStorage.setItem(AJOVI_KEY, newNext);
    setNext(newNext);
  }

  function setNextDate() {
    const d = window.prompt('Volgende Ajovi datum (JJJJ-MM-DD):', next || todayStr);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      localStorage.setItem(AJOVI_KEY, d);
      setNext(d);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
        Ajovi (migraine preventie)
      </div>
      {!next ? (
        <button className="os-toggle-chip" onClick={setNextDate}>Volgende prik instellen</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: overdue ? 'var(--alert)' : isToday ? 'var(--green)' : 'var(--text)' }}>
              {overdue ? `${Math.abs(daysTo)} dagen over tijd` : isToday ? 'Vandaag!' : `${daysTo} dagen`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{next}</div>
          </div>
          <button className="os-btn-save" style={{ marginLeft: 'auto' }} onClick={markGiven}>
            {isToday ? 'Gegeven ✓' : 'Vandaag gegeven'}
          </button>
        </div>
      )}
      {hist.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ghost)' }}>
          Laatste: {hist[0].date}
        </div>
      )}
    </div>
  );
}

// ── Krachtmodule ─────────────────────────────────────────────────
// Volwaardige krachttraining: programma A/B + strength snack, per oefening
// gewicht/sets/reps/RIR/voltooid, historie en progressive-overloadadvies.
function KrachtModule({ currentDate, saveFields, isFuture }) {
  const [program, setProgram] = useState(() => suggestedProgram());
  const [entries, setEntries] = useState({});
  const [savedMsg, setSavedMsg] = useState('');
  const [histOpen, setHistOpen] = useState(false);

  const prog = PROGRAMS[program] || PROGRAMS.A;
  const sessionsCount = loadStrengthSessions().filter(s => s.program !== 'snack').length;

  useEffect(() => {
    const existing = getSessionFor(currentDate, program);
    if (existing) {
      const map = {};
      for (const e of existing.exercises || []) map[e.id] = e;
      setEntries(map);
    } else {
      setEntries({});
    }
  }, [currentDate, program]);

  function upd(exId, field, val) {
    setEntries(prev => ({ ...prev, [exId]: { ...(prev[exId] || { id: exId }), id: exId, [field]: val } }));
  }

  function saveSession() {
    const exercises = prog.exercises.map(ex => {
      const e = entries[ex.id] || {};
      return {
        id: ex.id,
        weight: e.weight ?? '',
        sets: e.sets ?? ex.defaultSets,
        reps: e.reps ?? ex.defaultReps,
        rir: e.rir ?? null,
        done: !!e.done,
      };
    }).filter(e => e.done || e.weight || e.rir != null);

    if (!exercises.length) {
      setSavedMsg('Vink minstens één oefening af of vul iets in');
      setTimeout(() => setSavedMsg(''), 2500);
      return;
    }
    upsertStrengthSession({ id: `${currentDate}_${program}`, date: currentDate, program, exercises });
    saveFields({ core_done: true, strength_done: true, strength_program: program });
    setSavedMsg('Krachttraining opgeslagen ✓');
    setTimeout(() => setSavedMsg(''), 2500);
  }

  const doneCount = prog.exercises.filter(ex => entries[ex.id]?.done).length;

  return (
    <div>
      {/* Programma keuze */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['A', 'B', 'snack'].map(p => (
          <button key={p}
            className={`os-scale-btn ${program === p ? 'active' : ''}`}
            onClick={() => setProgram(p)}
            style={{ flex: 1, padding: '10px 4px' }}>
            <div style={{ fontSize: 16 }}>{PROGRAMS[p].emoji}</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>{p === 'snack' ? 'Snack' : `Programma ${p}`}</div>
          </button>
        ))}
      </div>

      {program === suggestedProgram() && program !== 'snack' && (
        <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>
          ✓ {prog.name} is aan de beurt (A en B wisselen af)
        </div>
      )}
      {prog.note && (
        <div style={{ fontSize: 12, color: 'var(--rust)', marginBottom: 10, lineHeight: 1.4 }}>
          ⚠️ {prog.note}
        </div>
      )}

      {/* Oefeningen */}
      {prog.exercises.map(ex => {
        const e = entries[ex.id] || {};
        const last = lastPerformance(ex.id, currentDate);
        return (
          <div key={ex.id} style={{ border: '1px solid var(--border)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 8,
            background: e.done ? 'var(--green-bg, rgba(42,122,79,0.06))' : 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div className={`os-check-box ${e.done ? 'checked' : ''}`} style={{ flexShrink: 0, marginTop: 2 }}
                onClick={() => !isFuture && upd(ex.id, 'done', !e.done)}>
                {e.done ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{ex.name}</span>
                  <span style={{ fontSize: 10, background: 'var(--border)', color: 'var(--sub)',
                    borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                    {PATTERN_LABELS[ex.pattern]}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 2 }}>{ex.cue}</div>
                <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 5, lineHeight: 1.45, fontWeight: 500 }}>
                  💡 {overloadAdvice(ex, last)}
                </div>

                {!isFuture && (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      {!ex.bodyweight && (
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--ghost)', marginBottom: 2 }}>kg</div>
                          <input className="os-input-num" type="number" step="0.5" inputMode="decimal"
                            style={{ width: 58 }}
                            value={e.weight ?? ''}
                            placeholder={last?.weight ? String(last.weight) : '–'}
                            onChange={ev => upd(ex.id, 'weight', ev.target.value)} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--ghost)', marginBottom: 2 }}>sets</div>
                        <input className="os-input-num" type="number" inputMode="numeric"
                          style={{ width: 48 }}
                          value={e.sets ?? ''}
                          placeholder={String(ex.defaultSets)}
                          onChange={ev => upd(ex.id, 'sets', ev.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--ghost)', marginBottom: 2 }}>{ex.repsLabel || 'reps'}</div>
                        <input className="os-input-num" type="number" inputMode="numeric"
                          style={{ width: 48 }}
                          value={e.reps ?? ''}
                          placeholder={String(ex.defaultReps)}
                          onChange={ev => upd(ex.id, 'reps', ev.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--ghost)', marginRight: 4 }}>RIR</span>
                      {[0, 1, 2, 3, 4].map(n => (
                        <button key={n}
                          className={`os-toggle-chip ${e.rir === n ? 'active green' : ''}`}
                          onClick={() => upd(ex.id, 'rir', e.rir === n ? null : n)}
                          style={{ width: 32, padding: '4px 0', textAlign: 'center', fontSize: 12 }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {!isFuture && (
        <button className="os-btn-save" style={{ width: '100%', marginTop: 4 }} onClick={saveSession}>
          {doneCount > 0 ? `Sla sessie op (${doneCount}/${prog.exercises.length} oefeningen)` : 'Sla sessie op'}
        </button>
      )}
      {savedMsg && (
        <div style={{ fontSize: 13, color: savedMsg.includes('✓') ? 'var(--green)' : 'var(--rust)',
          fontWeight: 600, textAlign: 'center', marginTop: 8 }}>
          {savedMsg}
        </div>
      )}

      {/* Historie per oefening */}
      <button className={`os-expand-btn ${histOpen ? 'open' : ''}`} style={{ marginTop: 12 }}
        onClick={() => setHistOpen(o => !o)}>
        Historie per oefening {sessionsCount > 0 ? `(${sessionsCount} sessies)` : ''}
        <span className="os-expand-arrow">↓</span>
      </button>
      {histOpen && (
        <div className="os-card" style={{ marginBottom: 8 }}>
          {[...PROGRAMS.A.exercises, ...PROGRAMS.B.exercises].map(ex => {
            const hist = exerciseHistory(ex.id, 5);
            if (!hist.length) return null;
            return (
              <div key={ex.id} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{ex.name}</div>
                {hist.map((h, i) => (
                  <div key={i} className="os-detail-row" style={{ fontSize: 12 }}>
                    <span className="os-dk">{h.date?.slice(5)}</span>
                    <span className="os-dv">
                      {h.weight ? `${h.weight} kg · ` : ''}{h.sets || '?'}×{h.reps || '?'}
                      {h.rir != null ? ` · RIR ${h.rir}` : ''}{h.done ? ' ✓' : ''}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
          {loadStrengthSessions().length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', padding: '8px 0' }}>
              Nog geen krachtsessies gelogd.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hardlooproadmap ──────────────────────────────────────────────
// A: huidig trainingsblok · B: deze week · C: komende 4 weken · D: 3–6 maanden.
// De roadmap toont richting; exacte sessies blijven adaptief.
function RunRoadmap({ logs, currentDate, nextSession }) {
  const NL_DAYS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
  const block = getCurrentBlock(currentDate);
  const foci = upcomingWeekFoci(currentDate, 4);

  const monday = (() => {
    const d = new Date(currentDate + 'T12:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d.toISOString().slice(0, 10);
  })();
  const addD = (ds, n) => {
    const d = new Date(ds + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Deze week: geplande + gedane looptrainingen
  const weekRuns = Array.from({ length: 7 }, (_, i) => {
    const date = addD(monday, i);
    const plan = (() => { try { return JSON.parse(localStorage.getItem(`gc_day_plan_${date}`) || '{}'); } catch { return {}; } })();
    const log = logs?.[date];
    const done = !!log?.run_done;
    const planned = plan.training === 'run';
    if (!done && !planned) return null;
    const d = new Date(date + 'T12:00:00');
    const isToday = date === currentDate;
    const doneRun = done && log.run_session ? RUNS[Number(log.run_session) - 1] : null;
    return { date, dayLabel: `${NL_DAYS[d.getDay()]} ${d.getDate()}`, done, planned, isToday, doneRun, isFuture: date > currentDate };
  }).filter(Boolean);

  const firstUpcoming = weekRuns.find(r => !r.done && (r.isToday || r.isFuture));

  return (
    <div style={{ marginTop: 16 }}>
      {/* A: Huidig trainingsblok */}
      <SectionLabel style={{ marginTop: 0 }}>Roadmap — huidig blok</SectionLabel>
      <div className="os-card" style={{ borderLeft: '4px solid var(--sage)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{block.emoji}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.5px' }}>{block.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{block.start} → {block.end}</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>Adaptatie: </span>{block.adaptation}
        </div>
        <div style={{ fontSize: 12, color: 'var(--rust)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>Bewust niet: </span>{block.not}
        </div>
      </div>

      {/* B: Deze week */}
      <SectionLabel>Deze week</SectionLabel>
      <div className="os-card">
        {weekRuns.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', padding: '6px 0' }}>
            Nog geen looptrainingen gepland deze week — plan ze in het Week-tabblad.
          </div>
        )}
        {weekRuns.map(r => (
          <div key={r.date} style={{ padding: '8px 0', borderBottom: '1px solid var(--divide)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44,
                color: r.isToday ? 'var(--rust)' : 'var(--text)' }}>{r.dayLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 600,
                color: r.done ? 'var(--green)' : r.isToday ? 'var(--rust)' : 'var(--sub)' }}>
                {r.done ? '✓ Gedaan' : r.isToday ? 'Vandaag' : 'Gepland'}
              </span>
            </div>
            {r.done && r.doneRun && (
              <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 3, paddingLeft: 52 }}>
                T{r.doneRun.nr}: {r.doneRun.description} · {r.doneRun.duration} min
              </div>
            )}
            {!r.done && firstUpcoming?.date === r.date && nextSession?.run && (
              <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 3, paddingLeft: 52, lineHeight: 1.5 }}>
                <div><span style={{ fontWeight: 700 }}>Sessie:</span> T{nextSession.nr} — {nextSession.run.description}</div>
                <div><span style={{ fontWeight: 700 }}>Doel:</span> {nextSession.run.goal}</div>
                <div>{nextSession.run.duration} min · run/walk · {nextSession.run.hrZone}</div>
              </div>
            )}
            {!r.done && firstUpcoming?.date === r.date && nextSession && !nextSession.run && (
              <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 3, paddingLeft: 52 }}>
                {nextSession.note}
              </div>
            )}
            {!r.done && firstUpcoming?.date !== r.date && (
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2, paddingLeft: 52 }}>
                Adaptief — wordt op de dag zelf bepaald op basis van herstel
              </div>
            )}
          </div>
        ))}
      </div>

      {/* C: Komende 4 weken */}
      <SectionLabel>Komende 4 weken</SectionLabel>
      <div className="os-card">
        {foci.map((f, i) => (
          <div key={f.monday} style={{ display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 0', borderBottom: i < foci.length - 1 ? '1px solid var(--divide)' : 'none' }}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', minWidth: 78 }}>
              {f.monday.slice(5)} – {f.sunday.slice(5)}
            </div>
            <span style={{ fontSize: 15 }}>{f.block?.emoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{f.block?.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* D: 3–6 maanden */}
      <SectionLabel>Blokken — komende maanden</SectionLabel>
      <div className="os-card">
        {TRAINING_BLOCKS.map((b, i) => {
          const isPast = b.end < currentDate;
          const isCurrent = currentDate >= b.start && currentDate <= b.end;
          return (
            <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '7px 0', opacity: isPast ? 0.45 : 1,
              borderBottom: i < TRAINING_BLOCKS.length - 1 ? '1px solid var(--divide)' : 'none' }}>
              <span style={{ fontSize: 15 }}>{b.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700,
                  color: isCurrent ? 'var(--sage)' : 'var(--text)' }}>
                  {b.name} {isCurrent ? '← nu' : ''}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{b.start} → {b.end}</div>
              </div>
              {i < TRAINING_BLOCKS.length - 1 && <span style={{ color: 'var(--ghost)', fontSize: 12, alignSelf: 'center' }}>→</span>}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 8, lineHeight: 1.5 }}>
          De roadmap toont richting — de exacte sessies blijven adaptief op basis van je herstel.
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function LichaamScreen({ log, logs, currentDate, saveField, saveFields, showFlash, isFuture }) {
  const [subTab, setSubTab] = useState(0);
  const [weight, setWeight] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [battStart, setBattStart] = useState('');
  const [battEnd, setBattEnd] = useState('');
  const [flash, setFlash] = useState('');
  const [measurements, setMeasurements] = useState([]);
  const [maten, setMaten] = useState({ waist: '', hip: '', chest: '', arm: '', thigh: '' });
  const [savingMaten, setSavingMaten] = useState(false);
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaActivities, setStravaActivities] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setWeight(log?.weight    ? String(log.weight)         : '');
    setBpSys (log?.bp_sys    ? String(log.bp_sys)         : '');
    setBpDia (log?.bp_dia    ? String(log.bp_dia)         : '');
    setBattStart(log?.battery_start != null ? String(log.battery_start) : '');
    setBattEnd  (log?.battery_end   != null ? String(log.battery_end)   : '');
  }, [log, currentDate]);

  useEffect(() => {
    store.getMeasurements().then(setMeasurements).catch(() => {});
  }, [currentDate]);

  useEffect(() => {
    api.stravaStatus().then(s => setStravaStatus(s)).catch(() => {});
    api.stravaActivities().then(a => setStravaActivities(a)).catch(() => {});
  }, []);

  const [trainMode, setTrainMode] = useState('run');

  const coach = computeHeadCoach(log, logs, currentDate);
  const r = READINESS_MAP[coach.decision] || READINESS_MAP.AMBER;
  // Adaptieve sessiekeuze — niet simpelweg "eerste niet-gedane sessie"
  const nextSession = computeNextSession(log, logs, currentDate);
  const nextRunNr = nextSession.nr ?? getNextRunNr(logs);
  const nextRun = nextSession.run || RUNS[getNextRunNr(logs) - 1];

  const yestDate = (() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  const yestTrained = logs?.[yestDate]?.run_done || logs?.[yestDate]?.core_done;
  const trainedToday = log?.run_done || log?.core_done;
  const medsChecked = MEDS.filter(m => log?.[m.id]).length;

  function flashMsg(msg) { setFlash(msg); setTimeout(() => setFlash(''), 2400); }

  function saveWeight()  {
    const v = parseFloat(weight);
    if (!isNaN(v) && v > 30 && v < 200) { saveField('weight', v); flashMsg('Gewicht opgeslagen'); }
  }
  function saveBP() {
    const s = parseInt(bpSys), d = parseInt(bpDia);
    if (!isNaN(s) && !isNaN(d)) { saveFields({ bp_sys: s, bp_dia: d }); flashMsg('Bloeddruk opgeslagen'); }
  }
  function saveBattery() {
    const f = {};
    const s = parseFloat(battStart), e = parseFloat(battEnd);
    if (!isNaN(s)) f.battery_start = s;
    if (!isNaN(e)) f.battery_end = e;
    if (Object.keys(f).length) { saveFields(f); flashMsg('Battery opgeslagen'); }
  }

  // ── run_session fix: always save run_session when marking run_done ──
  function saveRunDone(done) {
    if (done) {
      saveFields({ run_done: true, run_session: nextRunNr });
    } else {
      saveFields({ run_done: false, run_session: null });
    }
  }

  function toggleSymptom(id)    { saveField(id, !log?.[id]); }
  function toggleMed(id)        { saveField(id, !log?.[id]); }
  function toggleSupplement(id) {
    const arr = log?.supplements || [];
    saveField('supplements', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }
  function togglePrn(id) {
    const arr = log?.prn_meds || [];
    saveField('prn_meds', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }
  function toggleMigTrigger(id) {
    const arr = log?.migraine_triggers || [];
    saveField('migraine_triggers', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }

  async function saveMaten() {
    const vals = {};
    if (maten.waist)  vals.waist  = parseFloat(maten.waist);
    if (maten.hip)    vals.hip    = parseFloat(maten.hip);
    if (maten.chest)  vals.chest  = parseFloat(maten.chest);
    if (maten.arm)    vals.arm    = parseFloat(maten.arm);
    if (maten.thigh)  vals.thigh  = parseFloat(maten.thigh);
    if (!Object.keys(vals).length) return;
    setSavingMaten(true);
    try {
      await store.saveMeasurements(currentDate, vals);
      const updated = await store.getMeasurements();
      setMeasurements(updated);
      setMaten({ waist: '', hip: '', chest: '', arm: '', thigh: '' });
      flashMsg('Maten opgeslagen');
    } finally { setSavingMaten(false); }
  }

  async function syncStrava() {
    setSyncing(true);
    try {
      const res = await api.stravaSync();
      showFlash?.('🏃', `${res.count} activiteiten gesynchroniseerd`);
      const acts = await api.stravaActivities();
      setStravaActivities(acts);
    } catch { showFlash?.('❌', 'Sync mislukt'); }
    finally { setSyncing(false); }
  }

  async function connectStrava() {
    try {
      const { url } = await api.stravaAuth();
      window.open(url, '_blank');
    } catch (err) { showFlash?.('❌', err.message); }
  }

  // ── SUBTAB: VANDAAG ──────────────────────────────────────────
  function TabVandaag() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {flash && <div style={{ fontSize: 12, color: 'var(--green)', textAlign: 'center' }}>{flash}</div>}

        <div>
          <SectionLabel style={{ marginTop: 0 }}>Energie</SectionLabel>
          <ScaleBtns value={log?.energy} opts={SCALE3_OPTS} onSelect={v => saveField('energy', v)} />
        </div>
        <div>
          <SectionLabel style={{ marginTop: 0 }}>Herstelgevoel</SectionLabel>
          <ScaleBtns value={log?.training_recovery} opts={HERSTEL_OPTS} onSelect={v => saveField('training_recovery', v)} />
        </div>
        <div>
          <SectionLabel style={{ marginTop: 0 }}>Slaapkwaliteit</SectionLabel>
          <ScaleBtns value={log?.sleep_quality} opts={SLAAPQ_OPTS} onSelect={v => saveField('sleep_quality', v)} />
        </div>
        <div>
          <SectionLabel style={{ marginTop: 0 }}>Slaapuren</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SLEEP_H_OPTS.map(h => (
              <button key={h}
                className={`os-toggle-chip ${log?.sleep_hours === h ? 'active green' : ''}`}
                onClick={() => saveField('sleep_hours', h)}
                style={{ fontSize: 13 }}>
                {h}u
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel style={{ marginTop: 0 }}>Motivatie</SectionLabel>
          <ScaleBtns value={log?.motivatie} opts={SCALE3_OPTS} onSelect={v => saveField('motivatie', v)} />
        </div>

        <div style={{ borderTop: '1px solid var(--divide)', paddingTop: 16 }}>
          <SectionLabel style={{ marginTop: 0 }}>Gewicht</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input className="os-input" type="number" step="0.1" inputMode="decimal"
              placeholder={log?.weight ? `${log.weight} kg` : 'bijv. 61.8'}
              value={weight} onChange={e => setWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveWeight()} />
            <button className="os-btn-save" onClick={saveWeight}>Sla op</button>
          </div>

          <SectionLabel style={{ marginTop: 0 }}>Bloeddruk</SectionLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input className="os-input-num" type="number" inputMode="numeric"
              placeholder="sys" value={bpSys} onChange={e => setBpSys(e.target.value)} />
            <span style={{ color: 'var(--ghost)' }}>/</span>
            <input className="os-input-num" type="number" inputMode="numeric"
              placeholder="dia" value={bpDia} onChange={e => setBpDia(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--ghost)' }}>mmHg</span>
            <button className="os-btn-save" onClick={saveBP}>Sla op</button>
          </div>

          <SectionLabel style={{ marginTop: 0 }}>Body Battery</SectionLabel>
          <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 4 }}>Ochtend %</div>
              <input className="os-input-num" type="number" min="0" max="100" inputMode="numeric"
                placeholder="54" value={battStart} onChange={e => setBattStart(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 4 }}>Avond %</div>
              <input className="os-input-num" type="number" min="0" max="100" inputMode="numeric"
                placeholder="72" value={battEnd} onChange={e => setBattEnd(e.target.value)} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="os-btn-save" onClick={saveBattery}>Sla op</button>
            </div>
          </div>
        </div>

        <div>
          <SectionLabel style={{ marginTop: 0 }}>Notitie</SectionLabel>
          <textarea
            className="os-input"
            rows={3}
            placeholder="Schrijf iets op..."
            defaultValue={log?.note || ''}
            onChange={e => {
              clearTimeout(window._noteTimer);
              window._noteTimer = setTimeout(() => saveField('note', e.target.value), 1000);
            }}
            style={{ resize: 'vertical', fontFamily: 'var(--font)', lineHeight: 1.55, width: '100%' }}
          />
        </div>
      </div>
    );
  }

  // ── SUBTAB: TRAINING ─────────────────────────────────────────
  function TabTraining() {
    return (
      <div>
        {/* Hardlopen | Kracht */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[{ id: 'run', emoji: '🏃', label: 'Hardlopen' }, { id: 'kracht', emoji: '🏋️', label: 'Kracht' }].map(m => (
            <button key={m.id}
              className={`os-scale-btn ${trainMode === m.id ? 'active' : ''}`}
              onClick={() => setTrainMode(m.id)}
              style={{ flex: 1, padding: '10px 4px' }}>
              <div style={{ fontSize: 18 }}>{m.emoji}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>{m.label}</div>
            </button>
          ))}
        </div>

        {trainMode === 'kracht' && (
          <KrachtModule currentDate={currentDate} saveFields={saveFields} isFuture={isFuture} />
        )}

        {trainMode === 'run' && (<>
        {/* Adaptive training state */}
        {coach.adaptive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 14px', marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>{coach.adaptive.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                {coach.adaptive.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.4 }}>
                {coach.adaptive.desc}
              </div>
            </div>
          </div>
        )}

        {/* Volgende sessie — adaptief bepaald, niet simpelweg N+1 */}
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 26 }}>{nextSession.state === 'SWAP' ? '🔀' : '🏃'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {nextSession.state === 'SWAP' ? 'Vandaag — wissel sport' : `Volgende sessie — T${nextRunNr}/35`}
              </div>
              {nextSession.run ? (
                <>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    {nextSession.run.description}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.4 }}>
                    {nextSession.run.goal}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>
                    {nextSession.run.duration} min · {nextSession.run.hrZone}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                  Wandel 20–30 min rustig of zwem — geen hardlopen vandaag.
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 6, fontWeight: 600, lineHeight: 1.4 }}>
                {nextSession.note}
              </div>
            </div>
          </div>
        </div>

        {/* Run done — with run_session fix */}
        {!isFuture && (
          <>
            <SectionLabel style={{ marginTop: 0 }}>Vastleggen</SectionLabel>
            <CheckItem
              checked={!!log?.run_done}
              label="Hardlopen gedaan"
              sub={log?.run_session ? `T${log.run_session}/35 opgeslagen` : `Slaat op als T${nextRunNr}/35`}
              onClick={() => saveRunDone(!log?.run_done)}
            />

            <SectionLabel>Trainingszone</SectionLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {TRAINING_ZONES.map(z => (
                <button key={z.id}
                  className={`os-toggle-chip ${log?.training_zone === z.id ? 'active green' : ''}`}
                  onClick={() => saveField('training_zone', z.id)}>
                  {z.label}
                </button>
              ))}
            </div>

            {/* Post-run feedback */}
            {(trainedToday || yestTrained) && (
              <>
                {yestTrained && !trainedToday && (
                  <>
                    <SectionLabel>Reactie na gisteren</SectionLabel>
                    <CheckItem checked={!!log?.delayed_fatigue} label="Meer moeheid dan verwacht"
                      onClick={() => saveField('delayed_fatigue', !log?.delayed_fatigue)} />
                    <CheckItem checked={!!log?.delayed_brainfog} label="Hersenmist vandaag"
                      onClick={() => saveField('delayed_brainfog', !log?.delayed_brainfog)} />
                    <CheckItem checked={!!log?.delayed_breathless} label="Kortademig na training gisteren"
                      onClick={() => saveField('delayed_breathless', !log?.delayed_breathless)} />
                  </>
                )}
                {trainedToday && (
                  <>
                    <SectionLabel>Inspanning (RPE 1–10)</SectionLabel>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n}
                          className={`os-toggle-chip ${log?.training_rpe === n ? 'active' : ''}`}
                          onClick={() => saveField('training_rpe', n)}
                          style={{ width: 36, padding: '6px 0', textAlign: 'center' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <SectionLabel style={{ marginTop: 0 }}>Benen / spieren</SectionLabel>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                      {['fris','normaal','zwaar'].map(v => (
                        <button key={v}
                          className={`os-toggle-chip ${log?.training_legs === v ? 'active green' : ''}`}
                          onClick={() => saveField('training_legs', v)}>{v}</button>
                      ))}
                    </div>
                    <SectionLabel style={{ marginTop: 0 }}>Had je meer kunnen doen?</SectionLabel>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['ja','beetje','nee'].map(v => (
                        <button key={v}
                          className={`os-toggle-chip ${log?.training_could_more === v ? 'active green' : ''}`}
                          onClick={() => saveField('training_could_more', v)}>{v}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Roadmap */}
        <RunRoadmap logs={logs} currentDate={currentDate} nextSession={nextSession} />

        {/* Strava */}
        <SectionLabel>Strava</SectionLabel>
        <div className="os-card">
          {stravaStatus?.connected ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Gekoppeld</div>
                  {stravaStatus.athlete && (
                    <div style={{ fontSize: 12, color: 'var(--ghost)' }}>{stravaStatus.athlete}</div>
                  )}
                </div>
                <button className="os-btn-save" onClick={syncStrava} disabled={syncing}>
                  {syncing ? 'Sync…' : 'Synchroniseer'}
                </button>
              </div>
              {stravaActivities.slice(0, 5).map(act => {
                const inZone = act.average_heartrate >= USER.hrZone.low && act.average_heartrate <= USER.hrZone.high;
                return (
                  <div key={act.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--divide)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{act.name}</div>
                    <div style={{ color: 'var(--ghost)' }}>
                      {act.start_date?.slice(0, 10)} · {act.distance ? `${(act.distance/1000).toFixed(1)} km` : ''} ·{' '}
                      {act.average_heartrate && (
                        <span style={{ color: inZone ? 'var(--green)' : 'var(--rust)', fontWeight: 700 }}>
                          ♥ {Math.round(act.average_heartrate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <button className="os-toggle-chip" style={{ marginTop: 10, fontSize: 12 }}
                onClick={() => api.stravaDisconnect().then(() => setStravaStatus({ connected: false })).catch(() => {})}>
                Ontkoppelen
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 12, lineHeight: 1.5 }}>
                Koppel Strava om activiteiten automatisch te importeren en als sessie te registreren.
              </div>
              <button className="os-btn-save" style={{ background: '#FC4C02' }} onClick={connectStrava}>
                Koppel Strava
              </button>
            </div>
          )}
        </div>
        </>)}
      </div>
    );
  }

  // ── SUBTAB: HERSTEL ──────────────────────────────────────────
  function TabHerstel() {
    const activeSymptoms = SYMPTOMS_LIST.filter(s => log?.[s.id]).length;
    const pemSignals = [
      log?.delayed_fatigue, log?.delayed_brainfog, log?.delayed_breathless, log?.symptom_pem
    ].filter(Boolean).length;

    return (
      <div>
        {/* Coach advice */}
        <div className="os-card" style={{ borderLeft: `4px solid var(--${coach.decision === 'GREEN' ? 'green' : coach.decision === 'BLUE' ? 'blue' : coach.decision === 'RED' ? 'alert' : 'gold'})`, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            {r.word} — {r.sub}
          </div>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
            {coach.why?.[0]}
          </div>
        </div>

        {pemSignals > 0 && (
          <div style={{ background: 'var(--alert-l)', border: '1px solid var(--alert)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 14, fontSize: 13, color: 'var(--alert)', fontWeight: 600 }}>
            {pemSignals} PEM-signalen gedetecteerd — volledige rust heeft prioriteit
          </div>
        )}

        <SectionLabel style={{ marginTop: 0 }}>Symptomen vandaag</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {SYMPTOMS_LIST.map(s => (
            <button key={s.id}
              className={`os-toggle-chip ${log?.[s.id] ? 'active' : ''}`}
              onClick={() => toggleSymptom(s.id)}
              style={{ fontSize: 13 }}>
              {s.label}
            </button>
          ))}
        </div>

        <SectionLabel style={{ marginTop: 0 }}>ADHD &amp; pacing</SectionLabel>
        <CheckItem checked={!!log?.adhd_break} label="Bewust pauze genomen"
          onClick={() => saveField('adhd_break', !log?.adhd_break)} />
        <CheckItem checked={!!log?.adhd_one_thing} label="Één ding tegelijk gedaan"
          onClick={() => saveField('adhd_one_thing', !log?.adhd_one_thing)} />
        <CheckItem checked={!!log?.adhd_overwhelmed} label="Overprikkeld vandaag"
          colorClass="alert" onClick={() => saveField('adhd_overwhelmed', !log?.adhd_overwhelmed)} />

        <SectionLabel>Migraine</SectionLabel>
        <CheckItem checked={!!log?.migraine} label="Migraine vandaag"
          onClick={() => saveField('migraine', !log?.migraine)} />
        {log?.migraine && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ghost)', marginBottom: 6 }}>Triggers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MIGRAINE_TRIGGERS.map(t => (
                <button key={t.id}
                  className={`os-toggle-chip ${(log?.migraine_triggers || []).includes(t.id) ? 'active' : ''}`}
                  onClick={() => toggleMigTrigger(t.id)}
                  style={{ fontSize: 13 }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {yestTrained && (
          <>
            <SectionLabel>Delayed response (na gisterse training)</SectionLabel>
            <CheckItem checked={!!log?.delayed_fatigue} label="Meer moeheid dan verwacht"
              onClick={() => saveField('delayed_fatigue', !log?.delayed_fatigue)} />
            <CheckItem checked={!!log?.delayed_brainfog} label="Hersenmist"
              onClick={() => saveField('delayed_brainfog', !log?.delayed_brainfog)} />
            <CheckItem checked={!!log?.delayed_breathless} label="Kortademig"
              onClick={() => saveField('delayed_breathless', !log?.delayed_breathless)} />
          </>
        )}
      </div>
    );
  }

  // ── SUBTAB: VOEDING ──────────────────────────────────────────
  function TabVoeding() {
    return (
      <div>
        <SectionLabel style={{ marginTop: 0 }}>Water (glazen)</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {[1,2,3,4,5,6,7,8].map(n => (
            <button key={n}
              className={`os-toggle-chip ${(log?.water_glasses || 0) >= n ? 'active green' : ''}`}
              onClick={() => saveField('water_glasses', (log?.water_glasses || 0) >= n ? n-1 : n)}
              style={{ width: 40, padding: '7px 0', textAlign: 'center', fontSize: 15, fontFamily: 'var(--font-serif)' }}>
              {n}
            </button>
          ))}
        </div>

        <SectionLabel style={{ marginTop: 0 }}>Eiwit per maaltijd</SectionLabel>
        {['Ontbijt met eiwit', 'Lunch met eiwit', 'Diner met eiwit'].map((label, i) => {
          const key = `eiwit_${i}`;
          return <CheckItem key={key} checked={!!log?.[key]} label={label} onClick={() => saveField(key, !log?.[key])} />;
        })}

        <SectionLabel>Craving</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CRAVING_OPTS.map(o => (
            <button key={o.id}
              className={`os-toggle-chip ${log?.craving === o.id ? 'active' : ''}`}
              onClick={() => saveField('craving', o.id)}>
              {o.label}
            </button>
          ))}
        </div>

        <SectionLabel style={{ marginTop: 0 }}>Eetgedrag</SectionLabel>
        <CheckItem checked={!!log?.late_eating} label="Laat gegeten (na 20u)"
          onClick={() => saveField('late_eating', !log?.late_eating)} />
        <CheckItem checked={!!log?.emotional_eating} label="Emotie-eten"
          onClick={() => saveField('emotional_eating', !log?.emotional_eating)} />
      </div>
    );
  }

  // ── SUBTAB: CYCLUS ───────────────────────────────────────────
  function TabCyclus() {
    const CYCLUS_INFO = {
      menstruatie: 'Dag 1–5: lager energieniveau normaal. Lichte beweging is OK. Voorzichtig met intensiteit.',
      folliculair: 'Dag 6–13: energie stijgt. Goed moment voor iets zwaarder trainingsblok.',
      ovulatie: 'Dag 14–16: piek-energie. Beste moment voor intensere training indien readiness groen.',
      luteaal: 'Dag 17–28: energie kan dalen. Herstel-first. PMS-klachten mogelijk.',
      'weet-niet': 'Cyclusfase onbekend — gebruik readiness als primaire gids.',
    };
    const info = CYCLUS_INFO[log?.cycle_phase];

    return (
      <div>
        <SectionLabel style={{ marginTop: 0 }}>Cyclusfase</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {CYCLUS_OPTS.map(o => (
            <button key={o.id}
              className={`os-toggle-chip ${log?.cycle_phase === o.id ? 'active green' : ''}`}
              onClick={() => saveField('cycle_phase', o.id)}
              style={{ fontSize: 13 }}>
              {o.label}
            </button>
          ))}
        </div>

        {info && (
          <div className="os-card" style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 14 }}>
            {info}
          </div>
        )}

        <SectionLabel>Hormonale klachten</SectionLabel>
        {['Opvliegers','Stemmingswisselingen','Slaapproblemen','Gewrichtsklachten','Breinmist (meno)'].map((label, i) => {
          const key = `hormoon_${i}`;
          return <CheckItem key={key} checked={!!log?.[key]} label={label} onClick={() => saveField(key, !log?.[key])} />;
        })}

        <SectionLabel>Ajovi</SectionLabel>
        <AjoviTracker />
      </div>
    );
  }

  // ── SUBTAB: MATEN ────────────────────────────────────────────
  function TabMaten() {
    const MAAT_FIELDS = [
      { key: 'waist', label: 'Taille' },
      { key: 'hip',   label: 'Heup' },
      { key: 'chest', label: 'Borst' },
      { key: 'arm',   label: 'Arm' },
      { key: 'thigh', label: 'Dij' },
    ];
    const lastMeting = measurements[0];

    return (
      <div>
        <SectionLabel style={{ marginTop: 0 }}>Nieuwe meting (cm)</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {MAAT_FIELDS.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 4 }}>
                {f.label} {lastMeting?.[f.key] ? `(was ${lastMeting[f.key]})` : ''}
              </div>
              <input className="os-input" type="number" step="0.5" inputMode="decimal"
                placeholder="cm"
                value={maten[f.key]}
                onChange={e => setMaten(prev => ({ ...prev, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <button className="os-btn-save" onClick={saveMaten} disabled={savingMaten}>
          {savingMaten ? 'Opslaan…' : 'Maten opslaan'}
        </button>

        {measurements.length > 0 && (
          <>
            <SectionLabel>Geschiedenis</SectionLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--ghost)', fontWeight: 600 }}>Datum</th>
                    {MAAT_FIELDS.map(f => (
                      <th key={f.key} style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--ghost)', fontWeight: 600 }}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 8).map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--divide)' }}>
                      <td style={{ padding: '7px 4px', color: 'var(--sub)' }}>{m.date?.slice(5)}</td>
                      {MAAT_FIELDS.map(f => (
                        <td key={f.key} style={{ textAlign: 'right', padding: '7px 4px', fontWeight: m[f.key] ? 600 : 400 }}>
                          {m[f.key] ? `${m[f.key]}` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── SUBTAB: MEDICATIE ────────────────────────────────────────
  function TabMedicatie() {
    return (
      <div>
        <SectionLabel style={{ marginTop: 0 }}>
          Dagelijks ({medsChecked}/{MEDS.length} ingenomen)
        </SectionLabel>
        {MEDS.map(med => (
          <CheckItem key={med.id}
            checked={!!log?.[med.id]}
            label={med.label}
            sub={med.detail}
            onClick={() => toggleMed(med.id)} />
        ))}

        <SectionLabel>Zo nodig</SectionLabel>
        {PRN_MEDS.map(med => (
          <CheckItem key={med.id}
            checked={(log?.prn_meds || []).includes(med.id)}
            label={med.label}
            sub={med.detail}
            onClick={() => togglePrn(med.id)} />
        ))}

        <SectionLabel>Supplementen</SectionLabel>
        {SUPPLEMENTS.map(sup => (
          <CheckItem key={sup.id}
            checked={(log?.supplements || []).includes(sup.id)}
            label={sup.label}
            sub={sup.detail}
            onClick={() => toggleSupplement(sup.id)} />
        ))}
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <div>
      {/* Readiness header */}
      <div className="os-readiness" style={{ borderRadius: 0, margin: 0, border: 'none', borderBottom: '1px solid var(--divide)' }}>
        <div className="os-readiness-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--ghost)', marginBottom: 4 }}>
          Herstelstatus vandaag
        </div>
        <div className={`os-readiness-word ${r.cls}`} style={{ fontSize: 38, marginBottom: 4 }}>{r.word}</div>
        <div className="os-readiness-sub">{r.sub}</div>
      </div>

      {/* Subtabs */}
      <SubTabs tabs={SUBTABS} active={subTab} onChange={setSubTab} />

      {/* Tab content — als functie-aanroep, niet als <Component/>: de nested
          functies krijgen elke render een nieuwe identiteit en zouden anders
          hun hele subtree (incl. KrachtModule-state) remounten. */}
      <div className="os-content" style={{ paddingTop: 16 }}>
        {subTab === 0 && TabVandaag()}
        {subTab === 1 && TabTraining()}
        {subTab === 2 && TabHerstel()}
        {subTab === 3 && TabVoeding()}
        {subTab === 4 && TabCyclus()}
        {subTab === 5 && TabMaten()}
        {subTab === 6 && TabMedicatie()}
      </div>
    </div>
  );
}
