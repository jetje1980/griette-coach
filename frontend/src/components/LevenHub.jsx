import React, { useState } from 'react';
import SubTabs from './SubTabs';
import ADHDWorkspace from './ADHDWorkspace';
import FutureSelfOS from './FutureSelfOS';
import Glow from './Glow';
import Eten from './Eten';

const TABS = ['ADHD', 'Future Self', 'Herstel', 'Eten'];

export default function LevenHub({ log, saveField, currentDate, logs, tip, dayNum }) {
  const [sub, setSub] = useState(0);

  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <ADHDWorkspace />}
      {sub === 1 && <FutureSelfOS />}
      {sub === 2 && <div><div className="pane"><div className="card"><div className="card-header"><div className="card-accent" style={{background:'var(--rust)'}}/><div className="card-title">Energy Budget & minimum viable self-care</div></div><div className="card-body" style={{fontSize:12,lineHeight:1.7}}>Plan niet alleen op beschikbare minuten, maar ook op fysieke, cognitieve en sociale capaciteit. Op lage-capaciteitsdagen telt de kleinste herstelvriendelijke versie als uitvoering, niet als mislukking.</div></div></div><Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} /></div>}
      {sub === 3 && <Eten tip={tip} dayNum={dayNum} log={log} />}
    </div>
  );
}
