const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'coach.db');
const db = new Database(dbPath);

function initDB() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      date TEXT PRIMARY KEY,
      weight REAL,
      bp_sys INTEGER,
      bp_dia INTEGER,
      energy INTEGER,
      mood INTEGER,
      sleep_quality INTEGER,
      notes TEXT,
      run_done INTEGER DEFAULT 0,
      core_done INTEGER DEFAULT 0,
      mounjaro INTEGER DEFAULT 0,
      candesartan INTEGER DEFAULT 0,
      adhd_meds INTEGER DEFAULT 0,
      water INTEGER DEFAULT 0,
      protein INTEGER DEFAULT 0,
      no_sugar INTEGER DEFAULT 0,
      no_salt INTEGER DEFAULT 0,
      bed_on_time INTEGER DEFAULT 0,
      low_stress INTEGER DEFAULT 0,
      glasses INTEGER DEFAULT 0,
      steps INTEGER DEFAULT 0,
      cycle_phase TEXT,
      symptoms TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS strava_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      athlete_id INTEGER,
      athlete_name TEXT
    );

    CREATE TABLE IF NOT EXISTS strava_activities (
      strava_id INTEGER PRIMARY KEY,
      date TEXT,
      name TEXT,
      type TEXT,
      duration INTEGER,
      distance REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      hr_in_zone INTEGER,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS measurements (
      date TEXT PRIMARY KEY,
      waist REAL,
      hip REAL,
      arm REAL,
      thigh REAL,
      photo_reminder INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { db, initDB };
