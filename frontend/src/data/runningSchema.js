// Persoonlijk Hardloopschema – 35 trainingen (opbouw naar 5 km)
// Uitgangspunt: hartslagzone 106–132 bpm · 3 trainingen per week · hartslag leidend
export const RUNS = [
  // ── Week 1 ────────────────────────────────────────────────────────────────
  { nr:  1, week:  1, description: '3 min jog – 2 min wandel ×6',          duration: 30, jogMin: 18, walkMin: 12 },
  { nr:  2, week:  1, description: '3 min jog – 2 min wandel ×6',          duration: 30, jogMin: 18, walkMin: 12 },
  { nr:  3, week:  1, description: '3 min jog – 2 min wandel ×7',          duration: 35, jogMin: 21, walkMin: 14 },
  // ── Week 2 ────────────────────────────────────────────────────────────────
  { nr:  4, week:  2, description: '4 min jog – 2 min wandel ×5',          duration: 30, jogMin: 20, walkMin: 10 },
  { nr:  5, week:  2, description: '4 min jog – 2 min wandel ×5',          duration: 30, jogMin: 20, walkMin: 10 },
  { nr:  6, week:  2, description: '5 min jog – 2 min wandel ×4',          duration: 28, jogMin: 20, walkMin:  8 },
  // ── Week 3 ────────────────────────────────────────────────────────────────
  { nr:  7, week:  3, description: '5 min jog – 2 min wandel ×4',          duration: 28, jogMin: 20, walkMin:  8 },
  { nr:  8, week:  3, description: '4 min jog – 1 min wandel ×6',          duration: 30, jogMin: 24, walkMin:  6 },
  { nr:  9, week:  3, description: '6 min jog – 2 min wandel ×4',          duration: 32, jogMin: 24, walkMin:  8 },
  // ── Week 4 ────────────────────────────────────────────────────────────────
  { nr: 10, week:  4, description: '6 min jog – 2 min wandel ×4',          duration: 32, jogMin: 24, walkMin:  8 },
  { nr: 11, week:  4, description: '5 min jog – 1 min wandel ×6',          duration: 36, jogMin: 30, walkMin:  6 },
  { nr: 12, week:  4, description: '8 min jog – 2 min wandel ×3',          duration: 30, jogMin: 24, walkMin:  6 },
  // ── Week 5 ────────────────────────────────────────────────────────────────
  { nr: 13, week:  5, description: '8 min jog – 2 min wandel ×3',          duration: 30, jogMin: 24, walkMin:  6 },
  { nr: 14, week:  5, description: '6 min jog – 1 min wandel ×5',          duration: 35, jogMin: 30, walkMin:  5 },
  { nr: 15, week:  5, description: '10 min jog – 2 min wandel ×3',         duration: 36, jogMin: 30, walkMin:  6 },
  // ── Week 6 ────────────────────────────────────────────────────────────────
  { nr: 16, week:  6, description: '10 min jog – 2 min wandel ×3',         duration: 36, jogMin: 30, walkMin:  6 },
  { nr: 17, week:  6, description: '8 min jog – 1 min wandel ×4',          duration: 36, jogMin: 32, walkMin:  4 },
  { nr: 18, week:  6, description: '12 min jog – 2 min wandel ×2',         duration: 28, jogMin: 24, walkMin:  4 },
  // ── Week 7 ────────────────────────────────────────────────────────────────
  { nr: 19, week:  7, description: '12 min jog – 2 min wandel ×2',         duration: 28, jogMin: 24, walkMin:  4 },
  { nr: 20, week:  7, description: '10 min jog – 1 min wandel ×3',         duration: 33, jogMin: 30, walkMin:  3 },
  { nr: 21, week:  7, description: '15 min jog – 2 min wandel ×2',         duration: 34, jogMin: 30, walkMin:  4 },
  // ── Week 8 ────────────────────────────────────────────────────────────────
  { nr: 22, week:  8, description: '15 min jog – 2 min wandel ×2',         duration: 34, jogMin: 30, walkMin:  4 },
  { nr: 23, week:  8, description: '12 min jog – 1 min wandel ×2',         duration: 26, jogMin: 24, walkMin:  2 },
  { nr: 24, week:  8, description: '20 min aaneengesloten lopen',           duration: 20, jogMin: 20, walkMin:  0 },
  // ── Week 9 ────────────────────────────────────────────────────────────────
  { nr: 25, week:  9, description: '20 min lopen',                          duration: 20, jogMin: 20, walkMin:  0 },
  { nr: 26, week:  9, description: '15 min lopen + 3×1 min sneller',        duration: 20, jogMin: 18, walkMin:  0, intervals: '3×1 min sneller' },
  { nr: 27, week:  9, description: '25 min lopen',                          duration: 25, jogMin: 25, walkMin:  0 },
  // ── Week 10 ───────────────────────────────────────────────────────────────
  { nr: 28, week: 10, description: '25 min lopen',                          duration: 25, jogMin: 25, walkMin:  0 },
  { nr: 29, week: 10, description: '20 min lopen + 4×1 min sneller',        duration: 25, jogMin: 24, walkMin:  0, intervals: '4×1 min sneller' },
  { nr: 30, week: 10, description: '30 min lopen',                          duration: 30, jogMin: 30, walkMin:  0 },
  // ── Week 11 ───────────────────────────────────────────────────────────────
  { nr: 31, week: 11, description: '30 min rustig',                         duration: 30, jogMin: 30, walkMin:  0 },
  { nr: 32, week: 11, description: '25 min + 5×1 min sneller',              duration: 30, jogMin: 30, walkMin:  0, intervals: '5×1 min sneller' },
  { nr: 33, week: 11, description: '35 min rustig',                         duration: 35, jogMin: 35, walkMin:  0 },
  // ── Week 12 ───────────────────────────────────────────────────────────────
  { nr: 34, week: 12, description: '30 min rustig',                         duration: 30, jogMin: 30, walkMin:  0 },
  { nr: 35, week: 12, description: '🏁 5 km rustig lopen',                  duration: 35, jogMin: 35, walkMin:  0, milestone: true },
];
