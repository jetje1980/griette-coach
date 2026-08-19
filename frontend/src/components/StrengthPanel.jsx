import React, { useState, useMemo } from 'react';
import {
  scoreTrend, capacityChange, bandProgression, patternCoverage,
  benchmarkProgress, strengthStats, trainingSessions, sessionScore,
  explainScore, BENCHMARKS, saveBenchmarkEntry, loadBenchmarkEntries,
  deleteBenchmarkEntry, REFERENCE_SCORE,
} from '../strength';
import { strengthDecision, nextStrengthForecast, strengthOutlook, expectedVsActual } from '../strengthGate';
import { BAND_LEVELS, bandLabel, PATTERNS, resolveClass } from '../data/strengthClasses';
import { todayLocal } from '../datetime';

// Progressie → Strength: het bewijs dat je sterker wordt.
//
// De volgorde is bewust. Eerst het besluit van vandaag en de eerstvolgende
// les, dan de benchmarks in mensentaal, dan de vooruitblik, en pas
// daarna de grafieken. Niemand opent dit scherm om naar een
// sportwetenschappelijk dashboard te kijken.

const CONF = {
  HIGH:   { label: 'hoog',      color: 'var(--green)' },
  MEDIUM: { label: 'gemiddeld', color: 'var(--gold)' },
  LOW:    { label: 'laag',      color: 'var(--ghost)' },
};

function ConfidencePill({ level }) {
  const s = CONF[level] || CONF.LOW;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color,
      border: `1px solid ${s.color}`, borderRadius: 99, padding: '1px 7px', whiteSpace: 'nowrap' }}>
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
  return <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.55 }}>{children}</div>;
}

function Chart({ height = 88, children, ariaLabel }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 320 ${height}`} width="100%" height={height} role="img"
        aria-label={ariaLabel} style={{ display: 'block', minWidth: 260 }}>
        {children}
      </svg>
    </div>
  );
}

// ── 1. Eerstvolgende sessie ─────────────────────────────────────
function NextSessionCard({ log, logs, currentDate, runGate, coach }) {
  const gate = useMemo(
    () => strengthDecision({ log, logs, currentDate, runGate, coach }),
    [log, logs, currentDate, runGate?.action, coach?.decision]);
  const f = useMemo(
    () => nextStrengthForecast({ logs, currentDate, gate }),
    [logs, currentDate, gate]);

  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12,
      padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--sub)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</span>
    </div>
  );

  return (
    <>
      <div className="os-card" style={{ marginBottom: 12, borderLeft: `4px solid ${gate.color}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{gate.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
              color: gate.color, lineHeight: 1.25 }}>{gate.label}</div>
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.45, marginTop: 2 }}>
              {gate.headline}
            </div>
          </div>
        </div>
        {gate.blockers.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {gate.blockers.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5,
                lineHeight: 1.45, marginBottom: 2 }}>
                <span style={{ color: gate.color }}>·</span><span>{b}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {gate.daysSince == null ? 'Nog geen krachtsessie geregistreerd.'
            : `${gate.daysSince} dagen sinds je vorige krachtsessie · ${gate.weekCount}/${gate.maxPerWeek} deze week.`}
        </div>
      </div>

      {f.available && (
        <>
          <Label right={<ConfidencePill level={f.confidence} />}>
            Volgende sessie — {f.cls.title}
          </Label>
          <div className="os-card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Prestatievoorspelling
            </div>
            {row('Duur', `${f.duration} min`)}
            {row('Bandweerstand', f.band ? bandLabel(f.band) : 'geen band')}
            {row('Bewegingsfocus', (f.patterns || []).length ? f.patterns.join(' · ') : '—')}
            {row('Doel-RIR', `${f.targetRir} reps in reserve`)}
            {row('Verwachte RPE', `${f.expectedRpe.low}–${f.expectedRpe.high}/10`)}
            {row('Verwachte score', f.expectedScore
              ? `${f.expectedScore.low}–${f.expectedScore.high} punten` : '—')}

            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
              Gebaseerd op {f.observations} vergelijkbare {f.observations === 1 ? 'les' : 'lessen'}. {f.confidenceText}
            </div>

            {f.previous && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Vorige keer — {f.previous.date.slice(5)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
                  {[
                    f.previous.band ? `${bandLabel(f.previous.band)} band` : null,
                    f.previous.rpe != null ? `RPE ${f.previous.rpe}` : null,
                    f.previous.completed === 'full' ? 'afgemaakt'
                      : f.previous.completed === 'partial' ? 'gedeeltelijk' : 'niet afgemaakt',
                    f.previous.score ? `${f.previous.score} punten` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {f.expectation && (
                  <div style={{ fontSize: 11.5, color: 'var(--text)', lineHeight: 1.5, marginTop: 5 }}>
                    {f.expectation}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--sage)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                Veilig coachadvies
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.5 }}>{f.safe.headline}</div>
              {f.safe.lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5,
                  color: 'var(--sub)', lineHeight: 1.5, marginTop: 3 }}>
                  <span style={{ color: 'var(--sage)' }}>·</span><span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── 2. Benchmarks: start → nu ───────────────────────────────────
function BenchmarkCard() {
  const [adding, setAdding] = useState(null);
  const [value, setValue] = useState('');
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => benchmarkProgress(), [tick]);
  const withData = rows.filter(r => r.hasData);

  function save() {
    if (!adding || !value) return;
    saveBenchmarkEntry({ benchmarkId: adding, value: adding === 'band_level' ? value : Number(value) });
    setAdding(null); setValue(''); setTick(t => t + 1);
  }

  return (
    <>
      <Label right={
        <button onClick={() => setAdding(adding ? null : BENCHMARKS[1].id)}
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {adding ? 'sluiten' : '+ meting'}
        </button>
      }>Word ik sterker?</Label>

      <div className="os-card" style={{ marginBottom: 12 }}>
        {withData.length === 0 && !adding && (
          <Empty>
            Nog geen benchmarks. Een handjevol is genoeg: bandniveau, side plank in seconden,
            en hoe zwaar STRONG 30 voelt. Die drie vertellen samen of je sterker wordt.
          </Empty>
        )}

        {withData.map((b, i) => (
          <div key={b.id} style={{ padding: '7px 0',
            borderBottom: i < withData.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0 }}>
                {b.label}
                {b.derived && <span style={{ fontSize: 9.5, color: 'var(--ghost)' }}> · uit je sessies</span>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: b.changed ? (b.improved ? 'var(--sage)' : 'var(--rust)') : 'var(--text)' }}>
                {b.kind === 'band' ? bandLabel(b.start.value) : b.start.value}{b.kind === 'number' ? b.unit : ''}
                {' → '}
                {b.kind === 'band' ? bandLabel(b.current.value) : b.current.value}{b.kind === 'number' ? b.unit : ''}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 2 }}>
              {b.start.date.slice(5)} → {b.current.date.slice(5)} · {b.hint}
            </div>
          </div>
        ))}

        {adding && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {BENCHMARKS.map(b => (
                <button key={b.id} className={`os-toggle-chip ${adding === b.id ? 'active green' : ''}`}
                  onClick={() => { setAdding(b.id); setValue(''); }} style={{ fontSize: 11 }}>
                  {b.label}
                </button>
              ))}
            </div>
            {adding === 'band_level' ? (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {BAND_LEVELS.map(b => (
                  <button key={b.id} className={`os-toggle-chip ${value === b.id ? 'active green' : ''}`}
                    onClick={() => setValue(b.id)} style={{ fontSize: 11.5 }}>{b.label}</button>
                ))}
              </div>
            ) : (
              <input value={value} onChange={e => setValue(e.target.value)}
                type="number" inputMode="decimal"
                placeholder={BENCHMARKS.find(b => b.id === adding)?.unit || 'waarde'}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
                  borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8,
                  background: 'var(--surface)', color: 'var(--text)' }} />
            )}
            <button className="btn-primary" onClick={save} disabled={!value}
              style={{ fontSize: 12, whiteSpace: 'normal' }}>Meting opslaan</button>
          </div>
        )}
      </div>
    </>
  );
}

// ── 3. Vooruitblik 4 / 8 / 12 weken ─────────────────────────────
function OutlookCard({ logs, currentDate }) {
  const [open, setOpen] = useState(null);
  const outlook = useMemo(() => strengthOutlook({ logs, currentDate }), [logs, currentDate]);

  return (
    <>
      <Label right={<ConfidencePill level={outlook.confidence} />}>Nu → 4 → 8 → 12 weken</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        {/* De tijdlijn zelf */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 5, borderRadius: 99, background: 'var(--sage)', marginBottom: 4 }} />
            <div style={{ fontSize: 9.5, fontWeight: 700 }}>Nu</div>
            <div style={{ fontSize: 9, color: 'var(--ghost)' }}>
              {outlook.stats.avgScore ? `${outlook.stats.avgScore} punten` : 'geen basis'}
            </div>
          </div>
          {outlook.horizons.map(h => (
            <button key={h.weeks} onClick={() => setOpen(open === h.weeks ? null : h.weeks)}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none',
                border: 'none', padding: 0, cursor: 'pointer' }}>
              <div style={{ height: 5, borderRadius: 99,
                background: open === h.weeks ? 'var(--gold)' : 'var(--border)', marginBottom: 4 }} />
              <div style={{ fontSize: 9.5, fontWeight: 700 }}>{h.weeks} wk</div>
              <div style={{ fontSize: 9, color: 'var(--ghost)', fontVariantNumeric: 'tabular-nums' }}>
                +{h.capacityLow}–{h.capacityHigh}%
              </div>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.55 }}>
          Bij je huidige consistentie ({outlook.stats.perWeek} sessies per week) en herstel verwacht
          ik over acht weken ongeveer{' '}
          <strong style={{ color: 'var(--text)' }}>
            {outlook.horizons[1].capacityLow}–{outlook.horizons[1].capacityHigh}% hogere trainingscapaciteit
          </strong>{' '}
          binnen deze bewegingen.
        </div>

        {open && (() => {
          const h = outlook.horizons.find(x => x.weeks === open);
          return (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-serif)', marginBottom: 3 }}>
                {h.weeks} weken — {h.title}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 6 }}>
                {h.body}
              </div>
              {h.expect.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5,
                  lineHeight: 1.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--sage)' }}>·</span><span>{e}</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
                <strong>Voorwaarden: </strong>{h.conditions.join(' ')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 4 }}>
                Verwacht aantal sessies tot dan: {h.expectedSessions.low}–{h.expectedSessions.high}.
              </div>
            </div>
          );
        })()}

        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 10,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {outlook.dataNote} {outlook.caution}
        </div>
      </div>
    </>
  );
}

// ── 4. Verwacht versus werkelijk ────────────────────────────────
function ExpectedVsActualCard({ logs, currentDate }) {
  const [weeks, setWeeks] = useState(8);
  const res = useMemo(() => expectedVsActual({ logs, currentDate, weeks }), [logs, currentDate, weeks]);

  return (
    <>
      <Label>Verwacht versus werkelijk</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
          {[4, 8, 12].map(w => (
            <button key={w} className={`os-toggle-chip ${weeks === w ? 'active green' : ''}`}
              onClick={() => setWeeks(w)} style={{ fontSize: 11.5 }}>{w} weken</button>
          ))}
        </div>
        {!res.available ? (
          <Empty>{res.reason}</Empty>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px' }}>Verwacht</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {res.expected.sessionsLow}–{res.expected.sessionsHigh} sessies
                </div>
                <div style={{ fontSize: 11, color: 'var(--sub)', fontVariantNumeric: 'tabular-nums' }}>
                  +{res.expected.capacityLow}–{res.expected.capacityHigh}% capaciteit
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px' }}>Werkelijk</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: res.actual.sessions >= res.expected.sessionsLow ? 'var(--sage)' : 'var(--gold)' }}>
                  {res.actual.sessions} sessies
                </div>
                <div style={{ fontSize: 11, color: 'var(--sub)', fontVariantNumeric: 'tabular-nums' }}>
                  {res.actual.capacityPct == null ? '—'
                    : `${res.actual.capacityPct > 0 ? '+' : ''}${res.actual.capacityPct}% capaciteit`}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 10,
              paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              {res.verdict}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── 5. Grafieken ────────────────────────────────────────────────
function ScoreTrendChart({ currentDate }) {
  const weeks = useMemo(() => scoreTrend(currentDate, 12), [currentDate]);
  const withData = weeks.filter(w => w.score != null);
  if (withData.length < 2) {
    return (
      <>
        <Label>Krachtcapaciteit per week</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>
            Nog {2 - withData.length} week met een geregistreerde sessie nodig voor een lijn.
            De referentie is {REFERENCE_SCORE} punten: STRONG 30 op een medium band, RPE 6.
          </Empty>
        </div>
      </>
    );
  }
  const vals = withData.map(w => w.score);
  const lo = Math.min(...vals, REFERENCE_SCORE) * 0.85;
  const hi = Math.max(...vals, REFERENCE_SCORE) * 1.1;
  const X = (i) => 24 + (i / Math.max(1, weeks.length - 1)) * 288;
  const Y = (v) => 72 - ((v - lo) / Math.max(1, hi - lo)) * 58;
  const path = weeks.map((w, i) => w.score == null ? null : `${X(i).toFixed(1)},${Y(w.score).toFixed(1)}`)
    .filter(Boolean);

  return (
    <>
      <Label>Krachtcapaciteit per week</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={88} ariaLabel="Krachtcapaciteit per week">
          <line x1="24" y1="72" x2="312" y2="72" stroke="var(--border)" strokeWidth="1" />
          <line x1="24" y1={Y(REFERENCE_SCORE)} x2="312" y2={Y(REFERENCE_SCORE)}
            stroke="var(--gold)" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={path.join(' ')} fill="none" stroke="var(--sage)" strokeWidth="2" />
          {weeks.map((w, i) => w.score == null ? null : (
            <circle key={w.week} cx={X(i)} cy={Y(w.score)} r="2.6" fill="var(--sage)" />
          ))}
          <text x="2" y={Y(REFERENCE_SCORE) + 3} fontSize="7.5" fill="var(--gold)">{REFERENCE_SCORE}</text>
          <text x="24" y="84" fontSize="7.5" fill="var(--ghost)">{weeks[0].label}</text>
          <text x="270" y="84" fontSize="7.5" fill="var(--ghost)">{weeks[weeks.length - 1].label}</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          De gestippelde lijn is de referentie: STRONG 30 op medium band bij RPE 6 = {REFERENCE_SCORE} punten.
          Dezelfde les die lichter voelt levert vanzelf een hogere score op — dat is precies de bedoeling.
        </div>
      </div>
    </>
  );
}

function BandChart() {
  const bp = useMemo(() => bandProgression(), []);
  if (!bp.enough) {
    return (
      <>
        <Label>Bandweerstand</Label>
        <div className="os-card" style={{ marginBottom: 12 }}>
          <Empty>Nog geen sessies met een geregistreerde band. Vul na een les het bandniveau in — dat is de duidelijkste vorm van overload zonder gewichten.</Empty>
        </div>
      </>
    );
  }
  const pts = bp.points;
  const X = (i) => 24 + (i / Math.max(1, pts.length - 1)) * 288;
  const Y = (idx) => 66 - ((idx - 0.8) / 2.4) * 52;

  return (
    <>
      <Label>Bandweerstand over tijd</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <Chart height={82} ariaLabel="Bandweerstand per sessie">
          <line x1="24" y1="66" x2="312" y2="66" stroke="var(--border)" strokeWidth="1" />
          {BAND_LEVELS.map(b => (
            <text key={b.id} x="2" y={Y(b.index) + 3} fontSize="6.5" fill="var(--ghost)">{b.short}</text>
          ))}
          <polyline points={pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.index).toFixed(1)}`).join(' ')}
            fill="none" stroke="var(--sage)" strokeWidth="2" />
          {pts.map((p, i) => (
            <circle key={p.date + i} cx={X(i)} cy={Y(p.index)} r="2.6"
              fill={BAND_LEVELS.find(b => b.id === p.band)?.color || 'var(--sage)'} />
          ))}
          <text x="24" y="78" fontSize="7.5" fill="var(--ghost)">{pts[0].date.slice(5)}</text>
          <text x="270" y="78" fontSize="7.5" fill="var(--ghost)">{pts[pts.length - 1].date.slice(5)}</text>
        </Chart>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 6 }}>
          {bp.improved
            ? `Van ${bandLabel(bp.start.band)} naar ${bandLabel(bp.current.band)} — dat is echte progressive overload, ook zonder één kilo.`
            : `Zwaarste band tot nu toe: ${bandLabel(bp.best.band)}. Blijf op dit niveau tot dezelfde les duidelijk lichter voelt.`}
        </div>
      </div>
    </>
  );
}

function CoverageCard({ currentDate }) {
  const cov = useMemo(() => patternCoverage(currentDate, 28), [currentDate]);
  return (
    <>
      <Label>Bewegingspatronen — 28 dagen</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))',
          gap: 6, marginBottom: 8 }}>
          {cov.rows.map(r => (
            <div key={r.id} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, opacity: r.covered ? 1 : 0.28 }}>{r.emoji}</div>
              <div style={{ height: 4, borderRadius: 99, marginTop: 3,
                background: r.covered ? (r.thin ? 'var(--gold)' : 'var(--sage)') : 'var(--border)' }} />
              <div style={{ fontSize: 8.5, color: 'var(--ghost)', marginTop: 3, lineHeight: 1.2 }}>
                {r.label.split(' ')[0]}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700,
                color: r.covered ? 'var(--text)' : 'var(--ghost)' }}>{r.count}×</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
          {cov.advice}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 4 }}>
          Dekking {cov.pct}% over {cov.sessions} sessies — gewogen naar wat voor jou het zwaarst telt.
        </div>
      </div>
    </>
  );
}

function RpeFrequencyCard({ currentDate }) {
  const stats = useMemo(() => strengthStats(currentDate, 28), [currentDate]);
  const cap = useMemo(() => capacityChange(currentDate, 28), [currentDate]);
  const cell = (label, value, sub) => (
    <div>
      <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-serif)',
        fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--ghost)' }}>{sub}</div>}
    </div>
  );
  return (
    <>
      <Label>Laatste 28 dagen</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 10 }}>
          {cell('Sessies', stats.training, `${stats.perWeek}/week`)}
          {cell('Afgemaakt', stats.completionPct != null ? `${stats.completionPct}%` : '—')}
          {cell('Gem. RPE', stats.avgRpe ?? '—')}
          {cell('Capaciteit', cap.enough ? `${cap.changePct > 0 ? '+' : ''}${cap.changePct}%` : '—',
            cap.enough ? `${cap.previous} → ${cap.current}` : 'te weinig data')}
        </div>
      </div>
    </>
  );
}

// ── Het paneel ──────────────────────────────────────────────────
export default function StrengthPanel({ log, logs, currentDate = todayLocal(), runGate, coach }) {
  return (
    <div>
      <NextSessionCard log={log} logs={logs} currentDate={currentDate}
        runGate={runGate} coach={coach} />
      <BenchmarkCard />
      <OutlookCard logs={logs} currentDate={currentDate} />
      <ExpectedVsActualCard logs={logs} currentDate={currentDate} />
      <ScoreTrendChart currentDate={currentDate} />
      <BandChart />
      <CoverageCard currentDate={currentDate} />
      <RpeFrequencyCard currentDate={currentDate} />
    </div>
  );
}
