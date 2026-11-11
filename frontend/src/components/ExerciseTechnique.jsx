import React, { useState } from 'react';
import { techniqueFor, loadExerciseVideos, saveExerciseVideo, searchUrl,
  GEWICHTEN_UITLEG } from '../data/exerciseTechnique';
import { youtubeEmbedUrl, detectProvider } from '../data/strengthClasses';

// Demo en techniek, in de sessie zelf.
//
// De volgorde tijdens het trainen is: oefening → demo → drie aanwijzingen →
// sets/reps/gewicht/RIR → klaar. Geen apart zoekscherm, geen omweg.
//
// De video is altijd jouw eigen link. De app host niets, kopieert niets en
// kiest niets voor je; hij bewaart de URL en sluit hem privacyvriendelijk in.

export default function ExerciseTechnique({ exercise }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uitleg, setUitleg] = useState(false);
  const [draft, setDraft] = useState('');
  const [videos, setVideos] = useState(() => loadExerciseVideos());

  const tech = techniqueFor(exercise.id);
  const url = videos[exercise.id] || null;
  const embed = url ? youtubeEmbedUrl(url) : null;
  const provider = url ? detectProvider(url) : null;

  if (!tech) return null;

  function save() {
    setVideos(saveExerciseVideo(exercise.id, draft));
    setEditing(false);
    setDraft('');
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span>{open ? '▲' : '▶'}</span>
        <span>Wat is dit, en hoe zwaar{url ? ' · video' : ''}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 2 }}>
          {/* Video eerst: kijken kost minder dan lezen */}
          {embed ? (
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%',
              borderRadius: 8, overflow: 'hidden', background: '#000', marginBottom: 8 }}>
              <iframe src={embed} title={`Demo ${exercise.name}`} loading="lazy"
                allow="accelerometer; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin" allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
            </div>
          ) : url ? (
            <a href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', fontSize: 11.5, color: 'var(--sage)', marginBottom: 8 }}>
              Open je demo{provider ? ` op ${provider}` : ''} ↗
            </a>
          ) : editing ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input className="os-input" value={draft} autoFocus
                placeholder="Plak hier de link naar een demo"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                style={{ flex: 1, minWidth: 0, fontSize: 12 }} />
              <button className="os-btn-save" onClick={save} style={{ padding: '6px 12px' }}>Ok</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <a href={searchUrl(exercise.id, exercise.name)} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11.5, color: 'var(--sage)' }}>
                Zoek een demo ↗
              </a>
              <button type="button" onClick={() => setEditing(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 11.5, color: 'var(--muted)' }}>
                Link bewaren
              </button>
            </div>
          )}

          {/* Eerst: wat is dit eigenlijk. De drie aanwijzingen hieronder
              gaan over hoe je het goed doet en nemen aan dat je dat al
              weet. Dat is precies de stap die ontbrak. */}
          {tech.wat && (
            <div data-oefening-wat style={{ fontSize: 11.5, lineHeight: 1.55,
              marginBottom: 7 }}>{tech.wat}</div>
          )}
          {tech.gewicht && (
            <div data-oefening-gewicht style={{ fontSize: 11.5, lineHeight: 1.55,
              marginBottom: 8, paddingLeft: 8,
              borderLeft: '2px solid var(--sage)' }}>
              <span style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block',
                marginBottom: 1 }}>Wat pak je vast</span>
              {tech.gewicht}
            </div>
          )}

          {/* Precies drie aanwijzingen */}
          <div style={{ fontSize: 9.5, color: 'var(--ghost)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
            Waar je op let
          </div>
          {tech.cues.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11.5, lineHeight: 1.5,
              marginBottom: 3 }}>
              <span style={{ color: 'var(--ghost)', fontWeight: 700, minWidth: 12 }}>{i + 1}</span>
              <span style={{ color: i === 2 ? 'var(--rust)' : 'var(--sub)' }}>{c}</span>
            </div>
          ))}

          <button type="button" onClick={() => setUitleg(v => !v)} data-gewichtuitleg-knop
            style={{ background: 'none', border: 'none', padding: '8px 0 0', cursor: 'pointer',
              fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center',
              gap: 5 }}>
            <span>{uitleg ? '▲' : '▶'}</span>
            <span>Hoe werken series, herhalingen en gewicht?</span>
          </button>
          {uitleg && (
            <div data-gewichtuitleg style={{ marginTop: 6 }}>
              {GEWICHTEN_UITLEG.map(b => (
                <div key={b.kop} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 1 }}>{b.kop}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.55,
                    color: 'var(--sub)' }}>{b.tekst}</div>
                </div>
              ))}
            </div>
          )}

          {url && (
            <button type="button" onClick={() => { setVideos(saveExerciseVideo(exercise.id, '')); }}
              style={{ background: 'none', border: 'none', padding: '6px 0 0', cursor: 'pointer',
                fontSize: 10.5, color: 'var(--ghost)' }}>
              Link verwijderen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
