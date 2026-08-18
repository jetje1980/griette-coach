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
import Training from './components/Training';
import PlanningHub from './components/PlanningHub';
import VoortgangHub from './components/VoortgangHub';
import MeerTab from './components/MeerTab';
import Coach from './components/Coach';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import StravaCallback from './components/StravaCallback';

const TABS = ['Vandaag', 'Training', 'Planning', 'Voortgang', 'Coach', 'Meer'];
const MAX_FUTURE_DAYS = 90;

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, delta) {
  const d = parseDateKey(dateStr);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

function dayNumber(date) {
  const start = parseDateKey(USER.startDate);
  const d = parseDateKey(date);
  return Math.max(1, Math.floor((d - start) / 86400000) + 1);
}

function isActualLog(log, date) {
  return !!log && date <= today() && log.entry_type !== 'planned';
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

  const actualLogs = Object.fromEntries(
    Object.entries(logs).filter(([date, value]) => isActualLog(value, date))
  );

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
      const dk = addDays(today(), -i);
      const l = map[dk];
      if (l && l.entry_type !== 'planned' && (l.run_done || l.core_done || l.mounjaro || l.candesartan || l.adhd_meds)) s++;
      else if (i > 0) break;
    }
    setStreak(s);
  }, []);

  // App is rendered only after AuthGate has confirmed a Supabase session.
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
    const marker = currentDate <= today() && log?.entry_type === 'planned' ? { entry_type: 'actual' } : {};
    const updated = await store.saveLog(currentDate, { ...marker, [field]: value });
    setLog(updated);
    loadLogs();
  }, [currentDate, log, loadLogs]);

  const saveFields = useCallback(async (fields) => {
    const marker = currentDate <= today() && log?.entry_type === 'planned' ? { entry_type: 'actual' } : {};
    const updated = await store.saveLog(currentDate, { ...marker, ...fields });
    setLog(updated);
    loadLogs();
  }, [currentDate, log, loadLogs]);

  const deleteLog = useCallback(async () => {
    await store.deleteLog(currentDate);
    setLog(null);
    loadLogs();
    showFlash('🗑️', `Dagdata ${currentDate} verwijderd`);
  }, [currentDate, loadLogs, showFlash]);

  const maxFutureDate = addDays(today(), MAX_FUTURE_DAYS);

  const shiftDay = (delta) => {
    const newDate = addDays(currentDate, delta);
    if (newDate <= maxFutureDate) setCurrentDate(newDate);
  };

  const isToday = currentDate === today();
  const isFuture = currentDate > today();

  const progressPct = (() => {
    const sorted = Object.values(actualLogs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    const w = sorted[0]?.weight;
    if (!w) return 0;
    return Math.min(100, Math.max(0, ((USER.startWeight - w) / (USER.startWeight - USER.goalWeight)) * 100));
  })();

  const latestWeight = (() => {
    const sorted = Object.values(actualLogs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.weight || null;
  })();

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

  const sharedProps = { log, saveField, saveFields, currentDate, logs: actualLogs, dayNum, showFlash, isFuture, deleteLog, syncStatus };

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
        {tab === 1 && <Training {...sharedProps} />}
        {tab === 2 && (
          <PlanningHub
            currentDate={currentDate}
            logs={logs}
            onSelectDate={(d) => { setCurrentDate(d); setTab(0); }}
            maxDate={maxFutureDate}
          />
        )}
        {tab === 3 && <VoortgangHub logs={actualLogs} streak={streak} />}
        {tab === 4 && <Coach logs={actualLogs} />}
        {tab === 5 && <MeerTab {...sharedProps} tip={tip} />}
      </div>
    </>
  );
}
