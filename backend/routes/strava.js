const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { db } = require('../db');

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:5173/strava/callback';
const HR_LOW = 106;
const HR_HIGH = 132;

router.get('/status', (req, res) => {
  const token = db.prepare('SELECT athlete_name FROM strava_tokens WHERE id = 1').get();
  res.json({ connected: !!token, athlete: token?.athlete_name || null });
});

router.get('/auth', (req, res) => {
  if (!CLIENT_ID) return res.status(400).json({ error: 'STRAVA_CLIENT_ID niet ingesteld in .env' });
  const url = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=read,activity:read_all`;
  res.json({ url });
});

router.post('/callback', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Geen code ontvangen' });

  try {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' })
    });
    const data = await r.json();
    if (data.errors || !data.access_token) return res.status(400).json({ error: 'OAuth mislukt', detail: data });

    db.prepare(`
      INSERT INTO strava_tokens (id, access_token, refresh_token, expires_at, athlete_id, athlete_name)
      VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        access_token=excluded.access_token, refresh_token=excluded.refresh_token,
        expires_at=excluded.expires_at, athlete_id=excluded.athlete_id, athlete_name=excluded.athlete_name
    `).run(data.access_token, data.refresh_token, data.expires_at, data.athlete.id, data.athlete.firstname);

    res.json({ success: true, athlete: data.athlete.firstname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activities', (req, res) => {
  res.json(db.prepare('SELECT * FROM strava_activities ORDER BY date DESC LIMIT 30').all());
});

async function refreshIfNeeded() {
  const row = db.prepare('SELECT * FROM strava_tokens WHERE id = 1').get();
  if (!row) return null;
  if (Date.now() / 1000 < row.expires_at - 60) return row.access_token;

  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: row.refresh_token, grant_type: 'refresh_token' })
  });
  const data = await r.json();
  if (!data.access_token) return null;

  db.prepare('UPDATE strava_tokens SET access_token=?, refresh_token=?, expires_at=? WHERE id=1')
    .run(data.access_token, data.refresh_token, data.expires_at);
  return data.access_token;
}

router.post('/sync', async (req, res) => {
  const accessToken = await refreshIfNeeded();
  if (!accessToken) return res.status(401).json({ error: 'Strava niet gekoppeld' });

  try {
    const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const activities = await r.json();
    if (!Array.isArray(activities)) return res.status(400).json({ error: 'Sync mislukt', detail: activities });

    const insert = db.prepare(`
      INSERT INTO strava_activities (strava_id, date, name, type, duration, distance, avg_hr, max_hr, hr_in_zone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(strava_id) DO UPDATE SET
        avg_hr=excluded.avg_hr, hr_in_zone=excluded.hr_in_zone, synced_at=datetime('now')
    `);

    for (const act of activities) {
      const date = act.start_date_local?.slice(0, 10);
      const avgHr = act.average_heartrate || null;
      const inZone = avgHr !== null ? (avgHr >= HR_LOW && avgHr <= HR_HIGH ? 1 : 0) : null;
      insert.run(act.id, date, act.name, act.type, act.moving_time, act.distance, avgHr, act.max_heartrate || null, inZone);

      if (date && (act.type === 'Run' || act.type === 'Walk')) {
        db.prepare(`INSERT INTO daily_logs (date, run_done) VALUES (?, 1)
          ON CONFLICT(date) DO UPDATE SET run_done = 1`).run(date);
      }
    }

    res.json({ success: true, count: activities.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/disconnect', (req, res) => {
  db.prepare('DELETE FROM strava_tokens WHERE id = 1').run();
  res.json({ success: true });
});

module.exports = router;
