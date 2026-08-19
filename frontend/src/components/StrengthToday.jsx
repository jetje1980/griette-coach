import React, { useState, useMemo } from 'react';
import {
  BAND_LEVELS, bandLabel, youtubeEmbedUrl, spotifyEmbedUrl,
  resolveClass, loadFavouriteClasses, allClasses, classesWithin,
} from '../data/strengthClasses';
import { saveSession, sessionScore } from '../strength';
import { nextStrengthForecast, strengthDecision } from '../strengthGate';
import { todayLocal } from '../datetime';

// Kracht op Vandaag: één les, één knop, en na afloop vier vragen.
//
// De hele verleiding hier is om alles te tonen wat de coach weet. Dat is
// precies wat je op een dag met weinig energie niet moet doen. De volledige
// onderbouwing staat onder Progressie; hier staat alleen het besluit.

const CONF = {
  HIGH:   { label: 'hoog',      color: 'var(--green)' },
  MEDIUM: { label: 'gemiddeld', color: 'var(--gold)' },
  LOW:    { label: 'laag',      color: 'var(--ghost)' },
};

function BandChips({ value, onChange, allowNone = false }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {allowNone && (
        <button className={`os-toggle-chip ${!value ? 'active' : ''}`}
          onClick={() => onChange(null)} style={{ fontSize: 11.5 }}>
          Geen band
        </button>
      )}
      {BAND_LEVELS.map(b => (
        <button key={b.id}
          className={`os-toggle-chip ${value === b.id ? 'active green' : ''}`}
          onClick={() => onChange(b.id)} style={{ fontSize: 11.5 }}>
          {b.label}
        </button>
      ))}
    </div>
  );
}

// ── De les zelf: video, muziek, blokken ─────────────────────────
export function ClassPlayer({ cls, band, onClose, onDone }) {
  const [showVideo, setShowVideo] = useState(false);
  const embed = cls?.videoUrl ? youtubeEmbedUrl(cls.videoUrl) : null;
  const spotify = cls?.spotifyUrl ? spotifyEmbedUrl(cls.spotifyUrl) : null;
  const [spotifyOpen, setSpotifyOpen] = useState(false);

  if (!cls) return null;

  return (
    <div className="os-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-serif)', flex: 1 }}>
          {cls.title}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--ghost)', fontSize: 16, cursor: 'pointer', padding: 0 }}>✕</button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
        {cls.duration} min · {cls.equipment}
        {band && ` · ${bandLabel(band)} band`}
        {cls.expectedRpe && ` · RPE ${cls.expectedRpe[0]}–${cls.expectedRpe[1]}`}
      </div>

      {/* Video. Embedden mag alleen als de rechthebbende dat toestaat;
          lukt het niet, dan blijft de knop naar YouTube over. De video
          wordt nooit gekopieerd of zelf gehost — alleen de URL is van ons. */}
      {cls.videoUrl ? (
        <>
          {showVideo && embed ? (
            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%',
              borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: '#000' }}>
              <iframe
                src={embed} title={cls.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {embed && !showVideo && (
              <button className="btn-primary" onClick={() => setShowVideo(true)}
                style={{ fontSize: 13, whiteSpace: 'normal' }}>
                ▶ Start videoles
              </button>
            )}
            <a href={cls.videoUrl} target="_blank" rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: 12, textDecoration: 'none', display: 'inline-block',
                whiteSpace: 'normal', textAlign: 'center' }}>
              {embed ? 'Openen op YouTube' : '▶ Open video'}
            </a>
          </div>
          {showVideo && embed && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 8, lineHeight: 1.5 }}>
              Speelt de video hier niet af? Dan staat embedden voor deze video uit —
              gebruik dan de knop hierboven om hem op YouTube te openen.
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.5, marginBottom: 8 }}>
          Nog geen video aan deze les gekoppeld. Voeg er een toe bij
          Lichaam → Training → Kracht → Mijn lessen, dan start je hem hier meteen.
        </div>
      )}

      {/* Muziek is een extraatje, geen onderdeel van de trainingsflow. */}
      {cls.spotifyUrl && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a href={cls.spotifyUrl} target="_blank" rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: 12, textDecoration: 'none', whiteSpace: 'normal' }}>
              🎵 Open playlist in Spotify
            </a>
            {spotify && (
              <button className="btn-secondary" onClick={() => setSpotifyOpen(v => !v)}
                style={{ fontSize: 12, whiteSpace: 'normal' }}>
                {spotifyOpen ? 'Verberg speler' : 'Speler hier'}
              </button>
            )}
          </div>
          {spotifyOpen && spotify && (
            <iframe src={spotify} title="Spotify" height="152" width="100%"
              frameBorder="0" allow="encrypted-media" loading="lazy"
              style={{ borderRadius: 10, marginTop: 8 }} />
          )}
        </div>
      )}

      {/* De opbouw van de les — dichtgeklapt genoeg om niet te storen. */}
      {(cls.blocks?.length || cls.patterns?.length || cls.focus?.length) && (
        <div style={{ fontSize: 11, color: 'var(--ghost)', lineHeight: 1.6,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {cls.description && <div style={{ marginBottom: 4 }}>{cls.description}</div>}
          <div>
            <strong style={{ color: 'var(--muted)' }}>Focus: </strong>
            {(cls.patterns || cls.focus || []).join(' · ')}
          </div>
        </div>
      )}

      {onDone && (
        <button className="btn-primary" onClick={onDone}
          style={{ fontSize: 13, marginTop: 10, width: '100%', whiteSpace: 'normal' }}>
          Ik heb deze les gedaan
        </button>
      )}
    </div>
  );
}

// ── Na afloop: vier vragen, meer niet ───────────────────────────
export function StrengthFeedback({ cls, band, date, onSave, onCancel }) {
  const [completed, setCompleted] = useState('full');
  const [rpe, setRpe] = useState(null);
  const [bandUsed, setBandUsed] = useState(band || cls?.defaultBand || null);
  const [couldDoMore, setCouldDoMore] = useState(null);
  const [notes, setNotes] = useState('');

  const preview = useMemo(() => sessionScore({
    type: 'coach_class', classId: cls?.id, duration: cls?.duration,
    bandResistance: bandUsed, rpe, couldDoMore, completed,
  }), [cls?.id, cls?.duration, bandUsed, rpe, couldDoMore, completed]);

  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );

  const chip = (active, onClick, text, key) => (
    <button key={key} className={`os-toggle-chip ${active ? 'active green' : ''}`}
      onClick={onClick} style={{ fontSize: 11.5 }}>{text}</button>
  );

  return (
    <div className="os-card" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-serif)', marginBottom: 10 }}>
        {cls?.title || 'Krachtsessie'} — hoe ging het?
      </div>

      <Row label="Training voltooid?">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {chip(completed === 'full', () => setCompleted('full'), 'Ja', 'f')}
          {chip(completed === 'partial', () => setCompleted('partial'), 'Gedeeltelijk', 'p')}
          {chip(completed === 'no', () => setCompleted('no'), 'Nee', 'n')}
        </div>
      </Row>

      <Row label="Hoe zwaar? (RPE 1–10)">
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
            chip(rpe === n, () => setRpe(n), String(n), n))}
        </div>
      </Row>

      <Row label="Bandweerstand">
        <BandChips value={bandUsed} onChange={setBandUsed} allowNone />
      </Row>

      <Row label="Had je meer gekund?">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {chip(couldDoMore === 'ja', () => setCouldDoMore('ja'), 'Ja', 'j')}
          {chip(couldDoMore === 'beetje', () => setCouldDoMore('beetje'), 'Beetje', 'b')}
          {chip(couldDoMore === 'nee', () => setCouldDoMore('nee'), 'Nee', 'nn')}
        </div>
      </Row>

      <Row label="Notitie (optioneel)">
        <input value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Bijv. rechterknie voelde stroef"
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)' }} />
      </Row>

      {preview > 0 && (
        <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 10 }}>
          Deze sessie telt voor <strong>{preview}</strong> punten in je krachtscore
          {' '}(referentie: STRONG 30 op medium band, RPE 6 = 100).
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn-primary" disabled={rpe == null}
          onClick={() => onSave({
            type: 'coach_class', classId: cls?.id || null,
            videoUrl: cls?.videoUrl || null, spotifyUrl: cls?.spotifyUrl || null,
            duration: cls?.duration || null, date,
            bandResistance: bandUsed, rpe, couldDoMore, completed, notes,
          })}
          style={{ flex: 1, fontSize: 13, whiteSpace: 'normal' }}>
          Opslaan
        </button>
        {onCancel && (
          <button className="btn-secondary" onClick={onCancel}
            style={{ fontSize: 13, whiteSpace: 'normal' }}>Annuleren</button>
        )}
      </div>
      {rpe == null && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 6 }}>
          Alleen de RPE is verplicht — zonder die vraag kan ik de volgende les niet afstemmen.
        </div>
      )}
    </div>
  );
}

// ── De compacte kaart op Vandaag ────────────────────────────────
export default function StrengthToday({
  log, logs, currentDate, runGate, coach, onSaved, compact = true,
}) {
  const [minutes, setMinutes] = useState(null);
  const [stage, setStage] = useState('card');   // card | play | feedback
  const [chosen, setChosen] = useState(null);

  // De krachtpoort kent de hardlooppoort: volledige rust blijft volledige
  // rust, ook als lopen alleen om een belastingsreden niet doorgaat.
  const gate = useMemo(
    () => strengthDecision({ log, logs, currentDate, runGate, coach, minutes }),
    [log, logs, currentDate, runGate?.action, coach?.decision, minutes]);

  const forecast = useMemo(
    () => nextStrengthForecast({ logs, currentDate, minutes, gate }),
    [logs, currentDate, minutes, gate]);

  const cls = chosen || gate.recommendedClass;
  const band = gate.action === 'RECOVERY_FLOW' ? null : (forecast.band || gate.targetBand);

  function save(session) {
    saveSession(session);
    setStage('card');
    setChosen(null);
    onSaved?.(session);
  }

  if (stage === 'feedback') {
    return <StrengthFeedback cls={cls} band={band} date={currentDate}
      onSave={save} onCancel={() => setStage('card')} />;
  }

  if (stage === 'play') {
    return <ClassPlayer cls={cls} band={band}
      onClose={() => setStage('card')} onDone={() => setStage('feedback')} />;
  }

  // Geen training toegestaan: dan is dát het bericht, zonder les eronder.
  if (!gate.mayTrain && gate.action !== 'RECOVERY_FLOW') {
    return (
      <div className="os-card" style={{ marginBottom: 10, borderLeft: `4px solid ${gate.color}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{gate.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: gate.color }}>
              Kracht: {gate.label.toLowerCase()}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 2 }}>
              {gate.summary}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const conf = CONF[forecast.confidence] || CONF.LOW;
  const timeOptions = [15, 25, 30, 35];

  return (
    <div className="os-card" style={{ marginBottom: 10, borderLeft: `4px solid ${gate.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: gate.color,
          textTransform: 'uppercase', letterSpacing: '0.6px', flex: 1 }}>
          {gate.action === 'RECOVERY_FLOW' ? 'Herstel vandaag' : 'Kracht vandaag'}
        </span>
        {forecast.available && (
          <span style={{ fontSize: 10, fontWeight: 700, color: conf.color,
            border: `1px solid ${conf.color}`, borderRadius: 99, padding: '1px 7px' }}>
            {conf.label}
          </span>
        )}
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-serif)',
        lineHeight: 1.2, marginBottom: 2 }}>
        {cls?.title}
        {cls?.form && (
          <span style={{ fontSize: 13, color: 'var(--sub)', fontWeight: 700 }}>
            {' '}— {cls.form.toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 10 }}>
        {cls?.duration} min
        {band && ` · ${bandLabel(band)} band`}
        {cls?.expectedRpe && ` · RPE ${cls.expectedRpe[0]}–${cls.expectedRpe[1]}`}
        {cls?.equipment && (
          <div style={{ fontSize: 11, color: 'var(--ghost)' }}>{cls.equipment}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={() => setStage('play')}
          style={{ fontSize: 13, whiteSpace: 'normal' }}>
          ▶ Start videoles
        </button>
        <button className="btn-secondary" onClick={() => setStage('feedback')}
          style={{ fontSize: 12, whiteSpace: 'normal' }}>
          Zonder video gedaan
        </button>
      </div>

      {/* Tijd is de enige keuze die de gebruiker hier hoeft te maken. */}
      {!compact || minutes != null ? null : (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
            Andere tijd beschikbaar?
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {timeOptions.map(m => (
              <button key={m} className="os-toggle-chip" onClick={() => setMinutes(m)}
                style={{ fontSize: 11.5 }}>{m} min</button>
            ))}
          </div>
        </div>
      )}
      {minutes != null && (
        <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8 }}>
          Afgestemd op {minutes} minuten. <button onClick={() => setMinutes(null)}
            style={{ background: 'none', border: 'none', color: 'var(--sage)',
              cursor: 'pointer', fontSize: 10.5, padding: 0, fontWeight: 700 }}>herstel</button>
        </div>
      )}

      {gate.blockers.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45, marginTop: 8,
          paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          {gate.blockers[0]}
        </div>
      )}
    </div>
  );
}
