import React, { useMemo } from 'react';
import { USER, HABITS } from '../config';

function ago(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function WeightChart({ logs }) {
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = ago(13 - i);
    return { d, v: logs[d]?.weight || null };
  });
  const valid = data.filter(p => p.v);
  if (valid.length < 2) return <div className="empty-state">Vul dagelijks gewicht in om grafiek te zien</div>;

  const W = 340, H = 80;
  const ys = valid.map(p => p.v);
  const mn = Math.min(...ys, USER.goalWeight) - 0.5;
  const mx = Math.max(...ys) + 0.5;
  const py = v => H - ((v - mn) / (mx - mn)) * H;
  const px = i => (data.indexOf(valid[i]) / (data.length - 1)) * W;

  const path = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' ');

  // Goal line
  const goalY = py(USER.goalWeight);
  const lastX = px(valid.length - 1);

  const diff = (valid[valid.length - 1].v - valid[0].v).toFixed(1);

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Goal line */}
        <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="var(--gold)" strokeWidth="1" strokeDasharray="5" opacity="0.6" />
        <text x="2" y={goalY - 3} fontSize="9" fill="var(--gold)">doel {USER.goalWeight}</text>
        {/* Data line */}
        <path d={path} fill="none" stroke="var(--rust)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {valid.map((p, i) => (
          <g key={i}>
            <circle cx={px(i)} cy={py(p.v)} r="3" fill="var(--rust)" />
            <text x={px(i)} y={py(p.v) - 6} textAnchor="middle" fontSize="8" fill="var(--muted)">{p.v}</text>
          </g>
        ))}
      </svg>
      <div className="chart-label" style={{ color: diff < 0 ? 'var(--sage)' : 'var(--rust)' }}>
        {diff < 0 ? `↓ ${Math.abs(diff)} kg in 14 dagen` : `↑ ${diff} kg`}
      </div>
    </div>
  );
}

function BpChart({ logs }) {
  const data = Array.from({ length: 14 }, (_, i) => {
    const d = ago(13 - i);
    return { d, s: logs[d]?.bp_sys || null, dv: logs[d]?.bp_dia || null };
  });
  const valid = data.filter(p => p.s);
  if (valid.length < 2) return <div className="empty-state">Meet dagelijks bloeddruk om grafiek te zien</div>;

  const W = 340, H = 80;
  const ss = valid.map(p => p.s), ds = valid.map(p => p.dv);
  const mn = Math.min(...ds) - 5, mx = Math.max(...ss) + 10;
  const py = v => H - ((v - mn) / (mx - mn)) * H;
  const px = i => (data.indexOf(valid[i]) / (data.length - 1)) * W;

  const pathS = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.s).toFixed(1)}`).join(' ');
  const pathD = valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(p.dv).toFixed(1)}`).join(' ');

  const y160 = py(160), y140 = py(140);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {y160 >= 0 && y160 <= H && <line x1="0" y1={y160} x2={W} y2={y160} stroke="var(--alert)" strokeWidth="1" strokeDasharray="4" opacity="0.7" />}
      {y140 >= 0 && y140 <= H && <line x1="0" y1={y140} x2={W} y2={y140} stroke="var(--gold)" strokeWidth="1" strokeDasharray="4" opacity="0.6" />}
      <text x="2" y={Math.max(10, y160 - 3)} fontSize="8" fill="var(--alert)">160</text>
      <text x="2" y={Math.max(10, y140 - 3)} fontSize="8" fill="var(--gold)">140</text>
      <path d={pathS} fill="none" stroke="var(--alert)" strokeWidth="2" strokeLinecap="round" />
      <path d={pathD} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
      {valid.map((p, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(p.s)} r="2.5" fill="var(--alert)" />
          <circle cx={px(i)} cy={py(p.dv)} r="2.5" fill="var(--gold)" />
        </g>
      ))}
    </svg>
  );
}

function HabitBars({ logs }) {
  return (
    <div>
      {HABITS.map(h => {
        const score = Array.from({ length: 7 }, (_, i) => (logs[ago(6 - i)]?.[h.id] ? 1 : 0)).reduce((a, b) => a + b, 0);
        const color = score >= 5 ? 'var(--sage)' : score >= 3 ? 'var(--gold)' : 'var(--alert)';
        return (
          <div key={h.id} className="habit-bar-row">
            <div className="habit-bar-header">
              <span>{h.emoji} {h.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{score}/7</span>
            </div>
            <div className="habit-bar-bg">
              <div className="habit-bar-fill" style={{ width: `${(score / 7) * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MOUNJARO_START = '2026-08-21';
const PRE_MOUNJARO = [
  { date: '2026-08-17', day: 'Zo', actions: ['💪 Krachtcircuit A (15 min)', '🥗 3× 40g eiwit, stop eten 19:00', '💧 2,5L water, geen suiker', '😴 Weeg je morgenochtend nuchter'] },
  { date: '2026-08-18', day: 'Ma', actions: ['💪 Circuit B + 🏃 20 min zone B', '🥚 Eiwit binnen 45 min na training', '🧂 Nul zout — vocht laten zakken', '😴 Voor 22:30 in bed'] },
  { date: '2026-08-19', day: 'Di', actions: ['🚶 20 min wandelen + foam roll', '🥩 Rustdag: extra eiwit + groenten', '🍽️ Eetvenster 09:00–17:00 proberen', '💧 3L water'] },
  { date: '2026-08-20', day: 'Wo', actions: ['🏃 20–25 min zone B + Circuit C core', '🥗 Geen koolhydraten na 16:00', '😴 8 uur slaap: dit is de nacht vóór Mounjaro'] },
  { date: '2026-08-21', day: 'Do', actions: ['💉 Mounjaro prik 1 — Fase 2 begint!', '🚶 Alleen wandelen vandaag', '⚠️ Blijf eten: min 100g eiwit ook zonder honger', "🎯 Weeg je 's ochtends vóór de prik"] },
];

export default function Patronen({ logs }) {
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => logs[ago(6 - i)]).filter(Boolean), [logs]);

  const trainDays = last7.filter(l => l.run_done || l.core_done).length;
  const avgEnergy = last7.filter(l => l.energy != null).length > 0
    ? (last7.filter(l => l.energy != null).reduce((a, l) => a + l.energy, 0) / last7.filter(l => l.energy != null).length).toFixed(1)
    : null;

  const weights = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
  const latest = weights[0]?.weight;
  const toGoal = latest ? (latest - USER.goalWeight).toFixed(1) : null;

  const todayStr = ago(0);
  const showPreMounjaro = todayStr < MOUNJARO_START;

  return (
    <div className="pane">
      {/* Pre-Mounjaro protocol (zichtbaar tot 21 aug) */}
      {showPreMounjaro && (
        <div className="card">
          <div className="card-header">
            <div className="card-accent" style={{ background: '#0EA5E9' }} />
            <div className="card-title">💉 Protocol tot Mounjaro (21 aug)</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ padding: '8px 14px 6px', fontSize: 12, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              Elke dag dit doen = −0,5 tot −1 kg vóór de eerste prik
            </div>
            {PRE_MOUNJARO.filter(d => d.date >= todayStr).map(({ date, day, actions }) => {
              const isToday_ = date === todayStr;
              const daysDiff = Math.round((new Date(date) - new Date(todayStr)) / 86400000);
              return (
                <div key={date} style={{
                  borderBottom: '1px solid var(--border)',
                  background: isToday_ ? '#CFFAFE22' : 'transparent',
                  borderLeft: isToday_ ? '3px solid #0EA5E9' : '3px solid transparent',
                }}>
                  <div style={{ padding: '7px 14px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: isToday_ ? '#0EA5E9' : 'var(--muted)', minWidth: 20 }}>{day}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{date.slice(5).replace('-', ' ')}</span>
                    {isToday_ && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#0EA5E9', color: '#fff' }}>vandaag</span>}
                    {daysDiff === 1 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>morgen</span>}
                    {date === MOUNJARO_START && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#0EA5E9', color: '#fff' }}>💉 prikdag!</span>}
                  </div>
                  <div style={{ padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {actions.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: isToday_ ? 'var(--text)' : 'var(--muted)', fontWeight: isToday_ ? 500 : 400 }}>{a}</div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
              Hefbomen: geen zout + weinig koolhydraten = −0,5–1 kg vocht. Eiwit hoog houden = geen spierafbraak.
            </div>
          </div>
        </div>
      )}

      {/* Samenvatting */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">📊 Week overzicht</div>
        </div>
        <div className="card-body">
          <div className="stats-row">
            <span>Trainingsdagen (7d)</span>
            <span className="stats-value">{trainDays}/7</span>
          </div>
          <div className="stats-row">
            <span>Gem. energie</span>
            <span className="stats-value">{avgEnergy ?? '—'}/3</span>
          </div>
          {latest && (
            <div className="stats-row">
              <span>Huidig gewicht</span>
              <span className="stats-value">{latest} kg</span>
            </div>
          )}
          {toGoal && (
            <div className="stats-row">
              <span>Nog naar doel</span>
              <span className="stats-value" style={{ color: 'var(--rust)' }}>−{toGoal} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Gewicht grafiek */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">⚖️ Gewicht — 14 dagen</div>
        </div>
        <div className="card-body">
          <WeightChart logs={logs} />
        </div>
      </div>

      {/* BD grafiek */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--alert)' }} />
          <div className="card-title">❤️ Bloeddruk — 14 dagen</div>
        </div>
        <div className="card-body">
          <BpChart logs={logs} />
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--alert)' }}>——</span> systolisch &nbsp;
            <span style={{ color: 'var(--gold)' }}>——</span> diastolisch &nbsp;
            <span style={{ color: 'var(--alert)' }}>- - -</span> 160 &nbsp;
            <span style={{ color: 'var(--gold)' }}>- - -</span> 140
          </div>
        </div>
      </div>

      {/* Gewoonte percentages */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">✅ Gewoontes — afgelopen 7 dagen</div>
        </div>
        <div className="card-body">
          <HabitBars logs={logs} />
        </div>
      </div>

      {/* Inzichten */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💡 Inzichten</div>
        </div>
        <div className="card-body">
          {(() => {
            const cards = [];

            // Gewichtstrend — laatste 30 dagen
            const thirtyDaysAgo = ago(30);
            const recentWeights = Object.values(logs)
              .filter(l => l.weight && l.date && l.date >= thirtyDaysAgo)
              .sort((a, b) => a.date.localeCompare(b.date));
            if (recentWeights.length >= 2) {
              const first = recentWeights[0], last = recentWeights[recentWeights.length - 1];
              const days = Math.max(1, Math.floor((new Date(last.date) - new Date(first.date)) / 86400000));
              const diff = +(last.weight - first.weight).toFixed(1);
              const perWeek = +((diff / days) * 7).toFixed(2);
              const going = diff < 0;
              cards.push(
                <div key="weight" style={{ padding: '10px 12px', background: going ? 'var(--sage-l)' : 'var(--rust-l)', borderRadius: 9, marginBottom: 8, borderLeft: `3px solid ${going ? 'var(--sage)' : 'var(--rust)'}` }}>
                  <strong style={{ fontSize: 12 }}>{going ? '📉 Gewicht daalt' : '📈 Gewicht gestegen (vakantie-effect)'}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {first.weight} → {last.weight} kg ({diff > 0 ? '+' : ''}{diff} kg in {days} dagen · {perWeek > 0 ? '+' : ''}{perWeek} kg/week) · trend obv laatste 30d
                  </div>
                  {!going ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Vandaag is dag 1. Mounjaro + zone B + 120g eiwit keert dit snel om.</div> : null}
                </div>
              );
            }

            // Training
            if (trainDays >= 4) {
              cards.push(
                <div key="train-hi" style={{ padding: '10px 12px', background: 'var(--sage-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--sage)' }}>
                  <strong style={{ fontSize: 12 }}>🏆 {trainDays}/7 trainingsdagen deze week</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Uitstekende consistentie — bouw dit zo rustig verder op.</div>
                </div>
              );
            } else if (trainDays === 0) {
              cards.push(
                <div key="train-0" style={{ padding: '10px 12px', background: 'var(--gold-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--gold)' }}>
                  <strong style={{ fontSize: 12 }}>👟 Nog geen training deze week</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Eén keer lopen of 15 min core doet al veel voor herstel en stemming.</div>
                </div>
              );
            } else {
              cards.push(
                <div key="train-mid" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--sage)' }}>
                  <strong style={{ fontSize: 12 }}>🏃 {trainDays}/7 trainingsdagen</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Doel is 3–4×/week zone B. {trainDays < 3 ? 'Nog ' + (3 - trainDays) + ' keer te gaan.' : 'Je zit goed op schema.'}</div>
                </div>
              );
            }

            // Energie
            if (avgEnergy != null) {
              const e = parseFloat(avgEnergy);
              const label = e >= 2.5 ? ['🚀 Top energie deze week!', 'Wat doe je goed? Houd dit vast.']
                          : e >= 1.5 ? ['⚡ Energie redelijk', 'Slaap en eiwitten zijn de snelste hefbomen.']
                          : ['🪫 Energie laag deze week', 'Prioriteit: ≥7u slaap en niet overplannen.'];
              cards.push(
                <div key="energy" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--gold)' }}>
                  <strong style={{ fontSize: 12 }}>{label[0]} ({avgEnergy}/3)</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label[1]}</div>
                </div>
              );
            }

            // Beste en slechtste gewoonte van de week
            const habitScores = HABITS.map(h => ({
              ...h,
              score: Array.from({ length: 7 }, (_, i) => (logs[ago(6 - i)]?.[h.id] ? 1 : 0)).reduce((a, b) => a + b, 0),
            }));
            const best  = [...habitScores].sort((a, b) => b.score - a.score)[0];
            const worst = [...habitScores].sort((a, b) => a.score - b.score)[0];
            if (best && best.score >= 5) {
              cards.push(
                <div key="best-habit" style={{ padding: '10px 12px', background: 'var(--sage-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--sage)' }}>
                  <strong style={{ fontSize: 12 }}>✅ Sterkste gewoonte: {best.emoji} {best.label}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{best.score}/7 dagen — dit is je anker. Blijf hierin consequent.</div>
                </div>
              );
            }
            if (worst && worst.score <= 2 && last7.length >= 4) {
              cards.push(
                <div key="worst-habit" style={{ padding: '10px 12px', background: 'var(--gold-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--gold)' }}>
                  <strong style={{ fontSize: 12 }}>💡 Kans: {worst.emoji} {worst.label}</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Slechts {worst.score}/7 deze week — één extra dag kan al een verschil maken.</div>
                </div>
              );
            }

            // Slaap
            const sleepVals = last7.filter(l => l.sleep_hours != null).map(l => l.sleep_hours);
            if (sleepVals.length >= 3) {
              const avgSleep = (sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1);
              const under7 = sleepVals.filter(v => v < 7).length;
              if (under7 >= 2) {
                cards.push(
                  <div key="sleep" style={{ padding: '10px 12px', background: 'var(--rust-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--rust)' }}>
                    <strong style={{ fontSize: 12 }}>😴 Slaap aandacht nodig (gem. {avgSleep}u)</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{under7}× onder 7u — voor long covid herstel is ≥7u essentieel.</div>
                  </div>
                );
              } else {
                cards.push(
                  <div key="sleep" style={{ padding: '10px 12px', background: 'var(--sage-l)', borderRadius: 9, marginBottom: 8, borderLeft: '3px solid var(--sage)' }}>
                    <strong style={{ fontSize: 12 }}>😴 Slaap goed op orde (gem. {avgSleep}u)</strong>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Goede basis voor herstel en energiebeheer.</div>
                  </div>
                );
              }
            }

            if (cards.length === 0) {
              cards.push(
                <div key="empty" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, borderLeft: '3px solid var(--muted)' }}>
                  <strong style={{ fontSize: 12 }}>📊 Vul gewicht en energie in</strong>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Zodra je data hebt, verschijnen hier automatisch inzichten over je week.</div>
                </div>
              );
            }

            return cards;
          })()}
        </div>
      </div>
    </div>
  );
}
