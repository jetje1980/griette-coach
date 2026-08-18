import React, { useMemo, useState } from 'react';

const STATUSES = ['OPEN','PLANNEN','DELEGEREN','PARKEREN','KLAAR'];
const DESTINATIONS = ['TODAY','WEEK','CALENDAR','TRELLO','PROJECT','LATER'];

function readItems() {
  try { return JSON.parse(localStorage.getItem('gc_capture_items') || '[]'); } catch { return []; }
}
function saveItems(items) { localStorage.setItem('gc_capture_items', JSON.stringify(items)); }

export default function CaptureCenter() {
  const [text, setText] = useState('');
  const [items, setItems] = useState(readItems);
  const [filter, setFilter] = useState('OPEN');
  const [query, setQuery] = useState('');

  const refresh = next => { saveItems(next); setItems(next); };
  const add = () => {
    const title = text.trim(); if (!title) return;
    const item = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      title, status:'OPEN', destination:null,
      source:'Capture', sourceId:null,
      externalProvider:null, externalId:null, externalUrl:null,
      syncState:'local', lastSyncedAt:null,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
    };
    refresh([item, ...items]); setText('');
  };
  const patch = (id, data) => refresh(items.map(i => i.id===id ? {...i,...data,updatedAt:new Date().toISOString()} : i));
  const remove = id => refresh(items.filter(i => i.id !== id));

  const shown = useMemo(() => items.filter(i => (filter==='ALL'||i.status===filter) && (!query || i.title.toLowerCase().includes(query.toLowerCase()))), [items,filter,query]);

  const chooseDestination = (item, destination) => {
    // External systems must never make the source item disappear. Until an authenticated provider is configured,
    // keep the item visible and mark the sync state explicitly.
    const external = destination === 'TRELLO' || destination === 'CALENDAR';
    patch(item.id, {
      status:'PLANNEN', destination,
      externalProvider: destination === 'TRELLO' ? 'Trello' : destination === 'CALENDAR' ? 'Google Calendar' : null,
      syncState: external ? 'not_configured' : 'local',
    });
  };

  return <div className="pane">
    <div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--gold)'}}/><div className="card-title">Capture now, decide later</div></div><div className="card-body">
      <div style={{display:'flex',gap:7}}><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Wat schiet je te binnen?" style={{flex:1}}/><button className="btn btn-sage" onClick={add}>Capture</button></div>
      <div style={{fontSize:10,color:'var(--muted)',marginTop:6}}>Geen categorie nodig. Eerst vangen, later beslissen.</div>
    </div></div>

    <div className="card"><div className="card-body">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoeken…" style={{width:'100%',boxSizing:'border-box',marginBottom:8}}/>
      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{['OPEN','PLANNEN','DELEGEREN','PARKEREN','KLAAR','ALL'].map(s=><button key={s} className="btn btn-sm" onClick={()=>setFilter(s)} style={{fontWeight:filter===s?800:500}}>{s}</button>)}</div>
    </div></div>

    {shown.map(item => <div className="card" key={item.id}><div className="card-body">
      <div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{item.title}</strong><span style={{fontSize:10,color:'var(--muted)'}}>{item.status}</span></div>
      <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>bron: {item.source}{item.destination ? ` · bestemming: ${item.destination}`:''}{item.syncState==='not_configured'?' · sync nog niet gekoppeld':''}</div>
      {item.status==='OPEN' || item.status==='PLANNEN' ? <>
        <div style={{fontSize:10,fontWeight:800,marginTop:9}}>BESTEMMING</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:5}}>{DESTINATIONS.map(d=><button key={d} className="btn btn-sm" onClick={()=>chooseDestination(item,d)}>{d}</button>)}</div>
      </>:null}
      <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:9}}>{STATUSES.map(s=><button key={s} className="btn btn-sm" onClick={()=>patch(item.id,{status:s})}>{s}</button>)}<button className="btn btn-sm" onClick={()=>patch(item.id,{status:'OPEN',destination:null,syncState:'local'})}>Undo/reopen</button><button className="btn btn-sm" onClick={()=>remove(item.id)}>Verwijder</button></div>
    </div></div>)}
  </div>;
}
