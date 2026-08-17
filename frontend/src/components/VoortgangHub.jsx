import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Progressie from './Progressie';
import Patronen from './Patronen';
import Badges from './Badges';

const TABS = ['Resultaten', 'Patronen', 'Badges'];

export default function VoortgangHub({ logs, streak }) {
  const [sub, setSub] = useState(0);

  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <Progressie logs={logs} />}
      {sub === 1 && <Patronen logs={logs} />}
      {sub === 2 && <Badges logs={logs} streak={streak} />}
    </div>
  );
}
