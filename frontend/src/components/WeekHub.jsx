import React, { useState } from 'react';
import SubTabs from './SubTabs';
import WeekFocus from './WeekFocus';
import Calendar from './Calendar';
import Trainingsplan from './Trainingsplan';
import Ritme from './Ritme';
import PlanningContext from './PlanningContext';

const TABS = ['Deze week', 'Agenda', 'Roadmap', 'Ritme'];

export default function WeekHub({ currentDate, logs, onSelectDate, maxDate }) {
  const [sub, setSub] = useState(0);
  return (
    <div>
      <div style={{ padding: '10px 14px 0' }}><PlanningContext /></div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <WeekFocus />}
      {sub === 1 && <Calendar currentDate={currentDate} logs={logs} onSelectDate={onSelectDate} maxDate={maxDate} />}
      {sub === 2 && <Trainingsplan />}
      {sub === 3 && <Ritme />}
    </div>
  );
}
