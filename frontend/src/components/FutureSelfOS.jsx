import React, { useMemo, useState } from 'react';

const DOMAINS = ['BODY','RUN','LOOK / FRESHNESS','MONEY','TIME / FREEDOM','LIFE / WORK'];
const SEASONS = ['PRIMARY','MAINTAIN','NOT NOW'];

function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export default function FutureSelfOS() {
  const [goals,setGoals] = useState(()=>read('gc_future_self', {}));
  const [season,setSeason] = useState(()=>read('gc_focus_seasons', {}));
  const [bottleneck,setBottleneck] = useState(()=>localStorage.getItem('gc_month_bottleneck') || '');
  const [buffer,setBuffer] = useState(()=>read('gc_money_buffer',{current:'',monthly:'',target:15000}));

  const patchGoal=(d,k,v)=>{const next={...goals,[d]:{...(goals[d]||{}),[k]:v}};setGoals(next);write('gc_future_self',next)};
  const patchSeason=(d,v)=>{const next={...season,[d]:v};setSeason(next);write('gc_focus_seasons',next)};
  const activePrimary=useMemo(()=>DOMAINS.filter(d=>season[d]==='PRIMARY'),[season]);

  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Future Self</div></div><div className="card-body">
      <div style={{fontSize:12,lineHeight:1.6,color:'var(--muted)'}}>Van 1 jaar naar 6 maanden, 3 maanden, maand, week en vandaag. Niet alles hoeft tegelijk maximaal te groeien.</div>
    </div></div>

    {DOMAINS.map(d=><div className="card" key={d}><div className="card-body">
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}><strong>{d}</strong><select value={season[d]||'MAINTAIN'} onChange={e=>patchSeason(d,e.target.value)}>{SEASONS.map(s=><option key={s}>{s}</option>)}</select></div>
      <input value={goals[d]?.vision||''} onChange={e=>patchGoal(d,'vision',e.target.value)} placeholder="Gewenste situatie in één zin" style={{width:'100%',boxSizing:'border-box',marginTop:8}}/>
      <input value={goals[d]?.metric1||''} onChange={e=>patchGoal(d,'metric1',e.target.value)} placeholder="Meetpunt 1" style={{width:'100%',boxSizing:'border-box',marginTop:6}}/>
      <input value={goals[d]?.metric2||''} onChange={e=>patchGoal(d,'metric2',e.target.value)} placeholder="Meetpunt 2" style={{width:'100%',boxSizing:'border-box',marginTop:6}}/>
      <textarea rows="2" value={goals[d]?.today||''} onChange={e=>patchGoal(d,'today',e.target.value)} placeholder="Wat betekent dit vandaag?" style={{width:'100%',boxSizing:'border-box',marginTop:6}}/>
    </div></div>)}

    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Focus Season & bottleneck</div></div><div className="card-body">
      {activePrimary.length>1 && <div className="alert-box orange" style={{marginBottom:10}}>Je hebt {activePrimary.length} PRIMARY-domeinen. Kies bij voorkeur één dominante focus.</div>}
      <label>Belangrijkste rem deze maand<textarea rows="2" value={bottleneck} onChange={e=>{setBottleneck(e.target.value);localStorage.setItem('gc_month_bottleneck',e.target.value)}} style={{width:'100%',boxSizing:'border-box'}}/></label>
    </div></div>

    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">Financiële rust</div></div><div className="card-body">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><label>Huidige buffer<input type="number" value={buffer.current} onChange={e=>{const n={...buffer,current:e.target.value};setBuffer(n);write('gc_money_buffer',n)}}/></label><label>Per maand<input type="number" value={buffer.monthly} onChange={e=>{const n={...buffer,monthly:e.target.value};setBuffer(n);write('gc_money_buffer',n)}}/></label></div>
      <div style={{marginTop:8,fontSize:12}}><strong>Doel €{Number(buffer.target||15000).toLocaleString('nl-NL')}</strong> · resterend €{Math.max(0,Number(buffer.target||15000)-Number(buffer.current||0)).toLocaleString('nl-NL')}</div>
    </div></div>
  </div>;
}
