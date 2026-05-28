import React from 'react';
import { TIPS } from '../data/tips';

const MEAL_TIPS = [
  { time: 'Ontbijt', idea: 'Griekse yoghurt + bessen + noten (30g eiwit)', note: 'Eet rustig, Mounjaro verhoogt verzadiging' },
  { time: 'Lunch', idea: 'Grote salade met ei of kip + kikkererwten', note: 'Kleur en vezels = betere energie' },
  { time: 'Avond', idea: 'Zalm/kip + stoofgroenten + kleine portie quinoa', note: 'Eet voor 18u voor optimale vertering' },
  { time: 'Snack', idea: 'Handje noten + 1 stuk fruit óf kwark', note: 'Stabiliseert bloedsuiker' },
];

export default function Eten({ tip, dayNum }) {
  const allTips = TIPS;
  const todayTip = allTips[(dayNum - 1) % allTips.length];

  return (
    <div className="pane">
      {/* Dagelijkse tip */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">💡 Voedingstip — dag {dayNum}</div>
        </div>
        <div className="card-body">
          <div className="tip-box">{todayTip}</div>
        </div>
      </div>

      {/* Maaltijdideeën */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--rust)' }} />
          <div className="card-title">🍽️ Maaltijdideeën</div>
        </div>
        <div className="card-body">
          {MEAL_TIPS.map((m, i) => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, #FBF8F2, #F4EFE5)',
              border: '1px solid var(--border)',
              borderRadius: 11,
              padding: 12,
              marginBottom: 8
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--rust)', letterSpacing: 1, marginBottom: 3 }}>{m.time.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.idea}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mounjaro tips */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--sage)' }} />
          <div className="card-title">💊 Mounjaro & eten</div>
        </div>
        <div className="card-body">
          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text)' }}>
            <div>• Eet <strong>langzaam</strong> — zet je vork neer tussen happen</div>
            <div>• Kleine <strong>frequente maaltijden</strong> (3–5/dag)</div>
            <div>• <strong>Eiwit eerst</strong> op je bord, daarna groenten, dan koolhydraten</div>
            <div>• Stop bij <strong>eerste verzadiging</strong> — je bent sneller vol</div>
            <div>• Drink geen <strong>grote hoeveelheden</strong> vlak voor of na het eten</div>
            <div>• Bewaar je <strong>spier</strong>: min 1.2g eiwit per kg lichaamsgewicht per dag</div>
          </div>
        </div>
      </div>

      {/* Alle tips overzicht */}
      <div className="card">
        <div className="card-header">
          <div className="card-accent" style={{ background: 'var(--gold)' }} />
          <div className="card-title">📚 Alle 70 voedingstips</div>
        </div>
        <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {allTips.map((t, i) => (
            <div key={i} style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
              fontSize: 11,
              lineHeight: 1.5,
              color: i === (dayNum - 1) % allTips.length ? 'var(--rust)' : 'var(--text)',
              fontWeight: i === (dayNum - 1) % allTips.length ? 600 : 400
            }}>
              <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginRight: 6, fontSize: 10 }}>{i + 1}.</span>
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
