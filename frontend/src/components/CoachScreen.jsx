import React, { useState, useEffect, useMemo } from 'react';
import SubTabs from './SubTabs';
import { ai } from '../ai';
import { kwartaalDossier, dossierAlsTekst } from '../kwartaalanalyse';
import { buildCoachContext, contextAsText } from '../coachContext';
import { store } from '../store';
import { todayLocal } from '../datetime';
import WhyPanel from './WhyPanel';

const SUBTABS = ['Nu', 'Weekanalyse', 'Maand', 'Kwartaal'];

const REPORT_KEY      = 'gc_coach_report';
const REPORT_DATE_KEY = 'gc_coach_report_date';
const PLAN_KEY        = 'gc_training_plan';
const PLAN_DATE_KEY   = 'gc_training_plan_date';
const REPORTS_HISTORY = 'gc_coach_reports_history';
const PLANS_HISTORY   = 'gc_training_plans_history';

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function pushToHistory(key, entry, max = 20) {
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.unshift(entry);
  localStorage.setItem(key, JSON.stringify(history.slice(0, max)));
}

function ReportAge({ dateStr }) {
  if (!dateStr) return null;
  const d = daysSince(dateStr);
  const color = d === 0 ? 'var(--green)' : d <= 3 ? 'var(--sage)' : 'var(--sub)';
  const label = d === 0 ? 'Vandaag' : d === 1 ? 'Gisteren' : `${d} dagen geleden`;
  return (
    <div style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</div>
  );
}

function ReportCard({ text, dateStr, label }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const preview = text.slice(0, 240);
  const needsMore = text.length > 240;

  return (
    <div className="os-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.5px' }}>{label}</div>
        <ReportAge dateStr={dateStr} />
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word' }}>
        {expanded || !needsMore ? text : preview + '…'}
      </div>
      {needsMore && (
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', color: 'var(--sage)', fontSize: 12,
            cursor: 'pointer', padding: '8px 0 0', fontWeight: 600 }}>
          {expanded ? '↑ Minder' : '↓ Alles lezen'}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: NU (coach check)
// ═══════════════════════════════════════════════════════════════
function TabNu({ logs, measurements }) {
  const [report, setReport]       = useState(() => localStorage.getItem(REPORT_KEY) || '');
  const [reportDate, setRDate]    = useState(() => localStorage.getItem(REPORT_DATE_KEY) || '');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [history, setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(REPORTS_HISTORY) || '[]'); } catch { return []; }
  });

  const hasKey = ai.hasKey();
  const logCount = Object.keys(logs || {}).length;
  const fresh = daysSince(reportDate) === 0;

  async function runCheck() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const text = await ai.coachCheck(logs, measurements);
      const today = todayLocal();
      localStorage.setItem(REPORT_KEY, text);
      localStorage.setItem(REPORT_DATE_KEY, today);
      setReport(text); setRDate(today);
      pushToHistory(REPORTS_HISTORY, { date: today, text });
      setHistory(JSON.parse(localStorage.getItem(REPORTS_HISTORY) || '[]'));
    } catch (e) {
      setError(e.message || 'Fout bij ophalen coach-analyse');
    } finally { setLoading(false); }
  }

  return (
    <div>
      {!hasKey && (
        <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
            <strong>API-sleutel vereist.</strong> Ga naar de tandwielknop (⚙) → Instellingen om je Anthropic API-sleutel in te voeren.
          </div>
        </div>
      )}

      {logCount < 3 && (
        <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--sage)' }}>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6 }}>
            Log minimaal 3 dagen data voor een zinvolle analyse. Je hebt nu {logCount} dag{logCount !== 1 ? 'en' : ''}.
          </div>
        </div>
      )}

      {report ? (
        <>
          <ReportCard text={report} dateStr={reportDate} label="Coach-analyse" />
          <button
            className="os-btn-save"
            onClick={runCheck}
            disabled={loading || !hasKey || logCount < 3}
            style={{ marginBottom: 16, opacity: (loading || !hasKey) ? 0.5 : 1 }}>
            {loading ? 'Analyseren…' : fresh ? 'Vernieuwen' : 'Nieuwe analyse'}
          </button>
        </>
      ) : (
        <div className="os-card" style={{ textAlign: 'center', padding: '32px 20px', marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Nog geen coach-analyse</div>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 16 }}>
            De coach analyseert je data en zoekt naar patronen die specifiek voor jouw lichaam gelden.
          </div>
          <button
            className="os-btn-save"
            onClick={runCheck}
            disabled={loading || !hasKey || logCount < 3}
            style={{ opacity: (!hasKey || logCount < 3) ? 0.5 : 1 }}>
            {loading ? 'Analyseren…' : 'Analyseer mijn data'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--alert-l, rgba(200,60,40,0.08))', border: '1px solid var(--rust)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--rust)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {history.length > 1 && (
        <>
          <div className="os-section-label">Eerdere analyses</div>
          {history.slice(1, 5).map((h, i) => (
            <ReportCard key={i} text={h.text} dateStr={h.date} label={`Analyse ${h.date}`} />
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: WEEKANALYSE
// ═══════════════════════════════════════════════════════════════
function TabWeekanalyse({ logs, measurements }) {
  const [plan, setPlan]       = useState(() => localStorage.getItem(PLAN_KEY) || '');
  const [planDate, setPDate]  = useState(() => localStorage.getItem(PLAN_DATE_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PLANS_HISTORY) || '[]'); } catch { return []; }
  });

  const hasKey   = ai.hasKey();
  const logCount = Object.keys(logs || {}).length;
  const coachReport = localStorage.getItem(REPORT_KEY) || '';

  async function genPlan() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const text = await ai.weeklyTrainingPlan(logs, measurements, coachReport);
      const today = todayLocal();
      localStorage.setItem(PLAN_KEY, text);
      localStorage.setItem(PLAN_DATE_KEY, today);
      setPlan(text); setPDate(today);
      pushToHistory(PLANS_HISTORY, { date: today, text });
      setHistory(JSON.parse(localStorage.getItem(PLANS_HISTORY) || '[]'));
    } catch (e) {
      setError(e.message || 'Fout bij genereren weekplan');
    } finally { setLoading(false); }
  }

  function formatPlan(text) {
    if (!text) return null;
    const days = ['Ma:', 'Di:', 'Wo:', 'Do:', 'Vr:', 'Za:', 'Zo:'];
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const isDay = days.some(d => line.startsWith(d));
      const isHeader = line.startsWith('WEEKPLAN') || line.startsWith('LOOPSCHEMA') ||
                       line.startsWith('FOCUS') || line.startsWith('DATA');
      if (isHeader) return (
        <div key={i} style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 12, marginBottom: 4 }}>
          {line}
        </div>
      );
      if (isDay) {
        const [dayPart, ...rest] = line.split(': ');
        return (
          <div key={i} className="os-detail-row" style={{ paddingBottom: 8, marginBottom: 8 }}>
            <span className="os-dk" style={{ fontWeight: 800, minWidth: 28 }}>{dayPart}</span>
            <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{rest.join(': ')}</span>
          </div>
        );
      }
      return line ? (
        <div key={i} style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 4 }}>{line}</div>
      ) : <div key={i} style={{ height: 4 }} />;
    });
  }

  return (
    <div>
      {!hasKey && (
        <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--gold)' }}>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
            <strong>API-sleutel vereist.</strong> Ga naar ⚙ → Instellingen.
          </div>
        </div>
      )}

      {!coachReport && (
        <div className="os-card" style={{ marginBottom: 12, borderLeft: '4px solid var(--sage)' }}>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6 }}>
            Tip: run eerst een Coach-analyse (Nu-tab) voor een beter weekplan.
          </div>
        </div>
      )}

      {plan ? (
        <>
          <div className="os-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--ghost)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekplan</div>
              <ReportAge dateStr={planDate} />
            </div>
            {formatPlan(plan)}
          </div>
          <button
            className="os-btn-save"
            onClick={genPlan}
            disabled={loading || !hasKey}
            style={{ marginBottom: 16, opacity: (!hasKey || loading) ? 0.5 : 1 }}>
            {loading ? 'Genereren…' : 'Nieuw weekplan'}
          </button>
        </>
      ) : (
        <div className="os-card" style={{ textAlign: 'center', padding: '32px 20px', marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Weekplan op maat</div>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 16 }}>
            De coach maakt een trainingsplan op basis van jouw energiedata, herstelstatus en aankomende events.
          </div>
          <button
            className="os-btn-save"
            onClick={genPlan}
            disabled={loading || !hasKey || logCount < 1}
            style={{ opacity: (!hasKey || logCount < 1) ? 0.5 : 1 }}>
            {loading ? 'Genereren…' : 'Genereer weekplan'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--alert-l, rgba(200,60,40,0.08))', border: '1px solid var(--rust)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--rust)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {history.length > 1 && (
        <>
          <div className="os-section-label">Eerdere plannen</div>
          {history.slice(1, 4).map((h, i) => (
            <ReportCard key={i} text={h.text} dateStr={h.date} label={`Plan ${h.date}`} />
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB: MAAND (bottleneck analysis)
// ═══════════════════════════════════════════════════════════════
function TabMaand({ logs }) {
  const [analysis, setAnalysis] = useState(() => localStorage.getItem('gc_monthly_bottleneck') || '');
  const [analysisDate, setADate] = useState(() => localStorage.getItem('gc_monthly_bottleneck_date') || '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const hasKey = ai.hasKey();
  const logCount = Object.keys(logs || {}).length;

  async function runMonthly() {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const today = todayLocal();
      const text = await ai.coachCheck(logs, []);
      localStorage.setItem('gc_monthly_bottleneck', text);
      localStorage.setItem('gc_monthly_bottleneck_date', today);
      setAnalysis(text); setADate(today);
    } catch (e) {
      setError(e.message || 'Fout bij maandelijkse analyse');
    } finally { setLoading(false); }
  }

  // Compute local bottleneck stats without AI
  const localStats = (() => {
    const allLogs = Object.values(logs || {}).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
    if (allLogs.length < 5) return null;

    const trainedDays = allLogs.filter(l => l.run_done || l.core_done).length;
    const pemDays     = allLogs.filter(l => l.symptom_pem).length;
    const lowEnergy   = allLogs.filter(l => (l.energie ?? l.energy) === 0).length;
    const goodSleep   = allLogs.filter(l => l.sleep_hours >= 7).length;
    const weights     = allLogs.filter(l => l.weight).map(l => l.weight);
    const weightTrend = weights.length >= 2 ? (weights[0] - weights[weights.length - 1]).toFixed(1) : null;

    const issues = [];
    if (pemDays > 2) issues.push({ label: 'PEM/crash', count: pemDays, color: 'var(--rust)' });
    if (lowEnergy > 5) issues.push({ label: 'Lage energie-dagen', count: lowEnergy, color: 'var(--gold)' });
    if (trainedDays < 6) issues.push({ label: 'Weinig training', count: allLogs.length - trainedDays + ' rustdagen', color: 'var(--blue)' });

    return { trainedDays, pemDays, lowEnergy, goodSleep, weightTrend, totalDays: allLogs.length, issues };
  })();

  return (
    <div>
      {/* Local stats card */}
      {localStats && (
        <>
          <div className="os-section-label" style={{ marginTop: 0 }}>Maand in cijfers</div>
          <div className="os-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Trainingsdagen', val: `${localStats.trainedDays}/${localStats.totalDays}`, color: 'var(--sage)' },
                { label: 'Gewichtstrend', val: localStats.weightTrend ? (parseFloat(localStats.weightTrend) <= 0 ? `${localStats.weightTrend} kg` : `+${localStats.weightTrend} kg`) : '—', color: parseFloat(localStats.weightTrend) < 0 ? 'var(--green)' : 'var(--rust)' },
                { label: 'PEM/crash-dagen', val: localStats.pemDays, color: localStats.pemDays > 2 ? 'var(--rust)' : 'var(--text)' },
                { label: 'Goed geslapen', val: `${localStats.goodSleep}d`, color: 'var(--text)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-serif)', color }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {localStats.issues.length > 0 && (
              <div style={{ borderTop: '1px solid var(--divide)', marginTop: 10, paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--ghost)', textTransform: 'uppercase',
                  letterSpacing: '0.5px', marginBottom: 6 }}>Aandachtspunten</div>
                {localStats.issues.map(issue => (
                  <div key={issue.label} style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: issue.color, fontWeight: 600 }}>● {issue.label}</span>
                    <span style={{ color: 'var(--sub)' }}>{issue.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* AI analysis */}
      {analysis ? (
        <>
          <ReportCard text={analysis} dateStr={analysisDate} label="Maandelijkse bottleneck-analyse" />
          <button
            className="os-btn-save"
            onClick={runMonthly}
            disabled={loading || !hasKey}
            style={{ marginBottom: 16, opacity: (!hasKey || loading) ? 0.5 : 1 }}>
            {loading ? 'Analyseren…' : 'Nieuwe analyse'}
          </button>
        </>
      ) : (
        <div className="os-card" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Bottleneck-analyse</div>
          <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.6, marginBottom: 16 }}>
            Wat remt jouw progressie het meest? De coach zoekt het grootste obstakel in de data.
          </div>
          <button
            className="os-btn-save"
            onClick={runMonthly}
            disabled={loading || !hasKey || logCount < 5}
            style={{ opacity: (!hasKey || logCount < 5) ? 0.5 : 1 }}>
            {loading ? 'Analyseren…' : 'Analyseer maand'}
          </button>
          {logCount < 5 && (
            <div style={{ fontSize: 11, color: 'var(--ghost)', marginTop: 8 }}>
              Log minimaal 5 dagen voor een maandanalyse.
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--alert-l, rgba(200,60,40,0.08))', border: '1px solid var(--rust)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--rust)', marginBottom: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

// ── Het kwartaal ────────────────────────────────────────────────
//
// Zij vroeg om een analyse waarin alles meetelt: slaap, HRV, cyclus,
// gewicht, hartslag, de toning van haar lichaam. Een cyclus duurt vier
// weken, dus in een maand zie je er één en daarmee geen patroon;
// loopeconomie beweegt in maanden en lichaamsverandering nog trager.
// Daarom dit venster.
//
// De opzet: het dossier staat er altijd, ook zonder AI. Dat is berekend
// en controleerbaar. De duiding erboven komt van het model, dat alleen
// over dat dossier mag redeneren en er geen getal aan mag toevoegen.
function TabKwartaal({ logs }) {
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const vandaag = todayLocal();

  const dossier = useMemo(() => {
    try { return kwartaalDossier({ currentDate: vandaag, logs }); }
    catch (e) { return { fout: e?.message || 'Het dossier kon niet worden opgebouwd.' }; }
  }, [logs, vandaag]);

  async function analyseer() {
    setBezig(true); setFout(null);
    try {
      const t = await ai.quarterReview(dossierAlsTekst(dossier),
        { context: contextAsText(buildCoachContext({ asOf: vandaag })) });
      setTekst(t);
    } catch (e) {
      setFout(e?.message || 'De analyse is niet gelukt.');
    } finally { setBezig(false); }
  }

  if (dossier?.fout) {
    return <div className="os-card" style={{ fontSize: 12 }}>{dossier.fout}</div>;
  }

  return (
    <div data-kwartaal={dossier.dagen}>
      <div className="os-card" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800 }}>
          Kwartaalanalyse · {dossier.van} t/m {dossier.tot}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.5, marginTop: 3 }}>
          Alles over negentig dagen naast elkaar: slaap, HRV, rusthartslag, cyclus,
          gewicht, maten, foto's, training en kracht. Het dossier hieronder is
          gerekend uit je eigen metingen en staat er ook zonder AI. De duiding
          erboven komt van het model, dat alleen over dit dossier mag redeneren
          en er geen getal aan mag toevoegen.
        </div>
        <button type="button" onClick={analyseer} disabled={bezig}
          data-kwartaal-knop
          style={{ marginTop: 8, padding: '7px 12px', borderRadius: 7,
            border: '1px solid var(--sage)', background: 'transparent',
            color: 'var(--sage)', fontSize: 12, fontWeight: 800,
            cursor: bezig ? 'default' : 'pointer', opacity: bezig ? 0.6 : 1 }}>
          {bezig ? 'Bezig met analyseren…' : 'Analyseer dit kwartaal'}
        </button>
        {fout && (
          <div style={{ fontSize: 11, color: 'var(--alert)', marginTop: 6,
            lineHeight: 1.5 }}>{fout}</div>
        )}
      </div>

      {tekst && (
        <div className="os-card" style={{ marginBottom: 10, whiteSpace: 'pre-wrap',
          fontSize: 12.5, lineHeight: 1.6 }} data-kwartaal-analyse>{tekst}</div>
      )}

      {/* Wat de app zelf hard kan maken — ook zonder model. */}
      {dossier.observaties?.length > 0 && (
        <div className="os-card" style={{ marginBottom: 10 }}
          data-kwartaal-observaties={dossier.observaties.length}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Wat uit de cijfers volgt</div>
          {dossier.observaties.map(o => (
            <div key={o.id} style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 5,
              paddingTop: 5, borderTop: '1px solid var(--border)',
              fontWeight: o.zwaar ? 700 : 400 }}>{o.tekst}</div>
          ))}
        </div>
      )}

      {dossier.gaten?.length > 0 && (
        <div className="os-card" style={{ marginBottom: 10,
          borderLeft: '3px solid var(--gold)' }} data-kwartaal-gaten={dossier.gaten.length}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>Waarover ik niets kan zeggen</div>
          {dossier.gaten.map((g, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5,
              marginTop: 4 }}>· {g}</div>
          ))}
        </div>
      )}

      <details className="os-card">
        <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Het dossier zelf
        </summary>
        <pre style={{ fontSize: 10.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
          marginTop: 8, color: 'var(--sub)' }}>{dossierAlsTekst(dossier)}</pre>
      </details>
    </div>
  );
}

export default function CoachScreen({ logs }) {
  const [activeTab, setActiveTab] = useState(0);
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    store.getMeasurements?.().then(m => setMeasurements(m || [])).catch(() => {});
  }, []);

  return (
    <div className="os-content">
      <SubTabs tabs={SUBTABS} active={activeTab} onChange={setActiveTab} />
      {/* §29: bij ieder belangrijk advies hoort te staan waarop het berust.
          Op het coachscherm staat het bovenaan, want daar wordt het advies
          gemaakt — niet eronder als voetnoot. */}
      {activeTab === 0 && <WhyPanel asOf={todayLocal()} compact />}
      {activeTab === 0 && <TabNu logs={logs} measurements={measurements} />}
      {activeTab === 1 && <TabWeekanalyse logs={logs} measurements={measurements} />}
      {activeTab === 2 && <TabMaand logs={logs} />}
      {activeTab === 3 && <TabKwartaal logs={logs} />}
    </div>
  );
}
