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
