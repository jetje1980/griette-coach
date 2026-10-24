import React, { useState, useEffect, useCallback } from 'react';
import { photoStore, DAILY_TYPE, DAILY_LABELS } from '../photoStore';
import { challengeStatus, dayNumber, loadChallenge } from '../challenge75';
import { phaseForDay } from '../data/challenge75';
import { todayLocal, formatNLLong } from '../datetime';

// De dagelijkse fotoreeks als eigen tijdlijn.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT APART STAAT
//
// Deze foto's hebben een ander doel dan de wekelijkse progressiefoto's.
// Die laatste zijn een meting: voor, zij, achter en gezicht, op vaste
// momenten, bedoeld om over twaalf weken te vergelijken met maten en
// gewicht ernaast. De dagelijkse foto is iets anders — een bewijs dat de
// dag gedaan is, en een reeks die pas betekenis krijgt als je dag 1 naast
// dag 75 legt.
//
// Ze bij elkaar zetten zou beide reeksen bederven: de meting wordt
// onleesbaar tussen zeventig dagfoto's, en de dagfoto's krijgen een
// precisie-eis die ze niet hoeven te halen.
//
// Daarom: eigen soort in de opslag, eigen tabblad, eigen vergelijking.
// ─────────────────────────────────────────────────────────────────

const PER_KEER = 21;   // drie weken per keer bijladen

export default function DailyFeed({ currentDate = todayLocal(), refreshKey = 0 }) {
  const [fotos, setFotos] = useState(null);
  const [limiet, setLimiet] = useState(PER_KEER);
  const [groot, setGroot] = useState(null);
  const [vergelijk, setVergelijk] = useState(false);

  // refreshKey hoort in de afhankelijkheden: hij loopt op zodra er op de
  // kaart erboven een foto bij komt, en dan moet deze lijst opnieuw lezen.
  const laden = useCallback(() => {
    photoStore.getDaily?.().then(setFotos).catch(() => setFotos([]));
  }, [refreshKey]);
  useEffect(() => { laden(); }, [laden]);

  const st = challengeStatus({ currentDate });
  const state = loadChallenge();

  if (!st.active) {
    return (
      <div className="os-card" data-feed="niet-gestart">
        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
          De 75-dagenuitdaging is nog niet gestart. Zodra je hem start, komen je
          dagelijkse foto's hier te staan — los van je wekelijkse progressiefoto's,
          want dat is een andere reeks met een ander doel.
        </div>
      </div>
    );
  }

  if (fotos === null) {
    return <div className="os-card" style={{ fontSize: 12, color: 'var(--ghost)' }}>
      Foto's laden…
    </div>;
  }

  const metDag = fotos.map(f => ({ ...f, day: dayNumber(f.date, state) }))
    .filter(f => f.day != null);
  // Vergelijken doe je met dezelfde plek: foto 1 van de eerste dag naast
  // foto 1 van de laatste. Een voorkant naast een zijkant is geen
  // vergelijking, dat is een verschil in camerahoek.
  const eersteRij = metDag.filter(f => f.type === DAILY_TYPE);
  const rij = eersteRij.length >= 2 ? eersteRij : metDag;
  const eerste = rij[rij.length - 1] || null;
  const laatste = rij[0] || null;

  return (
    <div data-feed={metDag.length}>
      {/* ── De stand ────────────────────────────────────────── */}
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-serif)',
            lineHeight: 1 }}>{metDag.length}</div>
          <div style={{ fontSize: 12, color: 'var(--sub)', flex: 1 }}>
            foto's · dag {st.day} van {st.totalDays}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
          {metDag.length < 2
            ? 'Vanaf twee foto\'s kun je vergelijken. Dagelijks zie je niets — dat hoort zo.'
            : `Je eerste foto is van dag ${eerste.day}, je laatste van dag ${laatste.day}. `
              + `Kijk naar het verschil tussen die twee en niet naar gisteren.`}
        </div>
        {st.phase && (
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
            {st.phase.label} — {st.phase.visible}
          </div>
        )}
        {metDag.length >= 2 && (
          <button type="button" data-feed-vergelijk onClick={() => setVergelijk(v => !v)}
            style={{ fontSize: 11, padding: '5px 11px', borderRadius: 99, marginTop: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--sub)', cursor: 'pointer' }}>
            {vergelijk ? 'vergelijking sluiten' : `dag ${eerste.day} naast dag ${laatste.day}`}
          </button>
        )}
      </div>

      {/* ── Eerste naast laatste ───────────────────────────── */}
      {vergelijk && metDag.length >= 2 && (
        <div className="os-card" style={{ marginBottom: 12 }} data-feed-vergelijking>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[eerste, laatste].map((f, i) => (
              <div key={`${f.date}_${f.type}`}>
                <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700,
                  marginBottom: 3 }}>
                  {i === 0 ? 'Dag' : 'Dag'} {f.day} · {f.date.slice(5)}
                </div>
                <img src={`data:${f.mimeType};base64,${f.base64}`}
                  alt={`dag ${f.day}`}
                  style={{ width: '100%', borderRadius: 6, display: 'block' }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
            {laatste.day - eerste.day} dagen ertussen. Verschil in licht of houding
            is geen verschil in lichaam — let op de omtrek, niet op de schaduw.
          </div>
        </div>
      )}

      {/* ── De reeks ───────────────────────────────────────── */}
      {metDag.length === 0 ? (
        <div className="os-card" style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
          Nog geen dagfoto's. Je maakt ze op Vandaag, bij de 75-dagenkaart.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}
          data-feed-raster>
          {metDag.slice(0, limiet).map(f => {
            const fase = phaseForDay(f.day);
            // Sleutel op datum én plek: sinds er twee foto's per dag kunnen,
            // is de datum alleen niet meer uniek — en twee tegels met
            // dezelfde sleutel laat React er stilletjes één van tonen.
            return (
              <div key={`${f.date}_${f.type}`} onClick={() => setGroot(f)}
                data-feed-foto={f.day} data-feed-plek={f.type}
                style={{ cursor: 'pointer', position: 'relative' }}>
                <img src={`data:${f.mimeType};base64,${f.base64}`} alt={`dag ${f.day}`}
                  loading="lazy"
                  style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                    borderRadius: 6, display: 'block' }} />
                <div style={{ position: 'absolute', left: 4, bottom: 4,
                  fontSize: 9.5, fontWeight: 800, color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {f.day}{f.type !== DAILY_TYPE ? ' ·2' : ''}
                </div>
                {!f.cloudOk && (
                  <div style={{ position: 'absolute', right: 4, top: 4, fontSize: 9,
                    color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                    title="staat nog niet online">○</div>
                )}
                <div style={{ display: 'none' }}>{fase.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {metDag.length > limiet && (
        <button type="button" onClick={() => setLimiet(l => l + PER_KEER)}
          style={{ fontSize: 11, padding: '6px 12px', borderRadius: 99, marginTop: 10,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--sub)', cursor: 'pointer', width: '100%' }}>
          Nog {Math.min(PER_KEER, metDag.length - limiet)} eerdere dagen laden
        </button>
      )}

      {/* ── Eén foto groot ─────────────────────────────────── */}
      {groot && (
        <div onClick={() => setGroot(null)} data-feed-groot={groot.day}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 16 }}>
          <img src={`data:${groot.mimeType};base64,${groot.base64}`} alt={`dag ${groot.day}`}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} />
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 10 }}>
            Dag {groot.day} · {formatNLLong(groot.date)} · {DAILY_LABELS[groot.type] || groot.type}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4,
            textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
            {phaseForDay(groot.day).label}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 10 }}>
            tik om te sluiten
          </div>
        </div>
      )}

      <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.55, marginTop: 12 }}>
        Deze reeks staat los van je wekelijkse progressiefoto's (voor, zij, achter,
        gezicht). Die zijn een meting met maten en gewicht ernaast; dit is een
        dagelijkse reeks. Ze delen de opslag en de cloud, maar niet de tijdlijn —
        anders is geen van beide nog te lezen.
      </div>
    </div>
  );
}
