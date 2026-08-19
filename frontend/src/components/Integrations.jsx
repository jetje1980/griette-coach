import React, { useState, useEffect } from 'react';
import { strava, trello, getTrelloConfig, saveTrelloConfig, STRAVA_REQUIRED_SCOPES } from '../integrations';

// Overzicht van externe koppelingen. Elke status komt van een echte
// serveraanroep — er wordt nooit "gekoppeld" getoond zonder bevestiging.

function StatusPill({ state }) {
  const map = {
    connected:    { label: 'Gekoppeld',        color: 'var(--green)' },
    readonly:     { label: 'Alleen lezen',     color: 'var(--gold)' },
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
  // "Gekoppeld" claimen we alleen als schrijven ook werkt. Credentials
  // die alleen mogen lezen zijn geen werkende koppeling voor Capture.
  if (status.readOnly) return 'readonly';
  return status.connected ? 'connected' : 'configured';
}

export default function Integrations() {
  const [stravaStatus, setStravaStatus] = useState(null);
  const [trelloStatus, setTrelloStatus] = useState(null);
  const [boards, setBoards] = useState(null);      // null = nog niet geladen
  const [boardsError, setBoardsError] = useState('');
  const [lists, setLists] = useState(null);
  const [writeTest, setWriteTest] = useState(null);
  const [testingWrite, setTestingWrite] = useState(false);
  const [cfg, setCfg] = useState(getTrelloConfig);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [latest, setLatest] = useState(null);
  const [testError, setTestError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMsg, setTokenMsg] = useState(null);

  // Echte test: haalt de meest recente activiteit op met details en streams.
  async function testLatest() {
    setTesting(true); setTestError(''); setLatest(null);
    try {
      const r = await strava.latest();
      if (r?.error) setTestError(r.error);
      else if (!r?.activity) setTestError('Geen activiteiten gevonden in je Strava-account');
      else setLatest(r.activity);
    } catch (e) { setTestError(e.message); }
    finally { setTesting(false); }
  }

  useEffect(() => {
    strava.status().then(setStravaStatus).catch(() => setStravaStatus({ reachable: false }));
    trello.status().then(setTrelloStatus).catch(() => setTrelloStatus({ reachable: false }));
  }, []);

  // Boards laden zodra er leesrecht is. Mislukt het, dan zeggen we dat —
  // eerder bleef er eindeloos "Boards laden…" staan.
  useEffect(() => {
    if (!(trelloStatus?.canRead || trelloStatus?.connected)) return;
    let alive = true;
    setBoardsError('');
    trello.boards()
      .then(b => { if (alive) setBoards(Array.isArray(b) ? b : []); })
      .catch(e => { if (alive) { setBoards([]); setBoardsError(e.message || 'ophalen mislukt'); } });
    return () => { alive = false; };
  }, [trelloStatus?.canRead, trelloStatus?.connected]);

  useEffect(() => {
    if (!cfg.boardId) { setLists(null); return; }
    let alive = true;
    trello.lists(cfg.boardId)
      .then(l => { if (alive) setLists(Array.isArray(l) ? l : []); })
      .catch(() => { if (alive) setLists([]); });
    return () => { alive = false; };
  }, [cfg.boardId]);

  async function runWriteTest() {
    if (!cfg.backlogListId) return;
    setTestingWrite(true); setWriteTest(null);
    try {
      setWriteTest(await trello.verifyWrite(cfg.backlogListId));
    } catch (e) {
      setWriteTest({ ok: false, message: e.message });
    } finally { setTestingWrite(false); }
  }

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

  async function openTrelloAuth() {
    setBusy(true); setTokenMsg(null);
    try {
      const url = await trello.authUrl();
      if (url) window.open(url, '_blank', 'noopener');
      else setTokenMsg({ ok: false, text: 'Server kan de autorisatielink niet bouwen.' });
    } finally { setBusy(false); }
  }

  async function saveTrelloToken() {
    setBusy(true); setTokenMsg(null);
    try {
      const r = await trello.saveToken(tokenInput);
      if (r?.ok) {
        setTokenMsg({ ok: true, text: `Gekoppeld als ${r.member}.` });
        setTokenInput('');
        setTrelloStatus(await trello.status());
      } else {
        setTokenMsg({ ok: false, text: r?.error || 'Opslaan mislukt.' });
      }
    } catch (e) {
      setTokenMsg({ ok: false, text: e.message });
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                ✓ Verbonden{stravaStatus.athlete ? ` als ${stravaStatus.athlete}` : ''}
              </div>

              {/* Automatische sync draait elk uur server-side */}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                🔄 Automatisch ophalen staat aan — elk uur.
                {stravaStatus.autoSyncAt && (
                  <> Laatste keer: {new Date(stravaStatus.autoSyncAt).toLocaleString('nl-NL',
                    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</>
                )}
                {stravaStatus.importedCount != null && (
                  <> {stravaStatus.importedCount} activiteiten opgehaald.</>
                )}
              </div>

              {/* Werkelijk verleende scopes — niet wat we vroegen, maar wat Strava gaf */}
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                Verleende toegang
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                {(stravaStatus.scopes || []).length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--ghost)' }}>onbekend</span>
                )}
                {(stravaStatus.scopes || []).map(sc => (
                  <span key={sc} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 99, color: 'var(--green)', border: '1px solid var(--green)' }}>
                    {sc}
                  </span>
                ))}
                {(stravaStatus.missingScopes || []).map(sc => (
                  <span key={sc} style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 99, color: 'var(--rust)', border: '1px solid var(--rust)' }}>
                    {sc} ontbreekt
                  </span>
                ))}
              </div>

              {stravaStatus.scopeOk === false && (
                <div style={{ background: 'rgba(179,94,69,0.08)', border: '1px solid var(--rust)',
                  borderRadius: 8, padding: '9px 11px', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rust)', marginBottom: 3 }}>
                    Te weinig toegang voor hartslag en splits
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
                    Coach heeft {STRAVA_REQUIRED_SCOPES.join(' + ')} nodig. Autoriseer opnieuw
                    en vink bij Strava de toegang tot je activiteiten aan.
                  </div>
                  <button className="btn btn-rust" style={{ background: '#FC4C02' }}
                    onClick={connectStrava} disabled={busy}>
                    Opnieuw autoriseren
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="os-toggle-chip" style={{ fontSize: 12 }}
                  onClick={testLatest} disabled={testing}>
                  {testing ? 'Ophalen…' : 'Test: laatste activiteit'}
                </button>
                <button className="os-toggle-chip" style={{ fontSize: 12 }}
                  onClick={connectStrava} disabled={busy}>Opnieuw autoriseren</button>
                <button className="os-toggle-chip" style={{ fontSize: 12 }}
                  onClick={() => strava.disconnect().then(() => strava.status().then(setStravaStatus))}>
                  Ontkoppelen
                </button>
              </div>

              {testError && (
                <div style={{ fontSize: 11.5, color: 'var(--rust)', fontWeight: 600,
                  marginTop: 8, lineHeight: 1.4 }}>{testError}</div>
              )}

              {latest && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                    {latest.name} — {latest.type}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.7 }}>
                    <div>Datum: {latest.date}</div>
                    {latest.distanceKm != null && <div>Afstand: {latest.distanceKm} km</div>}
                    {latest.movingTime && <div>Duur: {latest.movingTime} (bewegend)</div>}
                    {latest.pacePerKm && <div>Pace: {latest.pacePerKm} /km</div>}
                    {latest.averageHr != null
                      ? <div>HR: gem. {Math.round(latest.averageHr)} · max {latest.maxHr} bpm</div>
                      : <div style={{ color: 'var(--ghost)' }}>HR: niet beschikbaar in deze activiteit</div>}
                    {latest.laps?.length > 0 && <div>Laps: {latest.laps.length}</div>}
                    {latest.splits?.length > 0 && <div>Splits: {latest.splits.length} × 1 km</div>}
                    {latest.streamsAvailable?.length > 0 && (
                      <div>Streams: {latest.streamsAvailable.join(', ')}</div>
                    )}
                  </div>
                  <a href={latest.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600,
                      display: 'inline-block', marginTop: 6 }}>
                    Bekijk op Strava →
                  </a>
                </div>
              )}
            </>
          )}
          {sState === 'configured' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                De serverfunctie draait. Coach vraagt <strong>{STRAVA_REQUIRED_SCOPES.join(' + ')}</strong> —
                genoeg om hartslag en splits te lezen, en bewust géén schrijfrechten.
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

          {tState === 'unconfigured' && !trelloStatus?.keyPresent && (
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              De serverfunctie draait, maar de Trello API-key ontbreekt nog. Zet
              <strong> TRELLO_API_KEY</strong> in Supabase → Edge Functions → Secrets.
            </div>
          )}
          {tState === 'unreachable' && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              De Trello-service is nu niet bereikbaar.
            </div>
          )}

          {/* Koppelen in twee stappen: autoriseren, dan het token terugplakken.
              Trello geeft geen redirect terug, dus overtypen is de enige weg. */}
          {tState !== 'connected' && trelloStatus && trelloStatus.reachable !== false
            && (trelloStatus.keyPresent !== false) && (
            <div style={{ marginTop: 8 }}>
              {trelloStatus.error && (
                <div style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 8 }}>
                  Trello weigert de huidige koppeling. Koppel opnieuw.
                </div>
              )}
              <button className="btn-secondary"
                onClick={openTrelloAuth} disabled={busy}
                style={{ fontSize: 12, whiteSpace: 'normal', marginBottom: 8 }}>
                Stap 1 — Trello autoriseren
              </button>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 6 }}>
                Trello toont daarna een lange code. Plak die hier.
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input value={tokenInput} onChange={e => setTokenInput(e.target.value.trim())}
                  placeholder="Plak de code van Trello"
                  autoComplete="off" spellCheck={false}
                  style={{ flex: '1 1 180px', minWidth: 0, fontSize: 12, padding: '7px 9px',
                    borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)' }} />
                <button className="btn-primary" onClick={saveTrelloToken}
                  disabled={busy || !tokenInput}
                  style={{ fontSize: 12, whiteSpace: 'normal' }}>
                  Stap 2 — Opslaan
                </button>
              </div>
              {tokenMsg && (
                <div style={{ fontSize: 11, marginTop: 6,
                  color: tokenMsg.ok ? 'var(--sage)' : 'var(--rust)' }}>
                  {tokenMsg.text}
                </div>
              )}
            </div>
          )}

          {(tState === 'connected' || tState === 'readonly') && (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                Verbonden als {trelloStatus.member}. Kies waar Capture-items terechtkomen.
              </div>
              {tState === 'readonly' && (
                <div style={{ fontSize: 11.5, color: 'var(--rust)', lineHeight: 1.5, marginBottom: 8 }}>
                  {trelloStatus.reason} Capture → Trello werkt hierdoor niet.
                </div>
              )}

              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Board</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {(boards || []).map(b => (
                  <button key={b.id}
                    className={`os-toggle-chip ${cfg.boardId === b.id ? 'active green' : ''}`}
                    onClick={() => pickBoard(b)} style={{ fontSize: 11.5 }}>
                    {b.name}
                  </button>
                ))}
                {boards === null && (
                  <span style={{ fontSize: 11, color: 'var(--ghost)' }}>Boards laden…</span>
                )}
                {boards?.length === 0 && (
                  <span style={{ fontSize: 11, color: boardsError ? 'var(--rust)' : 'var(--ghost)' }}>
                    {boardsError
                      ? `Boards ophalen mislukt: ${boardsError}`
                      : 'Geen open boards gevonden in dit account.'}
                  </span>
                )}
              </div>

              {cfg.boardId && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    Backlog-lijst
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(lists || []).map(l => (
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
                <>
                  <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, marginTop: 8 }}>
                    ✓ Capture → Trello gaat naar “{cfg.backlogListName}” op “{cfg.boardName}”
                  </div>
                  {/* Het enige echte bewijs: een kaart aanmaken en weer
                      weghalen. Credentials zeggen niets over of het werkt. */}
                  <button className="btn-secondary" onClick={runWriteTest} disabled={testingWrite}
                    style={{ fontSize: 11.5, marginTop: 8, whiteSpace: 'normal' }}>
                    {testingWrite ? 'Testen…' : 'Test: kaart aanmaken en verwijderen'}
                  </button>
                  {writeTest && (
                    <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5,
                      color: writeTest.ok ? 'var(--sage)' : 'var(--rust)' }}>
                      {writeTest.ok ? '✓ ' : '✕ '}{writeTest.message || writeTest.error}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
