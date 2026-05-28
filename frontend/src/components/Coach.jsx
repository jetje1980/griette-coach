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

const PHOTO_TYPES = [
  { key: 'voor', label: 'Voorkant' },
  { key: 'zij', label: 'Zijkant' },
  { key: 'achter', label: 'Achterkant' },
];

function PhotoCapture({ logs }) {
  const today = new Date().toISOString().slice(0, 10);
  const [sessions, setSessions] = useState([]);
  const [todayViews, setTodayViews] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzeError, setAnalyzeError] = useState(null);

  useEffect(() => { loadPhotos(); }, []);

  async function loadPhotos() {
    const all = await photoStore.getAll().catch(() => []);
    setSessions(all);
    const todaySession = all.find(s => s.date === today);
    setTodayViews(todaySession?.views ?? {});
  }

  async function handleFile(type, e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      await photoStore.save(today, type, base64, mimeType);
      await loadPhotos();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function deletePhoto(date, type) {
    await photoStore.delete(date, type);
    await loadPhotos();
    if (date === today) setAnalysis(null);
  }

  async function analyzeToday() {
    if (!ai.hasKey()) {
      setAnalyzeError('Stel eerst je API-sleutel in via ⚙️ Instellingen');
      return;
    }
    const photoList = Object.values(todayViews);
    if (photoList.length === 0) return;
    setAnalyzing(true);
    setAnalysis(null);
    setAnalyzeError(null);
    try {
      const weights = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
      const currentWeight = weights[0]?.weight;
      const dayNum = Math.max(1, Math.floor((new Date(today) - new Date(USER.startDate)) / 86400000) + 1);
      const photo = photoList[0];
      const text = await ai.analyzePhoto(photo.base64, photo.mimeType, dayNum, currentWeight, logs);
      setAnalysis(text);
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const hasTodayPhotos = Object.keys(todayViews).length > 0;
  const pastSessions = sessions.filter(s => s.date !== today);

  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 8 }}>Vandaag — {today}</div>

      {/* 3 slots voor vandaag */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {PHOTO_TYPES.map(({ key, label }) => {
          const photo = todayViews[key];
          return (
            <div key={key}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>{label}</div>
              {photo ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={`data:${photo.mimeType};base64,${photo.base64}`}
                    alt={label}
                    style={{ width: '100%', borderRadius: 9, objectFit: 'cover', height: 100 }}
                  />
                  <button
                    onClick={() => deletePhoto(today, key)}
                    style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(42,37,32,0.65)', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 9, cursor: 'pointer', padding: 0, lineHeight: '18px', textAlign: 'center' }}
                  >✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 4px', background: 'var(--rust-l)', border: '1.5px dashed var(--rust)', borderRadius: 9, cursor: 'pointer', fontSize: 14 }} title="Camera">
                    📷
                    <input type="file" accept="image/*" capture="environment" onChange={e => handleFile(key, e)} style={{ display: 'none' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 4px', background: 'var(--sage-l)', border: '1.5px dashed var(--sage)', borderRadius: 9, cursor: 'pointer', fontSize: 14 }} title="Galerij">
                    🖼️
                    <input type="file" accept="image/*" onChange={e => handleFile(key, e)} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analyseer knop */}
      {hasTodayPhotos && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-rust btn-full" onClick={analyzeToday} disabled={analyzing}>
            {analyzing ? '⏳ Analyseren…' : "🤖 Analyseer foto's met AI"}
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

      {/* Historische sessies */}
      {pastSessions.length > 0 && (
        <div>
          <div className="section-title">Eerdere sessies</div>
          {pastSessions.map(({ date, views }) => (
            <div key={date} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)', marginBottom: 5 }}>{date}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                {PHOTO_TYPES.map(({ key, label }) => {
                  const photo = views[key];
                  return (
                    <div key={key}>
                      {photo ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={`data:${photo.mimeType};base64,${photo.base64}`}
                            alt={`${date} ${label}`}
                            style={{ width: '100%', borderRadius: 7, objectFit: 'cover', height: 80 }}
                          />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(42,37,32,0.6)', borderRadius: '0 0 7px 7px', padding: '2px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 8, color: 'white' }}>{label}</span>
                            <button onClick={() => deletePhoto(date, key)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: 80, background: 'var(--bg)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--border)', border: '1px dashed var(--border)' }}>
                          {label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
