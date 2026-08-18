import React, { useMemo } from 'react';
import { getWorkoutResults } from '../decisionEngine';

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function avg(a){return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}

export default function HeadCoach({logs={}}){
  const values=Object.values(logs).sort((a,b)=>b.date.localeCompare(a.date));
  const recent=values.slice(0,14);
  const workouts=getWorkoutResults();
  const capture=read('gc_capture_items',[]);
  const seasons=read('gc_focus_seasons',{});
  const delayed=workouts.filter(w=>w.feedback_complete).slice(0,8);
  const tolerated=delayed.filter(w=>w.recovered_24_48h==='good' && Number(w.symptoms_24_48h||0)<=1);
  const setbacks=delayed.filter(w=>w.recovered_24_48h==='worse'||Number(w.symptoms_24_48h||0)>=4);
  const sleep=avg(recent.map(x=>Number(x.sleep_hours)).filter(Number.isFinite));
  const energy=avg(recent.map(x=>Number(x.energy??x.energy_level)).filter(Number.isFinite));
  const activeProjects=capture.filter(i=>i.destination==='PROJECT'&&i.status!=='KLAAR').length;
  const primary=Object.entries(seasons).filter(([,v])=>v==='PRIMARY').map(([k])=>k);

  const learning=useMemo(()=>{
    const lines=[];
    if(delayed.length) lines.push(`${tolerated.length}/${delayed.length} recente trainingen waren ook 24–48 uur later goed getolereerd.`);
    if(setbacks.length) lines.push(`${setbacks.length} recente sessie(s) gaf/gaven een duidelijke vertraagde terugslag; performance tijdens de training is dus niet genoeg.`);
    if(sleep) lines.push(`Gemiddelde slaap in ingevoerde recente dagen: ${sleep.toFixed(1)} uur.`);
    if(energy!=null) lines.push(`Gemiddelde energiewaarde in ingevoerde recente dagen: ${energy.toFixed(1)}.`);
    if(activeProjects>5) lines.push(`WIP is hoog met ${activeProjects} actieve projectitems; minder gelijktijdige commitments kan capaciteit vrijmaken.`);
    return lines;
  },[delayed.length,tolerated.length,setbacks.length,sleep,energy,activeProjects]);

  const course=setbacks.length?'Herstelrespons eerst stabiliseren; niet automatisch opbouwen.':tolerated.length>=2?'Opbouw is verdedigbaar als actuele readiness groen blijft.':'Huidige belasting behouden totdat er meer delayed-tolerance bewijs is.';

  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Head Coach · één koers</div></div><div className="card-body">
      <div style={{fontSize:18,fontWeight:900}}>{course}</div>
      <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.65,marginTop:7}}>Coach combineert training, herstel/PEM, perimenopauze-context, body composition, voeding, agenda/capaciteit en executive-function belasting. Geen subcoach overschrijft zelfstandig deze koers.</div>
    </div></div>
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Wat Coach leert</div></div><div className="card-body">{learning.length?learning.map((x,i)=><div key={i} style={{padding:'6px 0',fontSize:12}}>• {x}</div>):<div style={{fontSize:12,color:'var(--muted)'}}>Nog onvoldoende herhaalde data voor persoonlijke patroonconclusies. Coach doet dan geen schijnzekere voorspelling.</div>}</div></div>
    <div className="card"><div className="card-body" style={{fontSize:12,lineHeight:1.7}}><strong>Focus season:</strong> {primary.join(', ')||'nog niet gekozen'}<br/><strong>Actieve project-WIP:</strong> {activeProjects}<br/><span style={{color:'var(--muted)'}}>Medische rode vlaggen worden gesignaleerd voor beoordeling; Coach stelt geen autonome diagnose.</span></div></div>
  </div>;
}
