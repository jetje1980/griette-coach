import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SubTabs from './SubTabs';
import { computeHeadCoach, computeNextSession } from './CoachAdvice';
import { USER, MEDS, SUPPLEMENTS, PRN_MEDS } from '../config';
import { RUNS } from '../data/runningSchema';
import {
  PROGRAMS, PATTERN_LABELS, suggestedProgram, lastPerformance, overloadAdvice,
  upsertStrengthSession, getSessionFor, loadStrengthSessions, exerciseHistory,
  saveStrengthSessions,
} from '../data/strengthSchema';
import { TRAINING_BLOCKS, getCurrentBlock, upcomingWeekFoci, blockExpectation } from '../data/trainingBlocks';
import RunCoach from './RunCoach';
import SessionLibrary from './SessionLibrary';
import WorkoutForm from './WorkoutForm';
import StrengthModes from './StrengthModes';
import RecoveryCheck from './RecoveryCheck';
import CycleHistory from './CycleHistory';
import { workoutOn, loadWorkouts, computePace } from '../workouts';
import { strava } from '../integrations';
import { store } from '../store';
import { todayLocal, startOfWeek } from '../datetime';
import { weekTrainingRows, nextOfferDate, STATUS_META } from '../trainingDay';
import { ingestStravaWorkouts } from '../stravaIngest';
import ExerciseTechnique from './ExerciseTechnique';
import ActivityList from './ActivityList';

import { easyHrLine } from '../hrModel';
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

const BLEEDING_OPTS = [
  { id: 'geen',     label: 'Geen' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'licht',    label: 'Licht' },
  { id: 'normaal',  label: 'Normaal' },
  { id: 'zwaar',    label: 'Zwaar' },
];

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

// Lichaam is de detailhub voor alles fysiek. Training staat vooraan omdat
// dat het vaakst gebruikt wordt; de dagelijkse check-in zit in Body samen
// met de metingen (gewicht, bloeddruk, maten) — één plek per functie.
const SUBTABS = ['Training', 'Herstel', 'Body', 'Cyclus', 'Voeding', 'Medicatie'];

// ── Helpers ──────────────────────────────────────────────────────
function getNextRunNr(logs) {
  const done = Object.values(logs || {})
    .filter(l => l.run_done && l.run_session).map(l => Number(l.run_session));
  if (!done.length) return 1;
  return Math.min(RUNS.length, Math.max(...done) + 1);
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

// Historie-items: { id, date, dose, note, sideEffect, migraineContext }
// Ondersteunt historische backfill, wijzigen en verwijderen.
function loadAjoviHistory() {
  try {
    return JSON.parse(localStorage.getItem(AJOVI_HIST) || '[]')
      .map((h, i) => ({ id: h.id || `aj_${h.date}_${i}`, dose: '', note: '', ...h }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch { return []; }
}
function saveAjoviHistory(arr) {
  localStorage.setItem(AJOVI_HIST, JSON.stringify(
    [...arr].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  ));
}

function AjoviTracker() {
  const todayStr = todayLocal();
  const [next, setNext] = useState(() => localStorage.getItem(AJOVI_KEY) || null);
  const [history, setHistory] = useState(loadAjoviHistory);
  const [form, setForm] = useState(null);   // { id?, date, dose, note, sideEffect }
  const [msg, setMsg] = useState('');
  const hist = history;

  function persistHist(arr) { saveAjoviHistory(arr); setHistory(loadAjoviHistory()); }
  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2500); }

  function saveEntry() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) return;
    const entry = {
      id: form.id || `aj_${Date.now()}`,
      date: form.date,
      dose: form.dose || '',
      note: form.note || '',
      sideEffect: form.sideEffect || '',
      given: form.given || form.date,
    };
    persistHist([entry, ...history.filter(h => h.id !== entry.id)]);
    setForm(null);
    flash(form.id ? 'Injectie bijgewerkt' : 'Injectie toegevoegd');
  }

  function removeEntry(id) {
    if (!window.confirm('Deze injectie verwijderen?')) return;
    persistHist(history.filter(h => h.id !== id));
    flash('Verwijderd');
  }

  const daysTo = next ? Math.ceil((new Date(next) - new Date(todayStr)) / 86400000) : null;
  const isToday = daysTo === 0;
  const overdue = daysTo != null && daysTo < 0;

  function markGiven() {
    const given = next || todayStr;
    persistHist([{ id: `aj_${Date.now()}`, date: given, given: todayStr, dose: '', note: '' }, ...history]);
    const newNext = nextFirstOfMonth(given);
    localStorage.setItem(AJOVI_KEY, newNext);
    setNext(newNext);
    flash('Injectie geregistreerd');
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
      {msg && <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginTop: 8 }}>{msg}</div>}

      {/* Historie — inclusief historische injecties toevoegen */}
      <div style={{ marginTop: 12 }}>
        {hist.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.4px', marginBottom: 4 }}>Historie ({hist.length})</div>
        )}
        {hist.slice(0, 24).map(h => (
          <div key={h.id} className="os-detail-row" style={{ fontSize: 12 }}>
            <span className="os-dk">
              {h.date}
              {h.dose ? <span style={{ color: 'var(--ghost)' }}> · {h.dose}</span> : null}
              {h.note ? <span style={{ color: 'var(--ghost)' }}> · {String(h.note).slice(0, 22)}</span> : null}
              {h.sideEffect ? <span style={{ color: 'var(--rust)' }}> · {String(h.sideEffect).slice(0, 18)}</span> : null}
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setForm({ id: h.id, date: h.date, dose: h.dose || '', note: h.note || '', sideEffect: h.sideEffect || '' })}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
              <button onClick={() => removeEntry(h.id)}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </span>
          </div>
        ))}

        {form ? (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--divide)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <input type="date" className="os-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              <input className="os-input" placeholder="dosis (optioneel)" value={form.dose}
                onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
            </div>
            <input className="os-input" placeholder="notitie (optioneel)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ marginBottom: 6 }} />
            <input className="os-input" placeholder="bijwerking (optioneel)" value={form.sideEffect}
              onChange={e => setForm(f => ({ ...f, sideEffect: e.target.value }))} style={{ marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="os-btn-save" onClick={saveEntry}>{form.id ? 'Bijwerken' : 'Toevoegen'}</button>
              <button className="os-toggle-chip" onClick={() => setForm(null)}>Annuleer</button>
            </div>
          </div>
        ) : (
          <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 6 }}
            onClick={() => setForm({ date: todayStr, dose: '', note: '', sideEffect: '' })}>
            + Injectie toevoegen (ook eerdere datum)
          </button>
        )}
      </div>
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
  const [sessionDate, setSessionDate] = useState(currentDate);

  const prog = PROGRAMS[program] || PROGRAMS.A;
  const sessionsCount = loadStrengthSessions().filter(s => s.program !== 'snack').length;

  useEffect(() => { setSessionDate(currentDate); }, [currentDate]);

  useEffect(() => {
    const existing = getSessionFor(sessionDate, program);
    if (existing) {
      const map = {};
      for (const e of existing.exercises || []) map[e.id] = e;
      setEntries(map);
    } else {
      setEntries({});
    }
  }, [sessionDate, program]);

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
    upsertStrengthSession({ id: `${sessionDate}_${program}`, date: sessionDate, program, exercises });
    // Daglog van de sessiedatum markeren (ook bij backdaten)
    store.saveLog(sessionDate, { core_done: true, strength_done: true, strength_program: program })
      .then(() => saveFields?.({}))
      .catch(() => {});
    setSavedMsg(`Krachttraining opgeslagen ✓ (${sessionDate})`);
    setTimeout(() => setSavedMsg(''), 2500);
  }

  function deleteSession(date, prog2) {
    if (!window.confirm(`Krachtsessie van ${date} verwijderen? Historie wordt herberekend.`)) return;
    saveStrengthSessions(loadStrengthSessions().filter(s => !(s.date === date && s.program === prog2)));
    setSavedMsg('Sessie verwijderd');
    setTimeout(() => setSavedMsg(''), 2000);
    setHistOpen(h => h); // re-render
    setEntries(e => ({ ...e }));
  }

  const doneCount = prog.exercises.filter(ex => entries[ex.id]?.done).length;

  return (
    <div>
      {/* Sessiedatum — ook een oude sessie kan gewoon worden ingevoerd */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.4px' }}>Datum</span>
        <input type="date" className="os-input" value={sessionDate}
          onChange={e => setSessionDate(e.target.value)} style={{ flex: 1 }} />
        {sessionDate !== currentDate && (
          <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>historisch</span>
        )}
      </div>

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
        const last = lastPerformance(ex.id, sessionDate);
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
                <ExerciseTechnique exercise={ex} />
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
          {loadStrengthSessions().length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ghost)', textTransform: 'uppercase',
                letterSpacing: '0.4px', marginBottom: 4 }}>Sessies</div>
              {loadStrengthSessions().slice(0, 10).map(s => (
                <div key={`${s.date}_${s.program}`} className="os-detail-row" style={{ fontSize: 12 }}>
                  <span className="os-dk">{s.date} · {PROGRAMS[s.program]?.emoji} {s.program === 'snack' ? 'Snack' : `Programma ${s.program}`}</span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="os-dv">{(s.exercises || []).filter(e => e.done).length} oef.</span>
                    <button onClick={() => deleteSession(s.date, s.program)}
                      style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
                  </span>
                </div>
              ))}
            </div>
          )}
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
  const block = getCurrentBlock(currentDate);
  const foci = upcomingWeekFoci(currentDate, 4);
  const monday = startOfWeek(currentDate);

  // Eén bron voor de weekstatus. Hiervoor keek dit blok alleen naar
  // `run_done` in de daglog, waardoor een run die via Strava of als
  // WorkoutResult bestond onzichtbaar bleef — en een verstreken dinsdag
  // eindeloos "Gepland" toonde.
  const week = useMemo(
    () => weekTrainingRows(monday, { logs, today: currentDate, gate: nextSession?.gate }),
    [monday, logs, currentDate, nextSession?.gate?.action]);

  // De eerstvolgende dag waarop een sessie mág worden aangeboden. Een
  // gemiste training verschuift niet vanzelf naar morgen — de herstel- en
  // frequentiepoort bepaalt wanneer hij terugkomt.
  const offerDate = nextOfferDate(week, { gate: nextSession?.gate, today: currentDate });
  // De sessie die op die dag aan de beurt is. `run` is null zolang de poort
  // vandaag dichtzit; `previewRun` is dezelfde sessie, vooruitgeblikt.
  const offerRun = nextSession?.run || nextSession?.previewRun || null;

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
        {(() => {
          const exp = blockExpectation(currentDate);
          if (!exp || exp.shiftDays === 0) return null;
          return (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--divide)',
              fontSize: 12, lineHeight: 1.5 }}>
              <div><span style={{ fontWeight: 700 }}>Oorspronkelijk einde:</span> {exp.originalEnd}</div>
              <div style={{ color: 'var(--gold)', fontWeight: 700 }}>Nieuwe verwachting: {exp.expectedEnd}</div>
              <div style={{ color: 'var(--sub)' }}>Reden: {exp.reason}</div>
              {exp.raceNote && <div style={{ color: 'var(--ghost)', marginTop: 3 }}>{exp.raceNote}</div>}
            </div>
          );
        })()}
      </div>

      {/* B: Deze week */}
      <SectionLabel>Deze week</SectionLabel>
      <div className="os-card">
        {week.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--sub)', textAlign: 'center', padding: '6px 0' }}>
            Nog niets geregistreerd of gepland deze week — plan je trainingen in het Week-tabblad.
          </div>
        )}
        {week.map(r => {
          const meta = STATUS_META[r.status];
          const isOffer = r.date === offerDate;
          return (
            <div key={r.date} style={{ padding: '8px 0', borderBottom: '1px solid var(--divide)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44,
                  color: r.isToday ? 'var(--rust)' : 'var(--text)' }}>
                  {r.dow} {Number(r.date.slice(8))}
                </span>
                <span style={{ fontSize: 12, fontWeight: meta.weight, color: meta.color }}>
                  {meta.label}
                </span>
                {r.status === 'DONE' && r.sessionNr && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)',
                    border: '1px solid var(--sage)', borderRadius: 99, padding: '0 6px' }}>
                    T{r.sessionNr}
                  </span>
                )}
                {r.status === 'DONE' && r.sources.includes('strava') && (
                  <span style={{ fontSize: 10, color: 'var(--ghost)' }}>via Strava</span>
                )}
              </div>

              {/* Bij een gedane training tellen de werkelijke cijfers,
                  niet wat het schema voorschreef. */}
              {r.status === 'DONE' && (
                <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 3, paddingLeft: 52 }}>
                  {r.summary}
                  {r.tolerance === 'poor' && (
                    <span style={{ color: 'var(--rust)' }}> · slecht verdragen</span>
                  )}
                  {r.tolerance === 'pending' && (
                    <span style={{ color: 'var(--ghost)' }}> · herstelcheck open</span>
                  )}
                </div>
              )}

              {/* Gemist blijft gemist: de sessie schuift niet vanzelf op. */}
              {r.status === 'MISSED' && (
                <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2, paddingLeft: 52, lineHeight: 1.5 }}>
                  Deze dag is voorbij zonder registratie. De sessie wordt niet
                  automatisch doorgeschoven — de herstelpoort bepaalt wanneer hij terugkomt.
                </div>
              )}

              {r.status === 'RECOVERY' && (
                <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2, paddingLeft: 52, lineHeight: 1.5 }}>
                  {r.summary}
                </div>
              )}

              {/* De concrete sessie hoort maar op één dag: de eerste dag
                  waarop de poort lopen weer toestaat. Staat lopen vandaag op
                  slot, dan is dat een vooruitblik — en niet de reden waarom
                  het vandáág niet mag; die hoort bij vandaag, niet hier. */}
              {isOffer && offerRun && (
                <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 3, paddingLeft: 52, lineHeight: 1.5 }}>
                  {r.date > currentDate && (
                    <div style={{ color: 'var(--ghost)' }}>Eerste dag waarop lopen weer vrijkomt.</div>
                  )}
                  <div><span style={{ fontWeight: 700 }}>Sessie:</span> T{offerRun.nr} — {offerRun.description}</div>
                  <div><span style={{ fontWeight: 700 }}>Doel:</span> {offerRun.goal}</div>
                  <div>{offerRun.duration} min · run/walk · {easyHrLine()}</div>
                </div>
              )}
              {isOffer && !offerRun && nextSession && (
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 3, paddingLeft: 52 }}>
                  {nextSession.note}
                </div>
              )}
              {!isOffer && (r.status === 'PLANNED_FUTURE' || r.status === 'PLANNED_TODAY') && (
                <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2, paddingLeft: 52 }}>
                  Adaptief — wordt op de dag zelf bepaald op basis van herstel
                </div>
              )}
            </div>
          );
        })}
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
export default function LichaamScreen({ log, logs, currentDate, saveField, saveFields, deleteLog, showFlash, isFuture }) {
  const [subTab, setSubTab] = useState(0);
  const [weight, setWeight] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [battStart, setBattStart] = useState('');
  const [battEnd, setBattEnd] = useState('');
  const [flash, setFlash] = useState('');
  const [measurements, setMeasurements] = useState([]);
  const [maten, setMaten] = useState({ waist: '', hip: '', chest: '', arm: '', thigh: '' });
  const [matenDate, setMatenDate] = useState(currentDate);
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
    setMatenDate(currentDate);
  }, [log, currentDate]);

  useEffect(() => {
    store.getMeasurements().then(setMeasurements).catch(() => {});
  }, [currentDate]);

  useEffect(() => {
    // Onderscheid tussen "niet gekoppeld" en "backend onbereikbaar": op
    // statische hosting bestaat /api niet, en dan mag de UI niet suggereren
    // dat koppelen mogelijk is.
    strava.status()
      .then(s => setStravaStatus(s || { connected: false, reachable: false }))
      .catch(() => setStravaStatus({ connected: false, reachable: false }));
    strava.activities().then(a => setStravaActivities(a)).catch(() => {});
  }, []);

  const [trainMode, setTrainMode] = useState('run');
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [planRefresh, setPlanRefresh] = useState(0);

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
      await store.saveMeasurements(matenDate || currentDate, vals);
      const updated = await store.getMeasurements();
      setMeasurements(updated);
      setMaten({ waist: '', hip: '', chest: '', arm: '', thigh: '' });
      flashMsg('Maten opgeslagen');
    } finally { setSavingMaten(false); }
  }

  async function syncStrava() {
    setSyncing(true);
    try {
      const res = await strava.sync();
      if (res?.error) { showFlash?.('❌', res.error); return; }
      // Ophalen is niet genoeg: pas na het doortrekken naar trainingen en
      // daglogs weet de coach dat er gelopen is.
      const ing = await ingestStravaWorkouts({ logs });
      const bits = [`${res.count} nieuw`];
      if (ing.ok && ing.added) bits.push(`${ing.added} als training verwerkt`);
      if (ing.ok && ing.enriched) bits.push(`${ing.enriched} aangevuld`);
      showFlash?.('🏃', bits.join(', '));
      await saveFields?.({});          // weekkalender direct verversen
      setStravaActivities(await strava.activities());
    } catch { showFlash?.('❌', 'Sync mislukt'); }
    finally { setSyncing(false); }
  }

  async function connectStrava() {
    try {
      const url = await strava.authUrl();
      if (!url) { showFlash?.('❌', 'Strava nog niet geconfigureerd op de server'); return; }
      window.location.href = url;
    } catch (err) { showFlash?.('❌', err.message); }
  }

  // ── SUBTAB: BODY ─────────────────────────────────────────────
  // Dagelijkse check-in in detail + alle metingen op één plek.
  function TabBody() {
    return (
      <div>
        {TabCheckInDetail()}
        <div style={{ borderTop: '1px solid var(--divide)', marginTop: 20, paddingTop: 4 }} />
        {TabMaten()}
      </div>
    );
  }

  function TabCheckInDetail() {
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

        {log && deleteLog && (
          <button className="os-toggle-chip"
            style={{ fontSize: 12, color: 'var(--rust)', borderColor: 'var(--rust)', alignSelf: 'flex-start' }}
            onClick={() => {
              if (window.confirm(`Alle dagdata van ${currentDate} verwijderen? Trends worden herberekend.`)) deleteLog();
            }}>
            🗑 Dagdata van {currentDate} verwijderen
          </button>
        )}
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
          <StrengthModes currentDate={currentDate} saveFields={saveFields} isFuture={isFuture}
            WeightsModule={() => (
              <KrachtModule currentDate={currentDate} saveFields={saveFields} isFuture={isFuture} />
            )} />
        )}

        {trainMode === 'run' && (<>
        {/* Herstelcheck — closed loop: eerst check, dan vrijgave */}
        {!isFuture && (
          <RecoveryCheck log={log} logs={logs} currentDate={currentDate} saveField={saveField} />
        )}

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
              {coach.gateReason && (
                <div style={{ fontSize: 12, color: 'var(--rust)', fontWeight: 600, lineHeight: 1.4, marginTop: 4 }}>
                  {coach.gateReason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Volgende sessie — adaptief bepaald, niet simpelweg N+1 */}
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 26 }}>{nextSession.state === 'SWAP' ? '🔀' : '🏃'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {/* Nooit meer een sessienummer: dat suggereerde een volgorde
                    die er niet meer is. Wat er staat is wat de sessie dóét. */}
                {nextSession.state === 'SWAP' ? 'Vandaag — wissel sport'
                  : `Volgende sessie${nextSession.purposeLabel ? ` — ${nextSession.purposeLabel}` : ''}`}
              </div>
              {nextSession.race && (
                <div style={{ fontSize: 10.5, color: 'var(--sage)', fontWeight: 700,
                  marginBottom: 4 }}>
                  richting {nextSession.race.distanceKm} km · {nextSession.race.targetMinutes}:00
                  {nextSession.race.daysOut != null ? ` · nog ${nextSession.race.daysOut} dagen` : ''}
                </div>
              )}
              {nextSession.run ? (
                <>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    {nextSession.run.description}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.4 }}>
                    {nextSession.run.goal}
                  </div>
                  {nextSession.run.tempo && (
                    <div style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 5,
                      fontWeight: 600 }}>
                      {nextSession.run.tempo}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>
                    {nextSession.run.duration} min
                    {nextSession.run.km_estimate ? ` · ${nextSession.run.km_estimate}` : ''}
                    {' · '}{nextSession.run.hrZone}
                  </div>
                  {(nextSession.run.hrDetail || nextSession.run.hrTip) && (
                    <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 4,
                      lineHeight: 1.45 }}>
                      {nextSession.run.hrDetail || nextSession.run.hrTip}
                      {nextSession.run.hrWhy && (
                        <div style={{ marginTop: 3 }}>{nextSession.run.hrWhy}</div>
                      )}
                    </div>
                  )}
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

        {/* Training registreren — handmatig / screenshot / Strava, één WorkoutResult */}
        {!isFuture && (
          <>
            <SectionLabel style={{ marginTop: 0 }}>Vastleggen</SectionLabel>
            {(() => {
              const todayW = workoutOn(currentDate);
              return todayW ? (
                <div style={{ background: 'var(--card)', border: '1px solid var(--green)', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 2 }}>
                    ✓ Training geregistreerd
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sub)' }}>
                    {[todayW.distance ? `${todayW.distance} km` : null,
                      todayW.duration ? `${todayW.duration} min` : null,
                      (todayW.averagePace || computePace(todayW.distance, todayW.duration)) ? `${todayW.averagePace || computePace(todayW.distance, todayW.duration)}/km` : null,
                      todayW.averageHR ? `HR ${todayW.averageHR}` : null,
                      todayW.rpe != null ? `RPE ${todayW.rpe}` : null,
                    ].filter(Boolean).join(' · ') || 'details in het trainingsplan'}
                  </div>
                  <button className="os-toggle-chip" style={{ fontSize: 11, marginTop: 6 }}
                    onClick={() => setShowWorkoutForm(true)}>
                    + Nog een training registreren
                  </button>
                </div>
              ) : (
                <>
                  <button className="os-btn-save"
                    style={{ width: '100%', marginBottom: 6, whiteSpace: 'normal', lineHeight: 1.35 }}
                    onClick={() => setShowWorkoutForm(true)}>
                    🏃 Training registreren
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 10, textAlign: 'center' }}>
                    screenshot · handmatig · Strava
                  </div>
                </>
              );
            })()}
            {log?.run_done && !workoutOn(currentDate) && (
              <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 8 }}>
                ✓ Snel gemarkeerd als gedaan (T{log.run_session || nextRunNr}) — registreer details voor betere coaching.
              </div>
            )}

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

        {/* Elke activiteit corrigeerbaar, ook zonder schemakoppeling */}
        <ActivityList currentDate={currentDate}
          onEdit={(w) => { setEditingWorkout(w); setShowWorkoutForm(true); }}
          onChanged={() => { setPlanRefresh(k => k + 1); saveFields?.({}); }} />

        {/* De dynamische hardloopcoach.
            Hier stond de oude plankop met een sessieteller en een verplichte
            volgorde. Dat gaf de indruk dat training zes automatisch na vijf
            komt, en dat is al een tijd niet meer waar: de sessie komt uit
            planNextSession(), die naar de poort, je herstel en je doelen
            kijkt. De nummers bestaan intern nog als sjabloon, maar bepalen
            niets — en horen dus niet op het scherm. */}
        <RunCoach key={planRefresh} log={log || {}} logs={logs} currentDate={currentDate} />

        {/* De sessiebibliotheek als naslag, achter een klik en zonder
            volgordebelofte. */}
        <SessionLibrary logs={logs}
          refresh={() => setPlanRefresh(k => k + 1)}
          onEditWorkout={(w) => { setEditingWorkout(w); setShowWorkoutForm(true); }} />

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
                onClick={() => strava.disconnect().then(() => setStravaStatus({ connected: false, reachable: true, configured: true })).catch(() => {})}>
                Ontkoppelen
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              {stravaStatus && stravaStatus.reachable === false ? (
                <>
                  <div style={{ fontSize: 13, color: 'var(--rust)', fontWeight: 600, marginBottom: 6 }}>
                    Strava-service niet bereikbaar
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
                    Handmatig invoeren en screenshot-import werken volledig zonder Strava.
                  </div>
                </>
              ) : stravaStatus && stravaStatus.configured === false ? (
                <>
                  <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 600, marginBottom: 6 }}>
                    Strava nog niet ingesteld
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
                    De serverfunctie draait, maar de Strava-app-sleutels ontbreken nog.
                    Zet STRAVA_CLIENT_ID en STRAVA_CLIENT_SECRET in Supabase → Edge
                    Functions → Secrets, dan werkt koppelen direct.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 12, lineHeight: 1.5 }}>
                    Koppel Strava om activiteiten automatisch te importeren en als sessie te registreren.
                  </div>
                  <button className="os-btn-save" style={{ background: '#FC4C02' }} onClick={connectStrava}>
                    Koppel Strava
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        </>)}
      </div>
    );
  }

  // ── SUBTAB: HERSTEL ──────────────────────────────────────────
  function TabHerstel() {
    // Het volledige coachbesluit staat op Vandaag (Decision Cockpit) — hier
    // alleen de invoer en de directe PEM-signalering.
    const pemSignals = [
      log?.delayed_fatigue, log?.delayed_brainfog, log?.delayed_breathless, log?.symptom_pem
    ].filter(Boolean).length;

    return (
      <div>
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
    // Cyclusfase is CONTEXT, geen voorschrift. Algemene regels ("ovulatie =
    // beste trainingsmoment") gelden niet per definitie in perimenopauze —
    // de tool leert eerst Griëtte's eigen patronen en toont altijd het
    // aantal waarnemingen (confidence).
    const NEUTRAL_INFO = {
      menstruatie: 'Dag 1–5 (indicatief). Context voor je data — jouw eigen waarnemingen bepalen wat dit voor training betekent.',
      folliculair: 'Dag 6–13 (indicatief). Geen aanname over energie — kijk hieronder wat jouw eigen data laat zien.',
      ovulatie: 'Rond dag 14–16 (indicatief). In perimenopauze is dit patroon vaak onregelmatig — readiness blijft leidend.',
      luteaal: 'Dag 17+ (indicatief). Kijk hieronder of jouw eigen data hier een patroon laat zien.',
      'weet-niet': 'Cyclusfase onbekend — prima. Readiness is altijd de primaire gids.',
    };
    const info = NEUTRAL_INFO[log?.cycle_phase];

    // Persoonlijke patronen per fase — pas tonen mét confidence
    const MIN_OBS = 5;
    const phaseStats = ['menstruatie', 'folliculair', 'ovulatie', 'luteaal'].map(phase => {
      const entries = Object.values(logs || {}).filter(l => l.cycle_phase === phase);
      const av = (key) => {
        const v = entries.map(l => l[key]).filter(x => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      return {
        phase,
        label: CYCLUS_OPTS.find(o => o.id === phase)?.label || phase,
        n: entries.length,
        sleep: av('sleep_hours'),
        energy: av('energy'),
        pem: entries.filter(l => l.symptom_pem).length,
      };
    });
    const withEnough = phaseStats.filter(p => p.n >= MIN_OBS);

    // Cyclusdag afleiden uit de laatst gemarkeerde dag 1 — met handmatige
    // override; geen rigide dogma, alleen context.
    const cycleStarts = (() => {
      try {
        const hist = JSON.parse(localStorage.getItem('gc_cycle_history') || '[]');
        const cur = localStorage.getItem('gc_cycle_start');
        return [...new Set([...(cur ? [cur] : []), ...hist])].sort();
      } catch { return []; }
    })();
    const lastStart = cycleStarts.filter(d => d <= currentDate).pop();
    const cycleDay = lastStart
      ? Math.floor((new Date(currentDate) - new Date(lastStart)) / 86400000) + 1
      : null;

    function markDayOne() {
      if (!window.confirm(`${currentDate} markeren als dag 1 van een nieuwe menstruatie?`)) return;
      try {
        const hist = JSON.parse(localStorage.getItem('gc_cycle_history') || '[]');
        const prev = localStorage.getItem('gc_cycle_start');
        const next = [...new Set([...(prev ? [prev] : []), ...hist])];
        localStorage.setItem('gc_cycle_history', JSON.stringify(next));
        localStorage.setItem('gc_cycle_start', currentDate);
      } catch { /* storage niet beschikbaar */ }
      saveFields({ cycle_day_one: true, bleeding: log?.bleeding || 'normaal' });
      flashMsg('Dag 1 vastgelegd');
    }

    return (
      <div>
        {/* Dagelijkse bloeding — de feitelijke observatie */}
        <SectionLabel style={{ marginTop: 0 }}>Bloeding vandaag</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {BLEEDING_OPTS.map(o => (
            <button key={o.id}
              className={`os-toggle-chip ${log?.bleeding === o.id ? 'active' : ''}`}
              onClick={() => saveField('bleeding', log?.bleeding === o.id ? null : o.id)}
              style={{ fontSize: 13 }}>
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button className={`os-toggle-chip ${log?.cycle_day_one ? 'active green' : ''}`}
            onClick={markDayOne} style={{ fontSize: 13 }}>
            {log?.cycle_day_one ? '✓ Dag 1 vastgelegd' : 'Nieuwe menstruatie gestart?'}
          </button>
          {cycleDay != null && (
            <span style={{ fontSize: 12, color: 'var(--sub)' }}>
              Cyclusdag {cycleDay} <span style={{ color: 'var(--ghost)' }}>(berekend)</span>
            </span>
          )}
        </div>

        <SectionLabel>Cyclusfase — handmatige override</SectionLabel>
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

        <SectionLabel>Jouw eigen patronen per fase</SectionLabel>
        <div className="os-card" style={{ marginBottom: 14 }}>
          {phaseStats.every(p => p.n === 0) ? (
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
              Nog geen fase-waarnemingen. Vink je cyclusfase aan op dagen dat je die weet —
              na ±{MIN_OBS} waarnemingen per fase laat ik hier jouw persoonlijke patroon zien.
            </div>
          ) : (
            <>
              {phaseStats.filter(p => p.n > 0).map(p => (
                <div key={p.phase} style={{ padding: '6px 0', borderBottom: '1px solid var(--divide)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{p.label}</span>
                    <span style={{ fontSize: 11, color: p.n >= MIN_OBS ? 'var(--green)' : 'var(--ghost)' }}>
                      {p.n} waarneming{p.n !== 1 ? 'en' : ''}{p.n < MIN_OBS ? ` (min. ${MIN_OBS} nodig)` : ''}
                    </span>
                  </div>
                  {p.n >= MIN_OBS ? (
                    <div style={{ fontSize: 12, color: 'var(--sub)', marginTop: 2 }}>
                      {[p.sleep != null ? `slaap gem. ${p.sleep.toFixed(1)}u` : null,
                        p.energy != null ? `energie gem. ${p.energy.toFixed(1)}/3` : null,
                        p.pem > 0 ? `${p.pem}× PEM` : null,
                      ].filter(Boolean).join(' · ') || 'nog geen slaap/energie-data in deze fase'}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2 }}>
                      Te weinig waarnemingen voor persoonlijke conclusies.
                    </div>
                  )}
                </div>
              ))}
              {withEnough.length >= 2 && (() => {
                const sorted = [...withEnough].filter(p => p.sleep != null).sort((a, b) => a.sleep - b.sleep);
                if (sorted.length < 2) return null;
                const low = sorted[0], high = sorted[sorted.length - 1];
                if (high.sleep - low.sleep < 0.4) return null;
                return (
                  <div style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600, marginTop: 8, lineHeight: 1.5 }}>
                    Patroon in jouw data: in je {low.n} {low.label.toLowerCase()}-waarnemingen sliep je gemiddeld{' '}
                    {(high.sleep - low.sleep).toFixed(1)}u korter dan in de {high.label.toLowerCase()}-fase.
                    De coach weegt dit voorzichtig mee — als context, niet als regel.
                  </div>
                );
              })()}
            </>
          )}
        </div>

        <SectionLabel>Hormonale klachten</SectionLabel>
        {['Opvliegers','Stemmingswisselingen','Slaapproblemen','Gewrichtsklachten','Breinmist (meno)'].map((label, i) => {
          const key = `hormoon_${i}`;
          return <CheckItem key={key} checked={!!log?.[key]} label={label} onClick={() => saveField(key, !log?.[key])} />;
        })}

        <SectionLabel>Cyclushistorie</SectionLabel>
        <div className="os-card">
          <CycleHistory onChange={() => saveFields({})} />
        </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700 }}>Datum</span>
          <input type="date" className="os-input" value={matenDate}
            onChange={e => setMatenDate(e.target.value)} style={{ flex: 1 }} />
          {matenDate !== currentDate && (
            <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>historisch</span>
          )}
        </div>
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
                      <td style={{ textAlign: 'right', padding: '7px 0' }}>
                        <button onClick={async () => {
                          if (!window.confirm(`Meting van ${m.date} verwijderen?`)) return;
                          await store.deleteMeasurement(m.date);
                          setMeasurements(await store.getMeasurements());
                        }}
                          style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </td>
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
      {/* Workout registratie modal */}
      {showWorkoutForm && (
        <WorkoutForm
          defaultDate={currentDate}
          defaultSessionNr={nextSession.nr}
          logs={logs}
          saveFields={saveFields}
          initialWorkout={editingWorkout}
          onSaved={() => setPlanRefresh(k => k + 1)}
          onClose={() => { setShowWorkoutForm(false); setEditingWorkout(null); }}
        />
      )}

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
        {subTab === 0 && TabTraining()}
        {subTab === 1 && TabHerstel()}
        {subTab === 2 && TabBody()}
        {subTab === 3 && TabCyclus()}
        {subTab === 4 && TabVoeding()}
        {subTab === 5 && TabMedicatie()}
      </div>
    </div>
  );
}
