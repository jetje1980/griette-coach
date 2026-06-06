export const USER = {
  name: 'Griette',
  age: 46,
  height: 163,
  startWeight: 62.7,
  goalWeight: 55,
  startDate: '2026-05-27',
  durationDays: 70,
  hrZone: { low: 106, high: 132 },
  context: ['long-covid', 'ADHD', 'perimenopauze'],
  currentRun: 10,
};

export const HABITS = [
  { id: 'water',       label: 'Water 2L',         emoji: '💧' },
  { id: 'protein',     label: 'Voldoende eiwit',   emoji: '🥩' },
  { id: 'no_sugar',    label: 'Geen suiker',        emoji: '🚫' },
  { id: 'no_salt',     label: 'Weinig zout',        emoji: '🧂' },
  { id: 'bed_on_time', label: 'Bed vóór 23u',       emoji: '🛏️' },
  { id: 'low_stress',  label: 'Stress laag',        emoji: '🧘' },
];

export const MEDS = [
  { id: 'mounjaro',    label: 'Mounjaro',    detail: '2.5mg/week',  weekly: true  },
  { id: 'candesartan', label: 'Candesartan', detail: '12mg/dag',    weekly: false },
  { id: 'adhd_meds',   label: 'ADHD-meds',  detail: 'dagelijks',   weekly: false },
];

export const BP = {
  red_sys: 160, red_dia: 100,
  orange_sys: 145, orange_dia: 90,
};

export const PRN_MEDS = [
  { id: 'paracetamol', label: 'Paracetamol', detail: '500–1000mg, pijn/koorts' },
  { id: 'cetrizine',   label: 'Cetirizine',  detail: 'antihistamine hooikoorts' },
  { id: 'imigran',     label: 'Imigran',     detail: 'triptan — migraine' },
  { id: 'naproxen',    label: 'Naproxen',    detail: '500mg NSAID' },
];

export const SUPPLEMENTS = [
  { id: 'vit_c',      label: 'Vitamine C',  detail: 'dagelijks' },
  { id: 'zink',       label: 'Zink',        detail: 'dagelijks' },
  { id: 'inositol',   label: 'Inositol',    detail: 'dagelijks' },
  { id: 'probiotica', label: 'Probiotica',  detail: 'dagelijks' },
  { id: 'visolie',    label: 'Visolie',     detail: 'dagelijks' },
];

export const PERSONAL_EVENTS = [
  {
    id: 'fietsweekend',
    emoji: '🚴',
    title: 'Fietsweekend',
    startDate: '2026-06-12',
    endDate: '2026-06-13',
    description: '35–40 km heen + 35–40 km terug met groep',
    goal: 'Goed presteren en genieten met de groep',
    color: '#16A34A',
  },
  {
    id: 'foute_party',
    emoji: '🎉',
    title: 'Q-music Foute Party',
    startDate: '2026-06-20',
    endDate: '2026-06-20',
    description: 'Avond uit met vrienden',
    goal: 'Stralend sterk en met glow er staan',
    color: '#D97706',
  },
  {
    id: 'parijs',
    emoji: '🗼',
    title: 'Weekend Parijs',
    startDate: '2026-06-26',
    endDate: '2026-06-28',
    description: 'Weekend met vriendinnen',
    goal: 'Behoorlijke progressie hebben gezien',
    color: '#DC2626',
  },
  {
    id: 'zomervakantie',
    emoji: '🏖️',
    title: 'Zomervakantie',
    startDate: '2026-07-27',
    endDate: '2026-08-14',
    description: 'Zomervakantie — geen training mogelijk',
    goal: 'In de beste shape op vakantie vertrekken',
    color: '#0EA5E9',
  },
  {
    id: 'ameland',
    emoji: '🏝️',
    title: 'Ameland gezinsvakantie',
    startDate: '2026-08-21',
    endDate: '2026-08-28',
    description: 'Gezinsvakantie Ameland',
    goal: 'Stabiliseren en Mounjaro herstart verankeren',
    color: '#16A34A',
  },
  {
    id: 'trouwdag',
    emoji: '💍',
    title: '22 jaar getrouwd',
    startDate: '2026-09-02',
    endDate: '2026-09-02',
    description: 'Huwelijksverjaardag — trouwjurk passen',
    goal: 'In de trouwjurk passen',
    color: '#C026D3',
  },
  {
    id: 'bereloop',
    emoji: '🏃',
    title: 'Terschelling Bereloop',
    startDate: '2026-10-30',
    endDate: '2026-11-02',
    description: 'Hardloopevenement Terschelling — 10 km strand/duin',
    goal: '10 km uitlopen in zone B, eigen tempo',
    color: '#EA580C',
  },
];
