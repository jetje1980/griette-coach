import React, { useState, useMemo } from 'react';
import { RUNS, runDistance } from '../data/runningSchema';
import { sessionDetail } from '../data/sessionDetail';
import { measuredPaces } from '../easyPace';
import {
  workoutsForSession, adaptiveHistoryForSession, computePace, deleteWorkout,
} from '../workouts';

// De sessiebibliotheek — naslag, geen plan.
//
// Dit was de genummerde planlijst met een teller en een "Volgende".
// Die volgorde bestond niet meer: welke sessie je doet komt uit
// planNextSession(), die kijkt naar de poort, je herstel, de fase en je
// doelen. Een lijst met genummerde stappen ernaast leest als een
// verplichting, en dat is precies de verwarring die eruit moest.
//
// Wat overblijft is bruikbaar: een verzameling vormen om uit te putten, en
// de geregistreerde sessies die eraan hangen. Geen teller, geen "volgende",
// geen suggestie dat er een route doorheen loopt.

const STATUS_META = {
  'done':          { label: 'Gedaan',            color: 'var(--green)', emoji: '✓' },
  'repeated-done': { label: 'Gedaan (herhaald)', color: 'var(--green)', emoji: '✓²' },
  'current':       { label: 'Volgende',          color: 'var(--rust)',  emoji: '▶' },
  'todo':          { label: 'Nog te doen',       color: 'var(--ghost)', emoji: '·' },
  'modified':      { label: 'Aangepast gedaan',  color: 'var(--gold)',  emoji: '≈' },
  'stopped':       { label: 'Gestopt',           color: 'var(--rust)',  emoji: '⏹' },
  'skipped':       { label: 'Overgeslagen',      color: 'var(--sub)',   emoji: '→' },
};

const EVENT_LABEL = {
  planned: 'gepland', done_full: 'volledig gedaan', done_modified: 'aangepast gedaan',
  stopped: 'gestopt', repeated: 'herhaald', deload: 'teruggeschaald', swap: 'gewisseld',
  tolerated: 'goed verdragen', poorly_tolerated: 'niet goed verdragen', released: 'vrijgegeven',
  skipped: 'overgeslagen/verplaatst',
};

function DetailRow({ k, v }) {
  if (!v) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12, lineHeight: 1.45 }}>
      <span style={{ minWidth: 92, fontWeight: 700, color: 'var(--ghost)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: 'var(--text)' }}>{v}</span>
    </div>
  );
}

function SessionCard({ run, status, refresh, logs, onEditWorkout, paces }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status] || STATUS_META.todo;
  const detail = sessionDetail(run, paces);
  const workouts = workoutsForSession(run.nr);
  const history = adaptiveHistoryForSession(run.nr);

  return (
    <div style={{ border: `1px solid ${status === 'current' ? 'var(--rust)' : 'var(--border)'}`,
      borderRadius: 10, marginBottom: 6, overflow: 'hidden',
      opacity: status === 'done' || status === 'repeated-done' ? 0.75 : 1 }}>
      {/* Compacte rij */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
        cursor: 'pointer', background: 'var(--card)' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 12, fontWeight: 800, minWidth: 30,
          color: status === 'current' ? 'var(--rust)' : 'var(--text)' }}>T{run.nr}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.race ? '🏁 ' : ''}{run.description}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ghost)' }}>
            {run.duration} min · {detail.block}{runDistance(run, paces) ? ` · ~${runDistance(run, paces).label}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, flexShrink: 0 }}>
          {meta.emoji} {meta.label}
        </span>
        <span style={{ color: 'var(--ghost)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Volledige instructie */}
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--divide)' }}>
          <DetailRow k="Type" v={detail.type} />
          <DetailRow k="Blok" v={detail.block} />
          <DetailRow k="Warming-up" v={detail.warmup} />
          <DetailRow k="Kern" v={detail.core} />
          {detail.runWalk && <DetailRow k="Run/walk" v={detail.runWalk} />}
          {detail.reps && <DetailRow k="Herhalingen" v={`${detail.reps}×`} />}
          <DetailRow k="Duur" v={`${detail.duration} min totaal`} />
          {detail.km && <DetailRow k="Afstand" v={`~${detail.km} (schatting)`} />}
          <DetailRow k="Hartslag" v={detail.hrZone} />
          <DetailRow k="RPE-doel" v={detail.rpe} />
          {detail.tempo && <DetailRow k="Tempo" v={detail.tempo} />}
          <DetailRow k="Doel" v={detail.goal} />
          <DetailRow k="Waarom" v={detail.why} />
          <DetailRow k="Cooling-down" v={detail.cooldown} />

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rust)', marginTop: 8, marginBottom: 4 }}>
            Aanpassen wanneer:
          </div>
          {detail.stopCriteria.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.45, marginBottom: 2, paddingLeft: 10 }}>
              · {c}
            </div>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)', marginTop: 8, marginBottom: 4 }}>
            Coach observeert vandaag:
          </div>
          {detail.observes.map((o, i) => (
            <div key={i} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.45, marginBottom: 2, paddingLeft: 10 }}>
              · {o}
            </div>
          ))}

          <div style={{ fontSize: 11.5, color: 'var(--ghost)', fontStyle: 'italic', marginTop: 8, lineHeight: 1.5 }}>
            {detail.successNote}
          </div>

          {/* ACTUAL: geregistreerde workouts van deze sessie */}
          {workouts.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--divide)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', textTransform: 'uppercase',
                letterSpacing: '0.4px', marginBottom: 4 }}>Geregistreerd (actual)</div>
              {workouts.map(w => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                  color: 'var(--text)', marginBottom: 3 }}>
                  <span style={{ color: 'var(--ghost)' }}>{w.date?.slice(5)}</span>
                  <span style={{ flex: 1 }}>
                    {[w.distance ? `${w.distance} km` : null,
                      w.duration ? `${w.duration} min` : null,
                      (w.averagePace || computePace(w.distance, w.duration)) ? `${w.averagePace || computePace(w.distance, w.duration)}/km` : null,
                      w.averageHR ? `HR ${w.averageHR}` : null,
                      w.rpe != null ? `RPE ${w.rpe}` : null,
                    ].filter(Boolean).join(' · ') || 'geen details'}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onEditWorkout?.(w); }}
                    style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
                  <button onClick={(e) => { e.stopPropagation();
                    if (window.confirm('Deze registratie verwijderen? Trends worden herberekend.')) {
                      deleteWorkout(w.id); refresh?.();
                    } }}
                    style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Levende historie */}
          {history.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ghost)', textTransform: 'uppercase',
                letterSpacing: '0.4px', marginBottom: 4 }}>Historie</div>
              {history.map(e => (
                <div key={e.id} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
                  → {e.date?.slice(5)} {EVENT_LABEL[e.event] || e.event}{e.note ? ` — ${e.note}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionLibrary({ logs, refresh, onEditWorkout }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Eén keer per render: je gemeten tempo's. Zonder die meting staat er geen
  // afstand bij een sessie, in plaats van een schatting uit het oude schema.
  const paces = useMemo(() => measuredPaces({ logs }), [logs]);

  // Geen status per sessie meer, en geen "huidige".
  //
  // De oude versie berekende welke sessie je "hoorde" te doen uit het hoogste
  // afgevinkte nummer, en toonde die als het midden van een route. Dat is de
  // aanname die weg moest: de volgende sessie komt niet uit dit lijstje maar
  // uit planNextSession(). Wat hier staat zijn vormen om uit te putten,
  // gesorteerd van kort naar lang, met de sessies die je er al aan hebt
  // gehangen.
  const geordend = useMemo(
    () => [...RUNS].filter(r => !r.restDay).sort((a, b) => a.duration - b.duration),
    []);
  const zichtbaar = showAll ? geordend : geordend.slice(0, 6);

  return (
    <div style={{ marginTop: 16 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
        <span>Sessiebibliotheek — vormen om uit te putten</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55,
            marginBottom: 8 }}>
            Geen volgorde en geen verplichting. Welke sessie je vandaag doet staat
            hierboven en komt uit je herstel, je fase en je doelen — niet uit deze lijst.
            Dit zijn de vormen waar de coach uit put als er nog geen bewezen
            structuur van jezelf is.
          </div>
          {zichtbaar.map(run => (
            <SessionCard key={run.nr} run={run} status="todo"
              logs={logs} refresh={refresh} onEditWorkout={onEditWorkout} paces={paces} />
          ))}
          <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 4 }}
            onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Toon minder' : `Toon alle ${geordend.length} vormen`}
          </button>
        </>
      )}
    </div>
  );
}
