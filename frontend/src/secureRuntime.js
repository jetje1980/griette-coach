import { supabase, SUPABASE_KEY, SUPABASE_URL } from './supabaseClient';

const nativeFetch = window.fetch.bind(window);
const nativeGet = localStorage.getItem.bind(localStorage);
const nativeSet = localStorage.setItem.bind(localStorage);
const nativeRemove = localStorage.removeItem.bind(localStorage);
const SERVER_AI_MARKER = 'beveiligd-via-coachserver';

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayForISOWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday;
}

function canonicalizeWeekFocus(key, value) {
  try {
    const match = key.match(/^gc_week_focus_(\d{4})-W(\d{2})$/);
    if (!match) return value;
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed?.plan)) return value;
    const monday = mondayForISOWeek(Number(match[1]), Number(match[2]));
    parsed.plan = parsed.plan.map((day, i) => {
      const d = new Date(monday);
      d.setUTCDate(monday.getUTCDate() + i);
      return { ...day, date: d.toISOString().slice(0, 10) };
    });
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
}

function sanitizeFutureLog(key, value) {
  const match = key.match(/^gc_log_(\d{4}-\d{2}-\d{2})$/);
  if (!match || match[1] <= localDateKey()) return value;
  try {
    const parsed = JSON.parse(value) || {};
    const clean = { date: match[1], entry_type: 'planned' };
    if (parsed.mounjaro === 1 || parsed.mounjaro === true) clean.mounjaro = 1;
    return JSON.stringify(clean);
  } catch {
    return JSON.stringify({ date: match[1], entry_type: 'planned' });
  }
}

// Remove any previously stored real Anthropic secret. AI now runs through an
// authenticated Supabase Edge Function and this marker contains no credential.
nativeRemove('gc_api_key');
nativeSet('gc_api_key', SERVER_AI_MARKER);

// Remove the competing legacy AI week-plan. WeekFocus is the sole week-plan source.
for (const key of ['gc_training_plan', 'gc_training_plan_date', 'gc_training_plans_history']) {
  nativeRemove(key);
}

// Sanitize already cached future logs and repair cached week dates before the app reads them.
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (!key) continue;
  const value = nativeGet(key);
  if (value == null) continue;
  if (/^gc_log_\d{4}-\d{2}-\d{2}$/.test(key)) nativeSet(key, sanitizeFutureLog(key, value));
  if (key.startsWith('gc_week_focus_')) nativeSet(key, canonicalizeWeekFocus(key, value));
}

localStorage.getItem = function (key) {
  if (key === 'gc_api_key') return SERVER_AI_MARKER;
  if (key === 'gc_training_plan' || key === 'gc_training_plan_date' || key === 'gc_training_plans_history') return null;
  return nativeGet(key);
};

localStorage.setItem = function (key, value) {
  if (key === 'gc_api_key') return nativeSet(key, SERVER_AI_MARKER);
  if (key === 'gc_training_plan' || key === 'gc_training_plan_date' || key === 'gc_training_plans_history') return;
  let safeValue = String(value);
  if (/^gc_log_\d{4}-\d{2}-\d{2}$/.test(key)) safeValue = sanitizeFutureLog(key, safeValue);
  if (key.startsWith('gc_week_focus_')) safeValue = canonicalizeWeekFocus(key, safeValue);
  return nativeSet(key, safeValue);
};

localStorage.removeItem = function (key) {
  if (key === 'gc_api_key') return nativeSet(key, SERVER_AI_MARKER);
  return nativeRemove(key);
};

// Keep the existing coach UI compatible while moving Anthropic credentials out
// of the browser. Calls that used to go directly to Anthropic are transparently
// forwarded to the authenticated fitness-ai Edge Function.
window.fetch = async function (input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url?.startsWith('https://api.anthropic.com/v1/messages')) {
    return nativeFetch(input, init);
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: { message: 'Log opnieuw in om AI te gebruiken.' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return nativeFetch(`${SUPABASE_URL}/functions/v1/fitness-ai?action=proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_KEY,
    },
    body: init?.body,
  });
};
