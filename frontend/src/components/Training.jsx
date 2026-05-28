import React, { useState, useEffect } from 'react';
import { RUNS } from '../data/runningSchema';
import { getCoreForWeek, coreWeekFromDate } from '../data/coreProgram';
import { USER } from '../config';
import { api } from '../api';
import { store } from '../store';

export default function Training({ log, saveField, saveFields, currentDate, showFlash, logs }) {
  const [openRun, setOpenRun] = useState(null);
  const [openEx, setOpenEx] = useState({});
  const [stravaStatus, setStravaStatus] = useState(null);
  const [activities, setActivities] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const [swimDur, setSwimDur] = useState('');
  const [swimDist, setSwimDist] = useState('');
  const [swimHr, setSwimHr] = useState('');

  const [bikeDur, setBikeDur] = useState('');
  const [bikeDist, setBikeDist] = useState('');
  const [bikeHr, setBikeHr] = useState('');

  const coreWeek = coreWeekFromDate(USER.startDate);
  const { phase, exercises } = getCoreForWeek(Math.min(10, Math.max(1, coreWeek)));

  const currentRunNr = USER.currentRun + Math.max(0,
    Object.values({}).filter ? 0 : 0
  );

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
    } catch (err) {
      showFlash('❌', 'Sync mislukt — controleer Strava koppeling');
    } finally {
      setSyncing(false);
    }
  };

  const connectStrava = async () => {
    try {
      const { url } = await api.stravaAuth();
      window.open(url, '_blank');
    } catch (err) {
      showFlash('❌', err.message);
    }
  };

  const toggleEx = (name) => {
    setOpenEx(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const coreCheckboxKey = `core_done`;

  async function saveSwim() {
    if (!swimDur) return;
    await saveFields({
      swim_done: 1,
      swim_duration: parseFloat(swimDur) || null,
      swim_distance: parseFloat(swimDist) || null,
      swim_hr: parseFloat(swimHr) || null,
    });
    setSwimDur(''); setSwimDist(''); setSwimHr('');
    showFlash('🏊', 'Zwemsessie opgeslagen!');
  }

  async function saveBike() {
    if (!bikeDur) return;
    await saveFields({
      bike_done: 1,
      bike_duration: parseFloat(bikeDur) || null,
      bike_distance: parseFloat(bikeDist) || null,
      bike_hr: parseFloat(bikeHr) || null,
    });
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

  return (
    <div className="pane">
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
                    {isDone && '✓ '}
                    {isCurrent && '▶ '}
                    {run.description}
                    {run.milestone && ' 🏁'}
                    {run.nr === USER.currentRun && (
                      <span style={{ marginLeft: 6, fontSize: 9, background: 'var(--rust)', color: 'white', padding: '1px 5px', borderRadius: 99 }}>VOLGENDE</span>
                    )}
                  </span>
                  <span className="run-dur">{run.duration}min</span>
                </div>
                {isOpen && (
                  <div className="run-detail open">
                    <strong>Week {run.week}</strong>
                    <br />{run.description}
                    {run.intervals && <><br /><em style={{ color: 'var(--rust)' }}>⚡ {run.intervals} (iets boven zone B mag)</em></>}
                    <br />
                    <span style={{ fontSize: 10, color: 'var(--rust)' }}>Zone B: 106–132 bpm · hartslag leidend</span>
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
              Je training kun je hier wel handmatig aanvinken.
            </div>
          ) : !stravaStatus?.connected ? (
            <button className="btn btn-rust btn-full" onClick={connectStrava}>
              🔗 Koppel Strava
            </button>
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
            <div className="measure-field">
              <label>Duur (min)</label>
              <input type="number" placeholder="—" value={swimDur} onChange={e => setSwimDur(e.target.value)} />
            </div>
            <div className="measure-field">
              <label>Afstand (m)</label>
              <input type="number" placeholder="—" value={swimDist} onChange={e => setSwimDist(e.target.value)} />
            </div>
            <div className="measure-field">
              <label>Gem. HS</label>
              <input type="number" placeholder="—" value={swimHr} onChange={e => setSwimHr(e.target.value)} />
            </div>
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
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {l.swim_duration ? `${l.swim_duration} min` : ''}
                      {l.swim_distance ? ` · ${l.swim_distance} m` : ''}
                    </div>
                  </div>
                  {hrBadge(l.swim_hr)}
                </div>
              ))}
            </div>
          )}
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
            <div className="measure-field">
              <label>Duur (min)</label>
              <input type="number" placeholder="—" value={bikeDur} onChange={e => setBikeDur(e.target.value)} />
            </div>
            <div className="measure-field">
              <label>Afstand (km)</label>
              <input type="number" step="0.1" placeholder="—" value={bikeDist} onChange={e => setBikeDist(e.target.value)} />
            </div>
            <div className="measure-field">
              <label>Gem. HS</label>
              <input type="number" placeholder="—" value={bikeHr} onChange={e => setBikeHr(e.target.value)} />
            </div>
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
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {l.bike_duration ? `${l.bike_duration} min` : ''}
                      {l.bike_distance ? ` · ${l.bike_distance} km` : ''}
                    </div>
                  </div>
                  {hrBadge(l.bike_hr)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Core programma */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">
            💪 Core — week {coreWeek} · {phase}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>5×/week</div>
        </div>
        <div className="card-body">
          {log?.core_done && (
            <div className="done-banner">💪 Core vandaag gedaan! Goed bezig.</div>
          )}
          {exercises.map(ex => {
            const key = ex.name;
            const isOpen = openEx[key];
            return (
              <div key={key} className={`core-exercise`}>
                <div className="core-top" onClick={() => toggleEx(key)}>
                  <span className="core-name">{ex.emoji} {ex.name}</span>
                  <span className="core-sets">
                    {ex.reps ? `${ex.sets}×${ex.reps}` : `${ex.sets}×${ex.duration}`}
                  </span>
                </div>
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
        </div>
      </div>
    </div>
  );
}
