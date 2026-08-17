import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Lichaam from './Lichaam';
import Glow from './Glow';
import Eten from './Eten';

const TABS = ['Lichaam', '✨ Glow', 'Eten'];

export default function MeerTab({ log, saveField, saveFields, currentDate, logs, dayNum, showFlash, isFuture, deleteLog, syncStatus, tip }) {
  const [sub, setSub] = useState(0);

  const sharedProps = { log, saveField, saveFields, currentDate, logs, dayNum, showFlash, isFuture, deleteLog, syncStatus };

  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <Lichaam {...sharedProps} logs={logs} />}
      {sub === 1 && <Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} />}
      {sub === 2 && <Eten tip={tip} dayNum={dayNum} log={log} />}
    </div>
  );
}
