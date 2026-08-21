import React, { useState } from 'react';
import { lastRunWorkout, logAdaptiveEvent } from '../workouts';
import { addDays } from '../datetime';
import {
  HEADACHE_SEVERITY, HEADACHE_TIMING, HEADACHE_DURATION,
  MIGRAINE_TYPES, MIGRAINE_TRIGGERS, MUSCLE_TYPES,
  POST_EXERTIONAL_SIGNS, exertionalResponse,
} from '../symptoms';

// De check die alles aanstuurt.
//
// Niet "hoe voel je je" maar drie dingen die op elkaar lijken en iets heel
// anders betekenen: post-exertionele hoofdpijn, migraine, en spierpijn.
// Hoofdpijn staat vooraan omdat dat bij deze loper de vroegste en
// betrouwbaarste waarschuwing is. Zonder deze invoer is de hele
// hardloopcoach blind — daarom is dit de kortst mogelijke versie: één vraag,
// en de rest verschijnt alleen als het antwoord daarom vraagt.

function Chips({ options, value, onChange, multi = false }) {
  const active = (id) => multi ? (value || []).includes(id) : value === id;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = active(o.id ?? o.value);
        return (
          <button key={o.id ?? o.value} type="button"
            onClick={() => {
              const key = o.id ?? o.value;
              if (!multi) return onChange(value === key ? null : key);
              const cur = value || [];
              onChange(cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key]);
            }}
            style={{
              fontSize: 11.5, fontWeight: on ? 700 : 500, lineHeight: 1.2,
              padding: '6px 10px', borderRadius: 99, cursor: 'pointer',
              border: `1px solid ${on ? (o.color || 'var(--sage)') : 'var(--border)'}`,
              background: on ? (o.color || 'var(--sage)') : 'transparent',
              color: on ? '#fff' : 'var(--sub)',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: hint ? 2 : 6 }}>{title}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.4,
        marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

export default function RecoveryCheck({ log, logs, currentDate, saveField }) {
  const [open, setOpen] = useState(false);
  const [showSigns, setShowSigns] = useState(false);

  const yest = addDays(currentDate, -1);
  const yestLog = logs?.[yest];
  const lastW = lastRunWorkout(currentDate);
  const trainedYesterday = yestLog?.run_done || yestLog?.strength_done || yestLog?.core_done ||
    (lastW && lastW.date === yest);

  if (!trainedYesterday) return null;

  const sessionNr = (lastW && lastW.date === yest ? lastW.plannedSessionId : null)
    || yestLog?.run_session || null;

  const severity = log?.headache_severity;
  const answered = severity != null;

  function answerHeadache(val) {
    // Na het eerste antwoord blijft het formulier open staan: de
    // vervolgvragen verschijnen dan, in plaats van dat het meteen dichtklapt.
    setOpen(true);
    saveField('headache_severity', val);
    // De adaptieve engine hoort hetzelfde te weten als de coach.
    saveField('recovery_check', val >= 2 ? 'bad' : 'good');
    if (sessionNr) {
      logAdaptiveEvent({
        date: currentDate, sessionNr: Number(sessionNr),
        event: val >= 2 ? 'poorly_tolerated' : 'tolerated',
        note: `herstelcheck: hoofdpijn ${HEADACHE_SEVERITY[val].label.toLowerCase()}`,
      });
    }
  }

  // Het oordeel meteen teruggeven, zodat invullen zichtbaar iets doet.
  const response = answered && lastW
    ? exertionalResponse({ workoutDate: lastW.date, logs: { ...logs, [currentDate]: log },
      currentDate })
    : null;

  const migraineOn = log?.migraine_type && log.migraine_type !== 'none';
  const signCount = POST_EXERTIONAL_SIGNS.filter(s => log?.[`pe_${s.id}`]).length;

  // ── Ingevuld: samenvatting, met de mogelijkheid te verfijnen ────
  if (answered && !open) {
    const sev = HEADACHE_SEVERITY[severity];
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: 14, lineHeight: 1.2 }}>
            {response?.status === 'good' ? '✓' : response?.status === 'red' ? '⛔' : '⚠'}
          </span>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
            <span style={{ color: sev.color, fontWeight: 700 }}>
              Hoofdpijn: {sev.label.toLowerCase()}.
            </span>{' '}
            {response?.reason}
          </div>
          <button onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--ghost)',
              cursor: 'pointer', fontSize: 11, padding: 0, whiteSpace: 'nowrap' }}>
            aanvullen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card)', border: `1px solid ${answered ? 'var(--border)' : 'var(--gold)'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
        Hoe reageerde je lichaam op {sessionNr ? 'de training van gisteren' : 'gisteren'}?
      </div>
      <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 9, lineHeight: 1.45 }}>
        Hoofdpijn na inspanning is jouw vroegste waarschuwing. Alleen dit eerste
        antwoord is nodig — de rest verschijnt als het ertoe doet.
      </div>

      <Chips options={HEADACHE_SEVERITY} value={severity} onChange={answerHeadache} />

      {severity > 0 && (
        <>
          <Section title="Wanneer begon het?">
            <Chips options={HEADACHE_TIMING} value={log?.headache_timing}
              onChange={v => saveField('headache_timing', v)} />
          </Section>
          <Section title="Hoe lang hield het aan?">
            <Chips options={HEADACHE_DURATION} value={log?.headache_duration}
              onChange={v => saveField('headache_duration', v)} />
          </Section>
        </>
      )}

      {answered && (
        <>
          <Section title="Spierpijn"
            hint="Gewone spierpijn hoort bij trainen en remt niets af. Diffuus of grieperig is iets anders.">
            <Chips options={MUSCLE_TYPES} value={log?.muscle_type || 'none'}
              onChange={v => saveField('muscle_type', v || 'none')} />
            {log?.muscle_type && log.muscle_type !== 'none' && (
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 5, lineHeight: 1.45 }}>
                {MUSCLE_TYPES.find(m => m.id === log.muscle_type)?.hint}
              </div>
            )}
          </Section>

          <Section title="Migraine"
            hint="Apart van de rest. Migraine wordt niet als inspanningsreactie gelezen, tenzij je inspanning zelf als trigger aanvinkt.">
            <Chips options={MIGRAINE_TYPES} value={log?.migraine_type || 'none'}
              onChange={v => saveField('migraine_type', v || 'none')} />
            {migraineOn && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginBottom: 5 }}>
                  Wat speelde mee?
                </div>
                <Chips options={MIGRAINE_TRIGGERS} value={log?.migraine_triggers} multi
                  onChange={v => saveField('migraine_triggers', v)} />
              </div>
            )}
          </Section>

          <div onClick={() => setShowSigns(v => !v)}
            style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer',
              marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between' }}>
            <span>Nog iets anders opgemerkt?{signCount ? ` (${signCount})` : ''}</span>
            <span>{showSigns ? '▲' : '▼'}</span>
          </div>
          {showSigns && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POST_EXERTIONAL_SIGNS.map(s => {
                const on = !!log?.[`pe_${s.id}`];
                return (
                  <button key={s.id} type="button"
                    onClick={() => saveField(`pe_${s.id}`, on ? null : true)}
                    style={{
                      fontSize: 11, fontWeight: on ? 700 : 500, padding: '6px 10px',
                      borderRadius: 99, cursor: 'pointer', lineHeight: 1.2,
                      border: `1px solid ${on ? (s.red ? 'var(--alert)' : 'var(--rust)') : 'var(--border)'}`,
                      background: on ? (s.red ? 'var(--alert)' : 'var(--rust)') : 'transparent',
                      color: on ? '#fff' : 'var(--sub)',
                    }}>
                    {s.red ? '⛔ ' : ''}{s.label}
                  </button>
                );
              })}
            </div>
          )}

          {response && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
              fontSize: 11.5, lineHeight: 1.5 }}>
              <strong>{response.reason}</strong>
              {response.advice && (
                <div style={{ color: 'var(--sub)', marginTop: 3 }}>{response.advice}</div>
              )}
            </div>
          )}

          <button onClick={() => setOpen(false)} className="os-btn-save"
            style={{ marginTop: 12, width: '100%' }}>
            Klaar
          </button>
        </>
      )}
    </div>
  );
}
