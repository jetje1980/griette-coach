import React, { useState, useEffect } from 'react';
import { strava, trello, getTrelloConfig, saveTrelloConfig } from '../integrations';

// Overzicht van externe koppelingen. Elke status komt van een echte
// serveraanroep — er wordt nooit "gekoppeld" getoond zonder bevestiging.

function StatusPill({ state }) {
  const map = {
    connected:    { label: 'Gekoppeld',        color: 'var(--green)' },
    configured:   { label: 'Nog niet gekoppeld', color: 'var(--gold)' },
    unconfigured: { label: 'Sleutels ontbreken', color: 'var(--gold)' },
    unreachable:  { label: 'Niet bereikbaar',  color: 'var(--rust)' },
    checking:     { label: 'Controleren…',     color: 'var(--ghost)' },
  };
  const s = map[state] || map.checking;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color,
      border: `1px solid ${s.color}`, borderRadius: 99, padding: '2px 9px' }}>
      {s.label}
    </span>
  );
}

function stateOf(status) {
  if (!status) return 'checking';
  if (status.reachable === false) return 'unreachable';
  if (status.configured === false) return 'unconfigured';
  return status.connected ? 'connected' : 'configured';
}

export default function Integrations() {
  const [stravaStatus, setStravaStatus] = useState(null);
  const [trelloStatus, setTrelloStatus] = useState(null);
  const [boards, setBoards] = useState([]);
  const [lists, setLists] = useState([]);
  const [cfg, setCfg] = useState(getTrelloConfig);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    strava.status().then(setStravaStatus).catch(() => setStravaStatus({ reachable: false }));
    trello.status().then(setTrelloStatus).catch(() => setTrelloStatus({ reachable: false }));
  }, []);

  useEffect(() => {
    if (trelloStatus?.connected) trello.boards().then(setBoards).catch(() => {});
  }, [trelloStatus?.connected]);

  useEffect(() => {
    if (cfg.boardId) trello.lists(cfg.boardId).then(setLists).catch(() => {});
  }, [cfg.boardId]);

  function pickBoard(b) {
    const next = { boardId: b.id, boardName: b.name, backlogListId: null, backlogListName: null };
    saveTrelloConfig(next);
    setCfg(getTrelloConfig());
  }
  function pickList(l) {
    saveTrelloConfig({ backlogListId: l.id, backlogListName: l.name });
    setCfg(getTrelloConfig());
  }

  async function connectStrava() {
    setBusy(true);
    try {
      const url = await strava.authUrl();
      if (url) window.location.href = url;
    } finally { setBusy(false); }
  }

  const sState = stateOf(stravaStatus);
  const tState = stateOf(trelloStatus);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div className="card-accent" style={{ background: '#0EA5E9' }} />
        <div className="card-title">🔌 Integraties</div>
      </div>
      <div className="card-body">

        {/* Strava */}
        <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>🏃 Strava</span>
            <StatusPill state={sState} />
          </div>
          {sState === 'connected' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                Gekoppeld{stravaStatus.athlete ? ` als ${stravaStatus.athlete}` : ''}. Activiteiten
                worden zonder duplicaten geïmporteerd.
              </div>
              <button className="os-toggle-chip" style={{ fontSize: 12 }}
                onClick={() => strava.disconnect().then(() => strava.status().then(setStravaStatus))}>
                Ontkoppelen
              </button>
            </>
          )}
          {sState === 'configured' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                De serverfunctie draait. Koppel je Strava-account om activiteiten
                automatisch te importeren.
              </div>
              <button className="btn btn-rust" style={{ background: '#FC4C02' }}
                onClick={connectStrava} disabled={busy}>
                {busy ? 'Bezig…' : 'Koppel Strava'}
              </button>
            </>
          )}
          {sState === 'unconfigured' && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              De serverfunctie draait, maar de Strava-sleutels ontbreken nog. Zet
              <strong> STRAVA_CLIENT_ID</strong> en <strong>STRAVA_CLIENT_SECRET</strong> in
              Supabase → Edge Functions → Secrets. Handmatig invoeren en screenshot-import
              werken ondertussen gewoon.
            </div>
          )}
          {sState === 'unreachable' && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              De Strava-service is nu niet bereikbaar. Handmatig invoeren en
              screenshot-import blijven werken.
            </div>
          )}
        </div>

        {/* Trello */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>📋 Trello</span>
            <StatusPill state={tState} />
          </div>

          {tState === 'unconfigured' && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              De serverfunctie draait, maar de Trello-sleutels ontbreken nog. Zet
              <strong> TRELLO_API_KEY</strong> en <strong>TRELLO_TOKEN</strong> in
              Supabase → Edge Functions → Secrets.
            </div>
          )}
          {tState === 'unreachable' && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              De Trello-service is nu niet bereikbaar.
            </div>
          )}

          {tState === 'connected' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                Verbonden als {trelloStatus.member}. Kies waar Capture-items terechtkomen.
              </div>

              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Board</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {boards.map(b => (
                  <button key={b.id}
                    className={`os-toggle-chip ${cfg.boardId === b.id ? 'active green' : ''}`}
                    onClick={() => pickBoard(b)} style={{ fontSize: 11.5 }}>
                    {b.name}
                  </button>
                ))}
                {boards.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ghost)' }}>Boards laden…</span>
                )}
              </div>

              {cfg.boardId && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    Backlog-lijst
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {lists.map(l => (
                      <button key={l.id}
                        className={`os-toggle-chip ${cfg.backlogListId === l.id ? 'active green' : ''}`}
                        onClick={() => pickList(l)} style={{ fontSize: 11.5 }}>
                        {l.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {cfg.backlogListId && (
                <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, marginTop: 8 }}>
                  ✓ Capture → Trello gaat naar “{cfg.backlogListName}” op “{cfg.boardName}”
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
