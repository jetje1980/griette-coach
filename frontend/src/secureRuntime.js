import { supabase, SUPABASE_KEY, SUPABASE_URL } from './supabaseClient';

const nativeFetch = window.fetch.bind(window);
const nativeGet = localStorage.getItem.bind(localStorage);
const nativeSet = localStorage.setItem.bind(localStorage);
const nativeRemove = localStorage.removeItem.bind(localStorage);
const SERVER_AI_MARKER = 'beveiligd-via-coachserver';
const CLEANUP_MARKER = 'gc_cleanup_2026_08_18';

const CURRENT_COACH_CONTRACT = `ACTUEEL COACH-CONTRACT — dit heeft voorrang op oudere hardcoded appteksten:
- Griette Coach is een Life Performance OS + Performance Coach + persoonlijke Chief of Staff.
- Presenteer één geïntegreerd besluit. Dagstatus is GREEN TRAIN, AMBER MODIFY, BLUE RECOVERY of RED STOP & REVIEW.
- Long COVID / PEM: session performance is nooit genoeg; delayed tolerance 6–48 uur weegt mee vóór progressie.
- Trainingsbesluit gebruikt BUILD, HOLD, REPEAT, DELOAD, SWAP of TEST. Verhoog nooit volume én intensiteit tegelijk.
- Behandel toekomstige/planned records nooit als werkelijk uitgevoerde data.
- Perimenopauze: leer persoonlijke patronen; geen generieke cyclusdogma's.
- Body composition: combineer gewichtstrend met taille, kracht, performance, foto's en herstel. Geen agressieve restrictie ten koste van herstel/spiermassa.
- Executive function: maximaal 3 echte prioriteiten, bescherm vrije tijd, geef bij 'Wat nu?' één concrete volgende actie.
- Runna/andere externe planning is context, nooit de baas. De Coach beslist.
- Stel geen autonome medische diagnose; signaleer rode vlaggen voor medische beoordeling.
- Gebruik GEEN oude statische event-, gewichts-, medicatie- of wedstrijdmijlpalen uit broncode als actuele waarheid. Alleen actuele gebruikersdata en expliciet huidige plannen gelden.`;

const LEGACY_CONTEXT_PATTERNS = [
  /Huidige Mounjaro-prik:/i,
  /Werkingsfase:/i,
  /Fietsweekend/i,
  /Q-music Foute Party/i,
  /Weekend Parijs/i,
  /Zomervakantie/i,
  /Ameland gezinsvakantie/i,
  /TROUWJURK/i,
  /Terschelling Bereloop/i,
  /Oud & Nieuw met vrienden/i,
  /Projecteer gewicht/i,
  /ondergrens eigen keuze/i,
  /10 km hardloopevenement/i,
];

function sanitizeText(text) {
  if (typeof text !== 'string') return text;
  return text.split('\n').filter(line => !LEGACY_CONTEXT_PATTERNS.some(rx => rx.test(line))).join('\n');
}

function sanitizeMessages(messages = []) {
  let injected = false;
  return messages.map(message => {
    if (typeof message?.content === 'string') {
      const clean = sanitizeText(message.content);
      if (!injected && message.role === 'user') {
        injected = true;
        return { ...message, content: `${CURRENT_COACH_CONTRACT}\n\n${clean}` };
      }
      return { ...message, content: clean };
    }
    if (Array.isArray(message?.content)) {
      const content = message.content.map(block => {
        if (block?.type === 'text') return { ...block, text: sanitizeText(block.text) };
        return block;
      });
      if (!injected && message.role === 'user') {
        injected = true;
        content.unshift({ type: 'text', text: CURRENT_COACH_CONTRACT });
      }
      return { ...message, content };
    }
    return message;
  });
}

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
    parsed.plan = parsed.plan.map((day, i) => { const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i); return { ...day, date: d.toISOString().slice(0, 10) }; });
    return JSON.stringify(parsed);
  } catch { return value; }
}
function sanitizeFutureLog(key, value) {
  const match = key.match(/^gc_log_(\d{4}-\d{2}-\d{2})$/);
  if (!match || match[1] <= localDateKey()) return value;
  try {
    const parsed = JSON.parse(value) || {};
    const clean = { date: match[1], entry_type: 'planned' };
    if (parsed.mounjaro === 1 || parsed.mounjaro === true) clean.mounjaro = 1;
    return JSON.stringify(clean);
  } catch { return JSON.stringify({ date: match[1], entry_type: 'planned' }); }
}

nativeRemove('gc_api_key');
nativeSet('gc_api_key', SERVER_AI_MARKER);
for (const key of ['gc_training_plan', 'gc_training_plan_date', 'gc_training_plans_history']) nativeRemove(key);
if (!nativeGet(CLEANUP_MARKER)) {
  nativeRemove('gc_coach_reports_history');
  nativeRemove('gc_coach_report');
  nativeRemove('gc_coach_report_date');
  nativeSet(CLEANUP_MARKER, new Date().toISOString());
}
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i); if (!key) continue;
  const value = nativeGet(key); if (value == null) continue;
  if (/^gc_log_\d{4}-\d{2}-\d{2}$/.test(key)) nativeSet(key, sanitizeFutureLog(key, value));
  if (key.startsWith('gc_week_focus_')) nativeSet(key, canonicalizeWeekFocus(key, value));
}

localStorage.getItem = function (key) {
  if (key === 'gc_api_key') return SERVER_AI_MARKER;
  if (['gc_training_plan','gc_training_plan_date','gc_training_plans_history'].includes(key)) return null;
  return nativeGet(key);
};
localStorage.setItem = function (key, value) {
  if (key === 'gc_api_key') return nativeSet(key, SERVER_AI_MARKER);
  if (['gc_training_plan','gc_training_plan_date','gc_training_plans_history'].includes(key)) return;
  let safeValue = String(value);
  if (/^gc_log_\d{4}-\d{2}-\d{2}$/.test(key)) safeValue = sanitizeFutureLog(key, safeValue);
  if (key.startsWith('gc_week_focus_')) safeValue = canonicalizeWeekFocus(key, safeValue);
  return nativeSet(key, safeValue);
};
localStorage.removeItem = function (key) {
  if (key === 'gc_api_key') return nativeSet(key, SERVER_AI_MARKER);
  return nativeRemove(key);
};

window.fetch = async function (input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url?.startsWith('https://api.anthropic.com/v1/messages')) return nativeFetch(input, init);

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return new Response(JSON.stringify({ error: { message: 'Log opnieuw in om AI te gebruiken.' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });

  let body = init?.body;
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    if (parsed && Array.isArray(parsed.messages)) body = JSON.stringify({ ...parsed, messages: sanitizeMessages(parsed.messages) });
  } catch {}

  return nativeFetch(`${SUPABASE_URL}/functions/v1/fitness-ai?action=proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}`, 'apikey': SUPABASE_KEY },
    body,
  });
};
