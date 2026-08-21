import React, { useState, useRef } from 'react';
import { RUNS } from '../data/runningSchema';
import { ai } from '../ai';
import { store } from '../store';
import { reconcileDayLog, deleteActivity } from '../activityEdit';
import {
  saveWorkout, computePace, localVerdict, compareWithPrevious, logAdaptiveEvent,
} from '../workouts';
import { workoutImages, fileToWorkoutImage } from '../workoutImages';

// Training registreren: screenshot (AI leest uit, gebruiker bevestigt),
// handmatig, of Strava. Alles wordt hetzelfde WorkoutResult.
// Kernregel: AI slaat NOOIT stilzwijgend op — eerst bevestigen, dan opslaan.

const ACTIVITY_TYPES = [
  { id: 'run',  emoji: '🏃', label: 'Hardlopen' },
  { id: 'walk', emoji: '🚶', label: 'Wandelen' },
  { id: 'bike', emoji: '🚴', label: 'Fietsen' },
  { id: 'swim', emoji: '🏊', label: 'Zwemmen' },
  { id: 'other', emoji: '🏋️', label: 'Anders' },
];

const SYMPTOM_OPTS = ['kortademig', 'duizelig', 'spierpijn', 'hoofdpijn', 'hartkloppingen'];

const NOT_RECOGNIZED = 'niet betrouwbaar herkend';

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
        letterSpacing: '0.4px', fontWeight: 700, marginBottom: 3 }}>
        {label}{hint && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({ opts, value, onChange, size = 12 }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {opts.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o : `${o.emoji || ''} ${o.label}`;
        return (
          <button key={String(id)}
            className={`os-toggle-chip ${value === id ? 'active green' : ''}`}
            onClick={() => onChange(value === id ? null : id)}
            style={{ fontSize: size }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkoutForm({ defaultDate, defaultSessionNr, logs, saveFields, onSaved, onClose, initialWorkout }) {
  // fase: 'choose' | 'analyzing' | 'form' | 'verdict'
  const [phase, setPhase] = useState(initialWorkout ? 'form' : 'choose');
  const [source, setSource] = useState(initialWorkout?.source || 'manual');
  const [images, setImages] = useState([]); // { base64, mimeType }
  const [keepImages, setKeepImages] = useState(true);
  const [aiInfo, setAiInfo] = useState(null); // { confidence, notes }
  const [error, setError] = useState('');
  const [savedWorkout, setSavedWorkout] = useState(null);
  const [aiVerdict, setAiVerdict] = useState('');
  const [aiVerdictBusy, setAiVerdictBusy] = useState(false);
  const fileRef = useRef(null);

  const [f, setF] = useState(initialWorkout ? {
    _editId: initialWorkout.id,
    date: initialWorkout.date,
    plannedSessionId: initialWorkout.plannedSessionId || null,
    activityType: initialWorkout.activityType || 'run',
    duration: initialWorkout.duration != null ? String(initialWorkout.duration) : '',
    distance: initialWorkout.distance != null ? String(initialWorkout.distance) : '',
    averagePace: initialWorkout.averagePace || '',
    averageHR: initialWorkout.averageHR != null ? String(initialWorkout.averageHR) : '',
    maxHR: initialWorkout.maxHR != null ? String(initialWorkout.maxHR) : '',
    restHR: initialWorkout.restHR != null ? String(initialWorkout.restHR) : '',
    rpe: initialWorkout.rpe ?? null,
    legs: initialWorkout.legs ?? null,
    couldDoMore: initialWorkout.couldDoMore ?? null,
    completedAsPlanned: initialWorkout.completedAsPlanned || 'full',
    modificationReason: initialWorkout.modificationReason || '',
    symptomsDuring: initialWorkout.symptomsDuring || [], notes: initialWorkout.notes || '',
  } : {
    date: defaultDate,
    plannedSessionId: defaultSessionNr || null,
    activityType: 'run',
    duration: '', distance: '', averagePace: '',
    averageHR: '', maxHR: '', restHR: '',
    rpe: null, legs: null, couldDoMore: null,
    completedAsPlanned: 'full', modificationReason: '',
    symptomsDuring: [], notes: '',
  });

  function upd(key, val) { setF(prev => ({ ...prev, [key]: val })); }

  const autoPace = computePace(f.distance, f.duration);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    try {
      const imgs = [];
      for (const file of files.slice(0, 4)) imgs.push(await fileToWorkoutImage(file));
      setImages(prev => [...prev, ...imgs].slice(0, 4));
      setSource('screenshot');
      await analyze([...images, ...imgs].slice(0, 4));
    } catch {
      setError('Kon de afbeelding niet lezen — probeer een andere screenshot.');
    }
  }

  async function analyze(imgs = images) {
    if (!imgs.length) return;
    setPhase('analyzing');
    setError('');
    try {
      const x = await ai.extractWorkout(imgs);
      setF(prev => ({
        ...prev,
        date: x.date || prev.date,
        activityType: x.activityType || prev.activityType,
        duration: x.duration != null ? String(x.duration) : prev.duration,
        distance: x.distance != null ? String(x.distance) : prev.distance,
        averagePace: x.averagePace || prev.averagePace,
        averageHR: x.averageHR != null ? String(x.averageHR) : prev.averageHR,
        maxHR: x.maxHR != null ? String(x.maxHR) : prev.maxHR,
        _hrZones: x.hrZones || null,
        _splits: Array.isArray(x.splits) ? x.splits : null,
        _cadence: x.cadence ?? null,
        _elevation: x.elevation ?? null,
      }));
      setAiInfo({ confidence: x.confidence || 'medium', notes: x.notes || '' });
      setPhase('form');
    } catch (err) {
      setError(`AI-analyse niet beschikbaar (${err.message}). Vul de gegevens handmatig in — dat werkt net zo goed.`);
      setSource(imgs.length ? 'screenshot' : 'manual');
      setPhase('form');
    }
  }

  async function confirm() {
    if (!f.date) { setError('Kies een datum.'); return; }
    setError('');

    let sourceImageIds = [];
    if (images.length && keepImages) {
      try {
        for (const img of images) sourceImageIds.push(await workoutImages.save(img.base64, img.mimeType));
      } catch { /* opslag afbeeldingen is optioneel */ }
    }

    const workout = saveWorkout({
      ...(f._editId ? { id: f._editId } : {}),
      date: f.date,
      plannedSessionId: f.plannedSessionId ? Number(f.plannedSessionId) : null,
      activityType: f.activityType,
      source,
      duration: f.duration ? parseFloat(f.duration) : null,
      distance: f.distance ? parseFloat(f.distance) : null,
      averagePace: f.averagePace || autoPace || null,
      averageHR: f.averageHR ? parseInt(f.averageHR, 10) : null,
      maxHR: f.maxHR ? parseInt(f.maxHR, 10) : null,
      restHR: f.restHR ? parseInt(f.restHR, 10) : null,
      hrZones: f._hrZones || null,
      splits: f._splits || null,
      cadence: f._cadence ?? null,
      elevation: f._elevation ?? null,
      rpe: f.rpe,
      legs: f.legs,
      couldDoMore: f.couldDoMore,
      completedAsPlanned: f.completedAsPlanned,
      modificationReason: f.modificationReason || null,
      symptomsDuring: f.symptomsDuring,
      notes: f.notes || null,
      sourceImageIds,
      aiExtractionConfidence: aiInfo?.confidence || null,
      confirmedByUser: true,
    });

    // Daglog van de trainingsdatum bijwerken (ook bij backdating).
    // Belangrijk: dit zette vroeger alleen run_done aan en nooit uit. Wie een
    // per ongeluk als training geboekte wandeling corrigeerde, hield daardoor
    // een dag die als hardlooptraining bleef tellen. De vlag volgt nu uit de
    // activiteiten die er werkelijk staan.
    if (f.activityType === 'run') {
      await store.saveLog(f.date, {
        ...(f.rpe != null ? { training_rpe: f.rpe } : {}),
        ...(f.legs ? { training_legs: f.legs } : {}),
        ...(f.couldDoMore ? { training_could_more: f.couldDoMore } : {}),
      });
    }
    await reconcileDayLog(f.date, { force: true });
    if (initialWorkout && initialWorkout.date !== f.date) {
      await reconcileDayLog(initialWorkout.date, { force: true });
    }
    // App-state verversen
    try { await saveFields?.({}); } catch { /* alleen refresh */ }

    // Levende trainingshistorie
    if (f.plannedSessionId) {
      const prevCount = compareWithPrevious(workout) ? 'herhaald' : null;
      logAdaptiveEvent({
        date: f.date, sessionNr: Number(f.plannedSessionId),
        event: f.completedAsPlanned === 'full' ? 'done_full'
          : f.completedAsPlanned === 'stopped' ? 'stopped' : 'done_modified',
        note: f.modificationReason || (prevCount ? 'tweede uitvoering' : null),
      });
    }

    setSavedWorkout(workout);
    setPhase('verdict');
    onSaved?.(workout);
  }

  async function askAiVerdict() {
    if (!savedWorkout) return;
    setAiVerdictBusy(true);
    try {
      const run = savedWorkout.plannedSessionId ? RUNS[savedWorkout.plannedSessionId - 1] : null;
      setAiVerdict(await ai.workoutVerdict(savedWorkout, run, logs));
    } catch (err) {
      setAiVerdict(`AI niet beschikbaar (${err.message}) — het oordeel hierboven is het lokale coach-oordeel.`);
    } finally { setAiVerdictBusy(false); }
  }

  const plannedRun = f.plannedSessionId ? RUNS[Number(f.plannedSessionId) - 1] : null;
  const comparison = savedWorkout ? compareWithPrevious(savedWorkout) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 220,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg)', borderRadius: '16px 16px 0 0', padding: '18px 16px 34px',
        width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 17, fontFamily: 'var(--font-serif)' }}>
            {phase === 'verdict' ? 'Coach-oordeel' : 'Training registreren'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22,
            cursor: 'pointer', color: 'var(--sub)', lineHeight: 1 }}>×</button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFiles} />

        {error && (
          <div style={{ background: 'rgba(179,94,69,0.08)', border: '1px solid var(--rust)', borderRadius: 8,
            padding: '8px 12px', fontSize: 12, color: 'var(--rust)', marginBottom: 12, lineHeight: 1.4 }}>
            {error}
          </div>
        )}

        {/* FASE: kies registratiemethode */}
        {phase === 'choose' && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 14, lineHeight: 1.5 }}>
              Hoe wil je je training registreren? Strava is handig, maar optioneel — alles werkt ook zonder.
            </div>
            <button className="os-btn-save" style={{ width: '100%', marginBottom: 8 }}
              onClick={() => fileRef.current?.click()}>
              📷 Upload screenshot(s) — Garmin / Strava / Apple / …
            </button>
            <button className="os-btn-save" style={{ width: '100%', marginBottom: 8, background: 'var(--sage)' }}
              onClick={() => { setSource('manual'); setPhase('form'); }}>
              ✏️ Handmatig invoeren
            </button>
            <div style={{ fontSize: 11, color: 'var(--ghost)', textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
              Strava gekoppeld? Synchroniseer dan via Lichaam → Training → Strava — de sessie kun je daarna hier bevestigen.
            </div>
          </div>
        )}

        {/* FASE: AI analyseert */}
        {phase === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--sub)', fontSize: 14 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔎</div>
            AI leest je screenshot{images.length > 1 ? 's' : ''} uit…
          </div>
        )}

        {/* FASE: formulier (voor-ingevuld bij screenshot) */}
        {phase === 'form' && (
          <div>
            {source === 'screenshot' && aiInfo && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
                  Ik lees dit uit ({aiInfo.confidence === 'high' ? 'hoge' : aiInfo.confidence === 'low' ? 'lage' : 'redelijke'} zekerheid):
                </div>
                <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
                  Controleer en corrigeer hieronder. Lege velden = {NOT_RECOGNIZED}.
                  {aiInfo.notes ? ` ${aiInfo.notes}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="os-toggle-chip" style={{ fontSize: 11 }} onClick={() => analyze()}>
                    🔄 Opnieuw analyseren
                  </button>
                  <button className="os-toggle-chip" style={{ fontSize: 11 }} onClick={() => fileRef.current?.click()}>
                    + Extra screenshot
                  </button>
                </div>
              </div>
            )}
            {source === 'screenshot' && images.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {images.map((img, i) => (
                  <img key={i} src={`data:${img.mimeType};base64,${img.base64}`} alt=""
                    style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
                ))}
                <label style={{ fontSize: 11, color: 'var(--sub)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input type="checkbox" checked={keepImages} onChange={e => setKeepImages(e.target.checked)} />
                  screenshot bewaren
                </label>
              </div>
            )}

            <Field label="Datum">
              <input type="date" className="os-input" value={f.date}
                onChange={e => upd('date', e.target.value)} />
            </Field>

            <Field label="Geplande sessie" hint="(optioneel)">
              <select className="os-input" value={f.plannedSessionId || ''}
                onChange={e => upd('plannedSessionId', e.target.value || null)}
                style={{ width: '100%' }}>
                <option value="">— geen geplande sessie —</option>
                {RUNS.map(r => (
                  <option key={r.nr} value={r.nr}>T{r.nr} — {r.description.slice(0, 44)}</option>
                ))}
              </select>
            </Field>

            <Field label="Activiteit">
              <Chips opts={ACTIVITY_TYPES} value={f.activityType} onChange={v => upd('activityType', v || 'run')} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Duur (min)">
                <input className="os-input" type="number" step="0.1" inputMode="decimal"
                  placeholder={source === 'screenshot' ? NOT_RECOGNIZED : 'bijv. 31.5'}
                  value={f.duration} onChange={e => upd('duration', e.target.value)} />
              </Field>
              <Field label="Afstand (km)">
                <input className="os-input" type="number" step="0.01" inputMode="decimal"
                  placeholder={source === 'screenshot' ? NOT_RECOGNIZED : 'bijv. 3.4'}
                  value={f.distance} onChange={e => upd('distance', e.target.value)} />
              </Field>
              <Field label="Gem. pace" hint={autoPace && !f.averagePace ? `auto: ${autoPace}/km` : ''}>
                <input className="os-input" placeholder={autoPace ? `${autoPace}/km (berekend)` : 'm:ss per km'}
                  value={f.averagePace} onChange={e => upd('averagePace', e.target.value)} />
              </Field>
              <Field label="Gem. HR">
                <input className="os-input" type="number" inputMode="numeric"
                  placeholder={source === 'screenshot' ? NOT_RECOGNIZED : 'bpm'}
                  value={f.averageHR} onChange={e => upd('averageHR', e.target.value)} />
              </Field>
              <Field label="Max HR">
                <input className="os-input" type="number" inputMode="numeric"
                  placeholder={source === 'screenshot' ? NOT_RECOGNIZED : 'bpm'}
                  value={f.maxHR} onChange={e => upd('maxHR', e.target.value)} />
              </Field>
              <Field label="Herstel-HR" hint="(optioneel)">
                <input className="os-input" type="number" inputMode="numeric" placeholder="bpm"
                  value={f.restHR} onChange={e => upd('restHR', e.target.value)} />
              </Field>
            </div>

            <Field label="RPE (1–10)">
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} className={`os-toggle-chip ${f.rpe === n ? 'active' : ''}`}
                    onClick={() => upd('rpe', f.rpe === n ? null : n)}
                    style={{ width: 32, padding: '5px 0', textAlign: 'center', fontSize: 12 }}>{n}</button>
                ))}
              </div>
            </Field>

            <Field label="Benen">
              <Chips opts={['fris', 'normaal', 'zwaar']} value={f.legs} onChange={v => upd('legs', v)} />
            </Field>
            <Field label="Had je meer gekund?">
              <Chips opts={['ja', 'beetje', 'nee']} value={f.couldDoMore} onChange={v => upd('couldDoMore', v)} />
            </Field>
            <Field label="Gelopen volgens plan?">
              <Chips opts={[
                { id: 'full', label: 'Volledig' },
                { id: 'modified', label: 'Aangepast' },
                { id: 'stopped', label: 'Gestopt' },
              ]} value={f.completedAsPlanned} onChange={v => upd('completedAsPlanned', v || 'full')} />
            </Field>
            {f.completedAsPlanned !== 'full' && (
              <Field label="Reden van aanpassing">
                <input className="os-input" value={f.modificationReason}
                  onChange={e => upd('modificationReason', e.target.value)}
                  placeholder="bijv. HR te hoog, benen zwaar…" />
              </Field>
            )}
            <Field label="Symptomen tijdens training">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {SYMPTOM_OPTS.map(s => (
                  <button key={s}
                    className={`os-toggle-chip ${f.symptomsDuring.includes(s) ? 'active' : ''}`}
                    onClick={() => upd('symptomsDuring', f.symptomsDuring.includes(s)
                      ? f.symptomsDuring.filter(x => x !== s) : [...f.symptomsDuring, s])}
                    style={{ fontSize: 12 }}>{s}</button>
                ))}
              </div>
            </Field>
            <Field label="Notitie">
              <input className="os-input" value={f.notes} onChange={e => upd('notes', e.target.value)}
                placeholder="Optioneel…" />
            </Field>

            <button className="os-btn-save" style={{ width: '100%', marginTop: 6 }} onClick={confirm}>
              ✓ Training bevestigen
            </button>
            <div style={{ fontSize: 11, color: 'var(--ghost)', textAlign: 'center', marginTop: 6 }}>
              Er wordt niets opgeslagen tot je bevestigt.
            </div>
          </div>
        )}

        {/* FASE: coach-oordeel na bevestiging */}
        {phase === 'verdict' && savedWorkout && (
          <div>
            <div className="os-card" style={{ borderLeft: '4px solid var(--sage)', marginBottom: 12 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                {localVerdict(savedWorkout, plannedRun)}
              </div>
            </div>

            {comparison && (
              <>
                {/* Geen sessienummer meer: dat las als plek in een reeks. Wat
                    hier telt is dat het dezelfde vorm was, niet welk nummer. */}
                <div className="os-section-label">Vergelijking met de vorige keer{plannedRun?.description ? ` — ${plannedRun.description}` : ''}</div>
                <div className="os-card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                    {[
                      { label: `Vorige (${comparison.prev.date?.slice(5)})`, w: comparison.prev },
                      { label: 'Deze', w: savedWorkout },
                    ].map(({ label, w }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                          {[w.distance ? `${w.distance} km` : null,
                            (w.averagePace || computePace(w.distance, w.duration)) ? `${w.averagePace || computePace(w.distance, w.duration)}/km` : null,
                            w.averageHR ? `HR ${w.averageHR}` : null,
                            w.rpe != null ? `RPE ${w.rpe}` : null,
                          ].filter(Boolean).map((line, i) => <div key={i}>{line}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--sage)', fontWeight: 600, lineHeight: 1.5,
                    paddingTop: 8, borderTop: '1px solid var(--divide)' }}>
                    {comparison.verdict}
                  </div>
                </div>
              </>
            )}

            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 12 }}>
              🌅 Morgenochtend vraag ik hoe je lichaam reageerde. Pas daarna wordt de volgende
              sessie vrijgegeven (BUILD) of herhaald (REPEAT).
            </div>

            {!aiVerdict ? (
              <button className="os-toggle-chip" style={{ fontSize: 12, marginBottom: 10 }}
                onClick={askAiVerdict} disabled={aiVerdictBusy}>
                {aiVerdictBusy ? '⏳ AI-coach denkt na…' : '🤖 Uitgebreider AI-oordeel'}
              </button>
            ) : (
              <div className="os-card" style={{ marginBottom: 10, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {aiVerdict}
              </div>
            )}

            <button className="os-btn-save" style={{ width: '100%' }} onClick={onClose}>Klaar</button>
          </div>
        )}
      </div>
    </div>
  );
}
