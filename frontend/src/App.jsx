import React, { useState, useEffect, useCallback, useRef } from 'react';
import { USER } from './config';
import { store } from './store';
import { restoreFromCloud } from './sync';
import { photoStore } from './photoStore';
import { dreamStore } from './dreamStore';
import { workoutImages } from './workoutImages';
import { backfillFromHistory, scorePredictions } from './predictionLog';

import VandaagScreen   from './components/VandaagScreen';
import WeekScreen      from './components/WeekScreen';
import LichaamScreen   from './components/LichaamScreen';
import LevenScreen     from './components/LevenScreen';
import ProgressieScreen from './components/ProgressieScreen';
import CoachScreen     from './components/CoachScreen';
import Settings        from './components/Settings';
import SyncStatus      from './components/SyncStatus';
import Onboarding      from './components/Onboarding';
import StravaCallback  from './components/StravaCallback';
import { todayLocal, addDays } from './datetime';
import { ingestStravaWorkouts, enrichRecentSegments, deriveSegmentsFromStreams } from './stravaIngest';

const TABS = ['Vandaag', 'Week', 'Lichaam', 'Leven', 'Progressie', 'Coach'];
const MAX_FUTURE_DAYS = 90;

// Kalenderdag in Europe/Amsterdam — nooit de UTC-datum, die rond
// middernacht nog op gisteren staat.
const today = todayLocal;

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
    const today = todayLocal();
    for (let i = 0; i < 90; i++) {
      const l = map[addDays(today, -i)];
      if (l && (l.run_done || l.core_done || l.mounjaro || l.candesartan || l.adhd_meds)) s++;
      else if (i > 0) break;
    }
    setStreak(s);
    return map;
  }, []);

  useEffect(() => {
    // Cloud is de bron: eerst hydrateren, daarna media synchroniseren.
    (async () => {
      const count = await restoreFromCloud().catch(() => 0);
      if (count > 0) loadLog(currentDate);
      const map = await loadLogs();

      // Strava-activiteiten omzetten naar trainingen. Zonder deze stap
      // bestaat een run die alleen via Strava binnenkwam nergens in de app
      // en blijft de weekkalender "Gepland" tonen op een dag waarop
      // aantoonbaar gelopen is.
      try {
        const res = await ingestStravaWorkouts({ logs: map });
        if (res.ok && (res.added || res.enriched || res.logUpdates)) {
          await loadLogs();
          if (res.added) showFlash?.('🏃', `${res.added} training${res.added > 1 ? 'en' : ''} uit Strava toegevoegd`);
        }
        // Ronden nahalen voor recente runs: zonder die blokken is er geen
        // looptempo, alleen een sessietempo — en dat is iets anders.
        await enrichRecentSegments({ limit: 3 }).catch(() => {});
        // Levert het horloge geen ronden, dan leiden we de blokken alsnog af
        // uit de streams. Dat is het verschil tussen een looptempo en een
        // sessietempo waar wandelpauzes in meetellen.
        const der = await deriveSegmentsFromStreams({ limit: 4 }).catch(() => null);
        if (der?.derived) {
          await loadLogs();
          showFlash?.('📈', `Loopblokken afgeleid uit ${der.derived} sessie${der.derived > 1 ? 's' : ''}`);
        }
      } catch { /* zonder koppeling gebeurt er simpelweg niets */ }

      // De voorspellingen bijwerken. Eerst de uitkomsten aanvullen bij wat er
      // al ligt, daarna de geschiedenis reconstrueren voor dagen die er nog
      // niet in staan. Bestaande records worden nooit overschreven, dus dit is
      // veilig om elke keer te draaien.
      try {
        scorePredictions({ logs: map });
        backfillFromHistory({ logs: map });
      } catch { /* calibratie mag nooit het opstarten breken */ }
    })();

    // Ophalen, dan wat nog niet in de cloud staat alsnog omhoog, dan wat op
    // een oude padindeling staat overzetten. In die volgorde: eerst compleet
    // maken, dan pas opruimen.
    (async () => {
      await photoStore.restoreFromCloud().catch(() => 0);
      await photoStore.pushMissingToCloud?.().catch(() => {});
      await photoStore.migratePaths?.().catch(() => {});
    })();
    // Beeldmateriaal dat eerder alleen lokaal stond alsnog veiligstellen
    dreamStore.syncWithCloud?.().catch(() => {});
    workoutImages.migrateToCloud?.().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadLog(currentDate);
    loadLogs();
  }, [currentDate, loadLog, loadLogs]);

  // Het resultaat gaat terug naar de aanroeper, inclusief `_cloud`.
  //
  // Zonder dat kan een scherm niet weten of de cloudsave lukte, en dus ook
  // niet eerlijk melden dat er iets bewaard is. Alles staat hoe dan ook
  // lokaal; wat er op het scherm mag komen hangt af van `_cloud.ok`.
  const saveField = useCallback(async (field, value, date = null) => {
    const updated = await store.saveLog(date || currentDate, { [field]: value });
    if (!date || date === currentDate) setLog(updated);
    loadLogs();
    return updated;
  }, [currentDate, loadLogs]);

  const saveFields = useCallback(async (fields, date = null) => {
    const updated = await store.saveLog(date || currentDate, fields);
    if (!date || date === currentDate) setLog(updated);
    loadLogs();
    return updated;
  }, [currentDate, loadLogs]);

  const deleteLog = useCallback(async () => {
    await store.deleteLog(currentDate);
    setLog(null);
    loadLogs();
    showFlash('🗑️', `Dagdata ${currentDate} verwijderd`);
  }, [currentDate, loadLogs, showFlash]);

  const maxFutureDate = addDays(today(), MAX_FUTURE_DAYS);

  const shiftDay = (delta) => {
    if (delta === 0) { setCurrentDate(today()); return; }
    const newDate = addDays(currentDate, delta);
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

      {/* Synchronisatie zichtbaar maken: één melding voor sleutels én
          beeldmateriaal. Een mislukte schrijfactie mag niet stil verdwijnen. */}
      <SyncStatus />

      {/* Screens */}
      {tab === 0 && (
        <VandaagScreen
          log={log}
          logs={logs}
          currentDate={currentDate}
          saveField={saveField}
          saveFields={saveFields}
          shiftDay={shiftDay}
          setDate={setCurrentDate}
          isFuture={isFuture}
          goToTab={setTab}
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
      {tab === 3 && <LevenScreen logs={logs} />}
      {tab === 4 && <ProgressieScreen logs={logs} streak={streak} />}
      {tab === 5 && <CoachScreen logs={logs} />}
    </>
  );
}
