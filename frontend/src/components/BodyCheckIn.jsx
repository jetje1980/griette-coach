import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { photoStore } from '../photoStore';
import { prepareImage } from '../imagePrep';
import { store } from '../store';
import { ai } from '../ai';
import { todayLocal, formatNLLong } from '../datetime';
import {
  VIEWS, VIEW_KEYS, STANDARD_STEPS, CONTEXT_FIELDS,
  loadSessionMeta, saveSessionMeta, deleteSessionMeta, sessionMeta,
  comparisonTracks, ANALYSIS_FIELDS, analysisSchema, buildComparisonRequest,
  normalizeAnalysis, saveAnalysis, deleteAnalysis, loadAnalyses, analysesFor,
  convergentFindings, analysisCapability, CONFIDENCE,
} from '../photoAnalysis';
import { buildCoachContext, contextAsText } from '../coachContext';

// De wekelijkse lichaamscheck.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT SCHERM BESTAAT NAAST "MIJN VERANDERING"
//
// Dat scherm laat zien wat er ís. Dit scherm is het moment waarop er iets
// bij komt — en het is het enige punt in de app waar de omstandigheden van
// een fotomoment worden vastgelegd. Dat klinkt als administratie en is het
// tegendeel: zonder licht, tijdstip en kleding is een vergelijking over vier
// weken niet zwakker maar onbetrouwbaar, en dan hoort de app dat te zeggen
// in plaats van een mooi verhaal te maken.
//
// Drie dingen die hier bewust anders zijn dan in de oude fotoflow:
//
//   1. de datum is een veld. Een serie van drie weken geleden alsnog
//      toevoegen moet kunnen, en dan telt de opnamedatum — niet vandaag.
//   2. de instructies staan vóór de opname, niet eronder.
//   3. de vergelijking is een handeling met een uitkomst die bewaard wordt,
//      geen alinea die verdwijnt zodra je het scherm verlaat.
// ─────────────────────────────────────────────────────────────────

const src = (p) => (p ? `data:${p.mimeType};base64,${p.base64}` : null);

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

const CONF_COLOR = {
  [CONFIDENCE.HIGH]: 'var(--sage)',
  [CONFIDENCE.MEDIUM]: 'var(--gold)',
  [CONFIDENCE.LOW]: 'var(--rust)',
  [CONFIDENCE.NONE]: 'var(--ghost)',
};

// ── Stap 1: hoe je de foto's maakt ──────────────────────────────
function Standardisation({ checks, onToggle }) {
  return (
    <div className="os-card" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--font-serif)',
        marginBottom: 3 }}>
        Eerst dit, dan de foto
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 10 }}>
        Wat je hier aanhoudt bepaalt hoeveel de vergelijking over vier weken waard is.
        Vink aan wat klopt — ook als het er niet allemaal staat. Dan weet de app
        hoe stellig ze mag zijn.
      </div>
      {STANDARD_STEPS.map(s => (
        <button key={s.id} type="button" data-standard={s.id}
          onClick={() => onToggle(s.id)}
          style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left',
            background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
            borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, color: checks[s.id] ? 'var(--sage)' : 'var(--ghost)',
            lineHeight: 1.3 }}>{checks[s.id] ? '✓' : '○'}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
              display: 'block' }}>{s.label}</span>
            <span style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.45 }}>{s.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Stap 2: de vier aanzichten ──────────────────────────────────
function ViewGrid({ date, existing, onSaved }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const cam = useRef({});
  const gal = useRef({});

  async function handle(view, file, source) {
    if (!file) return;
    setBusy(view); setError(null);
    try {
      const prepped = await prepareImage(file, { source });
      const res = await photoStore.save(date, view, prepped.base64, prepped.mimeType, {
        source, width: prepped.width, height: prepped.height,
        orientation: prepped.orientation, bytes: prepped.bytes,
        // De opnamedatum reist mee als eigen veld, los van het moment van
        // invoeren. Bij een serie die je achteraf toevoegt lopen die uiteen.
        observedAt: date, enteredAt: todayLocal(),
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {VIEWS.map(v => {
          const has = existing?.[v.key];
          return (
            <div key={v.key}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)',
                marginBottom: 3, textAlign: 'center' }}>{v.label}</div>
              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 7,
                border: has ? '1px solid var(--sage)' : '1px dashed var(--border)',
                background: 'var(--surface)', overflow: 'hidden', display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                {has ? <img src={src(has)} alt={v.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 16, color: 'var(--ghost)' }}>
                    {busy === v.key ? '…' : '📷'}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 3 }}>
                <button type="button" data-checkin-camera={v.key}
                  onClick={() => cam.current[v.key]?.click()} disabled={busy === v.key}
                  style={{ fontSize: 9.5, fontWeight: 700, padding: '4px 1px', borderRadius: 5,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', cursor: 'pointer' }}>📷</button>
                <button type="button" data-checkin-gallery={v.key}
                  onClick={() => gal.current[v.key]?.click()} disabled={busy === v.key}
                  style={{ fontSize: 9.5, fontWeight: 700, padding: '4px 1px', borderRadius: 5,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', cursor: 'pointer' }}>🖼</button>
              </div>
              <input ref={el => { cam.current[v.key] = el; }} type="file" accept="image/*"
                capture="environment" hidden
                onChange={e => { handle(v.key, e.target.files?.[0], 'camera'); e.target.value = ''; }} />
              <input ref={el => { gal.current[v.key] = el; }} type="file" accept="image/*" hidden
                onChange={e => { handle(v.key, e.target.files?.[0], 'galerij'); e.target.value = ''; }} />
              {has && (
                <button data-checkin-delete={v.key}
                  onClick={async () => { await photoStore.delete(date, v.key); await onSaved?.(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--rust)',
                    fontSize: 9, cursor: 'pointer', width: '100%', marginTop: 1 }}>wis</button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
        {VIEWS.find(v => v.key === 'gezicht').aim}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: 'var(--rust)', lineHeight: 1.5, marginTop: 8 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ── De uitkomst van één vergelijking ────────────────────────────
function AnalysisCard({ row, onDelete }) {
  const [open, setOpen] = useState(false);
  const kleur = CONF_COLOR[row.confidence] || 'var(--ghost)';
  return (
    <div className="os-card" style={{ marginBottom: 8, borderLeft: `4px solid ${kleur}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, flex: 1, minWidth: 0 }}>
          {row.track} · {row.from} → {row.to}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: kleur }}>
          zekerheid {row.confidence || '?'}
        </div>
      </div>
      {row.summary && (
        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.55, marginTop: 5 }}>
          {row.summary}
        </div>
      )}
      {row.confidenceReason && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 4 }}>
          {row.confidenceReason}
        </div>
      )}
      <button onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 10.5,
          cursor: 'pointer', padding: '6px 0 0', fontWeight: 700 }}>
        {open ? '▲ minder' : '▼ per onderdeel'}
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          {ANALYSIS_FIELDS.map(f => {
            const w = row.fields?.[f.id];
            if (!w) return null;
            const blind = (row.notVisible || []).includes(f.id);
            return (
              <div key={f.id} style={{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--sub)', flex: 1 }}>{f.label}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700,
                    color: blind ? 'var(--ghost)' : 'var(--text)' }}>
                    {blind ? 'niet te zien' : w}
                  </span>
                </div>
                {!blind && row.evidence?.[f.id] && (
                  <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 2 }}>
                    {row.evidence[f.id]}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontSize: 9.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6,
            paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            {row.method === 'visual'
              ? `De beelden zijn werkelijk bekeken${row.model ? ` door ${row.model}` : ''}${row.viewsCompared?.length ? ` · aanzichten: ${row.viewsCompared.join(', ')}` : ''}.`
              : 'Dit is geen visuele vergelijking.'}
          </div>
          <button onClick={() => onDelete(row.id)}
            style={{ background: 'none', border: 'none', color: 'var(--rust)', fontSize: 10,
              cursor: 'pointer', padding: '6px 0 0' }}>
            deze vergelijking verwijderen
          </button>
        </div>
      )}
    </div>
  );
}

// ── Het scherm ──────────────────────────────────────────────────
export default function BodyCheckIn({
  sessions = [], measurements = [], logs = {}, currentDate = todayLocal(), onReload,
}) {
  const [datum, setDatum] = useState(currentDate);
  const [checks, setChecks] = useState({});
  const [ctx, setCtx] = useState({});
  const [maten, setMaten] = useState({ weight: '', waist: '', navel: '', hip: '' });
  const [bezig, setBezig] = useState(null);
  const [fout, setFout] = useState(null);
  const [klaar, setKlaar] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [toonInstructies, setToonInstructies] = useState(true);

  const herlaadAnalyses = useCallback(() => setAnalyses(loadAnalyses()), []);
  useEffect(() => { herlaadAnalyses(); }, [herlaadAnalyses]);

  // Bij het wisselen van datum komen de eerder vastgelegde omstandigheden mee
  // terug. Anders zou bewerken van een oude serie stilzwijgend alles wissen.
  useEffect(() => {
    const m = sessionMeta(datum) || {};
    setChecks(Object.fromEntries(STANDARD_STEPS.map(s => [s.id, m[s.id] === true])));
    setCtx(Object.fromEntries(CONTEXT_FIELDS.map(f => [f.id, m[f.id] ?? ''])));
    const meting = measurements.find(x => x.date === datum) || {};
    const log = logs[datum] || {};
    setMaten({
      weight: log.weight ?? meting.weight ?? '',
      waist: meting.waist ?? '', navel: meting.navel ?? '', hip: meting.hip ?? '',
    });
    setKlaar(null); setFout(null);
  }, [datum, measurements, logs]);

  const huidigeViews = sessions.find(s => s.date === datum)?.views || {};
  const aantalFotos = VIEW_KEYS.filter(k => huidigeViews[k]).length;

  const sporen = useMemo(
    () => comparisonTracks(sessions, { asOf: datum }),
    [sessions, datum]);

  const capability = analysisCapability({ hasVision: true });
  const convergent = useMemo(() => convergentFindings({ asOf: datum }), [datum, analyses]);
  const vanVandaag = useMemo(() => analysesFor(datum), [datum, analyses]);

  function bewaarContext(volgende = {}) {
    return saveSessionMeta(datum, { ...checks, ...ctx, ...volgende });
  }

  async function bewaarAlles() {
    setBezig('opslaan'); setFout(null);
    try {
      bewaarContext();
      const cm = {};
      for (const k of ['waist', 'navel', 'hip']) {
        if (maten[k] !== '' && maten[k] != null) cm[k] = parseFloat(maten[k]);
      }
      if (Object.keys(cm).length) await store.saveMeasurements(datum, cm);
      // Het gewicht gaat naar de daglog van de OPNAMEDATUM. Via de gedeelde
      // saveFields van App zou het bij vandaag belanden — die functie is aan
      // de gekozen dag in het hoofdscherm gebonden, en dat is hier niet de
      // dag waar het over gaat.
      if (maten.weight !== '' && maten.weight != null) {
        await store.saveLog(datum, { weight: parseFloat(maten.weight) });
      }
      setKlaar('Check-in bewaard.');
      await onReload?.();
    } catch (e) {
      setFout(e?.message || 'Opslaan is niet gelukt.');
    } finally { setBezig(null); }
  }

  // ── De vergelijking die werkelijk kijkt ───────────────────────
  async function vergelijk(spoor) {
    setBezig(spoor.id); setFout(null); setKlaar(null);
    try {
      bewaarContext();
      // De beelden komen uit IndexedDB, niet uit de props: die dragen alleen
      // wat er op het scherm staat.
      const alle = await photoStore.getAll();
      const byDate = Object.fromEntries(alle.map(s => [s.date, s.views]));
      const verse = comparisonTracks(alle, { asOf: datum });
      const doel = verse.tracks.find(t => t.id === spoor.id);
      const req = buildComparisonRequest(doel, byDate, { asOf: datum });
      if (!req.ok) throw new Error(req.reason);

      const rauw = await ai.comparePhotos(req, {
        fields: ANALYSIS_FIELDS,
        schema: analysisSchema(),
        // De volledige coachcontext van DEZE datum, niet van vandaag.
        context: contextAsText(buildCoachContext({ asOf: datum })),
      });
      const genormaliseerd = normalizeAnalysis(rauw, req);
      saveAnalysis({
        track: spoor.id, from: req.from, to: req.to,
        fields: genormaliseerd.fields,
        evidence: genormaliseerd.evidence,
        notVisible: genormaliseerd.notVisible,
        confidence: genormaliseerd.confidence,
        confidenceReason: genormaliseerd.confidenceReason,
        comparability: req.comparability,
        method: 'visual',
        model: genormaliseerd.model,
        viewsCompared: req.sharedViews,
        summary: genormaliseerd.summary,
      });
      herlaadAnalyses();
      setKlaar(`Vergelijking ${spoor.id} klaar — ${req.images.length} beelden bekeken.`);
    } catch (e) {
      setFout(e?.message || 'De vergelijking is niet gelukt.');
    } finally { setBezig(null); }
  }

  async function wisSerie() {
    if (!aantalFotos) return;
    setBezig('wissen');
    try {
      for (const k of VIEW_KEYS) if (huidigeViews[k]) await photoStore.delete(datum, k);
      deleteSessionMeta(datum);
      for (const a of analysesFor(datum)) deleteAnalysis(a.id);
      herlaadAnalyses();
      await onReload?.();
      setKlaar('De serie van deze datum is verwijderd.');
    } finally { setBezig(null); }
  }

  return (
    <div data-screen="body-checkin">
      <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--sage)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
          Wekelijkse check-in
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-serif)',
          lineHeight: 1.25, marginBottom: 6 }}>
          {formatNLLong(datum)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700 }}>Opnamedatum</span>
          <input className="os-input" type="date" data-checkin-date value={datum}
            max={currentDate}
            onChange={e => setDatum(e.target.value)}
            style={{ width: 'auto', fontSize: 12 }} />
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 6 }}>
          Zet de datum terug om een serie van eerder alsnog toe te voegen of te corrigeren.
          De tijdlijn rekent met de opnamedatum, niet met vandaag.
          {sessionMeta(datum)?.enteredAt && sessionMeta(datum).enteredAt !== datum && (
            <> Deze is ingevoerd op {sessionMeta(datum).enteredAt}.</>
          )}
        </div>
      </div>

      <button onClick={() => setToonInstructies(v => !v)} data-toggle-instructions
        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11,
          cursor: 'pointer', padding: '2px 0 6px', fontWeight: 700 }}>
        {toonInstructies ? '▲ instructies verbergen' : '▼ hoe maak ik vergelijkbare foto\'s?'}
      </button>
      {toonInstructies && (
        <Standardisation checks={checks}
          onToggle={id => setChecks(c => ({ ...c, [id]: !c[id] }))} />
      )}

      <Label right={aantalFotos ? (
        <button onClick={wisSerie} data-wis-serie disabled={bezig === 'wissen'}
          style={{ background: 'none', border: 'none', color: 'var(--rust)', fontSize: 11,
            fontWeight: 700, cursor: 'pointer', padding: 0 }}>hele serie wissen</button>
      ) : null}>
        Vier aanzichten · {aantalFotos}/4
      </Label>
      <ViewGrid date={datum} existing={huidigeViews} onSaved={onReload} />

      <Label>Omstandigheden van dit moment</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        {CONTEXT_FIELDS.map(f => (
          <div key={f.id} style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 3 }}>{f.label}</div>
            {f.type === 'choice' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {f.options.map(o => (
                  <button key={o} type="button" data-ctx={`${f.id}:${o}`}
                    onClick={() => setCtx(c => ({ ...c, [f.id]: c[f.id] === o ? '' : o }))}
                    style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 99,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: ctx[f.id] === o ? 'var(--sage)' : 'var(--card)',
                      color: ctx[f.id] === o ? '#fff' : 'var(--text)' }}>{o}</button>
                ))}
              </div>
            ) : (
              <input className="os-input" type="text" data-ctx-text={f.id}
                placeholder={f.hint} value={ctx[f.id] || ''}
                onChange={e => setCtx(c => ({ ...c, [f.id]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>

      <Label>Cijfers van dezelfde ochtend</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { k: 'weight', l: 'Gewicht (kg)', step: '0.1' },
            { k: 'waist', l: 'Taille (cm)', step: '0.5' },
            { k: 'navel', l: 'Navel (cm)', step: '0.5' },
            { k: 'hip', l: 'Heup (cm)', step: '0.5' },
          ].map(f => (
            <div key={f.k}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 3 }}>{f.l}</div>
              <input className="os-input" type="number" step={f.step} inputMode="decimal"
                data-checkin-field={f.k} value={maten[f.k]}
                onChange={e => setMaten(m => ({ ...m, [f.k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8 }}>
          Taille is het smalste punt tussen ribben en heup; navel is horizontaal over de
          navel. Twee verschillende maten die allebei iets anders vertellen — houd ze uit
          elkaar.
        </div>
        <button className="os-btn-save" data-checkin-save onClick={bewaarAlles}
          disabled={bezig === 'opslaan'} style={{ marginTop: 10 }}>
          {bezig === 'opslaan' ? 'bezig…' : 'Check-in bewaren'}
        </button>
      </div>

      <Label>Vergelijken op vijf tijdschalen</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 10 }}>
          {capability.lines[0]} {capability.lines[2]}
        </div>
        {!sporen.available ? (
          <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>{sporen.note}</div>
        ) : sporen.tracks.map(t => (
          <div key={t.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.45 }}>
                  {t.available
                    ? `${t.from.date} → ${t.to.date} · leest ${t.reads}`
                    : t.reason}
                </div>
                {t.available && (
                  <div style={{ fontSize: 10, lineHeight: 1.45, marginTop: 2,
                    color: CONF_COLOR[t.comparability.level] }}>
                    {t.comparability.note}
                  </div>
                )}
              </div>
              {t.available && (
                <button data-vergelijk={t.id} onClick={() => vergelijk(t)}
                  disabled={!!bezig}
                  style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 9px', borderRadius: 6,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {bezig === t.id ? '…' : 'kijk'}
                </button>
              )}
            </div>
          </div>
        ))}
        {fout && (
          <div style={{ fontSize: 11, color: 'var(--rust)', lineHeight: 1.5, marginTop: 8 }}>
            ⚠ {fout}
          </div>
        )}
        {klaar && (
          <div style={{ fontSize: 11, color: 'var(--sage)', lineHeight: 1.5, marginTop: 8 }}>
            {klaar}
          </div>
        )}
      </div>

      {vanVandaag.length > 0 && (
        <>
          <Label>Wat er gezien is</Label>
          {vanVandaag.map(r => (
            <AnalysisCard key={r.id} row={r}
              onDelete={id => { deleteAnalysis(id); herlaadAnalyses(); }} />
          ))}
          <div className="os-card" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55 }}>
              {convergent.note}
            </div>
          </div>
        </>
      )}

      <Label>Wat dit wel en niet is</Label>
      <div className="os-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 5 }}>{capability.title}</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--sub)',
          lineHeight: 1.65 }}>
          {capability.lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
}
