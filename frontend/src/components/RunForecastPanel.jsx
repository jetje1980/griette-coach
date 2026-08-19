import React, { useMemo, useState } from 'react';
import { computeHeadCoach, computeNextSession } from './CoachAdvice';
import { weekCalendar, longestToleratedRun } from '../restday';
import {
  nextSessionForecast, allRaceForecasts, economyTrend, averageDrift,
  forecastAccuracy, upcomingRaces,
} from '../forecast';
import { loadWorkouts, fmtPace, paceToMin, cardiacDrift, toleranceFor } from '../workouts';
import { loadHrSettings } from '../goals';

// Bewijsmateriaal voor de hardloopcoach: wat is er voorspeld, wat is er
// werkelijk gebeurd, en hoeveel rust zat ertussen. Alle grafieken zijn
// kale SVG — geen bibliotheek, geen externe verzoeken.

const C = {
  ink: 'var(--text)', sub: 'var(--sub)', ghost: 'var(--ghost)',
  line: 'var(--border)', run: 'var(--sage)', rest: 'var(--border)',
  strength: '#7A5AA8', warn: 'var(--gold)', bad: 'var(--rust)',
  proj: 'var(--blue)',
};

const CONF_STYLE = {
  HIGH:   { label: 'hoog',       color: 'var(--green)' },
  MEDIUM: { label: 'gemiddeld',  color: 'var(--gold)' },
  LOW:    { label: 'laag',       color: 'var(--ghost)' },
};

function ConfidencePill({ level }) {
  const s = CONF_STYLE[level] || CONF_STYLE.LOW;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color,
      border: `1px solid ${s.color}`, borderRadius: 99, padding: '1px 7px',
      whiteSpace: 'nowrap' }}>
      zekerheid {s.label}
    </span>
  );
}

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.5 }}>{children}</div>;
}

// Grafieken schalen mee met de breedte; de viewBox houdt de verhoudingen.
function Chart({ height = 90, children, ariaLabel }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 320 ${height}`} width="100%" height={height}
        role="img" aria-label={ariaLabel}
        style={{ display: 'block', minWidth: 260 }}>
        {children}
      </svg>
    </div>
  );
}

// ── 1. Rustdagpoort: het besluit van vandaag met zijn regels ────
function GateCard({ log, logs, currentDate }) {
  const [open, setOpen] = useState(false);
  const coach = useMemo(() => computeHeadCoach(log || {}, logs, currentDate),
    [log, logs, currentDate]);
  const gate = coach.gate;
  if (!gate) return null;

  const L = gate.load;
  const stat = (label, value, note) => (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: 'var(--ghost)' }}>{note}</div>}
    </div>
  );

  return (
    <div className="os-card" style={{ borderLeft: `4px solid ${gate.color}`, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{gate.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
            color: gate.color, lineHeight: 1.25 }}>{gate.label}</div>
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.45, marginTop: 2 }}>
            {gate.headline}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        {stat('Sinds laatste run', L.daysSinceLastRun == null ? '–' : `${L.daysSinceLastRun} d`,
          L.hoursAreEstimated && L.daysSinceLastRun != null ? 'geschat op de dag' : null)}
        {stat('Loopdagen 7d', `${L.runDays7}/${gate.frequency.ceiling}`)}
        {stat('Volume 7d', `${L.runMin7} min`,
          L.baselineRunMinPerWeek ? `basis ${L.baselineRunMinPerWeek}` : 'geen basis')}
        {stat('Rustdagen 7d', `${L.restDays7}`)}
      </div>

      {gate.blockers.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Waarom nu geen run
          </div>
          {gate.blockers.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5, lineHeight: 1.45,
              color: 'var(--text)', marginBottom: 2 }}>
              <span style={{ color: gate.color }}>·</span><span>{b}</span>
            </div>
          ))}
        </div>
      )}

      <div onClick={() => setOpen(v => !v)}
        style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span>{gate.action === 'RUN_TODAY' ? 'Wat lopen vrijgaf' : 'Wat een run weer vrijgeeft'}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
          {gate.released.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: 'var(--sage)' }}>✓</span><span>{r}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <strong>Frequentie:</strong> {gate.frequency.why}
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Wat mag omhoog:</strong> {gate.progression.reason}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 2. Weekkalender: runs én rustdagen ──────────────────────────
function CalendarStrip({ logs, currentDate }) {
  const days = useMemo(() => weekCalendar(logs, currentDate, 14), [logs, currentDate]);
  const color = { run: C.run, strength: C.strength, other: C.warn, rest: 'var(--border)' };
  const runCount = days.filter(d => d.type === 'run').length;
  const restCount = days.filter(d => d.type === 'rest').length;

  return (
    <>
      <Label>Runs en rustdagen — 14 dagen</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
          {days.map(d => (
            <div key={d.date} style={{ flex: '1 0 18px', minWidth: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, color: 'var(--ghost)', marginBottom: 2 }}>{d.dow}</div>
              <div title={`${d.date} — ${d.type}`}
                style={{
                  height: 26, borderRadius: 4, background: color[d.type],
                  border: d.isToday ? '2px solid var(--text)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 800,
                  color: d.type === 'rest' ? 'var(--ghost)' : '#fff',
                }}>
                {d.type === 'run' ? (d.km ? d.km.toFixed(1) : '·') : d.type === 'rest' ? '' : '·'}
              </div>
              {d.type === 'run' && d.tolerance && (
                <div style={{ fontSize: 8, marginTop: 1,
                  color: d.tolerance === 'good' ? 'var(--sage)'
                    : d.tolerance === 'poor' ? 'var(--rust)' : 'var(--ghost)' }}>
                  {d.tolerance === 'good' ? '✓' : d.tolerance === 'poor' ? '✕' : '?'}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 6, lineHeight: 1.5 }}>
          {runCount} loopdagen · {restCount} rustdagen · getal = km ·
          ✓ goed verdragen, ✕ slecht, ? nog geen herstelcheck
        </div>
      </div>
    </>
  );
}

// ── 3. Pace bij hartslag: waargenomen en geprojecteerd ──────────
function PaceAtHRChart({ logs, currentDate }) {
  const econ = useMemo(() => economyTrend(), [logs, currentDate]);
  const races = useMemo(() => upcomingRaces(currentDate), [currentDate]);
  const hr = loadHrSettings();

  if (!econ.enough) {
    return (
      <>
        <Label>Loopeconomie — tempo bij gelijke hartslag</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>{econ.note} Zodra er drie sessies met hartslag tussen {hr.easyLow} en {hr.easyHigh} bpm staan, verschijnt hier de trendlijn en de projectie naar je races.</Empty>
        </div>
      </>
    );
  }

  const pts = econ.points;
  const horizonDate = races.length ? races[races.length - 1].date : currentDate;
  const t0 = new Date(pts[0].date + 'T12:00:00').getTime();
  const tEnd = Math.max(new Date(horizonDate + 'T12:00:00').getTime(),
    new Date(currentDate + 'T12:00:00').getTime());
  const span = Math.max(1, tEnd - t0);

  // Projectie vanaf nu: tempo verandert met ratePerWeek seconden per km
  const projWeeks = (tEnd - new Date(currentDate + 'T12:00:00').getTime()) / (7 * 86400000);
  const projPace = econ.currentPace - (econ.ratePerWeek * projWeeks) / 60;

  const allPaces = [...pts.map(p => p.pace), projPace, econ.currentPace];
  const lo = Math.min(...allPaces) - 0.4, hi = Math.max(...allPaces) + 0.4;
  const X = (d) => 24 + ((new Date(d + 'T12:00:00').getTime() - t0) / span) * 288;
  const Xt = (ms) => 24 + ((ms - t0) / span) * 288;
  const Y = (p) => 74 - ((p - lo) / Math.max(0.1, hi - lo)) * 60;

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.pace).toFixed(1)}`).join(' ');
  const nowX = Xt(new Date(currentDate + 'T12:00:00').getTime());
  const endX = Xt(tEnd);
  // Onzekerheidsband rond de projectie: ±40% van de geprojecteerde winst
  const band = Math.abs(projPace - econ.currentPace) * 0.4 + 0.15;

  return (
    <>
      <Label right={<ConfidencePill level={econ.count >= 6 ? 'MEDIUM' : 'LOW'} />}>
        Loopeconomie — tempo bij hartslag {hr.easyLow}–{hr.easyHigh}
      </Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={92} ariaLabel="Tempo bij gelijke hartslag over tijd, met projectie">
          <line x1="24" y1="74" x2="312" y2="74" stroke={C.line} strokeWidth="1" />
          <line x1="24" y1="14" x2="24" y2="74" stroke={C.line} strokeWidth="1" />
          {/* onzekerheidsband van de projectie */}
          <path d={`M${nowX},${Y(econ.currentPace)} L${endX},${Y(projPace - band)} L${endX},${Y(projPace + band)} Z`}
            fill="var(--blue)" opacity="0.14" />
          <line x1={nowX} y1={Y(econ.currentPace)} x2={endX} y2={Y(projPace)}
            stroke={C.proj} strokeWidth="1.5" strokeDasharray="4 3" />
          <path d={path} fill="none" stroke={C.run} strokeWidth="2" />
          {pts.map(p => (
            <circle key={p.date} cx={X(p.date)} cy={Y(p.pace)} r="2.6" fill={C.run} />
          ))}
          <text x="2" y={Y(lo + 0.4) + 3} fontSize="7.5" fill="var(--ghost)">{fmtPace(hi - 0.4)}</text>
          <text x="2" y="18" fontSize="7.5" fill="var(--ghost)">{fmtPace(lo + 0.4)}</text>
          <text x={Math.min(endX - 40, 268)} y="88" fontSize="7.5" fill="var(--ghost)">
            {horizonDate.slice(5)}
          </text>
          <text x="24" y="88" fontSize="7.5" fill="var(--ghost)">{pts[0].date.slice(5)}</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          Nu <strong>{fmtPace(econ.currentPace)}/km</strong> bij hartslag {econ.currentHR};
          {' '}{econ.improvementSec >= 0 ? 'gewonnen' : 'ingeleverd'} {Math.abs(econ.improvementSec)} sec/km
          over {econ.weeks} weken. De stippellijn trekt {econ.ratePerWeek} sec/km per week door
          naar {horizonDate.slice(5)}; het gearceerde vlak is de onzekerheid daarvan.
          {econ.capped && ' De trend is afgetopt — een korte goede reeks mag zich niet maandenlang doorprojecteren.'}
        </div>
      </div>
    </>
  );
}

// ── 4. Verwacht versus werkelijk per sessie ─────────────────────
function ExpectedVsActual({ logs, currentDate }) {
  const rows = useMemo(() => forecastAccuracy(logs, currentDate, 10), [logs, currentDate]);
  const usable = rows.filter(r => r.expectedPace && r.actualPace);
  if (usable.length < 2) {
    return (
      <>
        <Label>Verwacht versus werkelijk</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>Nog te weinig sessies om verwachting en uitkomst naast elkaar te zetten — hiervoor zijn minstens twee runs met afstand én tijd nodig, bovenop de sessies waaruit de verwachting is opgebouwd.</Empty>
        </div>
      </>
    );
  }

  const all = usable.flatMap(r => [r.expectedPace, r.actualPace]);
  const lo = Math.min(...all) - 0.3, hi = Math.max(...all) + 0.3;
  const Y = (p) => 70 - ((p - lo) / Math.max(0.1, hi - lo)) * 56;
  const step = 288 / Math.max(1, usable.length);
  const X = (i) => 24 + step * (i + 0.5);

  const hits = usable.filter(r => Math.abs(r.deltaPace) <= 0.5).length;

  return (
    <>
      <Label>Verwacht versus werkelijk tempo</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={88} ariaLabel="Verwacht tempo tegenover werkelijk tempo per sessie">
          <line x1="24" y1="70" x2="312" y2="70" stroke={C.line} strokeWidth="1" />
          {usable.map((r, i) => (
            <g key={r.date}>
              <line x1={X(i)} y1={Y(r.expectedPace)} x2={X(i)} y2={Y(r.actualPace)}
                stroke={C.line} strokeWidth="1" />
              <circle cx={X(i)} cy={Y(r.expectedPace)} r="2.4" fill="none"
                stroke={C.proj} strokeWidth="1.4" />
              <circle cx={X(i)} cy={Y(r.actualPace)} r="2.8"
                fill={r.tolerance === 'poor' ? C.bad : r.tolerance === 'good' ? C.run : C.ghost} />
              <text x={X(i)} y="84" fontSize="7" fill="var(--ghost)" textAnchor="middle">
                {r.date.slice(5)}
              </text>
            </g>
          ))}
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          Open cirkel = verwacht, gevulde = gelopen (groen goed verdragen, rood niet, grijs nog onbekend).
          {' '}{hits} van {usable.length} sessies vielen binnen 30 sec/km van de verwachting.
        </div>
      </div>
    </>
  );
}

// ── 5. Weekbelasting: kilometers en minuten ─────────────────────
function WeeklyLoadChart({ logs, currentDate }) {
  const weeks = useMemo(() => {
    const monday = (() => {
      const d = new Date(currentDate + 'T12:00:00');
      const dow = d.getDay();
      d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
      return d;
    })();
    const ws = loadWorkouts().filter(w => w.activityType === 'run' || w.activityType == null);
    return Array.from({ length: 8 }, (_, i) => {
      const mon = new Date(monday); mon.setDate(monday.getDate() - (7 - i) * 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const ms = mon.toISOString().slice(0, 10), ss = sun.toISOString().slice(0, 10);
      const inWeek = ws.filter(w => w.date >= ms && w.date <= ss);
      return {
        label: ms.slice(5),
        km: +inWeek.reduce((s, w) => s + (parseFloat(w.distance) || 0), 0).toFixed(1),
        min: Math.round(inWeek.reduce((s, w) => s + (parseFloat(w.duration) || 0), 0)),
        days: new Set(inWeek.map(w => w.date)).size,
      };
    });
  }, [logs, currentDate]);

  const maxMin = Math.max(10, ...weeks.map(w => w.min));
  if (weeks.every(w => w.min === 0)) {
    return (
      <>
        <Label>Weekbelasting</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>Nog geen geregistreerde loopminuten in de afgelopen acht weken.</Empty>
        </div>
      </>
    );
  }

  const bw = 288 / weeks.length;
  return (
    <>
      <Label>Weekbelasting — minuten en loopdagen</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={86} ariaLabel="Loopminuten per week over acht weken">
          <line x1="24" y1="66" x2="312" y2="66" stroke={C.line} strokeWidth="1" />
          {weeks.map((w, i) => {
            const h = (w.min / maxMin) * 52;
            return (
              <g key={w.label}>
                <rect x={24 + i * bw + bw * 0.18} y={66 - h}
                  width={bw * 0.64} height={Math.max(0, h)} rx="2"
                  fill={i === weeks.length - 1 ? C.run : 'var(--sage-l)'}
                  stroke={C.run} strokeWidth="0.8" />
                <text x={24 + i * bw + bw / 2} y="78" fontSize="7" fill="var(--ghost)" textAnchor="middle">
                  {w.label}
                </text>
                {w.days > 0 && (
                  <text x={24 + i * bw + bw / 2} y={62 - h} fontSize="7.5" fill="var(--sub)" textAnchor="middle">
                    {w.days}×
                  </text>
                )}
              </g>
            );
          })}
          <text x="2" y="20" fontSize="7.5" fill="var(--ghost)">{maxMin}m</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          Deze week {weeks[weeks.length - 1].min} min over {weeks[weeks.length - 1].days} loopdagen
          ({weeks[weeks.length - 1].km} km). Het getal boven elke staaf is het aantal loopdagen —
          volume en frequentie horen niet in dezelfde week omhoog te gaan.
        </div>
      </div>
    </>
  );
}

// ── 6. Hartslagdrift ────────────────────────────────────────────
function DriftChart({ logs, currentDate }) {
  const pts = useMemo(() => loadWorkouts()
    .filter(w => (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate)
    .slice(0, 10).reverse()
    .map(w => ({ date: w.date, drift: cardiacDrift(w)?.drift ?? null }))
    .filter(p => p.drift != null), [logs, currentDate]);
  const avg = averageDrift();

  if (pts.length < 2) {
    return (
      <>
        <Label>Hartslagdrift</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>Drift is alleen te berekenen als een sessie splits met hartslag heeft, of als je de hartslag van de eerste en tweede helft apart invult. Uit Strava komt dit mee zodra er ronden geregistreerd zijn.</Empty>
        </div>
      </>
    );
  }

  const maxD = Math.max(12, ...pts.map(p => Math.abs(p.drift)));
  const Y = (d) => 40 - (d / maxD) * 26;
  const step = 288 / pts.length;

  return (
    <>
      <Label>Hartslagdrift binnen een sessie</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={72} ariaLabel="Hartslagdrift per sessie">
          <line x1="24" y1="40" x2="312" y2="40" stroke={C.line} strokeWidth="1" />
          {pts.map((p, i) => {
            const x = 24 + step * (i + 0.5);
            return (
              <g key={p.date}>
                <line x1={x} y1="40" x2={x} y2={Y(p.drift)}
                  stroke={p.drift >= 8 ? C.bad : p.drift >= 5 ? C.warn : C.run} strokeWidth="3"
                  strokeLinecap="round" />
                <text x={x} y="56" fontSize="7" fill="var(--ghost)" textAnchor="middle">
                  {p.date.slice(5)}
                </text>
              </g>
            );
          })}
          <text x="2" y="16" fontSize="7.5" fill="var(--ghost)">+{maxD}</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          Mediaan {avg?.drift ?? '–'} slagen over {avg?.n ?? 0} sessies. Boven 8 slagen zakt een
          lange inspanning merkbaar weg; dat is verrekend in de racevoorspelling.
        </div>
      </div>
    </>
  );
}

// ── 7. Hartslag tegen tempo ─────────────────────────────────────
function HRPaceScatter({ logs, currentDate }) {
  const pts = useMemo(() => loadWorkouts()
    .filter(w => (w.activityType === 'run' || w.activityType == null) && w.date <= currentDate)
    .map(w => {
      const pace = paceToMin(w.averagePace) ??
        (w.distance && w.duration ? w.duration / w.distance : null);
      return w.averageHR && pace
        ? { hr: Number(w.averageHR), pace, date: w.date, tol: toleranceFor(w, logs) } : null;
    }).filter(Boolean), [logs, currentDate]);

  if (pts.length < 4) return null;

  const hrs = pts.map(p => p.hr), paces = pts.map(p => p.pace);
  const hrLo = Math.min(...hrs) - 3, hrHi = Math.max(...hrs) + 3;
  const pLo = Math.min(...paces) - 0.3, pHi = Math.max(...paces) + 0.3;
  const X = (h) => 28 + ((h - hrLo) / Math.max(1, hrHi - hrLo)) * 278;
  const Y = (p) => 70 - ((p - pLo) / Math.max(0.1, pHi - pLo)) * 56;
  const hr = loadHrSettings();

  return (
    <>
      <Label>Hartslag tegenover tempo</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={86} ariaLabel="Spreiding van hartslag tegenover tempo per sessie">
          <line x1="28" y1="70" x2="312" y2="70" stroke={C.line} strokeWidth="1" />
          <line x1="28" y1="12" x2="28" y2="70" stroke={C.line} strokeWidth="1" />
          {hr.easyHigh > hrLo && hr.easyHigh < hrHi && (
            <line x1={X(hr.easyHigh)} y1="12" x2={X(hr.easyHigh)} y2="70"
              stroke={C.warn} strokeWidth="1" strokeDasharray="3 3" />
          )}
          {pts.map(p => (
            <circle key={p.date + p.hr} cx={X(p.hr)} cy={Y(p.pace)} r="3"
              fill={p.tol === 'poor' ? C.bad : p.tol === 'good' ? C.run : C.ghost}
              opacity="0.85" />
          ))}
          <text x="30" y="82" fontSize="7.5" fill="var(--ghost)">{Math.round(hrLo)} bpm</text>
          <text x="270" y="82" fontSize="7.5" fill="var(--ghost)">{Math.round(hrHi)} bpm</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          Links-onder is het doel: sneller bij dezelfde of lagere hartslag. De stippellijn is je
          bovengrens van {hr.easyHigh} bpm.
        </div>
      </div>
    </>
  );
}

// ── 8. Racevoorspelling ─────────────────────────────────────────
function RaceForecasts({ logs, currentDate }) {
  const forecasts = useMemo(() => allRaceForecasts(logs, currentDate), [logs, currentDate]);
  const [openId, setOpenId] = useState(null);

  if (!forecasts.length) {
    return (
      <>
        <Label>Racevoorspelling</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>Geen races meer op de kalender.</Empty>
        </div>
      </>
    );
  }

  return (
    <>
      <Label>Racevoorspelling</Label>
      {forecasts.map(f => {
        const open = openId === f.race.nr;
        return (
          <div key={f.race.nr} className="os-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)',
                flex: 1, minWidth: 0 }}>{f.race.name}</div>
              {f.available && <ConfidencePill level={f.confidence} />}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 10 }}>
              {f.race.date} · {f.race.distanceKm} km ·{' '}
              {{ trail: 'trail met hoogtemeters', beach: 'strand en duin', road: 'weg' }[f.race.terrain]}
              {f.available ? ` · nog ${Math.round(f.weeksOut)} weken` : ''}
            </div>

            {!f.available ? (
              <Empty>{f.reason}</Empty>
            ) : (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Prestatievoorspelling
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${f.scenarios.length}, 1fr)`,
                  gap: 6, marginBottom: 8 }}>
                  {f.scenarios.map(s => (
                    <div key={s.key} style={{ border: '1px solid var(--border)', borderRadius: 8,
                      padding: '7px 8px', background: s.key === 'likely' ? 'var(--sage-l)' : 'transparent' }}>
                      <div style={{ fontSize: 9.5, color: 'var(--muted)', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.2 }}>{s.finishTime}</div>
                      <div style={{ fontSize: 10, color: 'var(--sub)', fontVariantNumeric: 'tabular-nums' }}>
                        {s.pace}/km
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginBottom: 8 }}>
                  Hartslag in alle scenario's {f.expectedHR.low}–{f.expectedHR.high} bpm,
                  harde grens {f.expectedHR.hardLimit}. Basis: {f.anchorSource}.
                </div>

                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--sage)',
                    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                    Veilig coachadvies
                  </div>
                  {f.safe.lines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5,
                      lineHeight: 1.45, marginBottom: 3 }}>
                      <span style={{ color: 'var(--sage)' }}>·</span><span>{l}</span>
                    </div>
                  ))}
                </div>

                <div onClick={() => setOpenId(open ? null : f.race.nr)}
                  style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
                    fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between' }}>
                  <span>Waarop dit gebaseerd is, en wat het niet weet</span>
                  <span>{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
                    {f.limits.map((l, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: 'var(--ghost)' }}>·</span><span>{l}</span>
                      </div>
                    ))}
                    {f.scenarios.map(s => (
                      <div key={s.key} style={{ marginTop: 4 }}>
                        <strong>{s.label}:</strong> {s.note}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── 9. Volledige forecast voor de volgende sessie ───────────────
function NextSessionForecastCard({ log, logs, currentDate }) {
  const coach = useMemo(() => computeHeadCoach(log || {}, logs, currentDate),
    [log, logs, currentDate]);
  const next = useMemo(() => computeNextSession(log || {}, logs, currentDate),
    [log, logs, currentDate]);
  const f = useMemo(() => nextSessionForecast({
    run: next?.run || next?.previewRun, logs, currentDate, gate: coach.gate,
  }), [next?.run?.nr, next?.previewRun?.nr, logs, currentDate, coach.gate?.action]);

  if (!f.available) {
    return (
      <>
        <Label>Volgende sessie</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>{f.reason}</Empty>
          {f.safe && (
            <div style={{ fontSize: 11.5, color: 'var(--sub)', marginTop: 6, lineHeight: 1.5 }}>
              <strong>{f.safe.headline}</strong> {f.safe.detail}
            </div>
          )}
        </div>
      </>
    );
  }

  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10,
      fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--sub)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );
  const r = (x) => x == null ? '–' : x;

  return (
    <>
      <Label right={<ConfidencePill level={f.confidence} />}>
        Volgende sessie — T{f.run.nr}
      </Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
          {f.run.description}
        </div>
        {f.deferred && (
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.45, marginBottom: 8,
            padding: '6px 9px', background: 'var(--gold-l)', borderRadius: 6 }}>
            Niet vandaag — deze sessie komt op zijn vroegst {f.earliestDate.slice(5)} vrij.
            Wat hieronder staat is de vooruitblik, geen opdracht voor nu.
          </div>
        )}

        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Prestatievoorspelling
        </div>
        {row('Duur', f.duration ? `${f.duration} min` : '–')}
        {row('Afstand', f.distanceKm ? `${f.distanceKm.low}–${f.distanceKm.high} km` : '–')}
        {row('Doelhartslag', `${f.targetHR.low}–${f.targetHR.high} bpm, wandelen boven ${f.targetHR.hardLimit}`)}
        {row('Verwachte gem. hartslag', f.expectedHR
          ? `${Math.round(f.expectedHR.low)}–${Math.round(f.expectedHR.high)} bpm` : '–')}
        {row('Tempo loopblokken', f.runBlockPace
          ? `${fmtPace(f.runBlockPace.low)}–${fmtPace(f.runBlockPace.high)}/km` : 'niet te splitsen')}
        {row('Tempo hele sessie', f.sessionPace
          ? `${fmtPace(f.sessionPace.low)}–${fmtPace(f.sessionPace.high)}/km` : '–')}
        {row('Verwachte RPE', f.expectedRPE ? `${f.expectedRPE.low}–${f.expectedRPE.high}/10` : '–')}

        {f.runBlockNote && (
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
            {f.runBlockNote}
          </div>
        )}

        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
          {f.dataNote} {f.confidenceText}
        </div>

        {f.comparison && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Vergelijkbare sessie van {f.comparison.date.slice(5)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
              {[
                f.comparison.distance != null ? `${f.comparison.distance} km` : null,
                f.comparison.duration != null ? `${f.comparison.duration} min` : null,
                f.comparison.pace ? `${fmtPace(f.comparison.pace)}/km` : null,
                f.comparison.hr ? `HR ${f.comparison.hr}` : null,
                f.comparison.rpe != null ? `RPE ${f.comparison.rpe}` : null,
              ].filter(Boolean).join(' · ')}
              {' — '}
              {f.comparison.tolerance === 'good' ? 'goed verdragen'
                : f.comparison.tolerance === 'poor' ? 'niet goed verdragen'
                : 'nog geen herstelcheck'}.
              {f.comparison.paceDelta != null && Math.abs(f.comparison.paceDelta) > 0.05 && (
                <> Verwachting nu {Math.abs(Math.round(f.comparison.paceDelta * 60))} sec/km
                  {f.comparison.paceDelta < 0 ? ' sneller' : ' langzamer'}.</>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--sage)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Veilig coachadvies
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5, fontWeight: 600 }}>
            {f.safe.headline}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 3 }}>
            {f.safe.detail}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Paneel ──────────────────────────────────────────────────────
export default function RunForecastPanel({ log, logs, currentDate }) {
  const longest = useMemo(() => longestToleratedRun(logs), [logs]);
  return (
    <div>
      <GateCard log={log} logs={logs} currentDate={currentDate} />
      <NextSessionForecastCard log={log} logs={logs} currentDate={currentDate} />
      <CalendarStrip logs={logs} currentDate={currentDate} />
      <PaceAtHRChart logs={logs} currentDate={currentDate} />
      <ExpectedVsActual logs={logs} currentDate={currentDate} />
      <WeeklyLoadChart logs={logs} currentDate={currentDate} />
      <DriftChart logs={logs} currentDate={currentDate} />
      <HRPaceScatter logs={logs} currentDate={currentDate} />
      <RaceForecasts logs={logs} currentDate={currentDate} />
      {longest && (
        <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginBottom: 12 }}>
          Bovengrens van alle voorspellingen: je langste run met een bevestigde goede
          24–48u-respons is {longest.distance} km ({longest.duration} min) op {longest.date}.
        </div>
      )}
    </div>
  );
}
