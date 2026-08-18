import React, { useMemo, useState } from 'react';
import CaptureCenter from './CaptureCenter';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('gc-workspace-change'));
}

function useWorkspaceState() {
  const [, force] = useState(0);
  React.useEffect(() => {
    const fn = () => force(v => v + 1);
    window.addEventListener('gc-workspace-change', fn);
    window.addEventListener('storage', fn);
    return () => { window.removeEventListener('gc-workspace-change', fn); window.removeEventListener('storage', fn); };
  }, []);
}

const NAV = ['Ritme', 'Agenda', 'Taken', 'Capture', 'Focus', 'Later'];

function Section({ title, subtitle, children }) {
  return <section className="adhd-section">
    <div className="adhd-section-head">
      <h2>{title}</h2>
      {subtitle && <span>{subtitle}</span>}
    </div>
    {children}
  </section>;
}

function TimelineRow({ date, title, detail, tone='blue' }) {
  return <div className="adhd-timeline-row">
    <div className={`adhd-line ${tone}`} />
    <div className="adhd-date">{date}</div>
    <div className="adhd-event"><strong>{title}</strong>{detail && <div>{detail}</div>}</div>
  </div>;
}

function Ritme() {
  const rhythm = read('gc_rhythm_blocks', [
    { label: 'Ochtend', text: 'Rustig starten · check-in · één eerste actie', tone: 'blue' },
    { label: 'Werk', text: 'Maximaal 3 actieve hoofdprojecten · pauzes bewaken', tone: 'green' },
    { label: 'Overgang', text: 'PREPARE → TRANSITION → DO → RECOVER', tone: 'gold' },
    { label: 'Avond', text: 'Protected free time blijft leeg tenzij bewust gekozen', tone: 'blue' },
  ]);
  return <div className="adhd-page">
    <Section title="Ritme" subtitle="energie + frictie, niet alleen tijd">
      <div className="adhd-summary">Je dag hoeft niet vol. Het doel is dat overgangen makkelijker worden en dat belangrijke dingen daadwerkelijk beginnen.</div>
      {rhythm.map((r,i)=><div className="adhd-block" key={i}><div className={`adhd-block-bar ${r.tone}`} /><div><strong>{r.label}</strong><p>{r.text}</p></div></div>)}
    </Section>
    <Section title="Minimum viable self-care">
      <div className="adhd-two-col">
        <div className="adhd-stat"><b>MINIMUM</b><span>kleinste versie die telt</span></div>
        <div className="adhd-stat"><b>NORMAL</b><span>normale uitvoering</span></div>
        <div className="adhd-stat"><b>HIGH</b><span>extra als er ruimte is</span></div>
        <div className="adhd-stat"><b>RECOVERY</b><span>herstelvariant</span></div>
      </div>
    </Section>
  </div>;
}

function Agenda() {
  const blocks = read('gc_manual_agenda', []);
  const [text,setText]=useState(''); const [when,setWhen]=useState('');
  const add=()=>{if(!text.trim())return;save('gc_manual_agenda',[...blocks,{id:crypto.randomUUID?.()||Date.now(),when,title:text.trim()}]);setText('');setWhen('');};
  return <div className="adhd-page">
    <Section title="Agenda" subtitle="tijd is een constraint, geen takenlijst">
      <div className="adhd-summary">Google Calendar is de bron voor echte tijd. Hier kun je alleen context noteren die de Coach nodig heeft, zonder een tweede kalender te bouwen.</div>
      <div className="adhd-inline-inputs"><input value={when} onChange={e=>setWhen(e.target.value)} placeholder="bijv. di 14:00"/><input value={text} onChange={e=>setText(e.target.value)} placeholder="context / blok"/><button onClick={add}>+</button></div>
      {blocks.length ? blocks.map(b=><TimelineRow key={b.id} date={b.when||'—'} title={b.title}/>) : <div className="adhd-empty">Geen handmatige context toegevoegd.</div>}
    </Section>
  </div>;
}

function Taken() {
  const items = read('gc_capture_items', []);
  const active = items.filter(i=>i.status!=='KLAAR' && i.status!=='PARKEREN');
  const grouped = {
    Vandaag: active.filter(i=>i.destination==='TODAY'),
    'Deze week': active.filter(i=>i.destination==='WEEK'),
    Project: active.filter(i=>i.destination==='PROJECT'||i.destination==='TRELLO'),
    Onbeslist: active.filter(i=>!i.destination),
  };
  const patch=(id,data)=>save('gc_capture_items',items.map(i=>i.id===id?{...i,...data,updatedAt:new Date().toISOString()}:i));
  return <div className="adhd-page">
    <Section title="Taken" subtitle={`${active.length} actief`}>
      <div className="adhd-summary">Niet alles is een prioriteit. Vandaag maximaal 3 echte acties; de rest blijft zichtbaar zonder je aandacht op te eisen.</div>
      {Object.entries(grouped).map(([name,list])=>list.length?<div className="adhd-task-group" key={name}><h3>{name} <span>{list.length}</span></h3>{list.map(i=><div className="adhd-task" key={i.id}><button className="adhd-check" onClick={()=>patch(i.id,{status:'KLAAR'})}>○</button><div><strong>{i.title}</strong><small>{i.source||'Capture'}{i.syncState==='not_configured'?' · externe sync nog niet gekoppeld':''}</small></div></div>)}</div>:null)}
      {!active.length && <div className="adhd-empty">Geen actieve taken.</div>}
    </Section>
  </div>;
}

function Focus() {
  const seasons = read('gc_focus_seasons', { primary:'', maintain:'', notNow:'' });
  const set=(k,v)=>save('gc_focus_seasons',{...seasons,[k]:v});
  return <div className="adhd-page"><Section title="Focus" subtitle="minder tegelijk">
    <div className="adhd-focus-row primary"><b>PRIMARY</b><textarea value={seasons.primary||''} onChange={e=>set('primary',e.target.value)} placeholder="Wat mag nu echt groeien?"/></div>
    <div className="adhd-focus-row maintain"><b>MAINTAIN</b><textarea value={seasons.maintain||''} onChange={e=>set('maintain',e.target.value)} placeholder="Wat houd je gewoon stabiel?"/></div>
    <div className="adhd-focus-row notnow"><b>NOT NOW</b><textarea value={seasons.notNow||''} onChange={e=>set('notNow',e.target.value)} placeholder="Wat hoeft nu nadrukkelijk niet?"/></div>
  </Section></div>;
}

function Later() {
  const items=read('gc_capture_items',[]).filter(i=>i.status==='PARKEREN'||i.destination==='LATER');
  return <div className="adhd-page"><Section title="Later" subtitle={`${items.length} geparkeerd`}>
    <div className="adhd-summary">Hier mag iets veilig bestaan zonder dat het vandaag mentale ruimte inneemt.</div>
    {items.map(i=><div className="adhd-list-row" key={i.id}><strong>{i.title}</strong><span>{i.updatedAt?.slice(0,10)||''}</span></div>)}
    {!items.length&&<div className="adhd-empty">Niets geparkeerd.</div>}
  </Section></div>;
}

export default function ADHDWorkspace() {
  useWorkspaceState();
  const [tab,setTab]=useState('Ritme');
  const taskCount=useMemo(()=>read('gc_capture_items',[]).filter(i=>i.status!=='KLAAR').length,[tab]);
  return <div className="adhd-workspace">
    <div className="adhd-subnav">{NAV.map(n=><button key={n} className={tab===n?'active':''} onClick={()=>setTab(n)}>{n}{n==='Taken'&&taskCount?` ${taskCount}`:''}</button>)}</div>
    {tab==='Ritme'&&<Ritme/>}
    {tab==='Agenda'&&<Agenda/>}
    {tab==='Taken'&&<Taken/>}
    {tab==='Capture'&&<CaptureCenter compact />}
    {tab==='Focus'&&<Focus/>}
    {tab==='Later'&&<Later/>}
  </div>;
}
