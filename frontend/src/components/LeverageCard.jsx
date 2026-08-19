import React, { useState, useMemo } from 'react';
import { highestLeverageAction, analyseDomain, reviewDomain, logAction,
  activeDomainIds, DOMAINS, REVIEW_WINDOWS } from '../leverage';
import { todayLocal } from '../datetime';

// "Waarom adviseert de coach juist dit?"
//
// Deze kaart beantwoordt die vraag zonder dat je zelf trainingsleer,
// voedingskunde of gedragsontwerp hoeft te kennen. Je bepaalt waar je heen
// wilt; de coach bepaalt wat vandaag de slimste hefboom is.

const STATUS_STYLE = {
  poor:    { label: 'knelpunt',    color: 'var(--rust)' },
  thin:    { label: 'wankel',      color: 'var(--gold)' },
  ok:      { label: 'op orde',     color: 'var(--sage)' },
  unknown: { label: 'niet gemeten', color: 'var(--ghost)' },
};

const CONF = {
  HIGH:   { label: 'hoog',      color: 'var(--green)' },
  MEDIUM: { label: 'gemiddeld', color: 'var(--gold)' },
  LOW:    { label: 'laag',      color: 'var(--ghost)' },
};

// ── Compacte kaart voor Vandaag ─────────────────────────────────
export default function LeverageCard({
  log, logs, currentDate = todayLocal(), coach, runGate, strengthGate, minutes = null,
}) {
  const [why, setWhy] = useState(false);
  const [done, setDone] = useState(null);

  const result = useMemo(() => highestLeverageAction({
    logs, currentDate, coach, runGate, strengthGate, minutes,
  }), [logs, currentDate, coach?.decision, runGate?.action, strengthGate?.action, minutes]);

  if (!result.available) {
    return (
      <div className="os-card" style={{ marginBottom: 10, borderLeft: '4px solid var(--blue)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Grootste hefboom vandaag
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.5 }}>{result.reason}</div>
      </div>
    );
  }

  const st = STATUS_STYLE[result.driver.status] || STATUS_STYLE.unknown;

  function record(outcome) {
    logAction({ date: currentDate, driverId: result.driver.id,
      domainId: result.domain.id, text: result.action.text, outcome });
    setDone(outcome);
  }

  return (
    <div className="os-card" style={{ marginBottom: 10, borderLeft: '4px solid var(--sage)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Grootste hefboom vandaag
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: st.color,
          border: `1px solid ${st.color}`, borderRadius: 99, padding: '1px 7px' }}>
          {result.driver.label.toLowerCase()}
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, marginBottom: 6 }}>
        {result.action.text}
      </div>

      <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 8 }}>
        {result.action.minutes > 0 ? `${result.action.minutes} min · ` : ''}
        dient {result.alsoServes.length > 1
          ? result.alsoServes.join(' en ')
          : result.domain.label.split('—')[0].trim()}
      </div>

      {done ? (
        <div style={{ fontSize: 11.5, color: 'var(--sage)', fontWeight: 600 }}>
          {done === 'done' ? 'Genoteerd — dat telt.'
            : done === 'annoying' ? 'Genoteerd. Ik stel dit niet meer voor.'
            : 'Genoteerd. Ik zoek morgen een andere ingang.'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => record('done')}
            style={{ fontSize: 12, whiteSpace: 'normal' }}>Gedaan</button>
          <button className="btn-secondary" onClick={() => record('skipped')}
            style={{ fontSize: 12, whiteSpace: 'normal' }}>Niet gelukt</button>
          <button onClick={() => record('annoying')}
            style={{ background: 'none', border: 'none', color: 'var(--ghost)',
              fontSize: 11.5, cursor: 'pointer' }}>past niet bij mij</button>
        </div>
      )}

      <div onClick={() => setWhy(v => !v)}
        style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between' }}>
        <span>Waarom dit?</span><span>{why ? '▲' : '▼'}</span>
      </div>
      {why && (
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 6 }}>
          {result.why.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: 'var(--sage)' }}>·</span><span>{w}</span>
            </div>
          ))}
          {result.alternatives.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                Ook mogelijk
              </div>
              {result.alternatives.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginBottom: 3 }}>
                  {a.action.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Volledig overzicht per doel, voor Progressie of Coach ───────
export function LeveragePanel({ logs, currentDate = todayLocal() }) {
  const [openId, setOpenId] = useState(null);
  const ids = useMemo(() => activeDomainIds(), []);
  const reviews = useMemo(
    () => ids.map(id => reviewDomain(id, { logs, currentDate })).filter(Boolean),
    [ids, logs, currentDate]);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Per doel: wat houdt het tegen?
      </div>

      {reviews.map(r => {
        const open = openId === r.domain.id;
        const st = STATUS_STYLE[r.bottleneck?.status] || STATUS_STYLE.unknown;
        const conf = CONF[r.confidence] || CONF.LOW;
        return (
          <div key={r.domain.id} className="os-card" style={{ marginBottom: 10 }}>
            <div onClick={() => setOpenId(open ? null : r.domain.id)}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 16 }}>{r.domain.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                  {r.domain.label.split('—')[0].trim()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45, marginTop: 1 }}>
                  Knelpunt: <span style={{ color: st.color, fontWeight: 700 }}>
                    {r.bottleneck?.label || '—'}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--ghost)' }}>{open ? '▲' : '▼'}</span>
            </div>

            {open && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
                  {r.reason}
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                  Alle factoren
                </div>
                {r.drivers.map(d => {
                  const ds = STATUS_STYLE[d.status] || STATUS_STYLE.unknown;
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8,
                      fontSize: 11.5, padding: '3px 0' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: ds.color,
                        flexShrink: 0, marginTop: 3 }} />
                      <span style={{ fontWeight: 600, minWidth: 0 }}>{d.label}</span>
                      <span style={{ color: 'var(--ghost)', flex: 1, minWidth: 0,
                        textAlign: 'right' }}>{d.note}</span>
                    </div>
                  );
                })}

                <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8,
                  paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div><strong>Beoordeling:</strong> {r.decision} · zekerheid {conf.label}</div>
                  <div><strong>Meten aan:</strong> {r.measures.join(', ')}.</div>
                  <div><strong>Herzien:</strong> {r.reviewWindow}.</div>
                  {r.dataNote && <div style={{ marginTop: 3 }}>{r.dataNote}</div>}
                  {r.domain.caution && (
                    <div style={{ marginTop: 4, color: 'var(--muted)' }}>{r.domain.caution}</div>
                  )}
                  {r.adherence?.enough && (
                    <div style={{ marginTop: 4 }}>{r.adherence.verdict}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.55, marginTop: 4 }}>
        Niet elk doel wordt elke dag beoordeeld. Herstel en slaap dagelijks,
        trainingsbelasting en routines wekelijks, lichaamssamenstelling en
        loopeconomie pas na vier tot acht weken. Kleine dagschommelingen zijn ruis.
      </div>
    </div>
  );
}
