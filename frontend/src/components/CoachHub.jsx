import React, { useState } from 'react';
import SubTabs from './SubTabs';
import HeadCoach from './HeadCoach';
import Coach from './Coach';

const TABS=['Koers','Verdieping'];

export default function CoachHub({logs}){
  const [sub,setSub]=useState(0);
  return <div><SubTabs tabs={TABS} active={sub} onChange={setSub}/>{sub===0&&<HeadCoach logs={logs}/>} {sub===1&&<Coach logs={logs}/>}</div>;
}
