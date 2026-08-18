import React, { useMemo, useState } from 'react';

const BLEEDING=['Geen','Spotting','Licht','Normaal','Zwaar'];
function readStarts(){try{return JSON.parse(localStorage.getItem('gc_cycle_starts')||'[]')}catch{return[]}}
function writeStarts(v){localStorage.setItem('gc_cycle_starts',JSON.stringify(v))}
function dayDiff(a,b){return Math.floor((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000)}

export default function CycleContext({log,saveField,currentDate}){
  const [starts,setStarts]=useState(readStarts);
  const bleeding=log?.bleeding||'Geen';
  const latestStart=useMemo(()=>starts.filter(d=>d<=currentDate).sort().at(-1)||null,[starts,currentDate]);
  const cycleDay=latestStart?dayDiff(currentDate,latestStart)+1:null;
  const startPeriod=()=>{const next=[...new Set([...starts,currentDate])].sort();setStarts(next);writeStarts(next);saveField('period_start',true);saveField('bleeding',bleeding==='Geen'?'Normaal':bleeding)};
  const lengths=starts.length>1?starts.slice(1).map((d,i)=>dayDiff(d,starts[i])):[];
  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">Perimenopauze-context</div></div><div className="card-body">
      <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.6,marginBottom:8}}>Track jouw patroon; geen rigide cyclusregel bepaalt automatisch je training.</div>
      <div style={{fontSize:11,fontWeight:800,marginBottom:5}}>Bloeding vandaag</div><div style={{display:'flex',flexWrap:'wrap',gap:5}}>{BLEEDING.map(v=><button className="btn btn-sm" key={v} onClick={()=>saveField('bleeding',v)} style={{fontWeight:bleeding===v?800:500}}>{v}</button>)}</div>
      <button className="btn btn-ghost btn-full" onClick={startPeriod} style={{marginTop:9}}>Nieuwe menstruatie gestart? → dag 1</button>
      <div style={{marginTop:9,fontSize:12}}>{cycleDay?<>Berekende cyclusdag: <strong>{cycleDay}</strong></>:<>Nog geen cyclusdag berekend.</>}</div>
      {lengths.length>0&&<div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>Recente cycluslengtes: {lengths.slice(-6).join(' · ')} dagen</div>}
    </div></div>
    <div className="card"><div className="card-body">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
        <label>Energie<input type="number" min="0" max="5" value={log?.hormone_energy??''} onChange={e=>saveField('hormone_energy',e.target.value===''?null:Number(e.target.value))}/></label>
        <label>Breinmist<input type="number" min="0" max="5" value={log?.brain_fog??''} onChange={e=>saveField('brain_fog',e.target.value===''?null:Number(e.target.value))}/></label>
        <label>Gewrichten<input type="number" min="0" max="5" value={log?.joint_symptoms??''} onChange={e=>saveField('joint_symptoms',e.target.value===''?null:Number(e.target.value))}/></label>
        <label>Opvliegers<input type="number" min="0" max="5" value={log?.hot_flashes??''} onChange={e=>saveField('hot_flashes',e.target.value===''?null:Number(e.target.value))}/></label>
      </div>
    </div></div>
  </div>;
}
