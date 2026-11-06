import React, { useState } from 'react';
import { todayLocal, addDays, NL_DAYS_SHORT, dayOfWeek } from '../datetime';

// Met terugwerkende kracht invullen.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER KOMT
//
// Zij heeft haar rusthartslag van maanden terug in Garmin Connect staan.
// In deze app kon die alleen dag voor dag worden ingevoerd, via de
// dagkaart, door telkens terug te bladeren — zestig keer voor twee
// maanden. Dus bleef het staan, en moest ik bij de vraag "wat ging er aan
// 4 oktober vooraf" antwoorden dat er twaalf dagen niets in haar dagboek
// stond.
//
// Dat is zonde van gegevens die al bestaan. De rusthartslag is het
// informatiefste getal dat deze app heeft: hij voorspelt hoe een sessie
// valt, en over weken laat hij zien of de optelsom van belasting en
// herstel klopt. Twee maanden geschiedenis maakt die lijn meteen leesbaar
// in plaats van over zes weken.
//
// Eén metriek tegelijk, één kolom getallen, invullen en weg. Wat er al
// staat wordt getoond en overschrijft niets zonder dat zij het aanpast.
// ─────────────────────────────────────────────────────────────────

const METRIEKEN = [
  { id: 'hr_rest', label: 'Rusthartslag', eenheid: 'bpm', stap: 1,
    uitleg: 'Uit Garmin Connect: de rustwaarde van die nacht of ochtend. Dit is het '
      + 'getal waarmee de app ziet of je opbouw klopt.' },
  { id: 'weight', label: 'Gewicht', eenheid: 'kg', stap: 0.1,
    uitleg: 'Het verloop telt, niet de losse dag.' },
  { id: 'sleep_hours', label: 'Slaapuren', eenheid: 'uur', stap: 0.5,
    uitleg: 'Samen met je rusthartslag de beste voorspeller van hoe een sessie valt.' },
];

const VENSTERS = [
  { dagen: 30, label: '30 dagen' },
  { dagen: 60, label: '60 dagen' },
  { dagen: 90, label: '90 dagen' },
];

export default function BackfillPanel({ logs = {}, currentDate = todayLocal(), saveField }) {
  const [open, setOpen] = useState(false);
  const [metriek, setMetriek] = useState('hr_rest');
  const [dagen, setDagen] = useState(60);
  const [bezig, setBezig] = useState(0);
  const [melding, setMelding] = useState('');

  const meta = METRIEKEN.find(m => m.id === metriek);
  const rijen = Array.from({ length: dagen }, (_, i) => addDays(currentDate, -i));
  const ingevuld = rijen.filter(d => logs[d]?.[metriek] != null).length;

  async function bewaar(datum, ruw) {
    const waarde = ruw === '' ? null : Number(String(ruw).replace(',', '.'));
    if (waarde != null && !Number.isFinite(waarde)) return;
    setBezig(n => n + 1);
    try {
      await saveField?.(metriek, waarde, datum);
      setMelding(`${meta.label} van ${datum} bewaard.`);
    } finally {
      setBezig(n => Math.max(0, n - 1));
    }
  }

  return (
    <div className="os-card" style={{ marginBottom: 12 }} data-terugwerkend={open ? 'open' : 'dicht'}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', display: 'flex',
        justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>Met terugwerkende kracht invullen</div>
          <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
            Rusthartslag, gewicht of slaap uit je horloge overnemen — één kolom, zo ingetikt.
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            {METRIEKEN.map(m => (
              <button key={m.id} type="button" data-metriek={m.id}
                className={`os-toggle-chip ${metriek === m.id ? 'active green' : ''}`}
                onClick={() => { setMetriek(m.id); setMelding(''); }}
                style={{ fontSize: 11.5 }}>{m.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
            {VENSTERS.map(v => (
              <button key={v.dagen} type="button" data-venster={v.dagen}
                className={`os-toggle-chip ${dagen === v.dagen ? 'active green' : ''}`}
                onClick={() => setDagen(v.dagen)} style={{ fontSize: 11 }}>{v.label}</button>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 6 }}>
            {meta.uitleg} <strong>{ingevuld} van {dagen} dagen</strong> heeft al een waarde.
          </div>

          <div data-terugwerkend-rijen={rijen.length}>
            {rijen.map(d => {
              const waarde = logs[d]?.[metriek];
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  padding: '3px 0', borderTop: '1px solid var(--border)' }}>
                  <span style={{ width: 86, fontSize: 11, color: 'var(--ghost)',
                    fontVariantNumeric: 'tabular-nums' }}>
                    {NL_DAYS_SHORT[dayOfWeek(d)]} {d.slice(8)}-{d.slice(5, 7)}
                    {d === currentDate ? ' ·' : ''}
                  </span>
                  <input type="number" inputMode="decimal" step={meta.stap}
                    data-dag-invoer={d} defaultValue={waarde ?? ''}
                    placeholder={meta.eenheid}
                    onBlur={e => {
                      const nieuw = e.target.value;
                      const oud = waarde == null ? '' : String(waarde);
                      if (nieuw !== oud) bewaar(d, nieuw);
                    }}
                    style={{ width: 84, fontSize: 12, padding: '3px 6px', borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: waarde != null ? 'var(--card)' : 'var(--surface)',
                      color: 'var(--text)' }} />
                  {waarde != null && (
                    <span style={{ fontSize: 10, color: 'var(--sage)' }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>

          {melding && (
            <div style={{ fontSize: 10.5, color: 'var(--sage)', marginTop: 6 }}
              data-terugwerkend-melding>{melding}{bezig ? ' (bezig…)' : ''}</div>
          )}
          <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 6 }}>
            Een leeg veld laten staan verandert niets. Wat je invult gaat naar dezelfde
            dagboekregel als wanneer je die dag zelf had ingevuld, en telt meteen mee in
            de analyses.
          </div>
        </div>
      )}
    </div>
  );
}
