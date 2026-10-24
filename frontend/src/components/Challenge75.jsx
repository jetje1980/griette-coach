import React, { useState, useMemo } from 'react';
import { CHALLENGE, CIRCUIT, CIRCUIT_TOTAL_SECONDS, RECOVERY_VERSION }
  from '../data/challenge75';
import { loadChallenge, startChallenge, challengeStatus, dailyMessage,
  markDay, unmarkDay, setStartDate, DONE_KIND } from '../challenge75';
import DagFotos from './DagFotos';
import { todayLocal, formatNLLong, daysBetween } from '../datetime';
import Challenge75Grid from './Challenge75Grid';

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
  const [melding, setMelding] = useState('');
  const [tweede, setTweede] = useState('');
  const [datumOpen, setDatumOpen] = useState(false);
  const [nieuweStart, setNieuweStart] = useState('');

  const st = useMemo(() => challengeStatus({ currentDate }), [currentDate, tick, state]);
  const bericht = useMemo(() => dailyMessage({ currentDate }), [currentDate, tick, state]);
  // Kijkt zij naar een eerdere dag? Dan hoort alles te werken wat op
  // vandaag werkt — afvinken en een foto toevoegen — maar met de datum
  // erbij in plaats van "vandaag". Achteraf invullen is geen uitzondering;
  // het is hoe een dagboek werkt.
  const isVandaag = currentDate === todayLocal();

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

  if (st.beforeStart) {
    return (
      <div className="os-card" style={{ marginBottom: 12 }} data-challenge="voor-start">
        <div style={{ fontSize: 11.5, color: 'var(--sub)', lineHeight: 1.5 }}>
          De 75-dagenuitdaging begon op {st.startDate}. Deze dag valt ervoor, dus
          er is hier niets te doen en niets gemist.
        </div>
      </div>
    );
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
          van {st.totalDays} · {st.doneCount} afgerond · {st.photoCount}
          {st.photoCount === 1 ? ' foto' : " foto's"}
          {!isVandaag && (
            <div style={{ fontSize: 10.5, color: 'var(--gold)' }}>
              je kijkt naar {currentDate} — achteraf invullen kan hier
            </div>
          )}
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

      {/* ── De startdatum, en hem kunnen goedzetten ──────────────
          De uitdaging werd gestart om twee uur 's nachts: technisch
          zaterdag, voor haar nog vrijdag. Daardoor liep de teller vanaf dag
          één een dag achter op wat zij meemaakte. Wie dat niet kan
          corrigeren, kijkt 75 dagen lang naar een getal dat niet klopt. */}
      {!datumOpen ? (
        <button type="button" data-challenge-startdatum-knop
          onClick={() => { setNieuweStart(st.startDate); setDatumOpen(true); }}
          style={{ ...knopTekst, padding: 0, marginBottom: 6, display: 'block' }}>
          begonnen op {formatNLLong(st.startDate)} · klopt dat niet?
        </button>
      ) : (
        <div style={{ marginBottom: 8, padding: '7px 9px', borderRadius: 8,
          border: '1px solid var(--border)' }} data-challenge-startdatum>
          <div style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5,
            marginBottom: 6 }}>
            Op welke dag deed je je eerste acht minuten? Alles wat je al hebt
            afgevinkt blijft op zijn eigen datum staan; alleen de nummering
            schuift mee.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" className="os-input" value={nieuweStart}
              max={todayLocal()} data-challenge-startdatum-invoer
              onChange={e => setNieuweStart(e.target.value)}
              style={{ width: 'auto', fontSize: 12 }} />
            <button type="button" data-challenge-startdatum-opslaan
              onClick={() => {
                if (!nieuweStart) return;
                setStartDate(nieuweStart);
                setDatumOpen(false); ververs();
                setMelding(`Dag 1 staat nu op ${formatNLLong(nieuweStart)}.`);
              }} style={knopPrimair}>Opslaan</button>
            <button type="button" onClick={() => setDatumOpen(false)}
              style={knopTekst}>annuleren</button>
          </div>
          {nieuweStart && (
            <div style={{ fontSize: 10.5, color: 'var(--ghost)', marginTop: 6 }}
              data-challenge-startdatum-voorbeeld>
              Vandaag wordt dan dag {Math.max(1, daysBetween(nieuweStart, todayLocal()) + 1)}.
            </div>
          )}
        </div>
      )}

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
            style={knopPrimair}>
            {isVandaag ? 'De 8 minuten gedaan' : `8 minuten op ${currentDate.slice(8)}-${currentDate.slice(5, 7)} gedaan`}
          </button>
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
        {/* Twee plekken per dag, allebei altijd zichtbaar. Hier stond één
            knop die verdween zodra er een foto stond — en dan is "waar voeg
            ik de foto toe?" een terechte vraag met een onzichtbaar antwoord. */}
        <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 4 }}
          data-challenge-foto={st.photoToday ? 'ja' : 'nee'}>
          Dag {st.day}: {st.photosToday} van 2 foto's{!isVandaag ? ' (achteraf)' : ''}
        </div>
        <DagFotos date={currentDate} dayNr={st.day} onChanged={ververs}
          uitleg={'Zelfde plek, zelfde licht, zelfde moment van de dag. Dagelijks zie je '
            + 'niets — over 75 dagen zie je het verschil alleen als de omstandigheden '
            + 'gelijk zijn. Wat je op de twee plekken zet, bepaal je zelf: bijvoorbeeld '
            + 'van voren en van opzij. Deze reeks staat apart van je wekelijkse '
            + "progressiefoto's — je vindt hem onder Progressie → 75 dagen."} />
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

      {/* ── Alle 75 dagen, en afvinken per dag ──────────────── */}
      <Challenge75Grid currentDate={currentDate} onChanged={ververs} />

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
