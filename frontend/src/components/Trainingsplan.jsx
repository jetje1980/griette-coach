import React, { useState, useEffect } from 'react';
import { RUNS, getRunDate, getRunStatus } from '../data/runningSchema';
import { USER } from '../config';
import { store } from '../store';

const NL_MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

function fmtDate(d) {
  const dt = new Date(d);
  return `${dt.getDate()} ${NL_MONTHS[dt.getMonth()]}`;
}

function daysFrom(date) {
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function WeightStrategy({ logs }) {
  const entries = Object.values(logs || {})
    .filter(l => l.weight && l.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = entries[entries.length - 1];
  const goal = USER.goalWeight; // 57 kg
  const toGo = latest ? +(latest.weight - goal).toFixed(1) : null;
  const mounjaro = new Date('2026-08-21');
  const weeksSinceMounjaro = Math.max(0, Math.floor((new Date() - mounjaro) / (7 * 86400000)));

  // Verwacht gewichtsverlies: Mounjaro 0.3-0.5 kg/week + sport + eetpatroon
  const expectedLoss = +(weeksSinceMounjaro * 0.4).toFixed(1);
  const raceDate = new Date('2026-10-03');
  const weeksToTrail = Math.max(0, Math.ceil((raceDate - new Date()) / (7 * 86400000)));
  const projectedAtTrail = latest ? +(latest.weight - weeksToTrail * 0.4).toFixed(1) : null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--rust)' }} />
        <div className="card-title">⚖️ Gewichtstrategie</div>
        {latest && (
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--rust)' }}>{latest.weight} kg</span>
        )}
      </div>
      <div className="card-body">
        {!latest ? (
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
            Vul vandaag je gewicht in op de <strong>Vandaag-tab</strong> om de strategie te activeren.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Nu', val: `${latest.weight} kg`, color: 'var(--rust)' },
                { label: 'Doel', val: `${goal} kg`, color: 'var(--sage)' },
                { label: 'Te gaan', val: `${toGo} kg`, color: toGo > 3 ? 'var(--gold)' : 'var(--sage)' },
                projectedAtTrail && { label: 'Bij Trail 3 okt', val: `~${projectedAtTrail} kg`, color: 'var(--muted)' },
              ].filter(Boolean).map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 60 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Mounjaro + training synergie */}
            <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>🎯 Realistische prognose</div>
              Mounjaro (2,5 mg/week) + zone B lopen + eiwitfocus = <strong>~0,3–0,5 kg/week</strong> verlies.
              {weeksSinceMounjaro > 0 && ` Verwacht totaal t/m nu: ~${expectedLoss} kg.`}
              <br />
              Dit is geen dieet-app — dit is een <strong>leefstijl-reset</strong>. Weeg elke ochtend nuchter.
            </div>

            {/* Dagelijkse gewichtstips */}
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
              Dagelijks doen voor resultaat
            </div>
            {[
              { icon: '🥚', tip: '30g eiwit bij ontbijt — eiwitreich ontbijt reduceert trek de hele dag (Mounjaro-effect versterken)' },
              { icon: '💧', tip: '2L water — voor maaltijden 1 glas drinkt macrogeremd, ook bij prikkelbehandeling' },
              { icon: '🚫', tip: 'Geen ultrabewerkt voedsel voor 21u — insulinepiek in avond blokkeert vetverbranding' },
              { icon: '😴', tip: 'Vóór 23u slapen — cortisol bij slaaptekort saboteert vetverbranding en verhoogt honger' },
              { icon: '🏃', tip: 'Zone B lopen 3×/week — vetverbranding duurt 20+ min in zone B, geen spierverlies' },
            ].map(({ icon, tip }) => (
              <div key={icon} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span style={{ color: 'var(--text)' }}>{tip}</span>
              </div>
            ))}

            {/* Receptidee */}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)', cursor: 'pointer' }}>
                🍽️ Hoog-eiwit receptideeën (ontvouwen)
              </summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { meal: 'Ontbijt', idea: 'Griekse yoghurt 200g + 2 eieren scrambled + bessen — 35g eiwit' },
                  { meal: 'Lunch', idea: 'Kip-groente wrap met kwark-dressing — 40g eiwit, weinig suiker' },
                  { meal: 'Avond', idea: 'Zalm 150g + quinoa + geroosterde groenten — 38g eiwit, omega-3' },
                  { meal: 'Snack', idea: 'Hüttenkäse 150g + walnoten + kaneel — 18g eiwit, satiating' },
                ].map(({ meal, idea }) => (
                  <div key={meal} style={{ background: 'var(--bg)', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>{meal.toUpperCase()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{idea}</div>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

// Loopschema als kalender-lijst
function RunSchedule({ logs }) {
  const [showAll, setShowAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const runsWithDates = RUNS.map(r => ({
    ...r,
    date: getRunDate(r.nr, USER.startDate),
    status: getRunStatus(r.nr, USER.startDate, logs),
  }));

  const nextRunIndex = runsWithDates.findIndex(r => !r.status.done && !r.status.skipped);
  const visibleRuns = showAll ? runsWithDates : runsWithDates.slice(Math.max(0, nextRunIndex - 1), nextRunIndex + 8);

  // Groepeer per week
  const byWeek = {};
  visibleRuns.forEach(r => {
    if (!byWeek[r.week]) byWeek[r.week] = [];
    byWeek[r.week].push(r);
  });

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--rust)' }} />
        <div className="card-title">🏃 Loopschema · Run-walk-run</div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>3×/week · Zone B: 106–132 bpm</div>
      </div>
      <div className="card-body" style={{ padding: '8px 12px' }}>

        {/* Zone B uitleg */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Looptempo', val: '~10:30 min/km', icon: '🏃' },
            { label: 'Wandeltempo', val: '~6:45 min/km', icon: '🚶' },
            { label: 'Zone B grens', val: '106–132 bpm', icon: '♥' },
            { label: 'Stopgrens', val: '> 130 bpm', icon: '⚠️' },
          ].map(({ label, val, icon }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '5px 10px', fontSize: 10 }}>
              <span style={{ marginRight: 3 }}>{icon}</span>
              <span style={{ color: 'var(--muted)' }}>{label}: </span>
              <strong style={{ color: 'var(--text)' }}>{val}</strong>
            </div>
          ))}
        </div>

        {Object.entries(byWeek).map(([week, runs]) => (
          <div key={week} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 }}>
              Week {week}
            </div>
            {runs.map(r => {
              const isToday = r.date === today;
              const isNext = r.nr === runsWithDates[nextRunIndex]?.nr;
              const days = daysFrom(r.date);

              return (
                <div key={r.nr} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                  background: r.race ? '#FFF7ED' : isToday || isNext ? 'var(--sage-l)' : r.status.done ? '#F0FDF4' : 'var(--bg)',
                  border: r.race ? '1px solid var(--rust)' : isToday ? '1px solid var(--sage)' : '1px solid var(--border)',
                }}>
                  <span style={{
                    fontSize: 16, minWidth: 22, marginTop: 1,
                    color: r.status.done ? 'var(--sage)' : r.race ? 'var(--rust)' : isNext ? 'var(--sage)' : 'var(--border)',
                  }}>
                    {r.status.done ? '✓' : r.race ? '🏁' : r.status.skipped ? '—' : isNext ? '▶' : '○'}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: isNext || isToday ? 700 : 400, color: 'var(--text)' }}>
                        {r.race ? r.description.replace('🏁 ', '') : `Training ${r.nr} · ${r.runMin > 0 ? `${r.runMin % 1 === 0 ? r.runMin : r.runMin.toFixed(1)}'/${r.walkMin % 1 === 0 ? r.walkMin : r.walkMin.toFixed(1)}'🚶` : 'wandelen'} × ${r.reps || '—'}`}
                      </span>
                      {r.milestone && !r.race && <span style={{ fontSize: 9, background: 'var(--gold)', color: 'white', padding: '1px 5px', borderRadius: 99 }}>MIJLPAAL</span>}
                      {r.vacation && <span style={{ fontSize: 9, background: 'var(--gold-l)', color: 'var(--gold)', padding: '1px 5px', borderRadius: 99 }}>🏝️ Ameland</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {fmtDate(r.date)} · {r.duration} min · {r.km_estimate || '—'} · {r.hrZone}
                    </div>
                    {(isNext || isToday) && !r.status.done && (
                      <div style={{ fontSize: 10, color: 'var(--sage)', marginTop: 2, lineHeight: 1.5 }}>
                        {r.tempo}
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {days > 0 && (
                      <div style={{ fontSize: 10, color: days < 3 ? 'var(--rust)' : 'var(--muted)', fontWeight: 700 }}>
                        {days}d
                      </div>
                    )}
                    {days === 0 && <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>Vandaag!</div>}
                    {days < 0 && !r.status.done && (
                      <div style={{ fontSize: 9, color: 'var(--alert)' }}>gemist?</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <button
          onClick={() => setShowAll(!showAll)}
          style={{ fontSize: 11, color: 'var(--sage)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'center' }}
        >
          {showAll ? '▲ Minder tonen' : `▼ Volledig schema (${RUNS.length} trainingen)`}
        </button>
      </div>
    </div>
  );
}

export default function Trainingsplan({ logs }) {
  const [logsData, setLogsData] = useState(logs || {});

  useEffect(() => {
    if (!logs) {
      store.getLogs().then(data => {
        const map = {};
        data.forEach(l => { if (l.date) map[l.date] = l; });
        setLogsData(map);
      }).catch(() => {});
    } else {
      setLogsData(logs);
    }
  }, [logs]);

  return (
    <div className="pane">
      <WeightStrategy logs={logsData} />
      <RunSchedule logs={logsData} />
    </div>
  );
}
