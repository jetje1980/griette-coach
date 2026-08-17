import React, { useState, useEffect, useCallback, useRef } from 'react';
import { USER } from './config';
import { store } from './store';
import { restoreFromCloud, onSyncStatus, getSyncStatus } from './sync';
import { photoStore } from './photoStore';
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
import Trainingsplan from './components/Trainingsplan';
import Ritme from './components/Ritme';
import WeekFocus from './components/WeekFocus';

const TABS = ['Vandaag', 'Kalender', 'Training', 'Plan', 'Ritme', 'Week', 'Eten', 'Lichaam', 'Trends', 'Coach', 'Progressie', '✨ Glow', '🏅'];
const MAX_FUTURE_DAYS = 90;

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
  const [syncStatus, setSyncStatus] = useState(() => getSyncStatus());
  const [onboardingDone, setOnboardingDone] = useState(
    () => !!localStorage.getItem('gc_onboarding_done')
  );
  const flashTimer = useRef(null);

  const dayNum = dayNumber(currentDate);
  const quote = QUOTES[(dayNum - 1) % QUOTES.length];
  const tip = TIPS[(dayNum - 1) % TIPS.length];

  useEffect(() => {
    const unsub = onSyncStatus(setSyncStatus);
    return unsub;
  }, []);

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

  // On first mount: restore data + photos from cloud
  useEffect(() => {
    restoreFromCloud().then(count => {
      if (count > 0) { loadLog(currentDate); loadLogs(); }
    });
    photoStore.restoreFromCloud();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const deleteLog = useCallback(async () => {
    await store.deleteLog(currentDate);
    setLog(null);
    loadLogs();
    showFlash('🗑️', `Dagdata ${currentDate} verwijderd`);
  }, [currentDate, loadLogs, showFlash]);

  const maxFutureDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + MAX_FUTURE_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  const shiftDay = (delta) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= maxFutureDate) setCurrentDate(newDate);
  };

  const isToday = currentDate === today();
  const isFuture = currentDate > today();

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

  const sharedProps = { log, saveField, saveFields, currentDate, logs, dayNum, showFlash, isFuture, deleteLog, syncStatus };

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
        isFuture={isFuture}
        onShiftDay={shiftDay}
        dayNum={dayNum}
        onSettings={() => setShowSettings(true)}
        syncStatus={syncStatus}
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div>
        {tab === 0 && <CheckIn {...sharedProps} tip={tip} />}
        {tab === 1 && <Calendar currentDate={currentDate} logs={logs} onSelectDate={(d) => { setCurrentDate(d); setTab(0); }} maxDate={maxFutureDate} />}
        {tab === 2 && <Training {...sharedProps} />}
        {tab === 3 && <Trainingsplan />}
        {tab === 4 && <Ritme />}
        {tab === 5 && <WeekFocus />}
        {tab === 6 && <Eten tip={tip} dayNum={dayNum} log={log} />}
        {tab === 7 && <Lichaam {...sharedProps} logs={logs} />}
        {tab === 8 && <Patronen logs={logs} />}
        {tab === 9 && <Coach logs={logs} />}
        {tab === 10 && <Progressie logs={logs} />}
        {tab === 11 && <Glow log={log} saveField={saveField} currentDate={currentDate} logs={logs} />}
        {tab === 12 && <Badges logs={logs} streak={streak} />}
      </div>
    </>
  );
}
