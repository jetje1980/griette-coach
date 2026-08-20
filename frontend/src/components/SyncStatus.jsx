import React, { useEffect, useState, useRef } from 'react';
import { onSyncSummary, forceSyncNow, mediaFailures } from '../sync';
import { photoStore } from '../photoStore';

// Eén melding voor alle cloudopslag.
//
// Er liepen twee kanalen naar Supabase — de sleutels via gc_coach_data, het
// beeldmateriaal via Storage — en alleen het eerste liet iets van zich horen.
// Een foto die niet omhoog kwam bleef onzichtbaar op één toestel staan.
//
// Deze balk kent maar drie dingen te zeggen, en zegt ze altijd:
//
//   ✓ Alles online opgeslagen
//   ⏳ Bezig met synchroniseren
//   ⚠ Online opslaan mislukt
//
// De groene versie verdwijnt na een paar seconden — je hoeft niet permanent
// verteld te worden dat het goed gaat. De rode blijft staan tot het gelukt is.

const COLOR = {
  ok: 'var(--sage)',
  pending: 'var(--gold)',
  error: 'var(--rust)',
  offline: 'var(--rust)',
  'signed-out': 'var(--ghost)',
  idle: 'var(--ghost)',
};

export default function SyncStatus() {
  const [s, setS] = useState(null);
  const [hideOk, setHideOk] = useState(true);
  const [retrying, setRetrying] = useState(false);
  // Eén timer, in een ref. Zonder dat kan de wegvaltimer van een vorige
  // geslaagde synchronisatie de volgende meteen weer onzichtbaar maken.
  const hideTimer = useRef(null);

  useEffect(() => {
    const off = onSyncSummary(next => {
      setS(next);
      clearTimeout(hideTimer.current);
      // Groen laten zien op het moment dat het net gelukt is, daarna wegvallen.
      if (next.state === 'ok') {
        setHideOk(false);
        hideTimer.current = setTimeout(() => setHideOk(true), 2500);
      } else {
        setHideOk(true);
      }
    });
    return () => { off(); clearTimeout(hideTimer.current); };
  }, []);

  if (!s) return null;
  if (s.state === 'idle') return null;
  if (s.state === 'signed-out') return null;      // het inlogscherm zegt dit al
  if (s.state === 'ok' && hideOk) return null;

  async function retry() {
    setRetrying(true);
    try {
      await forceSyncNow();
      await photoStore.pushMissingToCloud().catch(() => {});
    } finally { setRetrying(false); }
  }

  const bad = s.state === 'error' || s.state === 'offline';
  const failed = bad ? mediaFailures() : [];

  return (
    <div role="status" aria-live="polite" data-sync-state={s.state}
      style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        zIndex: 150, background: 'var(--card)', border: `1px solid ${COLOR[s.state]}`,
        borderRadius: 12, padding: '7px 14px', maxWidth: '92vw',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COLOR[s.state] }}>
          {s.icon} {s.label}
        </span>
        {bad && (
          <button onClick={retry} disabled={retrying}
            style={{ background: 'none', border: 'none', color: 'var(--sage)',
              cursor: 'pointer', fontWeight: 700, fontSize: 12, padding: 0 }}>
            {retrying ? 'bezig…' : 'opnieuw'}
          </button>
        )}
      </div>
      {bad && s.detail && (
        <div style={{ fontSize: 10.5, color: 'var(--sub)', lineHeight: 1.45, marginTop: 2 }}>
          {s.detail}
        </div>
      )}
      {failed.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.4, marginTop: 3 }}>
          {failed.slice(0, 3).map(f => f.what).join(' · ')}
          {failed.length > 3 ? ` · +${failed.length - 3}` : ''}
        </div>
      )}
    </div>
  );
}
