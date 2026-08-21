import React, { useState } from 'react';
import {
  KINDS, GOAL_KIND, EFFORTS, PRIORITY, fieldsFor,
  saveRunGoal, deleteRunGoal, validateRunGoal, parseTargetTime, hydrate,
} from '../runGoalModel';
import { fmtSec, fmtPaceSec } from '../sessionMath';

// Een loopdoel invoeren — eerst wat voor soort, dan pas de velden.
//
// De volgorde is het punt. Eén formulier met alle velden dwingt je om bij een
// afstandsdoel een streeftijd in te vullen die je niet hebt, en bij een
// wedstrijd een hartslag die er niet toe doet. Erger: het suggereert dat die
// velden hetzelfde betekenen. Dat doen ze niet.
//
// Vooral het hartslagveld verdient zijn eigen uitleg, en die staat er dan ook
// bij: het is een gewenste uitkomst, geen grens voor onderweg.

const VELD_LABEL = {
  name: 'Naam',
  distanceKm: 'Afstand (km)',
  targetTimeSec: 'Gewenste tijd',
  outcomeAvgHr: 'Gewenste gemiddelde hartslag',
  continuous: 'Aaneengesloten',
  effort: 'Inspanning',
  recoveryCriterion: 'Goed herstel telt mee',
  date: 'Datum',
  window: 'Periode',
  terrain: 'Ondergrond',
};

const TERREIN = [
  { id: 'road', label: 'Weg' },
  { id: 'trail', label: 'Trail' },
  { id: 'beach', label: 'Strand/duin' },
];

function Veld({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
        letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
      {children}
      {hint && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 3 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export default function RunGoalEditor({ goal = null, onClose, onSaved }) {
  const [kind, setKind] = useState(goal?.kind || null);
  const [v, setV] = useState(() => ({
    name: goal?.name || '',
    distanceKm: goal?.distanceKm ?? '',
    targetTime: goal?.targetTimeSec != null ? fmtSec(goal.targetTimeSec) : '',
    outcomeAvgHr: goal?.outcomeAvgHr ?? '',
    continuous: goal?.continuous ?? false,
    effort: goal?.effort || 'easy',
    recoveryCriterion: goal?.recoveryCriterion ?? false,
    date: goal?.date || '',
    windowStart: goal?.windowStart || '',
    windowEnd: goal?.windowEnd || '',
    terrain: goal?.terrain || 'road',
    priority: goal?.priority || PRIORITY.SECONDARY,
  }));
  const [problems, setProblems] = useState([]);

  const upd = (k, val) => setV(p => ({ ...p, [k]: val }));
  const velden = kind ? fieldsFor(kind) : [];

  function bouw() {
    const targetTimeSec = v.targetTime ? parseTargetTime(v.targetTime) : null;
    return {
      ...(goal?.id ? { id: goal.id } : {}),
      kind,
      name: v.name.trim(),
      distanceKm: v.distanceKm === '' ? null : Number(v.distanceKm),
      targetTimeSec: velden.includes('targetTimeSec') ? targetTimeSec : null,
      outcomeAvgHr: velden.includes('outcomeAvgHr') && v.outcomeAvgHr !== ''
        ? Number(v.outcomeAvgHr) : null,
      continuous: velden.includes('continuous') ? !!v.continuous : false,
      effort: velden.includes('effort') ? v.effort : null,
      recoveryCriterion: velden.includes('recoveryCriterion') ? !!v.recoveryCriterion : false,
      date: kind === GOAL_KIND.RACE ? (v.date || null) : null,
      windowStart: kind === GOAL_KIND.RACE ? (v.date || null) : (v.windowStart || null),
      windowEnd: kind === GOAL_KIND.RACE ? (v.date || null) : (v.windowEnd || v.windowStart || null),
      terrain: velden.includes('terrain') ? v.terrain : 'road',
      priority: v.priority,
      enabled: true,
    };
  }

  function bewaar() {
    const g = bouw();
    const p = validateRunGoal(g);
    setProblems(p);
    if (p.length) return;
    saveRunGoal(g);
    onSaved?.();
  }

  // Live meekijken: wat vraagt dit doel eigenlijk?
  const voorbeeld = kind ? hydrate(bouw()) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220,
      background: 'rgba(42,37,32,0.5)', display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)',
        borderRadius: '18px 18px 0 0', padding: '20px 18px 34px', width: '100%',
        maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, flex: 1 }}>
            {goal?.id ? 'Doel bewerken' : 'Nieuw loopdoel'}
          </div>
          <button onClick={onClose} style={{ background: 'var(--border)', border: 'none',
            borderRadius: 99, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Stap 1: wat voor doel? */}
        {!kind && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Wat voor doel is dit?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {KINDS.map(k => (
                <button key={k.id} onClick={() => setKind(k.id)}
                  style={{ textAlign: 'left', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '11px 13px', background: 'var(--surface)',
                    cursor: 'pointer' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{k.emoji} {k.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.45,
                    marginTop: 2 }}>{k.vraag}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Stap 2: alleen de velden die bij deze soort horen */}
        {kind && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                {KINDS.find(k => k.id === kind)?.emoji} {KINDS.find(k => k.id === kind)?.label}
              </span>
              {!goal?.id && (
                <button onClick={() => setKind(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--sage)',
                    fontSize: 11, cursor: 'pointer' }}>ander soort</button>
              )}
            </div>

            <Veld label={VELD_LABEL.name}>
              <input className="os-input" value={v.name}
                onChange={e => upd('name', e.target.value)}
                placeholder="Bijvoorbeeld: Bereloop, of Halve marathon terug" />
            </Veld>

            <Veld label={VELD_LABEL.distanceKm}>
              <input className="os-input" type="number" step="0.1" value={v.distanceKm}
                onChange={e => upd('distanceKm', e.target.value)} />
            </Veld>

            {velden.includes('targetTimeSec') && (
              <Veld label={VELD_LABEL.targetTimeSec}
                hint={kind === GOAL_KIND.ENDURANCE
                  ? 'Optioneel en secundair — bij dit doel telt uitlopen, niet de klok.'
                  : 'Bijvoorbeeld 35:00 of 1:05:00. Het tempo volgt hieruit; dat vul je niet zelf in.'}>
                <input className="os-input" value={v.targetTime}
                  onChange={e => upd('targetTime', e.target.value)} placeholder="35:00" />
              </Veld>
            )}

            {velden.includes('outcomeAvgHr') && (
              <Veld label={VELD_LABEL.outcomeAvgHr}
                hint={'Dit is een gewenste uitkomst, geen grens voor onderweg. Wat je tijdens ' +
                  'een training mag, blijft uit je hartslagmodel komen — dat kijkt naar je ' +
                  'CPET, je recente verdragen runs en je respons van de vorige sessie.'}>
                <input className="os-input" type="number" value={v.outcomeAvgHr}
                  onChange={e => upd('outcomeAvgHr', e.target.value)} placeholder="140" />
              </Veld>
            )}

            {velden.includes('continuous') && (
              <Veld label={VELD_LABEL.continuous}
                hint="Zonder wandelpauzes. Dat is een andere vaardigheid dan de afstand aankunnen.">
                <button className={`os-toggle-chip ${v.continuous ? 'active green' : ''}`}
                  onClick={() => upd('continuous', !v.continuous)} style={{ fontSize: 11.5 }}>
                  {v.continuous ? 'Ja, aaneengesloten' : 'Run/walk mag'}
                </button>
              </Veld>
            )}

            {velden.includes('effort') && (
              <Veld label={VELD_LABEL.effort}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {EFFORTS.map(e => (
                    <button key={e.id} className={`os-toggle-chip ${v.effort === e.id ? 'active green' : ''}`}
                      onClick={() => upd('effort', e.id)} style={{ fontSize: 11 }}>{e.label}</button>
                  ))}
                </div>
              </Veld>
            )}

            {velden.includes('recoveryCriterion') && (
              <Veld label={VELD_LABEL.recoveryCriterion}
                hint="Zonder schoon herstel binnen 24–48 uur telt de afstand niet als gehaald.">
                <button className={`os-toggle-chip ${v.recoveryCriterion ? 'active green' : ''}`}
                  onClick={() => upd('recoveryCriterion', !v.recoveryCriterion)}
                  style={{ fontSize: 11.5 }}>
                  {v.recoveryCriterion ? 'Ja, herstel telt mee' : 'Nee'}
                </button>
              </Veld>
            )}

            {velden.includes('terrain') && (
              <Veld label={VELD_LABEL.terrain}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {TERREIN.map(t => (
                    <button key={t.id} className={`os-toggle-chip ${v.terrain === t.id ? 'active green' : ''}`}
                      onClick={() => upd('terrain', t.id)} style={{ fontSize: 11 }}>{t.label}</button>
                  ))}
                </div>
              </Veld>
            )}

            {kind === GOAL_KIND.RACE ? (
              <Veld label={VELD_LABEL.date}>
                <input className="os-input" type="date" value={v.date}
                  onChange={e => upd('date', e.target.value)} />
              </Veld>
            ) : (
              <Veld label={VELD_LABEL.window}
                hint="Een periode mag: 'ergens in de winter' is een eerlijker doel dan een verzonnen dag.">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="os-input" type="date" value={v.windowStart}
                    onChange={e => upd('windowStart', e.target.value)} />
                  <input className="os-input" type="date" value={v.windowEnd}
                    onChange={e => upd('windowEnd', e.target.value)} />
                </div>
              </Veld>
            )}

            <Veld label="Prioriteit">
              <div style={{ display: 'flex', gap: 5 }}>
                {[['primary', 'Primair'], ['secondary', 'Secundair'], ['someday', 'Ooit']].map(([id, l]) => (
                  <button key={id} className={`os-toggle-chip ${v.priority === id ? 'active green' : ''}`}
                    onClick={() => upd('priority', id)} style={{ fontSize: 11 }}>{l}</button>
                ))}
              </div>
            </Veld>

            {/* Wat vraagt dit doel? Meteen zichtbaar, zodat een typefout opvalt. */}
            {voorbeeld?.criteria?.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 11px', marginBottom: 10 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ghost)',
                  letterSpacing: '0.4px', marginBottom: 4 }}>DIT DOEL IS GEHAALD ALS</div>
                {voorbeeld.criteria.map(c => (
                  <div key={c.id} style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
                    · {c.label}{c.secondary ? ' (secundair)' : ''}
                  </div>
                ))}
                {voorbeeld.targetPaceLabel && (
                  <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 4 }}>
                    Dat komt neer op {voorbeeld.targetPaceLabel}/km.
                  </div>
                )}
              </div>
            )}

            {problems.length > 0 && (
              <div style={{ border: '1px solid var(--rust)', borderRadius: 8,
                padding: '8px 10px', marginBottom: 10 }}>
                {problems.map((p, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: 'var(--rust)', lineHeight: 1.45 }}>
                    ⚠ {p.text}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={bewaar} style={{ flex: 1, fontSize: 13 }}>
                Bewaren
              </button>
              {goal?.id && (
                <button onClick={() => { deleteRunGoal(goal.id); onSaved?.(); }}
                  style={{ background: 'none', border: '1px solid var(--rust)',
                    color: 'var(--rust)', borderRadius: 8, fontSize: 12, padding: '0 14px',
                    cursor: 'pointer' }}>Verwijderen</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
