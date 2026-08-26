import React, { useMemo, useState, useCallback } from 'react';
import { todayLocal, formatNLLong } from '../datetime';
import {
  classifyChange, CHANGE, recompositionSignal, personalBandwidth,
  hormonalPattern, comparableCycleDays,
  proposeMilestone, saveMilestone, activeMilestone, reviewDue, reviewMilestone,
  loadMilestones, REVIEW_WEEKS,
} from '../bodyReview';

// Het oordeel over weken, en het tussendoel dat eruit volgt.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT GEEN VOORTGANGSBALK IS
//
// Een balk van 65 naar 55 kg suggereert dat de weg ertussen recht is en dat
// elke week een gelijk stukje oplevert. Zo werkt geen lichaam, en zeker niet
// een lichaam in de perimenopauze met een historie van PEM.
//
// Wat hier staat is een periode van zes weken met een richting, en daarna een
// beoordeling waarin een gemist centimeterdoel géén mislukking hoeft te zijn
// (§36). Het doel verschuift op grond van hoe zij werkelijk reageerde — niet
// op grond van een planning die bij het maken al niets van haar wist.
// ─────────────────────────────────────────────────────────────────

const KLEUR = {
  [CHANGE.STRUCTURAL]: 'var(--sage)',
  [CHANGE.TEMPORARY]: 'var(--gold)',
  [CHANGE.UNCLEAR]: 'var(--ghost)',
};

const VERDICT_TEKST = {
  GEHAALD: 'Gehaald',
  CIJFER_GEMIST_MAAR_BEELD_BETER: 'Getal gemist, beeld beter',
  NIET_GEHAALD: 'Niet gehaald',
};

function Rij({ label, waarde, sub, kleur }) {
  return (
    <div style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0 }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: kleur || 'var(--text)' }}>
          {waarde}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function BodyReviewPanel({ currentDate = todayLocal() }) {
  const [versie, setVersie] = useState(0);
  const herlaad = useCallback(() => setVersie(v => v + 1), []);
  const [open, setOpen] = useState(false);

  const data = useMemo(() => {
    const asOf = currentDate;
    return {
      gewicht: classifyChange('weight', { asOf }),
      taille: classifyChange('waist', { asOf }),
      navel: classifyChange('navel', { asOf }),
      band: personalBandwidth('weight', { asOf }),
      recomp: recompositionSignal({ asOf }),
      patroon: hormonalPattern('weight', { asOf }),
      cyclus: comparableCycleDays('weight', { asOf }),
      doel: activeMilestone({ asOf }),
      review: reviewDue({ asOf }),
      voorstel: proposeMilestone({ asOf }),
      historie: loadMilestones(),
    };
    // versie dwingt een herberekening af nadat er een doel is bewaard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, versie]);

  const beoordeling = useMemo(
    () => (data.doel && data.review.due ? reviewMilestone(data.doel, { asOf: currentDate }) : null),
    [data.doel, data.review.due, currentDate]);

  function zetDoel() {
    saveMilestone({ ...data.voorstel, id: `bm_${data.voorstel.from}` });
    herlaad();
  }

  return (
    <div data-body-review>
      <div className="os-card" style={{ marginBottom: 12,
        borderLeft: `4px solid ${data.recomp.positief === true ? 'var(--sage)'
          : data.recomp.positief === false ? 'var(--rust)' : 'var(--border)'}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Wat er over weken gebeurt
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.6 }}>
          {data.recomp.note || 'Nog te weinig metingen voor een oordeel over lichaamssamenstelling.'}
        </div>

        <Rij label="Gewicht" waarde={data.gewicht.verdict} kleur={KLEUR[data.gewicht.verdict]}
          sub={data.gewicht.why[0]} />
        <Rij label="Natuurlijke taille" waarde={data.taille.verdict} kleur={KLEUR[data.taille.verdict]}
          sub={data.taille.why[0]} />
        <Rij label="Navelomtrek" waarde={data.navel.verdict} kleur={KLEUR[data.navel.verdict]}
          sub={data.navel.why[0]} />
        <Rij label="Jouw normale schommeling"
          waarde={data.band.known ? `±${data.band.band} kg` : 'onbekend'}
          sub={data.band.note} />
        <Rij label="Hormonaal patroon"
          waarde={data.patroon.known ? data.patroon.direction : 'nog geen'}
          sub={data.patroon.note} />
        <Rij label="Zelfde cyclusdag"
          waarde={data.cyclus.known
            ? `${data.cyclus.delta > 0 ? '+' : ''}${data.cyclus.delta} kg` : 'nog geen'}
          sub={data.cyclus.note} />
      </div>

      {/* ── Het tussendoel ───────────────────────────────────── */}
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Tussendoel · {REVIEW_WEEKS} weken
        </div>

        {beoordeling && (
          <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)',
              marginBottom: 3 }}>
              {VERDICT_TEKST[beoordeling.verdict] || beoordeling.verdict}
            </div>
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
              {beoordeling.note}
            </div>
            {beoordeling.outcomes.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                fontSize: 11.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--sub)', flex: 1 }}>{o.label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: o.status === 'GEHAALD' ? 'var(--sage)'
                    : o.status === 'NIET_GEHAALD' ? 'var(--rust)' : 'var(--ghost)' }}>
                  {o.now ?? '—'} / {o.to ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {data.doel && !data.review.due ? (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
              Loopt tot {formatNLLong(data.doel.until)}
            </div>
            {(data.doel.targets || []).map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                fontSize: 11.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--sub)', flex: 1 }}>{t.label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {t.to != null ? `${t.from} → ${t.to}${t.unit ? ' ' + t.unit : ''}` : t.direction}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
              {data.review.reason}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 8 }}>
              {data.review.reason}
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Voorstel</div>
            {data.voorstel.targets.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                fontSize: 11.5, padding: '3px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: 'var(--sub)', flex: 1 }}>{t.label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {t.to != null ? `${t.from} → ${t.to}${t.unit ? ' ' + t.unit : ''}` : t.direction}
                </span>
              </div>
            ))}
            {data.voorstel.basis.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 10.5,
                color: 'var(--ghost)', lineHeight: 1.6 }}>
                {data.voorstel.basis.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
              {data.voorstel.note}
            </div>
            <button className="btn-primary" data-zet-doel onClick={zetDoel}
              style={{ fontSize: 13, marginTop: 10, whiteSpace: 'normal' }}>
              Dit tussendoel aanhouden
            </button>
          </>
        )}

        {data.historie.length > 0 && (
          <>
            <button onClick={() => setOpen(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 10.5, cursor: 'pointer', padding: '10px 0 0', fontWeight: 700 }}>
              {open ? '▲ eerdere periodes verbergen' : `▼ ${data.historie.length} eerdere periode(s)`}
            </button>
            {open && data.historie.map(m => (
              <div key={m.id} style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5,
                padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                {m.from} → {m.until} · {m.status}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
