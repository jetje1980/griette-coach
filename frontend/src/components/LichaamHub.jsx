import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Training from './Training';
import TrainingDecisionPanel from './TrainingDecisionPanel';
import WorkoutImport from './WorkoutImport';
import RunLibrary from './RunLibrary';
import StrengthTracker from './StrengthTracker';
import CycleContext from './CycleContext';
import Lichaam from './Lichaam';

const TABS = ['Beslissen', 'Uitvoeren', 'Import', 'T1–T35', 'Kracht', 'Herstel'];

export default function LichaamHub(props) {
  const [sub, setSub] = useState(0);
  return (
    <div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <TrainingDecisionPanel currentDate={props.currentDate} showFlash={props.showFlash} />}
      {sub === 1 && <Training {...props} />}
      {sub === 2 && <WorkoutImport currentDate={props.currentDate} showFlash={props.showFlash} />}
      {sub === 3 && <RunLibrary />}
      {sub === 4 && <StrengthTracker currentDate={props.currentDate} />}
      {sub === 5 && <><CycleContext {...props} /><Lichaam {...props} logs={props.logs} /></>}
    </div>
  );
}
