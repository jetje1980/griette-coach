import React, { useState, useEffect, useCallback } from 'react';
import { photoStore, DAILY_TYPES, DAILY_LABELS } from '../photoStore';
import { downscaleForStorage } from '../imageDownscale';
import { markPhoto } from '../challenge75';

// De twee foto's van één dag.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT EEN EIGEN COMPONENT IS
//
// Deze reeks heeft nu twee plekken per dag, en hij wordt op drie schermen
// gebruikt: de dagkaart op Vandaag, dezelfde kaart op Progressie → 75
// dagen, en het raster van 75 dagen. Drie keer dezelfde opslagcode
// overschrijven is drie keer een plek waar een foto anders terechtkomt —
// en dat is precies het soort verschil waardoor haar foto van dag 1 eerder
// in de verkeerde reeks belandde.
//
// Eén weg dus: verkleinen → photoStore (toestel plus cloud) → vastleggen in
// de reeks. Wat hier staat, staat overal hetzelfde.
//
// WAT EROP MOET STAAN, BEPAALT ZIJ
//
// Geen vaste aanzichten zoals bij de wekelijkse progressiefoto's (voor,
// zij, achter, gezicht). Dit zijn twee plekken; of dat voor en zij wordt,
// of ochtend en avond, of een spiegelfoto en een detail, is haar keuze.
// Een app die dat invult, maakt van een dagelijkse gewoonte een formulier.
// ─────────────────────────────────────────────────────────────────

export default function DagFotos({ date, dayNr, onChanged, uitleg = null }) {
  // Welke plekken zijn al gevuld? Dat leest deze component uit de
  // fotoopslag zelf en niet uit de boekhouding in de reeks: de foto's zijn
  // het bewijs, de boekhouding is een afgeleide die achter kan lopen.
  const [aanwezig, setAanwezig] = useState(null);
  const [bezig, setBezig] = useState(null);
  const [melding, setMelding] = useState('');

  const laden = useCallback(() => {
    photoStore.getDaily?.()
      .then(l => setAanwezig(new Set((l || [])
        .filter(p => p.date === date).map(p => p.type))))
      .catch(() => setAanwezig(new Set()));
  }, [date]);
  useEffect(() => { laden(); setMelding(''); }, [laden]);

  async function kies(type, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBezig(type); setMelding('');
    try {
      const klein = await downscaleForStorage(file);
      const uit = await photoStore.save(date, type, klein.base64, klein.mimeType,
        { source: 'challenge75', day: dayNr, resized: klein.resized,
          originalBytes: klein.originalBytes });
      markPhoto(date, { type, photoId: uit?.photoId || null });
      laden();
      onChanged?.();
      setMelding((uit?.ok === false
        ? `${DAILY_LABELS[type]} staat op dit toestel; hij gaat mee zodra er verbinding is.`
        : `${DAILY_LABELS[type]} van dag ${dayNr} bewaard.`)
        + (klein.note ? ` ${klein.note}` : ''));
    } catch {
      setMelding('Die foto kon niet worden gelezen. Probeer een andere.');
    } finally { setBezig(null); }
  }

  const klaar = aanwezig != null;

  return (
    <div data-dagfotos={klaar ? aanwezig.size : 'laden'}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {DAILY_TYPES.map(type => {
          const staat = klaar && aanwezig.has(type);
          return (
            <label key={type} data-dagfoto={type}
              data-dagfoto-staat={staat ? 'ja' : 'nee'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, cursor: 'pointer', fontWeight: 600,
                color: staat ? 'var(--sage)' : 'var(--gold)' }}>
              {staat ? '✓' : '📷'} {DAILY_LABELS[type]}
              <span style={{ fontWeight: 400, color: 'var(--ghost)', fontSize: 10.5 }}>
                {bezig === type ? 'bezig…' : staat ? '(vervangen)' : '(toevoegen)'}
              </span>
              <input type="file" accept="image/*" disabled={!!bezig}
                onChange={e => kies(type, e)} style={{ display: 'none' }} />
            </label>
          );
        })}
      </div>
      {melding && (
        <div style={{ fontSize: 10.5, color: 'var(--sage)', marginTop: 4 }}
          data-dagfoto-melding>{melding}</div>
      )}
      {uitleg && (
        <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 3 }}>
          {uitleg}
        </div>
      )}
    </div>
  );
}
