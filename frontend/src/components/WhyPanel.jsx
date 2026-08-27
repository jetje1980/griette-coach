import React, { useMemo, useState } from 'react';
import { buildCoachContext, usedData } from '../coachContext';
import { todayLocal } from '../datetime';
import { PESE } from '../pese';
import { RISK } from '../progression';

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
//
// ─────────────────────────────────────────────────────────────────
// DE CAUSALE REGEL
//
// Fase 2B vraagt niet alleen wélke gegevens gebruikt zijn maar hoe ze op
// elkaar inwerkten: "je drie recente duurlopen zijn zonder delayed worsening
// verwerkt, daarom verhogen we alleen de duur en niet tegelijk de
// intensiteit". Dat is een andere zin dan een lijstje. Hij wordt hieronder
// opgebouwd uit de vier lagen die het besluit werkelijk dragen: respons,
// toeschrijving, beperking en stap.
// ─────────────────────────────────────────────────────────────────

const PESE_KLEUR = {
  [PESE.GREEN]: 'var(--sage)',
  [PESE.ORANGE]: 'var(--gold)',
  [PESE.RED]: 'var(--rust)',
};

const RISK_KLEUR = {
  [RISK.OVERREACHING]: 'var(--rust)',
  [RISK.UNDERTRAINING]: 'var(--gold)',
  [RISK.BALANCED]: 'var(--sage)',
  [RISK.UNKNOWN]: 'var(--ghost)',
};

// De causale zin (§30). Geen sjabloon met gaten erin maar een redenering die
// de volgorde van de lagen volgt: wat is er waargenomen → waar hoort het bij
// → wat beperkt daardoor → en dus welke stap.
function causaleUitleg(ctx) {
  const delen = [];
  const R = ctx.risk, A = ctx.attribution, L = ctx.limiter, P = ctx.progression;
  if (!R || !L) return null;

  // 1. Wat is er werkelijk waargenomen aan respons?
  if (R.pese === PESE.GREEN && R.allowsBuild) {
    delen.push('Je recente sessies zijn zonder vertraagde verslechtering verwerkt');
  } else if (R.pese === PESE.GREEN) {
    delen.push('Je recente sessies worden verdragen, maar de schone reeks is nog te kort om op te bouwen');
  } else if (R.pese === PESE.ORANGE) {
    delen.push('Het beeld van je recente respons is nog niet rond');
  } else {
    delen.push('Er is vertraagde verslechtering na inspanning');
  }

  // 2. Waar hoort het bij? Alleen noemen als het iets toevoegt.
  if (A && A.attribution === 'hormonaal/contextueel') {
    delen.push('en wat er wél afwijkt valt samen met een hormonale fase in plaats van met je training');
  } else if (A && A.dailyFunctionImpaired) {
    delen.push('en je dagelijks functioneren ligt onder je eigen basislijn');
  }

  // 3. Wat beperkt daardoor?
  delen.push(`daarom is ${L.primaryLabel} deze week de beperkende factor`);

  // 4. En dus?
  if (P?.build) {
    delen.push(`en verhogen we alleen ${P.lever} — ${P.step} — en niet tegelijk iets anders`);
  } else if (P) {
    delen.push('en blijft de belasting deze week gelijk');
  }

  return `${delen.join(', ')}.`;
}

export default function WhyPanel({ asOf = todayLocal(), compact = false }) {
  const [open, setOpen] = useState(!compact);

  const { ctx, used } = useMemo(() => {
    try {
      const c = buildCoachContext({ asOf });
      return { ctx: c, used: usedData(c) };
    } catch {
      return { ctx: null, used: { items: [], missing: [], missingLabels: [] } };
    }
  }, [asOf]);

  if (!ctx) return null;
  const lg = ctx.longitudinal;
  const L = ctx.limiter;
  const R = ctx.risk;
  const uitleg = causaleUitleg(ctx);

  // De zekerheid van het geheel (§31): de zwakste schakel telt, niet het
  // gemiddelde. Eén ontbrekende herstelcheck maakt het hele oordeel matig.
  const zekerheid = ctx.completeness.confidence === 'laag' || L?.confidence === 'laag'
    ? 'laag' : ctx.completeness.confidence === 'hoog' && L?.confidence === 'hoog'
      ? 'hoog' : 'matig';

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
          enige regel die de rest van de week verklaart. */}
      {L && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-serif)',
            lineHeight: 1.3 }} data-why-limiter>
            Deze week beperkt: {L.primaryLabel}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 3 }}>
            {L.explanation}
          </div>
          {L.secondary && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 3 }}>
              Daarachter: {L.secondaryLabel}.
            </div>
          )}
        </div>
      )}

      {/* Zekerheid, altijd zichtbaar. Wie hem moet openklappen leest hem niet. */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8,
        flexWrap: 'wrap' }} data-why-confidence>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: zekerheid === 'laag' ? 'var(--rust)' : zekerheid === 'hoog' ? 'var(--sage)' : 'var(--gold)' }}>
          Zekerheid: {zekerheid}
        </span>
        {R && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: PESE_KLEUR[R.pese] || 'var(--ghost)' }}>
            PESE {R.pese}
          </span>
        )}
        {ctx.balance && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: RISK_KLEUR[ctx.balance.risk] || 'var(--ghost)' }}>
            {ctx.balance.risk}
          </span>
        )}
      </div>
      {used.missingLabels.length > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 4 }}>
          Beperkt door wat ontbreekt: {used.missingLabels.join(', ')}.
        </div>
      )}

      {open && (
        <>
          {uitleg && (
            <div style={{ marginTop: 12, padding: '9px 10px', borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)' }}
              data-why-causal>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                De redenering
              </div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                {uitleg}
              </div>
            </div>
          )}

          {ctx.attribution && ctx.attribution.attribution !== 'geen van beide aanwijsbaar' && (
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 10 }}
              data-why-attribution>
              {ctx.attribution.explanation}
              {ctx.attribution.note && (
                <span style={{ display: 'block', color: 'var(--ghost)', fontSize: 10.5,
                  marginTop: 4 }}>{ctx.attribution.note}</span>
              )}
            </div>
          )}

          {L?.signals?.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 4px' }}>
                Waarop de beperking berust
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--sub)',
                lineHeight: 1.6 }}>
                {L.signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </>
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
          <div style={{ fontSize: 11.5, color: used.missingLabels.length ? 'var(--rust)' : 'var(--sub)',
            lineHeight: 1.55 }} data-why-missing>
            {used.missingLabels.length
              ? `${used.missingLabels.join(', ')}. Afwezigheid van gegevens is geen groen signaal — het advies hierboven zegt niets over wat hier niet staat.`
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
                <li>{ctx.cycleIntelligence?.regularity?.note
                  || lg.sameCycleDay.weight.note}</li>
                <li>{lg.photoVision.count
                  ? `${lg.photoVision.count} keer zijn de foto's werkelijk bekeken. ${lg.photoVision.convergent.note}`
                  : 'Er is nog niet werkelijk naar de foto\'s gekeken. Wat er over beeld staat komt uit je eigen notities.'}</li>
                {ctx.guard && <li>{ctx.guard.rule}</li>}
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
