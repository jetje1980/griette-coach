import React, { useState, useMemo } from 'react';
import {
  BUTTONS, runButton, recordFeedback, FEEDBACK_OPTIONS, STATES,
  ANCHOR_TYPES, loadAnchors, saveAnchor, deleteAnchor,
  ALIVENESS_CATEGORIES, ALIVENESS_PROMPTS,
  loadAlivenessList, saveAlivenessItem, deleteAlivenessItem,
} from '../aliveness';
import { todayLocal } from '../datetime';

// Een klein stukje van het leven dat je wilt, vandaag al.
//
// Dit is geen taak en geen extra verplichting. Het is een voorstel, en je
// mag er "past niet bij mij" op zeggen — dan verdwijnt het.

// ── De kaart op Vandaag ─────────────────────────────────────────
export default function AlivenessCard({ log, logs, currentDate = todayLocal(), coach, state }) {
  const [result, setResult] = useState(null);
  const [given, setGiven] = useState({});
  const [open, setOpen] = useState(false);

  const ctx = { log, logs, currentDate, coach, state, place: 'home' };

  function press(id) {
    setResult(runButton(id, ctx));
    setGiven({});
    setOpen(true);
  }

  function feedback(itemId, optionId) {
    recordFeedback(itemId, optionId, { date: currentDate });
    setGiven(g => ({ ...g, [itemId]: optionId }));
  }

  return (
    <div className="os-card" style={{ marginBottom: 10, borderLeft: '4px solid var(--gold)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Vandaag al een beetje
      </div>

      {!open && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {BUTTONS.map(b => (
            <button key={b.id} className="os-toggle-chip" onClick={() => press(b.id)}
              style={{ fontSize: 11.5, whiteSpace: 'normal', textAlign: 'left' }}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {open && result && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--ghost)', flex: 1 }}>{result.button.label}</div>
            <button onClick={() => { setOpen(false); setResult(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--ghost)',
                fontSize: 14, cursor: 'pointer', padding: 0 }}>✕</button>
          </div>

          {!result.available ? (
            <div style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.5 }}>
              {result.reason}
            </div>
          ) : (
            <>
              {result.context && (
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 8 }}>
                  {result.context}
                </div>
              )}
              {result.items.map(item => (
                <div key={item.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 14 }}>{item.state?.emoji}</span>
                    <span style={{ fontSize: 10, color: 'var(--ghost)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {item.state?.label} · {item.minutes} min
                    </span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>{item.text}</div>

                  {given[item.id] ? (
                    <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 5 }}>
                      {given[item.id] === 'annoying'
                        ? 'Genoteerd — dit stel ik niet meer voor.'
                        : 'Genoteerd. Daar leer ik van.'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--ghost)', alignSelf: 'center' }}>
                        Deed dit iets voor je?
                      </span>
                      {FEEDBACK_OPTIONS.map(o => (
                        <button key={o.id} className="os-toggle-chip"
                          onClick={() => feedback(item.id, o.id)} style={{ fontSize: 10.5 }}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button className="btn-secondary" onClick={() => press(result.button.id)}
                style={{ fontSize: 11.5, whiteSpace: 'normal' }}>Iets anders</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Beheer: ankers en wat mij levend maakt ──────────────────────
export function AlivenessLibrary() {
  const [tick, setTick] = useState(0);
  const [form, setForm] = useState(null);
  const [aliveForm, setAliveForm] = useState(null);
  const anchors = useMemo(() => loadAnchors(), [tick]);
  const alive = useMemo(() => loadAlivenessList(), [tick]);

  function addAnchor() {
    if (!form?.label) return;
    saveAnchor(form);
    setForm(null); setTick(t => t + 1);
  }
  function addAlive() {
    if (!aliveForm?.text) return;
    saveAlivenessItem(aliveForm);
    setAliveForm(null); setTick(t => t + 1);
  }

  const Label = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>{children}</div>
      {right}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.55 }}>
        Hoe meer de coach weet welke muziek, plek en smaak van jou zijn, hoe
        persoonlijker de voorstellen worden. Zonder deze lijst werkt het ook,
        maar dan algemener.
      </div>

      <Label right={
        <button onClick={() => setForm(form ? null : { type: 'music', label: '', cost: 'low', minutes: 5 })}
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {form ? 'sluiten' : '+ anker'}
        </button>
      }>Mijn ankers</Label>

      <div className="os-card">
        {anchors.length === 0 && !form && (
          <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.6 }}>
            Nog geen ankers. Denk aan de muziek die je aanzet als je wilt bewegen,
            de plek waar je heen gaat als je je ogen sluit, of het servies waar je
            blij van wordt.
            <div style={{ marginTop: 8 }}>
              {ANCHOR_TYPES.map(t => (
                <div key={t.id} style={{ fontSize: 11, marginBottom: 4 }}>
                  <strong>{t.emoji} {t.label}.</strong>{' '}
                  <span style={{ color: 'var(--ghost)' }}>{t.example}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ANCHOR_TYPES.map(t => {
          const rows = anchors.filter(a => a.type === t.id);
          if (!rows.length) return null;
          return (
            <div key={t.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                {t.emoji} {t.label}
              </div>
              {rows.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8,
                  fontSize: 12, padding: '3px 0' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{a.label}</span>
                  {a.state && (
                    <span style={{ fontSize: 10, color: 'var(--ghost)' }}>
                      {STATES.find(s => s.id === a.state)?.label}
                    </span>
                  )}
                  <button onClick={() => { deleteAnchor(a.id); setTick(x => x + 1); }}
                    style={{ background: 'none', border: 'none', color: 'var(--rust)',
                      fontSize: 11, cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          );
        })}

        {form && (
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {ANCHOR_TYPES.map(t => (
                <button key={t.id} className={`os-toggle-chip ${form.type === t.id ? 'active green' : ''}`}
                  onClick={() => setForm({ ...form, type: t.id })} style={{ fontSize: 11 }}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder={ANCHOR_TYPES.find(t => t.id === form.type)?.hint}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
                borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8,
                background: 'var(--surface)', color: 'var(--text)' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Waar helpt dit bij? (optioneel)
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {STATES.map(s => (
                <button key={s.id} className={`os-toggle-chip ${form.state === s.id ? 'active green' : ''}`}
                  onClick={() => setForm({ ...form, state: form.state === s.id ? null : s.id })}
                  style={{ fontSize: 10.5 }}>{s.emoji} {s.label}</button>
              ))}
            </div>
            <button className="btn-primary" onClick={addAnchor} disabled={!form.label}
              style={{ fontSize: 12, whiteSpace: 'normal' }}>Anker bewaren</button>
          </div>
        )}
      </div>

      <Label right={
        <button onClick={() => setAliveForm(aliveForm ? null : { category: 'play', text: '' })}
          style={{ background: 'none', border: 'none', color: 'var(--sage)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {aliveForm ? 'sluiten' : '+ toevoegen'}
        </button>
      }>Wat maakt mij levend</Label>

      <div className="os-card">
        {alive.length === 0 && !aliveForm && (
          <div style={{ fontSize: 11.5, color: 'var(--ghost)', lineHeight: 1.7 }}>
            Verlangens zijn ook data. Een paar vragen om mee te beginnen:
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              {ALIVENESS_PROMPTS.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {alive.map(a => {
          const cat = ALIVENESS_CATEGORIES.find(c => c.id === a.category);
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8,
              fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
              <span>{cat?.emoji}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{a.text}</span>
              {a.recurring && (
                <span style={{ fontSize: 10, color: 'var(--gold)' }}>keert terug</span>
              )}
              <button onClick={() => { deleteAlivenessItem(a.id); setTick(x => x + 1); }}
                style={{ background: 'none', border: 'none', color: 'var(--rust)',
                  fontSize: 11, cursor: 'pointer' }}>×</button>
            </div>
          );
        })}

        {aliveForm && (
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {ALIVENESS_CATEGORIES.map(c => (
                <button key={c.id} className={`os-toggle-chip ${aliveForm.category === c.id ? 'active green' : ''}`}
                  onClick={() => setAliveForm({ ...aliveForm, category: c.id })}
                  style={{ fontSize: 10.5 }}>{c.emoji} {c.label}</button>
              ))}
            </div>
            <input value={aliveForm.text} onChange={e => setAliveForm({ ...aliveForm, text: e.target.value })}
              placeholder="Bijv. zwemmen in open water aan het eind van de dag"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
                borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8,
                background: 'var(--surface)', color: 'var(--text)' }} />
            <button className={`os-toggle-chip ${aliveForm.recurring ? 'active green' : ''}`}
              onClick={() => setAliveForm({ ...aliveForm, recurring: !aliveForm.recurring })}
              style={{ fontSize: 11, marginBottom: 8 }}>
              Dit verlangen keert al jaren terug
            </button>
            <div />
            <button className="btn-primary" onClick={addAlive} disabled={!aliveForm.text}
              style={{ fontSize: 12, whiteSpace: 'normal' }}>Bewaren</button>
          </div>
        )}
      </div>
    </div>
  );
}
