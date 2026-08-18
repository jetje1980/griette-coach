import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession ?? null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) setMessage('Inloggen lukt niet. Controleer e-mail en wachtwoord.');
  }

  async function magicLink() {
    if (!email.trim()) {
      setMessage('Vul eerst je e-mailadres in.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    setBusy(false);
    setMessage(error ? 'Inloglink kon niet worden verstuurd.' : 'Inloglink verstuurd. Open de mail op dit apparaat.');
  }

  if (session === undefined) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', color: '#64748b' }}>Beveiligde coach laden…</div>;
  }

  if (session) return children;

  return (
    <div style={{ minHeight: '100vh', background: '#F4EFE5', display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={login} style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: '26px 22px', boxShadow: '0 16px 45px rgba(42,37,32,.12)' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 800, color: '#6B7D5B', marginBottom: 6 }}>COACH G</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 25, color: '#2A2520' }}>Privé inloggen</h1>
        <p style={{ margin: '0 0 20px', color: '#746D64', fontSize: 13, lineHeight: 1.55 }}>
          Je gezondheidsdata en progressiefoto’s zijn alleen beschikbaar binnen je eigen Supabase-account.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: '#2A2520' }}>E-mail</label>
        <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', marginBottom: 12, border: '1px solid #D9D2C7', borderRadius: 10, fontSize: 15 }} />
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5, color: '#2A2520' }}>Wachtwoord</label>
        <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', marginBottom: 14, border: '1px solid #D9D2C7', borderRadius: 10, fontSize: 15 }} />
        <button type="submit" disabled={busy || !password} style={{ width: '100%', border: 0, borderRadius: 10, padding: '12px 14px', background: '#6B7D5B', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {busy ? 'Even…' : 'Inloggen'}
        </button>
        <button type="button" onClick={magicLink} disabled={busy} style={{ width: '100%', marginTop: 9, border: '1px solid #D9D2C7', borderRadius: 10, padding: '11px 14px', background: '#fff', color: '#2A2520', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Stuur eenmalige inloglink
        </button>
        {message && <div style={{ marginTop: 12, padding: '9px 10px', borderRadius: 9, background: '#F7F4EE', color: '#6B6258', fontSize: 12, lineHeight: 1.45 }}>{message}</div>}
      </form>
    </div>
  );
}
