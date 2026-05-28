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
  const recent = Object.values(logs)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const weights = recent.filter(l => l.weight).map(l => `${l.date}: ${l.weight}kg`);
  const bps = recent.filter(l => l.bp_sys).map(l => `${l.date}: ${l.bp_sys}/${l.bp_dia}`);
  const trainDays = recent.filter(l => l.run_done || l.core_done).length;
  const energyAvg = (() => {
    const v = recent.filter(l => l.energy != null);
    return v.length ? (v.reduce((a, l) => a + l.energy, 0) / v.length).toFixed(1) : '?';
  })();
  const habitNames = ['water', 'protein', 'no_sugar', 'no_salt', 'bed_on_time', 'low_stress'];
  const habitPct = habitNames.map(h => {
    const score = recent.filter(l => l[h]).length;
    return `${h}: ${Math.round((score / Math.max(1, recent.length)) * 100)}%`;
  });

  return `
GRIETTE — 46 jaar, 163 cm, long covid herstel, ADHD, perimenopauze
Medicatie: Mounjaro 2.5mg/wk, Candesartan 12mg, ADHD-meds
Doel: van 62.7 kg → 55 kg (70 dagen, start 2026-05-27)
Zone B: 106–132 bpm (alle trainingen hierin)

DATA AFGELOPEN DAGEN:
Gewicht: ${weights.slice(0, 5).join(' | ') || 'geen'}
Bloeddruk: ${bps.slice(0, 5).join(' | ') || 'geen'}
Trainingsdagen (van ${recent.length}): ${trainDays}
Gem. energie: ${energyAvg}/3
Gewoontes: ${habitPct.join(', ')}
${measurements?.length ? `Laatste maten: taille ${measurements[0].waist}cm, heup ${measurements[0].hip}cm` : ''}
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

  async analyzePhoto(base64Image, mimeType, dayNum, currentWeight, logs) {
    const context = buildContext(logs, []);
    const prompt = `${context}

Dit is een progressiefoto van Griette op dag ${dayNum} van haar 70-dagenprogramma.
Huidig gewicht: ${currentWeight || '?'} kg (doel: 55 kg).

Geef een bemoedigende analyse (max 150 woorden):
🌟 Wat je positief ziet
💪 Opmerking over houding of core (optioneel)
🔥 Motiverende afsluiting

Wees warm, eerlijk en positief. Geen medische uitspraken. Schrijf in het Nederlands.`;

    return callClaude([{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
        { type: 'text', text: prompt },
      ],
    }], 500);
  },
};
