import React, { useState, useEffect, useCallback, useRef } from 'react';
import { USER } from './config';
import { store } from './store';
import { QUOTES } from './data/quotes';
import { TIPS } from './data/tips';

import Header from './components/Header';
import TabBar from './components/TabBar';
import CheckIn from './components/CheckIn';
import Calendar from './components/Calendar';
import Training from './components/Training';
import Eten from './components/Eten';
import Lichaam from './components/Lichaam';
import Patronen from './components/Patronen';
import Badges from './components/Badges';
import Coach from './components/Coach';
import Progressie from './components/Progressie';
import Glow from './components/Glow';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import StravaCallback from './components/StravaCallback';

const TABS = ['Vandaag', 'Kalender', 'Training', 'Eten', 'Lichaam', 'Trends', 'Coach', 'Progressie', '✨ Glow', '🏅'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dayNumber(date) {
  const start = new Date(USER.startDate);
  const d = new Date(date);
  return Math.max(1, Math.floor((d - start) / 86400000) + 1);
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [currentDate, setCurrentDate] = useState(today());
  const [log, setLog] = useState(null);
  const [logs, setLogs] = useState({});
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('gc_onboarding_done')
  );
  const flashTimer = useRef(null);

  const dayNum = dayNumber(currentDate);
  const quote = QUOTES[(dayNum - 1) % QUOTES.length];
  const tip = TIPS[(dayNum - 1) % TIPS.length];

  const showFlash = useCallback((icon, text) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ icon, text });
    flashTimer.current = setTimeout(() => setFlash(null), 3000);
  }, []);

  const loadLog = useCallback(async (date) => {
    const data = await store.getLog(date);
    setLog(data);
  }, []);

  const loadLogs = useCallback(async () => {
    const rows = await store.getLogs();
    const map = {};
    for (const r of rows) map[r.date] = r;
    setLogs(map);
    let s = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dk = d.toISOString().slice(0, 10);
      const l = map[dk];
      if (l && (l.run_done || l.core_done || l.mounjaro || l.candesartan || l.adhd_meds)) s++;
      else if (i > 0) break;
    }
    setStreak(s);
  }, []);

  useEffect(() => {
    loadLog(currentDate);
    loadLogs();
  }, [currentDate, loadLog, loadLogs]);

  const saveField = useCallback(async (field, value) => {
    const updated = await store.saveLog(currentDate, { [field]: value });
    setLog(updated);
    loadLogs();
  }, [currentDate, loadLogs]);

  const saveFields = useCallback(async (fields) => {
    const updated = await store.saveLog(currentDate, fields);
    setLog(updated);
    loadLogs();
  }, [currentDate, loadLogs]);

  const shiftDay = (delta) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= today()) setCurrentDate(newDate);
  };

  const isToday = currentDate === today();

  const progressPct = (() => {
    const sorted = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    const w = sorted[0]?.weight;
    if (!w) return 0;
    return Math.min(100, Math.max(0, ((USER.startWeight - w) / (USER.startWeight - USER.goalWeight)) * 100));
  })();

  const latestWeight = (() => {
    const sorted = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.weight || null;
  })();

  // Strava OAuth callback
  if (window.location.pathname.endsWith('/strava/callback')) {
    return (
      <StravaCallback onDone={(ok, msg) => {
        if (ok) showFlash('🏃', `Strava gekoppeld: ${msg}`);
        else showFlash('❌', `Strava fout: ${msg}`);
      }} />
    );
  }

  // Onboarding
  if (!onboardingDone) {
    return <Onboarding onDone={() => { setOnboardingDone(true); loadLogs(); }} />;
  }

  const sharedProps = { log, saveField, saveFields, currentDate, logs, dayNum, showFlash };

  return (
    <>
      <div className={`flash ${flash ? 'visible' : ''}`}>
        <span className="flash-icon">{flash?.icon}</span>
        <span className="flash-text">{flash?.text}</span>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <Header
        currentDate={currentDate}
        log={log}
        streak={streak}
        latestWeight={latestWeight}
        progressPct={progressPct}
        quote={quote}
        isToday={isToday}
        onShiftDay={shiftDay}
        dayNum={dayNum}
        onSettings={() => setShowSettings(true)}
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div>
        {tab === 0 && <CheckIn {...sharedProps} tip={tip} />}
        {tab === 1 && <Calendar currentDate={currentDate} logs={logs} onSelectDate={(d) => { setCurrentDate(d); setTab(0); }} />}
        {tab === 2 && <Training {...sharedProps} />}
        {tab === 3 && <Eten tip={tip} dayNum={dayNum} log={log} />}
        {tab === 4 && <Lichaam {...sharedProps} logs={logs} />}
        {tab === 5 && <Patronen logs={logs} />}
        {tab === 6 && <Coach logs={logs} />}
        {tab === 7 && <Progressie logs={logs} />}
        {tab === 8 && <Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} />}
        {tab === 9 && <Badges logs={logs} streak={streak} />}
      </div>
    </>
  );
}
