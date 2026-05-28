import React, { useState, useEffect } from 'react';
import { ai } from '../ai';
import { photoStore } from '../photoStore';
import { USER } from '../config';

const REPORT_KEY = 'gc_coach_report';
const REPORT_DATE_KEY = 'gc_coach_report_date';
const CHECK_DAYS = 3;

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function PhotoCapture({ logs, onPhotoSaved }) {
  const [photos, setPhotos] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    photoStore.getAll().then(setPhotos).catch(() => {});
  }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      const date = new Date().toISOString().slice(0, 10);

      await photoStore.save(date, base64, mimeType);
      const updated = await photoStore.getAll();
      setPhotos(updated);
      setPreviewPhoto({ base64, mimeType, date });
      onPhotoSaved?.();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function analyzePhoto(photo) {
    if (!ai.hasKey()) {
      setAnalyzeError('Stel eerst je API-sleutel in via ⚙️ Instellingen');
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalyzeError(null);
    try {
      const weights = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
      const currentWeight = weights[0]?.weight;
      const start = new Date(USER.startDate);
      const now = new Date(photo.date);
      const dayNum = Math.max(1, Math.floor((now - start) / 86400000) + 1);

      const text = await ai.analyzePhoto(photo.base64, photo.mimeType, dayNum, currentWeight, logs);
      setAnalysis(text);
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function deletePhoto(date) {
    await photoStore.delete(date);
    setPhotos(await photoStore.getAll());
    if (previewPhoto?.date === date) setPreviewPhoto(null);
  }

  return (
    <div>
      {/* Camera knop */}
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px', background: 'var(--rust-l)', border: '1.5px dashed var(--rust)',
        borderRadius: 11, cursor: 'pointer', marginBottom: 12,
        fontSize: 13, fontWeight: 700, color: 'var(--rust)',
      }}>
        📸 Foto maken of uploaden
        <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      </label>

      {/* Preview van net genomen foto */}
      {previewPhoto && (
        <div style={{ marginBottom: 12 }}>
          <img
            src={`data:${previewPhoto.mimeType};base64,${previewPhoto.base64}`}
            alt="progressie"
            style={{ width: '100%', borderRadius: 11, objectFit: 'cover', maxHeight: 220 }}
          />
          <button
            className="btn btn-rust btn-full"
            style={{ marginTop: 8 }}
            onClick={() => analyzePhoto(previewPhoto)}
            disabled={analyzing}
          >
            {analyzing ? '⏳ Analyseren…' : '🤖 Analyseer met AI'}
          </button>
          {analyzeError && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--alert)', background: 'var(--alert-l)', padding: '8px 10px', borderRadius: 8 }}>
              {analyzeError}
            </div>
          )}
          {analysis && (
            <div style={{ marginTop: 10, background: 'var(--sage-l)', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.7, color: 'var(--text)', borderLeft: '3px solid var(--sage)' }}>
              {analysis}
            </div>
          )}
        </div>
      )}

      {/* Foto galerij */}
      {photos.length > 0 && (
        <div>
          <div className="section-title">Jouw progressiefoto's</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {photos.map(p => (
              <div key={p.date} style={{ position: 'relative' }}>
                <img
                  src={`data:${p.mimeType};base64,${p.base64}`}
                  alt={p.date}
                  style={{ width: '100%', borderRadius: 9, objectFit: 'cover', height: 120, cursor: 'pointer' }}
                  onClick={() => { setPreviewPhoto(p); setAnalysis(null); }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(42,37,32,0.6)', borderRadius: '0 0 9px 9px', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: 'white', fontFamily: 'var(--font-mono)' }}>{p.date}</span>
                  <button onClick={() => deletePhoto(p.date)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Coach({ logs }) {
  const [report, setReport] = useState(() => localStorage.getItem(REPORT_KEY) || null);
  const [reportDate, setReportDate] = useState(() => localStorage.getItem(REPORT_DATE_KEY) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [measurements, setMeasurements] = useState([]);

  const daysSinceReport = daysSince(reportDate);
  const needsCheck = daysSinceReport >= CHECK_DAYS;

  useEffect(() => {
    import('../store').then(({ store }) => store.getMeasurements().then(setMeasurements).catch(() => {}));
  }, []);

  async function runCheck() {
    if (!ai.hasKey()) {
      setError('Stel eerst je API-sleutel in via ⚙️ Instellingen (rechtsboven in de header)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const text = await ai.coachCheck(logs, measurements);
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(REPORT_KEY, text);
      localStorage.setItem(REPORT_DATE_KEY, today);
      setReport(text);
      setReportDate(today);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalDays = Object.values(logs).length;
  const latestWeight = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight;

  return (
    <div className="pane">
      {/* Status banner */}
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '16px 14px' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            AI-coach
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            {latestWeight ? `${latestWeight} kg · ` : ''}
            {totalDays} dag{totalDays !== 1 ? 'en' : ''} ingelogd
          </div>

          {needsCheck ? (
            <div style={{ background: 'var(--rust-l)', borderRadius: 10, padding: '10px', marginBottom: 12, fontSize: 11, color: 'var(--rust)' }}>
              {daysSinceReport === 999 ? '✨ Nog geen coach-check gedaan' : `🔔 Tijd voor een nieuwe check (${daysSinceReport} dagen geleden)`}
            </div>
          ) : (
            <div style={{ background: 'var(--sage-l)', borderRadius: 10, padding: '10px', marginBottom: 12, fontSize: 11, color: 'var(--sage)' }}>
              ✓ Volgende check over {CHECK_DAYS - daysSinceReport} dag{CHECK_DAYS - daysSinceReport !== 1 ? 'en' : ''}
            </div>
          )}

          <button
            className={`btn btn-full ${needsCheck ? 'btn-rust' : 'btn-ghost'}`}
            onClick={runCheck}
            disabled={loading}
          >
            {loading ? '⏳ Coach analyseert jouw data…' : needsCheck ? '🎯 Start coach-check' : '🔄 Nieuwe check'}
          </button>

          {error && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--alert)', background: 'var(--alert-l)', padding: '8px 10px', borderRadius: 8, textAlign: 'left', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Coach rapport */}
      {report && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--rust)' }} />
            <div className="card-title">📋 Coach-rapport</div>
            {reportDate && <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{reportDate}</div>}
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {report}
            </div>
          </div>
        </div>
      )}

      {/* Progressiefoto's */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">📸 Progressiefoto's</div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            Maak elke week een foto op hetzelfde tijdstip, in dezelfde ruimte en houding.
            De AI geeft je direct terugkoppeling.
          </div>
          <PhotoCapture logs={logs} />
        </div>
      </div>

      {/* Geen API sleutel hint */}
      {!ai.hasKey() && (
        <div style={{ padding: '12px 14px', background: 'var(--gold-l)', borderRadius: 11, fontSize: 11, color: 'var(--gold)', lineHeight: 1.6, textAlign: 'center' }}>
          🔑 Voeg je Anthropic API-sleutel toe via <strong>⚙️ Instellingen</strong> om AI-analyses te activeren.
        </div>
      )}
    </div>
  );
}
