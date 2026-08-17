import React, { useState, useEffect } from 'react';
import { computeHeadCoach } from './CoachAdvice';
import { USER, MEDS, SUPPLEMENTS, PRN_MEDS } from '../config';
import { RUNS } from '../data/runningSchema';

const SYMPTOMS_LIST = [
  { id: 'symptom_pem',        label: 'PEM-crash' },
  { id: 'symptom_exhaustion', label: 'Zware moeheid' },
  { id: 'symptom_breathless', label: 'Kortademig' },
  { id: 'symptom_brainfog',   label: 'Hersenmist' },
  { id: 'symptom_pain',       label: 'Spier/gewrichtspijn' },
  { id: 'symptom_headache',   label: 'Hoofdpijn' },
  { id: 'symptom_hayfever',   label: 'Hooikoorts' },
  { id: 'symptom_overdrive',  label: 'Overdrive' },
];

const MIGRAINE_TRIGGERS = [
  { id: 'hormonen',    label: 'Hormonen' },
  { id: 'slaap',       label: 'Slaap' },
  { id: 'inspanning',  label: 'Inspanning' },
  { id: 'stress',      label: 'Stress' },
  { id: 'weer',        label: 'Weer' },
  { id: 'voeding',     label: 'Voeding' },
  { id: 'onbekend',    label: 'Onbekend' },
];

const CRAVING_OPTS = [
  { id: 'geen',  label: 'Geen' },
  { id: 'zoet',  label: 'Zoet' },
  { id: 'zout',  label: 'Zout' },
  { id: 'alles', label: 'Alles' },
];

const TRAINING_ZONES = [
  { id: 'A',    label: 'Zone A — licht' },
  { id: 'B',    label: 'Zone B — matig' },
  { id: 'C',    label: 'Zone C — intensief' },
  { id: 'rust', label: 'Rust' },
];

// ── Shared helpers ──────────────────────────────────────────────

function ExpandSection({ label, children, initialOpen = false, badge = null }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button className={`os-expand-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span>{label}{badge !== null && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)',
          fontSize: 10, background: 'var(--green-bg)', color: 'var(--green)',
          borderRadius: 99, padding: '1px 6px' }}>{badge}</span>}</span>
        <span className="os-expand-arrow">↓</span>
      </button>
      {open && <div className="os-card" style={{ marginBottom: 8 }}>{children}</div>}
    </>
  );
}

function ScaleBtns({ value, opts, onSelect }) {
  return (
    <div className="os-scale-btns">
      {opts.map(o => (
        <button key={o.id}
          className={`os-scale-btn ${value === o.id || value === o.v ? 'active' : ''}`}
          onClick={() => onSelect(o.v !== undefined ? o.v : o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CheckItem({ checked, label, sub, onClick, colorClass = '' }) {
  return (
    <div className="os-check-item" onClick={onClick}>
      <div className={`os-check-box ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</div>
      <div>
        <div style={{ fontSize: 14, color: colorClass && checked ? `var(--${colorClass})` : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ghost)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Data helpers ────────────────────────────────────────────────
function getNextRunNr(logs) {
  const done = new Set(Object.values(logs || {}).filter(l => l.run_done && l.run_session).map(l => l.run_session));
  for (let n = 1; n <= RUNS.length; n++) if (!done.has(n)) return n;
  return RUNS.length;
}

const SLAAPQ_OPTS = [
  { id: 0, label: 'Slecht', v: 0 },
  { id: 1, label: 'Wisselend', v: 1 },
  { id: 2, label: 'Goed', v: 2 },
  { id: 3, label: 'Uitstekend', v: 3 },
];
const SCALE3_OPTS = [
  { id: 0, label: 'Laag', v: 0 },
  { id: 1, label: 'Matig', v: 1 },
  { id: 2, label: 'Goed', v: 2 },
  { id: 3, label: 'Hoog', v: 3 },
];
const HERSTEL_OPTS = [
  { id: 0, label: 'Fris', v: 0 },
  { id: 1, label: 'Matig', v: 1 },
  { id: 2, label: 'PEM-achtig', v: 2 },
];
const SLEEP_H_OPTS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(h => ({
  id: h, label: `${h}u`, v: h,
}));

const READINESS_MAP = {
  GREEN: { word: 'Goed',  cls: 'good', sub: 'Klaar voor training vandaag' },
  AMBER: { word: 'Matig', cls: '',     sub: 'Voorzichtig bewegen' },
  BLUE:  { word: 'Rust',  cls: 'rest', sub: 'Herstel staat voorop' },
  RED:   { word: 'Laag',  cls: 'low',  sub: 'Volledige rust vandaag' },
};

// ── Main component ──────────────────────────────────────────────
export default function LichaamScreen({ log, logs, currentDate, saveField, saveFields, isFuture }) {
  const [weight,    setWeight]    = useState('');
  const [bpSys,    setBpSys]     = useState('');
  const [bpDia,    setBpDia]     = useState('');
  const [battStart,setBattStart] = useState('');
  const [battEnd,  setBattEnd]   = useState('');
  const [flash,    setFlash]     = useState('');

  useEffect(() => {
    setWeight(log?.weight    ? String(log.weight)        : '');
    setBpSys(log?.bp_sys     ? String(log.bp_sys)        : '');
    setBpDia(log?.bp_dia     ? String(log.bp_dia)        : '');
    setBattStart(log?.battery_start ? String(log.battery_start) : '');
    setBattEnd(log?.battery_end     ? String(log.battery_end)   : '');
  }, [log]);

  const coach = computeHeadCoach(log, logs, currentDate);
  const r = READINESS_MAP[coach.decision] || READINESS_MAP.AMBER;

  const nextRunNr = getNextRunNr(logs);
  const nextRun   = RUNS[nextRunNr - 1];

  const yestDate = (() => { const d = new Date(currentDate); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  const yestLog  = logs?.[yestDate];
  const yestTrained  = yestLog?.run_done  || yestLog?.core_done;
  const trainedToday = log?.run_done || log?.core_done;

  const medsChecked = MEDS.filter(m => log?.[m.id]).length;

  function flashMsg(msg) { setFlash(msg); setTimeout(() => setFlash(''), 2200); }

  function saveWeight() {
    const v = parseFloat(weight);
    if (!isNaN(v) && v > 30 && v < 200) { saveField('weight', v); flashMsg('Gewicht opgeslagen'); }
  }
  function saveBP() {
    const s = parseInt(bpSys), d = parseInt(bpDia);
    if (!isNaN(s) && !isNaN(d)) { saveFields({ bp_sys: s, bp_dia: d }); flashMsg('Bloeddruk opgeslagen'); }
  }
  function saveBattery() {
    const s = parseFloat(battStart), e = parseFloat(battEnd);
    const f = {};
    if (!isNaN(s)) f.battery_start = s;
    if (!isNaN(e)) f.battery_end   = e;
    if (Object.keys(f).length) { saveFields(f); flashMsg('Battery opgeslagen'); }
  }
  function toggleMed(id)        { saveField(id, !log?.[id]); }
  function toggleSymptom(id)    { saveField(id, !log?.[id]); }
  function toggleSupplement(id) {
    const arr = log?.supplements || [];
    saveField('supplements', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }
  function togglePrn(id) {
    const arr = log?.prn_meds || [];
    saveField('prn_meds', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }
  function toggleMigTrigger(id) {
    const arr = log?.migraine_triggers || [];
    saveField('migraine_triggers', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }

  const activeSymptoms = SYMPTOMS_LIST.filter(s => log?.[s.id]).length;

  return (
    <div className="os-content">

      {/* Readiness */}
      <div className="os-readiness">
        <div className="os-readiness-label">Herstelstatus vandaag</div>
        <div className={`os-readiness-word ${r.cls}`}>{r.word}</div>
        <div className="os-readiness-sub">{r.sub}</div>
      </div>

      {/* Training recommendation */}
      {nextRun && (
        <>
          <div className="os-section-label">Vandaag trainen</div>
          <div className="os-card">
            <div className="os-action">
              <div className="os-action-icon">🏃</div>
              <div>
                <div className="os-action-title">{nextRun.title || `T${nextRunNr}/35`}</div>
                <div className="os-action-desc">
                  {nextRun.desc || nextRun.description || `Zone B · ${USER.hrZone.low}–${USER.hrZone.high} bpm`}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recovery */}
      <div className="os-section-label">Hersteladvies</div>
      <div className="os-card">
        <div className="os-action">
          <div className="os-action-icon blue">💤</div>
          <div>
            <div className="os-action-title">
              {coach.decision === 'RED'
                ? 'Volledige rust vandaag'
                : coach.decision === 'BLUE'
                  ? 'Hersteldag — lichte beweging'
                  : 'Vroeg naar bed vanavond'}
            </div>
            <div className="os-action-desc">
              {coach.decision === 'RED'
                ? 'Je lichaam vraagt rust. Geen training, geen extra belasting.'
                : 'Magnesium 400 mg voor het slapen. Doel: 8 uur slaap.'}
            </div>
          </div>
        </div>
      </div>

      {flash && (
        <div style={{ fontSize: 12, color: 'var(--green)', textAlign: 'center', padding: '6px 0' }}>
          {flash}
        </div>
      )}

      {/* ── HOE VOEL JE JE? ── */}
      <ExpandSection label="Hoe voel je je?" initialOpen={!log?.energy && !isFuture}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Energie</div>
            <ScaleBtns value={log?.energy} opts={SCALE3_OPTS} onSelect={v => saveField('energy', v)} />
          </div>
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Motivatie</div>
            <ScaleBtns value={log?.motivatie} opts={SCALE3_OPTS} onSelect={v => saveField('motivatie', v)} />
          </div>
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Slaapkwaliteit</div>
            <ScaleBtns value={log?.sleep_quality} opts={SLAAPQ_OPTS} onSelect={v => saveField('sleep_quality', v)} />
          </div>
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Slaapuren</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SLEEP_H_OPTS.map(o => (
                <button key={o.id}
                  className={`os-toggle-chip ${log?.sleep_hours === o.v ? 'active green' : ''}`}
                  onClick={() => saveField('sleep_hours', o.v)}
                  style={{ fontSize: 13 }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Herstelgevoel</div>
            <ScaleBtns value={log?.training_recovery} opts={HERSTEL_OPTS} onSelect={v => saveField('training_recovery', v)} />
          </div>
        </div>
      </ExpandSection>

      {/* ── METINGEN ── */}
      <ExpandSection label="Metingen — gewicht, bloeddruk, battery">
        <div>
          <div className="os-section-label" style={{ marginTop: 0 }}>Gewicht</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input className="os-input" type="number" step="0.1" inputMode="decimal"
              placeholder={log?.weight ? `${log.weight} kg` : 'bijv. 61.8'}
              value={weight} onChange={e => setWeight(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveWeight()} />
            <button className="os-btn-save" onClick={saveWeight}>Sla op</button>
          </div>

          <div className="os-section-label">Bloeddruk</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input className="os-input-num" type="number" inputMode="numeric"
              placeholder="sys" value={bpSys} onChange={e => setBpSys(e.target.value)} />
            <span style={{ color: 'var(--ghost)' }}>/</span>
            <input className="os-input-num" type="number" inputMode="numeric"
              placeholder="dia" value={bpDia} onChange={e => setBpDia(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--ghost)' }}>mmHg</span>
            <button className="os-btn-save" onClick={saveBP}>Sla op</button>
          </div>

          <div className="os-section-label">Body Battery (Garmin)</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 4 }}>Ochtend %</div>
              <input className="os-input-num" type="number" min="0" max="100" inputMode="numeric"
                placeholder="54" value={battStart} onChange={e => setBattStart(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ghost)', marginBottom: 4 }}>Avond %</div>
              <input className="os-input-num" type="number" min="0" max="100" inputMode="numeric"
                placeholder="72" value={battEnd} onChange={e => setBattEnd(e.target.value)} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="os-btn-save" onClick={saveBattery}>Sla op</button>
            </div>
          </div>
        </div>
      </ExpandSection>

      {/* ── KLACHTEN ── */}
      <ExpandSection label="Klachten — symptomen &amp; ADHD" badge={activeSymptoms > 0 ? activeSymptoms : null}>
        <div>
          <div className="os-section-label" style={{ marginTop: 0 }}>Symptomen vandaag</div>
          <div className="os-toggle-grid" style={{ marginBottom: 16 }}>
            {SYMPTOMS_LIST.map(s => (
              <button key={s.id}
                className={`os-toggle-chip ${log?.[s.id] ? 'active' : ''}`}
                onClick={() => toggleSymptom(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="os-section-label">ADHD &amp; pacing</div>
          <CheckItem checked={!!log?.adhd_break} label="Bewust pauze genomen"
            onClick={() => saveField('adhd_break', !log?.adhd_break)} />
          <CheckItem checked={!!log?.adhd_one_thing} label="Één ding tegelijk gedaan"
            onClick={() => saveField('adhd_one_thing', !log?.adhd_one_thing)} />
          <CheckItem checked={!!log?.adhd_overwhelmed} label="Overprikkeld vandaag"
            colorClass="red" onClick={() => saveField('adhd_overwhelmed', !log?.adhd_overwhelmed)} />

          <div className="os-section-label" style={{ marginTop: 16 }}>Migraine</div>
          <CheckItem checked={!!log?.migraine} label="Migraine vandaag"
            onClick={() => saveField('migraine', !log?.migraine)} />
          {log?.migraine && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--ghost)', marginBottom: 6 }}>Triggers</div>
              <div className="os-toggle-grid">
                {MIGRAINE_TRIGGERS.map(t => (
                  <button key={t.id}
                    className={`os-toggle-chip ${(log?.migraine_triggers || []).includes(t.id) ? 'active' : ''}`}
                    onClick={() => toggleMigTrigger(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ExpandSection>

      {/* ── MEDICATIE ── */}
      <ExpandSection label="Medicatie — dagelijks &amp; zo nodig"
        badge={medsChecked > 0 ? `${medsChecked}/${MEDS.length}` : null}>
        <div>
          <div className="os-section-label" style={{ marginTop: 0 }}>Dagelijks</div>
          {MEDS.map(med => (
            <CheckItem key={med.id}
              checked={!!log?.[med.id]}
              label={med.label}
              sub={med.detail}
              onClick={() => toggleMed(med.id)} />
          ))}

          <div className="os-section-label">Zo nodig</div>
          {PRN_MEDS.map(med => (
            <CheckItem key={med.id}
              checked={(log?.prn_meds || []).includes(med.id)}
              label={med.label}
              sub={med.detail}
              onClick={() => togglePrn(med.id)} />
          ))}

          <div className="os-section-label">Supplementen</div>
          {SUPPLEMENTS.map(sup => (
            <CheckItem key={sup.id}
              checked={(log?.supplements || []).includes(sup.id)}
              label={sup.label}
              sub={sup.detail}
              onClick={() => toggleSupplement(sup.id)} />
          ))}
        </div>
      </ExpandSection>

      {/* ── VOEDING ── */}
      <ExpandSection label="Voeding — water, eiwit &amp; eetgedrag">
        <div>
          <div className="os-section-label" style={{ marginTop: 0 }}>Water (glazen)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[1,2,3,4,5,6,7,8].map(n => (
              <button key={n}
                className={`os-toggle-chip ${(log?.water_glasses || 0) >= n ? 'active green' : ''}`}
                onClick={() => saveField('water_glasses', (log?.water_glasses || 0) >= n ? n-1 : n)}
                style={{ width: 38, padding: '6px 0', textAlign: 'center' }}>
                {n}
              </button>
            ))}
          </div>

          <div className="os-section-label">Eiwitfocus</div>
          {['Ontbijt met eiwit','Lunch met eiwit','Diner met eiwit'].map((label, i) => {
            const key = `eiwit_${i}`;
            return (
              <CheckItem key={key} checked={!!log?.[key]} label={label}
                onClick={() => saveField(key, !log?.[key])} />
            );
          })}

          <div className="os-section-label" style={{ marginTop: 16 }}>Craving</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {CRAVING_OPTS.map(o => (
              <button key={o.id}
                className={`os-toggle-chip ${log?.craving === o.id ? 'active' : ''}`}
                onClick={() => saveField('craving', o.id)}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="os-section-label">Eetgedrag</div>
          <CheckItem checked={!!log?.late_eating} label="Laat gegeten (na 20u)"
            onClick={() => saveField('late_eating', !log?.late_eating)} />
          <CheckItem checked={!!log?.emotional_eating} label="Emotie-eten gehad"
            onClick={() => saveField('emotional_eating', !log?.emotional_eating)} />
        </div>
      </ExpandSection>

      {/* ── TRAINING VASTLEGGEN ── */}
      {!isFuture && (
        <ExpandSection label="Training vastleggen">
          <div>
            <div className="os-section-label" style={{ marginTop: 0 }}>Wat heb je gedaan?</div>
            <CheckItem checked={!!log?.run_done} label="Hardlopen gedaan"
              sub={`T${nextRunNr}/35`}
              onClick={() => saveField('run_done', !log?.run_done)} />
            <CheckItem checked={!!log?.core_done} label="Core programma gedaan"
              onClick={() => saveField('core_done', !log?.core_done)} />

            <div className="os-section-label" style={{ marginTop: 16 }}>Trainingszone</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TRAINING_ZONES.map(z => (
                <button key={z.id}
                  className={`os-toggle-chip ${log?.training_zone === z.id ? 'active green' : ''}`}
                  onClick={() => saveField('training_zone', z.id)}>
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        </ExpandSection>
      )}

      {/* ── NA TRAINING ── */}
      {(trainedToday || yestTrained) && !isFuture && (
        <ExpandSection label="Na training — RPE &amp; herstelcheck" initialOpen={!!trainedToday}>
          <div>
            {yestTrained && !trainedToday && (
              <>
                <div className="os-section-label" style={{ marginTop: 0 }}>Reactie na gisteren</div>
                <CheckItem checked={!!log?.delayed_fatigue} label="Meer moeheid dan verwacht"
                  onClick={() => saveField('delayed_fatigue', !log?.delayed_fatigue)} />
                <CheckItem checked={!!log?.delayed_brainfog} label="Hersenmist vandaag"
                  onClick={() => saveField('delayed_brainfog', !log?.delayed_brainfog)} />
                <CheckItem checked={!!log?.delayed_breathless} label="Kortademig na training gisteren"
                  onClick={() => saveField('delayed_breathless', !log?.delayed_breathless)} />
              </>
            )}
            {trainedToday && (
              <>
                <div className="os-section-label" style={{ marginTop: 0 }}>Inspanning (RPE 1–10)</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n}
                      className={`os-toggle-chip ${log?.training_rpe === n ? 'active' : ''}`}
                      onClick={() => saveField('training_rpe', n)}
                      style={{ width: 36, padding: '6px 0', textAlign: 'center' }}>
                      {n}
                    </button>
                  ))}
                </div>

                <div className="os-section-label">Benen / spieren</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {['fris','normaal','zwaar'].map(v => (
                    <button key={v}
                      className={`os-toggle-chip ${log?.training_legs === v ? 'active green' : ''}`}
                      onClick={() => saveField('training_legs', v)}>
                      {v}
                    </button>
                  ))}
                </div>

                <div className="os-section-label">Had je meer kunnen doen?</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['ja','beetje','nee'].map(v => (
                    <button key={v}
                      className={`os-toggle-chip ${log?.training_could_more === v ? 'active green' : ''}`}
                      onClick={() => saveField('training_could_more', v)}>
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </ExpandSection>
      )}

      {/* ── NOTITIE ── */}
      <ExpandSection label="Notitie van vandaag">
        <textarea
          className="os-input"
          rows={4}
          placeholder="Schrijf iets op..."
          defaultValue={log?.note || ''}
          onChange={e => {
            clearTimeout(window._noteTimer);
            window._noteTimer = setTimeout(() => saveField('note', e.target.value), 1000);
          }}
          style={{ resize: 'vertical', fontFamily: 'var(--font)', lineHeight: 1.55, width: '100%' }}
        />
      </ExpandSection>

    </div>
  );
}
