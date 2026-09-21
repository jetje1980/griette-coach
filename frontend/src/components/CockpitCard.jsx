import React, { useState, useMemo, useEffect } from 'react';
import { headCoachDecision, explainConflicts } from '../headCoach';
import { recordPrediction } from '../predictionLog';
import { logAction } from '../leverage';
import { todayLocal, formatNLLong } from '../datetime';
import { restDayDecision } from '../restday';
import { coachPlan } from '../coachPlan';
import { todayState, whatIsMissing, UI_STATE, STATE_META } from '../todayState';

// Het enige dat Vandaag standaard toont.
//
// Vijf blokken, in deze volgorde, en niets meer:
//   1. status — één toestand, die hetzelfde zegt als de actie eronder
//   2. één primaire actie, en nooit twee
//   3. bij een training: een preview van vier regels, geen uitvoerscherm
//   4. één ding om te beschermen
//   5. wat er nog nodig is, alleen als het het advies blokkeert
//
// "Waarom dit?" zit eronder, ingeklapt. Alle metrics, forecasts, grafieken en
// losse coaches zitten achter progressive disclosure of staan op Progressie.
//
// De maatstaf uit de opdracht: binnen drie seconden moet duidelijk zijn hoe je
// erbij zit, wat je nu doet, wat je beschermt en of er nog iets moet.

export default function CockpitCard({
  log, logs, currentDate = todayLocal(), hasData, isFuture, saveFields, onCta,
}) {
  const [why, setWhy] = useState(false);
  const [conflicts, setConflicts] = useState(false);
  const [actionDone, setActionDone] = useState(null);

  // De loopoort en de sessie die eruit volgt, uit dezelfde twee bronnen als
  // de rest van de app: restDayDecision zegt of er gelopen mag worden,
  // coachPlan welke vorm dat dan is.
  const loopPoort = useMemo(() => {
    if (isFuture) return null;
    try {
      const poort = restDayDecision({ log: log || {}, logs, currentDate });
      const vrij = poort.action === 'RUN_TODAY';
      // De sessie wordt altijd berekend, ook als lopen op slot staat. Zij
      // wil kunnen zien wát er straks klaarstaat — anders weet je wel dat je
      // moet wachten maar niet waarop, en dat maakt wachten zwaarder dan
      // nodig.
      const plan = coachPlan({ log: log || {}, logs, currentDate });
      return {
        vrij,
        reden: vrij
          ? (poort.summary || poort.headline)
          : (poort.blockers?.[0] || poort.headline || 'Vandaag geen loopprikkel.'),
        sessie: plan?.choice?.available ? plan.choice.session.label : null,
        sessieMinuten: plan?.choice?.available ? plan.choice.session.minutes : null,
        sessieWaarom: plan?.choice?.available ? plan.choice.session.note : null,
        vanaf: poort.earliestRunDate ? formatNLLong(poort.earliestRunDate) : 'zodra je herstel het toelaat',
        dagen: poort.daysUntilRun ?? 0,
      };
    } catch { return null; }
  }, [log, logs, currentDate, isFuture]);

  const result = useMemo(
    () => (hasData && !isFuture)
      ? headCoachDecision({ log: log || {}, logs, currentDate }) : null,
    [log, logs, currentDate, hasData, isFuture]);

  // De voorspelling van vandaag bevriezen.
  //
  // Eén keer per dag, en daarna niet meer — recordPrediction laat een bestaand
  // record staan. Dat is het hele punt: zodra je een run afvinkt verandert het
  // budget, en een voorspelling die met de uitkomst meebeweegt voorspelt niets.
  //
  // Het gebeurt in een effect en niet in de berekening hierboven, omdat een
  // useMemo geen schrijfacties hoort te doen: die kan meerdere keren lopen.
  useEffect(() => {
    if (!result || isFuture) return;
    if (currentDate !== todayLocal()) return;   // alleen vandaag, niet bij terugbladeren
    try { recordPrediction(result, { currentDate }); } catch { /* opslag vol of geblokkeerd */ }
  }, [result, currentDate, isFuture]);

  const ui = useMemo(
    () => todayState({ result, hasData, isFuture, log, logs, currentDate }),
    [result, hasData, isFuture, log, logs, currentDate]);
  const meta = STATE_META[ui.state] || STATE_META.AMBER;
  const missing = whatIsMissing({ result, hasData, state: ui.state });

  // De toekomst en de lege ochtend delen dezelfde vorm: één zin en, als er
  // iets te doen valt, één knop. Geen kaart vol lege secties.
  if (isFuture || !hasData || !result) {
    return (
      <div className={`os-card os-verdict ${meta.cls}`} style={{ marginBottom: 10 }}>
        <div className="os-v-status">{meta.word} — {ui.headline}</div>
        <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.55,
          marginBottom: ui.cta ? 10 : 0 }}>{ui.sub}</div>
        {ui.cta && (
          <button className="btn-primary" data-cta={ui.cta.kind}
            style={{ fontSize: 13, whiteSpace: 'normal' }}
            onClick={() => onCta?.(ui.cta)}>{ui.cta.text}</button>
        )}
      </div>
    );
  }

  const { action, priorities, protect } = result;
  const notToday = result.detail.notToday;

  function markAction(outcome) {
    setActionDone(outcome);
    if (action.driver) {
      logAction({ date: currentDate, driverId: action.driver.id,
        domainId: result.detail.leverage?.domain?.id, text: action.headline, outcome });
    }
    if (outcome === 'done' && action.source === 'strength') saveFields?.({ strength_done: true });
  }

  return (
    <div className={`os-card os-verdict ${meta.cls}`} style={{ marginBottom: 10 }}>

      {/* 1. Eén status, die hetzelfde zegt als de actie eronder */}
      <div className="os-v-status">{meta.word} — {ui.headline}</div>

      {/* ── Mag ik vandaag hardlopen? ──────────────────────────
          Dit stond nergens compleet. Op Vandaag las je alleen wát er
          vrijgegeven was ("kracht is vrijgegeven"); dat hardlopen op slot
          stond, waaróm, en wanneer het terugkomt, stond op Lichaam →
          Training — als je daar ging kijken. Twee schermen voor één vraag.
          Nu staat het antwoord hier, met de reden en de datum erbij. */}
      {loopPoort && (
        <div data-looppoort style={{ marginBottom: 9, padding: '8px 10px', borderRadius: 8,
          background: 'var(--surface)',
          borderLeft: `4px solid ${loopPoort.vrij ? 'var(--sage)' : 'var(--gold)'}` }}>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>
            {loopPoort.vrij ? '🏃 Hardlopen is vandaag vrijgegeven'
              : '🔒 Hardlopen staat vandaag op slot'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 2 }}>
            {loopPoort.reden}
          </div>
          {!loopPoort.vrij && (
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              <span style={{ color: 'var(--ghost)' }}>Weer vrij vanaf: </span>
              <strong>{loopPoort.vanaf}</strong>
              {loopPoort.dagen > 0 && (
                <span style={{ color: 'var(--ghost)' }}>
                  {' '}({loopPoort.dagen} {loopPoort.dagen === 1 ? 'dag' : 'dagen'})
                </span>
              )}
            </div>
          )}

          {/* De sessie zelf, ook als je er nog dagen op moet wachten. */}
          {loopPoort.sessie && (
            <div data-volgende-sessie style={{ marginTop: 5, paddingTop: 5,
              borderTop: '1px solid var(--divide)' }}>
              <div style={{ fontSize: 11.5 }}>
                <span style={{ color: 'var(--ghost)' }}>
                  {loopPoort.vrij ? 'De sessie die vrijkomt: ' : 'De sessie die dan klaarstaat: '}
                </span>
                <strong>{loopPoort.sessie}</strong>
                {loopPoort.sessieMinuten && (
                  <span style={{ color: 'var(--ghost)' }}> · {loopPoort.sessieMinuten} min</span>
                )}
              </div>
              {loopPoort.sessieWaarom && (
                <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45,
                  marginTop: 2 }}>
                  {loopPoort.sessieWaarom}
                </div>
              )}
              {!loopPoort.vrij && (
                <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
                  marginTop: 2 }}>
                  Dit is de sessie op basis van vandaag. Valt er tussendoor een
                  respons tegen, dan kiest de coach opnieuw.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. De actie zelf */}
      {ui.sub && (
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
          {ui.sub}
        </div>
      )}

      {/* 3. Bij een training: vier regels vitrine. De uitvoering staat op
             Lichaam, en daar gaat de knop naartoe. */}
      {ui.preview && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <span style={{ fontSize: 22, lineHeight: 1.1 }}>{action.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="os-v-head" style={{ marginBottom: 2 }}>{ui.preview.type}</div>
            {[ui.preview.duration, ui.preview.structure, ui.preview.pace]
              .filter(Boolean).map((r, i) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5,
                  color: 'var(--sub)' }}>{r}</div>
              ))}
          </div>
        </div>
      )}

      {/* Precies één knop. Bij rust en bij een afgeronde dag: geen. */}
      {ui.cta && (ui.cta.kind === 'mark' ? (
        actionDone ? (
          <div style={{ fontSize: 11.5, color: 'var(--sage)', fontWeight: 600, marginBottom: 8 }}>
            {actionDone === 'done' ? 'Genoteerd — dat telt.' : 'Genoteerd. Morgen zoek ik een andere ingang.'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            <button className="btn-primary" data-cta="mark" onClick={() => markAction('done')}
              style={{ fontSize: 12.5, whiteSpace: 'normal' }}>Gedaan</button>
            <button className="btn-secondary" onClick={() => markAction('skipped')}
              style={{ fontSize: 12, whiteSpace: 'normal' }}>Niet vandaag</button>
          </div>
        )
      ) : (
        <button className="btn-primary" data-cta={ui.cta.kind}
          style={{ fontSize: 13, whiteSpace: 'normal', marginBottom: 8 }}
          onClick={() => onCta?.(ui.cta)}>{ui.cta.text}</button>
      ))}

      {/* 4. Eén ding om te beschermen */}
      {protect && (
        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>🛡</span>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700 }}>Bescherm {protect.what}.</span>{' '}
            <span style={{ color: 'var(--sub)' }}>{protect.why}</span>
          </div>
        </div>
      )}

      {/* 5. Alleen wat het advies werkelijk blokkeert */}
      {missing && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 12, color: 'var(--gold)', lineHeight: 1.45 }} data-missing="1">
          Nog nodig: {missing.what.toLowerCase()}.
        </div>
      )}

      {/* De drie dingen die je zelf koos — alleen als je ze hebt gekozen.
          Een lege sectie met een uitnodiging erin las als een tweede knop. */}
      {!priorities.empty && priorities.items.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Vandaag telt alleen
          </div>
          {priorities.items.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12.5,
              lineHeight: 1.45, marginBottom: 2 }}>
              <span style={{ color: 'var(--sage)' }}>{i + 1}.</span>
              <span>{p.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Waarom dit? — ingeklapt, met wat je vandaag niet hoeft */}
      <div onClick={() => setWhy(w => !w)} data-why="1"
        style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between' }}>
        <span>Waarom dit?</span><span>{why ? '▲' : '▼'}</span>
      </div>

      {why && (
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
          {/* Maximaal drie redenen. De vierde is altijd de minst belangrijke. */}
          {(action.why || []).slice(0, 3).map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: 'var(--sage)' }}>·</span><span>{w}</span>
            </div>
          ))}

          {notToday.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                Wat je vandaag niet hoeft
              </div>
              {notToday.map((n, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: 'var(--rust)' }}>✕</span>
                  <span><strong>{n.what}</strong> — {n.why}</span>
                </div>
              ))}
            </div>
          )}

          {result.detail.review.items.length > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8 }}>
              Weer kijken: {result.detail.review.items
                .map(r => `${r.what} op ${r.when.slice(5)}`).join(' · ')}.
            </div>
          )}

          <div onClick={(e) => { e.stopPropagation(); setConflicts(c => !c); }}
            style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
              fontSize: 10.5, color: 'var(--muted)', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between' }}>
            <span>Hoe de coaches het eens werden</span><span>{conflicts ? '▲' : '▼'}</span>
          </div>
          {conflicts && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.55, marginTop: 5 }}>
              {explainConflicts(result).map((c, i) => (
                <div key={i} style={{ marginBottom: 3 }}>
                  <strong>{c.coach}</strong> wilde {c.wanted} — {c.outcome}
                  {c.reason ? `: ${c.reason.toLowerCase()}` : ''}.
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
