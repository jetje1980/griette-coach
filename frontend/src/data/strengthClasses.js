// Coach Classes: begeleide krachtlessen die je volgt zoals een groepsles.
//
// Drie trainingsvormen staan naast elkaar en zijn alle drie volwaardig:
//   weights      dumbbells, kettlebells, gym — kg × sets × reps × RIR
//   bands_mat    lichaamsgewicht, minibands, lange banden, matje
//   coach_class  begeleide full-body les, video-first, minimale beslislast
//
// Bands & mat is nadrukkelijk géén afgezwakte variant. Progressive overload
// loopt daar via bandweerstand, herhalingen, houdtijd, bewegingsbereik,
// eenbenige varianten, tempo en rust — zie strength.js voor de score.

// ── Bandweerstand ───────────────────────────────────────────────
// De index is een weerstandsverhouding, geen kilo's. Hij is bewust
// consistent in plaats van fysiologisch exact: een medium band telt als
// 1,6× een light band, en dat blijft overal in de app gelden.
export const BAND_LEVELS = [
  { id: 'light',       label: 'Light',       short: 'L',  index: 1.0, color: '#9CC5A1' },
  { id: 'medium',      label: 'Medium',      short: 'M',  index: 1.6, color: '#6B7C5A' },
  { id: 'heavy',       label: 'Heavy',       short: 'H',  index: 2.3, color: '#C9963E' },
  { id: 'extra_heavy', label: 'Extra heavy', short: 'XH', index: 3.0, color: '#B85B3E' },
];

export const bandLevel = (id) => BAND_LEVELS.find(b => b.id === id) || null;
export const bandIndex = (id) => bandLevel(id)?.index ?? 1.0;
export const bandLabel = (id) => bandLevel(id)?.label ?? '—';

export function nextBand(id) {
  const i = BAND_LEVELS.findIndex(b => b.id === id);
  return i >= 0 && i < BAND_LEVELS.length - 1 ? BAND_LEVELS[i + 1] : null;
}
export function prevBand(id) {
  const i = BAND_LEVELS.findIndex(b => b.id === id);
  return i > 0 ? BAND_LEVELS[i - 1] : null;
}

// ── Bewegingspatronen ───────────────────────────────────────────
// Zeven patronen; de coach bewaakt dat het niet alleen buik en billen wordt.
// De weging zegt hoe zwaar een ontbrekend patroon meetelt voor déze
// gebruiker: glutes, posterior chain, core en houding staan voorop wegens
// perimenopauze, botprikkel en ondersteuning van het hardlopen.
export const PATTERNS = [
  { id: 'squat',  label: 'Squat / lunge',      emoji: '🦵', weight: 1.0,
    why: 'Beenkracht en botprikkel; draagt het hardlopen.' },
  { id: 'hinge',  label: 'Hinge',              emoji: '🪝', weight: 1.0,
    why: 'Posterior chain — hamstrings en onderrug, de motor van je pas.' },
  { id: 'glutes', label: 'Glutes',             emoji: '🍑', weight: 1.0,
    why: 'Bilspieren stabiliseren je bekken en beschermen je knieën.' },
  { id: 'push',   label: 'Push',               emoji: '🙌', weight: 0.8,
    why: 'Bovenlichaam en botdichtheid in pols en schouder.' },
  { id: 'pull',   label: 'Pull / houding',     emoji: '🎣', weight: 1.0,
    why: 'Rug en houding — tegengif voor zitten en voorovergebogen lopen.' },
  { id: 'core',   label: 'Core / carry',       emoji: '🧱', weight: 1.0,
    why: 'Rompstabiliteit; houdt je vorm heel als je moe wordt.' },
  { id: 'calves', label: 'Calves / voeten',    emoji: '🦶', weight: 0.7,
    why: 'Kuiten en voetboog dragen elke stap die je zet.' },
];

export const patternLabel = (id) => PATTERNS.find(p => p.id === id)?.label || id;

// ── Blokken waaruit een les is opgebouwd ────────────────────────
export const CLASS_BLOCKS = [
  { id: 'prepare', label: 'Prepare',            patterns: [] },
  { id: 'warmup',  label: 'Warm-up',            patterns: [] },
  { id: 'legs',    label: 'Legs / glutes',      patterns: ['squat', 'glutes'] },
  { id: 'hinge',   label: 'Hinge / posterior',  patterns: ['hinge'] },
  { id: 'push',    label: 'Push',               patterns: ['push'] },
  { id: 'pull',    label: 'Pull / houding',     patterns: ['pull'] },
  { id: 'core',    label: 'Core',               patterns: ['core'] },
  { id: 'finish',  label: 'Finish / recover',   patterns: ['calves'] },
];

// ── De standaardlessen ──────────────────────────────────────────
// Elke les noemt zijn eigen doel, want de keuze tussen 15 en 35 minuten is
// een herstelbeslissing, geen motivatiebeslissing.
export const COACH_CLASSES = [
  {
    id: 'strong15',
    title: 'STRONG 15',
    tagline: 'Minimum viable',
    duration: 15,
    intent: 'minimum',
    form: 'Bands & mat',
    equipment: 'Matje + één band',
    expectedRpe: [4, 5],
    defaultBand: 'light',
    blocks: ['prepare', 'legs', 'glutes', 'core', 'finish'],
    patterns: ['squat', 'glutes', 'core'],
    description: 'Kort en compleet genoeg om de draad vast te houden op een drukke of matige dag.',
  },
  {
    id: 'strong25',
    title: 'STRONG 25',
    tagline: 'Normaal',
    duration: 25,
    intent: 'normal',
    form: 'Bands & mat',
    equipment: 'Matje + minibands',
    expectedRpe: [5, 6],
    defaultBand: 'medium',
    blocks: ['prepare', 'warmup', 'legs', 'hinge', 'pull', 'core', 'finish'],
    patterns: ['squat', 'glutes', 'hinge', 'pull', 'core'],
    description: 'De werkweek-standaard: alle grote patronen, zonder je dag op te eten.',
  },
  {
    id: 'strong30',
    title: 'STRONG 30',
    tagline: 'Full body standaard',
    duration: 30,
    intent: 'standard',
    form: 'Bands & mat',
    equipment: 'Matje + minibands + lange band',
    expectedRpe: [5, 6],
    defaultBand: 'medium',
    blocks: ['prepare', 'warmup', 'legs', 'hinge', 'push', 'pull', 'core', 'finish'],
    patterns: ['squat', 'glutes', 'hinge', 'push', 'pull', 'core', 'calves'],
    description: 'De referentieles. Volledige dekking van alle zeven patronen — dit is de sessie waaraan je vooruitgang wordt afgemeten.',
    benchmark: true,
  },
  {
    id: 'strong35',
    title: 'STRONG 35',
    tagline: 'High capacity',
    duration: 35,
    intent: 'high',
    form: 'Bands & mat',
    equipment: 'Matje + banden (of gewichten)',
    expectedRpe: [6, 7],
    defaultBand: 'heavy',
    blocks: ['prepare', 'warmup', 'legs', 'hinge', 'push', 'pull', 'core', 'finish'],
    patterns: ['squat', 'glutes', 'hinge', 'push', 'pull', 'core', 'calves'],
    description: 'Alleen op een dag die er echt om vraagt: goed geslapen, groen, en geen zware run in de benen.',
  },
  {
    id: 'recovery15',
    title: 'RECOVERY FLOW 15',
    tagline: 'Mobiliteit en herstel',
    duration: 15,
    intent: 'recovery',
    form: 'Mat',
    equipment: 'Matje',
    expectedRpe: [2, 3],
    defaultBand: null,
    blocks: ['prepare', 'core', 'finish'],
    patterns: ['core'],
    description: 'Geen trainingsprikkel maar doorbloeding en beweeglijkheid. Telt niet mee als krachtsessie voor de opbouw.',
    isRecovery: true,
  },
];

export const findClass = (id) => COACH_CLASSES.find(c => c.id === id) || null;

// De referentieles waartegen vooruitgang wordt afgemeten.
export const BENCHMARK_CLASS = COACH_CLASSES.find(c => c.benchmark) || COACH_CLASSES[2];

// Welke lessen passen binnen de beschikbare tijd?
export function classesWithin(minutes, { includeRecovery = true } = {}) {
  return COACH_CLASSES.filter(c =>
    c.duration <= minutes && (includeRecovery || !c.isRecovery));
}

// ── Bands & mat: een volwaardig programma zonder gewichten ──────
// Zeven oefeningen, zeven patronen. Elke oefening heeft een ladder van
// varianten: dat is waar progressive overload hier vandaan komt, samen met
// de band, de herhalingen en de houdtijd.
export const BANDS_MAT_PROGRAM = {
  id: 'bands_mat',
  name: 'Bands & Mat — full body',
  emoji: '🧘',
  exercises: [
    { id: 'bm_squat', pattern: 'squat', name: 'Band squat',
      cue: 'Band boven de knieën, knieën naar buiten duwen',
      defaultSets: 3, defaultReps: 15, band: true,
      variants: ['Beide benen', 'Tempo 3 sec omlaag', 'Split squat', 'Eenbenig naar stoel'] },
    { id: 'bm_hinge', pattern: 'hinge', name: 'Band goodmorning / RDL',
      cue: 'Band onder de voeten, heup naar achter, rug lang',
      defaultSets: 3, defaultReps: 12, band: true,
      variants: ['Beide benen', 'Zwaardere band', 'Eenbenig', 'Eenbenig met pauze'] },
    { id: 'bm_glutes', pattern: 'glutes', name: 'Glute bridge met band',
      cue: 'Band boven de knieën, boven 1 sec knijpen',
      defaultSets: 3, defaultReps: 15, band: true,
      variants: ['Beide benen', 'Voeten verhoogd', 'Eenbenig', 'Eenbenig met hold'] },
    { id: 'bm_push', pattern: 'push', name: 'Push-up variant',
      cue: 'Volledige range, romp als één lijn',
      defaultSets: 3, defaultReps: 8, band: false,
      variants: ['Tegen de muur', 'Handen verhoogd', 'Op de knieën', 'Vlak op de grond'] },
    { id: 'bm_pull', pattern: 'pull', name: 'Band row / pull-apart',
      cue: 'Schouderbladen naar elkaar, langzaam terug',
      defaultSets: 3, defaultReps: 15, band: true,
      variants: ['Pull-apart', 'Zittende row', 'Eenarmige row', 'Row met pauze'] },
    { id: 'bm_core', pattern: 'core', name: 'Side plank',
      cue: 'Per kant, tot de vorm inzakt — niet langer',
      defaultSets: 2, defaultReps: null, hold: true, defaultHold: 25, band: false,
      variants: ['Op de knie', 'Volledig', 'Met heup dippen', 'Met been heffen'] },
    { id: 'bm_calves', pattern: 'calves', name: 'Calf raise + voetboog',
      cue: 'Volledige range, boven 1 sec vasthouden',
      defaultSets: 3, defaultReps: 15, band: false,
      variants: ['Beide voeten', 'Langzaam omlaag', 'Eenbenig', 'Eenbenig op een verhoging'] },
  ],
};

// ── Eigen videolessen ───────────────────────────────────────────
// De app hoeft niet van één aanbieder afhankelijk te zijn: je bewaart
// alleen de externe URL en wat configuratie. Video's worden nooit
// gekopieerd, gedownload of zelf gehost.
const FAV_KEY = 'gc_strength_favourites';

export function detectProvider(url = '') {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  return 'other';
}

// YouTube-id uit de gangbare linkvormen. Levert null bij twijfel, zodat de
// UI netjes terugvalt op "openen op YouTube" in plaats van een kapotte
// embed te tonen.
export function youtubeId(url = '') {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Privacyvriendelijke embed-URL. Of de video daadwerkelijk embedt bepaalt
// de rechthebbende; lukt het niet, dan blijft de knop naar YouTube over.
export function youtubeEmbedUrl(url) {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
}

export function spotifyEmbedUrl(url = '') {
  const m = url.match(/spotify\.com\/(playlist|album|track)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export function loadFavouriteClasses() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function persistFavourites(arr) {
  localStorage.setItem(FAV_KEY, JSON.stringify(arr));
}

// classConfig = { id, title, duration, videoUrl, provider, spotifyUrl,
//                 equipment, focus[], expectedRpe[], defaultBand, notes }
export function saveFavouriteClass(cfg) {
  const arr = loadFavouriteClasses();
  const now = new Date().toISOString();
  const entry = {
    id: cfg.id || `fav_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    title: (cfg.title || '').trim() || 'Naamloze les',
    duration: Number(cfg.duration) || 30,
    videoUrl: (cfg.videoUrl || '').trim() || null,
    provider: cfg.videoUrl ? detectProvider(cfg.videoUrl) : null,
    spotifyUrl: (cfg.spotifyUrl || '').trim() || null,
    equipment: cfg.equipment || 'Matje + banden',
    focus: Array.isArray(cfg.focus) ? cfg.focus : [],
    expectedRpe: cfg.expectedRpe || [5, 6],
    defaultBand: cfg.defaultBand || 'medium',
    notes: cfg.notes || '',
    isFavourite: true,
    createdAt: cfg.createdAt || now,
    updatedAt: now,
  };
  const i = arr.findIndex(c => c.id === entry.id);
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  persistFavourites(arr);
  return entry;
}

export function deleteFavouriteClass(id) {
  persistFavourites(loadFavouriteClasses().filter(c => c.id !== id));
}

// Standaardlessen én eigen lessen in één lijst — de rest van de app hoeft
// het onderscheid niet te kennen.
export function allClasses() {
  return [...COACH_CLASSES, ...loadFavouriteClasses()];
}

export function resolveClass(id) {
  return allClasses().find(c => c.id === id) || null;
}

// Een paar startvoorbeelden. Ze worden pas opgeslagen als je ze bewaart,
// zodat de lijst leeg blijft tot je zelf iets kiest.
export const FAVOURITE_SUGGESTIONS = [
  { title: 'Full body bands 30 min', duration: 30, focus: ['squat', 'glutes', 'hinge', 'pull', 'core'], defaultBand: 'medium' },
  { title: 'Legs & glutes bands 25 min', duration: 25, focus: ['squat', 'glutes', 'hinge'], defaultBand: 'medium' },
  { title: 'Core & posture 20 min', duration: 20, focus: ['core', 'pull'], defaultBand: 'light' },
  { title: 'Recovery strength 15 min', duration: 15, focus: ['core'], defaultBand: null },
];

// ── Wat je in een les werkelijk doet ────────────────────────────
//
// De lessen hierboven noemden blokken ("Legs / glutes", "Core") en
// patronen, en verder niets. Je kon er dus naar kijken en nog steeds niet
// weten wat je moest doen. Dat is wat hier wordt ingevuld: per blok een
// concrete oefening, met een cue en een progressie-as.
//
// Bands & mat kent geen kilo's, dus loopt de opbouw langs andere assen —
// precies de assen die bovenaan dit bestand al genoemd worden: bandweerstand,
// herhalingen, houdtijd, bewegingsbereik, eenbenige varianten, tempo, rust.
// Per oefening staat hier welke as de eerste is, zodat "zwaarder" iets
// concreets betekent in plaats van "doe je best".
export const CLASS_EXERCISES = {
  prepare: [
    { id: 'c_adem', name: 'Ademhaling + ribben laag', pattern: 'core', reps: 5,
      unit: 'ademhalingen', cue: 'Lig op je rug, adem in door je neus, laat je ribben zakken bij de uitademing.',
      axis: 'tempo', progress: 'Rustiger uitademen, langer maken.' },
    { id: 'c_kat', name: 'Kat–koe', pattern: 'core', reps: 8,
      unit: 'herhalingen', cue: 'Op handen en knieën, wervel voor wervel bollen en hollen.',
      axis: 'bewegingsbereik', progress: 'Groter bereik, niet sneller.' },
  ],
  warmup: [
    { id: 'c_heupcirkel', name: 'Heupcirkels', pattern: 'glutes', reps: 8,
      unit: 'per kant', cue: 'Sta op één been, maak rustige cirkels met het andere — knie op heuphoogte.',
      axis: 'bewegingsbereik', progress: 'Grotere cirkel, been hoger.' },
    { id: 'c_glutebridge_w', name: 'Glute bridge (opwarmen)', pattern: 'glutes', reps: 12,
      unit: 'herhalingen', cue: 'Voeten plat, duw door je hielen, knijp boven één tel.',
      axis: 'herhalingen', progress: 'Meer herhalingen, dan minibandvariant.' },
  ],
  legs: [
    { id: 'c_squat', name: 'Squat met band om de knieën', pattern: 'squat', reps: 12,
      unit: 'herhalingen', cue: 'Band net boven de knieën, duw je knieën naar buiten tegen de band in.',
      axis: 'bandweerstand', progress: 'Zwaardere band → meer herhalingen → langzamer zakken.' },
    { id: 'c_split', name: 'Split squat', pattern: 'squat', reps: 8,
      unit: 'per been', cue: 'Grote stap naar voren, achterste knie richting de grond, romp rechtop.',
      axis: 'eenbenig', progress: 'Achterste voet verhoogd, daarna gewicht in de handen.' },
    { id: 'c_stepdown', name: 'Step-down', pattern: 'squat', reps: 8,
      unit: 'per been', cue: 'Sta op een verhoging, zak langzaam tot je hiel de grond raakt, kom terug.',
      axis: 'bewegingsbereik', progress: 'Hogere verhoging, langzamer zakken.' },
  ],
  hinge: [
    { id: 'c_rdl_band', name: 'Romanian deadlift met band', pattern: 'hinge', reps: 12,
      unit: 'herhalingen', cue: 'Band onder je voeten, heupen naar achteren, rug lang, rek in de hamstrings.',
      axis: 'bandweerstand', progress: 'Zwaardere band → breder staan op de band.' },
    { id: 'c_goodmorning', name: 'Good morning met band', pattern: 'hinge', reps: 12,
      unit: 'herhalingen', cue: 'Band over je schouders, scharnier vanuit je heupen, knieën zacht.',
      axis: 'bandweerstand', progress: 'Zwaardere band, dan langzamer terug omhoog.' },
    { id: 'c_singleleg_rdl', name: 'Eenbenige RDL', pattern: 'hinge', reps: 8,
      unit: 'per been', cue: 'Eén been achteruit strekken terwijl je romp naar voren scharniert, heupen recht.',
      axis: 'eenbenig', progress: 'Langer stilstaan onderin, daarna gewicht erbij.' },
  ],
  glutes: [
    { id: 'c_hipthrust_band', name: 'Hip thrust met band', pattern: 'glutes', reps: 15,
      unit: 'herhalingen', cue: 'Schouders op de bank, band om de knieën, boven één tel knijpen.',
      axis: 'bandweerstand', progress: 'Zwaardere band → eenbenig.' },
    { id: 'c_clamshell', name: 'Clamshell', pattern: 'glutes', reps: 15,
      unit: 'per kant', cue: 'Op je zij, band om de knieën, bovenste knie openen zonder je bekken te kantelen.',
      axis: 'bandweerstand', progress: 'Zwaardere band, dan boven twee tellen vasthouden.' },
    { id: 'c_kickback', name: 'Glute kickback', pattern: 'glutes', reps: 12,
      unit: 'per been', cue: 'Op handen en knieën, been naar achteren strekken zonder je onderrug te hollen.',
      axis: 'houdtijd', progress: 'Boven langer vasthouden, daarna band erbij.' },
  ],
  push: [
    { id: 'c_pushup', name: 'Push-up (knie of teen)', pattern: 'push', reps: 8,
      unit: 'herhalingen', cue: 'Handen onder je schouders, lijf één lijn, volledige range.',
      axis: 'bewegingsbereik', progress: 'Van knieën naar tenen, dan voeten verhoogd.' },
    { id: 'c_bandpress', name: 'Band shoulder press', pattern: 'push', reps: 12,
      unit: 'herhalingen', cue: 'Band onder je voeten, duw recht omhoog, ribben laag.',
      axis: 'bandweerstand', progress: 'Zwaardere band, dan langzamer laten zakken.' },
  ],
  pull: [
    { id: 'c_bandrow', name: 'Band row', pattern: 'pull', reps: 12,
      unit: 'herhalingen', cue: 'Band om je voeten, trek je ellebogen langs je lijf, schouderbladen naar elkaar.',
      axis: 'bandweerstand', progress: 'Zwaardere band → twee tellen vasthouden achterin.' },
    { id: 'c_pullapart', name: 'Band pull-apart', pattern: 'pull', reps: 15,
      unit: 'herhalingen', cue: 'Armen gestrekt voor je, band uit elkaar trekken tot borsthoogte.',
      axis: 'herhalingen', progress: 'Meer herhalingen, dan zwaardere band.' },
    { id: 'c_facepull', name: 'Face pull met band', pattern: 'pull', reps: 15,
      unit: 'herhalingen', cue: 'Band op ooghoogte, trek naar je gezicht, ellebogen hoog.',
      axis: 'bandweerstand', progress: 'Zwaardere band, dan langzamer terug.' },
  ],
  // ── Core ───────────────────────────────────────────────────
  //
  // Dit blok is bewust het grootst. Wat een middel strakker laat ogen is
  // niet het aantal crunches maar hoe goed je romp spanning vasthoudt: een
  // diepe buikspier die je ribben laag houdt en je bekken op zijn plek. Dat
  // train je met tegenhouden — niet meebuigen — en dus staan hier vooral
  // anti-beweging-oefeningen: anti-holle rug, anti-zijwaarts, anti-draaien.
  //
  // Wat het niet doet staat in CORE_TRUTH hieronder, en die tekst hoort in
  // de app te staan en niet alleen hier.
  core: [
    { id: 'c_deadbug', name: 'Dead bug', pattern: 'core', reps: 10,
      unit: 'per kant', cue: 'Onderrug tegen de grond, tegenovergestelde arm en been langzaam strekken.',
      waarom: 'Leert je romp spanning houden terwijl je armen en benen bewegen — precies wat er bij hardlopen gebeurt.',
      axis: 'tempo', progress: 'Langzamer, dan been lager.' },
    { id: 'c_plank', name: 'Plank', pattern: 'core', reps: 30,
      unit: 'seconden', cue: 'Ellebogen onder je schouders, billen aan, geen holle rug.',
      waarom: 'De basisvorm van tegenhouden: je romp mag niet doorzakken.',
      axis: 'houdtijd', progress: '30 → 45 → 60 s, daarna eenarmig tikken.' },
    { id: 'c_sideplank', name: 'Side plank', pattern: 'core', reps: 20,
      unit: 'seconden per kant', cue: 'Elleboog onder je schouder, heup hoog, lijf één lijn.',
      waarom: 'De zijkant van je romp — die houdt je bekken recht als je op één been landt.',
      axis: 'houdtijd', progress: 'Langer, daarna bovenste been heffen.' },
    { id: 'c_pallof', name: 'Pallof press met band', pattern: 'core', reps: 10,
      unit: 'per kant', cue: 'Band opzij vastgemaakt, duw hem recht vooruit zonder mee te draaien.',
      waarom: 'Anti-draaien. Dit is de oefening die het diepe korset aanspreekt dat je middel smaller laat ogen, zonder dat je je buik traint als een spier die dikker mag worden.',
      axis: 'bandweerstand', progress: 'Zwaardere band, dan verder van het ankerpunt staan.' },
    { id: 'c_hollow', name: 'Hollow hold', pattern: 'core', reps: 20,
      unit: 'seconden', cue: 'Op je rug, onderrug tegen de grond, armen en benen laag maar niet los van die druk.',
      waarom: 'Trekt je ribben naar je bekken toe — de houding die een middel platter laat ogen.',
      axis: 'houdtijd', progress: 'Langer, daarna armen verder naar achteren.' },
    { id: 'c_birddog', name: 'Bird dog', pattern: 'core', reps: 8,
      unit: 'per kant', cue: 'Op handen en knieën, tegenovergestelde arm en been strekken zonder te kantelen.',
      waarom: 'Rompstabiliteit en onderrug — het tegengif voor lang zitten.',
      axis: 'tempo', progress: 'Drie tellen vasthouden, daarna elleboog-knie tikken ertussen.' },
    { id: 'c_carry', name: 'Farmer carry', pattern: 'core', reps: 40,
      unit: 'seconden', cue: 'Zwaar in beide handen, rechtop lopen, schouders laag.',
      waarom: 'Rompspanning onder belasting, staand — het meest praktische wat er is.',
      axis: 'bandweerstand', progress: 'Zwaarder, daarna één kant tegelijk.' },
  ],
  finish: [
    { id: 'c_calf', name: 'Kuitheffen', pattern: 'calves', reps: 15,
      unit: 'herhalingen', cue: 'Volledige range, boven één tel vasthouden, langzaam zakken.',
      axis: 'eenbenig', progress: 'Van twee benen naar één been.' },
    { id: 'c_voetboog', name: 'Voetboog + tenen spreiden', pattern: 'calves', reps: 12,
      unit: 'per voet', cue: 'Til je voetboog op zonder je tenen te krullen.',
      axis: 'herhalingen', progress: 'Meer herhalingen, dan staand op één voet.' },
  ],
};

export const findClassExercise = (id) =>
  Object.values(CLASS_EXERCISES).flat().find(e => e.id === id) || null;

// De les uitgeschreven: per blok één oefening, met de aantallen die bij deze
// week van de golf horen. Dezelfde vier weken als bij de gewichten, zodat er
// niet twee opbouwen naast elkaar bestaan.
//
// Welke oefening per blok? Niet willekeurig: de keuze rouleert met het
// weeknummer, zodat je binnen een golf varieert zonder dat het elke keer
// iets anders is. Dezelfde week geeft dezelfde les — je moet hem kunnen
// herhalen.
export function classPlan(klas, { phase = null, week = 1, band = null } = {}) {
  if (!klas?.blocks?.length) return null;
  const f = phase || { id: 'basis', label: 'Basis', setDelta: 0, repDelta: 0, targetRir: 3 };
  const sets = Math.max(1, 2 + (f.setDelta || 0));
  const items = [];

  for (const blokId of klas.blocks) {
    const opties = CLASS_EXERCISES[blokId];
    if (!opties?.length) continue;
    const oef = opties[(Math.max(1, week) - 1) % opties.length];
    const isTijd = /seconden/.test(oef.unit);
    // Herhalingen groeien met de fase; houdtijden met vijf seconden per stap.
    const aantal = isTijd
      ? Math.max(10, oef.reps + (f.repDelta || 0) * 5)
      : Math.max(5, oef.reps + (f.repDelta || 0));
    const blokSets = ['prepare', 'warmup', 'finish'].includes(blokId) ? 1 : sets;
    items.push({
      block: blokId,
      blockLabel: (CLASS_BLOCKS.find(b => b.id === blokId) || {}).label || blokId,
      ...oef,
      sets: blokSets,
      amount: aantal,
      band: band || klas.defaultBand || null,
      prescription: blokSets > 1
        ? `${blokSets}× ${aantal} ${oef.unit}`
        : `${aantal} ${oef.unit}`,
    });
  }

  return {
    classId: klas.id,
    title: klas.title,
    duration: klas.duration,
    phase: f.id,
    phaseLabel: f.label,
    week,
    items,
    note: f.id === 'terugnemen'
      ? 'Terugneemweek: één set minder per blok en geen zwaardere band. Hier wordt de winst opgenomen.'
      : `${f.label}: ${sets} sets per hoofdblok, stop met ongeveer ${f.targetRir} herhalingen over.`,
  };
}

// ── Core en een strakker middel: wat waar is ────────────────────
//
// Dit is de plek waar een trainingsapp makkelijk begint te liegen, dus staat
// het hier expliciet. Zij zegt dat core belangrijk voor haar is en dat ze een
// strakkere buik wil. Allebei terecht, en ze hangen minder samen dan de
// fitnesswereld suggereert.
//
// Het eerlijke antwoord heeft drie delen, en het derde is het goede nieuws.
export const CORE_TRUTH = {
  kop: 'Wat coretraining wel en niet doet voor een strakker middel',
  punten: [
    {
      id: 'geen_plaatselijk',
      titel: 'Buikspieroefeningen verbranden geen buikvet',
      tekst: 'Plaatselijk afvallen bestaat niet: waar je vet verliest bepaalt je lichaam, niet de oefening die je kiest. Duizend crunches maken je buik sterker, niet dunner.',
    },
    {
      id: 'wel_houding',
      titel: 'Maar je romp bepaalt wél hoe je middel eruitziet',
      tekst: 'Een diepe buikspierlaag die je ribben laag en je bekken recht houdt, maakt zichtbaar verschil in hoe je staat en dus hoe je middel oogt — bij precies hetzelfde vetpercentage. Dat is geen illusie; dat is houding, en die is trainbaar.',
    },
    {
      id: 'tegenhouden',
      titel: 'Daarom tegenhouden in plaats van meebuigen',
      tekst: 'De oefeningen hier zijn vooral anti-beweging: niet doorzakken, niet opzij kantelen, niet meedraaien. Dat traint de laag die als korset werkt. Meebuigen — crunches, sit-ups — traint vooral de spier die je juist naar voren bolt als hij dikker wordt.',
    },
    {
      id: 'de_rest',
      titel: 'De rest komt van eiwit, kracht en geduld',
      tekst: 'Wat er over je romp heen ligt verandert met je lichaamssamenstelling, en die beweegt door voldoende eiwit, zware genoeg krachttraining en tijd. Niet door minder eten of meer buikspieren.',
    },
  ],
  // Wat hier nadrukkelijk níét mag gebeuren, want dat is precies waar het bij
  // haar eerder is misgegaan.
  waarschuwing: 'Een strakker middel is nooit een reden om harder te trainen, minder te eten of minder te herstellen. Gaat dat wel zo, dan werkt het tegen je — zeker in de perimenopauze, waar spierbehoud het schaarse goed is.',
};

// Core zwaarder laten wegen.
//
// Zij heeft gezegd dat dit voor haar het belangrijkste blok is. Dat is een
// legitieme voorkeur en geen reden om de rest te laten vallen: de andere
// patronen blijven staan, het coreblok krijgt er een set en een tweede
// oefening bij. Zonder die grens wordt het binnen een maand een buikschema.
export const CORE_PRIORITY_EXTRA_SETS = 1;
export const CORE_PRIORITY_EXTRA_EXERCISES = 1;

export function withCorePriority(plan, { on = true } = {}) {
  if (!plan || !on) return plan;
  const coreItems = plan.items.filter(i => i.block === 'core');
  if (!coreItems.length) return plan;

  const gebruikt = new Set(coreItems.map(i => i.id));
  const extra = (CLASS_EXERCISES.core || [])
    .filter(e => !gebruikt.has(e.id))
    .slice(0, CORE_PRIORITY_EXTRA_EXERCISES);

  const items = [];
  for (const it of plan.items) {
    if (it.block !== 'core') { items.push(it); continue; }
    const sets = it.sets + CORE_PRIORITY_EXTRA_SETS;
    items.push({ ...it, sets,
      prescription: `${sets}× ${it.amount} ${it.unit}` });
  }
  // De extra coreoefening komt direct achter het coreblok.
  const laatsteCore = items.map(i => i.block).lastIndexOf('core');
  const toegevoegd = extra.map(e => {
    const isTijd = /seconden/.test(e.unit);
    const sets = 2 + CORE_PRIORITY_EXTRA_SETS;
    return {
      block: 'core',
      blockLabel: (CLASS_BLOCKS.find(b => b.id === 'core') || {}).label || 'Core',
      ...e,
      sets,
      amount: e.reps,
      band: plan.items.find(i => i.band)?.band || null,
      prescription: `${sets}× ${e.reps} ${e.unit}`,
      extra: true,
    };
  });
  items.splice(laatsteCore + 1, 0, ...toegevoegd);

  return {
    ...plan, items, corePriority: true,
    coreNote: `Core staat voorop: ${CORE_PRIORITY_EXTRA_SETS} set extra per coreoefening en ${toegevoegd.length} oefening erbij. De andere patronen blijven staan — zonder benen en rug wordt dit een buikschema, en daar wordt een middel niet strakker van.`,
  };
}
