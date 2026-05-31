import React, { useState, useEffect, useRef } from 'react';
import { RUNS } from '../data/runningSchema';
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

      {/* Hardloopschema */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">🏃‍♀️ Hardloopschema — training {USER.currentRun}/35</div>
        </div>
        <div className="card-body" style={{ padding: '10px 8px' }}>
          {RUNS.map(run => {
            const isCurrent = run.nr === USER.currentRun;
            const isDone = run.nr < USER.currentRun;
            const isOpen = openRun === run.nr;
            return (
              <div key={run.nr} className={`run-item ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}>
                <div className="run-top" onClick={() => setOpenRun(isOpen ? null : run.nr)}>
                  <span className="run-nr">{run.nr}</span>
                  <span className="run-name">
                    {isDone && '✓ '}{isCurrent && '▶ '}{run.description}{run.milestone && ' 🏁'}
                    {isCurrent && <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--rust)', color: 'white', padding: '1px 5px', borderRadius: 99 }}>VOLGENDE</span>}
                  </span>
                  <span className="run-dur">{run.duration}min</span>
                </div>
                {isOpen && (
                  <div className="run-detail open">
                    <strong>Week {run.week}</strong><br />{run.description}
                    {run.intervals && <><br /><em style={{ color: 'var(--rust)' }}>⚡ {run.intervals} (iets boven zone B mag)</em></>}
                    <br /><span style={{ fontSize: 10, color: 'var(--rust)' }}>Zone B: 106–132 bpm · hartslag leidend</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
