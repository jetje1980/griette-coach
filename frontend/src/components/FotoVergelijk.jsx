// Twee foto's naast elkaar, met wat er tussen die twee datums gemeten is.
//
// ─────────────────────────────────────────────────────────────────
// WAT ZIJ VROEG, EN WAT IK NIET KAN
//
// "Bij 75 challenge bij progressie vergelijk 1e en laatste foto, en geef
// zelf een AI-beeldanalyse van wat je ziet. Of laat me zelf 2 foto's
// aantikken voor je vergelijk."
//
// Het tweede kan; het eerste niet door de app zelf. Er draait geen model
// in deze app en er is geen sleutel naar een model — een knop die
// "AI-analyse" heet en zelf een praatje verzint, is erger dan geen knop.
//
// Wat er wél is: photoAnalysis.js heeft al een vaste vragenlijst voor
// precies zo'n beoordeling (taillecontour, buikprofiel, heup en dijen,
// spierdefinitie, houding, vocht in het gezicht, algemene richting), met
// per onderdeel de eis dat erbij staat wát in het beeld die uitspraak
// draagt. Die lijst wordt opgeslagen en voedt de tijdlijn.
//
// Dit scherm doet dus drie dingen, en belooft niet meer:
//   · zij kiest zelf twee foto's — standaard de eerste en de laatste;
//   · ernaast staat wat er tussen die twee datums gemeten is, want dat
//     is het deel dat geen oog nodig heeft en niet kan hallucineren;
//   · en als er voor dat paar een beoordeling is opgeslagen, staat die
//     erbij. Is die er niet, dan zegt het scherm hoe hij er komt in
//     plaats van te doen alsof hij er is.
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { photoStore, DAILY_LABELS } from '../photoStore';
import { loadChallenge } from '../challenge75';
import { ANALYSIS_FIELDS, comparability } from '../photoAnalysis';
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
      let best = null, beste = 8;
      for (const r of rijen) {
        const d = Math.abs(daysBetween(r.date, datum));
        if (d < beste) { beste = d; best = r; }
      }
      return best;
    };
    const ra = bij(a), rb = bij(b);
    if (!ra || !rb || ra.date === rb.date) continue;
    const delta = +(rb.value - ra.value).toFixed(1);
    uit.push({ ...v, van: ra.value, tot: rb.value, delta,
      vanDatum: ra.date, totDatum: rb.date });
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
          <div className="os-card" style={{ borderLeft: '3px solid var(--gold)' }}
            data-vergelijk-beeld>
            <div style={{ fontSize: 12.5, fontWeight: 800 }}>Wat er op het beeld te zien is</div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55,
              marginTop: 3 }}>
              Dit kan de app niet zelf: er draait hier geen beeldmodel. Een knop die
              "AI-analyse" heet en zelf een praatje verzint, is erger dan geen knop —
              dan ga je je trainen bijsturen op iets wat niemand heeft gezien.
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 5 }}>
              Laat deze twee foto's aan je coach zien, dan wordt de beoordeling hieronder
              ingevuld en bewaard bij dit paar. Dat zijn de vaste punten:
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5,
              marginTop: 5 }}>
              {ANALYSIS_FIELDS.map(f => (
                <div key={f.id}>· {f.label} — {f.ask}</div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
              marginTop: 6, paddingTop: 5, borderTop: '1px solid var(--border)' }}>
              Bij elk punt hoort er niet alleen een oordeel te staan maar ook wát in het
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
