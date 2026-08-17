import React, { useState, useEffect, useCallback } from 'react';
import SubTabs from './SubTabs';
import { computeHeadCoach } from './CoachAdvice';
import { USER, MEDS, SUPPLEMENTS, PRN_MEDS } from '../config';
import { RUNS } from '../data/runningSchema';
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

  const coach = computeHeadCoach(log, logs, currentDate);
  const r = READINESS_MAP[coach.decision] || READINESS_MAP.AMBER;
  const nextRunNr = getNextRunNr(logs);
  const nextRun = RUNS[nextRunNr - 1];

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
    const runInfo = nextRun;
    return (
      <div>
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

        {/* Next run info */}
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 26 }}>🏃</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Volgende sessie — T{nextRunNr}/35
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {runInfo?.title || `Training ${nextRunNr}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.4 }}>
                {runInfo?.description || `Zone B · ${USER.hrZone.low}–${USER.hrZone.high} bpm`}
              </div>
              {runInfo?.duration && (
                <div style={{ fontSize: 12, color: 'var(--ghost)', marginTop: 4 }}>
                  {runInfo.duration} min · {runInfo.hrZone}
                </div>
              )}
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
            <CheckItem
              checked={!!log?.core_done}
              label="Core programma gedaan"
              onClick={() => saveField('core_done', !log?.core_done)}
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

      {/* Tab content */}
      <div className="os-content" style={{ paddingTop: 16 }}>
        {subTab === 0 && <TabVandaag />}
        {subTab === 1 && <TabTraining />}
        {subTab === 2 && <TabHerstel />}
        {subTab === 3 && <TabVoeding />}
        {subTab === 4 && <TabCyclus />}
        {subTab === 5 && <TabMaten />}
        {subTab === 6 && <TabMedicatie />}
      </div>
    </div>
  );
}
