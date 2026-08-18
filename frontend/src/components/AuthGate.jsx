import React, { useState, useEffect } from 'react';
import { getSession, onAuthChange, signIn, signInWithMagicLink, signOut } from '../supabase';

// Eén toegangspoort: zonder geldige Supabase-sessie komt er geen
// coach-data in beeld. Geen client-side namaaklogin, geen toegangscode —
// de sessie is een echte JWT die RLS server-side afdwingt.

export default function AuthGate({ children }) {
  const [state, setState] = useState('loading');   // loading | in | out
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    let alive = true;
    getSession()
      .then(s => { if (alive) setState(s ? 'in' : 'out'); })
      .catch(() => { if (alive) setState('out'); });
    // Vangt ook token-refresh en verlopen sessies op
    return onAuthChange((event, session) => {
      setState(session ? 'in' : 'out');
      if (event === 'SIGNED_OUT') purgeLocalCaches();
    });
  }, []);

  async function doSignIn(e) {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'E-mailadres of wachtwoord klopt niet.'
        : err.message);
    } finally { setBusy(false); }
  }

  async function doMagicLink() {
    if (!email.trim()) { setError('Vul eerst je e-mailadres in.'); return; }
    setBusy(true); setError('');
    try {
      await signInWithMagicLink(email.trim());
      setMagicSent(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh', color: 'var(--sub)', fontSize: 14 }}>
        Sessie controleren…
      </div>
    );
  }

  if (state === 'out') {
    return (
      <div className="os-content" style={{ paddingTop: 60, maxWidth: 380, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🏃‍♀️</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800, margin: 0 }}>
            Griëtte Coach
          </h1>
          <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 6, lineHeight: 1.5 }}>
            Log in om je eigen gegevens te zien. Je gezondheidsdata is
            afgeschermd per account.
          </div>
        </div>

        {magicSent ? (
          <div className="os-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>📬</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Check je mail</div>
            <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
              Er is een inloglink verstuurd naar {email}. Open die op dit toestel.
            </div>
            <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 12 }}
              onClick={() => setMagicSent(false)}>Terug</button>
          </div>
        ) : (
          <form className="os-card" onSubmit={doSignIn}>
            <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.4px', fontWeight: 700, marginBottom: 3 }}>E-mail</div>
            <input className="os-input" type="email" autoComplete="username"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl" style={{ marginBottom: 10 }} />

            <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
              letterSpacing: '0.4px', fontWeight: 700, marginBottom: 3 }}>Wachtwoord</div>
            <input className="os-input" type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={{ marginBottom: 14 }} />

            {error && (
              <div style={{ fontSize: 12.5, color: 'var(--rust)', fontWeight: 600,
                marginBottom: 10, lineHeight: 1.4 }}>{error}</div>
            )}

            <button type="submit" className="os-btn-save" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Bezig…' : 'Inloggen'}
            </button>

            <button type="button" className="os-toggle-chip"
              style={{ width: '100%', marginTop: 8, fontSize: 12.5 }}
              onClick={doMagicLink} disabled={busy}>
              Stuur me een inloglink
            </button>
          </form>
        )}
      </div>
    );
  }

  return children;
}

// Bij uitloggen mag privédata niet zichtbaar blijven in de UI-cache.
// De cloud is de bron; deze sleutels zijn cache en worden na de volgende
// login opnieuw opgehaald.
export function purgeLocalCaches() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gc_') && k !== 'gc_auth_session') keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* storage niet beschikbaar */ }
  // Beeldcaches leegmaken (originelen staan in private Storage)
  try {
    ['gc_photos', 'gc_dreams', 'gc_workout_imgs'].forEach(db => indexedDB.deleteDatabase(db));
  } catch { /* geen indexedDB */ }
}

export function LogoutButton() {
  return (
    <button className="os-toggle-chip" style={{ fontSize: 12, color: 'var(--rust)' }}
      onClick={async () => {
        if (!window.confirm('Uitloggen? Je gegevens blijven veilig in de cloud staan.')) return;
        purgeLocalCaches();
        await signOut();
        window.location.reload();
      }}>
      Uitloggen
    </button>
  );
}
