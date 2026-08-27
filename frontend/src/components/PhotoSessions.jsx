import React, { useState } from 'react';
import { VIEWS } from '../photoAnalysis';
import { formatNLLong } from '../datetime';

// Eén fotosessie is één rij.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// Er stonden twee weergaves naast elkaar en allebei klopten ze niet met hoe
// je erover denkt.
//
//   · "Start · vorige · nu" zette de sessies als kolommen naast elkaar en de
//     aanzichten eronder. Daardoor las je van boven naar beneden per
//     aanzicht, en waren er nooit meer dan drie momenten zichtbaar — niet
//     omdat er niet meer waren, maar omdat die weergave er maar drie kende.
//   · De tijdlijn zette de datum bóven een blok van drie foto's, zonder
//     gezicht, dus één sessie besloeg meerdere regels en miste een kwart.
//
// Wat het hoort te zijn: één regel per moment. De datum links, daarnaast de
// foto's van díe dag, gezicht incluis. Daaronder de vorige keer. Zo lees je
// van boven naar beneden door de tijd, en van links naar rechts door één
// moment.
//
// ─────────────────────────────────────────────────────────────────
// GEEN LIMIET
//
// Alle sessies zijn bereikbaar. Er wordt in stappen bijgeladen omdat vier
// base64-foto's per rij zwaar zijn voor een telefoon, maar er verdwijnt
// niets: de knop eronder laadt de rest, en het aantal staat erbij.
// ─────────────────────────────────────────────────────────────────

const src = (p) => (p ? `data:${p.mimeType};base64,${p.base64}` : null);

// Hoeveel rijen er eerst getoond worden. Meer is één tik.
export const EERSTE_LADING = 8;

function korteDatum(datum) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export default function PhotoSessions({
  sessions = [], onOpen, onShoot, lege = null, stap = EERSTE_LADING,
}) {
  const [zichtbaar, setZichtbaar] = useState(stap);

  // Nieuwste bovenaan. De bron levert oplopend of aflopend aan; hier wordt
  // het één keer vastgelegd zodat het scherm er niet van afhangt.
  const alle = [...sessions]
    .filter(s => s?.date && Object.keys(s.views || {}).length)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!alle.length) {
    return (
      <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--muted)',
        fontSize: 13, lineHeight: 1.6 }} data-fotos-leeg>
        {lege || <>Nog geen progressiefoto&apos;s.<br />
          <span style={{ fontSize: 11 }}>Maak ze via Progressie → Body → Wekelijkse check-in.</span></>}
      </div>
    );
  }

  const rijen = alle.slice(0, zichtbaar);

  return (
    <div data-foto-sessies>
      {rijen.map(sessie => {
        const aanwezig = VIEWS.filter(v => sessie.views?.[v.key]).length;
        return (
          <div key={sessie.date} data-foto-rij={sessie.date}
            style={{ display: 'flex', alignItems: 'stretch', gap: 8,
              padding: '8px 0', borderTop: '1px solid var(--border)' }}>

            {/* De datum links, één keer per rij. */}
            <div style={{ width: 62, flexShrink: 0, paddingTop: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}
                title={formatNLLong(sessie.date)}>
                {korteDatum(sessie.date)}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--ghost)', marginTop: 1 }}>
                {sessie.date.slice(0, 4)}
              </div>
              <div style={{ fontSize: 9.5, color: aanwezig === VIEWS.length ? 'var(--sage)' : 'var(--ghost)',
                marginTop: 3 }}>
                {aanwezig}/{VIEWS.length}
              </div>
            </div>

            {/* De foto's van díe dag, naast elkaar. Past het niet op de
                breedte van een telefoon, dan schuift deze strook — de rij
                wordt níét opgebroken in meerdere regels. */}
            <div data-foto-strook
              style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, minWidth: 0,
                paddingBottom: 2, scrollSnapType: 'x proximity',
                WebkitOverflowScrolling: 'touch' }}>
              {VIEWS.map(v => {
                const foto = sessie.views?.[v.key];
                return (
                  <div key={v.key} data-foto-vak={v.key}
                    style={{ flex: '0 0 auto', width: 72, scrollSnapAlign: 'start' }}>
                    {foto ? (
                      <img src={src(foto)} alt={`${sessie.date} ${v.label}`}
                        onClick={() => onOpen?.({ photo: foto,
                          label: `${v.label} — ${formatNLLong(sessie.date)}` })}
                        style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 7,
                          border: '1px solid var(--border)', cursor: onOpen ? 'zoom-in' : 'default',
                          display: 'block' }} />
                    ) : (
                      <button type="button" onClick={() => onShoot?.(sessie.date, v.key)}
                        style={{ width: 72, height: 96, borderRadius: 7, padding: 0,
                          border: '1px dashed var(--border)', background: 'var(--surface)',
                          color: 'var(--ghost)', fontSize: 9.5, cursor: onShoot ? 'pointer' : 'default' }}>
                        {v.label}<br />ontbreekt
                      </button>
                    )}
                    <div style={{ fontSize: 9, color: 'var(--ghost)', textAlign: 'center',
                      marginTop: 2 }}>{v.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Wat er nog is, en hoe je erbij komt. Nooit stilzwijgend afkappen. */}
      <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 10,
        paddingTop: 8, borderTop: '1px solid var(--border)' }} data-fotos-teller>
        {zichtbaar >= alle.length
          ? `Alle ${alle.length} fotomomenten getoond.`
          : (
            <>
              {rijen.length} van {alle.length} fotomomenten.{' '}
              <button data-fotos-meer onClick={() => setZichtbaar(n => n + stap)}
                style={{ background: 'none', border: 'none', color: 'var(--sage)',
                  fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Toon {Math.min(stap, alle.length - zichtbaar)} oudere →
              </button>
            </>
          )}
      </div>
    </div>
  );
}
