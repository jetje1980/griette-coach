# Griette's Coach App

Lokale persoonlijke coach-app voor dagelijkse check-ins, training, voeding en trends.
Data blijft volledig lokaal op je Mac in `coach.db`.

## Vereisten

- Node.js 18+
- npm 9+

## Installatie

```bash
# 1. Ga naar de app-map
cd griette-coach

# 2. Installeer alle dependencies
npm run install:all

# 3. Maak .env aan
cp .env.example .env
# Vul je Strava Client ID en Secret in (zie hieronder)
```

## Starten

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Strava koppelen

1. Ga naar [strava.com/settings/api](https://www.strava.com/settings/api)
2. Maak een nieuwe app aan:
   - **Application Name**: Griette Coach
   - **Website**: http://localhost
   - **Authorization Callback Domain**: `localhost`
3. Kopieer **Client ID** en **Client Secret**
4. Vul in `.env`:
   ```
   STRAVA_CLIENT_ID=12345
   STRAVA_CLIENT_SECRET=abc123...
   ```
5. Herstart de app en klik op "Koppel Strava" in het Training-tabblad

## Backup

Klik op de **Backup** knop in Instellingen, of handmatig:

```bash
cp coach.db ~/Documents/coach-backups/coach-$(date +%Y-%m-%d).db
```

Backups gaan automatisch naar `~/Documents/coach-backups/`.

## Bestanden

```
griette-coach/
├── backend/          Express server + SQLite
├── frontend/         Vite + React app
├── coach.db          Jouw data (in .gitignore)
├── .env              Strava credentials (in .gitignore)
└── .env.example      Template
```

## Hardloopschema

Het schema bevat 35 trainingen (placeholder). Upload je `hardloopschema.pdf`
om de exacte trainingen in te voeren in `frontend/src/data/runningSchema.js`.
