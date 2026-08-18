import React, { useMemo, useState } from 'react';

const PATTERNS=['Squat / lunge','Hinge','Hip thrust / glutes','Push','Pull','Core / carry','Calves / feet'];
function read(){try{return JSON.parse(localStorage.getItem('gc_strength_sessions')||'[]')}catch{return[]}}
function write(v){localStorage.setItem('gc_strength_sessions',JSON.stringify(v))}

export default function StrengthTracker({currentDate}){
  const [items,setItems]=useState(read);
  const [form,setForm]=useState({date:currentDate,pattern:PATTERNS[0],exercise:'',weight:'',reps:'',sets:'',rir:'',rpe:''});
  const patch=(k,v)=>setForm(p=>({...p,[k]:v}));
  const add=()=>{if(!form.exercise.trim())return;const next=[{...form,id:crypto.randomUUID?.()||String(Date.now()),source:'Coach',status:'ACTUAL',createdAt:new Date().toISOString()},...items];setItems(next);write(next);setForm(p=>({...p,exercise:'',weight:'',reps:'',sets:'',rir:'',rpe:''}))};
  const history=useMemo(()=>items.slice(0,20),[items]);
  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Kracht · progressive overload</div></div><div className="card-body">
      <select value={form.pattern} onChange={e=>patch('pattern',e.target.value)} style={{width:'100%'}}>{PATTERNS.map(p=><option key={p}>{p}</option>)}</select>
      <input value={form.exercise} onChange={e=>patch('exercise',e.target.value)} placeholder="Oefening" style={{width:'100%',boxSizing:'border-box',marginTop:7}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:7}}><input type="number" value={form.weight} onChange={e=>patch('weight',e.target.value)} placeholder="kg"/><input type="number" value={form.reps} onChange={e=>patch('reps',e.target.value)} placeholder="reps"/><input type="number" value={form.sets} onChange={e=>patch('sets',e.target.value)} placeholder="sets"/><input type="number" value={form.rir} onChange={e=>patch('rir',e.target.value)} placeholder="RIR"/><input type="number" value={form.rpe} onChange={e=>patch('rpe',e.target.value)} placeholder="RPE"/></div>
      <button className="btn btn-sage btn-full" onClick={add} style={{marginTop:8}}>Set/werkblok opslaan</button>
    </div></div>
    {history.map(i=><div className="card" key={i.id}><div className="card-body"><strong>{i.exercise}</strong> · {i.pattern}<div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{i.date} · {i.weight||'—'} kg · {i.sets||'—'}×{i.reps||'—'} · RIR {i.rir||'—'} · RPE {i.rpe||'—'}</div></div></div>)}
  </div>;
}
