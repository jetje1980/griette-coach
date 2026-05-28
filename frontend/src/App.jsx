import React, { useState, useEffect, useCallback, useRef } from 'react';
import { USER } from './config';
import { api } from './api';
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
import StravaCallback from './components/StravaCallback';

const TABS = ['Vandaag', 'Kalender', 'Training', 'Eten', 'Lichaam', 'Patronen', '🏅'];

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
  const [backendOk, setBackendOk] = useState(true);
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
    try {
      const data = await api.getLog(date);
      setLog(data);
      setBackendOk(true);
    } catch {
      setBackendOk(false);
      setLog(null);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const rows = await api.getLogs();
      const map = {};
      for (const r of rows) map[r.date] = r;
      setLogs(map);
      // calculate streak
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
    } catch {}
  }, []);

  useEffect(() => {
    loadLog(currentDate);
    loadLogs();
  }, [currentDate, loadLog, loadLogs]);

  const saveField = useCallback(async (field, value) => {
    try {
      const updated = await api.saveLog(currentDate, { [field]: value });
      setLog(updated);
      loadLogs();
    } catch {
      showFlash('❌', 'Backend niet bereikbaar');
    }
  }, [currentDate, loadLogs, showFlash]);

  const saveFields = useCallback(async (fields) => {
    try {
      const updated = await api.saveLog(currentDate, fields);
      setLog(updated);
      loadLogs();
    } catch {
      showFlash('❌', 'Backend niet bereikbaar');
    }
  }, [currentDate, loadLogs, showFlash]);

  const shiftDay = (delta) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    if (newDate <= today()) setCurrentDate(newDate);
  };

  const isToday = currentDate === today();

  const progressPct = log?.weight
    ? Math.min(100, Math.max(0, ((USER.startWeight - log.weight) / (USER.startWeight - USER.goalWeight)) * 100))
    : 0;

  const latestWeight = (() => {
    const sorted = Object.values(logs).filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.weight || null;
  })();

  const sharedProps = { log, saveField, saveFields, currentDate, logs, dayNum, showFlash };

  // Handle Strava OAuth callback
  if (window.location.pathname === '/strava/callback') {
    return (
      <StravaCallback onDone={(ok, msg) => {
        if (ok) showFlash('🏃', `Strava gekoppeld: ${msg}`);
        else showFlash('❌', `Strava fout: ${msg}`);
      }} />
    );
  }

  return (
    <>
      {/* Flash notification */}
      <div className={`flash ${flash ? 'visible' : ''}`}>
        <span className="flash-icon">{flash?.icon}</span>
        <span className="flash-text">{flash?.text}</span>
      </div>

      {!backendOk && (
        <div style={{ background: 'var(--alert)', color: 'white', textAlign: 'center', fontSize: 11, padding: '6px 12px', fontWeight: 700 }}>
          ⚠️ Backend niet bereikbaar — start <code>npm run dev</code>
        </div>
      )}

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
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div>
        {tab === 0 && <CheckIn {...sharedProps} tip={tip} />}
        {tab === 1 && <Calendar currentDate={currentDate} logs={logs} onSelectDate={(d) => { setCurrentDate(d); setTab(0); }} />}
        {tab === 2 && <Training {...sharedProps} />}
        {tab === 3 && <Eten tip={tip} dayNum={dayNum} />}
        {tab === 4 && <Lichaam {...sharedProps} logs={logs} />}
        {tab === 5 && <Patronen logs={logs} />}
        {tab === 6 && <Badges logs={logs} streak={streak} />}
      </div>
    </>
  );
}
