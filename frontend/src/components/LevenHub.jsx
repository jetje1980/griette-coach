import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Glow from './Glow';
import Eten from './Eten';

const TABS = ['Herstel', 'Glow', 'Eten'];

export default function LevenHub({ log, saveField, currentDate, logs, tip, dayNum }) {
  const [sub, setSub] = useState(0);

  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && (
        <div className="pane">
          <div className="card">
            <div className="card-header">
              <div className="card-accent" style={{ background: 'var(--rust)' }} />
              <div className="card-title">Leven & herstel</div>
            </div>
            <div className="card-body" style={{ fontSize: 12, lineHeight: 1.7 }}>
              Deze sectie is voor context die je trainingsbeslissingen beïnvloedt: slaap, belasting, herstel, cyclus en dagelijkse ruimte. De coach gebruikt deze context om niet automatisch méér te adviseren.
            </div>
          </div>
          <Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} />
        </div>
      )}
      {sub === 1 && <Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} />}
      {sub === 2 && <Eten tip={tip} dayNum={dayNum} log={log} />}
    </div>
  );
}
