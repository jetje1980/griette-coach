import React, { useState, useMemo } from 'react';
import { racePlan, swapDays, INVOER, DAG, FASE } from '../racePlanDays';
import { loadRaceGoals } from '../raceGoalModel';
import { loadWeightPhase, saveWeightPhase, FASE as GEWICHTSFASE } from '../weightPhase';
import BackfillPanel from './BackfillPanel';
import { todayLocal, formatNLLong } from '../datetime';
import { saveGoal } from '../goals';

// Het dagplan naar Ameland.
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT SCHERM MOET DOEN, EN WAT NIET
//
// Zij vroeg om alle trainingen tot 12 december op datum, met per dag wat
// er te doen is aan slaap, rust, eten en kracht — en om per dag de
// gegevens te kunnen invullen waarmee het advies scherper wordt.
//
// Wat dit scherm NIET doet: de sessie van vandaag bepalen. Die staat op
// Vandaag en komt uit de planner die de herstelcheck, de poort en de
// dosering meeweegt. Hier staat het voornemen voor de weken; vandaag staat
// er met de aantekening dat de dagkaart leidend is. Twee schermen die
// allebei zeggen wat je vandaag moet lopen, is precies hoe deze app eerder
// zichzelf tegensprak.
//
// De invulvelden schrijven naar hetzelfde daglog als alle andere schermen,
// dus er ontstaat geen tweede opslag.
// ─────────────────────────────────────────────────────────────────

const KLEUR = {
  [DAG.RUN]: 'var(--sage)',
  [DAG.RUN_KRACHT]: 'var(--sage)',
  [DAG.KRACHT]: 'var(--gold)',
  [DAG.WANDEL]: 'var(--border)',
  [DAG.RUST]: 'var(--border)',
  [DAG.RACE]: 'var(--green)',
};
const SOORT = {
  [DAG.RUN]: 'Hardlopen',
  [DAG.RUN_KRACHT]: 'Hardlopen + kracht',
  [DAG.KRACHT]: 'Kracht',
  [DAG.WANDEL]: 'Wandelen',
  [DAG.RUST]: 'Rust',
  [DAG.RACE]: 'RACE',
};

function Veld({ id, waarde, onSave }) {
  const meta = INVOER[id];
  const [open, setOpen] = useState(false);
  if (!meta) return null;

  const invoer = () => {
    if (meta.type === 'getal') {
      return (
        <input type="number" inputMode="decimal" defaultValue={waarde ?? ''}
          data-veld={id} step="0.1"
          onBlur={e => {
            const v = e.target.value === '' ? null : Number(e.target.value.replace(',', '.'));
            if (v !== waarde) onSave(id, v);
          }}
          style={{ width: 72, fontSize: 12, padding: '4px 6px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)' }} />
      );
    }
    if (meta.type === 'ja_nee') {
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {[['ja', true], ['nee', false]].map(([lab, v]) => (
            <button key={lab} type="button" data-veld={id} data-waarde={lab}
              onClick={() => onSave(id, waarde === v ? null : v)}
              className={`os-toggle-chip ${waarde === v ? 'active green' : ''}`}
              style={{ fontSize: 11 }}>{lab}</button>
          ))}
        </div>
      );
    }
    const opties = meta.opties || [];
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {opties.map((lab, i) => {
          const v = meta.type === 'schaal3' ? i : lab;
          return (
            <button key={lab} type="button" data-veld={id} data-waarde={String(v)}
              onClick={() => onSave(id, waarde === v ? null : v)}
              className={`os-toggle-chip ${waarde === v ? 'active green' : ''}`}
              style={{ fontSize: 11 }}>{lab}</button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none',
            padding: 0, cursor: 'pointer', fontSize: 11.5, color: 'var(--text)',
            fontWeight: 600 }}>
          {meta.label} {meta.eenheid ? <span style={{ color: 'var(--ghost)',
            fontWeight: 400 }}>({meta.eenheid})</span> : null} <span
              style={{ color: 'var(--ghost)', fontWeight: 400 }}>{open ? '▲' : 'ⓘ'}</span>
        </button>
        {invoer()}
      </div>
      {open && (
        <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 3 }}>
          {meta.waarom}
        </div>
      )}
    </div>
  );
}

function DagKaart({ dag, log, onSave, openDefault, buren, onRuil }) {
  const [open, setOpen] = useState(openDefault);
  const [ruilOpen, setRuilOpen] = useState(false);
  const kleur = KLEUR[dag.kind] || 'var(--border)';
  const gedaan = dag.done;

  return (
    <div className="os-card" data-dag={dag.date} data-dag-soort={dag.kind}
      data-dag-opslot={dag.gated ? '1' : undefined}
      style={{ marginBottom: 8, borderLeft: `3px solid ${kleur}`,
        opacity: dag.isPast && !gedaan?.logged ? 0.75 : 1 }}>

      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', display: 'flex',
        alignItems: 'baseline', gap: 8 }}>
        <div style={{ width: 54, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>
            {dag.dayShort} {dag.date.slice(8)}-{dag.date.slice(5, 7)}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--ghost)' }}>
            {dag.daysToRace === 0 ? 'vandaag race' : `nog ${dag.daysToRace}`}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>
            {SOORT[dag.kind]}
            {dag.run ? <span style={{ fontWeight: 400 }}> — {dag.run.description}</span> : null}
            {dag.strength ? <span style={{ fontWeight: 400 }}> — {dag.strength.naam}</span> : null}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
            {dag.note}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {dag.isToday && (
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--gold)',
              border: '1px solid var(--gold)', borderRadius: 99, padding: '1px 6px' }}>
              vandaag
            </span>
          )}
          {gedaan?.run && (
            <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>✓ gelopen</div>
          )}
          {dag.lateLuteal && (
            <div style={{ fontSize: 9, color: 'var(--gold)' }}>luteaal</div>
          )}
          {dag.swappedWith && (
            <div style={{ fontSize: 9, color: 'var(--gold)' }} data-geruild={dag.swappedWith}>
              geruild
            </div>
          )}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {dag.isToday && (
            <div style={{ fontSize: 11, color: 'var(--gold)', lineHeight: 1.5,
              marginBottom: 6 }} data-vandaag-let-op>
              Wat je vandaag écht loopt staat op Vandaag — die kaart weegt je herstelcheck
              en de poort van vandaag mee. Dit hier is het voornemen van het plan.
            </div>
          )}

          {dag.run && (
            <div style={{ fontSize: 11.5, lineHeight: 1.55, marginBottom: 6 }}>
              <strong>Loop:</strong> {dag.run.description} ({dag.run.minutes} min, niveau {dag.run.level})
              {dag.run.strides ? ' + 6 × 12 sec versnelling erachter' : ''}
              {/* Hoe hard en op welke hartslag — hetzelfde voorschrift als
                  op de dagkaart, niet een tweede berekening. */}
              {(dag.run.pace || dag.run.hr) && (
                <div style={{ marginTop: 3 }} data-tempo={dag.run.paceMin || ''}>
                  {dag.run.pace && (
                    <div><strong>Tempo:</strong> {dag.run.pace}
                      <span style={{ color: 'var(--ghost)' }}> — het tempo is de uitkomst,
                        je hartslag is de grens</span></div>
                  )}
                  {dag.run.hr && (
                    <div data-hartslag><strong>Hartslag:</strong> {dag.run.hr}</div>
                  )}
                </div>
              )}
              {/* ── Welke progressie hoort hier ─────────────────
                  Het doeltempo komt uit haar gemeten efficiëntie plus wat
                  per week haalbaar is, niet uit haar wenstijd. Daarnaast
                  wat de vorige vergelijkbare sessie werkelijk opleverde:
                  gemeten, en daarmee het eerlijke ijkpunt. */}
              {dag.run.target && (
                <div style={{ marginTop: 5, paddingTop: 5,
                  borderTop: '1px dashed var(--border)' }}
                  data-doel={dag.run.target.targetPace}>
                  <div style={{ fontWeight: 700, color: 'var(--sage)' }}>
                    Doel: {dag.run.target.line}
                  </div>
                  {dag.run.target.lastLine && (
                    <div style={{ color: 'var(--sub)' }} data-vorige>
                      {dag.run.target.lastLine}
                      {dag.run.target.last && !dag.run.target.last.comparable
                        && ' (andere hartslag — alleen als ruwe vergelijking)'}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45 }}>
                    {dag.run.target.why}
                  </div>
                </div>
              )}
              {!dag.run.target && dag.run.targetWhy && (
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 4 }}
                  data-geen-doel>{dag.run.targetWhy}</div>
              )}

              {dag.run.fromPlanner && (
                <div style={{ fontSize: 10.5, color: 'var(--sage)', marginTop: 2 }}
                  data-uit-planner>
                  Uit de dagkaart van vandaag.
                  {dag.run.templateDescription
                    && dag.run.templateDescription !== dag.run.description
                    && ` Het weekpatroon wilde hier ${dag.run.templateDescription}; de coach
                        weegt je herstelcheck en de poort van vandaag mee.`}
                </div>
              )}
              {dag.run.timeOnFeet && (
                <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}
                  data-tijd-op-benen={dag.run.timeOnFeet}>
                  {dag.run.timeOnFeetWhy}
                </div>
              )}
            </div>
          )}
          {dag.strength && (
            <div style={{ fontSize: 11.5, lineHeight: 1.55, marginBottom: 6 }}>
              <strong>Kracht — {dag.strength.naam}</strong>
              <ul style={{ margin: '3px 0 0', paddingLeft: 16 }}>
                {dag.strength.oefeningen.map(o => (
                  <li key={o} style={{ fontSize: 11, color: 'var(--sub)' }}>{o}</li>
                ))}
              </ul>
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 3 }}>
                {dag.strength.waarom}
              </div>
            </div>
          )}
          {dag.challengeDay && (
            <div style={{ fontSize: 11.5, marginBottom: 6 }}>
              <strong>Challenge:</strong> dag {dag.challengeDay} van 75 — de acht minuten
            </div>
          )}

          {dag.targets.map(t => (
            <div key={t.id} style={{ marginBottom: 5 }} data-doel={t.id}>
              <div style={{ fontSize: 11.5 }}>
                <strong>{t.label}:</strong> {t.waarde}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
                {t.waarom}
              </div>
            </div>
          ))}

          {/* ── Ruilen met een andere dag ───────────────────────
              Ruilen en niet verplaatsen: anders staat er op de ene dag
              niets meer en op de andere twee dingen, of verliest de week
              stilletjes een training. Bij een ruil wisselen twee dagen van
              inhoud en blijft het weektotaal gelijk. */}
          {!dag.isPast && (
            <div style={{ marginTop: 8, paddingTop: 7,
              borderTop: '1px solid var(--border)' }}>
              <button type="button" data-ruil-knop={dag.date}
                onClick={() => setRuilOpen(v => !v)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 11, color: 'var(--sage)', fontWeight: 700 }}>
                {dag.swappedWith
                  ? `↔ geruild met ${dag.swappedWith.slice(8)}-${dag.swappedWith.slice(5, 7)} — terugdraaien of anders ruilen`
                  : '↔ ruilen met een andere dag'}
              </button>
              {ruilOpen && (
                <div style={{ marginTop: 5 }} data-ruil-keuzes={buren.length}>
                  <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45,
                    marginBottom: 4 }}>
                    De twee dagen wisselen van inhoud. Wat aan de kalender hangt —
                    je cyclus, de taper, het niveau van die week — blijft bij de datum.
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {buren.map(b => (
                      <button key={b.date} type="button" data-ruil-met={b.date}
                        className="os-toggle-chip"
                        onClick={() => { onRuil(dag.date, b.date); setRuilOpen(false); }}
                        style={{ fontSize: 11 }}>
                        {b.dayShort} {b.date.slice(8)}-{b.date.slice(5, 7)}
                        <span style={{ color: 'var(--ghost)' }}>
                          {' '}· {b.run ? 'loop' : b.strength ? 'kracht' : 'rust'}
                        </span>
                      </button>
                    ))}
                  </div>
                  {dag.swappedWith && (
                    <button type="button" data-ruil-terug
                      onClick={() => { onRuil(dag.date, dag.swappedWith); setRuilOpen(false); }}
                      style={{ background: 'none', border: 'none', padding: '4px 0 0',
                        cursor: 'pointer', fontSize: 10.5, color: 'var(--rust)' }}>
                      ruil terugdraaien
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 8 }} data-invoer={dag.inputs.length}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ghost)',
              letterSpacing: '0.4px', marginBottom: 2 }}>
              VANDAAG INVULLEN · tik op een naam om te zien wat ermee gebeurt
            </div>
            {dag.inputs.map(id => (
              <Veld key={id} id={id} waarde={log?.[id] ?? null}
                onSave={(veld, waarde) => onSave(dag.date, veld, waarde)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RacePlanScreen({ logs = {}, currentDate = todayLocal(), saveField }) {
  const [alles, setAlles] = useState(false);
  const [tick, setTick] = useState(0);

  const race = useMemo(() => {
    const goals = loadRaceGoals().filter(g => g.enabled !== false && g.date >= currentDate);
    return goals.sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }, [currentDate]);

  const plan = useMemo(() => racePlan({
    currentDate, logs,
    raceDate: race?.date || null,
    raceName: race?.name || 'Je volgende race',
    raceKm: race?.distanceKm ?? null,
    raceSec: race?.targetTimeSec ?? null,
    raceTerrain: race?.terrain ?? null,
  }), [currentDate, logs, race, tick]);

  function bewaar(datum, veld, waarde) {
    saveField?.(veld, waarde, datum);
    setTick(t => t + 1);
  }

  function ruil(a, b) {
    swapDays(a, b);
    setTick(t => t + 1);
  }

  // Een knop die een doel verzet. Het weekplafond zit in de doelenlaag, en
  // daar leest de poort hem ook — dus hoeft het schema hier niets te weten
  // van wat het plafond doet; het volgt het getal.
  function zetDoel({ metric, value }) {
    saveGoal({ domain: 'RUN', metric, target_value: String(value),
      direction: 'at_most' });
    setTick(t => t + 1);
  }

  if (!plan.known) {
    return (
      <div className="os-screen">
        <div className="os-card" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          {plan.why} Zet een racedoel met een datum in de toekomst, dan staat hier het
          dagplan ernaartoe.
        </div>
      </div>
    );
  }

  const zichtbaar = alles ? plan.days : plan.days.filter(d => d.daysToRace >= 0
    && (d.isToday || !d.isPast));

  return (
    <div className="os-screen" data-raceplan={plan.days.length}>
      {/* ── Waar je naartoe werkt ──────────────────────────── */}
      <div className="os-card" style={{ marginBottom: 12,
        borderLeft: '3px solid var(--green)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-serif)',
            lineHeight: 1 }}>{plan.daysToRace}</div>
          <div style={{ fontSize: 12.5, color: 'var(--sub)', flex: 1 }}>
            dagen tot <strong>{plan.raceName}</strong><br />
            <span style={{ fontSize: 11 }}>{formatNLLong(plan.raceDate)}</span>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
          {plan.note}
        </div>
      </div>

      {/* ── Staat hardlopen op slot? ──────────────────────────
          Dit stond alleen op Vandaag, en dit overzicht tekende er zijn
          eigen loopdag naast. Eén poort, twee lezers — en zij las ze
          allebei. Nu staat hij hier, met dezelfde reden en dezelfde
          datum, plus wat de blokkade opheft. */}
      {plan.gate?.locksUntil && (
        <div className="os-card" style={{ marginBottom: 12,
          borderLeft: '3px solid var(--gold)' }} data-poort={plan.gate.action}>
          <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4 }}>
            🔒 Hardlopen staat op slot tot {formatNLLong(plan.gate.locksUntil)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 4 }}>
            {plan.gate.binding?.reason || plan.gate.blockers?.[0] || plan.gate.headline}
          </div>
          {plan.gate.binding?.unlock && (
            <div style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 5, fontWeight: 700 }}>
              {plan.gate.binding.unlock}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6,
            paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            De dagen hieronder staan daarom op kracht of rust tot die datum. De sessie die
            klaarligt staat op de eerste loopdag die weer mag.
          </div>
        </div>
      )}

      {/* ── Wat je nu remt ─────────────────────────────────
          Bovenaan, want dit is waar de winst ligt die geen extra
          training kost. Op volgorde van grootte, met erbij wat het
          kost en wat de eerste stap is. */}
      {plan.brakes?.remmen?.length > 0 && (
        <>
          <div className="os-section-label">Wat je nu remt</div>
          <div className="os-card" style={{ marginBottom: 12,
            borderLeft: '3px solid var(--gold)' }}
            data-remmen={plan.brakes.remmen.length}>
            <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4,
              marginBottom: 6 }}>
              {plan.brakes.kop}
            </div>
            {plan.brakes.remmen.map((r, i) => (
              <div key={r.id} data-rem={r.id}
                style={{ padding: '7px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--ghost)',
                    fontFamily: 'var(--font-serif)' }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, flex: 1 }}>{r.label}</span>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>nu: {r.stand}</div>
                {r.kost && (
                  <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45,
                    marginTop: 2 }}>{r.kost}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--sage)', lineHeight: 1.5,
                  marginTop: 2, fontWeight: 600 }}>→ {r.wat}</div>
              </div>
            ))}
            {plan.brakes.goed?.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
                marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                Staat wel goed: {plan.brakes.goed.map(g => g.label.toLowerCase()).join(', ')}.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Wat een trainer verwacht ──────────────────────── */}
      {plan.expectation?.known && (
        <>
          <div className="os-section-label">Wat is er haalbaar</div>
          <div className="os-card" style={{ marginBottom: 12,
            borderLeft: '3px solid var(--sage)' }} data-verwachting>
            <div style={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.45 }}>
              {plan.expectation.line}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55,
              marginTop: 4 }}>
              {plan.expectation.nowLine} {plan.expectation.gainLine}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 7, flexWrap: 'wrap' }}>
              {[['voorzichtig', plan.expectation.low], ['verwacht', plan.expectation.mid],
                ['als alles meezit', plan.expectation.high]].map(([label, s2]) => (
                <div key={label} data-scenario={label}>
                  <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800,
                    fontFamily: 'var(--font-serif)' }}>
                    {plan.expectation.fmt.time(s2.time)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sub)' }}>
                    {plan.expectation.fmt.pace(s2.pace)}/km
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 7,
              paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <strong>Hoe gerekend:</strong> {plan.expectation.method}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 3 }}>
              <strong>In twee fasen:</strong> {plan.expectation.phases}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--gold)', lineHeight: 1.5, marginTop: 3 }}>
              {plan.expectation.conditions}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 4 }}>
              Op vlakke weg zou dit {plan.expectation.fmt.time(plan.expectation.mid.flatTime)}{' '}
              zijn ({plan.expectation.fmt.pace(plan.expectation.mid.flatPace)}/km) — het
              verschil is de ondergrond, niet je vorm.
            </div>
          </div>
        </>
      )}

      {/* ── De weken ───────────────────────────────────────── */}
      <div className="os-section-label">De weken</div>
      <div className="os-card" style={{ marginBottom: 12 }} data-weken={plan.weeks.length}>
        {plan.weeks.map(w => (
          <div key={w.index} data-week={w.index}
            style={{ display: 'flex', gap: 8, padding: '4px 0',
              borderTop: w.index === plan.weeks[0].index ? 'none' : '1px solid var(--border)' }}>
            <span style={{ width: 86, fontSize: 10.5, color: 'var(--ghost)',
              fontVariantNumeric: 'tabular-nums' }}>
              {w.from.slice(8)}-{w.from.slice(5, 7)} → {w.to.slice(8)}-{w.to.slice(5, 7)}
            </span>
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700 }}>{w.phaseLabel}</span>
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>
              {w.runs}× lopen · {w.strength}× kracht · {w.minutes} min
            </span>
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6,
          paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          {Object.values(FASE).filter(f => plan.weeks.some(w => w.phase === f.id))
            .map(f => `${f.label}: ${f.doel}`).join(' · ')}
        </div>
      </div>

      {/* ── Wat er na een ruil niet meer klopt ─────────────── */}
      {plan.warnings?.length > 0 && (
        <div className="os-card" style={{ marginBottom: 12,
          borderLeft: '3px solid var(--gold)' }} data-waarschuwingen={plan.warnings.length}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ghost)',
            letterSpacing: '0.4px', marginBottom: 4 }}>
            WAT OPVALT AAN DE INDELING
          </div>
          {plan.warnings.map(w => (
            <div key={w.id} data-waarschuwing={w.id}
              style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 700,
                color: w.level === 'let op' ? 'var(--rust)' : 'var(--sub)' }}>
                {w.level}:
              </span>{' '}{w.text}
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 4 }}>
            Niets hiervan blokkeert iets — jij beslist. Dit staat er zodat je weet wat een
            ruil met de rest van de week doet.
          </div>
        </div>
      )}

      {/* ── Gewicht: het voordeel én de kosten ─────────────── */}
      {plan.weight?.known && (
        <>
          <div className="os-section-label">Gewicht</div>
          <div className="os-card" style={{ marginBottom: 12 }} data-gewicht>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 900,
                fontFamily: 'var(--font-serif)' }}>{plan.weight.current} kg</span>
              <span style={{ fontSize: 11.5, color: 'var(--sub)', flex: 1 }}>
                {plan.weight.target != null
                  ? `doel ${plan.weight.target} kg · nog ${plan.weight.toGo} kg`
                  : 'geen doelgewicht ingesteld'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 3 }}>
              {plan.weight.rateNote}{plan.weight.rateVerdict ? ` — ${plan.weight.rateVerdict}` : ''}
            </div>

            {plan.weight.tradeoff && (
              <div style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.55 }}
                data-gewicht-afweging>
                <div style={{ color: 'var(--sage)' }}>{plan.weight.tradeoff.totalLine}</div>
                {plan.weight.tradeoff.raceLine && (
                  <div style={{ color: 'var(--sub)' }}>{plan.weight.tradeoff.raceLine}</div>
                )}
                <div style={{ color: 'var(--rust)', marginTop: 3 }}>
                  {plan.weight.tradeoff.costLine}
                </div>
                <div style={{ color: 'var(--text)', marginTop: 3, fontWeight: 600 }}>
                  {plan.weight.tradeoff.advice}
                </div>
              </div>
            )}

            <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ghost)',
                letterSpacing: '0.4px', marginBottom: 4 }}>JOUW KEUZE</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: 11.5 }}>doel</label>
                <input type="number" step="0.5" data-gewicht-doel
                  defaultValue={plan.weight.target ?? ''}
                  onBlur={e => { saveWeightPhase({ target: e.target.value === '' ? null
                    : Number(e.target.value.replace(',', '.')) }); setTick(t => t + 1); }}
                  style={{ width: 66, fontSize: 12, padding: '4px 6px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)' }} /> kg
                {[[GEWICHTSFASE.AFVALLEN, 'nu afvallen'],
                  [GEWICHTSFASE.BEHOUD, `onderhoud tot ${plan.raceDate.slice(8)}-${plan.raceDate.slice(5, 7)}`]]
                  .map(([id, lab]) => (
                    <button key={id} type="button" data-gewichtsfase={id}
                      className={`os-toggle-chip ${plan.weight.phase === id ? 'active green' : ''}`}
                      onClick={() => {
                        saveWeightPhase({ phase: plan.weight.phase === id ? null : id,
                          holdUntil: id === GEWICHTSFASE.BEHOUD ? plan.raceDate : null });
                        setTick(t => t + 1);
                      }} style={{ fontSize: 11 }}>{lab}</button>
                  ))}
              </div>
              {plan.fuel?.why && (
                <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 5 }}
                  data-brandstof={plan.fuel.phase}>
                  {plan.fuel.why}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Geschiedenis aanvullen ─────────────────────────── */}
      <BackfillPanel logs={logs} currentDate={currentDate} saveField={saveField} />

      {/* ── De knoppen waaraan je kunt draaien ─────────────── */}
      <div className="os-section-label">Waar je aan kunt draaien</div>
      <div className="os-card" style={{ marginBottom: 12 }} data-knoppen={plan.levers.length}>
        {plan.levers.map(k => (
          <div key={k.id} data-knop={k.id}
            style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, fontWeight: 800, flex: 1 }}>{k.label}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3px',
                color: k.status === 'goed' ? 'var(--sage)' : 'var(--gold)' }}>
                {k.status === 'goed' ? 'STAAT GOED' : 'HIER VALT WINST'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
              nu: {k.stand}
            </div>
            <div style={{ fontSize: 11, color: 'var(--sage)', lineHeight: 1.5 }}>
              doel: {k.doel}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
              {k.waarom}
            </div>
            {/* Een knop waaraan je werkelijk kunt draaien, in plaats van
                een advies dat je elders moet gaan uitvoeren. */}
            {k.actie && (
              <button type="button" data-knop-actie={k.actie.id}
                onClick={() => zetDoel(k.actie)}
                style={{ marginTop: 5, padding: '5px 10px', borderRadius: 6,
                  border: '1px solid var(--sage)', background: 'transparent',
                  color: 'var(--sage)', fontSize: 11, fontWeight: 800,
                  cursor: 'pointer' }}>
                {k.actie.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Dag voor dag ───────────────────────────────────── */}
      <div className="os-section-label" style={{ display: 'flex',
        justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Dag voor dag</span>
        <button type="button" onClick={() => setAlles(v => !v)} data-toon-alles
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {alles ? 'alleen vanaf vandaag' : 'ook de dagen die voorbij zijn'}
        </button>
      </div>
      {zichtbaar.map(d => (
        <DagKaart key={d.date} dag={d} log={logs[d.date]} onSave={bewaar}
          openDefault={d.isToday} onRuil={ruil}
          buren={plan.days.filter(x => !x.isPast && x.date !== d.date
            && Math.abs(new Date(x.date) - new Date(d.date)) <= 4 * 86400000)} />
      ))}
    </div>
  );
}
