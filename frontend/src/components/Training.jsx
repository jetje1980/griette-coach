import React, { useState, useEffect, useRef } from 'react';
import { RUNS, getRunDate, getRunStatus } from '../data/runningSchema';
import { getCoreForWeek, coreWeekFromDate } from '../data/coreProgram';
import { USER } from '../config';
import { api } from '../api';
import { store } from '../store';
import { ai } from '../ai';

const DAGSLUITING = [
  { emoji: '🫁', name: 'Diepe ademhaling',   desc: '4 tellen in · 7 vasthouden · 8 uitademen — herhaal 4×', secs: 60  },
  { emoji: '🦢', name: 'Nekrek',             desc: 'Langzaam links/rechts, kin naar borst, naar plafond — voel de rek', secs: 60  },
  { emoji: '🌀', name: 'Schoudercirkels',    desc: 'Grote cirkels achterwaarts (10×) · dan armen omhoog strekken', secs: 60  },
  { emoji: '🧘', name: 'Zijwaartse stretch', desc: 'Arm omhoog, kantel zijwaarts · 30s per kant', secs: 60  },
  { emoji: '🦵', name: 'Heupflexor rek',    desc: 'Staande lunge · voorkant heup voelen strekken · 45s per kant', secs: 90  },
  { emoji: '🐈', name: 'Kat-koe',           desc: 'Op handen en knieën · rug bol (adem uit) en hol (adem in) · 10×', secs: 60  },
  { emoji: '😌', name: 'Bewuste ontspanning', desc: 'Liggend op rug · scan je lichaam van voeten naar hoofd · laat alles los', secs: 120 },
];

function parseSecs(duration) {
  if (!duration) return 0;
  const m = String(duration).match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 900;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/jpeg', 0.78).split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ExerciseTimer({ name, secs }) {
  const [remaining, setRemaining] = useState(secs);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  const start = () => {
    if (running) {
      clearInterval(ref.current);
      setRunning(false);
      setRemaining(secs);
      return;
    }
    setRunning(true);
    ref.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(ref.current); setRunning(false); return secs; }
        return r - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(ref.current), []);

  const pct = ((secs - remaining) / secs) * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: running ? 'var(--sage)' : 'var(--border)', transition: 'width 1s linear', borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: running ? 'var(--sage)' : 'var(--muted)', minWidth: 36, textAlign: 'right' }}>
        {fmtTime(remaining)}
      </span>
      <button
        onClick={start}
        style={{
          fontSize: 12, padding: '3px 10px', borderRadius: 99, border: '1.5px solid',
          background: running ? 'var(--rust-l)' : 'var(--sage-l)',
          color: running ? 'var(--rust)' : 'var(--sage)',
          borderColor: running ? 'var(--rust)' : 'var(--sage)',
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        {running ? '■ Stop' : '▶ Start'}
      </button>
    </div>
  );
}

function SportScreenshot({ type, label, recentSessions, logs }) {
  const imgKey      = `gc_sport_img_${type}`;
  const analysisKey = `gc_sport_analysis_${type}`;
  const [img, setImg]           = useState(() => { try { return JSON.parse(localStorage.getItem(imgKey)); } catch { return null; } });
  const [analysis, setAnalysis] = useState(() => localStorage.getItem(analysisKey) || '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      localStorage.setItem(imgKey, JSON.stringify(compressed));
      setImg(compressed);
      setAnalysis('');
      localStorage.removeItem(analysisKey);
    } catch { setError('Afbeelding kon niet worden geladen'); }
    e.target.value = '';
  };

  const analyze = async () => {
    if (!img) return;
    if (!ai.hasKey()) { setError('Stel eerst een API-sleutel in via Instellingen'); return; }
    setLoading(true);
    setError('');
    try {
      const text = await ai.analyzeSession(img, type, recentSessions, logs);
      localStorage.setItem(analysisKey, text);
      setAnalysis(text);
      const histKey = 'gc_sport_analyses_history';
      const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
      hist.unshift({ date: new Date().toISOString().slice(0, 10), type, text });
      localStorage.setItem(histKey, JSON.stringify(hist.slice(0, 20)));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
        📸 GARMIN / STRAVA SCREENSHOT ANALYSEREN
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {img ? (
        <div>
          <img
            src={`data:${img.mimeType};base64,${img.base64}`}
            alt={`${label} screenshot`}
            style={{ width: '100%', borderRadius: 8, marginBottom: 8, maxHeight: 180, objectFit: 'cover' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} onClick={() => fileRef.current?.click()}>
              🔄 Andere screenshot
            </button>
            <button
              className="btn btn-sage"
              style={{ flex: 2, fontSize: 11, fontWeight: 700 }}
              onClick={analyze}
              disabled={loading}
            >
              {loading ? '⏳ Analyseren…' : '🤖 AI Analyse'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-ghost btn-full"
          style={{ fontSize: 12, borderStyle: 'dashed' }}
          onClick={() => fileRef.current?.click()}
        >
          📸 Upload Garmin / Strava screenshot
        </button>
      )}

      {error && <div style={{ fontSize: 11, color: 'var(--alert)', marginTop: 6 }}>⚠️ {error}</div>}

      {analysis && (
        <div style={{ marginTop: 8, background: 'var(--sage-l)', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--text)', borderLeft: '3px solid var(--sage)', whiteSpace: 'pre-wrap' }}>
          {analysis}
        </div>
      )}
    </div>
  );
}

// ─── Kracht Module ────────────────────────────────────────────────────────────

const KRACHT_CATS = [
  { id: 'squat',  label: 'Squat / Lunge',     emoji: '🦵', exercises: ['Goblet Squat','Bulgarian Split Squat','Lunge','Leg Press'], reps: 10 },
  { id: 'hinge',  label: 'Hip Hinge',           emoji: '🏋️', exercises: ['Romanian Deadlift','Sumo Deadlift','Kettlebell Swing','Good Morning'], reps: 8  },
  { id: 'thrust', label: 'Hip Thrust / Glute', emoji: '🍑', exercises: ['Hip Thrust','Glute Bridge','Single-leg Hip Thrust'], reps: 12 },
  { id: 'push',   label: 'Push',               emoji: '💪', exercises: ['Dumbbell Press','Push-up','Shoulder Press','Incline Press'], reps: 10 },
  { id: 'pull',   label: 'Pull',               emoji: '🤸', exercises: ['Dumbbell Row','Lat Pulldown','Cable Row','Face Pull'], reps: 10 },
  { id: 'core',   label: 'Core / Carry',       emoji: '🧘', exercises: ['Plank','Dead Bug','Farmers Carry','Side Plank','Pallof Press'], reps: null },
  { id: 'kuit',   label: 'Kuiten',             emoji: '🦶', exercises: ['Staand kuit raise','Zittend kuit raise','Enkel-been raise'], reps: 15 },
];

function loadKracht(date) {
  try { return JSON.parse(localStorage.getItem(`gc_kracht_${date}`) || '{}'); } catch { return {}; }
}

function saveKrachtStore(date, data) {
  localStorage.setItem(`gc_kracht_${date}`, JSON.stringify(data));
}

function findLastKrachtSession(currentDate) {
  for (let i = 1; i <= 60; i++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const dk = d.toISOString().slice(0, 10);
    const raw = localStorage.getItem(`gc_kracht_${dk}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Object.keys(parsed).length > 0) return { date: dk, data: parsed };
      } catch {}
    }
  }
  return null;
}

function getProgression(prev) {
  if (!prev || prev.rir == null) return null;
  const { sets, reps, weight, rir } = prev;
  if (rir >= 3) {
    if (weight > 0) return { sets, reps, weight: +(weight + 2.5).toFixed(1), note: `+2.5kg (RIR ${rir} → gemakkelijk)` };
    if (reps)      return { sets, reps: reps + 2, weight, note: `+2 herh. (RIR ${rir} → gemakkelijk)` };
  }
  if (rir <= 1)    return { sets, reps, weight, note: `Zelfde gewicht (RIR ${rir} → goed uitgedaagd)` };
  if (reps && reps < 15) return { sets, reps: reps + 1, weight, note: `+1 herhaling (RIR ${rir})` };
  if (weight > 0)  return { sets, reps, weight: +(weight + 2.5).toFixed(1), note: `+2.5kg (rep-plafond bereikt)` };
  return null;
}

function KrachtModuleCard({ currentDate }) {
  const [kracht, setKracht] = useState(() => loadKracht(currentDate));
  const [lastSession] = useState(() => findLastKrachtSession(currentDate));
  const [openCat, setOpenCat] = useState(null);

  useEffect(() => {
    setKracht(loadKracht(currentDate));
  }, [currentDate]);

  function update(catId, field, val) {
    const next = { ...kracht, [catId]: { ...kracht[catId], [field]: val } };
    setKracht(next);
    saveKrachtStore(currentDate, next);
  }

  function applyProgression(catId, sug) {
    const { note: _n, ...fields } = sug;
    const next = { ...kracht, [catId]: { ...kracht[catId], ...fields } };
    setKracht(next);
    saveKrachtStore(currentDate, next);
  }

  const doneCats = KRACHT_CATS.filter(c => kracht[c.id]?.sets > 0).length;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#7C3AED' }} />
        <div className="card-title">💪 Kracht</div>
        {doneCats > 0 && (
          <span style={{ fontSize: 10, background: '#F3E8FF', color: '#7C3AED', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
            {doneCats}/{KRACHT_CATS.length} ✓
          </span>
        )}
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {lastSession && (
          <div style={{ padding: '6px 14px 4px', fontSize: 10, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
            Vorige sessie: <strong>{lastSession.date}</strong> · Progressive overload ↓
          </div>
        )}
        {KRACHT_CATS.map(cat => {
          const catData = kracht[cat.id] || {};
          const prevData = lastSession?.data?.[cat.id];
          const suggestion = prevData ? getProgression(prevData) : null;
          const isOpen = openCat === cat.id;
          const isDone = (catData.sets ?? 0) > 0;

          return (
            <div key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div
                onClick={() => setOpenCat(isOpen ? null : cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', cursor: 'pointer',
                  background: isDone ? '#F3E8FF20' : undefined,
                }}
              >
                <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDone ? '#7C3AED' : 'var(--text)' }}>{cat.label}</div>
                  {isDone ? (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {catData.exercise && `${catData.exercise} · `}{catData.sets}×{catData.reps ?? '—'}{catData.weight > 0 ? ` · ${catData.weight}kg` : ''}{catData.rir != null ? ` · RIR ${catData.rir}` : ''}
                    </div>
                  ) : suggestion ? (
                    <div style={{ fontSize: 10, color: '#7C3AED' }}>↑ {suggestion.note}</div>
                  ) : prevData ? (
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Vorige: {prevData.sets}×{prevData.reps ?? '—'}{prevData.weight > 0 ? ` · ${prevData.weight}kg` : ''}</div>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, color: isDone ? '#7C3AED' : 'var(--muted)' }}>
                  {isDone ? '✓' : isOpen ? '▲' : '▼'}
                </span>
              </div>

              {isOpen && (
                <div style={{ padding: '6px 14px 14px', background: 'var(--bg)' }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 700, letterSpacing: 0.5 }}>OEFENING</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {cat.exercises.map(ex => (
                        <button key={ex} onClick={() => update(cat.id, 'exercise', catData.exercise === ex ? null : ex)} style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 99, border: '1.5px solid', cursor: 'pointer',
                          background: catData.exercise === ex ? '#7C3AED' : 'var(--bg)',
                          color: catData.exercise === ex ? 'white' : 'var(--text)',
                          borderColor: catData.exercise === ex ? '#7C3AED' : 'var(--border)',
                        }}>{ex}</button>
                      ))}
                    </div>
                  </div>

                  {suggestion && (
                    <div style={{ marginBottom: 10, padding: '6px 10px', background: '#F3E8FF', borderRadius: 8, fontSize: 11, color: '#6D28D9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1 }}>↑ {suggestion.note}</span>
                      <button onClick={() => applyProgression(cat.id, suggestion)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99, background: '#7C3AED', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        Overnemen
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { field: 'sets',   label: 'Sets', ph: '3' },
                      { field: 'reps',   label: 'Reps', ph: cat.reps ? String(cat.reps) : '10' },
                      { field: 'weight', label: 'Kg',   ph: '0' },
                      { field: 'rir',    label: 'RIR',  ph: '2' },
                    ].map(({ field, label, ph }) => (
                      <div key={field}>
                        <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, textAlign: 'center', fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
                        <input
                          type="number"
                          placeholder={ph}
                          value={catData[field] ?? ''}
                          min={0}
                          onChange={e => update(cat.id, field, e.target.value === '' ? null : +e.target.value)}
                          style={{ textAlign: 'center', padding: '6px 2px', fontSize: 15, fontWeight: 700 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5 }}>
                    RIR = Reps in Reserve (0 = tot falen · 3 = 3 reps over)
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!lastSession && doneCats === 0 && (
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)' }}>
            Tik een categorie om te beginnen. Na de eerste sessie verschijnen progressive overload suggesties.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Training({ log, saveField, saveFields, currentDate, showFlash, logs }) {
  const [openRun, setOpenRun] = useState(null);
  const [openEx, setOpenEx] = useState({});
  const [stravaStatus, setStravaStatus] = useState(null);
  const [activities, setActivities] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [dagsluitingDone, setDagsluitingDone] = useState(
    () => localStorage.getItem('gc_dagsluiting_' + new Date().toISOString().slice(0, 10)) === '1'
  );

  const [swimDur, setSwimDur] = useState('');
  const [swimDist, setSwimDist] = useState('');
  const [swimHr, setSwimHr] = useState('');

  const [bikeDur, setBikeDur] = useState('');
  const [bikeDist, setBikeDist] = useState('');
  const [bikeHr, setBikeHr] = useState('');

  const coreWeek = coreWeekFromDate(USER.startDate);
  const { phase, exercises } = getCoreForWeek(Math.min(10, Math.max(1, coreWeek)));

  useEffect(() => {
    api.stravaStatus().then(s => setStravaStatus(s)).catch(() => {});
    api.stravaActivities().then(a => setActivities(a)).catch(() => {});
  }, []);

  const syncStrava = async () => {
    setSyncing(true);
    try {
      const res = await api.stravaSync();
      showFlash('🏃', `${res.count} activiteiten gesynchroniseerd`);
      const acts = await api.stravaActivities();
      setActivities(acts);
      setLastSync(new Date().toLocaleTimeString('nl'));
    } catch { showFlash('❌', 'Sync mislukt — controleer Strava koppeling'); }
    finally { setSyncing(false); }
  };

  const connectStrava = async () => {
    try {
      const { url } = await api.stravaAuth();
      window.open(url, '_blank');
    } catch (err) { showFlash('❌', err.message); }
  };

  const toggleEx = (name) => setOpenEx(prev => ({ ...prev, [name]: !prev[name] }));

  async function saveSwim() {
    if (!swimDur) return;
    await saveFields({ swim_done: 1, swim_duration: parseFloat(swimDur) || null, swim_distance: parseFloat(swimDist) || null, swim_hr: parseFloat(swimHr) || null });
    setSwimDur(''); setSwimDist(''); setSwimHr('');
    showFlash('🏊', 'Zwemsessie opgeslagen!');
  }

  async function saveBike() {
    if (!bikeDur) return;
    await saveFields({ bike_done: 1, bike_duration: parseFloat(bikeDur) || null, bike_distance: parseFloat(bikeDist) || null, bike_hr: parseFloat(bikeHr) || null });
    setBikeDur(''); setBikeDist(''); setBikeHr('');
    showFlash('🚴', 'Fietssessie opgeslagen!');
  }

  function hrBadge(hr) {
    if (!hr) return null;
    const inZone = hr >= USER.hrZone.low && hr <= USER.hrZone.high;
    return (
      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: inZone ? 'var(--sage-l)' : 'var(--rust-l)', color: inZone ? 'var(--sage)' : 'var(--rust)', fontWeight: 700 }}>
        ♥ {hr} {inZone ? '✓ zone B' : '⚡ boven'}
      </span>
    );
  }

  const recentSessions = (type) => Object.values(logs || {})
    .filter(l => l[`${type}_done`] && l.date <= currentDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const aiPlan = localStorage.getItem('gc_training_plan');
  const aiPlanDate = localStorage.getItem('gc_training_plan_date');

  const markDagsluiting = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('gc_dagsluiting_' + today, '1');
    setDagsluitingDone(true);
    showFlash('😌', 'Dagsluiting gedaan! Goed bezig.');
  };

  const overrideKey = `gc_plan_override_${currentDate}`;
  const [planOverride, setPlanOverride] = useState(() => {
    try { return JSON.parse(localStorage.getItem(overrideKey)) || null; } catch { return null; }
  });

  function setOverride(reason, adjustment) {
    const val = { reason, adjustment, set_at: new Date().toISOString() };
    localStorage.setItem(overrideKey, JSON.stringify(val));
    setPlanOverride(val);
    showFlash('✅', `Schema aangepast: ${adjustment}`);
  }

  function clearOverride() {
    localStorage.removeItem(overrideKey);
    setPlanOverride(null);
  }

  return (
    <div className="pane">

      {/* AI Weekplan */}
      {aiPlan && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">📅 AI Weekplan</div>
            {aiPlanDate && <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{aiPlanDate}</div>}
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{aiPlan}</div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Bijgewerkt na elke coach-check en foto-analyse. Hardloopschema hieronder.
            </div>
          </div>
        </div>
      )}

      {/* Dagelijkse plan-aanpassing */}
      {planOverride ? (
        <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--gold)' }} />
            <div className="card-title">📋 Plan aangepast vandaag</div>
            <button onClick={clearOverride} style={{ fontSize: 10, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Herstellen</button>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Reden:</span> {planOverride.reason}<br />
              <span style={{ color: 'var(--sage)', fontWeight: 700 }}>Alternatief:</span> {planOverride.adjustment}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              Goed dat je dit luistert — herstel gaat voor presteren.
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--muted)' }} />
            <div className="card-title">📋 Schema aanpassen vandaag?</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Iets in de weg? Kies reden + alternatief:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { r: 'Hoofdpijn/migraine',  a: 'Rustdag — stretchen max 10 min' },
                { r: 'Moeheid/laag energie', a: 'Wandeling 20–30 min, zone A' },
                { r: 'PEM-risico',           a: 'Complete rustdag — geen training' },
                { r: 'Drukke dag/logistiek', a: 'Training morgen inhalen' },
              ].map(({ r, a }) => (
                <button
                  key={r}
                  onClick={() => setOverride(r, a)}
                  style={{
                    fontSize: 11, padding: '6px 10px', borderRadius: 99,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
                  }}
                >
                  {r === 'Hoofdpijn/migraine' && '🧠 '}
                  {r === 'Moeheid/laag energie' && '🪫 '}
                  {r === 'PEM-risico' && '⚡ '}
                  {r === 'Drukke dag/logistiek' && '📅 '}
                  {r}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Het schema past zich aan voor vandaag — morgen gaan we gewoon verder.
            </div>
          </div>
        </div>
      )}

      {/* Hardloopschema — intelligent overzicht */}
      {(() => {
        const today = currentDate;
        // Vind de volgende ongeplande training
        const nextRun = RUNS.find(r => {
          const status = getRunStatus(r.nr, USER.startDate, logs);
          return !status.done && !status.skipped;
        });
        const todayRun = RUNS.find(r => getRunDate(r.nr, USER.startDate) === today);
        const activeRun = todayRun || nextRun;
        const weekRuns = activeRun ? RUNS.filter(r => r.week === activeRun.week) : [];
        const pastRuns = RUNS.filter(r => r.nr < (activeRun?.nr || 1)).slice(-3).reverse();

        if (!activeRun) return (
          <div className="card">
            <div className="card-header">
              <div className="card-accent" style={{ background: 'var(--sage)' }} />
              <div className="card-title">🏁 Schema voltooid!</div>
            </div>
            <div className="card-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
              Je hebt alle 35 trainingen voltooid. Ameland 5km (13 dec) staat te wachten!
            </div>
          </div>
        );

        const runBg = activeRun.race ? 'linear-gradient(135deg, #EA580C22, #E07A3B11)' :
                      activeRun.restDay ? 'var(--sage-l)' : 'var(--card)';
        const runBorder = activeRun.race ? '2px solid var(--rust)' : '1px solid var(--border)';

        return (
          <>
            {/* Huidige/volgende training — volledige detail */}
            <div className="card" style={{ background: runBg, border: runBorder }}>
              <div className="card-header">
                <div className="card-accent" style={{ background: activeRun.race ? 'var(--rust)' : 'var(--rust)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>
                    {todayRun ? '▶ Training vandaag' : '▶ Volgende training'}
                    {activeRun.race && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--rust)', color: 'white', padding: '1px 6px', borderRadius: 99 }}>RACE</span>}
                    {activeRun.milestone && !activeRun.race && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--gold)', color: 'white', padding: '1px 6px', borderRadius: 99 }}>MIJLPAAL</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    Training {activeRun.nr}/35 · Week {activeRun.week} · {getRunDate(activeRun.nr, USER.startDate)}
                    {activeRun.vacation && <span style={{ marginLeft: 4, color: 'var(--gold)' }}>{activeRun.vacationNote}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rust)' }}>{activeRun.duration} min</div>
              </div>
              <div className="card-body">
                {/* Interval-visualisatie */}
                {activeRun.runMin > 0 && activeRun.walkMin > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                    {Array.from({ length: Math.min(activeRun.reps || 4, 6) }).map((_, i) => (
                      <React.Fragment key={i}>
                        <div style={{
                          background: 'var(--rust)', color: 'white', borderRadius: 6,
                          padding: '4px 8px', fontSize: 11, fontWeight: 700,
                          minWidth: `${activeRun.runMin * 14}px`, textAlign: 'center',
                        }}>
                          {activeRun.runMin % 1 === 0 ? activeRun.runMin : activeRun.runMin.toFixed(1)}'
                        </div>
                        <div style={{
                          background: 'var(--sage-l)', color: 'var(--sage)', borderRadius: 6,
                          padding: '4px 8px', fontSize: 11, fontWeight: 600,
                          minWidth: `${activeRun.walkMin * 14}px`, textAlign: 'center',
                        }}>
                          {activeRun.walkMin % 1 === 0 ? activeRun.walkMin : activeRun.walkMin.toFixed(1)}'🚶
                        </div>
                      </React.Fragment>
                    ))}
                    {(activeRun.reps || 0) > 6 && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{(activeRun.reps || 0) - 6} meer</span>
                    )}
                    {activeRun.reps && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>× {activeRun.reps} = {activeRun.duration} min</span>
                    )}
                  </div>
                )}

                {/* Zone & tempo */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>
                    ♥ {activeRun.hrZone}
                  </span>
                  <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--muted)', padding: '3px 10px', borderRadius: 99 }}>
                    🏃 {activeRun.tempo}
                  </span>
                  {activeRun.km_estimate && (
                    <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--muted)', padding: '3px 10px', borderRadius: 99 }}>
                      📍 ~{activeRun.km_estimate}
                    </span>
                  )}
                </div>

                {/* HR tip */}
                <div style={{
                  fontSize: 11.5, lineHeight: 1.6, color: 'var(--text)',
                  background: '#FFF7ED', borderRadius: 8, padding: '8px 10px',
                  borderLeft: '3px solid var(--rust)', marginBottom: 10,
                }}>
                  💡 {activeRun.hrTip}
                </div>

                {/* Doel */}
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                  🎯 {activeRun.goal}
                </div>
              </div>
            </div>

            {/* Week-overzicht — compact */}
            {weekRuns.length > 1 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-accent" style={{ background: 'var(--rust)' }} />
                  <div className="card-title">📅 Week {activeRun.week} overzicht</div>
                </div>
                <div className="card-body" style={{ padding: '8px 12px' }}>
                  {weekRuns.map(r => {
                    const status = getRunStatus(r.nr, USER.startDate, logs);
                    const isActive = r.nr === activeRun.nr;
                    return (
                      <div key={r.nr} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid var(--border)',
                        opacity: isActive ? 1 : 0.7,
                      }}>
                        <span style={{
                          fontSize: 14, minWidth: 22,
                          color: status.done ? 'var(--sage)' : status.skipped ? 'var(--muted)' : isActive ? 'var(--rust)' : 'var(--border)',
                        }}>
                          {status.done ? '✓' : status.skipped ? '—' : isActive ? '▶' : '○'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color: 'var(--text)' }}>
                            Training {r.nr}
                            {r.race && ' 🏁'}{r.milestone && !r.race && ' ⭐'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {getRunDate(r.nr, USER.startDate)} · {r.runMin > 0 ? `${r.runMin % 1 === 0 ? r.runMin : r.runMin.toFixed(1)}' / ${r.walkMin % 1 === 0 ? r.walkMin : r.walkMin.toFixed(1)}'🚶` : 'wandelen'} · {r.duration} min
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.km_estimate}</div>
                        {isActive && (
                          <button
                            onClick={() => setOverride('Verplaatst', 'Morgen inhalen')}
                            style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--muted)' }}
                          >
                            Verplaats
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recente trainingen */}
            {pastRuns.length > 0 && (
              <details>
                <summary style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>▸</span> Laatste {pastRuns.length} trainingen
                </summary>
                <div className="card" style={{ marginTop: 4 }}>
                  <div className="card-body" style={{ padding: '8px 12px' }}>
                    {pastRuns.map(r => {
                      const status = getRunStatus(r.nr, USER.startDate, logs);
                      return (
                        <div key={r.nr} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                          <span style={{ color: status.done ? 'var(--sage)' : 'var(--muted)', minWidth: 14 }}>
                            {status.done ? '✓' : '—'}
                          </span>
                          <span style={{ color: 'var(--muted)', minWidth: 80 }}>{getRunDate(r.nr, USER.startDate)}</span>
                          <span style={{ flex: 1, color: 'var(--text)' }}>Training {r.nr} · {r.description}</span>
                          <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r.duration} min</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            )}
          </>
        );
      })()}

      {/* Kracht Module */}
      <KrachtModuleCard currentDate={currentDate} />

      {/* Strava */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#FC4C02' }} />
          <div className="card-title">
            🟠 Strava
            {stravaStatus?.connected && <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--sage-l)', color: 'var(--sage)', padding: '1px 6px', borderRadius: 99 }}>✓ {stravaStatus.athlete}</span>}
          </div>
        </div>
        <div className="card-body">
          {store.isOnline() === false ? (
            <div style={{ padding: '10px 12px', background: 'var(--gold-l)', borderRadius: 9, fontSize: 11, color: 'var(--gold)', lineHeight: 1.6 }}>
              🟠 Strava werkt alleen als je de app start via je Mac (<code>npm run dev</code>).
            </div>
          ) : !stravaStatus?.connected ? (
            <button className="btn btn-rust btn-full" onClick={connectStrava}>🔗 Koppel Strava</button>
          ) : (
            <button className="btn btn-ghost btn-full" onClick={syncStrava} disabled={syncing}>
              {syncing ? '⏳ Synchroniseren…' : '🔄 Sync activiteiten'}
            </button>
          )}
          {lastSync && <div className="saved-note">Gesynchroniseerd om {lastSync}</div>}
          {activities.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="section-title">Recente activiteiten</div>
              {activities.slice(0, 10).map(a => (
                <div key={a.strava_id} className="strava-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {a.date} · {Math.round(a.duration / 60)}min · {(a.distance / 1000).toFixed(1)}km
                    </div>
                  </div>
                  {a.avg_hr && (
                    <div className={`strava-hr ${a.hr_in_zone ? 'in-zone' : 'out-zone'}`}>
                      ♥ {a.avg_hr}
                      <div style={{ fontSize: 9, textAlign: 'right' }}>{a.hr_in_zone ? '✓ zone B' : '⚡ boven'}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zwemmen */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#3B82F6' }} />
          <div className="card-title">🏊 Zwemmen</div>
          {log?.swim_done && <span style={{ fontSize: 9, background: 'var(--sage-l)', color: 'var(--sage)', padding: '1px 6px', borderRadius: 99 }}>✓ vandaag</span>}
        </div>
        <div className="card-body">
          <div className="measure-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="measure-field"><label>Duur (min)</label><input type="number" placeholder="—" value={swimDur} onChange={e => setSwimDur(e.target.value)} /></div>
            <div className="measure-field"><label>Afstand (m)</label><input type="number" placeholder="—" value={swimDist} onChange={e => setSwimDist(e.target.value)} /></div>
            <div className="measure-field"><label>Gem. HS</label><input type="number" placeholder="—" value={swimHr} onChange={e => setSwimHr(e.target.value)} /></div>
          </div>
          <button className="btn btn-ghost btn-full" style={{ borderColor: '#3B82F6', color: '#3B82F6' }} onClick={saveSwim}>
            💾 Sla zwemsessie op
          </button>
          {recentSessions('swim').length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="section-title">Recente zwemsessies</div>
              {recentSessions('swim').map(l => (
                <div key={l.date} className="strava-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{l.date}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{l.swim_duration ? `${l.swim_duration} min` : ''}{l.swim_distance ? ` · ${l.swim_distance} m` : ''}</div>
                  </div>
                  {hrBadge(l.swim_hr)}
                </div>
              ))}
            </div>
          )}
          <SportScreenshot type="swim" label="zwemsessie" recentSessions={recentSessions('swim')} logs={logs} />
        </div>
      </div>

      {/* Wielrennen */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#F59E0B' }} />
          <div className="card-title">🚴 Wielrennen</div>
          {log?.bike_done && <span style={{ fontSize: 9, background: 'var(--sage-l)', color: 'var(--sage)', padding: '1px 6px', borderRadius: 99 }}>✓ vandaag</span>}
        </div>
        <div className="card-body">
          <div className="measure-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="measure-field"><label>Duur (min)</label><input type="number" placeholder="—" value={bikeDur} onChange={e => setBikeDur(e.target.value)} /></div>
            <div className="measure-field"><label>Afstand (km)</label><input type="number" step="0.1" placeholder="—" value={bikeDist} onChange={e => setBikeDist(e.target.value)} /></div>
            <div className="measure-field"><label>Gem. HS</label><input type="number" placeholder="—" value={bikeHr} onChange={e => setBikeHr(e.target.value)} /></div>
          </div>
          <button className="btn btn-ghost btn-full" style={{ borderColor: '#F59E0B', color: '#B45309' }} onClick={saveBike}>
            💾 Sla fietssessie op
          </button>
          {recentSessions('bike').length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="section-title">Recente fietssessies</div>
              {recentSessions('bike').map(l => (
                <div key={l.date} className="strava-item">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{l.date}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{l.bike_duration ? `${l.bike_duration} min` : ''}{l.bike_distance ? ` · ${l.bike_distance} km` : ''}</div>
                  </div>
                  {hrBadge(l.bike_hr)}
                </div>
              ))}
            </div>
          )}
          <SportScreenshot type="bike" label="fietssessie" recentSessions={recentSessions('bike')} logs={logs} />
        </div>
      </div>

      {/* Core */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">💪 Core — week {coreWeek} · {phase}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>5×/week</div>
        </div>
        <div className="card-body">
          {log?.core_done && <div className="done-banner">💪 Core vandaag gedaan! Goed bezig.</div>}
          {exercises.map(ex => {
            const isOpen = openEx[ex.name];
            const hasDuration = !!ex.duration;
            const secs = hasDuration ? parseSecs(ex.duration) : 0;
            return (
              <div key={ex.name} className="core-exercise">
                <div className="core-top" onClick={() => toggleEx(ex.name)}>
                  <span className="core-name">{ex.emoji} {ex.name}</span>
                  <span className="core-sets">
                    {ex.reps ? `${ex.sets}×${ex.reps}` : `${ex.sets}×${ex.duration}`}
                  </span>
                </div>
                {hasDuration && secs > 0 && (
                  <ExerciseTimer name={ex.name} secs={secs} />
                )}
              </div>
            );
          })}
          <button
            className={`btn btn-full ${log?.core_done ? 'btn-sage' : 'btn-ghost'}`}
            style={{ marginTop: 10 }}
            onClick={() => saveField('core_done', log?.core_done ? 0 : 1)}
          >
            {log?.core_done ? '✓ Core gedaan' : 'Markeer core als gedaan'}
          </button>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
            Core past wekelijks op — AI weekplan kan dagindeling aanpassen op basis van hersteldata.
          </div>
        </div>
      </div>

      {/* Dagsluiting */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#EC4899' }} />
          <div className="card-title">🌙 Dagsluiting — 7 min rek & ontspanning</div>
          {dagsluitingDone && <span style={{ fontSize: 9, background: '#FCE7F3', color: '#BE185D', padding: '1px 6px', borderRadius: 99 }}>✓ gedaan</span>}
        </div>
        <div className="card-body">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            Ideaal na het avondeten of voor het slapen. Verlaagt cortisol, verbetert slaap, houdt spieren soepel.
            Tap ▶ Start per oefening om de timer te starten.
          </div>
          {DAGSLUITING.map((ex, i) => (
            <div key={ex.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 16 }}>{ex.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {i + 1}. {ex.name}
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      {fmtTime(ex.secs)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{ex.desc}</div>
                </div>
              </div>
              <ExerciseTimer name={ex.name} secs={ex.secs} />
            </div>
          ))}
          <button
            className={`btn btn-full ${dagsluitingDone ? 'btn-sage' : 'btn-ghost'}`}
            style={{ marginTop: 8, borderColor: '#EC4899', color: dagsluitingDone ? undefined : '#BE185D', background: dagsluitingDone ? 'var(--sage)' : '#FDF2F8' }}
            onClick={markDagsluiting}
          >
            {dagsluitingDone ? '✓ Dagsluiting gedaan' : '🌙 Markeer dagsluiting als gedaan'}
          </button>
        </div>
      </div>
    </div>
  );
}
