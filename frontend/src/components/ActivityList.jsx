import React, { useState } from 'react';
import { activityList, retypeActivity, deleteActivity, ACTIVITY_TYPES } from '../activityEdit';
import { fmtPace } from '../workouts';

// Alle activiteiten, ook die zonder schemakoppeling.
//
// Dat laatste was het gat. De enige bestaande lijst toonde uitsluitend
// sessies die aan een schemanummer hingen; een verkeerd geboekte wandeling
// had dat nummer niet en was daardoor onbereikbaar. Onbereikbaar is voor de
// gebruiker hetzelfde als afwezig — je zág de fout in je cijfers, maar je
// kon er niet bij.

const KIND = {
  run: { label: 'Hardlopen', color: 'var(--sage)' },
  walk: { label: 'Wandelen', color: 'var(--gold)' },
  other: { label: 'Anders', color: 'var(--ghost)' },
};

export default function ActivityList({ currentDate, onEdit, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [flash, setFlash] = useState(null);
  const [tick, setTick] = useState(0);

  const rows = activityList({ limit: 30, currentDate });

  async function retype(w, type) {
    setBusy(w.id);
    try {
      const res = await retypeActivity(w.id, type);
      const n = res?.reconciled?.filter(r => r?.changed).length || 0;
      setFlash(`${w.date.slice(5)} staat nu als ${KIND[type].label.toLowerCase()}.` +
        (n ? ' De dagstatus en alle afgeleide cijfers zijn opnieuw berekend.' : ''));
      setTick(t => t + 1);
      onChanged?.();
    } finally { setBusy(null); }
  }

  async function remove(w) {
    setBusy(w.id);
    try {
      await deleteActivity(w.id);
      setFlash(`Activiteit van ${w.date.slice(5)} verwijderd. Alle cijfers zijn opnieuw berekend.`);
      setConfirming(null);
      setTick(t => t + 1);
      onChanged?.();
    } finally { setBusy(null); }
  }

  return (
    <div key={tick}>
      <div onClick={() => setOpen(v => !v)}
        style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', padding: '10px 0',
          display: 'flex', justifyContent: 'space-between',
          borderTop: '1px solid var(--border)' }}>
        <span>Activiteiten corrigeren of verwijderen ({rows.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="os-card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
            Staat hier iets verkeerd? Zet het type om of verwijder de regel. Alles wat
            eruit volgt — je hardloopkilometers, langst verdragen afstand, weekbelasting,
            loopeconomie, hartslagkalibratie en race readiness — wordt meteen opnieuw
            berekend.
          </div>

          {flash && (
            <div style={{ fontSize: 11.5, color: 'var(--sage)', background: 'var(--sage-bg, rgba(63,107,82,0.08))',
              padding: '8px 10px', borderRadius: 6, marginBottom: 10, lineHeight: 1.45 }}>
              {flash}
            </div>
          )}

          {rows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ghost)' }}>Nog geen activiteiten.</div>
          )}

          {rows.map(w => {
            const k = KIND[w.kind] || KIND.other;
            return (
              <div key={w.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11.5,
                    color: 'var(--ghost)', minWidth: 44 }}>{w.date.slice(5)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: k.color,
                    border: `1px solid ${k.color}`, borderRadius: 99, padding: '1px 7px' }}>
                    {k.label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {w.distance != null ? `${String(w.distance).replace('.', ',')} km` : '— km'}
                    {w.duration != null ? ` · ${Math.round(w.duration)} min` : ''}
                    {w.pace ? ` · ${fmtPace(w.pace)}/km` : ''}
                    {w.averageHR ? ` · HR ${w.averageHR}` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ghost)' }}>
                    {w.source}
                  </span>
                </div>

                {w.correctionNote && (
                  <div style={{ fontSize: 10.5, color: 'var(--gold)', marginTop: 3, lineHeight: 1.4 }}>
                    {w.correctionNote}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {ACTIVITY_TYPES.filter(t => t.id !== w.kind).map(t => (
                    <button key={t.id} type="button" disabled={busy === w.id}
                      onClick={() => retype(w, t.id)}
                      style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--sub)', cursor: 'pointer' }}>
                      → {t.label.toLowerCase()}
                    </button>
                  ))}
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(w)}
                      style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--sub)', cursor: 'pointer' }}>
                      wijzig
                    </button>
                  )}
                  {confirming === w.id ? (
                    <>
                      <button type="button" disabled={busy === w.id} onClick={() => remove(w)}
                        style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                          border: '1px solid var(--alert)', background: 'var(--alert)',
                          color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        echt verwijderen
                      </button>
                      <button type="button" onClick={() => setConfirming(null)}
                        style={{ fontSize: 10.5, padding: '4px 9px', background: 'none',
                          border: 'none', color: 'var(--ghost)', cursor: 'pointer' }}>
                        annuleer
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirming(w.id)}
                      style={{ fontSize: 10.5, padding: '4px 9px', borderRadius: 99,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--alert)', cursor: 'pointer' }}>
                      verwijder
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 5, lineHeight: 1.4 }}>
                  {w.counts
                    ? 'Telt mee voor je hardloopcijfers en je racedoelen.'
                    : 'Telt mee als beweging, niet als hardlooptraining.'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
