import React, { useState } from 'react';
import { todayLocal, addDays, NL_DAYS_SHORT, dayOfWeek } from '../datetime';

// Met terugwerkende kracht invullen — alle metingen naast elkaar.
//
// ─────────────────────────────────────────────────────────────────
// WAT ER MIS WAS
//
// De eerste versie toonde één metriek tegelijk, met knoppen om te
// wisselen. Dat had een fout die precies deed wat zij beschreef: de
// invoervelden stonden op `defaultValue` en kregen de datum als sleutel.
// Wissel je van rusthartslag naar gewicht, dan hergebruikt React dezelfde
// velden — want de sleutels zijn gelijk — en blijft de ingetikte waarde
// van de vórige metriek gewoon staan. Je ziet dan rusthartslagen in de
// kolom gewicht. De gegevens in de opslag klopten wel; het scherm loog.
//
// Twee manieren om dat te repareren: de sleutel per metriek uniek maken,
// of de keuze overbodig maken. Haar eigen voorstel is het betere — drie
// kolommen naast elkaar, één regel per dag. Dan is er niets om te
// wisselen, zie je in één oogopslag welke dag nog gaten heeft, en vul je
// een dag in één beweging compleet.
//
// Elke kolom schrijft naar hetzelfde daglog als de rest van de app, dus
// er ontstaat geen tweede opslag.
// ─────────────────────────────────────────────────────────────────

const KOLOMMEN = [
  { id: 'hr_rest', kop: 'Rust-HR', eenheid: 'bpm', stap: 1, breedte: 58,
    uitleg: 'Rusthartslag uit Garmin Connect. Het informatiefste getal dat je de app '
      + 'kunt geven: het zegt vóór je de deur uitgaat hoe de dag eruitziet, en over '
      + 'weken of je opbouw klopt.' },
  { id: 'weight', kop: 'Gewicht', eenheid: 'kg', stap: 0.1, breedte: 62,
    uitleg: 'Het verloop telt, niet de losse dag — daarmee wordt zichtbaar of je in '
      + 'een tekort zit.' },
  { id: 'sleep_hours', kop: 'Slaap', eenheid: 'uur', stap: 0.5, breedte: 54,
    uitleg: 'Samen met je rusthartslag de beste voorspeller van hoe een sessie valt.' },
];

const VENSTERS = [30, 60, 90];

export default function BackfillPanel({ logs = {}, currentDate = todayLocal(), saveField }) {
  const [open, setOpen] = useState(false);
  const [dagen, setDagen] = useState(60);
  const [melding, setMelding] = useState('');
  const [uitleg, setUitleg] = useState(null);

  const rijen = Array.from({ length: dagen }, (_, i) => addDays(currentDate, -i));
  const gevuld = (id) => rijen.filter(d => logs[d]?.[id] != null).length;

  async function bewaar(datum, veld, ruw) {
    const waarde = ruw === '' ? null : Number(String(ruw).replace(',', '.'));
    if (waarde != null && !Number.isFinite(waarde)) return;
    await saveField?.(veld, waarde, datum);
    const kolom = KOLOMMEN.find(k => k.id === veld);
    setMelding(`${kolom?.kop || veld} van ${datum} bewaard.`);
  }

  return (
    <div className="os-card" style={{ marginBottom: 12 }}
      data-terugwerkend={open ? 'open' : 'dicht'}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', display: 'flex',
        justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>Met terugwerkende kracht invullen</div>
          <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45 }}>
            Rusthartslag, gewicht en slaap uit je horloge — één regel per dag, drie kolommen.
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {VENSTERS.map(v => (
              <button key={v} type="button" data-venster={v}
                className={`os-toggle-chip ${dagen === v ? 'active green' : ''}`}
                onClick={() => setDagen(v)} style={{ fontSize: 11 }}>{v} dagen</button>
            ))}
          </div>

          {/* Kop met per kolom hoeveel dagen al gevuld zijn */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6,
            paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 74, fontSize: 10, color: 'var(--ghost)' }}>datum</span>
            {KOLOMMEN.map(k => (
              <button key={k.id} type="button" data-kolom={k.id}
                onClick={() => setUitleg(uitleg === k.id ? null : k.id)}
                style={{ width: k.breedte, background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text)' }}>
                  {k.kop} ⓘ
                </div>
                <div style={{ fontSize: 9, color: 'var(--ghost)' }}>
                  {gevuld(k.id)}/{dagen}
                </div>
              </button>
            ))}
          </div>

          {uitleg && (
            <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5,
              padding: '5px 0' }} data-kolom-uitleg={uitleg}>
              {KOLOMMEN.find(k => k.id === uitleg)?.uitleg}
            </div>
          )}

          <div data-terugwerkend-rijen={rijen.length}>
            {rijen.map(d => (
              <div key={d} data-rij={d}
                style={{ display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ width: 74, fontSize: 10.5, color: 'var(--ghost)',
                  fontVariantNumeric: 'tabular-nums' }}>
                  {NL_DAYS_SHORT[dayOfWeek(d)]} {d.slice(8)}-{d.slice(5, 7)}
                  {d === currentDate ? ' ·' : ''}
                </span>
                {KOLOMMEN.map(k => {
                  const waarde = logs[d]?.[k.id];
                  return (
                    <input
                      // De sleutel draagt de metriek mee. Zonder dat
                      // hergebruikt React het veld bij een wisseling en
                      // blijft de waarde van de vorige kolom staan — dat
                      // was precies de verwarring.
                      key={`${k.id}_${d}`}
                      type="number" inputMode="decimal" step={k.stap}
                      data-dag-invoer={`${k.id}_${d}`}
                      defaultValue={waarde ?? ''}
                      onBlur={e => {
                        const nieuw = e.target.value;
                        const oud = waarde == null ? '' : String(waarde);
                        if (nieuw !== oud) bewaar(d, k.id, nieuw);
                      }}
                      style={{ width: k.breedte, fontSize: 11.5, padding: '3px 4px',
                        borderRadius: 6, textAlign: 'center',
                        border: '1px solid var(--border)',
                        background: waarde != null ? 'var(--card)' : 'var(--surface)',
                        color: 'var(--text)' }} />
                  );
                })}
              </div>
            ))}
          </div>

          {melding && (
            <div style={{ fontSize: 10.5, color: 'var(--sage)', marginTop: 6 }}
              data-terugwerkend-melding>{melding}</div>
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
