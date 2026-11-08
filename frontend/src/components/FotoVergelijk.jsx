// Twee foto's naast elkaar, met wat er tussen die twee datums gemeten is.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG, EN WAT IK NIET KAN
//
// "Bij 75 challenge bij progressie vergelijk 1e en laatste foto, en geef
// zelf een AI-beeldanalyse van wat je ziet. Of laat me zelf 2 foto's
// aantikken voor je vergelijk."
//
// Ik schreef eerst dat de app niet zelf naar beeld kon kijken. Dat was
// onjuist, en zij corrigeerde het: "de app kon eerder wel zelf naar beeld
// kijken, waar is dat gebleven?" Klopt — ai.comparePhotos bestaat al en
// draait via de Supabase Edge Function met de sleutel server-side. Hij zat
// alleen aan de progressiefoto's vast (BodyCheckIn) en niet aan de
// challengefoto's. Niet weg dus, alleen niet aangesloten.
//
// Dit scherm doet daarom drie dingen:
//   · zij kiest zelf twee foto's — standaard de eerste en de laatste;
//   · ernaast staat wat er tussen die twee datums gemeten is, want dat
//     is het deel dat geen oog nodig heeft en niet kan hallucineren;
//   · en er zit een knop die de beelden werkelijk laat bekijken, met
//     dezelfde vragenlijst en dezelfde harde regels als bij de
//     progressiefoto's: geen kilo's of centimeters uit beeld, een
//     verschil in licht of kleding is geen verandering in het lichaam,
//     en wat niet te zien is blijft leeg in plaats van ingevuld.
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { photoStore, DAILY_LABELS } from '../photoStore';
import { loadChallenge } from '../challenge75';
import { ANALYSIS_FIELDS, comparability, loadAnalyses, analysisSchema,
  normalizeAnalysis, saveAnalysis } from '../photoAnalysis';
import { formatNLLong, daysBetween } from '../datetime';
import { series } from '../timeline';

// De gemeten verandering tussen twee datums. Alleen velden die op allebei
// de momenten een waarde hebben — anders vergelijk je met een gat.
function gemetenTussen(a, b) {
  const velden = [
    { id: 'weight', label: 'Gewicht', eenheid: 'kg', omlaagGoed: true },
    { id: 'waist', label: 'Taille', eenheid: 'cm', omlaagGoed: true },
    { id: 'navel', label: 'Navel', eenheid: 'cm', omlaagGoed: true },
    { id: 'hip', label: 'Heup', eenheid: 'cm', omlaagGoed: true },
    { id: 'chest', label: 'Borst', eenheid: 'cm', omlaagGoed: null },
    { id: 'thigh', label: 'Dij', eenheid: 'cm', omlaagGoed: null },
    { id: 'arm', label: 'Arm', eenheid: 'cm', omlaagGoed: null },
  ];
  const uit = [];
  for (const v of velden) {
    let rijen = [];
    try { rijen = series(v.id) || []; } catch { rijen = []; }
    const bij = (datum) => {
      // De dichtstbijzijnde meting binnen een week; verder weg is het geen
      // meting van dat moment meer.
      //
      // Hier stond `r.date`, en een waarneming uit de tijdlijn heet
      // `observedAt`. Dat veld bestaat niet, dus elke afstand werd NaN,
      // niets kwam ooit door de vergelijking, en het scherm meldde
      // doodleuk "geen metingen rond allebei de datums" terwijl zij op
      // allebei de dagen gewogen had. Een lege uitkomst die zich
      // voordoet als een bevinding.
      let best = null, beste = 8;
      for (const r of rijen) {
        const d = Math.abs(daysBetween(r.observedAt, datum));
        if (Number.isFinite(d) && d < beste) { beste = d; best = r; }
      }
      return best;
    };
    const ra = bij(a), rb = bij(b);
    if (!ra || !rb || ra.observedAt === rb.observedAt) continue;
    const delta = +(rb.value - ra.value).toFixed(1);
    uit.push({ ...v, van: ra.value, tot: rb.value, delta,
      vanDatum: ra.observedAt, totDatum: rb.observedAt });
  }
  return uit;
}

export default function FotoVergelijk({ onClose = null }) {
  const [fotos, setFotos] = useState([]);
  const [keuze, setKeuze] = useState([]);
  const [bezig, setBezig] = useState(true);

  useEffect(() => {
    let levend = true;
    photoStore.getDaily?.()
      .then(lijst => {
        if (!levend) return;
        // Oudste eerst leest als een tijdlijn.
        const op = (lijst || []).slice().sort((x, y) =>
          x.date.localeCompare(y.date) || x.type.localeCompare(y.type));
        setFotos(op);
        // Standaard: de eerste en de laatste. Dat is de vergelijking
        // waar zij om vroeg; alles anders kiest ze zelf.
        if (op.length >= 2) setKeuze([op[0].id, op[op.length - 1].id]);
        setBezig(false);
      })
      .catch(() => { if (levend) setBezig(false); });
    return () => { levend = false; };
  }, []);

  const dagVan = useMemo(() => {
    const ch = loadChallenge();
    const m = new Map();
    for (const [datum, rec] of Object.entries(ch?.days || {})) m.set(datum, rec?.day);
    return m;
  }, []);

  const gekozen = keuze.map(id => fotos.find(f => f.id === id)).filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  const [eerste, laatste] = gekozen;
  const gemeten = useMemo(
    () => (eerste && laatste ? gemetenTussen(eerste.date, laatste.date) : []),
    [eerste?.date, laatste?.date]);
  const verg = useMemo(
    () => (eerste && laatste ? comparability(eerste.date, laatste.date) : null),
    [eerste?.date, laatste?.date]);
  // Deze drie staan bewust vóór de useMemo hieronder. `tick` zit in zijn
  // dependency-lijst, en een const die later in het blok wordt
  // gedeclareerd is daarboven nog niet benaderbaar — dat gaf "Cannot
  // access 'v' before initialization". Het zichtbare gevolg was niet dit
  // onderdeel maar de afvinkkaart van de 75-dagen-challenge die niet meer
  // opkwam: één fout in een component haalt het hele tabblad onderuit.
  const [kijkt, setKijkt] = useState(false);
  const [fout, setFout] = useState(null);
  const [tick, setTick] = useState(0);

  // Is dit paar al beoordeeld? Dan staat het oordeel er in plaats van de
  // uitleg waarom het er nog niet is.
  const oordeel = useMemo(() => {
    if (!eerste || !laatste) return null;
    try {
      return loadAnalyses().find(a => a.from === eerste.date && a.to === laatste.date) || null;
    } catch { return null; }
  }, [eerste?.date, laatste?.date, tick]);

  // ── De beelden werkelijk laten bekijken ──────────────────────
  //
  // Dezelfde route als de progressiefoto's: ai.comparePhotos via de Edge
  // Function, met de vaste vragenlijst en de coachcontext van die dag
  // erbij. Het antwoord gaat door normalizeAnalysis, zodat een veld dat
  // het model niet op de schaal beantwoordt neutraal wordt in plaats van
  // half ingevuld door te lekken.
  async function vergelijk() {
    if (!eerste || !laatste) return;
    setKijkt(true); setFout(null);
    try {
      // ── Pas hier inladen, niet bovenaan ──────────────────────
      //
      // ai.js trekt de coachmodules mee, en die verwijzen verderop weer
      // naar schermen die dit onderdeel bevatten. Een gewone import
      // bovenaan maakte daar een kring van, en dan draait een module
      // terwijl een andere nog niet klaar is: "Cannot access 'v' before
      // initialization". Het zichtbare gevolg was niet dit scherm maar
      // de afvinkkaart van de 75-dagen-challenge die niet meer opkwam.
      // Dynamisch laden knipt de kring door, en het kost niets: deze
      // code is pas nodig als zij op de knop drukt.
      const [{ ai }, { buildCoachContext, contextAsText }] = await Promise.all([
        import('../ai'), import('../coachContext'),
      ]);
      const req = {
        ok: true,
        from: eerste.date, to: laatste.date,
        images: [eerste, laatste].map(f => ({ base64: f.base64,
          mimeType: f.mimeType || 'image/jpeg' })),
        labels: [
          `afbeelding 1: REFERENTIE ${eerste.date} — challengefoto`,
          `afbeelding 2: NU ${laatste.date} — challengefoto`,
        ],
        sharedViews: ['challengefoto'],
        unpairedViews: [],
        comparability: verg || { note: 'Challengefoto\'s; omstandigheden niet vastgelegd.' },
      };
      const rauw = await ai.comparePhotos(req, {
        fields: ANALYSIS_FIELDS,
        schema: analysisSchema(),
        context: contextAsText(buildCoachContext({ asOf: laatste.date })),
      });
      const g = normalizeAnalysis(rauw, req);
      saveAnalysis({
        track: 'challenge', from: req.from, to: req.to,
        fields: g.fields, evidence: g.evidence, notVisible: g.notVisible,
        confidence: g.confidence, confidenceReason: g.confidenceReason,
        comparability: req.comparability, method: 'visual', model: g.model,
        viewsCompared: ['challengefoto'], summary: g.summary,
      });
      setTick(t => t + 1);
    } catch (e) {
      setFout(e?.message || 'De vergelijking is niet gelukt.');
    } finally { setKijkt(false); }
  }

  function tik(id) {
    setKeuze(k => {
      if (k.includes(id)) return k.filter(x => x !== id);
      if (k.length >= 2) return [k[1], id];      // oudste valt af
      return [...k, id];
    });
  }

  if (bezig) return <div className="os-card" style={{ fontSize: 12 }}>Foto's laden…</div>;
  if (fotos.length < 2) {
    return (
      <div className="os-card" style={{ fontSize: 12, lineHeight: 1.55 }}>
        Er zijn nog geen twee challengefoto's om te vergelijken. Zodra je er twee hebt,
        staan ze hier naast elkaar.
      </div>
    );
  }

  return (
    <div data-fotovergelijk={fotos.length}>
      <div className="os-card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800 }}>Tik twee foto's aan</div>
        <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45,
          marginTop: 2 }}>
          De eerste en de laatste staan klaar. Tik een andere aan om te wisselen —
          de oudste van de twee valt dan af.
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 8,
          paddingBottom: 4 }}>
          {fotos.map(f => {
            const aan = keuze.includes(f.id);
            return (
              <button key={f.id} type="button" onClick={() => tik(f.id)}
                data-fotokeuze={f.id} data-gekozen={aan ? '1' : undefined}
                style={{ flexShrink: 0, width: 62, padding: 0, cursor: 'pointer',
                  border: aan ? '2px solid var(--sage)' : '1px solid var(--border)',
                  borderRadius: 7, overflow: 'hidden', background: 'none' }}>
                <img src={`data:${f.mimeType};base64,${f.base64}`} alt={f.date}
                  style={{ width: '100%', height: 78, objectFit: 'cover', display: 'block' }} />
                <div style={{ fontSize: 8.5, padding: '2px 0',
                  color: aan ? 'var(--sage)' : 'var(--ghost)', fontWeight: 700 }}>
                  {dagVan.get(f.date) ? `dag ${dagVan.get(f.date)}` : f.date.slice(5)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {eerste && laatste && (
        <>
          <div className="os-card" style={{ marginBottom: 8 }} data-vergelijk-paar>
            <div style={{ display: 'flex', gap: 8 }}>
              {[eerste, laatste].map((f, i) => (
                <div key={f.id} style={{ flex: 1 }}>
                  <img src={`data:${f.mimeType};base64,${f.base64}`} alt={f.date}
                    style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                  <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3 }}>
                    {i === 0 ? 'eerste' : 'laatste'} · {formatNLLong(f.date)}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--ghost)' }}>
                    {dagVan.get(f.date) ? `challengedag ${dagVan.get(f.date)}` : ''}
                    {DAILY_LABELS[f.type] ? ` · ${DAILY_LABELS[f.type]}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--sub)', marginTop: 6 }}>
              {daysBetween(eerste.date, laatste.date)} dagen ertussen
              {verg?.label ? ` · vergelijkbaarheid: ${verg.label}` : ''}
            </div>
          </div>

          {/* Het deel dat geen oog nodig heeft en niet kan verzinnen. */}
          <div className="os-card" style={{ marginBottom: 8 }}
            data-vergelijk-gemeten={gemeten.length}>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>
              Wat er tussen deze twee datums gemeten is
            </div>
            {gemeten.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5,
                marginTop: 3 }}>
                Geen metingen rond allebei de datums. Weeg en meet je rond een fotomoment,
                dan staat hier wat er veranderd is — en dat is het deel waar geen
                interpretatie bij komt kijken.
              </div>
            )}
            {gemeten.map(m => (
              <div key={m.id} data-gemeten={m.id}
                style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                  padding: '5px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                <span style={{ fontSize: 11.5, flex: 1 }}>{m.label}</span>
                <span style={{ fontSize: 11, color: 'var(--ghost)',
                  fontVariantNumeric: 'tabular-nums' }}>
                  {m.van} → {m.tot} {m.eenheid}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: m.omlaagGoed === null ? 'var(--text)'
                    : (m.delta < 0) === m.omlaagGoed ? 'var(--sage)' : 'var(--gold)' }}>
                  {m.delta > 0 ? '+' : ''}{m.delta}
                </span>
              </div>
            ))}
          </div>

          {/* En het deel dat wél een oog nodig heeft. */}
          <div className="os-card" style={{ borderLeft: `3px solid ${oordeel ? 'var(--sage)' : 'var(--gold)'}` }}
            data-vergelijk-beeld={oordeel ? 'ingevuld' : 'leeg'}>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>Wat er op het beeld te zien is</div>

            {oordeel ? (
              <>
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 2 }}>
                  Beoordeeld op {oordeel.enteredAt} · {oordeel.from} → {oordeel.to}
                </div>
                {ANALYSIS_FIELDS.map(f => {
                  const w = oordeel.fields?.[f.id];
                  if (!w) return null;
                  const bewijs = oordeel.evidence?.[f.id];
                  return (
                    <div key={f.id} data-oordeel={f.id}
                      style={{ padding: '6px 0', borderTop: '1px solid var(--border)',
                        marginTop: 5 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11.5, flex: 1 }}>{f.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800,
                          color: /meer|beter|vlakker|minder|gunstig/.test(w)
                            && !/ongunstig|slechter|boller/.test(w)
                            ? 'var(--sage)' : 'var(--ghost)' }}>{w}</span>
                      </div>
                      {bewijs && (
                        <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
                          {bewijs}
                        </div>
                      )}
                    </div>
                  );
                })}
                {oordeel.note && (
                  <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5,
                    marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                    {oordeel.note}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 3 }}>
                  Nog niet bekeken. Dit laat de twee beelden werkelijk analyseren —
                  dezelfde route en dezelfde harde regels als bij je progressiefoto's:
                  geen kilo's of centimeters uit beeld, een verschil in licht of
                  kleding is geen verandering in je lichaam, en wat niet te zien is
                  blijft leeg in plaats van ingevuld.
                </div>
                <button type="button" onClick={vergelijk} disabled={kijkt}
                  data-ijk-vergelijk
                  style={{ marginTop: 7, padding: '7px 12px', borderRadius: 7,
                    border: '1px solid var(--sage)', background: 'transparent',
                    color: 'var(--sage)', fontSize: 12, fontWeight: 800,
                    cursor: kijkt ? 'default' : 'pointer', opacity: kijkt ? 0.6 : 1 }}>
                  {kijkt ? 'Bezig met kijken…' : 'Bekijk deze twee foto\'s'}
                </button>
                {fout && (
                  <div style={{ fontSize: 11, color: 'var(--alert)', lineHeight: 1.5,
                    marginTop: 5 }} data-ijk-fout>{fout}</div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5,
                  marginTop: 5 }}>
                  Dit zijn de vaste punten waarop beoordeeld wordt:
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5,
                  marginTop: 3 }}>
                  {ANALYSIS_FIELDS.map(f => (
                    <div key={f.id}>· {f.label} — {f.ask}</div>
                  ))}
                </div>
              </>
            )}
            <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
              marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--border)' }}>
              Bij elk punt hoort niet alleen een oordeel te staan maar ook wát in het
              beeld dat oordeel draagt, of "niet te zien". Zonder dat is het een mening
              met een getal eromheen.
            </div>
          </div>
        </>
      )}
      {onClose && (
        <button type="button" onClick={onClose} style={{ marginTop: 8, background: 'none',
          border: 'none', color: 'var(--sage)', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', padding: 0 }}>sluiten</button>
      )}
    </div>
  );
}
