import React, { useState, useEffect } from 'react';
import { ai } from '../ai';
import { photoStore } from '../photoStore';
import { USER } from '../config';

const REPORT_KEY = 'gc_coach_report';
const REPORT_DATE_KEY = 'gc_coach_report_date';
const PLAN_KEY = 'gc_training_plan';
const PLAN_DATE_KEY = 'gc_training_plan_date';
const ANALYSIS_PREFIX = 'gc_photo_analysis_';
const REPORTS_HISTORY_KEY = 'gc_coach_reports_history';
const PLANS_HISTORY_KEY = 'gc_training_plans_history';
const CHECK_DAYS = 3;

function pushToHistory(key, entry, max = 20) {
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.unshift(entry);
  localStorage.setItem(key, JSON.stringify(history.slice(0, max)));
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

const PHOTO_TYPES = [
  { key: 'voor',   label: 'Voorkant' },
  { key: 'zij',    label: 'Zijkant'  },
  { key: 'achter', label: 'Achterkant' },
];

function loadSavedAnalyses() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(ANALYSIS_PREFIX)) {
      const date = key.slice(ANALYSIS_PREFIX.length);
      const text = localStorage.getItem(key);
      if (text) results.push({ date, text });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// Stap 1: probeer canvas-compressie (max 900px, JPEG 78%)
function tryCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('canvas_fail')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const MAX = 900;
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      } catch (e) { reject(e); }
    };
    img.src = url;
  });
}

// Stap 2: fallback — lees bestand direct (geen compressie, maar werkt voor alle formaten)
function tryDirect(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Foto lezen mislukt. Probeer een andere foto.'));
    reader.onload = e => {
      const dataUrl = e.target.result;
      const mimeType = file.type || 'image/jpeg';
      resolve({ base64: dataUrl.split(',')[1], mimeType });
    };
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  try {
    return await tryCanvas(file);
  } catch {
    // Canvas ondersteunt dit formaat niet (bijv. HEIC) — probeer direct
    return await tryDirect(file);
  }
}

function PhotoCapture({ logs, measurements }) {
  const today = new Date().toISOString().slice(0, 10);
  const [sessions, setSessions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedViews, setSelectedViews] = useState({});
  const [saving, setSaving] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzeError, setAnalyzeError] = useState(null);

  useEffect(() => { loadPhotos(); }, []);

  useEffect(() => {
    const session = sessions.find(s => s.date === selectedDate);
    setSelectedViews(session?.views ?? {});
    setAnalysis(localStorage.getItem(`${ANALYSIS_PREFIX}${selectedDate}`) || null);
    setAnalyzeError(null);
  }, [selectedDate, sessions]);

  async function loadPhotos() {
    const all = await photoStore.getAll().catch(() => []);
    setSessions(all);
  }

  async function handleFile(type, e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setSaving(prev => ({ ...prev, [type]: true }));
    setSaveError(null);
    try {
      const { base64, mimeType } = await compressImage(file);
      await photoStore.save(selectedDate, type, base64, mimeType);
      await loadPhotos();
    } catch (err) {
      setSaveError(`${type}: ${err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [type]: false }));
    }
  }

  async function deletePhoto(date, type) {
    await photoStore.delete(date, type);
    await loadPhotos();
  }

  async function deleteSession(date) {
    await Promise.all(PHOTO_TYPES.map(({ key }) => photoStore.delete(date, key)));
    localStorage.removeItem(`${ANALYSIS_PREFIX}${date}`);
    if (date === selectedDate) setSelectedDate(today);
    await loadPhotos();
  }

  async function analyzeSession() {
    if (!ai.hasKey()) {
      setAnalyzeError('Stel eerst je API-sleutel in via ⚙️ Instellingen');
      return;
    }
    const photoList = PHOTO_TYPES
      .filter(({ key }) => selectedViews[key])
      .map(({ key }) => ({ ...selectedViews[key], type: key }));
    if (photoList.length === 0) return;

    setAnalyzing(true);
    setAnalysis(null);
    setAnalyzeError(null);
    try {
      const weights = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
      const currentWeight = weights[0]?.weight;
      const dayNum = Math.max(1, Math.floor((new Date(selectedDate) - new Date(USER.startDate)) / 86400000) + 1);
      const previousAnalyses = loadSavedAnalyses().filter(a => a.date !== selectedDate);

      // Meest recente sessie vóór geselecteerde datum
      const prevSession = sessions
        .filter(s => s.date < selectedDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const prevPhotos = prevSession
        ? PHOTO_TYPES.filter(({ key }) => prevSession.views[key]).map(({ key }) => ({ ...prevSession.views[key], type: key, sessionDate: prevSession.date }))
        : [];

      const text = await ai.analyzePhoto(photoList, dayNum, currentWeight, logs, measurements, previousAnalyses, prevPhotos);
      localStorage.setItem(`${ANALYSIS_PREFIX}${selectedDate}`, text);
      setAnalysis(text);

      if (selectedDate === today) {
        const coachReport = localStorage.getItem('gc_coach_report') ?? '';
        ai.weeklyTrainingPlan(logs, measurements, coachReport, text).then(planText => {
          localStorage.setItem('gc_training_plan', planText);
          localStorage.setItem('gc_training_plan_date', today);
        }).catch(() => {});
      }
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const hasPhotos = Object.keys(selectedViews).length > 0;
  const isSavingAny = Object.values(saving).some(Boolean);
  const allSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const prevSessionDate = sessions.filter(s => s.date < selectedDate).sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  return (
    <div>
      {/* Actieve sessie – upload / bewerken */}
      <div style={{ background: 'var(--rust-l)', border: '1.5px solid var(--rust)', borderRadius: 11, padding: '10px 12px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rust)', flex: 1 }}>
            📸 Sessie toevoegen / bewerken
          </div>
          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              style={{ fontSize: 10, padding: '3px 8px', background: 'white', border: '1px solid var(--rust)', borderRadius: 6, color: 'var(--rust)', cursor: 'pointer' }}
            >
              Vandaag
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>Datum:</div>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ fontSize: 12, border: '1.5px solid var(--border)', borderRadius: 7, padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text)', background: 'white', flex: 1 }}
          />
        </div>

        {saveError && (
          <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--alert)', background: 'var(--alert-l)', padding: '8px 10px', borderRadius: 8 }}>
            ⚠️ Opslaan mislukt: {saveError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          {PHOTO_TYPES.map(({ key, label }) => {
            const photo = selectedViews[key];
            const isSavingThis = saving[key];
            return (
              <div key={key}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textAlign: 'center', marginBottom: 4 }}>{label}</div>
                {isSavingThis ? (
                  <div style={{ height: 100, borderRadius: 9, background: 'white', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
                    ⏳ Opslaan…
                  </div>
                ) : photo?.base64 ? (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`}
                      alt={label}
                      style={{ width: '100%', borderRadius: 9, objectFit: 'cover', height: 100 }}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <div style={{ display: 'none', height: 100, borderRadius: 9, background: 'var(--alert-l)', border: '1px solid var(--alert)', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--alert)', textAlign: 'center', padding: 4 }}>
                      ⚠️ Kan niet laden — verwijder en upload opnieuw
                    </div>
                    <button
                      onClick={() => deletePhoto(selectedDate, key)}
                      style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(42,37,32,0.65)', border: 'none', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 9, cursor: 'pointer', padding: 0, lineHeight: '18px', textAlign: 'center' }}
                    >✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 4px', background: 'white', border: '1.5px dashed var(--rust)', borderRadius: 9, cursor: 'pointer', fontSize: 14 }} title="Camera">
                      📷
                      <input type="file" accept="image/*" capture="environment" onChange={e => handleFile(key, e)} style={{ display: 'none' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 4px', background: 'white', border: '1.5px dashed var(--sage)', borderRadius: 9, cursor: 'pointer', fontSize: 14 }} title="Galerij">
                      🖼️
                      <input type="file" accept="image/*" onChange={e => handleFile(key, e)} style={{ display: 'none' }} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasPhotos && (
          <div>
            <button className="btn btn-rust btn-full" onClick={analyzeSession} disabled={analyzing || isSavingAny}>
              {analyzing ? '⏳ AI analyseert + vergelijkt…' : `🤖 Analyseer ${Object.keys(selectedViews).length} foto('s) met AI`}
            </button>
            {prevSessionDate && !analyzing && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
                ↑ AI vergelijkt met sessie van {prevSessionDate}
              </div>
            )}
            {!prevSessionDate && !analyzing && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
                Geen eerdere sessie — voeg eerst een oudere datum toe
              </div>
            )}
            {analyzeError && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--alert)', background: 'var(--alert-l)', padding: '8px 10px', borderRadius: 8 }}>
                {analyzeError}
              </div>
            )}
            {analysis && (
              <div style={{ marginTop: 10, background: 'white', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.8, color: 'var(--text)', borderLeft: '3px solid var(--sage)', whiteSpace: 'pre-wrap' }}>
                {analysis}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overzicht alle sessies */}
      <div className="section-title">
        Opgeslagen sessies ({allSessions.length})
      </div>
      {allSessions.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
          Nog geen sessies opgeslagen — upload je eerste foto hierboven.
        </div>
      )}
      {allSessions.map(({ date, views }) => {
        const isCurrent = date === selectedDate;
        const savedAnalysis = localStorage.getItem(`${ANALYSIS_PREFIX}${date}`);
        const photoCount = Object.keys(views).length;
        return (
          <div key={date} style={{ marginBottom: 14, borderRadius: 10, border: isCurrent ? '2px solid var(--rust)' : '1px solid var(--border)', padding: '8px 10px', background: isCurrent ? 'var(--rust-l)' : 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isCurrent ? 'var(--rust)' : 'var(--text)', flex: 1 }}>
                {date}{isCurrent ? ' ← bezig' : ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{photoCount}/3 foto's</div>
              {savedAnalysis && <div style={{ fontSize: 10, color: 'var(--sage)' }}>🤖</div>}
              {!isCurrent && (
                <button
                  onClick={() => setSelectedDate(date)}
                  style={{ fontSize: 9, padding: '2px 7px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--muted)', cursor: 'pointer' }}
                >
                  ✏️
                </button>
              )}
              <button
                onClick={() => { if (window.confirm(`Sessie ${date} verwijderen inclusief alle foto's en analyse?`)) deleteSession(date); }}
                style={{ fontSize: 9, padding: '2px 7px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 5, color: '#DC2626', cursor: 'pointer' }}
              >
                🗑️
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              {PHOTO_TYPES.map(({ key, label }) => {
                const photo = views[key];
                return (
                  <div key={key}>
                    {photo?.base64 ? (
                      <div style={{ position: 'relative' }}>
                        <img
                          src={`data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`}
                          alt={`${date} ${label}`}
                          style={{ width: '100%', borderRadius: 7, objectFit: 'cover', height: 72 }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(42,37,32,0.55)', borderRadius: '0 0 7px 7px', padding: '2px 5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 8, color: 'white' }}>{label}</span>
                          <button onClick={() => deletePhoto(date, key)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: 72, background: 'var(--border)', opacity: 0.3, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--muted)' }}>
                        {label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {savedAnalysis && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ fontSize: 10, color: 'var(--sage)', cursor: 'pointer', fontWeight: 700 }}>🤖 AI-analyse bekijken</summary>
                <div style={{ marginTop: 6, background: 'var(--sage-l)', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--text)', borderLeft: '3px solid var(--sage)', whiteSpace: 'pre-wrap' }}>
                  {savedAnalysis}
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportHistory() {
  const [open, setOpen] = useState(false);
  const reports = JSON.parse(localStorage.getItem(REPORTS_HISTORY_KEY) || '[]');
  const plans   = JSON.parse(localStorage.getItem(PLANS_HISTORY_KEY)   || '[]');
  const sportAnalyses = JSON.parse(localStorage.getItem('gc_sport_analyses_history') || '[]');
  const total = reports.length + plans.length + sportAnalyses.length;
  if (total === 0) return null;

  return (
    <div className="card">
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>
        <div className="card-accent" style={{ background: '#6366F1' }} />
        <div className="card-title">🗂️ Rapport geschiedenis</div>
        <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 4 }}>{total} opgeslagen</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="card-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
          {reports.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', letterSpacing: 1, marginBottom: 8 }}>
                📋 COACH-RAPPORTEN ({reports.length})
              </div>
              {reports.map((r, i) => (
                <details key={i} style={{ marginBottom: 10 }}>
                  <summary style={{ fontSize: 11, color: 'var(--rust)', cursor: 'pointer', fontWeight: 700 }}>
                    {r.date}
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', background: 'var(--rust-l)', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid var(--rust)' }}>
                    {r.text}
                  </div>
                </details>
              ))}
            </>
          )}
          {plans.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: 1, margin: '12px 0 8px' }}>
                📅 WEEKPLANNEN ({plans.length})
              </div>
              {plans.map((r, i) => (
                <details key={i} style={{ marginBottom: 10 }}>
                  <summary style={{ fontSize: 11, color: 'var(--sage)', cursor: 'pointer', fontWeight: 700 }}>
                    {r.date}
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', background: 'var(--sage-l)', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid var(--sage)' }}>
                    {r.text}
                  </div>
                </details>
              ))}
            </>
          )}
          {sportAnalyses.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: 1, margin: '12px 0 8px' }}>
                🏃 SPORT-ANALYSES ({sportAnalyses.length})
              </div>
              {sportAnalyses.map((r, i) => (
                <details key={i} style={{ marginBottom: 10 }}>
                  <summary style={{ fontSize: 11, color: '#B45309', cursor: 'pointer', fontWeight: 700 }}>
                    {r.date} · {r.type}
                  </summary>
                  <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap', background: '#FFFBEB', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #F59E0B' }}>
                    {r.text}
                  </div>
                </details>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Coach({ logs }) {
  const [report, setReport] = useState(() => localStorage.getItem(REPORT_KEY) || null);
  const [reportDate, setReportDate] = useState(() => localStorage.getItem(REPORT_DATE_KEY) || null);
  const [plan, setPlan] = useState(() => localStorage.getItem(PLAN_KEY) || null);
  const [planDate, setPlanDate] = useState(() => localStorage.getItem(PLAN_DATE_KEY) || null);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState(null);
  const [measurements, setMeasurements] = useState([]);

  const daysSinceReport = daysSince(reportDate);
  const needsCheck = daysSinceReport >= CHECK_DAYS;

  useEffect(() => {
    import('../store').then(({ store }) => store.getMeasurements().then(setMeasurements).catch(() => {}));
  }, []);

  async function generatePlan(coachText, photoText) {
    setPlanLoading(true);
    try {
      const planText = await ai.weeklyTrainingPlan(logs, measurements, coachText, photoText);
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(PLAN_KEY, planText);
      localStorage.setItem(PLAN_DATE_KEY, today);
      pushToHistory(PLANS_HISTORY_KEY, { date: today, text: planText });
      setPlan(planText);
      setPlanDate(today);
    } catch {
      // weekplan is secundair — stil falen
    } finally {
      setPlanLoading(false);
    }
  }

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
      pushToHistory(REPORTS_HISTORY_KEY, { date: today, text });
      setReport(text);
      setReportDate(today);
      const latestPhotoAnalysis = loadSavedAnalyses()[0]?.text ?? '';
      generatePlan(text, latestPhotoAnalysis);
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
            {totalDays} dag{totalDays !== 1 ? 'en' : ''} ingelogd ·{' '}
            {measurements.length} meting{measurements.length !== 1 ? 'en' : ''}
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

      {/* AI Weekplan */}
      {(plan || planLoading) && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">📅 AI Weekplan</div>
            {planDate && !planLoading && <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{planDate}</div>}
            {planLoading && <div style={{ fontSize: 10, color: 'var(--muted)' }}>⏳ bijwerken…</div>}
          </div>
          {plan && !planLoading && (
            <div className="card-body">
              <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {plan}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                ↑ Dit plan staat ook bovenin de Training-tab. Wordt bijgewerkt na elke coach-check en foto-analyse.
              </div>
            </div>
          )}
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
            Maak elke week een foto op hetzelfde tijdstip en in dezelfde houding.
            De AI analyseert vetdistributie, spiertonus en progressie — en geeft concrete trainings- en voedingsadviezen op basis van jouw volledige data.
          </div>
          <PhotoCapture logs={logs} measurements={measurements} />
        </div>
      </div>

      {/* Rapport geschiedenis */}
      <ReportHistory />

      {/* Geen API sleutel hint */}
      {!ai.hasKey() && (
        <div style={{ padding: '12px 14px', background: 'var(--gold-l)', borderRadius: 11, fontSize: 11, color: 'var(--gold)', lineHeight: 1.6, textAlign: 'center' }}>
          🔑 Voeg je Anthropic API-sleutel toe via <strong>⚙️ Instellingen</strong> om AI-analyses te activeren.
        </div>
      )}
    </div>
  );
}
