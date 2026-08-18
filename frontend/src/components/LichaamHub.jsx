import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Training from './Training';
import TrainingDecisionPanel from './TrainingDecisionPanel';
import RunLibrary from './RunLibrary';
import StrengthTracker from './StrengthTracker';
import CycleContext from './CycleContext';
import Lichaam from './Lichaam';

const TABS = ['Beslissen', 'Uitvoeren', 'T1–T35', 'Kracht', 'Herstel'];

export default function LichaamHub(props) {
  const [sub, setSub] = useState(0);
  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <TrainingDecisionPanel currentDate={props.currentDate} showFlash={props.showFlash} />}
      {sub === 1 && <Training {...props} />}
      {sub === 2 && <RunLibrary />}
      {sub === 3 && <StrengthTracker currentDate={props.currentDate} />}
      {sub === 4 && <><CycleContext {...props} /><Lichaam {...props} logs={props.logs} /></>}
    </div>
  );
}
