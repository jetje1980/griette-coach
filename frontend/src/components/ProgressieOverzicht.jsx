import React, { useMemo, useState } from 'react';
import { todayLocal, formatNLLong, daysBetween } from '../datetime';
import { coachDecision, TRAINING_DECISION, BODY_DECISION, WEIGHT_STRATEGY,
  GOAL_ADJUSTMENT } from '../decision';
import { series, rollingMean, trend, latest } from '../timeline';
import { comparisonTracks, TRACK } from '../photoAnalysis';
import { activeMilestone, proposeMilestone, reviewDue, REVIEW_WEEKS } from '../bodyReview';
import { LIMITER_NL } from '../limiter';
// Het oordeel zelf: ga je vooruit, waarop wel en waarop niet.
import { voortgang, driemaandenplan } from '../voortgang';
// Week, maand en kwartaal naast elkaar — het verschil tussen een dip en
// een richting is de analyse waar zij om vroeg.
import { trends } from '../trends';

// Eén scherm dat de vraag beantwoordt: waar sta ik, en wat volgt daaruit?
//
// ─────────────────────────────────────────────────────────────────
// GEEN DASHBOARD
//
// §38 is er expliciet over: een kaart zonder functionele verbinding telt
// niet als oplevering. Elk blok hieronder toont daarom niet alleen een
// getal maar ook wat dat getal met het besluit doet — en waar het niets
// doet, staat dat er ook.
//
// Concreet: het gewicht staat er niet omdat gewicht interessant is, maar
// omdat het de weightStrategy bepaalt en die hier direct onder staat. De
// limiter staat er niet als label maar met de trainingsbeslissing die
// eruit volgt. Wie een blok weghaalt, haalt een schakel uit de redenering.
//
// ─────────────────────────────────────────────────────────────────
// VIER SECTIES, IN DEZE VOLGORDE
//
//   Vandaag              waar sta je nu, en wat beperkt je
//   Foto's               vijf tijdschalen, met hun vergelijkbaarheid
//   Lichaamssamenstelling  de vijf trends die het besluit dragen
//   Coachdoel            wat loopt er, tot wanneer, waarom, en wat daarna
// ─────────────────────────────────────────────────────────────────

const TRAINING_NL = {
  [TRAINING_DECISION.PROTECT]: 'beschermen — vandaag geen belasting',
  [TRAINING_DECISION.REDUCE]: 'belasting omlaag',
  [TRAINING_DECISION.HOLD]: 'niveau vasthouden',
  [TRAINING_DECISION.PROGRESS]: 'één stap opbouwen',
  [TRAINING_DECISION.PROGRESS_ACTIVELY]: 'actief opbouwen',
};

const BODY_NL = {
  [BODY_DECISION.RECOMPOSITION]: 'recompositie — dit telt als vooruitgang',
  [BODY_DECISION.CONTINUE]: 'op koers',
  [BODY_DECISION.EVALUATE]: 'beslismoment',
  [BODY_DECISION.MAINTENANCE]: 'onderhoud',
  [BODY_DECISION.MUSCLE_PRESERVATION]: 'spierbehoud gaat voor',
  [BODY_DECISION.NO_JUDGEMENT]: 'nog geen oordeel mogelijk',
};

const WEIGHT_NL = {
  [WEIGHT_STRATEGY.MAINTAIN_CURRENT_DEFICIT]: 'huidig tempo aanhouden',
  [WEIGHT_STRATEGY.REDUCE_DEFICIT]: 'tekort verkleinen',
  [WEIGHT_STRATEGY.MAINTENANCE]: 'onderhoud',
  [WEIGHT_STRATEGY.INCREASE_INTAKE]: 'meer eten',
  [WEIGHT_STRATEGY.PAUSE_LOSS]: 'afvallen pauzeren',
  [WEIGHT_STRATEGY.INSUFFICIENT_DATA]: 'te weinig gegevens',
};

const GOAL_NL = {
  [GOAL_ADJUSTMENT.NONE]: 'geen aanpassing nodig',
  [GOAL_ADJUSTMENT.SLOW_DOWN]: 'tempo omlaag',
  [GOAL_ADJUSTMENT.HOLD]: 'doel op hold',
  [GOAL_ADJUSTMENT.REVISE_TARGET]: 'doel bijstellen',
  [GOAL_ADJUSTMENT.EVALUATE_MILESTONE]: 'evaluatiemoment',
};

function Sectie({ titel, children, right }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        margin: '16px 0 6px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{titel}</div>
        {right}
      </div>
      {children}
    </>
  );
}

// Eén getal met, direct eronder, wat het met het besluit doet. Zonder die
// tweede regel is het een dashboardtegel.
function Waarde({ label, waarde, eenheid, sub, kleur, gevolg }) {
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: kleur || 'var(--text)' }}>
          {waarde ?? '—'}{waarde != null && eenheid ? ` ${eenheid}` : ''}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 2 }}>
          {sub}
        </div>
      )}
      {gevolg && (
        <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 3,
          paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
          {gevolg}
        </div>
      )}
    </div>
  );
}

function trendTekst(t, eenheid) {
  if (!t?.available) return { waarde: null, sub: t?.reason || 'geen trend' };
  const teken = t.delta > 0 ? '+' : '';
  return {
    waarde: `${teken}${t.delta}`,
    eenheid,
    sub: `${t.n} metingen · ${t.fromDate} → ${t.toDate}`,
    kleur: t.delta === 0 ? 'var(--text)' : null,
  };
}

export default function ProgressieOverzicht({ currentDate = todayLocal(), sessions = [], logs = {} }) {
  const [versie, setVersie] = useState(0);

  const d = useMemo(() => {
    try { return coachDecision({ currentDate }); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, versie]);

  const cijfers = useMemo(() => {
    const asOf = currentDate;
    return {
      gewicht7: rollingMean('weight', 7, { asOf }),
      taille: latest('waist', { asOf }),
      navel: latest('navel', { asOf }),
      heup: latest('hip', { asOf }),
      tGewicht: trend('weight', 28, { asOf }),
      tTaille: trend('waist', 28, { asOf }),
      tNavel: trend('navel', 28, { asOf }),
      tHeup: trend('hip', 28, { asOf }),
      tKracht: trend('strength_volume', 28, { asOf }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, versie]);

  const sporen = useMemo(
    () => comparisonTracks(sessions, { asOf: currentDate }),
    [sessions, currentDate]);

  const doel = activeMilestone({ asOf: currentDate });
  const review = reviewDue({ asOf: currentDate });
  const voorstel = useMemo(() => proposeMilestone({ asOf: currentDate }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentDate, versie]);

  if (!d) return null;
  // Ga ik vooruit? Eén oordeel per dimensie, en het voorstel dat daaruit
  // volgt. Niet nog een grafiek: de vraag die zij stelde.
  const vg = useMemo(() => {
    try { return voortgang({ currentDate, logs }); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, versie, logs]);
  const tr = useMemo(() => {
    try { return trends({ currentDate, logs }); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, versie, logs]);
  const plan = useMemo(() => {
    try { return vg?.known ? driemaandenplan({ voortgang: vg, currentDate }) : null; }
    catch { return null; }
  }, [vg, currentDate]);

  void setVersie;

  return (
    <div data-progressie-overzicht>
      {/* ── TREND OVER WEEK, MAAND EN KWARTAAL ──────────────
          Eén venster kan het verschil tussen een dip en een richting
          niet zien. Een HRV die deze week acht procent lager ligt
          betekent iets anders als de maand vlak is dan wanneer de maand
          ook zakt. Daarom alle drie naast elkaar, met de duiding van
          hoe ze zich tot elkaar verhouden. */}
      {tr?.known && (
        <Sectie titel="Trend · week, maand, kwartaal">
          <div className="os-card" data-trends={tr.metrics.length}>
            <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
              {tr.line}
            </div>
            {tr.metrics.map(m => {
              const iets = m.horizons.some(h => h.known);
              if (!iets) return null;
              return (
                <div key={m.id} data-trend={m.id}
                  style={{ padding: '8px 0', borderTop: '1px solid var(--border)',
                    marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, flex: 1 }}>{m.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {m.horizons.map(h => (
                      <div key={h.id} data-horizon={h.id} style={{ flex: 1,
                        padding: '4px 6px', borderRadius: 6,
                        background: 'var(--border)', opacity: h.known ? 1 : 0.45 }}>
                        <div style={{ fontSize: 9, color: 'var(--ghost)', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {h.kort}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: !h.known ? 'var(--ghost)'
                            : h.richting === 'vooruit' ? 'var(--sage)'
                              : h.richting === 'terug' ? 'var(--gold)' : 'var(--text)' }}>
                          {h.known ? h.weergave : '—'}
                        </div>
                        {h.known && (
                          <div style={{ fontSize: 9, color: 'var(--ghost)' }}>
                            {h.was} → {h.nu}{m.eenheid ? ` ${m.eenheid}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45,
                    marginTop: 4 }} data-duiding={m.duiding.id}>
                    {m.duiding.tekst}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
              marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              Elk venster vergelijkt met de periode ervoor van dezelfde lengte, met de
              mediaan en niet het gemiddelde — zodat één uitschieter het beeld niet
              kantelt. Wijzen alle drie dezelfde kant op, dan is het een richting.
            </div>
          </div>
        </Sectie>
      )}

      {/* ── GA IK VOORUIT? ──────────────────────────────────
          Dit stond nergens. Progressie toonde grafieken, sessies en
          scores, maar nergens het oordeel zelf. "Nauwelijks progressie"
          is één gevoel over een stapel dingen die zich elk anders
          gedragen — haar volume groeide wel degelijk terwijl haar
          economie stilstond. Wie die twee op één hoop gooit, concludeert
          dat het niet werkt terwijl de helft wel werkt. */}
      {vg?.known && (
        <Sectie titel="Ga ik vooruit?">
          <div className="os-card" data-voortgang={vg.dimensions.length}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 700 }}>{vg.line}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 2 }}>
              {vg.sessions} sessies van {vg.from} tot {vg.to} · {vg.perWeek} per week
            </div>
            {vg.dimensions.map(dim => (
              <div key={dim.id} data-dimensie={dim.id}
                style={{ padding: '7px 0', borderTop: '1px solid var(--border)',
                  marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11.5, flex: 1 }}>{dim.regel}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.3px',
                    textTransform: 'uppercase',
                    color: dim.verdict === 'vooruit' ? 'var(--sage)'
                      : dim.verdict === 'achteruit' ? 'var(--gold)' : 'var(--ghost)' }}>
                    {dim.verdict}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--sub)', lineHeight: 1.45 }}>
                  {dim.toelichting}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 7,
              borderTop: '1px solid var(--border)' }} data-diagnose={vg.diagnosis.id}>
              <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4 }}>
                {vg.diagnosis.kop}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55,
                marginTop: 3 }}>
                {vg.diagnosis.tekst}
              </div>
            </div>
          </div>

          {/* ── Wat beweegt er mee? ────────────────────────
              Een dimensie die stilstaat is pas bruikbaar als je weet
              waar hij mee samenhangt. Dit legt haar betere helft naast
              haar mindere en kijkt wat er verschilt — slaap, cyclus,
              spanning, afstand, rust ervoor, kracht ervoor, gewicht. */}
          {vg.patterns?.known && (
            <div className="os-card" style={{ marginTop: 8 }}
              data-patronen={vg.patterns.findings.length}>
              <div style={{ fontSize: 12.5, fontWeight: 800, lineHeight: 1.4 }}>
                {vg.patterns.line}
              </div>
              {vg.patterns.findings.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5,
                  marginTop: 3 }}>
                  Geen enkele factor verschilt duidelijk tussen je betere en mindere
                  sessies. Dat is zelf ook een uitkomst: dan zit het verschil niet in
                  de omstandigheden maar in de training.
                </div>
              )}
              {vg.patterns.findings.map(f => (
                <div key={f.id} data-patroon={f.id}
                  style={{ padding: '6px 0', borderTop: '1px solid var(--border)',
                    marginTop: 5, fontSize: 11.5, lineHeight: 1.5 }}>
                  {f.note}
                </div>
              ))}
              {vg.patterns.spread && (
                <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5,
                  marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--border)' }}>
                  {vg.patterns.spread}
                </div>
              )}
              {vg.patterns.geen?.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
                  marginTop: 4 }}>
                  Maakt geen verschil: {vg.patterns.geen.join(', ')}.
                </div>
              )}
              {vg.patterns.ontbreekt?.length > 0 && (
                <div style={{ fontSize: 10, color: 'var(--gold)', lineHeight: 1.45,
                  marginTop: 2 }} data-patroon-ontbreekt={vg.patterns.ontbreekt.length}>
                  Nog te weinig ingevuld om mee te wegen: {vg.patterns.ontbreekt.join(', ')}.
                  Vul je die op loopdagen in, dan doen ze hier mee.
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
                marginTop: 4 }}>
                {vg.patterns.caveat}
              </div>
            </div>
          )}
          {vg.patterns && !vg.patterns.known && (
            <div className="os-card" style={{ marginTop: 8, fontSize: 11,
              color: 'var(--sub)', lineHeight: 1.5 }} data-patronen="0">
              {vg.patterns.why}
            </div>
          )}

          {plan?.known && (
            <div className="os-card" style={{ marginTop: 8,
              borderLeft: '3px solid var(--sage)' }} data-driemaanden={plan.blokken.length}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{plan.kop}</div>
              {plan.blokken.map(b => (
                <div key={b.nr} data-blok={b.nr}
                  style={{ padding: '7px 0', borderTop: '1px solid var(--border)',
                    marginTop: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                    Blok {b.nr} · {b.titel}
                    <span style={{ color: 'var(--ghost)', fontWeight: 600 }}>
                      {' '}({b.van.slice(5)} – {b.tot.slice(5)})
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>{b.doel}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--sage)', lineHeight: 1.45 }}>
                    meet: {b.meet}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--sub)', lineHeight: 1.45 }}>
                    {b.waarom}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--gold)', lineHeight: 1.5,
                marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                {plan.let_op}
              </div>
            </div>
          )}
        </Sectie>
      )}

      {/* ── VANDAAG ─────────────────────────────────────────── */}
      <Sectie titel="Vandaag">
        <div className="os-card">
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
            lineHeight: 1.25 }} data-overzicht-limiter>
            {LIMITER_NL[d.primaryLimiter]}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 3 }}>
            {d.evidence[0]}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: 'var(--surface)', border: '1px solid var(--border)' }}
              data-overzicht-training>
              Training: {TRAINING_NL[d.trainingDecision]}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: 'var(--surface)', border: '1px solid var(--border)' }}>
              Zekerheid {d.confidenceLabel}
            </span>
          </div>

          <Waarde label="7-daags gewicht" waarde={cijfers.gewicht7} eenheid="kg"
            gevolg={`Bepaalt de gewichtsstrategie hieronder: ${WEIGHT_NL[d.weightStrategy]}.`} />
          <Waarde label="Natuurlijke taille" waarde={cijfers.taille?.value} eenheid="cm"
            sub={cijfers.taille ? `gemeten ${cijfers.taille.observedAt}` : null}
            gevolg="Samen met de navel het bewijs voor recompositie: maten omlaag bij stilstaand gewicht telt als vooruitgang." />
          <Waarde label="Navelomtrek" waarde={cijfers.navel?.value} eenheid="cm"
            sub={cijfers.navel ? `gemeten ${cijfers.navel.observedAt}` : null}
            gevolg="Beweegt sterker met vocht en cyclus dan de taille — daarom altijd naast de cyclusdag lezen." />
          <Waarde label="Cyclusfase"
            waarde={d.detail.cycleDay != null ? `dag ${d.detail.cycleDay}` : null}
            sub={d.detail.cyclePhase === 'onbekend'
              ? 'fase onbekend — je cycli lopen te ver uiteen voor een betrouwbare indeling'
              : `${d.detail.cyclePhase} (${d.detail.cyclePhaseCertainty})`}
            gevolg="Bepaalt met welke eerdere check-ins vergeleken wordt, en of een gewichtspiek als hormonaal wordt gelezen." />

          {d.missingData.length > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--rust)', lineHeight: 1.55, marginTop: 8,
              paddingTop: 8, borderTop: '1px solid var(--border)' }} data-overzicht-missing>
              Ontbreekt: {d.missingData.join(', ')}. Dat beperkt de zekerheid hierboven —
              het is geen groen signaal.
            </div>
          )}
        </div>
      </Sectie>

      {/* ── FOTO'S ──────────────────────────────────────────── */}
      <Sectie titel="Foto's · vijf tijdschalen">
        <div className="os-card" data-overzicht-fotos>
          {!sporen.available ? (
            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
              {sporen.note}
            </div>
          ) : (
            <>
              {sporen.tracks.map(t => (
                <div key={t.id} style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0 }}>
                      {t.id === TRACK.CYCLE ? 'Zelfde cyclusfase' : t.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700,
                      color: t.available ? 'var(--text)' : 'var(--ghost)' }}>
                      {t.available ? t.comparability.level : 'nog niet'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5,
                    marginTop: 2 }}>
                    {t.available ? `${t.from.date} → ${t.to.date} · ${t.reads}` : t.reason}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8,
                paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                {d.detail.photos.known
                  ? `De laatste vergelijking telt mee in het oordeel hierboven: ${d.detail.photos.note}`
                  : 'Zolang hier niets staat, steunt het oordeel over je lichaam alleen op cijfers. Dat staat als ontbrekend gemeld.'}
              </div>
            </>
          )}
        </div>
      </Sectie>

      {/* ── LICHAAMSSAMENSTELLING ───────────────────────────── */}
      <Sectie titel="Lichaamssamenstelling · vier weken">
        <div className="os-card" data-overzicht-trends>
          <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-serif)',
            marginBottom: 2 }} data-overzicht-body>
            {BODY_NL[d.bodyCompositionDecision]}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55 }}>
            Strategie: {WEIGHT_NL[d.weightStrategy]}.
          </div>

          <Waarde label="Gewicht" {...trendTekst(cijfers.tGewicht, 'kg')} />
          <Waarde label="Taille" {...trendTekst(cijfers.tTaille, 'cm')} />
          <Waarde label="Navel" {...trendTekst(cijfers.tNavel, 'cm')} />
          <Waarde label="Heup" {...trendTekst(cijfers.tHeup, 'cm')} />
          <Waarde label="Krachtvolume" {...trendTekst(cijfers.tKracht, 'kg')}
            sub={d.detail.strength.label}
            gevolg={d.detail.strength.note ||
              'Dalende kracht is een veto: dan telt een kleinere taille niet als vooruitgang.'} />

          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.55, marginTop: 8,
            paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {d.guard}
          </div>
        </div>
      </Sectie>

      {/* ── COACHDOEL ───────────────────────────────────────── */}
      <Sectie titel="Coachdoel">
        <div className="os-card" data-overzicht-doel>
          {doel && !review.due ? (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-serif)' }}>
                Loopt tot {formatNLLong(doel.until)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 2 }}>
                nog {Math.max(0, daysBetween(currentDate, doel.until))} dagen
              </div>
              {(doel.targets || []).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                  fontSize: 11.5, padding: '4px 0',
                  borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--sub)', flex: 1 }}>{t.label}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {t.to != null ? `${t.from} → ${t.to}${t.unit ? ' ' + t.unit : ''}` : t.direction}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-serif)' }}>
                Nieuw tussendoel van {REVIEW_WEEKS} weken
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginTop: 3 }}>
                {review.reason}
              </div>
              {voorstel.targets.slice(0, 4).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                  fontSize: 11.5, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--sub)', flex: 1 }}>{t.label}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {t.to != null ? `${t.from} → ${t.to}${t.unit ? ' ' + t.unit : ''}` : t.direction}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Waaróm het doel is wat het is — en of het nú verandert. */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
              Reden
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.6 }}
              data-overzicht-reden>
              {d.goalAdjustment.reason
                || (voorstel.basis?.length ? voorstel.basis.join('; ') : voorstel.note)}
            </div>
            {d.goalAdjustment.type !== GOAL_ADJUSTMENT.NONE && (
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6,
                color: d.goalAdjustment.type === GOAL_ADJUSTMENT.EVALUATE_MILESTONE
                  ? 'var(--gold)' : 'var(--rust)' }} data-overzicht-aanpassing>
                Aanpassing: {GOAL_NL[d.goalAdjustment.type]}
              </div>
            )}
            {d.goalAdjustment.options?.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11,
                color: 'var(--sub)', lineHeight: 1.6 }}>
                {d.goalAdjustment.options.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 10,
            paddingTop: 8, borderTop: '1px solid var(--border)' }} data-overzicht-review>
            Volgende review: {formatNLLong(d.nextReviewDate)}
            {d.reviewDue ? ' — nu aan de beurt' : ''}
          </div>
        </div>
      </Sectie>
    </div>
  );
}
