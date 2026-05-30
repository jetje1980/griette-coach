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

  const weights = allLogs.filter(l => l.weight).slice(0, 14)
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

  // Symptomen: tel hoe vaak elk symptoom voorkwam
  const symptomIds = ['symptom_brainfog', 'symptom_exhaustion', 'symptom_breathless', 'symptom_pain', 'symptom_headache', 'symptom_hayfever', 'symptom_overdrive', 'symptom_pem'];
  const symptomLabels = { symptom_brainfog: 'hersenmist', symptom_exhaustion: 'zware moeheid', symptom_breathless: 'kortademig', symptom_pain: 'spier/gewrichtspijn', symptom_headache: 'hoofdpijn', symptom_hayfever: 'hooikoorts', symptom_overdrive: 'overdrive/hyper (ADHD)', symptom_pem: 'PEM-crash' };
  const symptomSummary = symptomIds
    .map(id => ({ label: symptomLabels[id], count: recent.filter(l => l[id]).length }))
    .filter(s => s.count > 0)
    .map(s => `${s.label}: ${s.count}x`)
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

  return `
GRIETTE — 46 jaar, 163 cm
Gezondheidsprofiel: long covid herstel, ADHD, waarschijnlijk laat-perimenopauze / vroeg menopauze
Medicatie: Mounjaro 2.5mg/wk (GLP-1, eetlustremmer + insulinegevoeligheid), Candesartan 12mg/dag (hypertensie), ADHD-meds
Doel: huidige weging → 55 kg (herstart 70-dagen traject 2026-05-27)
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

GEPLANDE VAKANTIE:
- Vertrek: 25 juli 2026 (dag 59 van 70-dagen programma), ~3 weken
- Terugkomst: ~15 augustus 2026
- Strategie: laatste Mounjaro-prik zo laat mogelijk voor vertrek (24 of 25 juli), direct hervatten bij terugkomst
- Tijdens vakantie: geen training mogelijk, eiwitrijk eten als anker tegen ghreline-rebound
- Effectieve sprint zonder onderbreking: nu t/m 24 juli = 55 dagen
- Verwacht enige terugval tijdens vakantie — dit is ingecalculeerd, geen reden voor ontmoediging

LANGE-TERMIJN STRATEGIE (door Griette zelf bepaald):
- Mounjaro 2.5mg continueren door peri- en menopauze (~5 jaar, tot ~51e jaar)
- Geen dosisverhoging — bewuste keuze, 2.5mg werkt aantoonbaar (was 60 kg op jan 2026)
- Doel: 55 kg bereiken en minimaal 6 maanden vasthouden VOORDAT gestopt wordt
- Stoppoging pas realistisch postmenopauze als gewicht gestabiliseerd en eetgewoontes automatisch zijn
- Pijlers voor "ooit stoppen": spiermassa opbouwen (zone B + core), eiwitgewoontes automatiseren, vetverbrandingscapaciteit trainen
- Vakantie-pauzes zijn onvermijdelijk maar minimaliseerbaar door timing van laatste/eerste prik

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

Maak een CONCREET WEEKPLAN voor de komende 7 dagen als personal trainer.
Pas het aan op haar actuele staat: long covid, energie, wat de foto en coach-analyse laten zien.

Antwoord in exact dit formaat (geen extra tekst er omheen):

WEEKPLAN:
Ma: [activiteit — bijv. Hardlopen T${lastRunNr} zone B / Zwemmen 25min / Rust / Core 15min]
Di: [activiteit]
Wo: [activiteit]
Do: [activiteit]
Vr: [activiteit]
Za: [activiteit]
Zo: [activiteit]

LOOPSCHEMA: [blijf op T${lastRunNr} / ga naar T${Math.min(35, lastRunNr + 1)} / ga terug naar T${Math.max(1, lastRunNr - 1)} — met korte reden]
FOCUS DEZE WEEK: [1 zin: wat is de trainingsthema]
LET OP: [1 concrete waarschuwing of aandachtspunt voor haar lichaam]

Schrijf in het Nederlands. Wees specifiek en realistisch — niet ambitieuzer dan haar herstelstatus toelaat.`;

    return callClaude([{ role: 'user', content: prompt }], 600);
  },
};
