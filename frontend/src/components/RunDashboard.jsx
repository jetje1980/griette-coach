import React, { useState, useMemo } from 'react';
import { runningState, raceReadiness, nextMilestone, upcomingRaces, MILESTONES } from '../raceGoals';
import { headacheTrend, HEADACHE_SEVERITY, exertionalResponse } from '../symptoms';
import { calibrateHr, applyCalibration, CPET, HISTORICAL_RUNS, TOLERANCE_LABELS,
  historicalCapacity, LESSONS, PROGRESSION_RULE, earlyWarnings, PHASES } from '../runningHistory';
import { fmtPace, loadWorkouts } from '../workouts';
import { todayLocal } from '../datetime';

// Progressie → Run, radicaal simpel.
//
// Drie blokken boven de vouw: NU, TREND, VOLGENDE MIJLPAAL. Daaronder de
// races. Alles wat uitleg of geschiedenis is, zit ingeklapt.
//
// De twee vragen die dit scherm beantwoordt:
//   loop ik sneller bij dezelfde goed verdragen hartslag?
//   kan ik meer echte hardloopkilometers verdragen?

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-serif)',
        fontVariantNumeric: 'tabular-nums', color: color || 'var(--text)', lineHeight: 1.15 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--ghost)', lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

export default function RunDashboard({ logs = {}, currentDate = todayLocal() }) {
  const [openRace, setOpenRace] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCpet, setShowCpet] = useState(false);
  const [calApplied, setCalApplied] = useState(false);

  const state = useMemo(() => runningState({ logs, currentDate }), [logs, currentDate]);
  const head = useMemo(() => headacheTrend({ logs, currentDate }), [logs, currentDate]);
  const cal = useMemo(() => calibrateHr({ logs, currentDate }), [logs, currentDate]);
  const milestone = useMemo(() => nextMilestone({ logs, currentDate, state }), [state]);
  const races = useMemo(() => upcomingRaces(currentDate).map(r =>
    raceReadiness(r, { logs, currentDate, state })), [state, currentDate]);
  const hist = historicalCapacity();

  // De laatste sessie en hoe hij landde — dat is de vraag die vandaag telt.
  const lastRun = loadWorkouts().find(w =>
    (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate);
  const lastResponse = lastRun
    ? exertionalResponse({ workoutDate: lastRun.date, logs, currentDate }) : null;

  return (
    <div>
      {/* ── NU ────────────────────────────────────────────────── */}
      <Label>Nu</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 10 }}>
          <Stat label="Run pace" value={state.runPaceLabel || '—'}
            sub={state.runHr ? `bij HR ${state.runHr}` : 'nog geen loopblokken'} />
          <Stat label="Langst verdragen" value={state.longestTolerated ? `${state.longestTolerated} km` : '—'}
            sub={state.longestCompleted > state.longestTolerated
              ? `voltooid ${state.longestCompleted} km` : null} />
          <Stat label="Run 7d" value={`${state.runKm7} km`} sub={`${state.runMin7} min`} />
          <Stat label="Run 28d" value={`${state.runKm28} km`} sub={`${state.runMin28} min`} />
        </div>

        {/* De hoofdmarker: hoofdpijn na de laatste sessie */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {lastResponse ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 14, lineHeight: 1.3 }}>
                {lastResponse.status === 'good' ? '✓'
                  : lastResponse.status === 'red' ? '⛔'
                  : lastResponse.status === 'pending' ? '⏳' : '⚠'}
              </span>
              <div style={{ fontSize: 12, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                <strong>Na {lastRun.date.slice(5)}:</strong> {lastResponse.reason}
                {lastResponse.headache != null && lastResponse.headache > 0 && (
                  <span style={{ color: HEADACHE_SEVERITY[lastResponse.headache].color, fontWeight: 700 }}>
                    {' '}Hoofdpijn: {HEADACHE_SEVERITY[lastResponse.headache].label.toLowerCase()}.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ghost)' }}>Nog geen geregistreerde run.</div>
          )}
        </div>

        {state.walkExcluded > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8, lineHeight: 1.5 }}>
            {state.walkExcluded} losse wandeling{state.walkExcluded > 1 ? 'en' : ''} tellen mee voor
            beweging en tijd op de benen, maar niet voor je hardloopcijfers hierboven.
          </div>
        )}
      </div>

      {/* ── TREND ─────────────────────────────────────────────── */}
      <Label right={
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ghost)',
          border: '1px solid var(--border)', borderRadius: 99, padding: '1px 7px' }}>
          zekerheid {cal.confidence.toLowerCase()}
        </span>
      }>Trend</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        {/* Loopeconomie */}
        <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 8 }}>
          {state.economyGainSec != null ? (
            <>
              <strong style={{ color: state.economyGainSec > 0 && state.economyHonest
                ? 'var(--sage)' : 'var(--text)' }}>
                {state.economyGainSec > 0 ? `${state.economyGainSec} sec/km sneller`
                  : state.economyGainSec < 0 ? `${Math.abs(state.economyGainSec)} sec/km trager`
                  : 'tempo stabiel'}
              </strong>{' '}bij vergelijkbare hartslag.
              {!state.economyHonest && ' De hartslag steeg mee — dat is harder werken, geen economie.'}
            </>
          ) : (
            <span style={{ color: 'var(--ghost)' }}>
              Nog geen loopeconomie-trend. Daarvoor zijn drie runs nodig waarin de loopblokken
              te scheiden zijn van de wandelblokken.
            </span>
          )}
        </div>

        {/* Hoofdpijntrend — de belangrijkste hersteltrend */}
        <div style={{ fontSize: 12.5, lineHeight: 1.5, paddingTop: 8,
          borderTop: '1px solid var(--border)' }}>
          {head.enough ? head.verdict : head.note}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <Stat label="PEM-vrij" value={`${state.pemFreeWeeks} wk`} />
          <Stat label="Langste blok" value={state.longestRunBlockMin
            ? `${state.longestRunBlockMin} min` : '—'} />
          <Stat label="Doorlopend" value={state.longestContinuousMin
            ? `${state.longestContinuousMin} min` : '—'} />
        </div>

        {/* Vroege waarschuwingen — het patroon van 2024-2025 */}
        {state.warnings?.signals?.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--rust)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Waarschuwingssignalen
            </div>
            {state.warnings.signals.map(s => (
              <div key={s.id} style={{ fontSize: 11.5, lineHeight: 1.45, marginBottom: 3 }}>
                <strong>{s.label}.</strong>{' '}
                <span style={{ color: 'var(--sub)' }}>{s.detail}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600,
              lineHeight: 1.5, marginTop: 5 }}>
              {state.warnings.verdict}
            </div>
          </div>
        )}
      </div>

      {/* ── HARTSLAGBAND ──────────────────────────────────────── */}
      <Label>Je hartslagband nu</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Stat label="Veilige band" value={`${cal.currentRange.low}–${cal.currentRange.high}`}
            sub="afgeleid uit je eigen runs" />
          <Stat label="Wandelen boven" value={String(cal.ceiling)} />
          <Stat label="CPET VT1" value={String(cal.historicalVt1)} sub="4 feb 2025" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 8 }}>
          {cal.note}
        </div>
        {cal.enough && cal.differsFromSetting && !calApplied && (
          <button className="btn-secondary"
            onClick={() => { applyCalibration(cal); setCalApplied(true); }}
            style={{ fontSize: 11.5, marginTop: 8, whiteSpace: 'normal' }}>
            Deze band overnemen in je instellingen
          </button>
        )}
        {calApplied && (
          <div style={{ fontSize: 11.5, color: 'var(--sage)', marginTop: 8 }}>
            Overgenomen. De coach rekent vanaf nu met deze band.
          </div>
        )}
        <div onClick={() => setShowCpet(v => !v)}
          style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between' }}>
          <span>Wat de CPET wel en niet zegt</span><span>{showCpet ? '▲' : '▼'}</span>
        </div>
        {showCpet && (
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
            <div style={{ marginBottom: 6 }}>
              VT1 {CPET.vt1Hr} · VT2 {CPET.vt2Hr} · piek {CPET.peakHr[0]}–{CPET.peakHr[1]} ·
              VO₂peak {CPET.vo2peak} ml/kg/min · {CPET.modality}, {CPET.date}.
            </div>
            <div>{CPET.caveat}</div>
          </div>
        )}
      </div>

      {/* ── VOLGENDE MIJLPAAL ─────────────────────────────────── */}
      <Label>Volgende mijlpaal</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
          marginBottom: 4 }}>{milestone.label}</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
          {MILESTONES.map(m => {
            const done = milestone.achieved.some(a => a.id === m.id);
            const isNext = milestone.next?.id === m.id;
            return (
              <span key={m.id} title={m.label}
                style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99,
                  border: `1px solid ${done ? 'var(--sage)' : isNext ? 'var(--gold)' : 'var(--border)'}`,
                  color: done ? 'var(--sage)' : isNext ? 'var(--gold)' : 'var(--ghost)',
                  fontWeight: done || isNext ? 700 : 500 }}>
                {m.label}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8 }}>
          {milestone.achievedCount} van {milestone.total} gehaald. Een mijlpaal telt pas als de
          respons 24–48 uur later schoon was.
        </div>
      </div>

      {/* ── RACES ─────────────────────────────────────────────── */}
      <Label>Races</Label>
      {races.map(r => {
        const open = openRace === r.race.id;
        return (
          <div key={r.race.id} className="os-card" style={{ marginBottom: 12,
            borderLeft: `4px solid ${r.color}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)',
                flex: 1, minWidth: 0 }}>{r.race.name}</div>
              <span style={{ fontSize: 10, fontWeight: 800, color: r.color,
                border: `1px solid ${r.color}`, borderRadius: 99, padding: '1px 7px',
                whiteSpace: 'nowrap' }}>{r.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 8 }}>
              {r.race.date} · {r.race.distanceKm} km · doel {r.targetLabel} ·
              nog {Math.round(r.weeksOut)} weken
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
              <Stat label="Verwacht nu" value={r.forecastLabel || '—'}
                sub={r.terrainPenaltyPct ? `incl. ${r.terrainPenaltyPct}% terrein` : null} />
              <Stat label="Afstand gedekt" value={r.coverage != null ? `${r.coverage}%` : '—'}
                sub={`${state.longestTolerated} van ${r.race.distanceKm} km`} />
              <Stat label="Tempo-verschil" value={r.paceGapSec != null
                ? `${r.paceGapSec > 0 ? '+' : ''}${r.paceGapSec} s/km` : '—'} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{r.advice}</div>

            <div onClick={() => setOpenRace(open ? null : r.race.id)}
              style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
                fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between' }}>
              <span>Wat er nog moet gebeuren</span><span>{open ? '▲' : '▼'}</span>
            </div>
            {open && (
              <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
                {r.gaps.length === 0
                  ? <div>Alles wat te toetsen valt staat op groen.</div>
                  : r.gaps.map((g, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                      <span style={{ color: 'var(--gold)' }}>·</span><span>{g}</span>
                    </div>
                  ))}
                {r.conditions.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                      Voorwaarden voor dit stretchdoel
                    </div>
                    {r.conditions.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                        <span style={{ color: c.met ? 'var(--sage)' : 'var(--ghost)' }}>
                          {c.met ? '✓' : '○'}</span>
                        <span style={{ color: c.met ? 'var(--text)' : 'var(--ghost)' }}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8 }}>
                  Zekerheid {r.confidence.toLowerCase()}. {r.race.note}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── GESCHIEDENIS ──────────────────────────────────────── */}
      <div onClick={() => setShowHistory(v => !v)}
        style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', padding: '8px 0',
          display: 'flex', justifyContent: 'space-between' }}>
        <span>Waarom deze coach anders rekent</span><span>{showHistory ? '▲' : '▼'}</span>
      </div>
      {showHistory && (
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, fontWeight: 600, marginBottom: 8 }}>
            {hist.lesson}
          </div>
          {LESSONS.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5,
              lineHeight: 1.5, marginBottom: 3 }}>
              <span style={{ color: 'var(--rust)' }}>·</span><span>{l}</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 600,
            lineHeight: 1.5, marginTop: 6 }}>{PROGRESSION_RULE}</div>

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 4 }}>
            Historische sessies
          </div>
          {HISTORICAL_RUNS.map(r => {
            const t = TOLERANCE_LABELS[r.tolerance];
            return (
              <div key={r.date} style={{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5 }}>
                  <span style={{ color: 'var(--ghost)', minWidth: 62 }}>{r.date}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {r.km} km · {r.pace}/km · HR {r.hr}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: t.color,
                    whiteSpace: 'nowrap' }}>{t.label}</span>
                </div>
                {r.note && (
                  <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 2 }}>
                    {r.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
