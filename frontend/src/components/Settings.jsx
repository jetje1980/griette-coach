import React, { useState } from 'react';
import { store } from '../store';
import { supabase } from '../supabaseClient';

const FOOD_PREF_KEY = 'gc_food_prefs';

const EXCLUDE_OPTIONS = [
  { key: 'bonen', emoji: '🫘', label: 'Bonen' },
  { key: 'banaan', emoji: '🍌', label: 'Banaan' },
  { key: 'ei_veel', emoji: '🥚', label: '>2 eieren/dag' },
  { key: 'rood_vlees', emoji: '🥩', label: 'Rood vlees' },
  { key: 'vis', emoji: '🐟', label: 'Vis' },
  { key: 'lactose', emoji: '🥛', label: 'Lactose/zuivel' },
  { key: 'gluten', emoji: '🌾', label: 'Gluten' },
  { key: 'noten', emoji: '🥜', label: 'Noten' },
];

const PREFER_OPTIONS = [
  { key: 'smoothies', emoji: '🥤', label: 'Smoothies' },
  { key: 'shakes', emoji: '🧃', label: 'Eiwitshakes' },
  { key: 'soep', emoji: '🍲', label: 'Soep' },
  { key: 'salades', emoji: '🥗', label: 'Salades' },
  { key: 'kip', emoji: '🍗', label: 'Kip' },
  { key: 'vis_zee', emoji: '🐟', label: 'Vis/zeevruchten' },
  { key: 'pasta', emoji: '🍝', label: 'Pasta' },
  { key: 'rijst_wok', emoji: '🍚', label: 'Rijst/wok' },
];

function loadPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOOD_PREF_KEY) || 'null');
    if (stored) return stored;
    const defaults = {
      excluded: ['bonen', 'banaan', 'ei_veel'],
      preferred: ['smoothies', 'shakes', 'soep', 'salades'],
      notes: '',
    };
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(defaults));
    return defaults;
  } catch { return {}; }
}

function FoodPrefs() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [flash, setFlash] = useState(false);
  const excluded = new Set(prefs.excluded || []);
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
        <div className="card-title">🍽️ Voedingsvoorkeuren</div>
        {flash && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>✓ opgeslagen</span>}
      </div>
      <div className="card-body">
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          De AI-coach gebruikt deze voorkeuren bij voedings- en menu-advies.
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--alert)', letterSpacing: 1, marginBottom: 7 }}>🚫 VERMIJDEN / NIET LEKKER</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {EXCLUDE_OPTIONS.map(opt => <button key={opt.key} onClick={() => toggleExclude(opt.key)} style={chipStyle(excluded.has(opt.key), 'var(--alert)')}>{opt.emoji} {opt.label}</button>)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: 1, marginBottom: 7 }}>✅ GRAAG MEER VAN</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {PREFER_OPTIONS.map(opt => <button key={opt.key} onClick={() => togglePrefer(opt.key)} style={chipStyle(preferred.has(opt.key), 'var(--sage)')}>{opt.emoji} {opt.label}</button>)}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: 1, marginBottom: 6 }}>📝 EXTRA OPMERKINGEN</div>
        <textarea
          placeholder="Bijv. hou van Aziatisch, niet van scherp, etc."
          value={prefs.notes || ''}
          onChange={e => save({ ...prefs, notes: e.target.value })}
          style={{ width: '100%', minHeight: 56, fontSize: 11, padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}

export default function Settings({ onClose }) {
  const [backupResult, setBackupResult] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  async function doBackup() {
    const result = await store.backup();
    if (result?.path) setBackupResult(`✓ Opgeslagen: ${result.path}`);
    else setBackupResult('Backup werkt alleen via Mac (npm run dev)');
  }

  function resetOnboarding() {
    localStorage.removeItem('gc_onboarding_done');
    window.location.reload();
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '22px 18px 40px', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>⚙️ Instellingen</div>
          <button onClick={onClose} style={{ background: 'var(--border)', border: 'none', borderRadius: 99, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">🔒 Privacy & AI</div>
          </div>
          <div className="card-body" style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.65 }}>
            Je coachdata en progressiefoto’s zijn alleen toegankelijk na inloggen. AI-aanvragen lopen via de beveiligde Supabase-server; er staat geen Anthropic API-sleutel meer in deze browser.
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--sage)' }} />
            <div className="card-title">💾 Backup coach.db</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Kopieert coach.db naar ~/Documents/coach-backups/ (alleen via Mac).</div>
            <button className="btn btn-sage btn-full" onClick={doBackup}>📦 Maak backup</button>
            {backupResult && <div className="saved-note" style={{ marginTop: 6 }}>{backupResult}</div>}
          </div>
        </div>

        <FoodPrefs />

        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: 'var(--muted)' }} />
            <div className="card-title">🔄 Overig</div>
          </div>
          <div className="card-body">
            <button className="btn btn-full" style={{ background: 'var(--border)', color: 'var(--text)', marginBottom: 8 }} onClick={resetOnboarding}>Toon welkomstscherm opnieuw</button>
            <button className="btn btn-full" style={{ background: '#FEF2F2', color: '#B91C1C', marginBottom: 10 }} onClick={signOut} disabled={signingOut}>{signingOut ? 'Uitloggen…' : '🔒 Uitloggen'}</button>
            <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>Versie 2.1 · beveiligde coach</div>
          </div>
        </div>
      </div>
    </div>
  );
}
