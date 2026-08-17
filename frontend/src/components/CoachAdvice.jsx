import React from 'react';

function ago(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function avg(arr) {
  const v = arr.filter(x => x != null && x !== undefined);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

// Core decision engine — deterministic, evidence-based
function analyzeStatus(log, logs) {
  const yesterday = logs[ago(1)];
  const dayBefore  = logs[ago(2)];
  const threeDaysAgo = logs[ago(3)];

  const signals = [];
  let riskLevel = 0; // 0=green, 1=yellow, 2=red

  // === PEM SIGNALS (Long COVID — highest priority) ===
  const pemToday     = log?.training_recovery === 'pem-achtig';
  const pemYesterday = yesterday?.training_recovery === 'pem-achtig';
  const pemTwoDays   = dayBefore?.training_recovery === 'pem-achtig';

  if (pemToday) {
    riskLevel = 2;
    signals.push({ type: 'critical', text: 'Jij hebt vandaag PEM-achtig herstel gerapporteerd. Dit is het vroege signaal van post-exertionele malaise bij long covid.' });
  } else if (pemYesterday) {
    riskLevel = Math.max(riskLevel, 2);
    signals.push({ type: 'critical', text: 'Gisteren PEM-achtig herstel. Het zenuwstelsel heeft minimaal 48u nodig om te herstellen — geen training vandaag.' });
  } else if (pemTwoDays) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: 'Twee dagen geleden PEM-signalen. Vandaag mag je wandelen — geen hardlopen of circuit.' });
  }

  // === SLAAP ===
  const sleepValues = [log, yesterday, dayBefore].map(l => l?.sleep_hours).filter(Boolean);
  const avgSleep = avg(sleepValues);
  const sleepTonight = log?.sleep_hours;

  if (sleepTonight != null && sleepTonight < 5.5) {
    riskLevel = Math.max(riskLevel, 2);
    signals.push({ type: 'critical', text: `Slaap ${sleepTonight}u — te weinig. Cortisol is nu 30–40% hoger dan normaal. Een workout bovenop cortisolstress vertraagt vetverbranding en verhoogt PEM-risico.` });
  } else if (avgSleep != null && avgSleep < 6.5 && sleepValues.length >= 2) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: `Gemiddeld ${avgSleep.toFixed(1)}u slaap afgelopen nachten. Slaaptekort verhoogt hongerhormoon ghreline met 20%. Prioriteit: vanavond vóór 22:30 in bed.` });
  } else if (sleepTonight != null && sleepTonight >= 7.5) {
    signals.push({ type: 'positive', text: `Goed geslapen (${sleepTonight}u). Groeihormoon heeft 's nachts zijn werk gedaan — spieropbouw en vetverbranding zijn nu optimaal.` });
  }

  // === TRAINING LOAD (afgelopen 3 dagen) ===
  const trainDays = [log, yesterday, dayBefore, threeDaysAgo]
    .filter(l => l?.run_done || l?.core_done || (l?.training_zone && l?.training_zone !== 'rust'))
    .length;

  if (trainDays >= 3 && riskLevel < 2) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: `${trainDays} trainingsdagen in de afgelopen 4 dagen. Voor long covid is dit aan de bovenkant. Vandaag: rust of wandelen — niet meer.` });
  }

  // === ZONE C OVERTRAINING ===
  const zoneC_yesterday = yesterday?.training_zone === 'C';
  const zoneC_dayBefore = dayBefore?.training_zone === 'C';
  if (zoneC_yesterday && riskLevel < 2) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: 'Gisteren zone C — boven jouw aerobe drempel. Long covid zenuwstelsel heeft 36–48u herstel nodig na zone C. Vandaag: zone B max of rust.' });
  }
  if (zoneC_dayBefore && zoneC_yesterday) {
    riskLevel = Math.max(riskLevel, 2);
    signals.push({ type: 'critical', text: 'Twee dagen op rij zone C. Dit is het patroon dat PEM triggert bij long covid. Vandaag verplichte rust — geen uitzonderingen.' });
  }

  // === HORMONALE SIGNALEN (perimenopauze + cortisol) ===
  const hormonalToday = (log?.body_hotflash || log?.body_nightsweat) && log?.body_bloat > 1;
  if (hormonalToday && riskLevel < 2) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: 'Opvliegers + opgeblazen gevoel = verhoogde cortisolactiviteit. Hoge cortisol + intensieve training = buikvetretentie. Vandaag: alleen wandelen of lichte kracht.' });
  }

  // === ENERGIE / BATTERIJ ===
  const battery = log?.battery;
  if (battery === 1 && riskLevel < 2) {
    riskLevel = Math.max(riskLevel, 1);
    signals.push({ type: 'warning', text: 'Batterij op rood. Je ADHD-brein wil misschien toch trainen om dopamine te halen, maar dat is een val. Vandaag: rust is de prestatie.' });
  } else if (battery >= 3 && riskLevel === 0) {
    signals.push({ type: 'positive', text: 'Goede energiestand. Dit is het moment om de training te pakken — het lichaam staat klaar.' });
  }

  // === GREEN LIGHT CONFIRMATION ===
  if (riskLevel === 0 && signals.filter(s => s.type === 'positive').length === 0) {
    signals.push({ type: 'positive', text: 'Geen rode vlaggen. Jouw lichaam is klaar voor de geplande sessie. Warm goed op, hou zone B vast.' });
  }

  // === DECIDE WHAT TO DO TODAY ===
  let advice, title, color, bg;

  if (riskLevel === 2) {
    title = 'Verplichte rust vandaag';
    advice = riskLevel === 2 && pemToday
      ? 'Stop alle training. Horizontaal rust als je kan. Hydrateer goed. PEM vraagt 48–72u volledig herstel — elke dag dat je dit negeert, verlengt de herstelperiode met dagen.'
      : riskLevel === 2 && sleepTonight < 5.5
      ? 'Geen training. Vanavond vroeg in bed, telefoon buiten de kamer. Morgen evalueren. Een overgeslagen sessie is beter dan een week uitgevallen.'
      : 'Geen training — wandelen max 20 min. Eten: eiwit prioriteit, geen suiker. Lichaam neemt de tijd die het nodig heeft.';
    color = '#C4622D';
    bg = '#FBE9E0';
  } else if (riskLevel === 1) {
    title = 'Rustig aan vandaag';
    advice = 'Geen hardlopen boven zone B, geen circuit tot uitputting. Optie: 20 min wandelen + 10 min foam roll. Of kies voor de lichtste training van deze week.';
    color = '#B5831A';
    bg = '#FBF0DC';
  } else {
    title = 'Groene dag — pak het';
    advice = 'Doe de geplande sessie volledig. Zone B strikt. Na de training: eiwit binnen 45 min. Dit is de training die 4 weken later resulteert in een lagere hartslag bij hetzelfde tempo.';
    color = '#2A7A4F';
    bg = '#E0F0E8';
  }

  return { riskLevel, title, advice, color, bg, signals };
}

export default function CoachAdvice({ log, logs }) {
  // Only show when there's some data logged
  const hasData = log?.sleep_hours != null || log?.battery != null || log?.training_recovery != null || log?.body_bloat != null;
  const hasAnyRecentData = hasData ||
    logs[ago(1)]?.training_recovery != null ||
    logs[ago(1)]?.sleep_hours != null ||
    logs[ago(1)]?.run_done ||
    logs[ago(2)]?.training_recovery != null;

  if (!hasAnyRecentData) {
    return (
      <div style={{
        margin: '0 0 10px',
        padding: '12px 14px',
        borderLeft: '4px solid #2A7A4F',
        background: '#E0F0E820',
        borderRadius: 4,
        fontSize: 12, color: 'var(--muted)', lineHeight: 1.5,
      }}>
        <strong style={{ color: '#2A7A4F', display: 'block', marginBottom: 4 }}>Coach advies</strong>
        Vul dagelijks slaap, energie en training in — dan geef ik je concrete rustadvies op basis van jouw data.
      </div>
    );
  }

  const { riskLevel, title, advice, color, bg, signals } = analyzeStatus(log, logs);

  const trafficIcon = riskLevel === 2 ? '🔴' : riskLevel === 1 ? '🟡' : '🟢';

  return (
    <div style={{
      marginBottom: 10,
      borderLeft: `4px solid ${color}`,
      background: bg + '44',
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px 8px',
        background: color + '18',
        borderBottom: `1px solid ${color}33`,
      }}>
        <span style={{ fontSize: 18 }}>{trafficIcon}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color }}>Coach: {title}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.3 }}>
            Op basis van jouw data van vandaag en gisteren
          </div>
        </div>
      </div>

      {/* Advice */}
      <div style={{ padding: '8px 14px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, fontWeight: 500 }}>
        {advice}
      </div>

      {/* Signals */}
      {signals.length > 0 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {signals.map((s, i) => (
            <div key={i} style={{
              fontSize: 11.5, lineHeight: 1.4,
              color: s.type === 'critical' ? '#C4622D' : s.type === 'warning' ? '#B5831A' : '#2A7A4F',
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                {s.type === 'critical' ? '⚠️' : s.type === 'warning' ? '◆' : '✓'}
              </span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
