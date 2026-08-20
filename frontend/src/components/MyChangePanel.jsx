import React, { useState, useMemo, useRef } from 'react';
import { photoStore } from '../photoStore';
import { prepareImage } from '../imagePrep';
import {
  PHOTO_VIEWS, PHOTO_INSTRUCTIONS, VISUAL_OBSERVATIONS,
  checkpoints, comparisonSet, changeStory, loadObservations, saveObservation,
} from '../bodyProgress';
import { todayLocal, formatNLLong, daysBetween } from '../datetime';

// "Mijn verandering" — de eerste en belangrijkste ervaring onder Progressie.
//
// De gebruiker wil twee dingen weten: verandert mijn lijf zichtbaar, en
// word ik sterker. Alles op deze pagina dient die twee vragen. Er staat
// bewust géén trainingsvolume voorop; dat is een middel, geen antwoord.
//
// Wat hier nooit gebeurt: uit een foto een vetpercentage, een aantal kilo's
// of een aantal centimeters afleiden. Beeld levert kwalitatieve
// observaties. Getallen komen uit metingen die je zelf invoert.

function src(photo) {
  return photo ? `data:${photo.mimeType};base64,${photo.base64}` : null;
}

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

// ── De vergelijking zelf ────────────────────────────────────────
// Per aanzicht een rij met start, eventueel vorige, en nu. Naast elkaar
// zodat het verschil zichtbaar wordt zonder dat er iets geïnterpreteerd
// hoeft te worden.
function PhotoCompare({ comp, onOpen }) {
  const columns = [
    comp.start && { key: 'start', label: 'Start', session: comp.start },
    comp.previous && { key: 'prev', label: 'Vorige', session: comp.previous },
    comp.current && !comp.sameSeries && { key: 'now', label: 'Nu', session: comp.current },
  ].filter(Boolean);

  if (comp.sameSeries && columns.length === 1) {
    columns[0].label = 'Start';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {PHOTO_VIEWS.map(view => {
        const any = columns.some(c => c.session.views?.[view.key]);
        if (!any) return null;
        return (
          <div key={view.key}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ghost)',
              textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              {view.label}
            </div>
            <div style={{ display: 'grid',
              gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 6 }}>
              {columns.map(c => {
                const photo = c.session.views?.[view.key];
                return (
                  <div key={c.key}>
                    <div style={{ fontSize: 9.5, color: 'var(--ghost)', marginBottom: 3,
                      display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                      <span style={{ fontWeight: 700 }}>{c.label}</span>
                      <span>{c.session.date.slice(5)}</span>
                    </div>
                    {photo ? (
                      <img src={src(photo)} alt={`${view.label} ${c.label}`}
                        onClick={() => onOpen?.({ photo, label: `${view.label} — ${c.label}` })}
                        style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover',
                          borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in',
                          display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 8,
                        border: '1px dashed var(--border)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'var(--ghost)' }}>ontbreekt</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── De tijdlijn met ijkpunten ───────────────────────────────────
function CheckpointTimeline({ cps, onShoot }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
      {cps.map(c => {
        const state = c.complete ? 'done' : c.partial ? 'partial'
          : c.due ? 'due' : c.overdue ? 'missed' : 'future';
        const COLOR = { done: 'var(--sage)', partial: 'var(--gold)', due: 'var(--rust)',
          missed: 'var(--ghost)', future: 'var(--border)' };
        return (
          <button key={c.day} onClick={() => (c.due || c.overdue) && onShoot?.(c)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: (c.due || c.overdue) ? 'pointer' : 'default',
              background: 'none', border: 'none', padding: 0 }}>
            <div style={{ height: 5, borderRadius: 99, background: COLOR[state], marginBottom: 4 }} />
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text)' }}>{c.label}</div>
            <div style={{ fontSize: 9, color: 'var(--ghost)' }}>
              {c.complete ? '✓ compleet'
                : c.partial ? `${c.viewCount}/3`
                : c.due ? 'nu aan de beurt'
                : c.daysAway > 0 ? `over ${c.daysAway} d`
                : 'gemist'}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Foto's maken ────────────────────────────────────────────────
// Twee wegen naar binnen, één verwerking.
//
// Er was hier alleen een camera-invoer met capture="environment". Op Android
// betekent dat: de camera opent, en verder niets. Een foto die gisteren met
// een andere app is gemaakt, of die iemand anders van je nam, kon er niet in.
//
// Nu staat er per vak een cameraknop en een galerijknop. Ze wijzen naar twee
// verschillende <input>-elementen — dat moet, want capture is een eigenschap
// van het element — maar allebei komen ze uit bij dezelfde `handle`. Dezelfde
// compressie, dezelfde EXIF-correctie, dezelfde opslag, dezelfde upload.
function ShootPanel({ date, existing, onSaved, onClose }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const camInputs = useRef({});
  const galInputs = useRef({});

  async function handle(view, file, source) {
    if (!file) return;
    setBusy(view);
    setError(null);
    try {
      // Verkleinen en rechtop zetten gebeurt hier, niet per bron.
      const prepped = await prepareImage(file, { source });
      const res = await photoStore.save(date, view, prepped.base64, prepped.mimeType, {
        source,
        width: prepped.width,
        height: prepped.height,
        orientation: prepped.orientation,
        bytes: prepped.bytes,
      });
      await onSaved?.();
      if (res && !res.ok) {
        setError(res.skipped
          ? 'Opgeslagen op dit toestel. Log in om hem ook online te bewaren.'
          : 'Opgeslagen op dit toestel, maar online opslaan is niet gelukt. Hij staat in de wachtrij.');
      }
    } catch (e) {
      setError(e?.message || 'Deze foto kon niet worden verwerkt.');
    } finally { setBusy(null); }
  }

  return (
    <div className="os-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)', flex: 1 }}>
          Foto's van {formatNLLong(date)}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--ghost)', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
        {PHOTO_VIEWS.map(v => {
          const has = existing?.[v.key];
          return (
            <div key={v.key}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                marginBottom: 3, textAlign: 'center' }}>{v.label}</div>
              <div
                style={{ width: '100%', aspectRatio: '3/4', borderRadius: 8,
                  border: has ? '1px solid var(--sage)' : '1px dashed var(--border)',
                  background: 'var(--surface)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {has ? (
                  <img src={src(has)} alt={v.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 20, color: 'var(--ghost)' }}>
                    {busy === v.key ? '…' : '📷'}
                  </span>
                )}
              </div>

              {/* Camera en galerij naast elkaar. Allebei even bereikbaar:
                  soms wíl je nu een foto maken, soms staat hij er al. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                <button type="button" data-photo-camera={v.key}
                  onClick={() => camInputs.current[v.key]?.click()}
                  disabled={busy === v.key}
                  style={{ width: '100%', fontSize: 10.5, fontWeight: 700, padding: '5px 2px',
                    borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📷 Maak foto
                </button>
                <button type="button" data-photo-gallery={v.key}
                  onClick={() => galInputs.current[v.key]?.click()}
                  disabled={busy === v.key}
                  style={{ width: '100%', fontSize: 10.5, fontWeight: 700, padding: '5px 2px',
                    borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🖼 Kies uit galerij
                </button>
              </div>

              {/* capture stuurt Android rechtstreeks naar de camera … */}
              <input ref={el => { camInputs.current[v.key] = el; }}
                type="file" accept="image/*" capture="environment" hidden
                data-input-camera={v.key}
                onChange={e => { handle(v.key, e.target.files?.[0], 'camera'); e.target.value = ''; }} />
              {/* … en zonder capture opent dezelfde knop de fotobibliotheek. */}
              <input ref={el => { galInputs.current[v.key] = el; }}
                type="file" accept="image/*" hidden
                data-input-gallery={v.key}
                onChange={e => { handle(v.key, e.target.files?.[0], 'galerij'); e.target.value = ''; }} />

              {has && (
                <button onClick={async () => { await photoStore.delete(date, v.key); await onSaved?.(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--rust)',
                    fontSize: 10, cursor: 'pointer', width: '100%', marginTop: 2 }}>
                  verwijderen
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--rust)', lineHeight: 1.5,
          marginBottom: 8, padding: '6px 8px', borderRadius: 6,
          border: '1px solid var(--rust)' }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        Zodat je écht jezelf vergelijkt
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--sub)', lineHeight: 1.65 }}>
        {PHOTO_INSTRUCTIONS.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

// ── Het paneel ──────────────────────────────────────────────────
export default function MyChangePanel({
  sessions = [], measurements = [], logs = {}, currentDate = todayLocal(), onReload,
}) {
  const [shootDate, setShootDate] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const story = useMemo(
    () => changeStory({ sessions, measurements, logs, currentDate }),
    [sessions, measurements, logs, currentDate]);

  const comp = story.comparison;
  const cps = story.checkpoints;
  const due = story.dueCheckpoint;

  const existingToday = sessions.find(s => s.date === (shootDate || currentDate))?.views || {};

  return (
    <div>
      {/* Zoom-overlay voor één foto */}
      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
          <img src={src(zoom.photo)} alt={zoom.label}
            style={{ maxWidth: '100%', maxHeight: '86vh', borderRadius: 10 }} />
          <div style={{ color: '#fff', fontSize: 12, marginTop: 10 }}>{zoom.label}</div>
        </div>
      )}

      {/* Het antwoord op de twee vragen, bovenaan */}
      <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--sage)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Mijn verandering
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-serif)',
          lineHeight: 1.25, marginBottom: 4 }}>
          {story.recomposition.title}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.55 }}>
          {story.recomposition.text}
        </div>
        {story.verdict && (
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600,
            lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            {story.verdict}
          </div>
        )}
      </div>

      {/* Fotomoment dat nu open staat */}
      {due && !shootDate && (
        <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--rust)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)', marginBottom: 3 }}>
            📷 {due.day === 0 ? 'Startfoto\'s' : 'Progressiemoment'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
            {due.day === 0
              ? 'Leg je uitgangspunt vast: voor, zij en achter. Zonder startpunt is er over twaalf weken niets te vergelijken.'
              : `${due.label} sinds je startfoto. Maak opnieuw voor, zij en achter — zelfde plek, zelfde licht, zelfde afstand.`}
          </div>
          <button className="btn-primary" onClick={() => setShootDate(currentDate)}
            style={{ fontSize: 13, whiteSpace: 'normal' }}>
            Foto's maken
          </button>
        </div>
      )}

      <Label right={
        <button onClick={() => setShootDate(currentDate)}
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          + foto
        </button>
      }>Ijkpunten</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <CheckpointTimeline cps={cps} onShoot={c => setShootDate(c.date > currentDate ? currentDate : c.date)} />
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5 }}>
          Vier weken laat vooral houding en spanning zien, twaalf weken laat de vorm zien.
          Onder de drie weken vergelijk je vooral licht en houding.
        </div>
      </div>

      {shootDate && (
        <ShootPanel date={shootDate} existing={existingToday}
          onSaved={onReload} onClose={() => setShootDate(null)} />
      )}

      {/* De vergelijking */}
      <Label>Start · vorige · nu</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        {!comp.available ? (
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
            Nog geen foto's. Eén serie van voor, zij en achter is genoeg om te beginnen —
            over vier weken heb je er iets aan.
          </div>
        ) : (
          <>
            <PhotoCompare comp={comp} onOpen={setZoom} />
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
              {comp.note || `${comp.spanLabel} tussen je eerste en laatste serie · ${comp.count} series in totaal.`}
            </div>
          </>
        )}
      </div>

      {/* De cijfers eronder — alleen wat er werkelijk veranderd is */}
      {story.rows.length > 0 && (
        <>
          <Label>Wat er meetbaar veranderd is</Label>
          <div className="os-card" style={{ marginBottom: 12 }}>
            {story.rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '7px 0', borderBottom: i < story.rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 12, color: 'var(--sub)', flex: 1, minWidth: 0 }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: r.neutral ? 'var(--text)' : r.good ? 'var(--sage)' : 'var(--rust)' }}>
                  {r.from} → {r.to}
                  {r.delta != null && !r.text && (
                    <span style={{ fontSize: 11, marginLeft: 5, fontWeight: 600 }}>
                      ({r.delta > 0 ? '+' : ''}{r.delta}{r.pct ? '%' : ''})
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
              Gewicht staat er neutraal bij: bij krachttraining is het niet de hoofdindicator.
              Taille, heup, kracht en foto's samen vertellen het verhaal.
              {!story.metrics.bodyFatUsable &&
                ' Vetpercentage verschijnt hier alleen als je zelf twee echte metingen invoert — nooit als schatting uit beeld.'}
            </div>
          </div>
        </>
      )}

      {/* Wat je zélf kunt observeren op de foto's */}
      {comp.available && comp.meaningful && (
        <>
          <div onClick={() => setShowInstructions(v => !v)}
            style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span>Waar je naar kunt kijken op deze foto's</span>
            <span>{showInstructions ? '▲' : '▼'}</span>
          </div>
          {showInstructions && (
            <div className="os-card" style={{ marginBottom: 12 }}>
              {VISUAL_OBSERVATIONS.map(o => (
                <div key={o.id} style={{ fontSize: 11.5, lineHeight: 1.55, marginBottom: 6 }}>
                  <strong>{o.label}.</strong> <span style={{ color: 'var(--sub)' }}>{o.hint}</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5,
                paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                Dit blijven observaties. Uit een foto valt geen vetpercentage, geen kilo's en
                geen centimeters af te lezen — daar zijn de metingen hierboven voor.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
