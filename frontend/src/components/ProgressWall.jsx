import React, { useMemo } from 'react';
import { getWorkoutResults } from '../decisionEngine';

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}

export default function ProgressWall({logs={}}){
  const results=getWorkoutResults();
  const measures=read('gc_measurements',[]);
  const strength=read('gc_strength_sessions',[]);
  const future=read('gc_future_self',{});
  const buffer=read('gc_money_buffer',{current:0,target:15000});
  const weights=useMemo(()=>Object.values(logs).filter(x=>x.weight).sort((a,b)=>a.date.localeCompare(b.date)),[logs]);
  const firstW=weights[0]?.weight, lastW=weights.at(-1)?.weight;
  const waist=measures.filter(m=>m.waist).sort((a,b)=>a.date.localeCompare(b.date));
  const firstWaist=waist[0]?.waist,lastWaist=waist.at(-1)?.waist;
  const latestRun=results.find(r=>r.status==='ACTUAL');
  const proof=[];
  if(firstW&&lastW) proof.push(`Gewichtstrend ${firstW} → ${lastW} kg`);
  if(firstWaist&&lastWaist) proof.push(`Taille ${firstWaist} → ${lastWaist} cm`);
  if(latestRun) proof.push(`T${latestRun.run_nr} voltooid · besluit ${latestRun.decision||'HOLD'}`);
  if(strength[0]) proof.push(`Kracht gelogd: ${strength[0].exercise}`);
  if(Number(buffer.current)>0) proof.push(`Buffer €${Number(buffer.current).toLocaleString('nl-NL')} / €${Number(buffer.target||15000).toLocaleString('nl-NL')}`);

  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Bewijs dat ik verander</div></div><div className="card-body">
      {proof.length?proof.slice(0,6).map((p,i)=><div key={i} style={{padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>✓ {p}</div>):<div style={{fontSize:12,color:'var(--muted)'}}>Nog weinig bewijs vastgelegd. De Progress Wall vult zich met echte trends, niet met losse dagfluctuaties.</div>}
    </div></div>
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Body composition ≠ alleen gewicht</div></div><div className="card-body" style={{fontSize:12,lineHeight:1.7}}>Coach combineert gewichtstrend met taille, foto’s, kracht, performance en herstel. Stabiel gewicht met kleinere taille en meer kracht kan uitstekende progressie zijn.</div></div>
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">Future Self bewijs</div></div><div className="card-body">{Object.entries(future).filter(([,v])=>v?.vision).map(([k,v])=><div key={k} style={{marginBottom:8,fontSize:12}}><strong>{k}</strong><br/><span style={{color:'var(--muted)'}}>{v.vision}</span></div>)}</div></div>
  </div>;
}
