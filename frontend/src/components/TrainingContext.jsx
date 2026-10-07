import React, { useState, useMemo } from 'react';
import { sessionContextFor, openVragen, saveSessionContext, contextLines }
  from '../sessionContext';

// De omstandigheden van één training — gevraagd, niet geraden.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BLOK BESTAAT
//
// De app zei "loopeconomie gaat achteruit" op grond van twee gemiddelden.
// Wat eromheen speelde — cyclusdag, de nacht ervoor, zand of asfalt, wind,
// nuchter of gegeten — kwam in die rekensom niet voor. Dan meet je
// omstandigheden en noem je het fysiologie.
//
// Drie dingen staan hier, in deze volgorde:
//
//   1. wat de app zelf al weet (cyclusdag, slaap uit de ochtendcheck-in) —
//      dat wordt niet gevraagd, want een vraag waarvan je het antwoord hebt
//      is een vraag te veel;
//   2. gerichte vragen, maar alleen als er iets te verklaren valt, en per
//      signaal verschillend;
//   3. een open veld voor haar eigen lezing, dat woordelijk meegaat.
//
// Elke vraag zegt waaróm hij gesteld wordt. Een vraag zonder reden is een
// formulier, en formulieren worden na twee weken overgeslagen.
// ─────────────────────────────────────────────────────────────────

const chip = (actief) => ({
  fontSize: 10.5, padding: '4px 9px', borderRadius: 99, cursor: 'pointer',
  border: `1px solid ${actief ? 'var(--sage)' : 'var(--border)'}`,
  background: actief ? 'var(--sage)' : 'transparent',
  color: actief ? '#fff' : 'var(--sub)',
  fontWeight: actief ? 700 : 500,
});

export default function TrainingContext({
  date, logs = {}, currentDate, signals = [], toon = 'volledig', refresh = 0, onSaved,
}) {
  const [tick, setTick] = useState(0);
  const [melding, setMelding] = useState(null);

  const ctx = useMemo(() => sessionContextFor(date, { logs, asOf: currentDate }),
    // `refresh` komt van buiten: bewaart een ander blok iets over dezelfde
    // dag, dan hoort dit blok dat meteen te tonen en niet pas na herladen.
    [date, logs, currentDate, tick, refresh]);
  const [lezing, setLezing] = useState(ctx.note || '');

  const open = openVragen(ctx, signals);
  const bekend = contextLines(ctx);

  function antwoord(veldId, waarde) {
    // Hetzelfde antwoord nog eens aantikken betekent: toch niet.
    const nu = ctx.answers?.[veldId];
    saveSessionContext(date, { [veldId]: nu === waarde ? null : waarde });
    setTick(t => t + 1);
    setMelding('Meegenomen in de analyse.');
    onSaved?.();
  }

  function bewaarLezing() {
    saveSessionContext(date, { note: lezing.trim() || null });
    setTick(t => t + 1);
    setMelding(lezing.trim()
      ? 'Je lezing is bewaard en gaat woordelijk mee in de analyse.'
      : 'Je lezing is gewist.');
    onSaved?.();
  }

  return (
    <div data-trainingcontext={date}>
      {/* Wat de app zelf al weet. Onbekend is óók een waarde en staat er dus. */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span data-cyclusdag={ctx.cycleDay ?? ''}
          style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 8px',
            border: `1px solid ${ctx.cycleDay != null ? 'var(--gold)' : 'var(--border)'}`,
            color: ctx.cycleDay != null ? 'var(--gold)' : 'var(--ghost)' }}>
          {ctx.cycleDay != null ? `cyclusdag ${ctx.cycleDay}` : 'cyclusdag onbekend'}
        </span>
        {ctx.sleepHours != null && (
          <span style={{ fontSize: 10, color: 'var(--ghost)' }}>
            {String(ctx.sleepHours).replace('.', ',')} uur geslapen
          </span>
        )}
      </div>

      {/* Ook ingeklapt: wat er al staat. Anders zie je niet welke sessie nog
          een antwoord mist, en vul je ze allemaal opnieuw of geen enkele. */}
      {bekend.length > 1 && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 4 }}
          data-contextregels>
          {bekend.join(' · ')}
        </div>
      )}

      {toon === 'volledig' && (
        <>
          {/* De gerichte vragen. Alleen wat dit signaal kan verklaren. */}
          {open.length > 0 && (
            <div style={{ marginTop: 8 }} data-gerichte-vragen={open.length}>
              {open.map(v => (
                <div key={v.id} style={{ marginBottom: 9 }} data-vraag={v.id}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.4 }}>{v.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45,
                    marginBottom: 4 }}>{v.waarom}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {v.opties.map(o => (
                      <button key={o} type="button" data-optie={o}
                        onClick={() => antwoord(v.id, o)}
                        style={chip(ctx.answers?.[v.id] === o)}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Wat al beantwoord is, blijft aanpasbaar. Een antwoord dat je niet
              kunt terugnemen is een antwoord dat je niet durft te geven. */}
          {Object.keys(ctx.answers || {}).filter(k =>
            !['date', 'updatedAt', 'note'].includes(k) && ctx.answers[k]).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 4 }}>
              Antwoord aantikken wist het weer.
            </div>
          )}

          {/* Het open veld. Zij ziet dingen die geen vraag afdekt. */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.4 }}>
              Zie jij zelf een reden of omstandigheid?
            </div>
            <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginBottom: 4 }}>
              Wat je hier schrijft gaat woordelijk mee in de analyse en in wat de coach je
              vertelt. Geen keuzelijst kan dit vervangen.
            </div>
            <textarea data-eigen-lezing value={lezing} rows={2}
              onChange={e => { setLezing(e.target.value); setMelding(null); }}
              placeholder="bijv. tegenwind heen en terug, en de dag ervoor zware migraine"
              style={{ width: '100%', fontSize: 12, lineHeight: 1.5, padding: '7px 9px',
                borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical',
                boxSizing: 'border-box' }} />
            <button type="button" data-lezing-opslaan onClick={bewaarLezing}
              style={{ fontSize: 11, padding: '5px 11px', borderRadius: 99, marginTop: 5,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--sub)', cursor: 'pointer' }}>
              Bewaren
            </button>
          </div>
        </>
      )}

      {melding && (
        <div data-lezing-melding style={{ fontSize: 10.5, color: 'var(--sage)',
          lineHeight: 1.45, marginTop: 5 }}>{melding}</div>
      )}
    </div>
  );
}
