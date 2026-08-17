import React, { useState } from 'react';
import { USER } from '../config';
import { store } from '../store';

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('');
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  async function finish() {
    const fields = {};
    if (weight && !isNaN(parseFloat(weight))) fields.weight = parseFloat(weight);
    if (bpSys && bpDia) { fields.bp_sys = parseInt(bpSys); fields.bp_dia = parseInt(bpDia); }
    if (Object.keys(fields).length) await store.saveLog(today, fields);
    localStorage.setItem('gc_onboarding_done', '1');
    onDone();
  }

  const steps = [
    // Step 0: Welcome
    <div key={0} style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏃‍♀️</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.3 }}>
        Welkom, {USER.name}!
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>
        Je persoonlijke coach staat klaar.
        <br />70 dagen · van {USER.startWeight} kg naar {USER.goalWeight} kg
        <br />Zone B · long covid tempo · jouw ritme
      </div>
      <div style={{ background: 'var(--rust-l)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, textAlign: 'left', fontSize: 12, lineHeight: 1.8 }}>
        <div><strong>Jouw programma:</strong></div>
        <div>📅 Start: {USER.startDate}</div>
        <div>🎯 Doel: {USER.goalWeight} kg</div>
        <div>❤️ Zone B: {USER.hrZone.low}–{USER.hrZone.high} bpm</div>
        <div>🏃 35 looptrainingen + 10 weken core</div>
      </div>
      <button className="btn btn-rust btn-full" onClick={() => setStep(1)}>
        Laten we beginnen →
      </button>
    </div>,

    // Step 1: Starting measurements
    <div key={1}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
        Beginmeting vandaag
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Optioneel — je kunt dit ook later invullen via het Vandaag-tabblad.
      </div>

      <div className="input-label">GEWICHT (kg)</div>
      <div className="input-row" style={{ marginBottom: 16 }}>
        <input type="number" step="0.1" placeholder={`${USER.startWeight}`} value={weight} onChange={e => setWeight(e.target.value)} style={{ flex: 1 }} />
        <span className="unit">kg</span>
      </div>

      <div className="input-label">BLOEDDRUK (mmHg)</div>
      <div className="input-row" style={{ marginBottom: 24 }}>
        <input type="number" placeholder="120" value={bpSys} onChange={e => setBpSys(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
        <span className="unit" style={{ fontSize: 18, fontWeight: 800 }}>/</span>
        <input type="number" placeholder="80" value={bpDia} onChange={e => setBpDia(e.target.value)} style={{ flex: 1, textAlign: 'center' }} />
        <span className="unit">mmHg</span>
      </div>

      <button className="btn btn-rust btn-full" onClick={() => setStep(2)}>
        Volgende →
      </button>
      <button className="btn btn-full" style={{ marginTop: 8, background: 'transparent', color: 'var(--muted)', fontSize: 11 }} onClick={() => setStep(2)}>
        Sla over
      </button>
    </div>,

    // Step 2: AI coach intro
    <div key={2} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
        AI-coach activeren
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20, textAlign: 'left' }}>
        Elke <strong>3 dagen</strong> analyseert de AI-coach jouw gewicht, bloeddruk, energie en trainingen — en geeft je concreet advies.
        <br /><br />
        Je kunt ook progressiefoto's laten analyseren.
        <br /><br />
        Hiervoor is een <strong>Anthropic API-sleutel</strong> nodig. Stel die in via <strong>Instellingen</strong> (⚙️ in de header).
      </div>
      <div style={{ background: 'var(--sage-l)', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: 'var(--sage)', marginBottom: 20, textAlign: 'left', lineHeight: 1.6 }}>
        💡 Geen sleutel? De app werkt gewoon — je mist alleen de AI-analyses. Je kunt hem later toevoegen.
      </div>
      <button className="btn btn-rust btn-full" onClick={finish}>
        Start mijn programma 🚀
      </button>
    </div>,
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 48 }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 20px' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: i === step ? 20 : 8,
              height: 8,
              borderRadius: 99,
              background: i <= step ? 'var(--rust)' : 'var(--border)',
              transition: 'all 0.25s',
            }} />
          ))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}
