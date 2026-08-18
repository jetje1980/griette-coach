import React, { useMemo } from 'react';
import CheckIn from './CheckIn';

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function getISOWeek(dateStr) {
  const d = parseDateKey(dateStr);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function loadTodayPlan(date) {
  try {
    const key = `gc_week_focus_${getISOWeek(date)}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const day = saved.plan?.find(d => d.date === date);
    return { day, checked: saved.checked || {} };
  } catch {
    return { day: null, checked: {} };
  }
}

function readiness(log) {
  if (!log) return { label: 'Nog te bepalen', tone: 'var(--muted)', text: 'Doe je korte check-in; daarna is zichtbaar wat vandaag verstandig is.' };
  const sleep = Number(log.sleep_quality ?? 3);
  const energy = Number(log.energy ?? log.energy_level ?? 3);
  const symptoms = Number(log.symptom_score ?? log.long_covid_symptoms ?? 0);
  if (sleep <= 1 || energy <= 1 || symptoms >= 4) {
    return { label: 'Herstel eerst', tone: 'var(--rust)', text: 'Vandaag niet automatisch opbouwen. Kies herstel of een lichtere variant en beoordeel opnieuw.' };
  }
  if (sleep <= 2 || energy <= 2 || symptoms >= 3) {
    return { label: 'Behoud / licht', tone: 'var(--gold)', text: 'Voer alleen uit als het lichaam rustig blijft; geen extra volume of intensiteit toevoegen.' };
  }
  return { label: 'Plan uitvoeren', tone: 'var(--sage)', text: 'De signalen blokkeren het geplande programma niet. Houd de geplande intensiteit aan.' };
}

export default function DecisionToday(props) {
  const date = props.currentDate || localDateKey();
  const plan = useMemo(() => loadTodayPlan(date), [date, props.logs]);
  const decision = readiness(props.log);
  const sessions = plan.day?.sessions || [];

  return (
    <div>
      <div className="pane" style={{ paddingBottom: 0 }}>
        <div className="card" style={{ border: `1.5px solid ${decision.tone}` }}>
          <div className="card-header">
            <div className="card-accent" style={{ background: decision.tone }} />
            <div className="card-title">Vandaag beslissen</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 5 }}>{decision.label}</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted)', marginBottom: 12 }}>{decision.text}</div>

            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>PLAN VANDAAG</div>
              {sessions.length ? sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', fontSize: 12 }}>
                  <span>{s.emoji} {s.label}</span>
                  <span style={{ color: plan.checked[s.id] ? 'var(--sage)' : 'var(--muted)', fontWeight: 700 }}>{plan.checked[s.id] ? 'ACTUAL ✓' : s.duration}</span>
                </div>
              )) : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Geen training gepland. Open Week om je weekplan te bepalen.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => props.onNavigate?.('week')}>Week bekijken</button>
              <button className="btn btn-sage" style={{ flex: 1 }} onClick={() => props.onNavigate?.('training')}>Naar training</button>
            </div>
          </div>
        </div>
      </div>

      <CheckIn {...props} />
    </div>
  );
}
