import React, { useRef, useState } from 'react';
import { evaluateWorkout, saveWorkoutResult } from '../decisionEngine';

async function compress(file){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);const max=1200;let w=img.width,h=img.height;if(w>max||h>max){const f=Math.min(max/w,max/h);w=Math.round(w*f);h=Math.round(h*f)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve({base64:c.toDataURL('image/jpeg',0.82).split(',')[1],mimeType:'image/jpeg'})};img.onerror=reject;img.src=url})}

async function extractWorkout(image){
  const marker=localStorage.getItem('gc_api_key')||'beveiligd-via-coachserver';
  const prompt=`Lees uitsluitend de sportgegevens die zichtbaar zijn op deze screenshot. Geef ALLEEN geldige JSON zonder markdown met velden: activity_type, date, duration_min, distance_km, pace, avg_hr, max_hr, hr_recovery, cadence, elevation_m, splits, zones, confidence. Gebruik null als iets niet zichtbaar is. Doe geen aannames.`;
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':marker,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:700,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:image.mimeType,data:image.base64}},{type:'text',text:prompt}]}]})});
  if(!r.ok) throw new Error(`AI extractie mislukt (${r.status})`);
  const data=await r.json();const text=data.content?.[0]?.text||'{}';const match=text.match(/\{[\s\S]*\}/);return JSON.parse(match?match[0]:text);
}

export default function WorkoutImport({currentDate,showFlash}){
  const fileRef=useRef(null);const [img,setImg]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState(null);
  const pick=async e=>{const file=e.target.files?.[0];if(!file)return;setError('');const image=await compress(file);setImg(image);setDraft(null);setLoading(true);try{const x=await extractWorkout(image);setDraft({...x,date:x.date||currentDate,source:'screenshot',user_confirmed:false})}catch(err){setError(err.message)}setLoading(false);e.target.value=''};
  const patch=(k,v)=>setDraft(p=>({...p,[k]:v}));
  const confirm=()=>{if(!draft)return;const result={id:`import-${Date.now()}`,status:'ACTUAL',date:draft.date||currentDate,activity_type:draft.activity_type||'run',duration_min:draft.duration_min,distance_km:draft.distance_km,pace:draft.pace,avg_hr:draft.avg_hr,max_hr:draft.max_hr,hr_recovery:draft.hr_recovery,cadence:draft.cadence,elevation_m:draft.elevation_m,splits:draft.splits,zones:draft.zones,source:'screenshot',confidence:draft.confidence,user_confirmed:true,completed:true,feedback_complete:false,rpe:null,symptoms_now:0,pain:0};const d=evaluateWorkout(result);saveWorkoutResult({...result,decision:d.decision,decision_reason:d.reason});showFlash?.('✓','Screenshot gecontroleerd en als ACTUAL opgeslagen');setDraft(null);setImg(null)};
  return <div className="pane"><div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Training importeren</div></div><div className="card-body">
    <div style={{fontSize:12,lineHeight:1.6,color:'var(--muted)'}}>Handmatig blijft altijd mogelijk. Screenshot is een gemak: AI extraheert, jij controleert/corrigeert, pas daarna wordt ACTUAL opgeslagen.</div>
    <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/><button className="btn btn-ghost btn-full" onClick={()=>fileRef.current?.click()} style={{marginTop:9}}>Screenshot Garmin / Strava / Apple kiezen</button>
    {loading&&<div style={{marginTop:8}}>Analyseren…</div>}{error&&<div style={{marginTop:8,color:'var(--alert)',fontSize:11}}>{error}</div>}
    {img&&<img alt="workout screenshot" src={`data:${img.mimeType};base64,${img.base64}`} style={{width:'100%',maxHeight:220,objectFit:'contain',marginTop:9,borderRadius:8}}/>}
    {draft&&<div style={{marginTop:10}}>{[['activity_type','Type'],['date','Datum'],['duration_min','Duur min'],['distance_km','Afstand km'],['pace','Pace'],['avg_hr','Gem HR'],['max_hr','Max HR'],['hr_recovery','HR recovery'],['cadence','Cadence'],['elevation_m','Hoogtemeters']].map(([k,l])=><label key={k} style={{display:'block',marginTop:5}}>{l}<input value={draft[k]??''} onChange={e=>patch(k,e.target.value)} style={{width:'100%',boxSizing:'border-box'}}/></label>)}<div style={{fontSize:10,color:'var(--muted)',marginTop:7}}>AI confidence: {draft.confidence??'onbekend'} · bron: screenshot</div><button className="btn btn-sage btn-full" onClick={confirm} style={{marginTop:8}}>Ik heb gecontroleerd → opslaan</button></div>}
  </div></div></div>;
}
