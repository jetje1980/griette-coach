import React, { useState } from 'react';
import { loadCoreVideos, addCoreVideo, removeCoreVideo, restoreCoreVideos,
  removedCount } from '../coreVideoStore';
import { VIDEO_SOURCE_NOTE } from '../data/coreVideos';

// Videolinks bij kracht — met de waarschuwing erbij, en zelf te beheren.
//
// Zij vroeg om Victoria's Secret abs-workouts. Die staan erin. Twee dingen
// zijn daarbij bewust zichtbaar in plaats van weggemoffeld:
//
//   · de links zijn niet nagekeken (YouTube was niet bereikbaar uit de
//     bouwomgeving), dus er staat bij dat er een dood kan zijn;
//   · ze zijn te verwijderen en aan te vullen, want YouTube-links verrotten
//     en daar hoort geen ontwikkelaar aan te pas te komen.
//
// En één coachregel, één keer en niet belerend: dit soort video's belast je
// buikspieren, wat nuttig is — maar vet verdwijnt niet op de plek waar je
// de oefening voelt. Hoe vlak een buik oogt, gaat over wat eroverheen zit
// en over hoe je ribben en bekken staan. Dat tweede is precies waar de
// core-oefeningen in dit programma op mikken.

export default function CoreVideos() {
  const [videos, setVideos] = useState(loadCoreVideos);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [fout, setFout] = useState('');

  function toevoegen() {
    const r = addCoreVideo(form);
    if (!r.ok) { setFout(r.reason); return; }
    setVideos(loadCoreVideos());
    setForm(null); setFout('');
  }

  const weg = removedCount();

  return (
    <div className="os-card" style={{ marginBottom: 12 }} data-corevideos={videos.length}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Video's bij je core-werk
      </div>

      {/* De coachregel. Eén keer, bovenaan, en dan niet meer. */}
      <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 8 }}>
        Deze belasten je buikspieren en dat is nuttig. Wat ze niet doen is vet
        weghalen op de plek waar je de oefening voelt — dat werkt bij niemand zo.
        Hoe vlak je buik oogt, gaat over wat eroverheen zit en over hoe je ribben
        en bekken staan; dat laatste is precies waar de hollow hold, de Pallof
        press en de dead bug in jouw programma op mikken. Dus: leuk als
        aanvulling, niet in plaats van je eigen core-blok.
      </div>

      {videos.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--ghost)', marginBottom: 8 }}>
          Geen video's meer in de lijst.
        </div>
      )}

      {videos.map(v => (
        <div key={v.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}
          data-video={v.id}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <a href={v.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                textDecoration: 'none', flex: 1, lineHeight: 1.4 }}>
              ▶ {v.title}
            </a>
            <button type="button" onClick={() => setVideos(removeCoreVideo(v.id))}
              title="verwijderen"
              style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 99,
                border: 'none', background: 'none', color: 'var(--ghost)',
                cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ghost)', marginTop: 2 }}>
            {v.minutes ? `${v.minutes} min · ` : ''}
            {(v.tags || []).join(' · ')}
            {v.source === 'eigen' ? (v.tags?.length ? ' · ' : '') + 'zelf toegevoegd' : ''}
          </div>
          {v.note && (
            <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45, marginTop: 3 }}>
              {v.note}
            </div>
          )}
        </div>
      ))}

      {/* De herkomst van de lijst, niet weggestopt. */}
      <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8,
        paddingTop: 8, borderTop: '1px solid var(--border)' }} data-video-herkomst>
        {VIDEO_SOURCE_NOTE}
      </div>

      <div onClick={() => { setOpen(v => !v); setFout(''); }}
        style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', marginTop: 6,
          display: 'flex', justifyContent: 'space-between' }}>
        <span>Eigen video toevoegen{weg ? ` · ${weg} verwijderd` : ''}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          {form === null ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" data-video-nieuw
                onClick={() => setForm({ title: '', url: '', minutes: '', note: '' })}
                style={{ fontSize: 11, padding: '5px 11px', borderRadius: 99,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--sub)', cursor: 'pointer' }}>
                + link toevoegen
              </button>
              {weg > 0 && (
                <button type="button" onClick={() => setVideos(restoreCoreVideos())}
                  style={{ fontSize: 11, padding: '5px 11px', borderRadius: 99,
                    border: 'none', background: 'none', color: 'var(--ghost)',
                    cursor: 'pointer' }}>
                  verwijderde terughalen
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <input placeholder="Titel" value={form.title} data-video-titel
                onChange={e => setForm({ ...form, title: e.target.value })}
                style={veld} />
              <input placeholder="https://www.youtube.com/watch?v=..." value={form.url}
                data-video-url onChange={e => setForm({ ...form, url: e.target.value })}
                style={veld} />
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="min" value={form.minutes} type="number" min="1"
                  onChange={e => setForm({ ...form, minutes: e.target.value })}
                  style={{ ...veld, width: 70 }} />
                <input placeholder="Notitie (optioneel)" value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  style={{ ...veld, flex: 1 }} />
              </div>
              {fout && (
                <div style={{ fontSize: 11, color: 'var(--alert)' }} data-video-fout>{fout}</div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={toevoegen} data-video-bewaar
                  style={{ fontSize: 11, padding: '5px 12px', borderRadius: 99,
                    border: '1px solid var(--sage)', background: 'var(--sage)',
                    color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  Bewaren
                </button>
                <button type="button" onClick={() => { setForm(null); setFout(''); }}
                  style={{ fontSize: 11, padding: '5px 12px', background: 'none',
                    border: 'none', color: 'var(--ghost)', cursor: 'pointer' }}>
                  annuleer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const veld = {
  fontSize: 12, padding: '6px 9px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
};
