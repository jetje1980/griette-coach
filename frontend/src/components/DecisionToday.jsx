import React, { useMemo, useState } from 'react';
import CheckIn from './CheckIn';
import { getWorkoutResults } from '../decisionEngine';

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseDateKey(dateStr){const [y,m,d]=dateStr.split('-').map(Number);return new Date(y,m-1,d,12,0,0)}
function getISOWeek(dateStr){const d=parseDateKey(dateStr);const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));const week=Math.ceil((((t-ys)/86400000)+1)/7);return `${t.getUTCFullYear()}-W${String(week).padStart(2,'0')}`}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function loadTodayPlan(date){const saved=read(`gc_week_focus_${getISOWeek(date)}`,{});const day=saved.plan?.find(d=>d.date===date);return {day,checked:saved.checked||{}}}

function readiness(log, lastWorkout){
  if(!log) return {code:'AMBER',label:'AMBER — CHECK-IN NODIG',tone:'var(--gold)',text:'Vul eerst je korte check-in in. Zonder actuele hersteldata bouwt Coach niet automatisch op.'};
  const sleep=Number(log.sleep_quality??3), energy=Number(log.energy??log.energy_level??3), symptoms=Number(log.symptom_score??log.long_covid_symptoms??0);
  const brain=Number(log.brain_fog??0), pain=Number(log.pain??0);
  if(log.red_flag===true || symptoms>=5 || pain>=7) return {code:'RED',label:'RED — STOP & REVIEW',tone:'var(--alert)',text:'Niet trainen. Dit patroon vraagt eerst herbeoordeling; bij medische rode vlaggen medische beoordeling zoeken.'};
  if(lastWorkout && lastWorkout.feedback_complete && (lastWorkout.symptoms_24_48h>=4 || lastWorkout.recovered_24_48h==='worse')) return {code:'BLUE',label:'BLUE — RECOVERY',tone:'var(--rust)',text:'De vertraagde respons op de vorige training weegt zwaarder dan hoe die sessie zelf voelde. Herstel staat voorop.'};
  if(sleep<=1 || energy<=1 || symptoms>=4 || brain>=4) return {code:'BLUE',label:'BLUE — RECOVERY',tone:'var(--rust)',text:'Capaciteit is te laag voor normale opbouw. Kies minimum viable self-care en herstelvriendelijke beweging.'};
  if(sleep<=2 || energy<=2 || symptoms>=2 || brain>=2) return {code:'AMBER',label:'AMBER — MODIFY',tone:'var(--gold)',text:'Wel bewegen kan passen, maar volume of intensiteit moet omlaag. Nooit beide tegelijk verhogen.'};
  return {code:'GREEN',label:'GREEN — TRAIN',tone:'var(--sage)',text:'De beschikbare signalen laten uitvoering van het normale plan toe. Delayed tolerance blijft onderdeel van de beoordeling.'};
}

function getCaptureTop(){const items=read('gc_capture_items',[]);return items.filter(i=>i.status!=='KLAAR'&&i.status!=='PARKEREN').slice(0,3)}

export default function DecisionToday(props){
  const date=props.currentDate||localDateKey();
  const plan=useMemo(()=>loadTodayPlan(date),[date,props.logs]);
  const results=getWorkoutResults();
  const lastWorkout=results[0];
  const decision=readiness(props.log,lastWorkout);
  const sessions=plan.day?.sessions||[];
  const capture=getCaptureTop();
  const [expanded,setExpanded]=useState(false);
  const [transition,setTransition]=useState(()=>read('gc_transition_state',{state:'GEREGULEERD',prepare:'',transition:'',do:'',recover:''}));
  const saveTransition=(k,v)=>{const n={...transition,[k]:v};setTransition(n);localStorage.setItem('gc_transition_state',JSON.stringify(n))};

  const top3=[...sessions.slice(0,1).map(s=>`${s.label} · ${s.duration}`),...capture.map(i=>i.title)].slice(0,3);
  const whatNow=top3[0] || (decision.code==='BLUE'?'10 min rustige herstelactiviteit':'Kies één concrete volgende actie van 5–30 min');
  const lastDataDate=Object.keys(props.logs||{}).sort().at(-1);
  const daysAway=lastDataDate?Math.floor((parseDateKey(date)-parseDateKey(lastDataDate))/86400000):0;

  return <div>
    <div className="pane" style={{paddingBottom:0}}>
      {daysAway>=4&&<div className="card"><div className="card-body"><strong>Welkom terug</strong><div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Geen achterstand inhalen. We starten opnieuw vanaf vandaag met één haalbare stap.</div></div></div>}
      <div className="card" style={{border:`1.5px solid ${decision.tone}`}}><div className="card-header"><div className="card-accent" style={{background:decision.tone}}/><div className="card-title">Decision Cockpit</div></div><div className="card-body">
        <div style={{fontSize:21,fontWeight:900,marginBottom:5}}>{decision.label}</div>
        <div style={{fontSize:12,lineHeight:1.6,color:'var(--muted)'}}>{decision.text}</div>
        <div style={{marginTop:12,padding:10,background:'var(--bg)',borderRadius:9}}><div style={{fontSize:10,fontWeight:800,color:'var(--muted)'}}>WAT NU?</div><div style={{fontSize:16,fontWeight:800,marginTop:3}}>{whatNow}</div></div>
      </div></div>

      <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Top 3 vandaag</div></div><div className="card-body">{top3.length?top3.map((x,i)=><div key={i} style={{padding:'6px 0',fontSize:12}}><strong>{i+1}.</strong> {x}</div>):<div style={{fontSize:12,color:'var(--muted)'}}>Geen drie verplichte taken nodig. Eén goede keuze is genoeg.</div>}<div style={{marginTop:8,fontSize:10,color:'var(--muted)'}}>MUST / SHOULD / COULD: maximaal drie echte prioriteiten. Protected free time blijft leeg tenzij jij hem bewust vult.</div></div></div>

      <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--sage)'}}/><div className="card-title">Plan vandaag</div></div><div className="card-body">{sessions.length?sessions.map(s=><div key={s.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'5px 0',fontSize:12}}><span>{s.emoji} {s.label}</span><span style={{fontWeight:700,color:plan.checked[s.id]?'var(--sage)':'var(--muted)'}}>{plan.checked[s.id]?'ACTUAL ✓':s.duration}</span></div>):<div style={{fontSize:12,color:'var(--muted)'}}>Geen training gepland. Open Week om de weekbeslissing te maken.</div>}<div style={{display:'flex',gap:8,marginTop:9}}><button className="btn btn-ghost" style={{flex:1}} onClick={()=>props.onNavigate?.('week')}>Week</button><button className="btn btn-sage" style={{flex:1}} onClick={()=>props.onNavigate?.('training')}>Training</button></div></div></div>

      <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">Transition Coach</div></div><div className="card-body">
        <div style={{display:'flex',gap:5}}>{['AAN','UIT','GEREGULEERD'].map(s=><button key={s} className="btn btn-sm" onClick={()=>saveTransition('state',s)} style={{fontWeight:transition.state===s?800:500}}>{s}</button>)}</div>
        <button className="btn btn-ghost btn-full" onClick={()=>setExpanded(!expanded)} style={{marginTop:8}}>{expanded?'Verberg overgang':'Maak overgang concreet'}</button>
        {expanded&&<div style={{marginTop:8}}>{[['prepare','PREPARE · wat moet klaarstaan?'],['transition','TRANSITION · hoe kom je uit je huidige toestand?'],['do','DO · kleinste duidelijke uitvoering'],['recover','RECOVER · hoe sluit je af?']].map(([k,p])=><input key={k} value={transition[k]} onChange={e=>saveTransition(k,e.target.value)} placeholder={p} style={{width:'100%',boxSizing:'border-box',marginTop:5}}/>)}</div>}
      </div></div>
    </div>
    <CheckIn {...props}/>
  </div>;
}
