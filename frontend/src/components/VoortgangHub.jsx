import React, { useState } from 'react';
import SubTabs from './SubTabs';
import ProgressWall from './ProgressWall';
import Progressie from './Progressie';
import Patronen from './Patronen';
import Badges from './Badges';

const TABS = ['Progress Wall', 'Resultaten', 'Patronen', 'Milestones'];

export default function VoortgangHub({ logs, streak }) {
  const [sub, setSub] = useState(0);

  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <ProgressWall logs={logs} />}
      {sub === 1 && <Progressie logs={logs} />}
      {sub === 2 && <Patronen logs={logs} />}
      {sub === 3 && <Badges logs={logs} streak={streak} />}
    </div>
  );
}
