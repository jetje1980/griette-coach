import React, { useState, useEffect, useRef } from 'react';
import { store } from '../store';
import { getSession } from '../supabase';
import { pendingCount, forceSyncNow } from '../sync';
import { LogoutButton } from './AuthGate';
import Integrations from './Integrations';
import { loadWeekStart, saveWeekStart, WEEK_START_LABELS } from '../datetime';
import { runDayCeiling } from '../restday';
import { loadBuildThrough, saveBuildThrough } from '../strategy';
import { saveGoal } from '../goals';
import { todayLocal } from '../datetime';

const FOOD_PREF_KEY = 'gc_food_prefs';

const EXCLUDE_OPTIONS = [
  { key: 'bonen',      emoji: '🫘', label: 'Bonen' },
  { key: 'banaan',     emoji: '🍌', label: 'Banaan' },
  { key: 'ei_veel',   emoji: '🥚', label: '>2 eieren/dag' },
  { key: 'rood_vlees', emoji: '🥩', label: 'Rood vlees' },
  { key: 'vis',        emoji: '🐟', label: 'Vis' },
  { key: 'lactose',   emoji: '🥛', label: 'Lactose/zuivel' },
  { key: 'gluten',    emoji: '🌾', label: 'Gluten' },
  { key: 'noten',     emoji: '🥜', label: 'Noten' },
];

const PREFER_OPTIONS = [
  { key: 'smoothies',  emoji: '🥤', label: 'Smoothies' },
  { key: 'shakes',    emoji: '🧃', label: 'Eiwitshakes' },
  { key: 'soep',      emoji: '🍲', label: 'Soep' },
  { key: 'salades',   emoji: '🥗', label: 'Salades' },
  { key: 'kip',       emoji: '🍗', label: 'Kip' },
  { key: 'vis_zee',   emoji: '🐟', label: 'Vis/zeevruchten' },
  { key: 'pasta',     emoji: '🍝', label: 'Pasta' },
  { key: 'rijst_wok', emoji: '🍚', label: 'Rijst/wok' },
];

function loadPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOOD_PREF_KEY) || 'null');
    if (stored) return stored;
    // Eerste keer: bekende voorkeuren als startpunt
    const defaults = {
      excluded: ['bonen', 'banaan', 'ei_veel'],
      preferred: ['smoothies', 'shakes', 'soep', 'salades'],
      notes: '',
    };
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(defaults));
    return defaults;
  } catch { return {}; }
}

function DataPortability() {
  const [importStatus, setImportStatus] = useState(null);
  const fileRef = useRef(null);

  function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('gc_')) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); }
        catch { data[key] = localStorage.getItem(key); }
      }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `griette-coach-${todayLocal()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        let count = 0;
        Object.entries(data).forEach(([key, val]) => {
          if (typeof key === 'string' && key.startsWith('gc_')) {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            count++;
          }
        });
        setImportStatus({ ok: true, msg: `✓ ${count} items hersteld — herlaad de app om alles te zien` });
      } catch {
        setImportStatus({ ok: false, msg: 'Ongeldig bestand — selecteer een geldig backup-bestand' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div className="card-accent" style={{ background: '#0EA5E9' }} />
        <div className="card-title">📤 Data export / import</div>
      </div>
      <div className="card-body">
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
          Download alle daglogboek-data als JSON-bestand, of herstel vanuit een eerder backup-bestand.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sage" style={{ flex: 1 }} onClick={exportData}>
            📥 Download backup
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
            📂 Herstel backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        {importStatus && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: importStatus.ok ? 'var(--sage)' : 'var(--alert)' }}>
            {importStatus.msg}
          </div>
        )}
      </div>
    </div>
  );
}

function FoodPrefs() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [flash, setFlash] = useState(false);

  const excluded  = new Set(prefs.excluded  || []);
  const preferred = new Set(prefs.preferred || []);

  function save(updated) {
    setPrefs(updated);
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(updated));
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  }

  function toggleExclude(key) {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key); else next.add(key);
    save({ ...prefs, excluded: [...next] });
  }

  function togglePrefer(key) {
    const next = new Set(preferred);
    if (next.has(key)) next.delete(key); else next.add(key);
    save({ ...prefs, preferred: [...next] });
  }

  const chipStyle = (active, activeColor) => ({
    fontSize: 11, padding: '5px 10px', borderRadius: 99, border: '1.5px solid',
    background: active ? activeColor : 'var(--bg)',
    color: active ? 'white' : 'var(--muted)',
    borderColor: active ? activeColor : 'var(--border)',
    cursor: 'pointer', fontWeight: active ? 700 : 400,
  });

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--rust)' }} />
        <div className="card-title">🍽️ Voedingsvoorkuren</div>
        {flash && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>✓ opgeslagen</span>}
      </div>
      <div className="card-body">
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Tik aan wat je niet lekker vindt of graag meer wilt. De AI-coach en menu-checks passen zich hierop aan.
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--alert)', letterSpacing: 1, marginBottom: 7 }}>
          🚫 VERMIJDEN / NIET LEKKER
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {EXCLUDE_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => toggleExclude(opt.key)}
              style={chipStyle(excluded.has(opt.key), 'var(--alert)')}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: 1, marginBottom: 7 }}>
          ✅ GRAAG MEER VAN
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {PREFER_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => togglePrefer(opt.key)}
              style={chipStyle(preferred.has(opt.key), 'var(--sage)')}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>
          📝 EXTRA OPMERKINGEN
        </div>
        <textarea
          placeholder="Bijv. hou van Aziatisch, niet van scherp, etc."
          value={prefs.notes || ''}
          onChange={e => save({ ...prefs, notes: e.target.value })}
          style={{
            width: '100%', minHeight: 56, fontSize: 11, padding: '8px 10px',
            borderRadius: 8, border: '1.5px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', resize: 'vertical',
            fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

// Toont met welk account je bent ingelogd en waar de data staat.
function AccountInfo() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getSession().then(s => setEmail(s?.user?.email || '')).catch(() => {});
    setPending(pendingCount());
    const t = setInterval(() => setPending(pendingCount()), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.6 }}>
        Ingelogd als <strong>{email || '—'}</strong>.<br />
        Je gegevens staan in je eigen afgeschermde cloudopslag en zijn op elk
        toestel beschikbaar na inloggen.
      </div>
      {pending > 0 && (
        <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600, marginBottom: 8 }}>
          {pending} wijziging{pending > 1 ? 'en' : ''} wacht op synchronisatie
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="os-toggle-chip" style={{ fontSize: 12 }}
          onClick={() => forceSyncNow()}>Nu synchroniseren</button>
        <LogoutButton />
      </div>
    </div>
  );
}

export default function Settings({ onClose }) {
  const [aiEndpoint, setAiEndpointState] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [backupResult, setBackupResult] = useState(null);

  useEffect(() => {
    try { setAiEndpointState(localStorage.getItem('gc_ai_endpoint') || ''); } catch { /* geen storage */ }
  }, []);

  function saveKey() {
    // Hier stond een schrijfactie die een API-sleutel in sessionStorage zette.
    // Er is geen invoerveld meer voor die sleutel en ai.js leest hem nergens
    // — alle AI-verkeer loopt via een geauthenticeerde Edge Function. Wat
    // overbleef was dus alleen nog een plek waar een geheim terecht kón
    // komen. Weg.
    try {
      if (aiEndpoint.trim()) localStorage.setItem('gc_ai_endpoint', aiEndpoint.trim().replace(/\/$/, ''));
      else localStorage.removeItem('gc_ai_endpoint');
    } catch { /* geen storage */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testKey() {
    setTesting(true);
    setTestResult(null);
    try {
      // Test eerst de server-proxy (voorkeursroute — sleutel blijft server-side)
      const base = aiEndpoint.trim().replace(/\/$/, '');
      const r = await fetch(`${base}/api/ai/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 20,
          messages: [{ role: 'user', content: 'Zeg: OK' }],
        }),
      });
      if (r.ok) {
        setTestResult({ ok: true, msg: 'AI-server werkt ✓ (sleutel blijft server-side)' });
      } else if (r.status === 503) {
        setTestResult({ ok: false, msg: 'Server bereikbaar maar ANTHROPIC_API_KEY ontbreekt in backend .env' });
      } else {
        setTestResult({ ok: false, msg: `AI-server niet beschikbaar (${r.status}).` });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: 'AI-server niet bereikbaar.' });
    } finally {
      setTesting(false);
    }
  }

  async function doBackup() {
    const result = await store.backup();
    if (result?.path) setBackupResult(`✓ Opgeslagen: ${result.path}`);
    else setBackupResult('Backup werkt alleen via Mac (npm run dev)');
  }

  function resetOnboarding() {
    localStorage.removeItem('gc_onboarding_done');
    window.location.reload();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.5)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card)', borderRadius: '20px 20px 0 0',
        padding: '22px 18px 40px', width: '100%', maxWidth: 480,
        maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>⚙️ Instellingen</div>
          <button onClick={onClose} style={{ background: 'var(--border)', border: 'none', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* AI — sleutel staat server-side */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--rust)' }} />
            <div className="card-title">🤖 AI-coach</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              De AI-analyses lopen via een beveiligde serverfunctie. De API-sleutel
              staat uitsluitend server-side en komt nooit in je browser. Je hoeft
              hier niets in te vullen.
            </div>
          </div>
        </div>

        {/* Backup */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">💾 Backup coach.db</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              Kopieert coach.db naar ~/Documents/coach-backups/ (alleen via Mac).
            </div>
            <button className="btn btn-sage btn-full" onClick={doBackup}>
              📦 Maak backup
            </button>
            {backupResult && <div className="saved-note" style={{ marginTop: 6 }}>{backupResult}</div>}
          </div>
        </div>

        {/* Vrijgeven van looptrainingen */}
        <RunReleaseSettings />

        {/* Integraties */}
        <Integrations />

        {/* Data export / import */}
        <DataPortability />

        {/* Voedingsvoorkuren */}
        <FoodPrefs />

        {/* Account */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">👤 Account</div>
          </div>
          <div className="card-body">
            <AccountInfo />
          </div>
        </div>

        {/* Reset */}
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--muted)' }} />
            <div className="card-title">🔄 Overig</div>
          </div>
          <div className="card-body">
            <button
              className="btn btn-full"
              style={{ background: 'var(--border)', color: 'var(--text)', marginBottom: 8 }}
              onClick={resetOnboarding}
            >
              Toon welkomstscherm opnieuw
            </button>
            <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
              Versie 2.0 · feature/coach-app
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wanneer geeft de coach een looptraining vrij? ───────────────
//
// Twee instellingen die samen bepalen wanneer er een run vrijkomt, en die
// eerder niet te zien of te wijzigen waren:
//
//   weekstart     de dag waarop jouw week begint. De app nam maandag aan;
//                 zij begint op zondag, en dus stond de teller "loopdagen
//                 deze week" op haar eerste trainingsdag al vol.
//   weekplafond   hoeveel loopdagen per week maximaal.
//
// Het plafond geldt per kalenderweek vanaf de weekstart. Het rollende
// venster van zeven dagen blijft bestaan voor belasting — je lichaam weet
// niet dat het zondag is — maar het bepaalt niet meer of je mag lopen.
function RunReleaseSettings() {
  const [weekStart, setWeekStart] = useState(() => loadWeekStart());
  const [ceiling, setCeiling] = useState(() => String(runDayCeiling()));
  const [bouwTot, setBouwTot] = useState(() => loadBuildThrough());
  const [melding, setMelding] = useState('');

  function zetBouwTot(datum) {
    const opgeslagen = saveBuildThrough(datum);
    setBouwTot(opgeslagen);
    setMelding(opgeslagen
      ? `De coach bouwt door tot en met ${opgeslagen} en begint daarna met taperen.`
      : 'De coach bepaalt zelf wanneer de taper begint.');
  }

  function kiesDag(dow) {
    saveWeekStart(dow);
    setWeekStart(dow);
    setMelding(`Je week begint nu op ${WEEK_START_LABELS[dow]}. De teller loopdagen start op die dag.`);
  }

  function bewaarPlafond(v) {
    const n = parseInt(v, 10);
    setCeiling(v);
    if (!Number.isInteger(n) || n < 1 || n > 6) return;
    saveGoal({ domain: 'RUN', metric: 'run_days_week', target_value: String(n),
      direction: 'at_most' });
    setMelding(`Weekplafond staat op ${n} loopdagen.`);
  }

  return (
    <div className="card" style={{ marginBottom: 12 }} data-run-release>
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--gold)' }} />
        <div className="card-title">🏃 Vrijgeven van looptrainingen</div>
      </div>
      <div className="card-body">
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
          Het weekplafond geldt per week vanaf de dag die je hier kiest. Daarnaast
          blijft er altijd minstens één volle rustdag tussen twee runs, en blijft
          een openstaande herstelcheck een run tegenhouden — dat zijn
          herstelregels, geen weekregels.
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
          Mijn week begint op
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
          {WEEK_START_LABELS.map((label, dow) => (
            <button key={dow} type="button" data-weekstart={dow}
              onClick={() => kiesDag(dow)}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 99, cursor: 'pointer',
                border: `1px solid ${weekStart === dow ? 'var(--sage)' : 'var(--border)'}`,
                background: weekStart === dow ? 'var(--sage)' : 'transparent',
                color: weekStart === dow ? '#fff' : 'var(--sub)',
                fontWeight: weekStart === dow ? 700 : 500 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>
          Maximaal aantal loopdagen per week
        </div>
        <input type="number" min="1" max="6" value={ceiling} data-weekplafond
          onChange={e => bewaarPlafond(e.target.value)}
          style={{ width: 70, fontSize: 13, padding: '5px 8px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text)' }} />

        {/* ── Doorbouwen tot en met ──────────────────────────────
            De taper hing alleen aan de kalender: stond er een race binnen
            de taperperiode, dan bouwde de app niet meer op — ook als dat
            een stretchdoel was dat per definitie mag schuiven. Hier kan zij
            zeggen tot wanneer ze doorbouwt. De coach blijft wel melden wat
            hij zou adviseren. */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
            Doorbouwen tot en met
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5,
            marginBottom: 6 }}>
            Tot en met deze dag blijft de coach afstand opbouwen en begint hij niet
            met taperen, ook niet als er een race nadert. Laat het leeg om de coach
            zelf te laten kiezen.
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={bouwTot || ''} data-bouwtot
              onChange={e => zetBouwTot(e.target.value || null)}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)' }} />
            <button type="button" data-bouwtot-zondag onClick={() => zetBouwTot(komendeZondag())}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 99,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--sub)', cursor: 'pointer' }}>
              t/m komende zondag
            </button>
            {bouwTot && (
              <button type="button" data-bouwtot-wis onClick={() => zetBouwTot(null)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 99,
                  border: 'none', background: 'none', color: 'var(--ghost)',
                  cursor: 'pointer' }}>
                wissen
              </button>
            )}
          </div>
        </div>

        {melding && <div className="saved-note" style={{ marginTop: 8 }}>{melding}</div>}
      </div>
    </div>
  );
}

// De eerstvolgende zondag, of vandaag als het al zondag is. Haar week begint
// op zondag, dus "tot en met komende zondag" is de natuurlijke eenheid.
function komendeZondag() {
  const vandaag = todayLocal();
  const d = new Date(`${vandaag}T12:00:00`);
  const naar = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + naar);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
