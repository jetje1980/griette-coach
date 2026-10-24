import React, { useState, useMemo, useEffect } from 'react';
import { CHALLENGE, phaseForDay, PHASES } from '../data/challenge75';
import { loadChallenge, dateOfDay, markDay, unmarkDay, DONE_KIND } from '../challenge75';
import { photoStore } from '../photoStore';
import DagFotos from './DagFotos';
import { todayLocal, formatNLLong } from '../datetime';

// Alle 75 dagen in één raster, en per dag afvinken.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER MOET ZIJN
//
// De dagkaart toont één dag: die van vandaag. Dat klopt voor de gewoonte —
// je doet acht minuten vandaag, niet in de toekomst — maar het beantwoordt
// twee vragen niet die zij wél stelde:
//
//   · waar staan dag 2 en verder? Zonder overzicht lijkt een uitdaging van
//     75 dagen een kaart die elke ochtend hetzelfde zegt;
//   · kan ik ze afvinken? Een dag die zij deed maar vergat te vinken, was
//     alleen te bereiken via "een eerdere dag alsnog invullen" op Vandaag —
//     dat is terugbladeren door het hele dagboek voor één vinkje.
//
// Hier staan ze alle 75. Een voorbije dag vink je aan door erop te tikken.
// Een toekomstige dag kan níet: dat is geen beperking van de app maar van
// de werkelijkheid — vooruit afvinken maakt van de reeks een invuloefening,
// en het enige wat deze reeks meet is of het echt gebeurd is.
//
// De fasegrenzen staan erin omdat ze iets betekenen: wat je op dag 3 voelt
// is iets anders dan wat op dag 50 gebeurt, en het raster is de enige plek
// waar je kunt zien waar je naartoe loopt.
// ─────────────────────────────────────────────────────────────────

// Geen vast aantal kolommen maar een minimale vakjesmaat: tien kolommen gaf
// vakjes van 29 pixels, en daar tik je naast op een telefoon. Zo passen er
// acht op een smal scherm (±38px) en meer op een breed, zonder dat het
// raster ooit kleiner wordt dan aanraakbaar.
const MIN_VAKJE = 36;

// Elke soort afgeronde dag heeft een eigen kleur. Vijf identieke vinkjes
// verbergen dat drie ervan hersteldagen waren, en dat is precies het soort
// informatie waar zij later iets aan heeft.
const KLEUR = {
  [DONE_KIND.CIRCUIT]: { bg: 'var(--sage)', fg: '#fff', naam: 'de acht minuten' },
  [DONE_KIND.EXTRA]: { bg: 'var(--green)', fg: '#fff', naam: 'circuit + tweede workout' },
  [DONE_KIND.RECOVERY]: { bg: 'transparent', fg: 'var(--sage)', rand: 'var(--sage)',
    naam: 'herstelversie' },
  [DONE_KIND.RACE]: { bg: 'var(--gold)', fg: '#fff', naam: 'racedag' },
};

export default function Challenge75Grid({ currentDate = todayLocal(), onChanged }) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [gekozen, setGekozen] = useState(null);

  const state = useMemo(() => loadChallenge(), [tick]);
  const vandaag = todayLocal();

  // Of er een foto bij een dag hoort, staat op twee plekken: in de reeks
  // (markPhoto) en in de fotoopslag zelf. Die twee kunnen uit elkaar lopen —
  // een foto die vóór deze versie is opgeslagen staat wél in de opslag maar
  // niet in de reeks. De foto's zelf zijn de waarheid, dus die worden hier
  // gelezen en met de reeks samengevoegd. Eén bron per feit, en als er toch
  // twee zijn, wint het bewijs boven de boekhouding.
  // Per dag hóeveel foto's er staan — er kunnen er twee zijn.
  const [fotodagen, setFotodagen] = useState(() => new Map());
  useEffect(() => {
    let levend = true;
    photoStore.getDaily?.()
      .then(l => {
        if (!levend) return;
        const m = new Map();
        for (const p of l || []) m.set(p.date, (m.get(p.date) || 0) + 1);
        setFotodagen(m);
      })
      .catch(() => {});
    return () => { levend = false; };
  }, [tick]);

  const dagen = useMemo(() => {
    if (!state?.startDate) return [];
    return Array.from({ length: CHALLENGE.days }, (_, i) => {
      const nr = i + 1;
      const datum = dateOfDay(nr, state);
      const rec = state.days?.[datum] || null;
      return {
        nr, datum, kind: rec?.kind || null,
        // De foto's in de opslag zijn het bewijs; de boekhouding in de reeks
        // is de terugval als de opslag nog niet gelezen is.
        fotos: fotodagen.get(datum)
          ?? (rec?.photos ? Object.keys(rec.photos).length : (rec?.photo ? 1 : 0)),
        toekomst: datum > vandaag, isVandaag: datum === vandaag,
        gemist: datum < vandaag && !rec?.kind,
      };
    });
  }, [state, vandaag, tick, fotodagen]);

  if (!state?.startDate) return null;

  const afgerond = dagen.filter(d => d.kind).length;
  const voorbij = dagen.filter(d => !d.toekomst).length;

  function ververs() { setTick(t => t + 1); onChanged?.(); }

  function kies(d) {
    // Een toekomstige dag blijft kiesbaar om te lézen — je mag zien wat er
    // aankomt — maar krijgt geen knoppen.
    setGekozen(g => (g?.nr === d.nr ? null : d));
  }

  function vink(d, kind) {
    if (d.toekomst) return;
    if (d.kind === kind) unmarkDay(d.datum);
    else markDay(d.datum, { kind });
    ververs();
    setGekozen(null);
  }

  const detail = gekozen ? dagen.find(d => d.nr === gekozen.nr) : null;

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
      <div onClick={() => setOpen(v => !v)} data-challenge-raster-knop
        style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer',
          fontSize: 11.5, color: 'var(--muted)' }}>
        <span>Alle 75 dagen — {afgerond} van {voorbij} tot nu afgerond</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }} data-challenge-raster={CHALLENGE.days}>
          {/* Het raster zelf */}
          <div style={{ display: 'grid', gap: 4,
            gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_VAKJE}px, 1fr))` }}>
            {dagen.map(d => {
              const k = d.kind ? KLEUR[d.kind] : null;
              const gekozenNu = detail?.nr === d.nr;
              return (
                <button key={d.nr} type="button" onClick={() => kies(d)}
                  data-dag={d.nr} data-dag-status={d.kind ? 'gedaan'
                    : d.toekomst ? 'komt' : d.isVandaag ? 'vandaag' : 'open'}
                  title={`Dag ${d.nr} · ${d.datum}`}
                  style={{
                    aspectRatio: '1', padding: 0, cursor: 'pointer',
                    borderRadius: 7, fontSize: 11, fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                    position: 'relative',
                    background: k ? k.bg : 'transparent',
                    color: k ? k.fg : (d.toekomst ? 'var(--ghost)' : 'var(--muted)'),
                    border: gekozenNu ? '2px solid var(--text)'
                      : k?.rand ? `1.5px solid ${k.rand}`
                        : d.isVandaag ? '2px solid var(--gold)'
                          : d.gemist ? '1px dashed var(--border)'
                            : '1px solid var(--border)',
                    opacity: d.toekomst ? 0.55 : 1,
                  }}>
                  {d.nr}
                  {/* Eén stipje per foto: zo zie je in één oogopslag welke
                      dagen er maar één hebben. */}
                  {d.fotos > 0 && (
                    <span style={{ position: 'absolute', bottom: 2, left: 0, right: 0,
                      display: 'flex', justifyContent: 'center', gap: 2 }}
                      data-dag-fotos={d.fotos}>
                      {Array.from({ length: Math.min(d.fotos, 2) }, (_, i) => (
                        <span key={i} style={{ width: 3, height: 3, borderRadius: 99,
                          background: k ? k.fg : 'var(--sage)' }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Wat de kleuren betekenen. Een raster zonder legenda is een
              puzzel, en dit hoort geen puzzel te zijn. */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 7,
            fontSize: 9.5, color: 'var(--ghost)' }}>
            <span><span style={{ ...stip, background: 'var(--sage)' }} /> gedaan</span>
            <span><span style={{ ...stip, background: 'transparent',
              border: '1.5px solid var(--sage)' }} /> herstelversie</span>
            <span><span style={{ ...stip, background: 'var(--gold)' }} /> racedag</span>
            <span><span style={{ ...stip, background: 'transparent',
              border: '1px dashed var(--border)' }} /> nog open</span>
            <span>· stipje = foto</span>
          </div>

          {/* De gekozen dag */}
          {detail && (
            <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border)' }}
              data-challenge-dagdetail={detail.nr}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>
                Dag {detail.nr} — {formatNLLong(detail.datum)}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 1 }}>
                {phaseForDay(detail.nr).label}
                {` · ${detail.fotos} van 2 foto's`}
              </div>

              {detail.toekomst ? (
                <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5,
                  marginTop: 5 }} data-challenge-komt-nog>
                  Deze dag komt nog. Vooruit afvinken kan niet — dan meet de reeks
                  niet meer of het gebeurd is. Hij staat vanzelf klaar op{' '}
                  {formatNLLong(detail.datum)}.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 5,
                    marginBottom: 5, lineHeight: 1.5 }}>
                    {detail.kind
                      ? `Afgerond als ${KLEUR[detail.kind]?.naam || detail.kind}. Tik dezelfde knop nog eens om het ongedaan te maken.`
                      : detail.isVandaag ? 'Nog niet afgevinkt vandaag.'
                        : 'Deze dag staat nog open. Heb je hem wel gedaan, vink hem dan hier alsnog af.'}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {[DONE_KIND.CIRCUIT, DONE_KIND.RECOVERY, DONE_KIND.EXTRA, DONE_KIND.RACE]
                      .map(kind => (
                        <button key={kind} type="button" onClick={() => vink(detail, kind)}
                          data-vink={kind}
                          style={detail.kind === kind ? knopAan : knopUit}>
                          {detail.kind === kind ? '✓ ' : ''}{KLEUR[kind].naam}
                        </button>
                      ))}
                  </div>
                  {/* ── De foto's bij déze dag ────────────────────
                      Hier stond een verwijzing naar "een eerdere dag alsnog
                      invullen" op Vandaag. Dat is drie schermen ver voor één
                      foto, en het is precies de vraag die zij stelde: waar
                      voeg ik ze toe? Nu: hier, bij de dag waar ze bij horen,
                      allebei, en ook te vervangen als er al een staat. */}
                  <div style={{ marginTop: 8 }}>
                    <DagFotos date={detail.datum} dayNr={detail.nr}
                      onChanged={ververs} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* De fasen, zodat het raster een richting heeft en niet
              vijfenzeventig gelijke vakjes is. */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {PHASES.map(f => (
              <div key={f.from} style={{ display: 'flex', gap: 7, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--ghost)', minWidth: 42,
                  fontVariantNumeric: 'tabular-nums' }}>{f.from}–{f.to}</span>
                <span style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.4 }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const stip = { display: 'inline-block', width: 8, height: 8, borderRadius: 3,
  marginRight: 3, verticalAlign: -1 };
const knopAan = { fontSize: 10.5, padding: '5px 9px', borderRadius: 99, cursor: 'pointer',
  border: '1px solid var(--sage)', background: 'var(--sage)', color: '#fff', fontWeight: 700 };
const knopUit = { fontSize: 10.5, padding: '5px 9px', borderRadius: 99, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)' };
