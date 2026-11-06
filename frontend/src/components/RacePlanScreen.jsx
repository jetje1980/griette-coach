import React, { useState, useMemo } from 'react';
import { racePlan, INVOER, DAG, FASE } from '../racePlanDays';
import { loadRaceGoals } from '../raceGoalModel';
import { todayLocal, formatNLLong } from '../datetime';

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

function DagKaart({ dag, log, onSave, openDefault }) {
  const [open, setOpen] = useState(openDefault);
  const kleur = KLEUR[dag.kind] || 'var(--border)';
  const gedaan = dag.done;

  return (
    <div className="os-card" data-dag={dag.date} data-dag-soort={dag.kind}
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
  }), [currentDate, logs, race, tick]);

  function bewaar(datum, veld, waarde) {
    saveField?.(veld, waarde, datum);
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
          openDefault={d.isToday} />
      ))}
    </div>
  );
}
