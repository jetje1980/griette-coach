const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db, initDB } = require('./db');
const stravaRouter = require('./routes/strava');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'https://jetje1980.github.io'] }));
app.use(express.json());

initDB();

// ── Daily logs ────────────────────────────────────────────
app.get('/api/log/:date', (req, res) => {
  const row = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(req.params.date);
  res.json(row || null);
});

app.post('/api/log/:date', (req, res) => {
  const date = req.params.date;
  const data = req.body;
  const existing = db.prepare('SELECT date FROM daily_logs WHERE date = ?').get(date);

  if (existing) {
    const allowedCols = [
      'weight','bp_sys','bp_dia','energy','mood','sleep_quality','notes',
      'run_done','core_done','mounjaro','candesartan','adhd_meds',
      'water','protein','no_sugar','no_salt','bed_on_time','low_stress',
      'glasses','steps','cycle_phase','symptoms'
    ];
    const filtered = Object.fromEntries(
      Object.entries(data).filter(([k]) => allowedCols.includes(k))
    );
    if (Object.keys(filtered).length === 0) return res.json(db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date));
    const sets = Object.keys(filtered).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE daily_logs SET ${sets}, updated_at = datetime('now') WHERE date = @date`)
      .run({ ...filtered, date });
  } else {
    const cols = ['date', ...Object.keys(data)];
    const vals = cols.map(c => `@${c}`).join(', ');
    db.prepare(`INSERT INTO daily_logs (${cols.join(', ')}) VALUES (${vals})`)
      .run({ date, ...data });
  }

  res.json(db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date));
});

app.get('/api/logs', (req, res) => {
  const { from, to } = req.query;
  if (from && to) {
    const rows = db.prepare('SELECT * FROM daily_logs WHERE date >= ? AND date <= ? ORDER BY date DESC').all(from, to);
    return res.json(rows);
  }
  const rows = db.prepare('SELECT * FROM daily_logs ORDER BY date DESC LIMIT 90').all();
  res.json(rows);
});

// ── Measurements ──────────────────────────────────────────
app.get('/api/measurements', (req, res) => {
  res.json(db.prepare('SELECT * FROM measurements ORDER BY date DESC').all());
});

app.post('/api/measurements/:date', (req, res) => {
  const { waist, hip, arm, thigh, notes, photo_reminder } = req.body;
  db.prepare(`
    INSERT INTO measurements (date, waist, hip, arm, thigh, notes, photo_reminder)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      waist = excluded.waist, hip = excluded.hip,
      arm = excluded.arm, thigh = excluded.thigh,
      notes = excluded.notes, photo_reminder = excluded.photo_reminder
  `).run(req.params.date, waist, hip, arm, thigh, notes, photo_reminder ? 1 : 0);
  res.json({ success: true });
});

// ── Backup ────────────────────────────────────────────────
app.post('/api/backup', (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const now = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(os.homedir(), 'Documents', 'coach-backups');

  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const src = path.join(__dirname, '..', 'coach.db');
    const dst = path.join(backupDir, `coach-${now}.db`);
    fs.copyFileSync(src, dst);
    res.json({ success: true, path: dst });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI proxy ─────────────────────────────────────────────
// Forwards requests to Anthropic API using server-side key.
// Keeps the API key off the client.
app.post('/api/ai/messages', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  try {
    const https = require('https');
    const body = JSON.stringify(req.body);

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => { data += chunk; });
      proxyRes.on('end', () => {
        res.status(proxyRes.statusCode).set('Content-Type', 'application/json').send(data);
      });
    });

    proxyReq.on('error', err => res.status(502).json({ error: err.message }));
    proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Strava ────────────────────────────────────────────────
app.use('/api/strava', stravaRouter);

app.listen(PORT, () => {
  console.log(`🏃‍♀️  Coach backend → http://localhost:${PORT}`);
});
