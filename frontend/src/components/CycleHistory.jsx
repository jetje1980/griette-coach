import React, { useState } from 'react';

// Historie van menstruatiestarts: toevoegen (ook historisch), wijzigen,
// verwijderen. Voedt de persoonlijke patroonanalyse — geen vaste regels.

const CUR_KEY  = 'gc_cycle_start';
const HIST_KEY = 'gc_cycle_history';

export function loadCycleStarts() {
  try {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    const cur = localStorage.getItem(CUR_KEY);
    return [...new Set([...(cur ? [cur] : []), ...hist])]
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch { return []; }
}

// Schrijft de volledige lijst terug: nieuwste blijft gc_cycle_start,
// de rest in gc_cycle_history. Beide sleutels blijven bestaan zodat
// oudere code die ze leest niets kwijtraakt.
function persistStarts(list) {
  const sorted = [...new Set(list)].sort();
  const newest = sorted[sorted.length - 1] || null;
  if (newest) localStorage.setItem(CUR_KEY, newest);
  else localStorage.removeItem(CUR_KEY);
  localStorage.setItem(HIST_KEY, JSON.stringify(sorted));
}

export function cycleStats() {
  const starts = loadCycleStarts();
  if (starts.length < 2) return { count: starts.length, avg: null, intervals: [] };
  const intervals = [];
  for (let i = 1; i < starts.length; i++) {
    intervals.push(Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000));
  }
  const valid = intervals.filter(d => d >= 15 && d <= 90);
  const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  return { count: starts.length, avg, intervals, valid };
}

export default function CycleHistory({ onChange }) {
  const [starts, setStarts] = useState(loadCycleStarts);
  const [form, setForm] = useState(null);   // { original, date }
  const [msg, setMsg] = useState('');

  function refresh() { setStarts(loadCycleStarts()); onChange?.(); }
  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2500); }

  function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) return;
    const list = starts.filter(d => d !== form.original);
    if (list.includes(form.date)) { flash('Die datum staat al in de historie'); return; }
    persistStarts([...list, form.date]);
    setForm(null);
    refresh();
    flash(form.original ? 'Datum gewijzigd' : 'Menstruatiestart toegevoegd');
  }

  function remove(date) {
    if (!window.confirm(`Cyclusstart ${date} verwijderen?`)) return;
    persistStarts(starts.filter(d => d !== date));
    refresh();
    flash('Verwijderd');
  }

  const stats = cycleStats();
  const desc = [...starts].reverse();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--sub)' }}>
          {stats.count} geregistreerde start{stats.count === 1 ? '' : 's'}
        </div>
        {stats.avg && (
          <div style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}>
            gemiddeld {stats.avg} dagen
          </div>
        )}
      </div>

      {msg && <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>{msg}</div>}

      {desc.length === 0 && !form && (
        <div style={{ fontSize: 12.5, color: 'var(--ghost)', marginBottom: 10, lineHeight: 1.5 }}>
          Nog geen cyclusstarts. Voeg ook eerdere data toe — daarmee kan de patroonanalyse
          eerder iets zinnigs zeggen.
        </div>
      )}

      {desc.map((d, i) => {
        const prev = desc[i + 1];
        const gap = prev ? Math.round((new Date(d) - new Date(prev)) / 86400000) : null;
        return (
          <div key={d} className="os-detail-row">
            <span className="os-dk">
              {d}
              {gap != null && <span style={{ color: 'var(--ghost)', fontSize: 11 }}> · {gap} dagen na vorige</span>}
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setForm({ original: d, date: d })}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 13 }}>✎</button>
              <button onClick={() => remove(d)}
                style={{ background: 'none', border: 'none', color: 'var(--ghost)', cursor: 'pointer', fontSize: 15 }}>×</button>
            </span>
          </div>
        );
      })}

      {form ? (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--divide)' }}>
          <input type="date" className="os-input" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            style={{ marginBottom: 8 }} autoFocus />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="os-btn-save" onClick={save}>{form.original ? 'Bijwerken' : 'Toevoegen'}</button>
            <button className="os-toggle-chip" onClick={() => setForm(null)}>Annuleer</button>
          </div>
        </div>
      ) : (
        <button className="os-toggle-chip" style={{ fontSize: 12, marginTop: 8 }}
          onClick={() => setForm({ original: null, date: new Date().toISOString().slice(0, 10) })}>
          + Menstruatiestart toevoegen (datum vrij te kiezen)
        </button>
      )}
    </div>
  );
}
