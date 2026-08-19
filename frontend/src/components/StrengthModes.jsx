import React, { useState, useEffect, useMemo } from 'react';
import {
  BANDS_MAT_PROGRAM, BAND_LEVELS, bandLabel, COACH_CLASSES, allClasses,
  loadFavouriteClasses, saveFavouriteClass, deleteFavouriteClass,
  FAVOURITE_SUGGESTIONS, detectProvider, PATTERNS,
} from '../data/strengthClasses';
import { saveSession, loadSessions, sessionScore, deleteSession } from '../strength';
import { ClassPlayer, StrengthFeedback } from './StrengthToday';
import { todayLocal } from '../datetime';

// Drie trainingsvormen naast elkaar, geen van drieën de mindere:
//   Gewichten     — het bestaande A/B-programma met kg × sets × reps × RIR
//   Bands & mat   — volwaardig zonder gewichten, met een eigen overload-ladder
//   Coach class   — begeleide les, video-first, minimale beslislast

const MODES = [
  { id: 'weights', emoji: '🏋️', label: 'Gewichten', sub: 'dumbbells, kettlebells, gym' },
  { id: 'bands',   emoji: '🧘', label: 'Bands & mat', sub: 'banden, lichaamsgewicht, matje' },
  { id: 'class',   emoji: '▶️', label: 'Coach class', sub: 'begeleide les met video' },
];

function Label({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

// ── Bands & mat: loggen met de knoppen die er hier toe doen ─────
function BandsMat({ currentDate, onSaved }) {
  const [date, setDate] = useState(currentDate);
  const [entries, setEntries] = useState({});
  const [rpe, setRpe] = useState(null);
  const [completed, setCompleted] = useState('full');
  const [couldDoMore, setCouldDoMore] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { setDate(currentDate); }, [currentDate]);

  const upd = (id, field, val) =>
    setEntries(p => ({ ...p, [id]: { ...(p[id] || { id }), id, [field]: val } }));

  const preview = useMemo(() => sessionScore({
    type: 'bands_mat', date, rpe, completed, couldDoMore,
    exercises: BANDS_MAT_PROGRAM.exercises
      .map(ex => ({ ...entries[ex.id], id: ex.id, pattern: ex.pattern }))
      .filter(e => e.sets && (e.reps || e.holdSeconds)),
  }), [entries, rpe, completed, couldDoMore, date]);

  function save() {
    const exercises = BANDS_MAT_PROGRAM.exercises.map(ex => {
      const e = entries[ex.id] || {};
      return {
        id: ex.id, pattern: ex.pattern, name: ex.name,
        bandResistance: e.bandResistance || null,
        sets: e.sets || null, reps: e.reps || null,
        holdSeconds: e.holdSeconds || null,
        variant: e.variant || null,
        unilateral: /eenbenig|eenarmig/i.test(e.variant || ''),
        tempo: e.tempo || null,
        rir: e.rir != null ? e.rir : null,
        done: !!(e.sets && (e.reps || e.holdSeconds)),
      };
    }).filter(e => e.done);

    if (!exercises.length) { setMsg('Vul minstens één oefening in.'); return; }

    // De zwaarste band van de sessie geldt als sessieniveau — dat is wat de
    // bandprogressie volgt.
    const heaviest = exercises.map(e => e.bandResistance).filter(Boolean)
      .sort((a, b) => BAND_LEVELS.findIndex(x => x.id === b) - BAND_LEVELS.findIndex(x => x.id === a))[0];

    saveSession({ type: 'bands_mat', date, exercises, rpe, completed, couldDoMore,
      bandResistance: heaviest || null,
      duration: Math.max(10, exercises.length * 4) });
    setMsg(`Opgeslagen ✓ (${date})`);
    setEntries({}); setRpe(null); setCouldDoMore(null);
    onSaved?.();
  }

  const chip = (active, onClick, text, key) => (
    <button key={key} className={`os-toggle-chip ${active ? 'active green' : ''}`}
      onClick={onClick} style={{ fontSize: 11 }}>{text}</button>
  );

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 10 }}>
        Zonder gewichten gaat overload via de band, de herhalingen, de houdtijd
        en de variant. Elke stap in die ladder telt mee in je krachtscore —
        dit is geen afgezwakte versie van krachttraining.
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Datum</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
      </div>

      {BANDS_MAT_PROGRAM.exercises.map(ex => {
        const e = entries[ex.id] || {};
        return (
          <div key={ex.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 6 }}>{ex.cue}</div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {ex.variants.map((v, i) =>
                chip(e.variant === v, () => upd(ex.id, 'variant', v), `${i + 1}. ${v}`, v))}
            </div>

            {ex.band && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {BAND_LEVELS.map(b =>
                  chip(e.bandResistance === b.id, () => upd(ex.id, 'bandResistance', b.id), b.label, b.id))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input type="number" inputMode="numeric" placeholder="sets"
                value={e.sets ?? ''} onChange={ev => upd(ex.id, 'sets', ev.target.value)}
                style={{ width: 62, fontSize: 12, padding: '6px 8px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              {ex.hold ? (
                <input type="number" inputMode="numeric" placeholder="sec"
                  value={e.holdSeconds ?? ''} onChange={ev => upd(ex.id, 'holdSeconds', ev.target.value)}
                  style={{ width: 70, fontSize: 12, padding: '6px 8px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              ) : (
                <input type="number" inputMode="numeric" placeholder="reps"
                  value={e.reps ?? ''} onChange={ev => upd(ex.id, 'reps', ev.target.value)}
                  style={{ width: 70, fontSize: 12, padding: '6px 8px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              )}
              <input type="number" inputMode="numeric" placeholder="RIR"
                value={e.rir ?? ''} onChange={ev => upd(ex.id, 'rir', ev.target.value)}
                style={{ width: 62, fontSize: 12, padding: '6px 8px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
              {chip(e.tempo === 'slow', () => upd(ex.id, 'tempo', e.tempo === 'slow' ? null : 'slow'),
                'langzaam tempo', `t${ex.id}`)}
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Hoe zwaar? (RPE)</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
            chip(rpe === n, () => setRpe(n), String(n), n))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {chip(completed === 'full', () => setCompleted('full'), 'Afgemaakt', 'cf')}
          {chip(completed === 'partial', () => setCompleted('partial'), 'Gedeeltelijk', 'cp')}
          {chip(couldDoMore === 'ja', () => setCouldDoMore('ja'), 'Kon meer', 'm1')}
          {chip(couldDoMore === 'beetje', () => setCouldDoMore('beetje'), 'Beetje meer', 'm2')}
          {chip(couldDoMore === 'nee', () => setCouldDoMore('nee'), 'Geen reserve', 'm3')}
        </div>
        {preview > 0 && (
          <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 8 }}>
            Deze sessie telt voor <strong>{preview}</strong> punten (referentie 100 = STRONG 30, medium band, RPE 6).
          </div>
        )}
        <button className="btn-primary" onClick={save}
          style={{ fontSize: 13, whiteSpace: 'normal' }}>Sessie opslaan</button>
        {msg && <div style={{ fontSize: 11.5, color: 'var(--sage)', marginTop: 6 }}>{msg}</div>}
      </div>
    </div>
  );
}

// ── Coach classes en eigen lessen ───────────────────────────────
function CoachClasses({ currentDate, onSaved }) {
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(null);
  const [logging, setLogging] = useState(null);
  const [form, setForm] = useState(null);
  const favourites = useMemo(() => loadFavouriteClasses(), [tick]);

  function saveFav() {
    if (!form?.title) return;
    saveFavouriteClass(form);
    setForm(null); setTick(t => t + 1);
  }

  if (playing) {
    return <ClassPlayer cls={playing} band={playing.defaultBand}
      onClose={() => setPlaying(null)}
      onDone={() => { setLogging(playing); setPlaying(null); }} />;
  }
  if (logging) {
    return <StrengthFeedback cls={logging} band={logging.defaultBand} date={currentDate}
      onCancel={() => setLogging(null)}
      onSave={(s) => { saveSession(s); setLogging(null); onSaved?.(); }} />;
  }

  const card = (c, isFav) => (
    <div key={c.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, flex: 1, minWidth: 0 }}>{c.title}</div>
        <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{c.duration} min</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginTop: 2 }}>
        {c.tagline ? `${c.tagline} · ` : ''}{c.equipment}
        {c.expectedRpe && ` · RPE ${c.expectedRpe[0]}–${c.expectedRpe[1]}`}
        {c.videoUrl ? ' · video' : ''}
        {c.spotifyUrl ? ' · muziek' : ''}
      </div>
      {c.description && (
        <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 3 }}>
          {c.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn-primary" onClick={() => setPlaying(c)}
          style={{ fontSize: 12, whiteSpace: 'normal' }}>
          {c.videoUrl ? '▶ Start les' : 'Bekijk les'}
        </button>
        <button className="btn-secondary" onClick={() => setLogging(c)}
          style={{ fontSize: 12, whiteSpace: 'normal' }}>Gedaan</button>
        {isFav && (
          <>
            <button className="btn-secondary" onClick={() => setForm({ ...c })}
              style={{ fontSize: 12, whiteSpace: 'normal' }}>Bewerken</button>
            <button onClick={() => { if (window.confirm(`"${c.title}" verwijderen?`)) { deleteFavouriteClass(c.id); setTick(t => t + 1); } }}
              style={{ background: 'none', border: 'none', color: 'var(--rust)',
                fontSize: 11.5, cursor: 'pointer' }}>verwijderen</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55 }}>
        Een begeleide les volgen kost minder beslissingen dan zelf oefeningen kiezen.
        Op een matige dag is dat het verschil tussen wel en niet trainen.
      </div>

      <Label>Standaardlessen</Label>
      <div className="os-card">
        {COACH_CLASSES.map(c => card(c, false))}
      </div>

      <Label right={
        <button onClick={() => setForm(form ? null : { title: '', duration: 30, defaultBand: 'medium' })}
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {form ? 'sluiten' : '+ eigen les'}
        </button>
      }>Mijn favoriete lessen</Label>
      <div className="os-card">
        {favourites.length === 0 && !form && (
          <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.55 }}>
            Nog geen eigen lessen. Plak de link van een video die je fijn vindt — die
            wordt bewaard als les en start voortaan met één knop. Er wordt alleen een
            verwijzing opgeslagen; de video blijft bij de aanbieder staan.
            <div style={{ marginTop: 8 }}>
              {FAVOURITE_SUGGESTIONS.map(s => (
                <button key={s.title} className="os-toggle-chip"
                  onClick={() => setForm({ ...s })}
                  style={{ fontSize: 11, marginRight: 4, marginBottom: 4 }}>{s.title}</button>
              ))}
            </div>
          </div>
        )}
        {favourites.map(c => card(c, true))}

        {form && (
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 6 }}>
            {[
              { k: 'title', label: 'Titel', ph: 'Full body bands 30 min' },
              { k: 'videoUrl', label: 'Video-URL', ph: 'https://www.youtube.com/watch?v=…' },
              { k: 'spotifyUrl', label: 'Spotify-playlist (optioneel)', ph: 'https://open.spotify.com/playlist/…' },
              { k: 'equipment', label: 'Materiaal', ph: 'Matje + minibands' },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                  textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{f.label}</div>
                <input value={form[f.k] || ''} placeholder={f.ph}
                  onChange={e => setForm({ ...form, [f.k]: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
                    borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)' }} />
              </div>
            ))}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Duur (min)</div>
              <input type="number" inputMode="numeric" value={form.duration || ''}
                onChange={e => setForm({ ...form, duration: e.target.value })}
                style={{ width: 80, fontSize: 12, padding: '7px 9px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Focus</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PATTERNS.map(p => {
                  const on = (form.focus || []).includes(p.id);
                  return (
                    <button key={p.id} className={`os-toggle-chip ${on ? 'active green' : ''}`}
                      onClick={() => setForm({ ...form,
                        focus: on ? (form.focus || []).filter(x => x !== p.id) : [...(form.focus || []), p.id] })}
                      style={{ fontSize: 11 }}>{p.emoji} {p.label}</button>
                  );
                })}
              </div>
            </div>
            {form.videoUrl && (
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 8 }}>
                Herkend als: {detectProvider(form.videoUrl)}.
                {detectProvider(form.videoUrl) === 'youtube'
                  ? ' Speelt hier af als de rechthebbende embedden toestaat; anders opent hij op YouTube.'
                  : ' Opent in een nieuw tabblad.'}
              </div>
            )}
            <button className="btn-primary" onClick={saveFav} disabled={!form.title}
              style={{ fontSize: 12.5, whiteSpace: 'normal' }}>Les opslaan</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── De moduswissel ──────────────────────────────────────────────
export default function StrengthModes({ currentDate, saveFields, isFuture, WeightsModule }) {
  const [mode, setMode] = useState('class');

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {MODES.map(m => (
          <button key={m.id}
            className={`os-toggle-chip ${mode === m.id ? 'active green' : ''}`}
            onClick={() => setMode(m.id)} style={{ fontSize: 12 }}>
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 10 }}>
        {MODES.find(m => m.id === mode)?.sub}
      </div>

      {mode === 'weights' && WeightsModule && <WeightsModule />}
      {mode === 'bands' && (
        <BandsMat currentDate={currentDate}
          onSaved={() => saveFields?.({ strength_done: true })} />
      )}
      {mode === 'class' && (
        <CoachClasses currentDate={currentDate}
          onSaved={() => saveFields?.({ strength_done: true })} />
      )}
    </div>
  );
}
