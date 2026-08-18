import React, { useMemo, useState } from 'react';
import { evaluateWorkout, getRun, getWorkoutResults, nextRunNumber, saveWorkoutResult } from '../decisionEngine';

function nowDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export default function TrainingDecisionPanel({ currentDate = nowDate(), showFlash }) {
  const [version, setVersion] = useState(0);
  const results = useMemo(() => getWorkoutResults(), [version]);
  const suggestedNr = nextRunNumber(results);
  const run = getRun(suggestedNr);
  const [form, setForm] = useState({
    run_nr: suggestedNr,
    date: currentDate,
    completed: true,
    duration_min: run.duration,
    distance_km: '',
    avg_hr: '',
    max_hr: '',
    rpe: 5,
    symptoms_now: 0,
    pain: 0,
    hr_unexpected: false,
    could_more: 'yes',
    note: '',
  });
  const [followId, setFollowId] = useState(null);
  const [follow, setFollow] = useState({ symptoms_24_48h: 0, recovered_24_48h: 'good', note_24_48h: '' });

  const set = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const saveNow = () => {
    const provisional = evaluateWorkout({ ...form, feedback_complete: false });
    const result = {
      ...form,
      id: `run-${form.run_nr}-${form.date}`,
      status: 'ACTUAL',
      completed_at: new Date().toISOString(),
      feedback_complete: false,
      decision: provisional.decision,
      decision_reason: provisional.reason,
    };
    saveWorkoutResult(result);
    setVersion(v => v + 1);
    showFlash?.('✓', `T${form.run_nr} als ACTUAL opgeslagen`);
  };

  const saveFollow = (item) => {
    const full = { ...item, ...follow, feedback_complete: true };
    const final = evaluateWorkout(full);
    saveWorkoutResult({ ...full, decision: final.decision, decision_reason: final.reason });
    setFollowId(null);
    setVersion(v => v + 1);
    showFlash?.('🧭', `${final.decision}: ${final.reason}`);
  };

  const latest = results[0];
  const next = getRun(nextRunNumber(results));

  return (
    <div className="pane">
      <div className="card">
        <div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Trainingsbeslisser</div></div>
        <div className="card-body">
          <div style={{fontSize:11,color:'var(--muted)',marginBottom:5}}>VOLGENDE HARDLOOPSESSIE</div>
          <div style={{fontSize:18,fontWeight:800}}>T{next.nr} · {next.description}</div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Week {next.week} · {next.duration} min · schema T1–T35</div>
          {latest && <div style={{marginTop:10,padding:10,borderRadius:9,background:'var(--bg)',fontSize:12}}><strong>Laatste besluit: {latest.decision || 'HOLD'}</strong><br/><span style={{color:'var(--muted)'}}>{latest.decision_reason || 'Nog geen definitief 24–48u besluit.'}</span></div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">WorkoutResult · PLAN → ACTUAL</div></div>
        <div className="card-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <label>T-nummer<input type="number" min="1" max="35" value={form.run_nr} onChange={e=>set('run_nr',Number(e.target.value))}/></label>
            <label>Datum<input type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></label>
            <label>Duur (min)<input type="number" value={form.duration_min} onChange={e=>set('duration_min',e.target.value)}/></label>
            <label>Afstand (km)<input type="number" step="0.01" value={form.distance_km} onChange={e=>set('distance_km',e.target.value)}/></label>
            <label>Gem. HR<input type="number" value={form.avg_hr} onChange={e=>set('avg_hr',e.target.value)}/></label>
            <label>Max HR<input type="number" value={form.max_hr} onChange={e=>set('max_hr',e.target.value)}/></label>
          </div>
          <div style={{marginTop:10}}><strong>RPE {form.rpe}/10</strong><input type="range" min="1" max="10" value={form.rpe} onChange={e=>set('rpe',Number(e.target.value))} style={{width:'100%'}}/></div>
          <div style={{marginTop:10}}><strong>Klachten direct {form.symptoms_now}/5</strong><input type="range" min="0" max="5" value={form.symptoms_now} onChange={e=>set('symptoms_now',Number(e.target.value))} style={{width:'100%'}}/></div>
          <div style={{marginTop:10}}><strong>Pijn {form.pain}/10</strong><input type="range" min="0" max="10" value={form.pain} onChange={e=>set('pain',Number(e.target.value))} style={{width:'100%'}}/></div>
          <label style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}><input type="checkbox" checked={form.hr_unexpected} onChange={e=>set('hr_unexpected',e.target.checked)}/> Hartslag onverwacht hoog/afwijkend</label>
          <label style={{display:'block',marginTop:10}}>Had je nog marge?<select value={form.could_more} onChange={e=>set('could_more',e.target.value)}><option value="yes">Ja</option><option value="maybe">Misschien</option><option value="no">Nee</option></select></label>
          <textarea rows="3" placeholder="Korte notitie over benen, ademhaling, energie, omstandigheden…" value={form.note} onChange={e=>set('note',e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:10}}/>
          <button className="btn btn-sage btn-full" onClick={saveNow} style={{marginTop:10}}>Bevestig als ACTUAL</button>
          <div style={{fontSize:10,color:'var(--muted)',marginTop:7}}>Na opslaan blijft het besluit voorlopig HOLD totdat de 24–48u-reactie is ingevuld.</div>
        </div>
      </div>

      {results.slice(0,8).map(item => (
        <div className="card" key={item.id}>
          <div className="card-body">
            <div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>T{item.run_nr} · {item.date}</strong><strong>{item.decision || 'HOLD'}</strong></div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{item.duration_min || '—'} min · {item.distance_km || '—'} km · HR {item.avg_hr || '—'} · RPE {item.rpe || '—'}</div>
            <div style={{fontSize:11,marginTop:6}}>{item.decision_reason}</div>
            {!item.feedback_complete && <button className="btn btn-ghost btn-full" style={{marginTop:8}} onClick={()=>{setFollowId(item.id);setFollow({symptoms_24_48h:0,recovered_24_48h:'good',note_24_48h:''});}}>24–48u feedback toevoegen</button>}
            {followId === item.id && <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
              <div><strong>Klachten 24–48u: {follow.symptoms_24_48h}/5</strong><input type="range" min="0" max="5" value={follow.symptoms_24_48h} onChange={e=>setFollow(p=>({...p,symptoms_24_48h:Number(e.target.value)}))} style={{width:'100%'}}/></div>
              <label>Herstel<select value={follow.recovered_24_48h} onChange={e=>setFollow(p=>({...p,recovered_24_48h:e.target.value}))}><option value="good">Goed hersteld</option><option value="same">Nog hetzelfde</option><option value="worse">Slechter / terugslag</option></select></label>
              <textarea rows="2" placeholder="Wat merkte je de dag(en) erna?" value={follow.note_24_48h} onChange={e=>setFollow(p=>({...p,note_24_48h:e.target.value}))} style={{width:'100%',boxSizing:'border-box',marginTop:8}}/>
              <button className="btn btn-sage btn-full" onClick={()=>saveFollow(item)} style={{marginTop:8}}>Laat coach beslissen</button>
            </div>}
          </div>
        </div>
      ))}
    </div>
  );
}
