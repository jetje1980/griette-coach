import React, { useState } from 'react';
import { PERSONAL_EVENTS } from '../config';

const PLAN_START = '2026-08-17';
const PLAN_END   = '2026-12-13';

const RACES = [
  { date: '2026-10-03', label: 'Trail 10 km', short: '3 okt', emoji: '🏔️', color: '#E07A3B' },
  { date: '2026-11-01', label: 'Bereloop 10 km', short: '~1 nov', emoji: '🏃', color: '#2D6047' },
  { date: '2026-12-13', label: 'Ameland 5 km', short: '13 dec', emoji: '🏝️', color: '#0EA5E9' },
];

const PHASES = [
  {
    id: 'opbouw', label: 'Fase 1 · Opbouw', period: '18 aug – 14 sep', color: '#E07A3B',
    desc: 'Zone B steeds (106–132 bpm). Basisconditie leggen, hardloopgevoel terugvinden.',
    rows: [
      { week: 'W1 · 18 aug', di: '20 min zone B', do_: '20 min zone B', za: '25 min zone B', tot: '65 min' },
      { week: 'W2 · 25 aug', di: '25 min zone B', do_: '20 min + pickups', za: '30 min zone B', tot: '75 min' },
      { week: 'W3 · 1 sep',  di: '30 min zone B', do_: '25 min + strides', za: '35 min zone B', tot: '90 min' },
      { week: 'W4 · 8 sep',  di: '30 min zone B', do_: '4×4 min zone B+', za: '38 min zone B', tot: '95 min' },
    ],
  },
  {
    id: 'build', label: 'Fase 2 · Build', period: '15–28 sep', color: '#E07A3B',
    desc: 'Meer kilometers, eerste temposessies. Zaterdag richting 7–8 km.',
    rows: [
      { week: 'W5 · 15 sep', di: '35 min zone B', do_: '5×4 min tempo', za: '45 min (~7 km)', tot: '115 min' },
      { week: 'W6 · 22 sep', di: '30 min zone B', do_: '3×4 min tempo', za: '35 min zone B', tot: '85 min' },
    ],
  },
  {
    id: 'race1', label: '🏔️ Race week 1', period: '29 sep – 3 okt', color: '#E07A3B', isRace: true,
    desc: 'Benen fris houden. Vertrouw het opbouwwerk. Niet sprinten op dag 1.',
    rows: [
      { week: 'Ma 29 sep', di: '20 min easy', do_: '', za: '', tot: '', zo: '15 min easy + strides' },
      { week: 'Za 3 okt 🏆', di: '', do_: '', za: 'TRAIL 10 KM!', tot: '', race: true },
    ],
  },
  {
    id: 'bereloop', label: 'Fase 3 · Bereloop prep', period: '4 okt – 1 nov', color: '#2D6047',
    desc: 'Herstelweek, dan opbouw voor Bereloop (strand + duin = zwaarder dan weg).',
    rows: [
      { week: 'W8 herstel', di: '25 min easy', do_: '20 min easy', za: '30 min easy', tot: '75 min' },
      { week: 'W9 · 12 okt', di: '30 min zone B', do_: '25 min + strides', za: '35 min zone B', tot: '90 min' },
      { week: 'W10 · 19 okt', di: '30 min zone B', do_: '5×3 min tempo', za: '40 min zone B', tot: '100 min' },
      { week: 'W11 taper',   di: '25 min easy', do_: '3×3 min tempo', za: '25 min easy', tot: '65 min' },
      { week: '~1 nov 🏆',   di: '', do_: '', za: 'BERELOOP 10 KM!', tot: '', race: true },
    ],
  },
  {
    id: 'ameland', label: 'Fase 4 · Onderhoud', period: 'nov – 13 dec', color: '#0EA5E9',
    desc: '2–3 runs/week easy. Kracht vasthouden. Ameland 5K is bonus na 2× 10km.',
    rows: [
      { week: 'Nov', di: '25-30 min easy', do_: '25 min easy', za: '35 min easy', tot: '~85 min' },
      { week: 'Za 13 dec 🏆', di: '', do_: '', za: 'AMELAND 5 KM!', tot: '', race: true },
    ],
  },
];

const CIRCUITS = [
  {
    id: 'A', label: 'Kracht-A · Core', tag: 'dagelijks OK', color: '#2D6047', emoji: '🧘',
    time: '10 min · 3 ronden',
    exercises: [
      { name: 'Plank',          detail: '30 sec — buik actief, niet doorzakken' },
      { name: 'Dead bug',       detail: '10× afwisselend — arm + tegenovergesteld been' },
      { name: 'Bird-dog',       detail: '10× afwisselend — traag en gecontroleerd' },
      { name: 'Glute bridge',   detail: '15× — omhoog + 2 sec vasthouden' },
      { name: 'Side plank',     detail: '30 sec per kant — heup omhoog' },
    ],
  },
  {
    id: 'B', label: 'Kracht-B · Benen', tag: 'platte buik ↑', color: '#E07A3B', emoji: '🦵',
    time: '12 min · 3 ronden',
    exercises: [
      { name: 'Squat',          detail: '15× — diep, knieën boven tenen' },
      { name: 'Reverse lunge',  detail: '10× per been — knie bijna grond' },
      { name: 'Hip thrust',     detail: '15× — rug op bank, explosief + 2 sec top' },
      { name: 'Wall sit',       detail: '30 sec — dijen parallel, burn is goed' },
      { name: 'Step-up',        detail: '10× per been — stoel of trap, volle stap' },
    ],
  },
  {
    id: 'C', label: 'Kracht-C · Boven', tag: 'houding ↑', color: '#C08A22', emoji: '💪',
    time: '10 min · 3 ronden',
    exercises: [
      { name: 'Push-up',        detail: '10× — op knieën mag, borst bijna grond' },
      { name: 'Bent-over row',  detail: '10× — waterflessen, ellebogen langs lijf' },
      { name: 'Shoulder press', detail: '12× — staand, waterflessen' },
      { name: 'Tricep dip',     detail: '10× — op stoel, 90° zakken' },
      { name: 'Bicep curl',     detail: '12× — traag neer telt ook' },
    ],
  },
];

const WEEK_SCHEMA = [
  { day: 'Maandag',   type: 'kracht', pills: ['💪 Kracht-A',   '🦵 Kracht-B'],          note: 'AM + PM split, of samen 22 min',         time: '22 min' },
  { day: 'Dinsdag',   type: 'run',    pills: ['🏃 Hardlopen'],                            note: 'Zone B · progressief opbouwen',           time: '20–45 min' },
  { day: 'Woensdag',  type: 'kracht', pills: ['🏋 Kracht-C'],                             note: 'Schouders, rug, armen',                   time: '10 min' },
  { day: 'Donderdag', type: 'run',    pills: ['🏃 Hardlopen'],                            note: 'Tempo of intervallen per schema',          time: '20–35 min' },
  { day: 'Vrijdag 💉',type: 'moun',   pills: ['💪 Kracht-A', '💉 Mounjaro'],             note: 'Prik dag — bewust rustig',                time: '10 min' },
  { day: 'Zaterdag',  type: 'run',    pills: ['🏃 Lange duurloop', '🦵 Kracht-B'],       note: 'Zone B · kracht daarna of later op dag',  time: '30–50 + 12 min' },
  { day: 'Zondag',    type: 'rest',   pills: ['🚶 Actief herstel'],                       note: 'Wandelen, fietsen, stretchen',            time: '—' },
];

function daysFromNow(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target - today) / 86400000);
}

function racePos(dateStr) {
  const start = new Date(PLAN_START);
  const end   = new Date(PLAN_END);
  const d     = new Date(dateStr);
  return Math.round(((d - start) / (end - start)) * 100);
}

function copyScheduleText() {
  const lines = [
    'GRIETTE TRAININGSPLAN 2026',
    `${PLAN_START} → ${PLAN_END} · 118 dagen · 3 races`,
    '',
    'WEEKSCHEMA:',
    'Ma: Kracht-A (core 10 min) + Kracht-B (benen 12 min)',
    'Di: Hardlopen zone B',
    'Wo: Kracht-C (boven 10 min)',
    'Do: Hardlopen (tempo/intervallen)',
    'Vr: Kracht-A + Mounjaro 💉',
    'Za: Lange duurloop + Kracht-B',
    'Zo: Rust / wandelen',
    '',
    'HARDLOOPPLAN:',
    'Fase 1 (18 aug–14 sep):',
    '  W1: Di 20min · Do 20min · Za 25min',
    '  W2: Di 25min · Do 20min+pickups · Za 30min',
    '  W3: Di 30min · Do 25min+strides · Za 35min',
    '  W4: Di 30min · Do 4×4min · Za 38min',
    'Fase 2 (15–28 sep):',
    '  W5: Di 35min · Do 5×4min tempo · Za 45min',
    '  W6: Di 30min · Do 3×4min · Za 35min',
    '⭐ Za 3 okt: TRAIL 10 KM',
    '',
    'Bereloop prep (4 okt–1 nov):',
    '  W8 herstel: 3× easy',
    '  W9: Di 30min · Do strides · Za 35min',
    '  W10: Di 30min · Do 5×3min · Za 40min',
    '  W11 taper: kort + licht',
    '⭐ ~1 nov: BERELOOP 10 KM (Terschelling)',
    '',
    'Onderhoud (nov–dec): 2–3 runs/week easy',
    '⭐ Za 13 dec: AMELAND 5 KM',
    '',
    'KRACHT-A (Core, 3 ronden):',
    '1. Plank 30 sec',
    '2. Dead bug 10×',
    '3. Bird-dog 10×',
    '4. Glute bridge 15×',
    '5. Side plank 30 sec/kant',
    '',
    'KRACHT-B (Benen, 3 ronden):',
    '1. Squat 15×',
    '2. Reverse lunge 10×/been',
    '3. Hip thrust 15×',
    '4. Wall sit 30 sec',
    '5. Step-up 10×/been',
    '',
    'KRACHT-C (Boven, 3 ronden):',
    '1. Push-up 10×',
    '2. Bent-over row 10×',
    '3. Shoulder press 12×',
    '4. Tricep dip 10×',
    '5. Bicep curl 12×',
  ];
  return lines.join('\n');
}

export default function Trainingsplan() {
  const [openPhase, setOpenPhase] = useState(null);
  const [openCircuit, setOpenCircuit] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(copyScheduleText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const pillStyle = (type) => {
    if (type === 'run')    return { background: 'rgba(217,111,46,.12)', color: '#D96F2E', border: '1px solid #D96F2E' };
    if (type === 'kracht') return { background: 'rgba(45,96,71,.12)',  color: '#2D6047', border: '1px solid #2D6047' };
    if (type === 'moun')   return { background: 'rgba(192,138,34,.12)',color: '#C08A22', border: '1px solid #C08A22' };
    return { background: 'var(--border)', color: 'var(--muted)', border: '1px solid var(--border)' };
  };

  return (
    <div className="pane">

      {/* ── Race timeline ── */}
      <div className="card" style={{ overflow: 'visible', paddingBottom: 28 }}>
        <div className="card-header">
          <div className="card-accent" style={{ background: '#E07A3B' }} />
          <div className="card-title">🏁 Race-kalender · aug – dec 2026</div>
          <button
            className="btn btn-sm"
            onClick={handleCopy}
            style={{ fontSize: 11, gap: 4, background: copied ? 'var(--sage-l)' : undefined }}
          >
            {copied ? '✓ Gekopieerd!' : '📋 Kopieer schema'}
          </button>
        </div>
        <div className="card-body" style={{ paddingTop: 32, paddingBottom: 0 }}>
          <div style={{ position: 'relative', height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 8px' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '100%',
              background: 'linear-gradient(90deg, var(--sage) 0%, #E07A3B 40%, #2D6047 64%, #0EA5E9 100%)',
              borderRadius: 2, opacity: 0.3 }} />
            {/* start dot */}
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: 10, height: 10, borderRadius: '50%', background: 'var(--sage)' }} />
            {/* start label */}
            <div style={{ position: 'absolute', left: 0, bottom: 14, fontSize: 9, color: 'var(--muted)',
              fontWeight: 700, whiteSpace: 'nowrap', transform: 'translateX(-4px)' }}>17 aug</div>

            {RACES.map(r => {
              const pos = racePos(r.date);
              const d   = daysFromNow(r.date);
              return (
                <div key={r.id} style={{ position: 'absolute', left: `${pos}%`, top: '50%',
                  transform: 'translateX(-50%) translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* label above */}
                  <div style={{ position: 'absolute', bottom: 18, whiteSpace: 'nowrap', textAlign: 'center',
                    fontSize: 10, fontWeight: 800, color: r.color, lineHeight: 1.2 }}>
                    {r.emoji} {r.short}
                  </div>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: r.color,
                    border: '3px solid var(--card)', position: 'relative', zIndex: 1 }} />
                  {/* days below */}
                  <div style={{ position: 'absolute', top: 16, fontSize: 9, color: 'var(--muted)',
                    fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {d > 0 ? `${d}d` : d === 0 ? 'vandaag!' : 'geweest'}
                  </div>
                </div>
              );
            })}
          </div>
          {/* race name strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 6 }}>
            {RACES.map(r => (
              <div key={r.label} style={{ fontSize: 11, textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 14 }}>{r.emoji}</div>
                <div style={{ fontWeight: 700, color: r.color, lineHeight: 1.2 }}>{r.label}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.short}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Weekschema ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">📅 Standaard weekschema</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Dag', 'Sessies', 'Notitie', 'Tijd'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10,
                    fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEK_SCHEMA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                    color: row.type === 'rest' ? 'var(--muted)' : 'var(--text)' }}>{row.day}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {row.pills.map(p => (
                        <span key={p} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 99, ...pillStyle(row.type) }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--muted)' }}>{row.note}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700,
                    color: row.type === 'run' ? '#D96F2E' : row.type === 'kracht' ? '#2D6047' : 'var(--muted)',
                    whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ paddingTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            ⚡ PEM-check: 's ochtends vermoeid wakker? Vervang run door wandeling. Altijd pacing boven schema.
          </div>
        </div>
      </div>

      {/* ── Loopplan fases ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#E07A3B' }} />
          <div className="card-title">🏃 Loopplan per fase</div>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>tik op fase voor details</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PHASES.map(ph => (
            <div key={ph.id} style={{
              borderRadius: 10, overflow: 'hidden',
              border: `1.5px solid ${openPhase === ph.id ? ph.color : 'var(--border)'}`,
            }}>
              <div
                onClick={() => setOpenPhase(openPhase === ph.id ? null : ph.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  cursor: 'pointer', background: openPhase === ph.id ? `${ph.color}11` : 'var(--card)' }}>
                <div style={{ width: 3, height: 32, borderRadius: 2, background: ph.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: ph.isRace ? ph.color : 'var(--text)' }}>{ph.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{ph.period}</div>
                </div>
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>{openPhase === ph.id ? '▲' : '▼'}</span>
              </div>
              {openPhase === ph.id && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 8px' }}>{ph.desc}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Week', 'Dinsdag', 'Donderdag', 'Zaterdag', 'Totaal'].map(h => (
                            <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 9,
                              fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ph.rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: row.race ? `${ph.color}18` : undefined }}>
                            <td style={{ padding: '7px 8px', fontWeight: 800, fontSize: 10,
                              color: row.race ? ph.color : '#E07A3B', whiteSpace: 'nowrap' }}>{row.week}</td>
                            <td style={{ padding: '7px 8px', color: row.race ? ph.color : 'var(--text)', fontWeight: row.race ? 800 : 400 }}>
                              {row.di || (row.zo ? row.zo : '—')}
                            </td>
                            <td style={{ padding: '7px 8px', color: 'var(--text)' }}>{row.do_ || '—'}</td>
                            <td style={{ padding: '7px 8px', color: row.race ? ph.color : 'var(--text)', fontWeight: row.race ? 800 : 400 }}>{row.za || '—'}</td>
                            <td style={{ padding: '7px 8px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{row.tot || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Kracht circuits ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: '#2D6047' }} />
          <div className="card-title">💪 Kracht circuits</div>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>geen materiaal nodig buiten een stoel</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CIRCUITS.map(c => (
            <div key={c.id} style={{
              borderRadius: 10, overflow: 'hidden',
              border: `1.5px solid ${openCircuit === c.id ? c.color : 'var(--border)'}`,
            }}>
              <div
                onClick={() => setOpenCircuit(openCircuit === c.id ? null : c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  cursor: 'pointer', background: openCircuit === c.id ? `${c.color}11` : 'var(--card)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  background: `${c.color}18`, border: `2px solid ${c.color}`, flexShrink: 0 }}>{c.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.time}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                  background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}` }}>{c.tag}</span>
                <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 4 }}>{openCircuit === c.id ? '▲' : '▼'}</span>
              </div>
              {openCircuit === c.id && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                    color: c.color, padding: '10px 0 8px', borderBottom: '1px solid var(--border)' }}>
                    3 RONDEN · 30 sec rust per oefening · 60 sec tussen ronden
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {c.exercises.map((ex, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ minWidth: 22, height: 22, borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                          background: `${c.color}18`, color: c.color, flexShrink: 0 }}>{i + 1}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ex.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Long COVID note ── */}
      <div className="card" style={{ borderLeft: '3px solid var(--rust)' }}>
        <div className="card-body">
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--rust)', marginBottom: 8 }}>⚡ Long COVID pacing — gouden regels</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <div><strong style={{ color: 'var(--text)' }}>Hartslag is je gids.</strong> 106–132 bpm = zone B. Boven 140 = terugschakelen.</div>
            <div><strong style={{ color: 'var(--text)' }}>PEM = rust.</strong> Dag ná training méér moe? Full rest dag. Altijd.</div>
            <div><strong style={{ color: 'var(--text)' }}>2 slechte dagen?</strong> Verlaag schema één stap. Eén run minder is geen verlies.</div>
            <div><strong style={{ color: 'var(--text)' }}>Herstelgevoel logt.</strong> App toont je eigen patroon na 4 weken data.</div>
          </div>
        </div>
      </div>

    </div>
  );
}
