import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Training from './Training';
import Lichaam from './Lichaam';

const TABS = ['Training', 'Lichaam'];

export default function LichaamHub(props) {
  const [sub, setSub] = useState(props.initialSub === 'training' ? 0 : 0);
  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <Training {...props} />}
      {sub === 1 && <Lichaam {...props} logs={props.logs} />}
    </div>
  );
}
