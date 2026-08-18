// Eén gedeelde Supabase-client voor de hele app.
// Eerder maakten store.js, sync.js en photoStore.js elk hun eigen client;
// dat gaf drie losse auth-listeners op dezelfde sessie.
//
// De publishable (anon) key is publiek bedoeld en alleen veilig in
// combinatie met RLS — die staat aan op gc_coach_data en op de
// progress-photos bucket, met auth.uid()-scoping.

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://osuqtfsxmquwqsbgzlqn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6T-JJKX10RgLkWGwBwYaxg_gFANhdHS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Eigen opslagsleutel: andere apps van dezelfde gebruiker draaien op
    // hetzelfde origin (github.io) en deelden anders ongemerkt de sessie.
    storageKey: 'gc_auth_session',
  },
});

// ── Sessie-helpers ──────────────────────────────────────────────
let _cachedUserId = null;

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  _cachedUserId = data?.session?.user?.id || null;
  return data?.session || null;
}

export async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  const session = await getSession();
  return session?.user?.id || null;
}

// Synchroon: alleen bruikbaar nadat getSession() minstens één keer liep
export function cachedUserId() { return _cachedUserId; }

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    _cachedUserId = session?.user?.id || null;
    cb(event, session);
  });
  return () => data?.subscription?.unsubscribe();
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _cachedUserId = data?.user?.id || null;
  return data;
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  _cachedUserId = null;
}

// Access token voor authenticated calls naar Edge Functions
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}
