// AI calls lopen primair via de server-side proxy (/api/ai/messages) —
// de ANTHROPIC_API_KEY staat dan alleen in de backend .env, nooit in de browser.
// Fallback: een sessie-sleutel in sessionStorage (verdwijnt bij sluiten browser).
// Er wordt GEEN API-sleutel meer persistent client-side (localStorage) bewaard.

const MODEL = 'claude-sonnet-4-6';
const SESSION_KEY = 'gc_api_key_session';
const LEGACY_KEY = 'gc_api_key';

// Migratie: verwijder oude persistente sleutel uit localStorage.
// Eén keer naar sessionStorage zodat de huidige browsersessie blijft werken.
(() => {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      if (!sessionStorage.getItem(SESSION_KEY)) sessionStorage.setItem(SESSION_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* storage niet beschikbaar */ }
})();

function getKey() {
  try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}

export function setSessionKey(key) {
  try {
    if (key) sessionStorage.setItem(SESSION_KEY, key.trim());
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* storage niet beschikbaar */ }
}

// Optionele backend-URL (geen geheim) voor als de app statisch gehost wordt
// en de backend elders draait, bijv. https://coach-api.example.com
export function getAiEndpoint() {
  try { return (localStorage.getItem('gc_ai_endpoint') || '').replace(/\/$/, ''); } catch { return ''; }
}
export function setAiEndpoint(url) {
  try {
    if (url && url.trim()) localStorage.setItem('gc_ai_endpoint', url.trim());
    else localStorage.removeItem('gc_ai_endpoint');
  } catch { /* storage niet beschikbaar */ }
}

async function callClaudeViaServer(messages, maxTokens) {
  const endpoint = `${getAiEndpoint()}/api/ai/messages`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });
  if (r.status === 503 || r.status === 404) return null; // server niet geconfigureerd
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Server API fout ${r.status}`);
  }
  const data = await r.json();
  return data.content[0].text;
}

async function callClaudeDirect(messages, maxTokens) {
  const key = getKey();
  if (!key) throw new Error('AI-server niet bereikbaar en geen sessie-sleutel ingesteld — ga naar Instellingen');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API fout ${r.status}`);
  }
  const data = await r.json();
  return data.content[0].text;
}

async function callClaude(messages, maxTokens = 1024) {
  // Try server proxy first (no client-side key needed)
  try {
    const result = await callClaudeViaServer(messages, maxTokens);
    if (result !== null) return result;
  } catch (serverErr) {
    // Server error (not 503) — rethrow only if no client key to fall back to
    if (!getKey()) throw serverErr;
  }
  // Fall back to direct browser access with localStorage key
  return callClaudeDirect(messages, maxTokens);
}

function buildContext(logs, measurements) {
  const allLogs = Object.values(logs).sort((a, b) => b.date.localeCompare(a.date));
  const recent  = allLogs.slice(0, 30);   // 30 dagen voor dagelijkse details
  const allTime = allLogs;                 // alle gelogde data incl. retroactief

  // Mounjaro injection tracker
  const PRIK_SCHEMA = [
    { date: '2026-06-05', nr: 5 },
    { date: '2026-06-16', nr: 6 },
    { date: '2026-06-23', nr: 7 },
    { date: '2026-06-30', nr: 8 },
    { date: '2026-07-06', nr: 9 },
    { date: '2026-07-17', nr: 10 },
    { date: '2026-07-25', nr: 11 },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const huidigePrik = (() => {
    const geweest = PRIK_SCHEMA.filter(p => p.date <= today);
    if (!geweest.length) return { nr: 4, date: '2026-05-23', dagenGeleden: null };
    const laatste = geweest[geweest.length - 1];
    const dagenGeleden = Math.floor((new Date(today) - new Date(laatste.date)) / 86400000);
    const volgende = PRIK_SCHEMA.find(p => p.date > today);
    return { nr: laatste.nr, date: laatste.date, dagenGeleden, volgende: volgende?.date ?? null };
  })();
  const prikContext = `Huidige Mounjaro-prik: #${huidigePrik.nr} (gegeven ${huidigePrik.date}, ${huidigePrik.dagenGeleden ?? '?'} dagen geleden)${huidigePrik.volgende ? ` | Volgende prik: ${huidigePrik.volgende}` : ' | Laatste prik voor vakantie'}
Werkingsfase: ${huidigePrik.nr <= 5 ? 'opbouwfase — eetlustremming nog niet op volle kracht' : huidigePrik.nr <= 7 ? 'opkomende volle werking — eetlust neemt merkbaar af' : 'volle therapeutische werking — optimale fase'}`;

  // Datumbereik van alle ingevoerde gegevens
  const dataFrom  = allTime.length ? allTime[allTime.length - 1].date : today;
  const dataTo    = allTime.length ? allTime[0].date : today;
  const dataRange = allTime.length
    ? `Ingevoerde data: ${allTime.length} dag(en) van ${dataFrom} t/m ${dataTo} — ALLEEN ingevoerde dagen, geen aannames voor lege dagen`
    : 'Nog geen data ingevoerd';

  const weights = allTime.filter(l => l.weight).slice(0, 20)
    .map(l => `${l.date}: ${l.weight}kg`);
  const bps = recent.filter(l => l.bp_sys)
    .map(l => {
      let s = `${l.date}: ${l.bp_sys}/${l.bp_dia} mmHg`;
      if (l.bp_hr) s += ` ${l.bp_hr}bpm`;
      if (l.bp_time) s += ` (${l.bp_time})`;
      return s;
    });

  const runDays  = recent.filter(l => l.run_done).length;
  const swimDays = recent.filter(l => l.swim_done).length;
  const bikeDays = recent.filter(l => l.bike_done).length;
  const coreDays = recent.filter(l => l.core_done).length;
  const totalActive = recent.filter(l => l.run_done || l.core_done || l.swim_done || l.bike_done).length;

  const swimSessions = recent.filter(l => l.swim_done && l.swim_duration)
    .map(l => `${l.date}: ${l.swim_duration}min${l.swim_distance ? ` ${l.swim_distance}m` : ''}${l.swim_hr ? ` @${l.swim_hr}bpm` : ''}`);
  const bikeSessions = recent.filter(l => l.bike_done && l.bike_duration)
    .map(l => `${l.date}: ${l.bike_duration}min${l.bike_distance ? ` ${l.bike_distance}km` : ''}${l.bike_hr ? ` @${l.bike_hr}bpm` : ''}`);

  const energyAvg = (() => {
    const v = recent.filter(l => l.energy != null);
    return v.length ? (v.reduce((a, l) => a + l.energy, 0) / v.length).toFixed(1) : '?';
  })();

  const sleepAvg = (() => {
    const v = recent.filter(l => l.sleep_hours != null);
    return v.length ? (v.reduce((a, l) => a + l.sleep_hours, 0) / v.length).toFixed(1) : null;
  })();

  const stepsAvg = (() => {
    const v = recent.filter(l => l.steps != null);
    return v.length ? Math.round(v.reduce((a, l) => a + l.steps, 0) / v.length) : null;
  })();

  const hrRestAvg = (() => {
    const v = recent.filter(l => l.hr_rest != null);
    return v.length ? Math.round(v.reduce((a, l) => a + l.hr_rest, 0) / v.length) : null;
  })();

  // Symptomen: recente 30 dagen + alle tijd totaal
  const symptomIds = ['symptom_brainfog', 'symptom_exhaustion', 'symptom_breathless', 'symptom_pain', 'symptom_headache', 'symptom_hayfever', 'symptom_overdrive', 'symptom_pem'];
  const symptomLabels = { symptom_brainfog: 'hersenmist', symptom_exhaustion: 'zware moeheid', symptom_breathless: 'kortademig', symptom_pain: 'spier/gewrichtspijn', symptom_headache: 'hoofdpijn', symptom_hayfever: 'hooikoorts', symptom_overdrive: 'overdrive/hyper (ADHD)', symptom_pem: 'PEM-crash' };
  const symptomSummary = symptomIds
    .map(id => {
      const recentCount = recent.filter(l => l[id]).length;
      const allCount    = allTime.filter(l => l[id]).length;
      if (!recentCount && !allCount) return null;
      return allCount > recentCount
        ? `${symptomLabels[id]}: ${recentCount}× (30d) / ${allCount}× totaal`
        : `${symptomLabels[id]}: ${recentCount}×`;
    })
    .filter(Boolean)
    .join(', ');

  const pemDays = recent.filter(l => l.symptom_pem).map(l => l.date);

  const habitNames = ['water', 'protein', 'no_sugar', 'no_salt', 'bed_on_time', 'low_stress'];
  const habitPct = habitNames.map(h => {
    const score = recent.filter(l => l[h]).length;
    return `${h}: ${Math.round((score / Math.max(1, recent.length)) * 100)}%`;
  });

  const measurementLines = (measurements || []).slice(0, 8).map(m =>
    `${m.date}: taille ${m.waist ?? '?'}cm, heup ${m.hip ?? '?'}cm, borst ${m.chest ?? '?'}cm, arm ${m.arm ?? '?'}cm, dij ${m.thigh ?? '?'}cm`
  );

  // All-time historical patterns (uses ALL logs including retroactive entries)
  const historicalPatterns = (() => {
    if (allTime.length < 5) return '';
    const withEnergy = allTime.filter(l => l.energy != null);
    const withSleep  = allTime.filter(l => l.sleep_hours != null);
    const withWeight = allTime.filter(l => l.weight);
    const avgEnergyAll = withEnergy.length
      ? (withEnergy.reduce((s, l) => s + l.energy, 0) / withEnergy.length).toFixed(2)
      : null;
    const avgSleepAll = withSleep.length
      ? (withSleep.reduce((s, l) => s + l.sleep_hours, 0) / withSleep.length).toFixed(1)
      : null;
    // Best energy days (energy === 3) — what habits did they have?
    const bestDays = withEnergy.filter(l => l.energy === 3);
    const worstDays = withEnergy.filter(l => l.energy === 0);
    const habitIds = ['water', 'protein', 'no_sugar', 'no_salt', 'bed_on_time', 'low_stress'];
    const habitOnBest  = habitIds.map(h => ({ h, pct: bestDays.length  ? (bestDays.filter(l => l[h]).length  / bestDays.length  * 100).toFixed(0) : 0 }));
    const habitOnWorst = habitIds.map(h => ({ h, pct: worstDays.length ? (worstDays.filter(l => l[h]).length / worstDays.length * 100).toFixed(0) : 0 }));
    const bestHabits  = habitOnBest.filter(x => x.pct >= 60).map(x => `${x.h}(${x.pct}%)`).join(', ');
    const worstMissed = habitOnWorst.filter(x => x.pct < 30).map(x => `${x.h}(${x.pct}%)`).join(', ');
    // Weight trend over all time
    const sortedWeights = withWeight.sort((a, b) => a.date.localeCompare(b.date));
    const weightTrend = sortedWeights.length >= 2
      ? `${sortedWeights[0].date}: ${sortedWeights[0].weight}kg → ${sortedWeights[sortedWeights.length-1].date}: ${sortedWeights[sortedWeights.length-1].weight}kg (${((sortedWeights[sortedWeights.length-1].weight - sortedWeights[0].weight) >= 0 ? '+' : '') + (sortedWeights[sortedWeights.length-1].weight - sortedWeights[0].weight).toFixed(1)}kg totaal)`
      : '';
    return [
      `Totaal gelogde dagen: ${allTime.length}`,
      avgEnergyAll ? `Gem. energie alle tijd: ${avgEnergyAll}/3` : '',
      avgSleepAll  ? `Gem. slaap alle tijd: ${avgSleepAll}u` : '',
      weightTrend  ? `Gewichtstrend: ${weightTrend}` : '',
      bestHabits   ? `Gewoontes bij top-energie dagen: ${bestHabits}` : '',
      worstMissed  ? `Gewoontes die ontbreken bij lage-energie dagen: ${worstMissed}` : '',
    ].filter(Boolean).join('\n');
  })();

  // Recent coach reports for pattern recognition
  const recentReports = (() => {
    try {
      const history = JSON.parse(localStorage.getItem('gc_coach_reports_history') || '[]');
      return history.slice(0, 3).map(r => `[${r.date}]: ${r.text.slice(0, 300)}`).join('\n\n---\n\n');
    } catch { return ''; }
  })();

  // Cyclus context
  const cycleStart = localStorage.getItem('gc_cycle_start');
  const cycleHistoryArr = (() => {
    try { return JSON.parse(localStorage.getItem('gc_cycle_history') || '[]'); } catch { return []; }
  })();
  const allCycleStartsSorted = [...new Set([
    ...(cycleStart ? [cycleStart] : []),
    ...cycleHistoryArr,
  ])].sort((a, b) => a.localeCompare(b)); // ascending for interval math

  const avgCycleLengthAI = (() => {
    if (allCycleStartsSorted.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < allCycleStartsSorted.length; i++)
      intervals.push(Math.floor((new Date(allCycleStartsSorted[i]) - new Date(allCycleStartsSorted[i - 1])) / 86400000));
    const valid = intervals.filter(d => d >= 18 && d <= 55);
    return valid.length ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length) : null;
  })();

  const nextExpectedPeriodAI = cycleStart && avgCycleLengthAI
    ? (() => { const d = new Date(cycleStart); d.setDate(d.getDate() + avgCycleLengthAI); return d.toISOString().slice(0, 10); })()
    : null;

  const daysToNextAI = nextExpectedPeriodAI
    ? Math.floor((new Date(nextExpectedPeriodAI) - new Date(today)) / 86400000)
    : null;

  const cycleContext = (() => {
    if (!cycleStart) return 'Cyclus: niet bijgehouden';
    const daysSince = Math.floor((new Date(today) - new Date(cycleStart)) / 86400000) + 1;
    const phase = daysSince <= 5  ? 'menstruatie'
      : daysSince <= 13 ? 'folliculaire fase (meer energie verwacht)'
      : daysSince <= 16 ? 'mogelijk ovulatie'
      : daysSince <= 28 ? 'luteale fase'
      : 'verlengde/onregelmatige cyclus (perimenopauzaal)';
    const lines = [
      `Cyclus: dag ${daysSince} — ${phase}`,
      allCycleStartsSorted.length > 1 ? `Gem. cycluslengte: ${avgCycleLengthAI ?? '?'} dagen (${allCycleStartsSorted.length} cycli geregistreerd)` : '',
      nextExpectedPeriodAI ? `Verwachte volgende menstruatie: ${nextExpectedPeriodAI} (${daysToNextAI != null ? (daysToNextAI < 0 ? `${Math.abs(daysToNextAI)}d te laat` : daysToNextAI === 0 ? 'vandaag verwacht' : `over ${daysToNextAI} dagen`) : '?'})` : '',
    ];
    return lines.filter(Boolean).join('\n');
  })();

  // Cyclus-gewicht patroon analyse
  const cycleWeightPattern = (() => {
    const allStarts = allCycleStartsSorted;
    if (allStarts.length < 3) return '';
    const weightEntries = allTime.filter(e => e.weight && e.date).sort((a, b) => a.date.localeCompare(b.date));
    if (weightEntries.length < 10) return '';
    const withDay = weightEntries.map(e => {
      const starts = allStarts.filter(s => s <= e.date);
      if (!starts.length) return null;
      const start = starts[starts.length - 1];
      const day = Math.floor((new Date(e.date) - new Date(start)) / 86400000) + 1;
      return day >= 1 && day <= 35 ? { ...e, cycleDay: day, cycleStart: start } : null;
    }).filter(Boolean);
    if (!withDay.length) return '';
    const cycleMeans = {};
    withDay.forEach(e => {
      if (!cycleMeans[e.cycleStart]) cycleMeans[e.cycleStart] = [];
      cycleMeans[e.cycleStart].push(e.weight);
    });
    Object.keys(cycleMeans).forEach(k => {
      const v = cycleMeans[k];
      cycleMeans[k] = v.reduce((s, x) => s + x, 0) / v.length;
    });
    const dayDevs = {};
    withDay.forEach(e => {
      const mean = cycleMeans[e.cycleStart];
      if (!mean) return;
      if (!dayDevs[e.cycleDay]) dayDevs[e.cycleDay] = [];
      dayDevs[e.cycleDay].push(+(e.weight - mean).toFixed(2));
    });
    const dayAvg = {};
    Object.entries(dayDevs).forEach(([d, devs]) => {
      dayAvg[parseInt(d)] = +(devs.reduce((s, v) => s + v, 0) / devs.length).toFixed(2);
    });
    const phases = [
      ['Menstruatie (dag 1-5)', 1, 5],
      ['Folliculair (dag 6-13)', 6, 13],
      ['Ovulatie (dag 14-16)', 14, 16],
      ['Luteaal (dag 17-35)', 17, 35],
    ];
    const phaseLines = phases.map(([label, from, to]) => {
      const vals = Object.entries(dayAvg).filter(([d]) => parseInt(d) >= from && parseInt(d) <= to).map(([, v]) => v);
      if (!vals.length) return null;
      const avg = +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
      return `  ${label}: gemiddeld ${avg > 0 ? '+' : ''}${avg} kg t.o.v. cyclus-gemiddelde`;
    }).filter(Boolean);
    const sorted = Object.entries(dayAvg).sort(([, a], [, b]) => a - b);
    const lowest = sorted.slice(0, 3).map(([d]) => `dag ${d}`).join(', ');
    const highest = sorted.slice(-3).reverse().map(([d]) => `dag ${d}`).join(', ');
    return `CYCLUS-GEWICHT PATROON (${allStarts.length} cycli geanalyseerd):\n${phaseLines.join('\n')}\nLaagste gewicht: ${lowest} | Hoogste: ${highest}\nDit zijn hormonale vochtschommelingen, geen vet.`;
  })();

  const batteryData = recent
    .filter(l => l.battery_start != null || l.battery_end != null)
    .slice(0, 7)
    .map(l => {
      const parts = [l.date];
      if (l.battery_start != null) parts.push(`ochtend: ${l.battery_start}%`);
      if (l.battery_end != null) parts.push(`avond: ${l.battery_end}%`);
      if (l.battery_start != null && l.battery_end != null) {
        const diff = l.battery_end - l.battery_start;
        parts.push(diff >= 0 ? `+${diff}% herstel` : `${diff}% verlies`);
      }
      return parts.join(' — ');
    });

  const overdriveDays = recent.filter(l => l.symptom_overdrive).length;
  const hayfeverDays  = recent.filter(l => l.symptom_hayfever).length;

  // Migraine context — uses all-time data, handles both single and array triggers
  const migraineContext = (() => {
    const mdays = allTime.filter(l => l.migraine).sort((a, b) => a.date.localeCompare(b.date));
    if (!mdays.length) return 'Geen migraine geregistreerd.';
    const recent30 = mdays.filter(l => new Date(l.date) >= new Date(Date.now() - 30 * 86400000));
    const triggerMap = {};
    for (const d of mdays) {
      const triggers = d.migraine_triggers || (d.migraine_trigger ? [d.migraine_trigger] : ['onbekend']);
      for (const t of triggers) triggerMap[t] = (triggerMap[t] || 0) + 1;
    }
    const topTriggers = Object.entries(triggerMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const ajovi = (() => { try { return JSON.parse(localStorage.getItem('gc_ajovi_history') || '[]'); } catch { return []; } })();
    // Severity distribution
    const sevMap = { 1: 0, 2: 0, 3: 0 };
    mdays.forEach(d => { if (d.migraine_severity) sevMap[d.migraine_severity]++; });
    const sevLine = `ernst: licht ${sevMap[1]}× / matig ${sevMap[2]}× / zwaar ${sevMap[3]}×`;
    // Avg duration
    const withHours = mdays.filter(d => d.migraine_hours);
    const avgHours = withHours.length ? (withHours.reduce((s, d) => s + d.migraine_hours, 0) / withHours.length).toFixed(1) : null;
    return [
      `Migraine-dagen totaal: ${mdays.length} (laatste 30d: ${recent30.length})`,
      sevLine,
      avgHours ? `Gemiddelde duur: ${avgHours} uur` : '',
      topTriggers.length ? `Top triggers: ${topTriggers.map(([t, n]) => `${t} (${n}×)`).join(', ')}` : '',
      ajovi.length ? `Laatste Ajovi: ${ajovi[0].date} | Volgende: ${localStorage.getItem('gc_ajovi_next') || '?'}` : 'Nog geen Ajovi geregistreerd',
    ].filter(Boolean).join('\n');
  })();

  // Supplements & PRN meds consistency (last 14 days)
  const r14 = recent.slice(0, 14);
  const suppContext = ['vit_c', 'zink', 'inositol', 'probiotica', 'visolie']
    .map(id => { const n = r14.filter(l => l[`${id}_taken`]).length; return n > 0 ? `${id}: ${n}/14d` : null; })
    .filter(Boolean).join(', ') || 'geen data';
  const prnContext = ['paracetamol', 'cetrizine', 'imigran', 'naproxen']
    .map(id => {
      const entries = r14.filter(l => l[`${id}_taken`]);
      if (!entries.length) return null;
      const times = entries.filter(l => l[`${id}_time`]).map(l => l[`${id}_time`]);
      return `${id}: ${entries.length}× (14d)${times.length ? ` — tijdstippen: ${times.slice(0,4).join(', ')}` : ''}`;
    })
    .filter(Boolean).join(' | ') || 'geen PRN-meds afgelopen 2 weken';

  // Alcohol context
  const alcoholDays = r14.filter(l => l.alcohol_had);
  const alcoholContext = alcoholDays.length
    ? `Alcohol: ${alcoholDays.length} dag(en) in 14d | gem. ${(alcoholDays.reduce((s, l) => s + (l.alcohol_units || 1), 0) / alcoholDays.length).toFixed(1)} glazen/keer | datums: ${alcoholDays.map(l => l.date.slice(5)).join(', ')}`
    : 'Alcohol: geen in laatste 14 dagen';

  // ADHD pacing context
  const adhdOverwhelmed = r14.filter(l => l.adhd_overwhelmed).length;
  const adhdHighLoad    = r14.filter(l => l.adhd_task_load === 2).length;
  const adhdBreaks      = r14.filter(l => l.adhd_break).length;
  const adhdContext = [
    adhdOverwhelmed > 0 ? `⚠️ Overprikkeld gemarkeerd: ${adhdOverwhelmed}× (14d)` : '',
    adhdHighLoad > 0    ? `Hoog actie-load (5+): ${adhdHighLoad}× (14d)` : '',
    adhdBreaks > 0      ? `Bewuste pauzes genomen: ${adhdBreaks}× (14d)` : '',
  ].filter(Boolean).join(' | ') || 'ADHD pacing: nog niet bijgehouden';

  const eventsContext = (() => {
    const EVENTS = [
      { emoji: '🚴', title: 'Fietsweekend', startDate: '2026-06-12', endDate: '2026-06-13', description: '35–40 km heen + 35–40 km terug met groep', goal: 'Goed presteren en genieten met de groep' },
      { emoji: '🎉', title: 'Q-music Foute Party', startDate: '2026-06-20', endDate: '2026-06-20', description: 'Avond uit met vrienden', goal: 'Stralend sterk en met glow er staan' },
      { emoji: '🗼', title: 'Weekend Parijs', startDate: '2026-06-26', endDate: '2026-06-28', description: 'Weekend met vriendinnen', goal: 'Behoorlijke progressie hebben gezien' },
      { emoji: '🏖️', title: 'Zomervakantie', startDate: '2026-07-27', endDate: '2026-08-14', description: 'Zomervakantie — geen training, eiwitrijk eten als anker', goal: 'In best mogelijke shape vertrekken; zo min mogelijk rebound' },
      { emoji: '🏝️', title: 'Ameland gezinsvakantie', startDate: '2026-08-21', endDate: '2026-08-28', description: 'Gezinsvakantie Ameland — beperkte training mogelijk (fietsen, wandelen)', goal: 'Mounjaro-herstart verankeren, stabiliseren na zomervakantie' },
      { emoji: '💍', title: '22 jaar getrouwd — TROUWJURK', startDate: '2026-09-02', endDate: '2026-09-02', description: 'Huwelijksverjaardag — de trouwjurk passen is HET persoonlijke mijlpaal', goal: 'In de trouwjurk passen — emotioneel belangrijkste milestone van het hele traject' },
      { emoji: '🏃', title: 'Terschelling Bereloop', startDate: '2026-10-30', endDate: '2026-11-02', description: '10 km hardloopevenement op Terschelling — strand + duin, zone B tempo', goal: '10 km finishen in zone B, ~80–90 min — het eerste officiële hardloopevenement ooit' },
      { emoji: '🥂', title: 'Oud & Nieuw met vrienden', startDate: '2026-12-29', endDate: '2027-01-02', description: 'Oud & nieuw vieren met vrienden', goal: 'Stralend het nieuwe jaar ingaan — ondergrens eigen keuze: nooit onder 45 kg' },
    ];
    return EVENTS.map(e => {
      const days = Math.max(0, Math.floor((new Date(e.startDate) - new Date(today)) / 86400000));
      const status = e.endDate < today ? '(voorbij)' : e.startDate <= today ? '(NU BEZIG)' : `over ${days} dagen`;
      return `${e.emoji} ${e.title} ${status}: ${e.startDate}${e.startDate !== e.endDate ? `–${e.endDate}` : ''} — ${e.description} | Doel: "${e.goal}"`;
    }).join('\n');
  })();

  // Projecteer gewicht op mijlpalen op basis van huidige trend
  const milestoneProjection = (() => {
    const withWeight = allTime.filter(l => l.weight).sort((a, b) => a.date.localeCompare(b.date));
    if (withWeight.length < 3) return '';
    const latest = withWeight[withWeight.length - 1];
    const first  = withWeight[0];
    const daySpan = Math.max(1, Math.floor((new Date(latest.date) - new Date(first.date)) / 86400000));
    const weeklyRate = ((first.weight - latest.weight) / daySpan) * 7;
    if (weeklyRate <= 0) return '';
    const project = (targetDate) => {
      const days = Math.floor((new Date(targetDate) - new Date(latest.date)) / 86400000);
      if (days <= 0) return null;
      return +(latest.weight - (weeklyRate / 7) * days).toFixed(1);
    };
    const MIN_WEIGHT = 45;
    const milestones = [
      { label: '🏖️ Vakantie (27 jul)', date: '2026-07-27' },
      { label: '🏝️ Ameland (21 aug)', date: '2026-08-21' },
      { label: '💍 Trouwjurk (2 sep)', date: '2026-09-02' },
      { label: '🏃 Bereloop (30 okt)', date: '2026-10-30' },
      { label: '🥂 Oud & Nieuw (29 dec)', date: '2026-12-29' },
    ];
    const lines = milestones.map(m => {
      const w = project(m.date);
      if (!w) return null;
      const floor = w < MIN_WEIGHT ? ` ⚠️ ONDER MINIMUM (${MIN_WEIGHT} kg) — tempo bijstellen` : '';
      return `${m.label}: ~${w} kg (bij huidig tempo van −${weeklyRate.toFixed(2)} kg/week)${floor}`;
    }).filter(Boolean);
    return lines.length ? `GEWICHTSPROJECTIE OP MIJLPALEN (huidig tempo):\n${lines.join('\n')}` : '';
  })();

  // Bereloop loopprogressie projectie
  const bereloopRunProjection = (() => {
    const currentRun = parseInt(localStorage.getItem('gc_current_run') || '10', 10);
    // Schema: T35 = 5 km (week 12). Remaining sessions from current point:
    const remaining = Math.max(0, 35 - currentRun);
    // ~3 runs/week, but with ~3 weeks vacation interruption (no running) and regression after
    // Vacation Jul 27 - Aug 14 = 2.5 weeks off → estimated setback ~4-6 sessions
    // Days from today to Oct 30:
    const daysToEvent = Math.floor((new Date('2026-10-30') - new Date(today)) / 86400000);
    if (daysToEvent <= 0) return '';
    const weeksToEvent = daysToEvent / 7;
    // Available training weeks (minus ~4 weeks vacation/recovery): ~weeksToEvent - 4
    const effectiveWeeks = Math.max(0, weeksToEvent - 4);
    // Sessions available at 2.5 avg runs/week (conservative for long covid):
    const sessionsAvailable = Math.floor(effectiveWeeks * 2.5);
    // After T35 (5km), expect 8-10 more weeks to build to 10km at zone B
    const finishes5k = remaining <= sessionsAvailable;
    // After 5km, building to 10km: ~8 weeks of zone B runs adding 10% volume/week
    const weeksAfter5k = finishes5k ? Math.floor((sessionsAvailable - remaining) / 2.5) : 0;
    const estDistanceKm = finishes5k
      ? Math.min(10, +(5 * Math.pow(1.08, Math.min(weeksAfter5k, 10))).toFixed(1))
      : null;
    // Time estimate at zone B (8:30 min/km for 10km on trail/sand = harder surface +10%)
    const paceMinKm = 9.0; // trail/strand pace zone B
    const estTimeMin = estDistanceKm ? Math.round(estDistanceKm * paceMinKm) : null;
    const estTimeStr = estTimeMin ? `${Math.floor(estTimeMin / 60)}u${(estTimeMin % 60).toString().padStart(2, '0')}` : null;

    return [
      `TERSCHELLING BERELOOP (30 okt–2 nov 2026) — LOOPPROJECTIE:`,
      `Huidig schema: T${currentRun}/35 | Schema klaar (5 km): ${finishes5k ? 'JA — vóór de zomervakantie' : `nog ${remaining} sessies nodig`}`,
      finishes5k && estDistanceKm
        ? `Haalbare afstand op 30 okt: ~${estDistanceKm} km (zone B opbouw na 5km-mijlpaal)`
        : `Aanbeveling: focus na vakantie direct op 5km afmaken, daarna opbouw naar 10km`,
      estTimeStr ? `Streeftijd 10 km op strand/duin (zone B, ~9 min/km): ~${estTimeStr} (hardere ondergrond, zone B altijd leidend)` : '',
      `Bereloop strategie: 10 km als doel, 5 km als veilig alternatief | Eerste officiële loopwedstrijd → finishen = winnen`,
      `Gewicht bij Bereloop: lichter lichaam = sneller + minder belasting op gewrichten — direct voordeel van Mounjaro-traject`,
    ].filter(Boolean).join('\n');
  })();

  return `
${dataRange}

GRIETTE — 46 jaar, 163 cm
Gezondheidsprofiel: long covid herstel, ADHD, waarschijnlijk laat-perimenopauze / vroeg menopauze
Medicatie: Mounjaro 2.5mg/wk (GLP-1, eetlustremmer + insulinegevoeligheid), Candesartan 12mg/dag (hypertensie), ADHD-meds
Doel: huidige weging → 55 kg (herstart 70-dagen traject 2026-05-27)
Gewichtsondergrens (eigen keuze, absoluut): NOOIT onder 45 kg — als prognose richting 45 kg gaat, altijd signaleren en tempo bijstellen
Zone B hartslag: 106–132 bpm (alle aerobe training hierin houden)

HORMONALE VOORGESCHIEDENIS (cruciaal voor context):
- Eerste menstruatie op 12-jarige leeftijd (vroege menarche → geassocieerd met eerder begin perimenopauze)
- Vanaf ~38e jaar progressief zwaarder + overgangsklachten → nu ~8 jaar in perimenopauze-transitie
- Waarschijnlijk in late perimenopauze; menopauze (12 mnd geen menstruatie) verwacht tussen ~48–51e jaar
- Gewichtstoename van 38–46 is hormonaal gedreven: dalend progesteron → slechter slapen → cortisol → insulineresistentie → abdominaal vet — NIET veroorzaakt door meer eten
- Insulineresistentie en vetopslag rond buik/heupen typisch voor deze fase; Mounjaro adresseert dit direct via GIP/GLP-1
- Startgewicht sept 2025: ~68–69 kg (voor Mounjaro)

${prikContext}

MOUNJARO PRIKSCHEMA T/M VAKANTIE:
- vr 5 juni (#5), ma 16 juni (#6), ma 23 juni (#7), ma 30 juni (#8)
- ma 6 juli (#9), vr 17 juli (#10)
- vr 25 juli (#11) → LAATSTE VOOR VAKANTIE (vertrekdag — optimale timing)
- Herstart bij terugkomst ~15 aug zo snel mogelijk

MOUNJARO GESCHIEDENIS:
- Gebruik sinds sept 2025 — al ~9 maanden ervaring met GLP-1
- Jan 2026: 3 weken gestopt (Zuid-Amerika) → gewicht bleef stabiel ~60 kg (medicijn werkte nog na)
- Feb 2026: 2 weken gestopt → lichte toename
- Apr–mei 2026: ~2,5 week gestopt (vakantie) + 2,5 week geen sport (ooglidcorrectie) → gewicht naar ~64 kg
- 2026-05-27: herstart; nu opbouwend naar therapeutisch niveau (volle eetlustremming na ~4-5 weken)
- Laagste gewicht op Mounjaro: ~60 kg (jan 2026, langste ononderbroken periode)
- Geen dosisverhoging mogelijk (bewuste keuze); 2.5mg werkt aantoonbaar bij consistente inname

RECENTE BELEMMERING (herstel operatie):
- Ooglid-correctie (blepharoplastiek) uitgevoerd eind mei 2026
- 2,5 week geen sport mogelijk door herstel
- Post-operatieve inflammatie + cortisol + immobiliteit verklaren tijdelijke gewichtstoename
- Nu herstart met zowel Mounjaro als training — lichaam heeft 2–3 weken nodig om te normaliseren
- Dit is GEEN echte gewichtstoename maar tijdelijk herstelgewicht; beoordeel voortgang pas na normalisatie

PERSOONLIJKE MIJLPALEN (komende weken — coach hierop inspelen):
${eventsContext}
${milestoneProjection ? `\n${milestoneProjection}` : ''}
${bereloopRunProjection ? `\n${bereloopRunProjection}` : ''}

VAKANTIE- EN MIJLPALENPLANNING:

🏖️ Zomervakantie: 27 jul – 14 aug 2026
- Laatste Mounjaro-prik: 25 juli (#11) — optimale timing (2 dagen voor vertrek, medicijn werkt ~5-7 dagen na)
- Effectieve sprint vóór vakantie: nu t/m 26 juli
- Tijdens vakantie: geen gestructureerde training, eiwitrijk eten als anker tegen ghreline-rebound
- Terugkomst: 14 augustus — direct Mounjaro hervatten

🏝️ Ameland gezinsvakantie: 21–28 aug 2026
- Slechts 1 week na terugkeer van zomervakantie → Mounjaro-herstart loopt al, maar nog niet op vol effect
- Positief: Ameland biedt wandelen en fietsen — lichte zone B training mogelijk
- Doel: stabiliseren wat voor vakantie bereikt was, geen nieuwe terugval

💍 Huwelijksverjaardag — 22 jaar getrouwd: 2 september 2026
- EMOTIONEEL BELANGRIJKSTE MIJLPAAL: in de trouwjurk passen
- 5 weken na terugkeer van zomervakantie + 1 week na Ameland
- Mounjaro loopt dan weer ~3 weken → stijgende eetlustremming
- Dit is het moment waar alles naartoe werkt na de vakantieonderbreking
- Verwacht enige tijdelijke terugval tijdens vakantieperiode — dit is ingecalculeerd

LANGE-TERMIJN STRATEGIE (door Griette zelf bepaald):
- Mounjaro 2.5mg continueren door peri- en menopauze (~5 jaar, tot ~51e jaar)
- Geen dosisverhoging — bewuste keuze, 2.5mg werkt aantoonbaar (was 60 kg op jan 2026)
- Doel: 55 kg bereiken en minimaal 6 maanden vasthouden VOORDAT gestopt wordt
- Stoppoging pas realistisch postmenopauze als gewicht gestabiliseerd en eetgewoontes automatisch zijn
- Pijlers voor "ooit stoppen": spiermassa opbouwen (zone B + core), eiwitgewoontes automatiseren, vetverbrandingscapaciteit trainen
- Vakantie-pauzes zijn onvermijdelijk maar minimaliseerbaar door timing van laatste/eerste prik
- Eerstvolgende grote persoonlijke mijlpaal: 2 sept 2026 (22 jaar getrouwd) — trouwjurk passen
- Hardloopdoel: Terschelling Bereloop 30 okt–2 nov 2026 — 10 km finishen (eerste officiële loopwedstrijd)

GEWICHTVERLOOP:
${weights.slice(0, 10).join(' | ') || 'geen data'}

BLOEDDRUK (recent):
${bps.slice(0, 5).join(' | ') || 'geen data'}

TRAINING AFGELOPEN ${recent.length} DAGEN:
Hardlopen: ${runDays}x | Zwemmen: ${swimDays}x | Fietsen: ${bikeDays}x | Core: ${coreDays}x | Actieve dagen: ${totalActive}/${recent.length}
${swimSessions.length ? `Zwemsessies: ${swimSessions.join(' | ')}` : ''}
${bikeSessions.length ? `Fietssessies: ${bikeSessions.join(' | ')}` : ''}

HERSTELDATA:
Gem. energie: ${energyAvg}/3
Gem. slaapuren: ${sleepAvg ?? '?'} uur/nacht
Gem. stappen: ${stepsAvg ? stepsAvg.toLocaleString('nl') : '?'} per dag
Gem. rust-HS: ${hrRestAvg ?? '?'} bpm
${batteryData.length ? `Body battery (recent):\n${batteryData.join('\n')}` : 'Body battery: nog niet geregistreerd'}
${pemDays.length > 0 ? `⚠️ PEM-crashes geregistreerd op: ${pemDays.join(', ')}` : 'Geen PEM-crashes geregistreerd'}
${overdriveDays > 0 ? `⚠️ Overdrive/ADHD-hyper: ${overdriveDays}x in laatste ${recent.length} dagen` : ''}
${hayfeverDays > 0 ? `Hooikoorts actief: ${hayfeverDays}x (verhoogt inflammatoire belasting)` : ''}

LONG COVID SYMPTOMEN (afgelopen ${recent.length} dagen):
${symptomSummary || 'geen klachten geregistreerd'}

GEWOONTES SCORE: ${habitPct.join(', ')}

${cycleContext}
${cycleWeightPattern ? `\n${cycleWeightPattern}` : ''}

VOEDINGSVOORKUREN (door gebruiker ingesteld in app):
${(() => {
  const LABELS = {
    bonen: 'bonen/kikkererwten/edamame', banaan: 'banaan', ei_veel: 'meer dan 2 eieren/dag',
    rood_vlees: 'rood vlees/biefstuk', vis: 'vis', lactose: 'lactose/zuivel',
    gluten: 'gluten/tarwe', noten: 'noten/pindaboter',
    smoothies: 'smoothies', shakes: 'eiwitshakes', soep: 'soep',
    salades: 'salades', kip: 'kip', vis_zee: 'vis/zeevruchten', pasta: 'pasta', rijst_wok: 'rijst/wok',
  };
  try {
    const p = JSON.parse(localStorage.getItem('gc_food_prefs') || '{}');
    const excl = (p.excluded  || ['bonen', 'banaan', 'ei_veel']).map(k => LABELS[k] || k);
    const pref = (p.preferred || ['smoothies', 'shakes', 'soep', 'salades']).map(k => LABELS[k] || k);
    return `VERMIJDEN: ${excl.join(', ')}
GRAAG MEER: ${pref.join(', ')}${p.notes ? '\nExtra: ' + p.notes : ''}`;
  } catch { return 'VERMIJDEN: bonen, banaan, veel eieren\nGRAAG MEER: smoothies, soep, salades'; }
})()}

MIGRAINE & AJOVI:
${migraineContext}

SUPPLEMENTEN (afgelopen 14 dagen): ${suppContext}
ZO-NODIG MEDICATIE (afgelopen 14 dagen): ${prnContext}
${alcoholContext}
ADHD PACING: ${adhdContext}

${historicalPatterns ? `HISTORISCHE PATRONEN (alle gelogde data inclusief retroactief ingevoerd):\n${historicalPatterns}\n` : ''}
${recentReports ? `RECENTE COACH-RAPPORTEN (patroonherkenning — gebruik voor trends):\n${recentReports}\n` : ''}
${measurementLines.length ? `MATEN VERLOOP (cm):\n${measurementLines.join('\n')}` : ''}
`.trim();
}

export const ai = {
  // Returns true if client key is set OR server proxy is reachable (optimistic)
  hasKey: () => !!getKey() || true,

  async coachCheck(logs, measurements) {
    const context = buildContext(logs, measurements);
    const prompt = `${context}

Je bent de persoonlijke coach van Griette. Jouw taak is PATROONHERKENNING — niet generieke gezondheidsadviezen.

Analyseer de data als een detective: welke combinaties van slaap, training, voeding, energie en gewicht laten een patroon zien dat SPECIFIEK geldt voor haar lichaam? Wat werkt voor háár unieke combinatie van long covid + ADHD + perimenopauze + Mounjaro?

AANPAK:
- Als iets goed gaat (gewichtsdaling, energie hoog, goede training): benoem PRECIES wat er die dag(en) anders was. Rem niet af — verklaar wat werkt zodat ze het kan herhalen.
- Zoek correlaties: sliep ze goed → meer energie de dag erna? Training gedaan → gewicht de volgende dag lager? Eiwitdoel gehaald → energie beter?
- Kijk naar de events: fietsweekend 12-13 jun, Q-music Foute Party 20 jun, Parijs 26-28 jun. Is ze op koers?
- Gebruik de recente coach-rapporten om trends te spotten die je nu bevestigt of ontkracht.

Structuur (gebruik exact deze kopjes):
✅ Wat werkt voor jouw lichaam
🔍 Patroon dat ik zie in de data
🎯 Komende 3 dagen: concreet actieplan
🚀 Als dit doorgaat: wat je kunt verwachten

Toon: direct, nieuwsgierig, data-gedreven. Behandel haar als iemand die haar eigen lichaam serieus neemt en de data wil begrijpen. Geen generieke veiligheidswaarschuwingen. Schrijf in het Nederlands. Max 320 woorden.`;

    return callClaude([{ role: 'user', content: prompt }], 900);
  },

  // photos = array van { base64, mimeType, type ('voor'|'zij'|'achter') }
  // previousAnalyses = array van { date, text }
  // prevPhotos = array van { base64, mimeType, type, sessionDate } — vorige sessie voor visuele vergelijking
  async analyzePhoto(photos, dayNum, currentWeight, logs, measurements, previousAnalyses = [], prevPhotos = []) {
    const context = buildContext(logs, measurements);

    const typeNL = { voor: 'voorkant', zij: 'zijkant', achter: 'achterkant' };
    const availableViews = photos.map(p => typeNL[p.type] || p.type).join(', ');
    const prevDate = prevPhotos[0]?.sessionDate ?? null;
    const prevViews = prevPhotos.map(p => typeNL[p.type] || p.type).join(', ');

    const prevContext = previousAnalyses.length > 0
      ? `\nEERDERE FOTO-ANALYSES (tekst, meest recent eerst):\n${
          previousAnalyses.slice(0, 3).map(a => `[${a.date}]:\n${a.text.slice(0, 400)}`).join('\n\n---\n\n')
        }\n`
      : '';

    const hasPrevPhotos = prevPhotos.length > 0;

    const prompt = `${context}
${prevContext}
HUIDIGE FOTO-SESSIE: dag ${dayNum} van 70 | aanzichten: ${availableViews}
Huidig gewicht: ${currentWeight ?? '?'} kg | doel: 55 kg | start: 62.7 kg
${hasPrevPhotos ? `VERGELIJKINGSFOTO'S: sessie ${prevDate} | aanzichten: ${prevViews} (staan VÓÓR de huidige foto's hierboven)` : ''}

${hasPrevPhotos
  ? `De EERSTE ${prevPhotos.length} afbeelding(en) zijn van sessie ${prevDate} (referentie).
De LAATSTE ${photos.length} afbeelding(en) zijn van vandaag (dag ${dayNum}).
Vergelijk ze VISUEEL en concreet.`
  : 'Dit is de eerste foto-sessie — geen eerdere foto\'s beschikbaar voor vergelijking.'}

Analyseer als gecombineerde expert: personal trainer + lichaamscompositie specialist + voedingscoach.
Schrijf max 380 woorden in het Nederlands. Wees eerlijk en concreet.

Gebruik exact deze structuur:

📸 LICHAAMSCOMPOSITIE (vandaag)
Beschrijf vetopslag per zone (abdomen/flanken/heupen/dijen/armen) en spierdefinitie.

🔄 VISUELE PROGRESSIE ${hasPrevPhotos ? `(${prevDate} → dag ${dayNum})` : ''}
${hasPrevPhotos
  ? 'Vergelijk de referentiefoto\'s met vandaag: wat is er zichtbaar veranderd? Wees specifiek over welke zones.'
  : 'Eerste meting — beschrijf het startpunt als baseline voor toekomstige vergelijkingen.'}

🏋️ TRAININGSAANPASSING
Concrete aanbeveling op basis van wat je nu ziet. Welke zones vragen aandacht? Lopen/zwemmen/fietsen/core — welke mix past nu het best? Zone B altijd leidend.

🥗 VOEDINGSFOCUS
Op basis van vetdistributie en Mounjaro: eiwitdoelen, timing, specifieke kansen.

💡 KERNBOODSCHAP
1–2 zinnen: wat heeft haar lichaam nu het meest nodig?`;

    const content = [];
    // Eerst de vorige sessie foto's (als referentie), dan de huidige
    for (const photo of [...prevPhotos, ...photos]) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: photo.mimeType, data: photo.base64 },
      });
    }
    content.push({ type: 'text', text: prompt });

    return callClaude([{ role: 'user', content }], 1100);
  },

  // Genereert een concreet weekplan op basis van alle beschikbare data
  // coachReport = meest recente coach-analyse tekst
  // photoInsight = meest recente foto-analyse tekst (optioneel)
  async weeklyTrainingPlan(logs, measurements, coachReport = '', photoInsight = '') {
    const context = buildContext(logs, measurements);

    const allLogs = Object.values(logs).sort((a, b) => b.date.localeCompare(a.date));
    const recent7 = allLogs.slice(0, 7);
    const avgEnergy = (() => {
      const v = recent7.filter(l => l.energy != null);
      return v.length ? (v.reduce((s, l) => s + l.energy, 0) / v.length).toFixed(1) : null;
    })();

    const lastRunNr = (() => {
      // Lees currentRun uit config — hardcoded 10 als fallback
      return parseInt(localStorage.getItem('gc_current_run') || '10', 10);
    })();

    const prompt = `${context}

MEEST RECENTE COACH-ANALYSE:
${coachReport ? coachReport.slice(0, 500) : 'nog geen coach-check'}

${photoInsight ? `MEEST RECENTE FOTO-ANALYSE:\n${photoInsight.slice(0, 400)}` : ''}

HUIDIGE LOOPTRAINING: schema nr ${lastRunNr} van 35
GEMIDDELDE ENERGIE AFGELOPEN WEEK: ${avgEnergy ?? '?'}/3

Maak een CONCREET WEEKPLAN als personal trainer. Baseer het op de FEITELIJKE data — niet op wat gemiddeld veilig is, maar op wat haar data laat zien dat voor háár werkt.

Als haar energiedata goed is, ga dan vooruit. Als er PEM-signalen zijn, bouw dan in. Lees de data, niet de gemiddelden.
Houd rekening met de aankomende events (fietsweekend 12-13 jun = grote fysieke uitdaging).

Antwoord in exact dit formaat (geen extra tekst er omheen):

WEEKPLAN:
Ma: [activiteit — bijv. Hardlopen T${lastRunNr} zone B / Zwemmen 25min / Rust / Core 15min]
Di: [activiteit]
Wo: [activiteit]
Do: [activiteit]
Vr: [activiteit]
Za: [activiteit]
Zo: [activiteit]

LOOPSCHEMA: [blijf op T${lastRunNr} / ga naar T${Math.min(35, lastRunNr + 1)} / ga terug naar T${Math.max(1, lastRunNr - 1)} — met korte reden op basis van haar energiedata]
FOCUS DEZE WEEK: [1 zin: wat is de trainingsthema — specifiek voor háár data deze week]
DATA-INZICHT: [1 zin: welk patroon uit haar logdata stuurt dit plan]

Schrijf in het Nederlands.`;

    return callClaude([{ role: 'user', content: prompt }], 600);
  },

  // Analyseert een Garmin/Strava screenshot van een sportsessie
  // screenshot = { base64, mimeType }
  // sessionType = 'swim' | 'bike' | 'run'
  // recentSessions = array van recente sessies van dit type
  async analyzeSession(screenshot, sessionType, recentSessions, logs) {
    const typeNL = { swim: 'zwemsessie', bike: 'fietssessie', run: 'hardloopsessie' };
    const context = buildContext(logs, []);

    const sessionsContext = recentSessions.length > 0
      ? `RECENTE ${typeNL[sessionType].toUpperCase()}S:\n${
          recentSessions.slice(0, 5).map(s => {
            const parts = [s.date];
            if (s[`${sessionType}_duration`]) parts.push(`${s[`${sessionType}_duration`]} min`);
            if (s[`${sessionType}_distance`]) parts.push(sessionType === 'swim' ? `${s[`${sessionType}_distance`]} m` : `${s[`${sessionType}_distance`]} km`);
            if (s[`${sessionType}_hr`]) parts.push(`gem. ${s[`${sessionType}_hr`]} bpm`);
            return parts.join(' · ');
          }).join('\n')
        }`
      : 'Eerste sessie van dit type geregistreerd.';

    const prompt = `${context}

${sessionsContext}

Je analyseert een Garmin / Strava screenshot van een ${typeNL[sessionType]}.
Schrijf max 200 woorden in het Nederlands. Wees concreet en persoonlijk.

Gebruik exact deze structuur:

🎯 PRESTATIE
Beoordeel hartslag zones, duur, afstand/snelheid — zit dit in zone B? Past dit bij haar herstelstatus?

📈 PROGRESSIE
Vergelijk met recente sessies (zie boven). Gaat het vooruit, stabiel of terugval?

💡 VOLGENDE SESSIE
Één concrete aanbeveling: meer/minder intensiteit, anders qua duur, focus op zone B of juist interval?

⚡ HERSTEL
Hoe zwaar was dit voor haar lichaam (long covid, energiestatus)? Hoeveel rust vóór volgende sessie?`;

    return callClaude([
      { role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: screenshot.mimeType, data: screenshot.base64 } },
        { type: 'text', text: prompt },
      ]},
    ], 500);
  },
};
