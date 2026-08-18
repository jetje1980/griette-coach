import React, { useState, useEffect } from 'react';
import {
  loadTasks, createTask, updateTask, deleteTask, TASK_STATUSES,
  destinationText, getDayActions, saveDayActions,
} from '../tasks';
import { trello, getTrelloConfig } from '../integrations';

// Canonieke Capture Center: één plek voor alles wat je vastlegt.
// Elk item houdt een zichtbare status én bestemming — niets verdwijnt.

const DESTINATIONS = [
  { id: 'today', emoji: '☀️', label: 'Vandaag', desc: 'Als actie op je dag' },
  { id: 'week',  emoji: '🗓', label: 'Deze week', desc: 'Als weekprioriteit' },
  { id: 'later', emoji: '🅿️', label: 'Later', desc: 'Parkeren, blijft vindbaar' },
  // Externe bestemming: pas selecteerbaar als de koppeling echt werkt.
  { id: 'trello', emoji: '📋', label: 'Trello Backlog', desc: 'Naar je Trello-backlog' },
];

function weekMondayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

export default function CaptureCenter({ currentDate, onChange }) {
  const [tasks, setTasks] = useState(loadTasks);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('inbox');
  const [planning, setPlanning] = useState(null);   // taak die een bestemming krijgt
  const [delegating, setDelegating] = useState(null);
  const [delForm, setDelForm] = useState({ to: '', followUpDate: '', note: '' });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [trelloState, setTrelloState] = useState(null);   // null = nog onbekend

  useEffect(() => {
    trello.status().then(setTrelloState).catch(() => setTrelloState({ connected: false }));
  }, []);

  function refresh() {
    setTasks(loadTasks());
    onChange?.();
  }
  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2500); }

  function add() {
    const t = text.trim();
    if (!t) return;
    createTask({ title: t, source: 'capture', status: 'inbox' });
    setText('');
    refresh();
  }

  // Bestemming kiezen — "plannen" betekent altijd: kies waar dit heengaat
  async function applyDestination(task, destId) {
    if (destId === 'today') {
      const actions = getDayActions(currentDate);
      if (!actions.some(a => a.taskId === task.id)) {
        saveDayActions(currentDate, [...actions, { id: `a_${Date.now()}`, taskId: task.id, title: task.title, done: false }]);
      }
      updateTask(task.id, { status: 'planned', destination: 'today', date: currentDate });
      flash('Op Vandaag gezet');
    } else if (destId === 'week') {
      const monday = weekMondayOf(currentDate);
      const key = `gc_week_prio_${monday}`;
      let prio = [];
      try { prio = JSON.parse(localStorage.getItem(key) || '[]'); } catch { prio = []; }
      if (prio.length >= 3) {
        flash('Je hebt al 3 weekprioriteiten — rond er eerst één af');
        return;
      }
      prio.push({ id: Date.now().toString(), text: task.title, done: false, taskId: task.id });
      localStorage.setItem(key, JSON.stringify(prio));
      updateTask(task.id, { status: 'planned', destination: 'week', date: monday });
      flash('Als weekprioriteit toegevoegd');
    } else if (destId === 'trello') {
      if (!trelloState?.connected) {
        flash('Trello nog niet gekoppeld — regel dat eerst in Instellingen');
        return;
      }
      setPlanning(null);
      flash('Trello-card aanmaken…');
      const res = await trello.createCard({ taskId: task.id, title: task.title });
      if (res?.error) {
        updateTask(task.id, { syncState: 'error' });
        flash(`Trello-fout: ${res.error}`);
      } else {
        updateTask(task.id, {
          status: 'planned', destination: 'trello',
          trelloCardId: res.cardId, trelloUrl: res.url,
          trelloBoardId: res.boardId, trelloListId: res.listId,
          syncState: 'synced', lastSyncedAt: new Date().toISOString(),
        });
        flash(res.duplicate ? 'Card bestond al — geen dubbele aangemaakt' : 'Trello-card aangemaakt');
      }
      refresh();
      return;
    } else {
      updateTask(task.id, { status: 'parked', destination: 'later' });
      flash('Geparkeerd — terug te vinden onder Geparkeerd');
    }
    setPlanning(null);
    refresh();
  }

  function saveDelegation() {
    if (!delForm.to.trim()) return;
    updateTask(delegating.id, {
      status: 'delegated', destination: null,
      delegatedTo: delForm.to.trim(),
      delegatedAt: currentDate,
      followUpDate: delForm.followUpDate || null,
      note: delForm.note || null,
    });
    setDelegating(null);
    setDelForm({ to: '', followUpDate: '', note: '' });
    flash('Gedelegeerd — zichtbaar onder Gedelegeerd');
    refresh();
  }

  const counts = Object.fromEntries(
    TASK_STATUSES.map(s => [s.id, tasks.filter(t => t.status === s.id).length])
  );
  const visible = tasks.filter(t => t.status === filter);

  return (
    <div>
      {/* Invoer */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="os-input" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Iets wat in je hoofd zit…" />
        <button className="os-btn-save" onClick={add} style={{ flexShrink: 0 }}>+ Zet</button>
      </div>

      {msg && (
        <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>{msg}</div>
      )}

      {/* Statusfilters — elk item blijft vindbaar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {TASK_STATUSES.map(s => (
          <button key={s.id}
            className={`os-toggle-chip ${filter === s.id ? 'active green' : ''}`}
            onClick={() => setFilter(s.id)}
            style={{ fontSize: 11.5 }}>
            {s.emoji} {s.label}{counts[s.id] ? ` ${counts[s.id]}` : ''}
          </button>
        ))}
      </div>

      {/* Bestemmingskeuze */}
      {planning && (
        <div className="os-card" style={{ marginBottom: 12, border: '1px solid var(--sage)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Waar gaat dit heen? — "{planning.title}"
          </div>
          {DESTINATIONS.map(d => {
            const off = d.id === 'trello' && !trelloState?.connected;
            const desc = d.id === 'trello'
              ? (trelloState === null ? 'verbinding controleren…'
                 : trelloState.connected ? `Board-lijst: ${getTrelloConfig().backlogListName || 'ingesteld'}`
                 : 'Trello nog niet gekoppeld')
              : d.desc;
            return (
              <div key={d.id}
                onClick={() => { if (!off) applyDestination(planning, d.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px',
                  cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.45 : 1,
                  borderBottom: '1px solid var(--divide)' }}>
                <span style={{ fontSize: 17 }}>{d.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: off ? 'var(--rust)' : 'var(--ghost)' }}>{desc}</div>
                </div>
                <span style={{ color: 'var(--ghost)' }}>{off ? '—' : '›'}</span>
              </div>
            );
          })}
          <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 10 }}
            onClick={() => setPlanning(null)}>Annuleer</button>
        </div>
      )}

      {/* Delegeerformulier */}
      {delegating && (
        <div className="os-card" style={{ marginBottom: 12, border: '1px solid var(--gold)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Delegeren — "{delegating.title}"
          </div>
          <input className="os-input" placeholder="Aan wie?" value={delForm.to}
            onChange={e => setDelForm(f => ({ ...f, to: e.target.value }))}
            style={{ marginBottom: 8 }} autoFocus />
          <div style={{ fontSize: 10, color: 'var(--ghost)', textTransform: 'uppercase',
            letterSpacing: '0.4px', marginBottom: 3 }}>Follow-up op</div>
          <input className="os-input" type="date" value={delForm.followUpDate}
            onChange={e => setDelForm(f => ({ ...f, followUpDate: e.target.value }))}
            style={{ marginBottom: 8 }} />
          <input className="os-input" placeholder="Notitie (optioneel)" value={delForm.note}
            onChange={e => setDelForm(f => ({ ...f, note: e.target.value }))}
            style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="os-btn-save" onClick={saveDelegation}>Opslaan</button>
            <button className="os-toggle-chip" onClick={() => setDelegating(null)}>Annuleer</button>
          </div>
        </div>
      )}

      {/* Itemlijst */}
      {visible.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ghost)', textAlign: 'center', padding: '14px 0' }}>
          Niets onder {TASK_STATUSES.find(s => s.id === filter)?.label.toLowerCase()}.
        </div>
      )}

      {visible.map(item => (
        <div key={item.id} style={{ paddingBottom: 10, marginBottom: 10,
          borderBottom: '1px solid var(--divide)' }}>
          {editingId === item.id ? (
            <input className="os-input" defaultValue={item.title} autoFocus
              style={{ marginBottom: 6 }}
              onBlur={e => {
                if (e.target.value.trim()) updateTask(item.id, { title: e.target.value.trim() });
                setEditingId(null); refresh();
              }}
              onKeyDown={e => e.key === 'Enter' && e.target.blur()} />
          ) : (
            <div style={{ fontSize: 14, marginBottom: 4,
              textDecoration: item.status === 'done' ? 'line-through' : 'none',
              color: item.status === 'done' ? 'var(--sub)' : 'var(--text)' }}
              onClick={() => setEditingId(item.id)}>
              {item.title}
            </div>
          )}

          {/* Bestemming altijd zichtbaar */}
          {(destinationText(item) || item.delegatedTo) && (
            <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, marginBottom: 5 }}>
              → {item.delegatedTo
                ? `${item.delegatedTo}${item.followUpDate ? ` · follow-up ${item.followUpDate}` : ''}`
                : destinationText(item)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {item.status !== 'done' && (
              <button className="os-toggle-chip" style={{ fontSize: 11.5 }}
                onClick={() => setPlanning(item)}>
                {item.destination ? 'Bestemming wijzigen' : 'Plannen'}
              </button>
            )}
            {item.status !== 'delegated' && item.status !== 'done' && (
              <button className="os-toggle-chip" style={{ fontSize: 11.5 }}
                onClick={() => { setDelegating(item); setDelForm({ to: '', followUpDate: '', note: '' }); }}>
                Delegeren
              </button>
            )}
            {item.status !== 'done' ? (
              <button className="os-toggle-chip" style={{ fontSize: 11.5, color: 'var(--green)' }}
                onClick={() => { updateTask(item.id, { status: 'done' }); refresh(); }}>
                ✓ Klaar
              </button>
            ) : (
              <button className="os-toggle-chip" style={{ fontSize: 11.5 }}
                onClick={() => { updateTask(item.id, { status: 'inbox' }); refresh(); }}>
                Heropenen
              </button>
            )}
            <button className="os-toggle-chip" style={{ fontSize: 11.5 }}
              onClick={() => {
                if (window.confirm('Dit item verwijderen?')) { deleteTask(item.id); refresh(); }
              }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}
