import React, { useMemo, useState } from 'react';
import { buildCoachContext, usedData } from '../coachContext';
import { todayLocal } from '../datetime';

// "Waarom dit advies?"
//
// ─────────────────────────────────────────────────────────────────
// WAT DIT WEL EN NIET LAAT ZIEN
//
// usedData() bestond al en was getest, maar stond in geen enkel scherm. De
// traceerbaarheid was dus wel gebouwd en niet zichtbaar — wat neerkomt op
// niet gebouwd, want de hele functie ervan is dat zíj kan nakijken waar een
// uitspraak vandaan komt.
//
// Wat hier staat is niet de prompt. Een prompt tonen is imponeren; wat je
// wilt weten is: welke getallen zaten erin, van wanneer, en wat ontbrak.
// Dat laatste is het belangrijkste veld van het scherm. Zolang "ontbreekt"
// leeg blijft leest een groen advies als een oordeel over alles — terwijl
// het een oordeel is over wat er toevallig is ingevuld.
// ─────────────────────────────────────────────────────────────────

const LIMITER_NL = {
  PESE: 'PEM / belastingtolerantie',
  delayed_recovery: 'vertraagd herstel',
  hormonal_perimenopause: 'hormonale fase',
  sleep: 'slaap',
  heat: 'warmte',
  muscular_fatigue: 'spiervermoeidheid',
  distance_tolerance: 'afstandstolerantie',
  aerobic_economy: 'aerobe economie',
  strength_recovery: 'krachtherstel en spierbehoud',
  nutrition_energy_availability: 'energiebeschikbaarheid',
  stress: 'stress',
  none_ready_to_build: 'niets — er is ruimte om op te bouwen',
};

export default function WhyPanel({ asOf = todayLocal(), compact = false }) {
  const [open, setOpen] = useState(!compact);

  const { ctx, used } = useMemo(() => {
    try {
      const c = buildCoachContext({ asOf });
      return { ctx: c, used: usedData(c) };
    } catch {
      return { ctx: null, used: { items: [], missing: [] } };
    }
  }, [asOf]);

  if (!ctx) return null;
  const lg = ctx.longitudinal;

  return (
    <div className="os-card" data-why-panel style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(v => !v)} data-why-toggle
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          textAlign: 'left' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Waarom dit advies?
        </span>
        <span style={{ fontSize: 11, color: 'var(--ghost)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* De beperkende factor staat altijd zichtbaar, ook ingeklapt. Dat is de
          enige regel die de rest van de dag verklaart. */}
      {lg && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-serif)',
            lineHeight: 1.3 }}>
            Deze week beperkt: {LIMITER_NL[lg.limiter.limiter] || lg.limiter.limiter}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 3 }}>
            {lg.limiter.why[0]}
          </div>
        </div>
      )}

      {open && (
        <>
          {lg && lg.limiter.note && (
            <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.55, marginTop: 6 }}>
              {lg.limiter.note}
            </div>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 4px' }}>
            Gebruikte gegevens
          </div>
          {used.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
              padding: '4px 0', borderBottom: i < used.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 11.5, color: 'var(--sub)', flex: 1, minWidth: 0 }}>
                {it.label}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                textAlign: 'right' }}>
                {it.value}
                {it.when && (
                  <span style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 600,
                    display: 'block' }}>{it.when}</span>
                )}
              </span>
            </div>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 4px' }}>
            Wat ontbreekt
          </div>
          <div style={{ fontSize: 11.5, color: used.missing.length ? 'var(--rust)' : 'var(--sub)',
            lineHeight: 1.55 }} data-why-missing>
            {used.missing.length
              ? `${used.missing.join(', ')}. Afwezigheid van gegevens is geen groen signaal — het advies hierboven zegt niets over wat hier niet staat.`
              : 'Alle hoofdbronnen zijn de afgelopen twee weken ingevuld.'}
          </div>

          {lg && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 4px' }}>
                Waarop dit gebaseerd mag zijn
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--sub)',
                lineHeight: 1.6 }}>
                <li>{lg.bandwidth.weight.known
                  ? `Je gewicht schommelt normaal ±${lg.bandwidth.weight.band} kg. Alles daarbinnen is ruis.`
                  : lg.bandwidth.weight.note}</li>
                <li>{lg.sameCycleDay.weight.known
                  ? lg.sameCycleDay.weight.note
                  : lg.sameCycleDay.weight.note}</li>
                <li>{lg.photoVision.count
                  ? `${lg.photoVision.count} keer zijn de foto's werkelijk bekeken. ${lg.photoVision.convergent.note}`
                  : 'Er is nog niet werkelijk naar de foto\'s gekeken. Wat er over beeld staat komt uit je eigen notities.'}</li>
              </ul>
            </>
          )}

          <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 10,
            paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            Peildatum {ctx.asOf} · {ctx.history.totalObservations} waarnemingen
            {ctx.history.firstObservation ? ` vanaf ${ctx.history.firstObservation}` : ''} ·
            datadekking {Math.round(ctx.completeness.coverage * 100)}%.
          </div>
        </>
      )}
    </div>
  );
}
