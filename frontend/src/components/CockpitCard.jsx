import React, { useState, useMemo } from 'react';
import { headCoachDecision, explainConflicts } from '../headCoach';
import { recordFeedback } from '../aliveness';
import { logAction } from '../leverage';
import { todayLocal } from '../datetime';

// Het enige dat Vandaag standaard toont.
//
// Zes elementen, in deze volgorde, en niets meer:
//   1. de kleur van vandaag
//   2. één beste volgende actie
//   3. maximaal drie prioriteiten
//   4. één ding om te beschermen
//   5. hooguit één Future Self-moment
//   6. inklapbaar "waarom dit?"
//
// Alle metrics, forecasts, grafieken en losse coaches zitten achter
// progressive disclosure. De maatstaf: binnen vijftien seconden moet
// duidelijk zijn wat je nu doet en wat je vandaag niet hoeft.

const VERDICT = {
  GREEN: { cls: 'v-green', word: 'Groen' },
  AMBER: { cls: '',        word: 'Amber' },
  BLUE:  { cls: 'v-blue',  word: 'Blauw' },
  RED:   { cls: 'v-red',   word: 'Rood' },
};

export default function CockpitCard({
  log, logs, currentDate = todayLocal(), hasData, isFuture, saveFields, goToTab,
}) {
  const [why, setWhy] = useState(false);
  const [conflicts, setConflicts] = useState(false);
  const [actionDone, setActionDone] = useState(null);
  const [expDone, setExpDone] = useState(null);

  const result = useMemo(
    () => (hasData && !isFuture)
      ? headCoachDecision({ log: log || {}, logs, currentDate }) : null,
    [log, logs, currentDate, hasData, isFuture]);

  if (isFuture) {
    return (
      <div className="os-card" style={{ textAlign: 'center', padding: '26px 20px', marginBottom: 10 }}>
        <div style={{ fontSize: 14, color: 'var(--sub)' }}>Toekomstige dag — nog geen advies.</div>
      </div>
    );
  }
  if (!hasData || !result) {
    return (
      <div className="os-card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 10 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Nog geen data vandaag</div>
        <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
          Vul je check-in hieronder in — dan bereken ik je advies.
        </div>
      </div>
    );
  }

  const { status, action, priorities, protect, experience } = result;
  const v = VERDICT[status.decision] || VERDICT.AMBER;
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
    <div className={`os-card os-verdict ${v.cls}`} style={{ marginBottom: 10 }}>

      {/* 1. De kleur van vandaag */}
      <div className="os-v-status">{v.word} — {status.sub}</div>

      {/* 2. Eén beste volgende actie */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 24, lineHeight: 1.1 }}>{action.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="os-v-head" style={{ marginBottom: 2 }}>{action.headline}</div>
          <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.45 }}>
            {action.detail}
            {action.minutes ? ` · ${action.minutes} min` : ''}
          </div>
        </div>
      </div>

      {actionDone ? (
        <div style={{ fontSize: 11.5, color: 'var(--sage)', fontWeight: 600, marginBottom: 8 }}>
          {actionDone === 'done' ? 'Genoteerd — dat telt.' : 'Genoteerd. Morgen zoek ik een andere ingang.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          <button className="btn-primary" onClick={() => markAction('done')}
            style={{ fontSize: 12, whiteSpace: 'normal' }}>Gedaan</button>
          <button className="btn-secondary" onClick={() => markAction('skipped')}
            style={{ fontSize: 12, whiteSpace: 'normal' }}>Niet vandaag</button>
        </div>
      )}

      {/* 3. Maximaal drie prioriteiten */}
      <div style={{ paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Vandaag telt alleen
        </div>
        {priorities.empty ? (
          <button onClick={() => goToTab?.(1)}
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left',
              fontSize: 12, color: 'var(--sub)', cursor: 'pointer', lineHeight: 1.45 }}>
            {priorities.hint}
          </button>
        ) : (
          priorities.items.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12.5,
              lineHeight: 1.45, marginBottom: 2 }}>
              <span style={{ color: 'var(--sage)' }}>{i + 1}.</span>
              <span>{p.text}</span>
            </div>
          ))
        )}
      </div>

      {/* 4. Eén ding om te beschermen */}
      {protect && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>🛡</span>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>
            <span style={{ fontWeight: 700 }}>Bescherm {protect.what}.</span>{' '}
            <span style={{ color: 'var(--sub)' }}>{protect.why}</span>
          </div>
        </div>
      )}

      {/* 5. Hooguit één Future Self-moment */}
      {experience && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14, lineHeight: 1.3 }}>{experience.state?.emoji}</span>
            <div style={{ fontSize: 12, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
              {experience.text}
            </div>
          </div>
          {expDone ? (
            <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 4 }}>Genoteerd.</div>
          ) : (
            <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
              {[['much', 'Deed iets'], ['none', 'Niet echt'], ['annoying', 'Niet meer']].map(([id, label]) => (
                <button key={id} className="os-toggle-chip"
                  onClick={() => { recordFeedback(experience.id, id, { date: currentDate }); setExpDone(id); }}
                  style={{ fontSize: 10.5 }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Waarom dit? — inklapbaar, en wat je vandaag níet hoeft */}
      <div onClick={() => setWhy(w => !w)}
        style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between' }}>
        <span>Waarom dit?</span><span>{why ? '▲' : '▼'}</span>
      </div>

      {why && (
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
          {action.why.map((w, i) => (
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

          {/* De losse coaches en hun afweging — voor wie het wil weten */}
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
