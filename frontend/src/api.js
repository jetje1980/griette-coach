const BASE = '/api';

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}`);
  return r.json();
}

export const api = {
  getLog: (date) => req('GET', `/log/${date}`),
  saveLog: (date, data) => req('POST', `/log/${date}`, data),
  getLogs: (from, to) => req('GET', from && to ? `/logs?from=${from}&to=${to}` : '/logs'),

  getMeasurements: () => req('GET', '/measurements'),
  saveMeasurements: (date, data) => req('POST', `/measurements/${date}`, data),

  stravaStatus: () => req('GET', '/strava/status'),
  stravaAuth: () => req('GET', '/strava/auth'),
  stravaCallback: (code) => req('POST', '/strava/callback', { code }),
  stravaSync: () => req('POST', '/strava/sync'),
  stravaActivities: () => req('GET', '/strava/activities'),
  stravaDisconnect: () => req('DELETE', '/strava/disconnect'),

  backup: () => req('POST', '/backup'),
};
