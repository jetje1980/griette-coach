import React, { useState, useEffect, useCallback, useRef } from 'react';
import { USER } from './config';
import { store } from './store';
import { restoreFromCloud, onSyncStatus, getSyncStatus } from './sync';
import { photoStore } from './photoStore';

import VandaagScreen   from './components/VandaagScreen';
import WeekScreen      from './components/WeekScreen';
import LichaamScreen   from './components/LichaamScreen';
import LevenScreen     from './components/LevenScreen';
import ProgressieScreen from './components/ProgressieScreen';
import CoachScreen     from './components/CoachScreen';
import Settings        from './components/Settings';
import Onboarding      from './components/Onboarding';
import StravaCallback  from './components/StravaCallback';

const TABS = ['Vandaag', 'Week', 'Lichaam', 'Leven', 'Progressie', 'Coach'];
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
    if (delta === 0) { setCurrentDate(today()); return; }
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= maxFutureDate) setCurrentDate(newDate);
  };

  const isFuture = currentDate > today();

  if (window.location.pathname.endsWith('/strava/callback')) {
    return (
      <StravaCallback onDone={(ok, msg) => {
        if (ok) showFlash('🏃', `Strava gekoppeld: ${msg}`);
        else showFlash('❌', `Strava fout: ${msg}`);
      }} />
    );
  }

  if (!onboardingDone) {
    return <Onboarding onDone={() => { setOnboardingDone(true); loadLogs(); }} />;
  }

  return (
    <>
      <div className={`flash ${flash ? 'visible' : ''}`}>
        <span className="flash-icon">{flash?.icon}</span>
        <span className="flash-text">{flash?.text}</span>
      </div>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Navigation */}
      <nav className="os-nav">
        {TABS.map((label, i) => (
          <button key={i} className={`os-nav-item ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
            {label}
          </button>
        ))}
        <button className="os-nav-settings" onClick={() => setShowSettings(true)} aria-label="Instellingen">
          ⚙
        </button>
      </nav>

      {/* Screens */}
      {tab === 0 && (
        <VandaagScreen
          log={log}
          logs={logs}
          currentDate={currentDate}
          saveField={saveField}
          saveFields={saveFields}
          shiftDay={shiftDay}
          isFuture={isFuture}
        />
      )}
      {tab === 1 && <WeekScreen logs={logs} />}
      {tab === 2 && (
        <LichaamScreen
          log={log}
          logs={logs}
          currentDate={currentDate}
          saveField={saveField}
          saveFields={saveFields}
          deleteLog={deleteLog}
          showFlash={showFlash}
          isFuture={isFuture}
        />
      )}
      {tab === 3 && <LevenScreen />}
      {tab === 4 && <ProgressieScreen logs={logs} streak={streak} />}
      {tab === 5 && <CoachScreen logs={logs} />}
    </>
  );
}
