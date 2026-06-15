import React, { useState } from 'react';
import { TIPS } from '../data/tips';
import { DAILY_MENUS, VITAMINS_GUIDE } from '../data/dailyMenus';

function cyclePhaseFromDay(cycleDay) {
  if (!cycleDay) return null;
  if (cycleDay <= 5)  return 'menstruatie';
  if (cycleDay <= 13) return 'folliculair';
  if (cycleDay <= 16) return 'folliculair';
  if (cycleDay <= 28) return 'luteaal';
  return null;
}

const EXCLUDE_OPTIONS = [
  { key: 'bonen',      emoji: '🫘', label: 'Bonen' },
  { key: 'banaan',     emoji: '🍌', label: 'Banaan' },
  { key: 'ei_veel',   emoji: '🥚', label: '>2 eieren/dag' },
  { key: 'rood_vlees', emoji: '🥩', label: 'Rood vlees' },
  { key: 'vis',        emoji: '🐟', label: 'Vis' },
  { key: 'lactose',   emoji: '🥛', label: 'Lactose' },
  { key: 'gluten',    emoji: '🌾', label: 'Gluten' },
  { key: 'noten',     emoji: '🥜', label: 'Noten' },
];
const PREFER_OPTIONS = [
  { key: 'smoothies',  emoji: '🥤', label: 'Smoothies' },
  { key: 'shakes',    emoji: '🧃', label: 'Shakes' },
  { key: 'soep',      emoji: '🍲', label: 'Soep' },
  { key: 'salades',   emoji: '🥗', label: 'Salades' },
  { key: 'kip',       emoji: '🍗', label: 'Kip' },
  { key: 'vis_zee',   emoji: '🐟', label: 'Vis/zee' },
  { key: 'pasta',     emoji: '🍝', label: 'Pasta' },
  { key: 'rijst_wok', emoji: '🍚', label: 'Rijst/wok' },
];
const EXCLUDE_KEYWORDS = {
  bonen:      ['bonen', 'kikkererwten', 'edamame', 'linzen'],
  banaan:     ['banaan'],
  ei_veel:    ['3 eieren', '3-eieren', 'scrambled eggs (3)', 'omelet (3'],
  rood_vlees: ['biefstuk', 'rund', 'gehakt'],
  vis:        ['zalm', 'tonijn', 'makreel', 'haring', 'garnalen', 'ansjovis'],
  lactose:    ['room', 'kaas', 'yoghurt', 'kwark'],
  gluten:     ['pasta', 'brood', 'toast', 'naan'],
  noten:      ['noten', 'amandelen', 'walnoten', 'cashews', 'pindaboter', 'amandelboter'],
};
const EXCLUDE_LABELS = {
  bonen: 'bonen', banaan: 'banaan', ei_veel: 'veel eieren',
  rood_vlees: 'rood vlees', vis: 'vis', lactose: 'lactose', gluten: 'gluten', noten: 'noten',
};
const FOOD_PREF_KEY = 'gc_food_prefs';

function loadFoodPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(FOOD_PREF_KEY) || 'null');
    if (stored) return stored;
    const defaults = { excluded: ['bonen', 'banaan', 'ei_veel'], preferred: ['smoothies', 'shakes', 'soep', 'salades'], notes: '' };
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(defaults));
    return defaults;
  } catch { return { excluded: [], preferred: [], notes: '' }; }
}

export default function Eten({ tip, dayNum, log }) {
  const [showAllTips, setShowAllTips] = useState(false);
  const [vitaminTab, setVitaminTab] = useState('altijd');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [foodPrefs, setFoodPrefs] = useState(loadFoodPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const menu = DAILY_MENUS[(dayNum - 1) % DAILY_MENUS.length];

  const excluded  = new Set(foodPrefs.excluded  || []);
  const preferred = new Set(foodPrefs.preferred || []);

  function savePrefs(updated) {
    setFoodPrefs(updated);
    localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(updated));
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 1200);
  }
  function toggleExclude(key) {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key); else next.add(key);
    savePrefs({ ...foodPrefs, excluded: [...next] });
  }
  function togglePrefer(key) {
    const next = new Set(preferred);
    if (next.has(key)) next.delete(key); else next.add(key);
    savePrefs({ ...foodPrefs, preferred: [...next] });
  }

  const menuText = menu ? [menu.ontbijt, menu.lunch, menu.avond, menu.snack].join(' ').toLowerCase() : '';
  const menuWarnings = [...excluded].filter(key =>
    (EXCLUDE_KEYWORDS[key] || [key]).some(kw => menuText.includes(kw.toLowerCase()))
  ).map(key => EXCLUDE_LABELS[key] || key);

  const cycleStart = localStorage.getItem('gc_cycle_start');
  const cycleDay   = cycleStart ? Math.floor((new Date() - new Date(cycleStart)) / 86400000) + 1 : null;
  const cyclePhase = cyclePhaseFromDay(cycleDay);

  const VITAMIN_TABS = [
    { key: 'altijd',      label: 'Altijd',      emoji: '💊' },
    { key: 'menstruatie', label: 'Menstruatie',  emoji: '🩸' },
    { key: 'folliculair', label: 'Folliculair',  emoji: '🌱' },
    { key: 'luteaal',     label: 'Luteaal',      emoji: '🌙' },
    { key: 'naSport',     label: 'Na sport',     emoji: '🏃' },
  ];
  const vitaminData = VITAMINS_GUIDE[vitaminTab] || [];

  const chipStyle = (active, color) => ({
    fontSize: 11, padding: '4px 9px', borderRadius: 99, border: '1.5px solid',
    background: active ? color : 'var(--bg)',
    color: active ? 'white' : 'var(--muted)',
    borderColor: active ? color : 'var(--border)',
    cursor: 'pointer', fontWeight: active ? 700 : 400,
  });

  return (
    <div className="pane">

      {/* ── Voedingsvoorkuren inline ── */}
      <div className="card">
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setPrefsOpen(v => !v)}>
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">🚫 Mijn voedingsvoorkuren</div>
          {prefsSaved && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>✓ opgeslagen</span>}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{prefsOpen ? '▲' : '▼'}</span>
        </div>

        {/* Compacte samenvatting — altijd zichtbaar */}
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {excluded.size === 0 && preferred.size === 0 ? (
            <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
              Geen voorkeuren ingesteld — tik ▼ om in te stellen
            </span>
          ) : (
            <>
              {[...excluded].map(key => {
                const opt = EXCLUDE_OPTIONS.find(o => o.key === key);
                return opt ? (
                  <span key={key} style={{ fontSize: 10, background: 'var(--alert)', color: 'white', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>
                    🚫 {opt.emoji} {opt.label}
                  </span>
                ) : null;
              })}
              {[...preferred].map(key => {
                const opt = PREFER_OPTIONS.find(o => o.key === key);
                return opt ? (
                  <span key={key} style={{ fontSize: 10, background: 'var(--sage)', color: 'white', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>
                    ✅ {opt.emoji} {opt.label}
                  </span>
                ) : null;
              })}
            </>
          )}
        </div>

        {/* Uitklapbaar bewerkpaneel */}
        {prefsOpen && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--alert)', letterSpacing: 1, marginBottom: 6 }}>
              🚫 VERMIJDEN / NIET LEKKER
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {EXCLUDE_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => toggleExclude(opt.key)}
                  style={chipStyle(excluded.has(opt.key), 'var(--alert)')}>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', letterSpacing: 1, marginBottom: 6 }}>
              ✅ GRAAG MEER VAN
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {PREFER_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => togglePrefer(opt.key)}
                  style={chipStyle(preferred.has(opt.key), 'var(--sage)')}>
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Wijzigingen worden direct opgeslagen en meegenomen door de AI-coach.
            </div>
          </div>
        )}
      </div>

      {/* ── Dagmenu ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">🍽️ Dagmenu — dag {dayNum}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            menu {((dayNum - 1) % DAILY_MENUS.length) + 1}/35
          </div>
        </div>
        <div className="card-body">
          {menu && (
            <>
              {menuWarnings.length > 0 && (
                <div style={{ fontSize: 10, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '6px 10px', marginBottom: 10, lineHeight: 1.5 }}>
                  ⚠️ Dit menu bevat: <strong>{menuWarnings.join(', ')}</strong> — pas het gerecht aan of sla het over
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1, marginBottom: 10 }}>
                ✨ {menu.focus}
              </div>
              {[
                { label: 'ONTBIJT', emoji: '🌅', text: menu.ontbijt },
                { label: 'LUNCH',   emoji: '🥗', text: menu.lunch   },
                { label: 'AVOND',   emoji: '🍝', text: menu.avond   },
                { label: 'SNACK',   emoji: '🥜', text: menu.snack   },
              ].map(({ label, emoji, text }) => text && (
                <div key={label} style={{
                  background: 'linear-gradient(135deg, #FBF8F2, #F4EFE5)',
                  border: '1px solid var(--border)',
                  borderRadius: 11, padding: '10px 12px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--rust)', letterSpacing: 1, marginBottom: 3 }}>
                    {emoji} {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{text}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Mounjaro eetregels ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">💊 Mounjaro & eten</div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text)' }}>
            <div>• <strong>Eiwit eerst</strong> op je bord — daarna groenten, dan koolhydraten</div>
            <div>• Eet <strong>langzaam</strong> — zet je vork neer tussen happen</div>
            <div>• Stop bij <strong>eerste verzadiging</strong> — je bent sneller vol</div>
            <div>• <strong>Kleine porties</strong> (3–5× per dag) werkt beter dan 2 grote</div>
            <div>• Drink niet veel vlak <strong>voor of ná</strong> het eten</div>
            <div>• Doel: <strong>≥100g eiwit/dag</strong> (beschermt spiermassa bij afvallen)</div>
          </div>
        </div>
      </div>

      {/* ── Vitamines & mineralen ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#8B5CF6' }} />
          <div className="card-title">🔬 Vitamines & mineralen</div>
          {cyclePhase && (
            <span style={{ fontSize: 10, background: '#F3E8FF', color: '#7C3AED', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>
              {cyclePhase === 'menstruatie' ? '🩸' : cyclePhase === 'folliculair' ? '🌱' : '🌙'} dag {cycleDay}
            </span>
          )}
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {VITAMIN_TABS.map(t => (
              <button key={t.key} onClick={() => setVitaminTab(t.key)} style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 99, border: '1.5px solid',
                fontWeight: vitaminTab === t.key ? 700 : 400,
                background: vitaminTab === t.key ? '#8B5CF6' : 'var(--bg)',
                color: vitaminTab === t.key ? 'white' : 'var(--muted)',
                borderColor: vitaminTab === t.key ? '#8B5CF6' : 'var(--border)',
                cursor: 'pointer',
              }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          {cyclePhase && vitaminTab === 'altijd' && (
            <div style={{ fontSize: 10, color: '#7C3AED', background: '#F3E8FF', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
              💡 Waarschijnlijk <strong>{cyclePhase}fase</strong> — tik die tab voor fase-specifieke aanvullingen.
            </div>
          )}
          {vitaminData.map((v, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{v.naam}</div>
                <div style={{ fontSize: 10, color: '#8B5CF6', fontWeight: 600 }}>{v.dosis}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{v.waarom}</div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4 }}>
                <span style={{ color: 'var(--sage)', fontWeight: 700 }}>🥗 </span>{v.voeding}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Voedingstip ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💡 Voedingstip — dag {dayNum}</div>
        </div>
        <div className="card-body">
          <div className="tip-box">{tip}</div>
        </div>
      </div>

      {/* ── Alle tips inklapbaar ── */}
      <div className="card">
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowAllTips(v => !v)}>
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">📚 Alle 70 voedingstips</div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{showAllTips ? '▲' : '▼'}</span>
        </div>
        {showAllTips && (
          <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {TIPS.map((t, i) => (
              <div key={i} style={{
                padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 11, lineHeight: 1.5,
                color: i === (dayNum - 1) % TIPS.length ? 'var(--rust)' : 'var(--text)',
                fontWeight: i === (dayNum - 1) % TIPS.length ? 600 : 400,
              }}>
                <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginRight: 6, fontSize: 10 }}>{i + 1}.</span>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
