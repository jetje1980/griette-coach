import React, { useState } from 'react';
import SubTabs from './SubTabs';
import Trainingsplan from './Trainingsplan';
import Ritme from './Ritme';
import WeekFocus from './WeekFocus';
import Calendar from './Calendar';
import PlanningContext from './PlanningContext';

const TABS = ['Schema', 'Ritme', 'Week', 'Kalender'];

export default function PlanningHub({ currentDate, logs, onSelectDate, maxDate }) {
  const [sub, setSub] = useState(0);

  return (
    <div>
      <div style={{ padding: '10px 14px 0' }}>
        <PlanningContext />
      </div>
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 0 && <Trainingsplan />}
      {sub === 1 && <Ritme />}
      {sub === 2 && <WeekFocus />}
      {sub === 3 && (
        <Calendar
          currentDate={currentDate}
          logs={logs}
          onSelectDate={onSelectDate}
          maxDate={maxDate}
        />
      )}
    </div>
  );
}
