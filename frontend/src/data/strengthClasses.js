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
