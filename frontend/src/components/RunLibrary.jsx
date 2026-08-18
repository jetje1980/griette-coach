import React, { useState } from 'react';
import { RUNS } from '../data/runningSchema';
import { getWorkoutResults } from '../decisionEngine';

function typeFor(r){ if(r.milestone) return 'TEST'; if(r.intervals) return 'SPEED'; if(r.walkMin>0) return 'BASE'; return r.duration>=30?'LONG EASY':'ECONOMY'; }
function purpose(type){return ({BASE:'Aerobe basis en tolerantie opbouwen',ECONOMY:'Efficiënter lopen bij dezelfde belasting',SPEED:'Neuromusculaire snelheid prikkelen zonder grote volumestap','LONG EASY':'Duurvermogen rustig uitbreiden',TEST:'Voortgang toetsen zonder racedoel'}[type]||'Basis opbouwen')}

export default function RunLibrary(){
  const [open,setOpen]=useState(null);
  const results=getWorkoutResults();
  return <div className="pane">
    <div className="card"><div className="card-body"><strong>T1–T35 trainingsreeks</strong><div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Alle sessies blijven vindbaar. Coach past uitvoering aan op actuele en vertraagde herstelrespons.</div></div></div>
    {RUNS.map(r=>{const type=typeFor(r);const hist=results.filter(x=>Number(x.run_nr)===r.nr);return <div className="card" key={r.nr}><div className="card-body">
      <button onClick={()=>setOpen(open===r.nr?null:r.nr)} style={{all:'unset',display:'block',width:'100%',cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>T{r.nr} · {r.description}</strong><span style={{fontSize:10,fontWeight:800}}>{type}</span></div><div style={{fontSize:10,color:'var(--muted)',marginTop:3}}>Week {r.week} · verwacht {r.duration} min · {hist.length} resultaat/resultaten</div></button>
      {open===r.nr&&<div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',fontSize:11,lineHeight:1.65}}>
        <div><strong>Doel:</strong> {purpose(type)}</div>
        <div><strong>Warming-up:</strong> 5–10 min zeer rustig bewegen, pas daarna het kernblok.</div>
        <div><strong>Kern:</strong> {r.description}</div>
        <div><strong>Run/walk:</strong> {r.jogMin} min lopen · {r.walkMin} min wandelen{r.intervals?` · ${r.intervals}`:''}</div>
        <div><strong>Intensiteit:</strong> gesprekstempo / individueel afgesproken HR-kader; RPE meestal 3–5 bij easy werk.</div>
        <div><strong>Cooling-down:</strong> 5–10 min wandelen en normale ademhaling laten terugkomen.</div>
        <div><strong>Aanpassen:</strong> bij lage readiness volume/intensiteit verlagen; nooit beide tegelijk verhogen.</div>
        <div><strong>Stopcriteria:</strong> duidelijke verslechtering van klachten, pijn, duizeligheid, onverwachte cardiorespiratoire respons of rode vlaggen.</div>
        <div><strong>Geslaagd:</strong> niet alleen de sessie zelf; ook de 6–48u respons moet voldoende stabiel zijn.</div>
        {hist.slice(0,3).map(h=><div key={h.id} style={{marginTop:7,padding:8,background:'var(--bg)',borderRadius:7}}><strong>{h.date} · {h.decision||'HOLD'}</strong><br/>{h.distance_km||'—'} km · HR {h.avg_hr||'—'} · RPE {h.rpe||'—'}<br/><span style={{color:'var(--muted)'}}>{h.decision_reason}</span></div>)}
      </div>}
    </div></div>})}
  </div>;
}
