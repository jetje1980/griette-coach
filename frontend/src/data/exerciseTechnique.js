// Techniek per oefening: precies drie aanwijzingen, en een plek voor een
// demovideo die jij zelf kiest.
//
// Drie, niet vijf. Wie midden in een set staat kan er drie onthouden; bij
// vijf leest niemand meer mee. De volgorde is altijd dezelfde:
//
//   1. OPZET      hoe je begint — waar staan je voeten, waar is het gewicht
//   2. UITVOERING wat er tijdens de herhaling gebeurt
//   3. VALKUIL    het ene ding dat er meestal misgaat
//
// Over video: de app host of kopieert niets. Er wordt alleen een URL
// bewaard die jij zelf invult, en die wordt privacyvriendelijk ingesloten
// (youtube-nocookie). Staat er geen URL, dan geeft de app een zoeklink —
// dan kies jij zelf een demo die je bevalt.

const VIDEO_KEY = 'gc_exercise_videos';

export const TECHNIQUE = {
  // ── Programma A ───────────────────────────────────────────────
  a_squat: {
    search: 'goblet squat techniek',
    cues: [
      'Dumbbell tegen je borst, ellebogen naar binnen, voeten iets breder dan je heupen.',
      'Zak tussen je voeten in, knieën naar buiten in het spoor van je tenen.',
      'Laat je hielen niet loskomen — kom liever minder diep dan dat je naar voren kantelt.',
    ],
  },
  a_hinge: {
    search: 'romanian deadlift dumbbell techniek',
    cues: [
      'Gewichten voor je dijen, knieën licht gebogen en dáár houden.',
      'Duw je heupen naar achteren tot je de rek in je hamstrings voelt, rug lang.',
      'Dit is geen squat: als je knieën verder buigen, zakt de rek weg en pakken je quads het over.',
    ],
  },
  a_glutes: {
    search: 'hip thrust techniek',
    cues: [
      'Schouderbladen op de bank, voeten plat, schenen verticaal bovenin.',
      'Duw door je hielen en knijp je bilspieren één seconde vast op het hoogste punt.',
      'Kom niet hoger dan een rechte lijn heup–knie–schouder; verder is holle rug, geen bilspier.',
    ],
  },
  a_push: {
    search: 'push-up techniek knieen',
    cues: [
      'Handen iets breder dan schouders, lichaam één rechte lijn van hoofd tot knie of teen.',
      'Zak tot je borst vlak boven de grond is, ellebogen ongeveer 45° van je lijf.',
      'Laat je heupen niet doorzakken — knijp billen en buik aan, dan blijft de lijn staan.',
    ],
  },
  a_pull: {
    search: 'dumbbell row single arm techniek',
    cues: [
      'Eén hand en knie op de bank, rug vlak, schouders evenwijdig aan de grond.',
      'Trek je elleboog langs je lijf naar achteren, schouderblad mee naar je ruggengraat.',
      'Draai je romp niet mee omhoog — dat maakt het zwaarder lijken zonder dat je rug meer doet.',
    ],
  },
  a_core: {
    search: 'dead bug oefening techniek',
    cues: [
      'Op je rug, armen recht omhoog, knieën boven je heupen in een hoek van 90°.',
      'Strek tegengesteld arm en been langzaam uit, adem rustig uit.',
      'Je onderrug blijft de hele tijd tegen de mat; komt hij los, strek dan minder ver.',
    ],
  },
  a_calves: {
    search: 'staande kuitheffing techniek',
    cues: [
      'Sta op de rand van een tree of verhoging, hielen vrij, licht steunen voor balans.',
      'Duw zo hoog mogelijk op je tenen en houd één seconde vast.',
      'Laat je hielen daarna volledig zakken — de rek onderin is de helft van het werk.',
    ],
  },

  // ── Programma B ───────────────────────────────────────────────
  b_lunge: {
    search: 'split squat techniek',
    cues: [
      'Grote stap naar voren, gewicht verdeeld, romp rechtop.',
      'Zak recht naar beneden tot je achterste knie vlak boven de grond is.',
      'Ga niet naar voren leunen; je voorste knie blijft boven je middenvoet.',
    ],
  },
  b_hinge: {
    search: 'kettlebell deadlift techniek',
    cues: [
      'Kettlebell tussen je voeten, heupen hoog, borst open.',
      'Duw de grond weg en breng je heupen naar voren, knijp bovenin je billen aan.',
      'Til niet met je rug: als je schouders eerder omhoog komen dan je heupen, is het gewicht te zwaar.',
    ],
  },
  b_glutes: {
    search: 'single leg glute bridge techniek',
    cues: [
      'Eén voet plat, andere knie opgetrokken, armen naast je.',
      'Duw je heup omhoog tot een rechte lijn en houd je bekken waterpas.',
      'Zakt je bekken naar de vrije kant, dan is dat je grens — kort houden telt zwaarder dan hoog komen.',
    ],
  },
  b_push: {
    search: 'dumbbell shoulder press techniek',
    cues: [
      'Gewichten op schouderhoogte, polsen recht boven je ellebogen.',
      'Duw omhoog tot je armen gestrekt zijn, ribben omlaag en buik aangespannen.',
      'Buig niet achterover om het gewicht omhoog te krijgen; dan doet je onderrug het werk.',
    ],
  },
  b_pull: {
    search: 'band pull apart techniek',
    cues: [
      'Band op borsthoogte, armen gestrekt, handen op schouderbreedte.',
      'Trek de band uit elkaar door je schouderbladen naar elkaar te brengen.',
      'Laat rustig terugkomen — de helft van het effect zit in het loslaten, niet in het trekken.',
    ],
  },
  b_carry: {
    search: 'farmer carry techniek',
    cues: [
      'Zwaar gewicht in elke hand, schouders naar achteren, blik vooruit.',
      'Loop rustig en rechtop, korte passen, buik licht aangespannen.',
      'Ga niet scheef hangen; als één kant zakt, is het gewicht te zwaar voor deze afstand.',
    ],
  },
  b_feet: {
    search: 'voetboog training hardlopen',
    cues: [
      'Blote voeten, sta rechtop met je gewicht verdeeld over de hele voet.',
      'Til alleen je tenen op, houd twee tellen, en zet ze gecontroleerd terug.',
      'Klauw niet met je tenen — het gaat om de boog optrekken, niet om knijpen.',
    ],
  },

  // ── Strength snack ────────────────────────────────────────────
  s_squat: { search: 'bodyweight squat techniek', cues: [
    'Voeten op heupbreedte, armen voor je uit voor balans.',
    'Zak rustig tot je dijen ongeveer evenwijdig zijn aan de grond.',
    'Hielen op de grond, knieën in het spoor van je tenen.',
  ] },
  s_push: { search: 'push-up techniek knieen', cues: [
    'Handen iets breder dan schouders, lijf recht.',
    'Zak tot je borst vlak boven de grond is.',
    'Heupen niet laten doorzakken; op je knieën is een volwaardige variant.',
  ] },
  s_glutes: { search: 'glute bridge techniek', cues: [
    'Op je rug, voeten plat, hielen dicht bij je billen.',
    'Duw je heupen omhoog en knijp bovenin één seconde aan.',
    'Kom niet hoger dan een rechte lijn — dat is holle rug, geen bilspier.',
  ] },
  s_core: { search: 'plank techniek', cues: [
    'Ellebogen onder je schouders, voeten op heupbreedte.',
    'Eén rechte lijn van hoofd tot hielen, buik en billen aangespannen.',
    'Stop zodra je heupen zakken; dertig goede seconden slaan een slappe minuut.',
  ] },

  // ── Bands & mat ───────────────────────────────────────────────
  bm_squat: { search: 'band squat techniek', cues: [
    'Band onder beide voeten, uiteinden op schouderhoogte.',
    'Zak tussen je voeten in; de band wordt zwaarder naarmate je omhoog komt.',
    'Laat de band je niet naar voren trekken — borst blijft open.',
  ] },
  bm_hinge: { search: 'band good morning techniek', cues: [
    'Band onder je voeten en over je nek of schouders.',
    'Heupen naar achteren, rug lang, tot je de rek in je hamstrings voelt.',
    'Knieën blijven licht gebogen en veranderen niet tijdens de beweging.',
  ] },
  bm_glutes: { search: 'banded glute bridge techniek', cues: [
    'Band net boven je knieën, voeten plat.',
    'Duw je knieën licht naar buiten tegen de band terwijl je je heupen optilt.',
    'Knijp bovenin aan; laat je knieën niet naar binnen vallen.',
  ] },
  bm_push: { search: 'push-up variant techniek', cues: [
    'Kies de variant waarbij je alle herhalingen netjes haalt: muur, verhoging, knie of teen.',
    'Zak gecontroleerd, ellebogen ongeveer 45° van je lijf.',
    'Liever een makkelijkere variant met volledige range dan een zware met halve.',
  ] },
  bm_pull: { search: 'band row techniek', cues: [
    'Band om je voeten of een vast punt, armen gestrekt.',
    'Trek je ellebogen langs je lijf naar achteren, schouderbladen naar elkaar.',
    'Trek niet met je nek mee — schouders blijven laag en ontspannen.',
  ] },
  bm_core: { search: 'side plank techniek', cues: [
    'Elleboog onder je schouder, voeten op elkaar of knieën gebogen.',
    'Til je heup op tot één rechte lijn en adem rustig door.',
    'Rol niet naar voren of achteren; de knievariant telt volwaardig mee.',
  ] },
  bm_calves: { search: 'kuitheffing voetboog hardlopen', cues: [
    'Sta op de rand van een verhoging, hielen vrij.',
    'Duw hoog op je tenen, één seconde vast, dan volledig laten zakken.',
    'Zonder de rek onderin train je maar de helft van de beweging.',
  ] },
};

export function techniqueFor(exerciseId) {
  return TECHNIQUE[exerciseId] || null;
}

// ── Video's: alleen een URL, nooit het bestand ──────────────────
export function loadExerciseVideos() {
  try { return JSON.parse(localStorage.getItem(VIDEO_KEY) || '{}'); } catch { return {}; }
}

export function saveExerciseVideo(exerciseId, url) {
  const all = loadExerciseVideos();
  const clean = (url || '').trim();
  if (!clean) delete all[exerciseId]; else all[exerciseId] = clean;
  localStorage.setItem(VIDEO_KEY, JSON.stringify(all));
  return all;
}

// Een zoeklink, zodat je zelf een demo kiest die je bevalt. De app kiest
// hem niet voor je en slaat geen video op.
export function searchUrl(exerciseId, name = '') {
  const q = TECHNIQUE[exerciseId]?.search || name;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
