// Direct browser calls to Anthropic API
// Requires anthropic-dangerous-direct-browser-access header

const MODEL = 'claude-sonnet-4-6';

function getKey() {
  return localStorage.getItem('gc_api_key') || '';
}

async function callClaude(messages, maxTokens = 1024) {
  const key = getKey();
  if (!key) throw new Error('Geen API-sleutel ingesteld — ga naar Instellingen');

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

function buildContext(logs, measurements) {
  const allLogs = Object.values(logs).sort((a, b) => b.date.localeCompare(a.date));
  const recent = allLogs.slice(0, 14);

  const weights = allLogs.filter(l => l.weight).slice(0, 14)
    .map(l => `${l.date}: ${l.weight}kg`);
  const bps = recent.filter(l => l.bp_sys)
    .map(l => `${l.date}: ${l.bp_sys}/${l.bp_dia}`);

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

  const habitNames = ['water', 'protein', 'no_sugar', 'no_salt', 'bed_on_time', 'low_stress'];
  const habitPct = habitNames.map(h => {
    const score = recent.filter(l => l[h]).length;
    return `${h}: ${Math.round((score / Math.max(1, recent.length)) * 100)}%`;
  });

  const measurementLines = (measurements || []).slice(0, 8).map(m =>
    `${m.date}: taille ${m.waist ?? '?'}cm, heup ${m.hip ?? '?'}cm, borst ${m.chest ?? '?'}cm, arm ${m.arm ?? '?'}cm, dij ${m.thigh ?? '?'}cm`
  );

  return `
GRIETTE — 46 jaar, 163 cm
Gezondheidsprofiel: long covid herstel, ADHD, perimenopauze
Medicatie: Mounjaro 2.5mg/wk (GLP-1, eetlustremmer + insulinegevoeligheid), Candesartan 12mg/dag (hypertensie), ADHD-meds
Doel: 62.7 kg → 55 kg in 70 dagen (start 2026-05-27)
Zone B hartslag: 106–132 bpm (alle aerobe training hierin houden)

GEWICHTVERLOOP:
${weights.slice(0, 10).join(' | ') || 'geen data'}

BLOEDDRUK (recent):
${bps.slice(0, 5).join(' | ') || 'geen data'}

TRAINING AFGELOPEN ${recent.length} DAGEN:
Hardlopen: ${runDays}x | Zwemmen: ${swimDays}x | Fietsen: ${bikeDays}x | Core: ${coreDays}x | Actieve dagen: ${totalActive}/${recent.length}
${swimSessions.length ? `Zwemsessies: ${swimSessions.join(' | ')}` : ''}
${bikeSessions.length ? `Fietssessies: ${bikeSessions.join(' | ')}` : ''}

GEMIDDELDE ENERGIE: ${energyAvg}/3
GEWOONTES SCORE: ${habitPct.join(', ')}

MATEN VERLOOP (cm):
${measurementLines.join('\n') || 'nog geen maten geregistreerd'}
`.trim();
}

export const ai = {
  hasKey: () => !!getKey(),

  async coachCheck(logs, measurements) {
    const context = buildContext(logs, measurements);
    const prompt = `${context}

Je bent de persoonlijke coach van Griette. Geef een coach-analyse van max 300 woorden.

Structuur (gebruik deze kopjes):
✅ Wat gaat goed
⚠️ Wat vraagt aandacht
🎯 Advies komende 3 dagen
🏃 Training-aanpassing (indien nodig)

Toon: warm, motiverend, direct en concreet. Geen medische diagnoses. Schrijf in het Nederlands.`;

    return callClaude([{ role: 'user', content: prompt }], 800);
  },

  // photos = array van { base64, mimeType, type ('voor'|'zij'|'achter') }
  // previousAnalyses = array van { date, text } — eerdere analyses voor continuïteit
  async analyzePhoto(photos, dayNum, currentWeight, logs, measurements, previousAnalyses = []) {
    const context = buildContext(logs, measurements);

    const typeNL = { voor: 'voorkant', zij: 'zijkant', achter: 'achterkant' };
    const availableViews = photos.map(p => typeNL[p.type] || p.type).join(', ');

    const prevContext = previousAnalyses.length > 0
      ? `\nEERDERE FOTO-ANALYSES (meest recent eerst):\n${
          previousAnalyses.slice(0, 3).map(a => `[${a.date}]:\n${a.text.slice(0, 400)}`).join('\n\n---\n\n')
        }\n`
      : '';

    const prompt = `${context}
${prevContext}
FOTO-SESSIE: dag ${dayNum} van 70 | aanzichten: ${availableViews}
Huidig gewicht: ${currentWeight ?? '?'} kg | doel: 55 kg | start: 62.7 kg

Analyseer als gecombineerde expert: personal trainer + lichaamscompositie specialist + voedingscoach.
Schrijf max 350 woorden in het Nederlands. Wees eerlijk en concreet — geen holle complimenten.

Gebruik exact deze structuur:

📸 LICHAAMSCOMPOSITIE
Beschrijf waar je vetopslag ziet (abdomen/flanken/heupen/dijen/armen) en hoeveel spierdefinitie zichtbaar is. Vergelijk expliciet met eerdere analyses indien beschikbaar.

🔄 PROGRESSIE & LICHAAMSSIGNALEN
Wat vertelt het lichaamspatroon over haar stofwisseling, hormonale vetopslag (perimenopauze), en long covid herstelstatus? Is de vetverdeling verschoven?

🏋️ TRAININGSAANPASSING
Concrete focus op basis van wat je ziet. Bijv: als buikvet dominant → meer anti-inflammatoir + core stabiliteit. Als dijen/heupen → meer compound bewegingen. Zwemmen/fietsen/hardlopen — welke mix past nu het best? Zone B altijd leidend.

🥗 VOEDINGSFOCUS
Op basis van vetdistributie en Mounjaro: waar liggen de kansen? Eiwitdoelen, timing, specifieke keuzes die passen bij haar patroon.

💡 INZICHT
1–2 zinnen: wat heeft haar lichaam nu het meest nodig op basis van alle data + foto's gecombineerd?`;

    const content = [];
    for (const photo of photos) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: photo.mimeType, data: photo.base64 },
      });
    }
    content.push({ type: 'text', text: prompt });

    return callClaude([{ role: 'user', content }], 1000);
  },
};
