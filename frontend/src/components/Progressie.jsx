import React, { useState, useEffect } from 'react';
import { photoStore } from '../photoStore';
import { store } from '../store';
import { USER } from '../config';

const PHOTO_TYPES = [
  { key: 'voor',   label: 'Voorkant' },
  { key: 'zij',    label: 'Zijkant'  },
  { key: 'achter', label: 'Achterkant' },
];

const CYCLE_LABEL = {
  menstruatie: '🔴 Menstruatie',
  folliculair: '🌱 Folliculair',
  ovulatie:    '✨ Ovulatie',
  luteaal:     '🌙 Luteaal',
  'weet-niet': '❓ Onbekend',
};

const SYMPTOM_LABELS = {
  symptom_brainfog:   '🌫️ Hersenmist',
  symptom_exhaustion: '🪫 Moeheid',
  symptom_breathless: '💨 Kortademig',
  symptom_pain:       '🦴 Pijn',
  symptom_headache:   '🤕 Hoofdpijn',
  symptom_hayfever:   '🌿 Hooikoorts',
  symptom_overdrive:  '🔴🧠 Overdrive',
  symptom_pem:        '⚡🛑 PEM',
};

function dayNum(date) {
  return Math.max(1, Math.floor((new Date(date) - new Date(USER.startDate)) / 86400000) + 1);
}

function WeightGraph({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) return null;

  const START_DATE    = '2026-05-27';
  const VACATION_DATE = '2026-07-27';
  const GOAL          = 55;

  const startMs   = new Date(START_DATE).getTime();
  const endMs     = new Date(VACATION_DATE).getTime();
  const totalDays = (endMs - startMs) / 86400000;

  const weights  = entries.map(e => e.weight);
  const maxW     = Math.max(...weights, 65);
  const minW     = Math.min(GOAL - 1, ...weights);
  const rangeW   = maxW - minW;

  const W = 300, H = 80;
  const PL = 10, PR = 10, PT = 12, PB = 8;
  const cW = W - PL - PR, cH = H - PT - PB;

  const xFor = (date) => PL + (Math.max(0, (new Date(date).getTime() - startMs) / 86400000) / totalDays) * cW;
  const yFor = (w)    => PT + (1 - (w - minW) / rangeW) * cH;

  const points   = entries.map(e => ({ x: xFor(e.date), y: yFor(e.weight), w: e.weight }));
  const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const goalY    = yFor(GOAL);
  const todayX   = Math.min(xFor(new Date().toISOString().slice(0, 10)), W - PR);
  const vacX     = xFor(VACATION_DATE);
  const last     = points[points.length - 1];

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>📈 Gewichtsverloop t/m vakantie</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }}>
        {/* Doel lijn */}
        <line x1={PL} y1={goalY} x2={W - PR} y2={goalY} stroke="var(--sage)" strokeWidth="1" strokeDasharray="4,3" />
        <text x={W - PR - 1} y={goalY - 2} fontSize="7" fill="var(--sage)" textAnchor="end">55 kg</text>
        {/* Vakantie marker */}
        <line x1={vacX} y1={PT} x2={vacX} y2={H - PB} stroke="var(--gold)" strokeWidth="1" strokeDasharray="3,3" />
        <text x={vacX + 2} y={PT + 7} fontSize="7" fill="var(--gold)">🏖️</text>
        {/* Vandaag marker */}
        {todayX < vacX - 5 && (
          <line x1={todayX} y1={PT} x2={todayX} y2={H - PB} stroke="var(--rust)" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.6" />
        )}
        {/* Gewichtslijn */}
        <polyline points={polyline} fill="none" stroke="var(--rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Punten */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--rust)" />
        ))}
        {/* Laatste gewicht label */}
        {last && (
          <text x={last.x} y={last.y - 5} fontSize="8" fill="var(--rust)" textAnchor="middle" fontWeight="bold">{last.w}</text>
        )}
      </svg>
    </div>
  );
}

function WeightProgress({ logs }) {
  const entries = Object.values(logs)
    .filter(l => l.weight)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return null;

  const current = entries[entries.length - 1].weight;
  const start   = USER.startWeight;
  const goal    = USER.goalWeight;
  const diff    = +(start - current).toFixed(1);
  const gained  = diff < 0;
  const toGo    = +(current - goal).toFixed(1);
  const pct     = Math.min(100, Math.max(0, ((start - current) / (start - goal)) * 100));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: 'var(--rust)' }} />
        <div className="card-title">⚖️ Gewichtprogressie</div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Start</div>
            <div style={{ fontWeight: 700 }}>{start} kg</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Nu</div>
            <div style={{ fontWeight: 700, color: 'var(--rust)', fontSize: 15 }}>{current} kg</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Doel</div>
            <div style={{ fontWeight: 700 }}>{goal} kg</div>
          </div>
        </div>
        <WeightGraph logs={logs} />
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: gained ? 'var(--alert)' : 'var(--rust)', borderRadius: 99, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          {gained
            ? <span style={{ color: 'var(--alert)', fontWeight: 700 }}>+{Math.abs(diff)} kg aangekomen</span>
            : <span style={{ color: 'var(--sage)', fontWeight: 700 }}>−{diff} kg afgevallen</span>
          }
          <span style={{ color: 'var(--muted)' }}>nog {toGo} kg te gaan</span>
          <span style={{ color: 'var(--muted)' }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function WhrProgress({ measurements }) {
  const entries = (measurements || [])
    .filter(m => m.waist && m.hip)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!entries.length) return null;

  const whr = e => +(e.waist / e.hip).toFixed(3);
  const latest = entries[entries.length - 1];
  const first  = entries[0];
  const latestWhr = whr(latest);
  const trend = entries.length > 1 ? +(latestWhr - whr(first)).toFixed(3) : null;
  const color = latestWhr < 0.80 ? 'var(--sage)' : latestWhr < 0.85 ? 'var(--gold)' : 'var(--rust)';
  const label = latestWhr < 0.80 ? 'Ideaal' : latestWhr < 0.85 ? 'Goed' : 'Aandacht';

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: color }} />
        <div className="card-title">📐 Taille-heup ratio (WHR)</div>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '22', padding: '2px 8px', borderRadius: 99 }}>
          {label}
        </span>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Taille</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{latest.waist} cm</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>÷</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Heup</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{latest.hip} cm</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>=</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>WHR</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{latestWhr}</div>
          </div>
        </div>

        {/* Reference bar */}
        <div style={{ position: 'relative', height: 10, background: 'var(--border)', borderRadius: 99, marginBottom: 6, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, width: '80%', height: '100%', background: 'var(--sage)', opacity: 0.3, borderRadius: '99px 0 0 99px' }} />
          <div style={{ position: 'absolute', left: '80%', width: '5%', height: '100%', background: 'var(--gold)', opacity: 0.4 }} />
          <div style={{ position: 'absolute', left: '85%', right: 0, height: '100%', background: 'var(--rust)', opacity: 0.3 }} />
          <div style={{
            position: 'absolute', top: 0, width: 3, height: '100%', background: color, borderRadius: 99,
            left: `${Math.min(98, Math.max(2, (latestWhr - 0.7) / (1.0 - 0.7) * 100))}%`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)', marginBottom: 8 }}>
          <span>0.70 ideaal</span><span>0.80</span><span>0.85</span><span>0.90+</span>
        </div>

        {trend !== null && (
          <div style={{ fontSize: 11, color: trend < 0 ? 'var(--sage)' : trend > 0 ? 'var(--alert)' : 'var(--muted)', fontWeight: 600 }}>
            {trend < 0 ? `↓ ${Math.abs(trend)} verbeterd` : trend > 0 ? `↑ +${trend} gestegen` : '→ gelijk gebleven'} t.o.v. eerste meting ({first.date})
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
          WHR daalt sneller zichtbaar dan het weegschaalgewicht — abdominaal vet neemt af door zone B training + eiwitten.
        </div>
      </div>
    </div>
  );
}

function MeasurementRow({ meas, label }) {
  if (!meas) return null;
  const fields = [
    ['Taille', meas.waist],
    ['Heup',   meas.hip],
    ['Borst',  meas.chest],
    ['Arm',    meas.arm],
    ['Dij',    meas.thigh],
  ].filter(([, v]) => v != null);
  if (!fields.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
        📏 Maten{label ? ` (${label})` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {fields.map(([name, val]) => (
          <span key={name} style={{ fontSize: 11 }}>
            <span style={{ color: 'var(--muted)' }}>{name} </span>
            <strong>{val} cm</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Gedrag → Gevolg ─────────────────────────────────────────────────────────

function computeInsights(logs) {
  const allEntries = Object.values(logs).filter(e => e.date);
  const byDate = {};
  allEntries.forEach(e => { byDate[e.date] = e; });

  function nextDay(d) {
    const dt = new Date(d); dt.setDate(dt.getDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }

  const MIN = 1;
  const results = [];

  function tryInsight({ emoji, title, A, B, labelA, labelB, color }) {
    if (A.length < MIN || B.length < MIN) return;
    const aAvg = avg(A), bAvg = avg(B);
    if (aAvg == null || bAvg == null || Math.abs(aAvg - bAvg) < 0.1) return;
    const winner = aAvg >= bAvg ? labelA : labelB;
    const diff   = Math.abs(aAvg - bAvg).toFixed(1);
    const earlySignal = (A.length + B.length) < 6;
    results.push({
      emoji, title, color, earlySignal,
      lines: [
        `${labelA}: gem. ${aAvg.toFixed(1)}/3 energie (${A.length}×)`,
        `${labelB}: gem. ${bAvg.toFixed(1)}/3 energie (${B.length}×)`,
      ],
      verdict: `${winner} → +${diff} punt energie`,
      warn: aAvg < bAvg,
      n: A.length + B.length,
    });
  }

  // 1. Slaap → Energie dag erna
  const sleepG = [], sleepB = [];
  allEntries.forEach(e => {
    if (e.sleep_hours == null) return;
    const nx = byDate[nextDay(e.date)];
    if (!nx || nx.energy == null) return;
    (e.sleep_hours >= 7 ? sleepG : sleepB).push(nx.energy);
  });
  tryInsight({ emoji: '😴', title: 'Slaap & energie (dag erna)', A: sleepG, B: sleepB, labelA: '≥7u slaap', labelB: '<7u slaap', color: '#6366F1' });

  // 2. Training → Energie dag erna
  const trainY = [], trainN = [];
  allEntries.forEach(e => {
    const nx = byDate[nextDay(e.date)];
    if (!nx || nx.energy == null) return;
    const did = !!(e.run_done || e.swim_done || e.bike_done || e.core_done);
    (did ? trainY : trainN).push(nx.energy);
  });
  tryInsight({ emoji: '🏃', title: 'Training & energie (dag erna)', A: trainY, B: trainN, labelA: 'na trainingsdag', labelB: 'na rustdag', color: 'var(--sage)' });

  // 3. Eiwit → Energie zelfde dag
  const prY = [], prN = [];
  allEntries.forEach(e => {
    if (e.energy == null) return;
    const hit = !!(e.protein || e.protein_day);
    if (hit) prY.push(e.energy);
    else if (e.protein === 0 || e.protein_day === 0) prN.push(e.energy);
  });
  tryInsight({ emoji: '🥩', title: 'Eiwit & energie', A: prY, B: prN, labelA: 'eiwitdoel ✓', labelB: 'eiwitdoel ✗', color: 'var(--rust)' });

  // 4. Op tijd naar bed → Energie
  const bedY = [], bedN = [];
  allEntries.forEach(e => {
    if (e.energy == null) return;
    if (e.bed_on_time) bedY.push(e.energy);
    else if (e.bed_on_time === 0) bedN.push(e.energy);
  });
  tryInsight({ emoji: '🌙', title: 'Op tijd bed & energie', A: bedY, B: bedN, labelA: 'op tijd naar bed', labelB: 'laat naar bed', color: '#EC4899' });

  // 5. Weinig stress → Energie
  const strY = [], strN = [];
  allEntries.forEach(e => {
    if (e.energy == null) return;
    if (e.low_stress) strY.push(e.energy);
    else if (e.low_stress === 0) strN.push(e.energy);
  });
  tryInsight({ emoji: '🧘', title: 'Weinig stress & energie', A: strY, B: strN, labelA: 'rustige dag', labelB: 'stressvolle dag', color: 'var(--gold)' });

  // 6. Geen suiker → Energie
  const sugY = [], sugN = [];
  allEntries.forEach(e => {
    if (e.energy == null) return;
    if (e.no_sugar) sugY.push(e.energy);
    else if (e.no_sugar === 0) sugN.push(e.energy);
  });
  tryInsight({ emoji: '🍬', title: 'Geen suiker & energie', A: sugY, B: sugN, labelA: 'suikervrij', labelB: 'suiker gegeten', color: '#F59E0B' });

  // 7. PEM-crash → Energie dag erna (1 PEM-obs. is voldoende)
  const pemY = [], pemN = [];
  allEntries.forEach(e => {
    const nx = byDate[nextDay(e.date)];
    if (!nx || nx.energy == null) return;
    (e.symptom_pem ? pemY : pemN).push(nx.energy);
  });
  if (pemY.length >= 1 && pemN.length >= MIN) {
    const aAvg = avg(pemY), bAvg = avg(pemN);
    if (aAvg != null && bAvg != null && (bAvg - aAvg) >= 0.3) {
      results.push({
        emoji: '⚡', title: 'PEM-crash & dag erna', color: 'var(--alert)', warn: true,
        lines: [
          `na PEM-dag: gem. ${aAvg.toFixed(1)}/3 energie (${pemY.length}×)`,
          `na normale dag: gem. ${bAvg.toFixed(1)}/3 energie (${pemN.length}×)`,
        ],
        verdict: `PEM verlaagt dag erna je energie met ${(bAvg - aAvg).toFixed(1)} punt — pacing is essentieel`,
        n: pemY.length + pemN.length,
      });
    }
  }

  return results;
}

const ENERGY_EMOJI = ['🪫', '😐', '⚡', '🚀'];

function GedragGevolg({ logs }) {
  const allEntries = Object.values(logs)
    .filter(e => e.energy != null && e.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const n = allEntries.length;
  const insights = n >= 2 ? computeInsights(logs) : [];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#8B5CF6' }} />
        <div className="card-title">🔍 Gedrag → Gevolg</div>
        <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {n} energie-dag{n !== 1 ? 'en' : ''}
        </div>
      </div>
      <div className="card-body">

        {/* Mini-log: altijd zichtbaar zodra er energiedata is */}
        {allEntries.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="scale-label" style={{ marginBottom: 6 }}>RECENTE DAGEN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allEntries.slice(0, 7).map(e => {
                const habits = [
                  e.sleep_hours != null && `😴 ${e.sleep_hours}u`,
                  e.water        && '💧',
                  e.protein      && '🥩',
                  e.no_sugar     && '🚫',
                  e.bed_on_time  && '🛏️',
                  e.low_stress   && '🧘',
                  (e.run_done || e.core_done || e.swim_done || e.bike_done) && '🏃',
                  e.migraine     && '🧠',
                  e.symptom_pem  && '⚡',
                ].filter(Boolean);
                return (
                  <div key={e.date} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 8, background: 'var(--bg)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 16, minWidth: 20 }}>{ENERGY_EMOJI[e.energy]}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', minWidth: 56, fontFamily: 'var(--font-mono)' }}>
                      {e.date.slice(5)}
                    </span>
                    <span style={{ fontSize: 11, flex: 1, lineHeight: 1.4 }}>
                      {habits.join(' ')}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
              Energie: 🪫 uitgeput · 😐 matig · ⚡ goed · 🚀 top
            </div>
          </div>
        )}

        {n === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--muted)', fontSize: 11 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
            Vul de <strong>energieknoppen</strong> in op de Vandaag-tab (🪫😐⚡🚀).<br />
            <span style={{ fontSize: 10 }}>Daarna verschijnen hier direct observaties.</span>
          </div>
        ) : (
          <>
            {/* Vroege observaties — altijd zichtbaar met ≥1 dag */}
            {(() => {
              const sorted = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
              const avgE = (allEntries.reduce((s, e) => s + e.energy, 0) / n).toFixed(1);
              const avgS = (() => {
                const v = allEntries.filter(e => e.sleep_hours != null);
                return v.length ? (v.reduce((s, e) => s + e.sleep_hours, 0) / v.length).toFixed(1) : null;
              })();
              const best  = [...allEntries].sort((a, b) => b.energy - a.energy)[0];
              const worst = [...allEntries].sort((a, b) => a.energy - b.energy)[0];
              const HABIT_MAP = [
                { id: 'water',        label: 'water 💧' },
                { id: 'protein',      label: 'eiwitten 🥩' },
                { id: 'no_sugar',     label: 'geen suiker 🚫' },
                { id: 'bed_on_time',  label: 'op tijd naar bed 🛏️' },
                { id: 'low_stress',   label: 'weinig stress 🧘' },
              ];
              const alwaysDone   = HABIT_MAP.filter(h => allEntries.every(e => e[h.id]));
              const neverDone    = HABIT_MAP.filter(h => allEntries.every(e => !e[h.id]));
              const bestHabits   = HABIT_MAP.filter(h => best?.[h.id]);
              const bestTrained  = best && (best.run_done || best.core_done || best.swim_done || best.bike_done);
              const worstHabits  = HABIT_MAP.filter(h => worst?.[h.id]);
              const energyLabel  = ['uitgeput 🪫', 'matig 😐', 'goed ⚡', 'top 🚀'];

              const obs = [];
              // Gemiddelden
              obs.push({
                icon: '📊',
                text: `Gem. energie ${avgE}/3${avgS ? ` · gem. slaap ${avgS}u` : ''} over ${n} gelogde dag${n !== 1 ? 'en' : ''}`,
                sub: null,
              });
              // Beste dag
              if (best && n >= 2) obs.push({
                icon: '🔋',
                text: `Beste dag: ${best.date.slice(5)} — ${energyLabel[best.energy]}`,
                sub: [
                  best.sleep_hours != null && `😴 ${best.sleep_hours}u slaap`,
                  bestTrained && '🏃 training gedaan',
                  ...bestHabits.map(h => h.label),
                ].filter(Boolean).join(' · ') || 'geen extra data die dag',
              });
              // Slechtste dag (alleen tonen als verschilt van beste)
              if (worst && n >= 2 && worst.date !== best.date && worst.energy < best.energy) obs.push({
                icon: '⚠️',
                text: `Laagste dag: ${worst.date.slice(5)} — ${energyLabel[worst.energy]}`,
                sub: [
                  worst.sleep_hours != null && `😴 ${worst.sleep_hours}u slaap`,
                  ...worstHabits.map(h => h.label),
                ].filter(Boolean).join(' · ') || 'gewoontes niet ingevuld',
              });
              // Consistente gewoontes
              if (alwaysDone.length > 0 && n >= 2) obs.push({
                icon: '✅',
                text: `Elke dag gedaan: ${alwaysDone.map(h => h.label).join(', ')}`,
                sub: 'Sterke basis — dit zijn je ankers.',
              });
              // Nooit gedone gewoontes
              if (neverDone.length > 0 && n >= 2) obs.push({
                icon: '💡',
                text: `Nog nooit gedaan in je logs: ${neverDone.map(h => h.label).join(', ')}`,
                sub: 'Probeer dit eens — zodra het 1× anders is, zie je de vergelijking.',
              });

              return obs.length > 0 ? (
                <div style={{ marginBottom: insights.length > 0 ? 12 : 0 }}>
                  <div className="scale-label" style={{ marginBottom: 6 }}>OBSERVATIES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {obs.map((o, i) => (
                      <div key={i} style={{
                        background: o.icon === '⚠️' ? 'var(--rust-l)' : o.icon === '✅' ? '#F0FDF4' : 'var(--bg)',
                        borderRadius: 8, padding: '8px 10px',
                        border: `1px solid ${o.icon === '⚠️' ? 'var(--rust)' : o.icon === '✅' ? 'var(--sage)' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{o.icon} {o.text}</div>
                        {o.sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{o.sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Statistische patronen — zodra er variatie is */}
            {insights.length > 0 && (
              <>
                <div className="scale-label" style={{ marginBottom: 6 }}>PATRONEN</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>
                  Vergelijkingen tussen dagen met en zonder de factor. Sterker naarmate je meer logt.
                </div>
                {insights.map((ins, i) => (
                  <div key={i} style={{
                    background: ins.warn ? 'var(--rust-l)' : '#F0FDF4',
                    borderLeft: `3px solid ${ins.color}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 8,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{ins.emoji} {ins.title}</span>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {ins.earlySignal && (
                          <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 99, fontWeight: 600 }}>vroeg signaal</span>
                        )}
                        <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 400 }}>n={ins.n}</span>
                      </div>
                    </div>
                    {ins.lines.map((line, j) => (
                      <div key={j} style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.7 }}>
                        {j === 0 ? '→ ' : '↔ '}{line}
                      </div>
                    ))}
                    <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: ins.color, lineHeight: 1.4 }}>
                      💡 {ins.verdict}
                    </div>
                  </div>
                ))}
              </>
            )}
            {insights.length === 0 && n >= 2 && (
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.6 }}>
                <strong>Vergelijkingspatronen</strong> verschijnen zodra je een dag hebt met bijv. minder slaap of een andere gewoonte dan de andere dagen.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

const TRIGGER_LABELS = {
  hormonen: '🌙 Hormonen/cyclus', slaap: '😴 Slaap', inspanning: '🏃 Inspanning',
  stress: '😤 Stress', weer: '🌩️ Weer', voeding: '🍷 Voeding', onbekend: '❓ Onbekend',
};

function MigraineOverview({ logs }) {
  const AJOVI_HIST = 'gc_ajovi_history';
  const ajovi = (() => { try { return JSON.parse(localStorage.getItem(AJOVI_HIST) || '[]'); } catch { return []; } })();

  const migraineDays = Object.values(logs)
    .filter(l => l.migraine)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!migraineDays.length) return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#7C3AED' }} />
        <div className="card-title">🧠 Migraine patroon</div>
      </div>
      <div className="card-body" style={{ fontSize: 12, color: 'var(--muted)' }}>
        Nog geen migraine geregistreerd. Log migraine-dagen via de Vandaag-tab voor patroonanalyse.
      </div>
    </div>
  );

  // Group by month
  const byMonth = {};
  for (const d of migraineDays) {
    const month = d.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(d);
  }

  // Trigger tally — handles both old single string and new array format
  const triggerCount = {};
  for (const d of migraineDays) {
    const triggers = d.migraine_triggers || (d.migraine_trigger ? [d.migraine_trigger] : ['onbekend']);
    for (const t of triggers) {
      triggerCount[t] = (triggerCount[t] || 0) + 1;
    }
  }
  const topTriggers = Object.entries(triggerCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Correlate with cycle
  const cycleStart = localStorage.getItem('gc_cycle_start');
  const cycleCorr = cycleStart ? (() => {
    const hormoonDays = migraineDays.filter(d => {
      const triggers = d.migraine_triggers || (d.migraine_trigger ? [d.migraine_trigger] : []);
      return triggers.includes('hormonen');
    }).length;
    return hormoonDays > 0 ? `${hormoonDays} van ${migraineDays.length} migrainedagen zijn gemarkeerd als hormoon-gerelateerd.` : null;
  })() : null;

  // Days since last ajovi per migraine day
  const ajoviCorr = ajovi.length > 0 ? migraineDays.map(d => {
    const prev = ajovi.filter(a => a.date <= d.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prev) return null;
    return Math.floor((new Date(d.date) - new Date(prev.date)) / 86400000);
  }).filter(Boolean) : [];
  const avgDaysSinceAjovi = ajoviCorr.length
    ? Math.round(ajoviCorr.reduce((a, b) => a + b, 0) / ajoviCorr.length)
    : null;

  const NL_MONTHS_SHORT = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#7C3AED' }} />
        <div className="card-title">🧠 Migraine patroon</div>
        <span style={{ fontSize: 11, color: '#7C3AED', fontWeight: 700, background: '#F3E8FF', padding: '2px 8px', borderRadius: 99 }}>
          {migraineDays.length} dag{migraineDays.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="card-body">

        {/* Monthly overview */}
        <div className="scale-label">PER MAAND</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 12 }}>
          {Object.entries(byMonth).map(([month, days]) => {
            const [y, m] = month.split('-');
            return (
              <div key={month} style={{
                background: '#F3E8FF', borderRadius: 8, padding: '6px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 700 }}>
                  {NL_MONTHS_SHORT[parseInt(m) - 1]} {y}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7C3AED', lineHeight: 1.2 }}>{days.length}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>dag{days.length !== 1 ? 'en' : ''}</div>
              </div>
            );
          })}
        </div>

        {/* Top triggers */}
        {topTriggers.length > 0 && (
          <>
            <div className="scale-label">MEEST VOORKOMENDE TRIGGERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, marginBottom: 12 }}>
              {topTriggers.map(([t, n]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12 }}>{TRIGGER_LABELS[t] || t}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED' }}>{n}×</div>
                  <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(n / migraineDays.length) * 100}%`, background: '#7C3AED', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Ajovi correlation */}
        {avgDaysSinceAjovi != null && (
          <div style={{ background: '#F3E8FF', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 2 }}>💜 Ajovi correlatie</div>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>
              Gemiddeld <strong>{avgDaysSinceAjovi} dagen</strong> na de laatste Ajovi-prik treedt er migraine op.
              {avgDaysSinceAjovi > 25 && <span style={{ color: 'var(--alert)', marginLeft: 4 }}>⚠️ Mogelijk uitgewerkt aan einde maand.</span>}
            </div>
          </div>
        )}

        {/* Cycle correlation */}
        {cycleCorr && (
          <div style={{ background: '#F3E8FF', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text)' }}>🌙 {cycleCorr}</div>
          </div>
        )}

        {/* Recent migraine days */}
        <div className="scale-label">RECENTE MIGRAINE-DAGEN</div>
        <div style={{ marginTop: 6 }}>
          {migraineDays.slice(-8).reverse().map(d => (
            <div key={d.date} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
              <span style={{ color: 'var(--muted)', minWidth: 80 }}>{d.date}</span>
              {d.migraine_severity && <span>{'🟣'.repeat(d.migraine_severity)}</span>}
              {d.migraine_hours && <span>{d.migraine_hours}u</span>}
              {(() => {
                const trs = d.migraine_triggers || (d.migraine_trigger ? [d.migraine_trigger] : []);
                return trs.length > 0 && <span style={{ color: '#7C3AED' }}>{trs.map(t => TRIGGER_LABELS[t] || t).join(' · ')}</span>;
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function CycleWeightPattern({ logs }) {
  const cycleStart = localStorage.getItem('gc_cycle_start');
  const cycleHistoryRaw = (() => {
    try { return JSON.parse(localStorage.getItem('gc_cycle_history') || '[]'); } catch { return []; }
  })();

  const allStarts = [...(cycleStart ? [cycleStart] : []), ...cycleHistoryRaw]
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => a.localeCompare(b));

  if (allStarts.length < 3) return null;

  const weightEntries = Object.values(logs)
    .filter(e => e.weight && e.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (weightEntries.length < 10) return null;

  const entriesWithDay = weightEntries.map(entry => {
    const starts = allStarts.filter(s => s <= entry.date);
    if (!starts.length) return null;
    const start = starts[starts.length - 1];
    const day = Math.floor((new Date(entry.date) - new Date(start)) / 86400000) + 1;
    return day >= 1 && day <= 35 ? { ...entry, cycleDay: day, cycleStart: start } : null;
  }).filter(Boolean);

  if (!entriesWithDay.length) return null;

  // Compute per-cycle means
  const cycleMeans = {};
  entriesWithDay.forEach(e => {
    if (!cycleMeans[e.cycleStart]) cycleMeans[e.cycleStart] = [];
    cycleMeans[e.cycleStart].push(e.weight);
  });
  Object.keys(cycleMeans).forEach(k => {
    const vals = cycleMeans[k];
    cycleMeans[k] = vals.reduce((s, v) => s + v, 0) / vals.length;
  });

  // Group deviations by cycle day
  const dayDevs = {};
  entriesWithDay.forEach(e => {
    const mean = cycleMeans[e.cycleStart];
    if (!mean) return;
    if (!dayDevs[e.cycleDay]) dayDevs[e.cycleDay] = [];
    dayDevs[e.cycleDay].push(+(e.weight - mean).toFixed(2));
  });

  const dayAvg = {};
  Object.entries(dayDevs).forEach(([d, devs]) => {
    dayAvg[parseInt(d)] = +(devs.reduce((s, v) => s + v, 0) / devs.length).toFixed(2);
  });

  const phases = [
    { label: '🩸 Menstruatie', days: [1, 5], color: 'var(--alert)' },
    { label: '🌱 Folliculaire fase', days: [6, 13], color: 'var(--sage)' },
    { label: '✨ Ovulatie', days: [14, 16], color: 'var(--gold)' },
    { label: '🌙 Luteale fase', days: [17, 35], color: '#9333EA' },
  ];

  const phaseAvgs = phases.map(phase => {
    const vals = Object.entries(dayAvg)
      .filter(([d]) => parseInt(d) >= phase.days[0] && parseInt(d) <= phase.days[1])
      .map(([, v]) => v);
    if (!vals.length) return null;
    const avg = +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
    return { ...phase, avg, n: vals.length };
  }).filter(Boolean);

  if (!phaseAvgs.length) return null;

  const sortedByAvg = Object.entries(dayAvg).sort(([, a], [, b]) => a - b);
  const lowestDays = sortedByAvg.slice(0, 5).map(([d]) => `dag ${d}`).join(', ');
  const highestDays = sortedByAvg.slice(-3).reverse().map(([d]) => `dag ${d}`).join(', ');
  const totalCycles = allStarts.length;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-accent" style={{ background: '#C084FC' }} />
        <div className="card-title">🌙 Cyclus & gewicht</div>
        <span style={{ fontSize: 11, color: '#9333EA', fontWeight: 700, background: '#F3E8FF', padding: '2px 8px', borderRadius: 99 }}>
          {totalCycles} cycli
        </span>
      </div>
      <div className="card-body">
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
          Dit zijn hormonale schommelingen — geen echt vet aan/af. Gebruik dit om stressvrij te wegen.
        </div>
        <div className="scale-label" style={{ marginBottom: 6 }}>GEWICHTSEFFECT PER FASE (t.o.v. cyclus-gemiddelde)</div>
        {phaseAvgs.map(phase => (
          <div key={phase.label} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, fontSize: 12 }}>{phase.label}</div>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: phase.avg > 0.4 ? 'var(--alert)' : phase.avg < -0.4 ? 'var(--sage)' : 'var(--muted)',
            }}>
              {phase.avg > 0 ? `+${phase.avg}` : phase.avg} kg
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.8 }}>
          <div style={{ color: 'var(--sage)', fontWeight: 600 }}>✅ Laagste gewicht: {lowestDays}</div>
          <div style={{ color: 'var(--alert)', fontWeight: 600 }}>⚠️ Hoogste gewicht: {highestDays}</div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>
            Weeg jezelf bij voorkeur op de "lage" cyclusdagen voor de meest bemoedigende meting.
            Op de "hoge" dagen hoef je niet in de stress — dat is vocht, geen vet.
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function Progressie({ logs }) {
  const [sessions, setSessions] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    photoStore.getAll().then(setSessions).catch(() => {});
    store.getMeasurements().then(setMeasurements).catch(() => {});
  }, []);

  function closestMeasurement(date) {
    const onDate = measurements.find(m => m.date === date);
    if (onDate) return { meas: onDate, label: null };
    const prev = measurements.filter(m => m.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev) return { meas: prev, label: prev.date };
    return null;
  }

  const allLogs = Object.values(logs);
  const photoSessions = sessions.sort((a, b) => b.date.localeCompare(a.date));

  // Datums met gewicht maar zonder foto — om ook te tonen in een compacte weergave
  const photoDateSet = new Set(sessions.map(s => s.date));
  const weightOnlyDates = allLogs
    .filter(l => l.weight && !photoDateSet.has(l.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="pane">
      <WeightProgress logs={logs} />
      <WhrProgress measurements={measurements} />
      <CycleWeightPattern logs={logs} />
      <GedragGevolg logs={logs} />
      <MigraineOverview logs={logs} />

      {/* Foto-tijdlijn */}
      {photoSessions.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7, background: 'var(--card)', borderRadius: 12 }}>
          📸 Nog geen progressiefoto's.<br />
          Ga naar <strong>Coach → Progressiefoto's</strong> om je eerste foto te maken.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>
            📸 {photoSessions.length} foto-sessie{photoSessions.length !== 1 ? 's' : ''}
          </div>
          {photoSessions.map(({ date, views }) => {
            const log       = logs[date] ?? {};
            const dn        = dayNum(date);
            const measInfo  = closestMeasurement(date);
            const analysis  = localStorage.getItem(`gc_photo_analysis_${date}`);
            const isOpen    = expanded[date];

            const activeSymptoms = Object.keys(SYMPTOM_LABELS).filter(k => log[k]);
            const photoCount = PHOTO_TYPES.filter(({ key }) => views[key]).length;

            return (
              <div key={date} className="card" style={{ marginBottom: 12 }}>
                {/* Header — klikbaar voor uitvouwen */}
                <div
                  className="card-header"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(e => ({ ...e, [date]: !e[date] }))}
                >
                  <div className="card-accent" style={{ background: 'var(--gold)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 14 }}>
                      Dag {dn}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{date}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    {log.weight && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--rust)' }}>{log.weight} kg</span>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                      {photoCount} foto{photoCount !== 1 ? "'s" : ''} {isOpen ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Thumbnail preview — altijd zichtbaar */}
                <div style={{ padding: '0 12px 8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                    {PHOTO_TYPES.map(({ key, label }) => {
                      const photo = views[key];
                      return (
                        <div key={key}>
                          {photo ? (
                            <img
                              src={`data:${photo.mimeType};base64,${photo.base64}`}
                              alt={`${date} ${label}`}
                              style={{ width: '100%', borderRadius: 8, objectFit: 'cover', height: isOpen ? 160 : 100 }}
                            />
                          ) : (
                            <div style={{ height: isOpen ? 160 : 100, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--border)' }}>
                              {label}
                            </div>
                          )}
                          {isOpen && (
                            <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detail — uitvouwbaar */}
                {isOpen && (
                  <div className="card-body" style={{ paddingTop: 4 }}>
                    {/* Maten */}
                    {measInfo && (
                      <MeasurementRow meas={measInfo.meas} label={measInfo.label} />
                    )}

                    {/* Vitals rij */}
                    {(log.bp_sys || log.hr_rest || log.steps || log.battery_start != null) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8, fontSize: 11 }}>
                        {log.bp_sys && (
                          <span>❤️ <strong>{log.bp_sys}/{log.bp_dia}</strong>{log.bp_hr ? ` ${log.bp_hr}bpm` : ''}</span>
                        )}
                        {log.hr_rest && (
                          <span>💓 rust <strong>{log.hr_rest} bpm</strong></span>
                        )}
                        {log.steps != null && (
                          <span>👣 <strong>{log.steps.toLocaleString('nl')}</strong> stap</span>
                        )}
                        {log.battery_start != null && (
                          <span>🔋 <strong>{log.battery_start}%</strong>{log.battery_end != null ? ` → ${log.battery_end}%` : ''}</span>
                        )}
                      </div>
                    )}

                    {/* Bijzonderheden */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 8 }}>
                      {log.cycle_phase && CYCLE_LABEL[log.cycle_phase] && (
                        <span style={{ fontSize: 11, background: 'var(--rust-l)', color: 'var(--rust)', padding: '2px 8px', borderRadius: 99 }}>
                          {CYCLE_LABEL[log.cycle_phase]}
                        </span>
                      )}
                      {log.energy != null && (
                        <span style={{ fontSize: 11, background: 'var(--gold-l)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 99 }}>
                          {['🪫','😐','⚡','🚀'][log.energy]} energie
                        </span>
                      )}
                      {log.sleep_hours != null && (
                        <span style={{ fontSize: 11, background: 'var(--sage-l)', color: 'var(--sage)', padding: '2px 8px', borderRadius: 99 }}>
                          😴 {log.sleep_hours}u slaap
                        </span>
                      )}
                      {activeSymptoms.map(k => (
                        <span key={k} style={{ fontSize: 11, background: 'var(--alert-l)', color: 'var(--alert)', padding: '2px 8px', borderRadius: 99 }}>
                          {SYMPTOM_LABELS[k]}
                        </span>
                      ))}
                    </div>

                    {/* Notitie */}
                    {log.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6, marginBottom: 8, fontStyle: 'italic' }}>
                        "{log.notes}"
                      </div>
                    )}

                    {/* AI analyse */}
                    {analysis && (
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 10, color: 'var(--sage)', cursor: 'pointer', fontWeight: 700 }}>
                          🤖 AI-analyse bekijken
                        </summary>
                        <div style={{ marginTop: 6, background: 'var(--sage-l)', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7, color: 'var(--text)', borderLeft: '3px solid var(--sage)', whiteSpace: 'pre-wrap' }}>
                          {analysis}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Gewicht-only datums (geen foto) */}
      {weightOnlyDates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 700 }}>⚖️ Weegmomenten (geen foto)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {weightOnlyDates.map(l => (
              <div key={l.date} style={{ background: 'var(--card)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Dag {dayNum(l.date)} · {l.date.slice(5)}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--rust)', marginTop: 2 }}>{l.weight} kg</div>
                {l.cycle_phase && CYCLE_LABEL[l.cycle_phase] && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{CYCLE_LABEL[l.cycle_phase]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
