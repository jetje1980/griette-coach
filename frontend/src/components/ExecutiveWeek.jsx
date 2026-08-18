import React, { useMemo } from 'react';

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}

export default function ExecutiveWeek(){
  const capture=read('gc_capture_items',[]);
  const future=read('gc_future_self',{});
  const seasons=read('gc_focus_seasons',{});
  const bottleneck=localStorage.getItem('gc_month_bottleneck')||'';
  const weekItems=useMemo(()=>capture.filter(i=>i.status!=='KLAAR'&&(i.destination==='WEEK'||i.destination==='TODAY'||i.status==='OPEN')).slice(0,8),[capture]);
  const activeProjects=useMemo(()=>capture.filter(i=>i.destination==='PROJECT'&&i.status!=='KLAAR'),[capture]);
  const workWip=activeProjects.slice(0,3);
  const privateWip=activeProjects.slice(3,5);
  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Executive weekview</div></div><div className="card-body">
      <div style={{fontSize:11,color:'var(--muted)'}}>PRIMARY</div>{Object.entries(seasons).filter(([,v])=>v==='PRIMARY').map(([d])=><div key={d} style={{fontWeight:800,marginTop:4}}>{d} · {future[d]?.vision||'focus'}</div>)}
      {bottleneck&&<div style={{marginTop:9,padding:9,background:'var(--bg)',borderRadius:8,fontSize:12}}><strong>Bottleneck:</strong> {bottleneck}</div>}
    </div></div>
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Aandacht deze week</div></div><div className="card-body">{weekItems.length?weekItems.map(i=><div key={i.id} style={{padding:'5px 0',fontSize:12}}>• {i.title} <span style={{color:'var(--muted)'}}>({i.destination||i.status})</span></div>):<div style={{fontSize:12,color:'var(--muted)'}}>Geen extra weekitems. Dat mag.</div>}</div></div>
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">WIP-limiet</div></div><div className="card-body" style={{fontSize:12,lineHeight:1.7}}>Werk: {workWip.length}/3 actief · Privé: {privateWip.length}/2 actief. Nieuwe projecten horen eerst langs de vraag: moet dit nu, onderhouden we dit, of is het NOT NOW?</div></div>
    <div className="card"><div className="card-body" style={{fontSize:12,lineHeight:1.7}}><strong>Vrije tijd is een KPI.</strong><br/><span style={{color:'var(--muted)'}}>Laat oningevulde ruimte bewust bestaan. Coach vult vrije blokken niet automatisch met taken of training.</span></div></div>
  </div>;
}
