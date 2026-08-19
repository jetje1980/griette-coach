// Frontend-koppeling naar de Edge Functions voor Strava en Trello.
// Alle geheimen staan server-side; de browser stuurt alleen zijn eigen
// Supabase access token mee, waarmee de functie de identiteit vaststelt.

import { SUPABASE_URL, getAccessToken } from './supabase';

const FN = (name, path = '') => `${SUPABASE_URL}/functions/v1/${name}${path}`;

async function call(name, path = '', { method = 'GET', body = null } = {}) {
  const token = await getAccessToken();
  if (!token) return { error: 'Niet ingelogd', status: 401 };
  try {
    const r = await fetch(FN(name, path), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json().catch(() => ({}));
    return { ...data, status: r.status, ok: r.ok };
  } catch (e) {
    // Netwerkfout: functie onbereikbaar
    return { error: e.message, status: 0, unreachable: true };
  }
}

// ── Strava ──────────────────────────────────────────────────────
// Coach leest alleen; er wordt nooit activity:write aangevraagd.
export const STRAVA_REQUIRED_SCOPES = ['read', 'activity:read_all'];

export const strava = {
  // { connected, configured, reachable, athlete, scopes, missingScopes, scopeOk }
  async status() {
    const r = await call('coach-strava', '/status');
    if (r.unreachable) return { connected: false, configured: false, reachable: false };
    return r;
  },
  async authUrl() {
    const r = await call('coach-strava', '/auth');
    return r.url || null;
  },
  async activities() {
    const r = await call('coach-strava', '/activities');
    return Array.isArray(r) ? r : [];
  },
  // Meest recente activiteit met details, laps/splits en streams —
  // gebruikt om de koppeling aantoonbaar te testen.
  async latest() { return call('coach-strava', '/latest'); },
  async sync() { return call('coach-strava', '/sync', { method: 'POST' }); },
  async disconnect() { return call('coach-strava', '/disconnect', { method: 'POST' }); },
};

// ── Trello ──────────────────────────────────────────────────────
const CFG_KEY = 'gc_trello_cfg';   // alleen board/list-keuze, geen geheimen

export function getTrelloConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { return {}; }
}
export function saveTrelloConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ ...getTrelloConfig(), ...cfg }));
}

export const trello = {
  async status() {
    const r = await call('coach-trello', '/status');
    if (r.unreachable) return { connected: false, configured: false, reachable: false };
    return { ...r, reachable: true };
  },
  // De autorisatielink wordt server-side gebouwd; de API-key komt nooit
  // in de frontend-bundel terecht.
  async authUrl() {
    const r = await call('coach-trello', '/auth-url');
    return r.url || null;
  },
  // Het token dat Trello na autorisatie toont, gaat rechtstreeks door naar
  // de server. Het wordt daar getoetst en opgeslagen — nooit in
  // localStorage, nooit in de bundel.
  async saveToken(token) {
    return call('coach-trello', '/save-token', { method: 'POST', body: { token } });
  },
  async boards() {
    const r = await call('coach-trello', '/boards');
    return Array.isArray(r) ? r : [];
  },
  async lists(boardId) {
    const r = await call('coach-trello', `/lists?boardId=${encodeURIComponent(boardId)}`);
    return Array.isArray(r) ? r : [];
  },
  async cards(listId) {
    const r = await call('coach-trello', `/cards?listId=${encodeURIComponent(listId)}`);
    return Array.isArray(r) ? r : [];
  },
  // Idempotent: dezelfde taak levert nooit een tweede card op
  async createCard({ taskId, title, desc = '', due = null }) {
    const cfg = getTrelloConfig();
    if (!cfg.backlogListId) return { error: 'Geen backlog-lijst gekozen' };
    return call('coach-trello', '/create-card', {
      method: 'POST',
      body: {
        taskId, title, desc, due,
        listId: cfg.backlogListId,
        idempotencyKey: `task:${taskId}`,
      },
    });
  },
};
