import React, { useState, useMemo } from 'react';
import { CHALLENGE, CIRCUIT, CIRCUIT_TOTAL_SECONDS, RECOVERY_VERSION }
  from '../data/challenge75';
import { loadChallenge, startChallenge, challengeStatus, dailyMessage,
  markDay, unmarkDay, markPhoto, DONE_KIND } from '../challenge75';
import { photoStore, DAILY_TYPE } from '../photoStore';
import { downscaleForStorage } from '../imageDownscale';
import { todayLocal } from '../datetime';

// De 75-dagenkaart: wat je vandaag doet, afvinken, de foto, en wat er
// verandert.
//
// Drie dingen zijn hier bewust anders dan in een gewone challenge-app:
//
//   · een rode dag met de herstelversie is een afgeronde dag, geen gemiste.
//     Zij heeft een PEM-historie; een reeks die haar leert haar lichaam te
//     overrulen is schadelijker dan een reeks die breekt;
//   · de teller telt afgeronde dagen van de 75, niet opeenvolgende dagen.
//     Een teller die bij één gemiste dag naar nul springt, is de reden dat
//     mensen op dag 35 stoppen;
//   · wat zij te horen krijgt is gebonden aan de fase waarin ze zit. Een
//     compliment dat elke dag hetzelfde is, is geen informatie.

export default function Challenge75({ currentDate = todayLocal(), onChanged }) {
  const [state, setState] = useState(loadChallenge);
  const [tick, setTick] = useState(0);
  const [openCircuit, setOpenCircuit] = useState(false);
  const [openHerstel, setOpenHerstel] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState('');
  const [tweede, setTweede] = useState('');

  const st = useMemo(() => challengeStatus({ currentDate }), [currentDate, tick, state]);
  const bericht = useMemo(() => dailyMessage({ currentDate }), [currentDate, tick, state]);

  function ververs() { setState(loadChallenge()); setTick(t => t + 1); onChanged?.(); }

  if (!st.active) {
    return (
      <div className="os-card" style={{ marginBottom: 12, borderLeft: '3px solid var(--gold)' }}
        data-challenge="niet-gestart">
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-serif)',
          marginBottom: 4 }}>{CHALLENGE.name}</div>
        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 8 }}>
          Elke dag acht minuten als basis, eventueel een tweede workout erbij.
          Elke dag een foto. Je hardloopdoelen lopen ernaast door.
        </div>
        <button type="button" data-challenge-start
          onClick={() => { startChallenge({ startDate: currentDate }); ververs(); }}
          style={knopPrimair}>
          Start vandaag — dag 1 van 75
        </button>
      </div>
    );
  }

  async function fotoVanDaag(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBezig(true); setMelding('');
    try {
      // Verkleinen vóór opslaan. Haar eerste challengefoto was 2,65 MB
      // tegenover 260 kB voor een progressiefoto; over 75 dagen is dat
      // 200 MB in IndexedDB én in de cloud, en dan loopt het quotum vol of
      // struikelt de feed. Zie imageDownscale.js.
      const klein = await downscaleForStorage(file);
      // DAILY_TYPE en niet een aanzicht: deze reeks staat los van de
      // wekelijkse progressiefoto's. Zie photoStore.
      const uit = await photoStore.save(currentDate, DAILY_TYPE, klein.base64,
        klein.mimeType, { source: 'challenge75', day: st.day,
          resized: klein.resized, originalBytes: klein.originalBytes });
      markPhoto(currentDate, { type: DAILY_TYPE, photoId: uit?.photoId || null });
      ververs();
      const maat = klein.note ? ` ${klein.note}` : '';
      setMelding((uit?.ok === false
        ? 'Foto staat op dit toestel. Online opslaan lukte nog niet — hij gaat mee zodra er verbinding is.'
        : `Foto van dag ${st.day} bewaard.`) + maat);
    } catch {
      setMelding('Die foto kon niet worden gelezen. Probeer een andere.');
    } finally { setBezig(false); }
  }

  function afvinken(kind) {
    markDay(currentDate, { kind, secondWorkout: tweede.trim() || null });
    ververs();
    setMelding('');
  }

  const pct = Math.round(st.doneCount / st.totalDays * 100);

  return (
    <div className="os-card" style={{ marginBottom: 12,
      borderLeft: `3px solid ${st.doneToday ? 'var(--sage)' : 'var(--gold)'}` }}
      data-challenge={st.doneToday ? 'gedaan' : 'open'} data-challenge-dag={st.day}>

      {/* ── De stand ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-serif)',
          color: st.doneToday ? 'var(--sage)' : 'var(--text)', lineHeight: 1 }}>
          {st.finished ? '75' : st.day}
        </div>
        <div style={{ fontSize: 12, color: 'var(--sub)', flex: 1 }}>
          van {st.totalDays} · {st.doneCount} afgerond · {st.photoCount} foto's
        </div>
        {st.streak >= 2 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)',
            border: '1px solid var(--sage)', borderRadius: 99, padding: '1px 7px' }}>
            {st.streak} op rij
          </span>
        )}
      </div>

      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99,
        overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sage)' }} />
      </div>

      {/* ── Wat je vandaag hoort te weten ────────────────────── */}
      {bericht && (
        <div style={{ marginBottom: 8 }} data-challenge-bericht>
          {bericht.lines.map((r, i) => (
            <div key={i} style={{ fontSize: i === 0 ? 13 : 11.5,
              fontWeight: i === 0 ? 700 : 400,
              color: i === 0 ? 'var(--text)' : 'var(--sub)',
              lineHeight: 1.5, marginBottom: 3 }}>{r}</div>
          ))}
        </div>
      )}

      {/* ── Afvinken ─────────────────────────────────────────── */}
      {!st.doneToday ? (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          <button type="button" data-challenge-circuit onClick={() => afvinken(DONE_KIND.CIRCUIT)}
            style={knopPrimair}>De 8 minuten gedaan</button>
          <button type="button" data-challenge-extra onClick={() => afvinken(DONE_KIND.EXTRA)}
            style={knopSecundair}>+ tweede workout</button>
          <button type="button" data-challenge-herstel onClick={() => afvinken(DONE_KIND.RECOVERY)}
            style={knopSecundair}>herstelversie</button>
          <button type="button" data-challenge-race onClick={() => afvinken(DONE_KIND.RACE)}
            style={knopSecundair}>racedag</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 700 }}>
            ✓ dag {st.day} afgerond{st.kindToday !== DONE_KIND.CIRCUIT ? ` (${st.kindToday})` : ''}
          </span>
          <button type="button" onClick={() => { unmarkDay(currentDate); ververs(); }}
            style={{ ...knopTekst, marginLeft: 'auto' }}>ongedaan maken</button>
        </div>
      )}

      {/* ── De foto van vandaag ──────────────────────────────── */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', marginBottom: 4 }}>
        {st.photoToday ? (
          <div style={{ fontSize: 11.5, color: 'var(--sage)' }} data-challenge-foto="ja">
            ✓ foto van dag {st.day} staat erbij
          </div>
        ) : (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11.5, color: 'var(--gold)', cursor: 'pointer', fontWeight: 600 }}
            data-challenge-foto="nee">
            📷 {bezig ? 'bezig…' : `Foto van dag ${st.day} toevoegen`}
            <input type="file" accept="image/*" onChange={fotoVanDaag} disabled={bezig}
              style={{ display: 'none' }} />
          </label>
        )}
        <div style={{ fontSize: 10, color: 'var(--ghost)', lineHeight: 1.45, marginTop: 3 }}>
          Zelfde plek, zelfde licht, zelfde moment van de dag. Dagelijks zie je niets —
          over 75 dagen zie je het verschil alleen als de omstandigheden gelijk zijn.
          Deze reeks staat apart van je wekelijkse progressiefoto's — je vindt hem
          onder Progressie → 75 dagen.
        </div>
      </div>

      {melding && (
        <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 6 }}
          data-challenge-melding>{melding}</div>
      )}

      {/* ── De oefeningen ────────────────────────────────────── */}
      <div onClick={() => setOpenCircuit(v => !v)}
        style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)',
          fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer', display: 'flex',
          justifyContent: 'space-between' }}>
        <span>De acht minuten — {CIRCUIT.length} oefeningen van 30 seconden</span>
        <span>{openCircuit ? '▲' : '▼'}</span>
      </div>

      {openCircuit && (
        <div style={{ marginTop: 6 }} data-challenge-circuit-lijst={CIRCUIT.length}>
          <a href={CHALLENGE.videoUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
              textDecoration: 'none' }}>
            ▶ {CHALLENGE.videoTitle}
          </a>
          <div style={{ fontSize: 10, color: 'var(--gold)', lineHeight: 1.5,
            marginTop: 4, marginBottom: 8 }} data-challenge-video-noot>
            {CHALLENGE.videoNote}
          </div>

          {CIRCUIT.map((o, i) => (
            <div key={o.id} style={{ padding: '7px 0', borderTop: '1px solid var(--border)' }}
              data-oefening={o.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--ghost)', minWidth: 16,
                  fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{o.name}</span>
                <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 700 }}>
                  {o.seconds} sec
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45,
                marginTop: 2, paddingLeft: 22 }}>{o.cue}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.45,
                paddingLeft: 22, marginTop: 2 }}>
                <em>Waarom:</em> {o.why} · <em>Voel je in:</em> {o.felt}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 8,
            paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            Totaal {Math.round(CIRCUIT_TOTAL_SECONDS / 60)} minuten werk zonder pauze.
          </div>
        </div>
      )}

      {/* ── De herstelversie ─────────────────────────────────── */}
      <div onClick={() => setOpenHerstel(v => !v)}
        style={{ marginTop: 6, fontSize: 11.5, color: 'var(--muted)', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between' }}>
        <span>De herstelversie — voor een rode dag (telt volwaardig mee)</span>
        <span>{openHerstel ? '▲' : '▼'}</span>
      </div>

      {openHerstel && (
        <div style={{ marginTop: 6 }} data-challenge-herstel-lijst={RECOVERY_VERSION.length}>
          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5, marginBottom: 6 }}>
            Hoofdpijn, een PEM-signaal, slecht geslapen of de dag na een race? Dan deze
            vijf minuten in plaats van het circuit. Je dag is daarmee afgerond — rust op
            een rode dag is geen uitzondering op het plan, het is het plan.
          </div>
          {RECOVERY_VERSION.map(o => (
            <div key={o.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{o.name}</span>
                <span style={{ fontSize: 11, color: 'var(--sub)' }}>{o.seconds} sec</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.45 }}>{o.cue}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tweede workout, als ze die doet ─────────────────── */}
      {!st.doneToday && (
        <input placeholder="Tweede workout vandaag? (optioneel)" value={tweede}
          onChange={e => setTweede(e.target.value)} data-challenge-tweede
          style={{ width: '100%', fontSize: 11.5, padding: '6px 9px', marginTop: 8,
            borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      )}

      {/* ── Hoe dit naast het hardlopen staat ───────────────── */}
      <div style={{ fontSize: 10.5, color: 'var(--ghost)', lineHeight: 1.5, marginTop: 8,
        paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        Je hardloopdoelen lopen hiernaast door: de coach blijft je looptrainingen,
        de Bereloop en de Adventure Run plannen zoals hij deed. Acht minuten
        lichaamsgewicht per dag telt niet mee als krachtsessie voor het
        trainingsplafond — een tweede workout erbij wél.
      </div>
    </div>
  );
}

const knopPrimair = {
  fontSize: 11.5, padding: '6px 12px', borderRadius: 99, cursor: 'pointer',
  border: '1px solid var(--sage)', background: 'var(--sage)', color: '#fff',
  fontWeight: 700,
};
const knopSecundair = {
  fontSize: 11, padding: '6px 11px', borderRadius: 99, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)',
};
const knopTekst = {
  fontSize: 10.5, padding: '2px 6px', border: 'none', background: 'none',
  color: 'var(--ghost)', cursor: 'pointer',
};
