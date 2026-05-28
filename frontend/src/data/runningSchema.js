// 35 looptrainingen — placeholder tot PDF geüpload wordt
// Elke training: { nr, week, title, description, duration, runMin, walkMin, notes }
export const RUNS = [
  // Week 1
  { nr: 1,  week: 1, title: 'Verkenning',          duration: 30, runMin: 5,  walkMin: 25, description: '5 min inlopen wandelen · 3× (1 min lopen + 5 min wandelen) · 5 min uitlopen' },
  { nr: 2,  week: 1, title: 'Opbouw A',             duration: 30, runMin: 6,  walkMin: 24, description: '5 min wandelen · 4× (1 min lopen + 5 min wandelen) · 5 min uitlopen' },
  { nr: 3,  week: 1, title: 'Ritme zoeken',         duration: 32, runMin: 8,  walkMin: 24, description: '5 min wandelen · 4× (2 min lopen + 4 min wandelen) · 5 min uitlopen' },
  // Week 2
  { nr: 4,  week: 2, title: 'Interval A',           duration: 30, runMin: 9,  walkMin: 21, description: '5 min wandelen · 3× (3 min lopen + 4 min wandelen) · 5 min uitlopen' },
  { nr: 5,  week: 2, title: 'Interval B',           duration: 32, runMin: 12, walkMin: 20, description: '5 min wandelen · 4× (3 min lopen + 3 min wandelen) · 5 min uitlopen' },
  { nr: 6,  week: 2, title: 'Duurloop A',           duration: 30, runMin: 14, walkMin: 16, description: '5 min wandelen · 2× (7 min lopen + 3 min wandelen) · 5 min uitlopen' },
  // Week 3
  { nr: 7,  week: 3, title: 'Duurloop B',           duration: 32, runMin: 15, walkMin: 17, description: '5 min wandelen · 3× (5 min lopen + 3 min wandelen) · 5 min uitlopen' },
  { nr: 8,  week: 3, title: 'Opbouw lang',          duration: 33, runMin: 16, walkMin: 17, description: '5 min wandelen · 2× (8 min lopen + 3 min wandelen) · 5 min uitlopen' },
  { nr: 9,  week: 3, title: 'Herstel & ritme',      duration: 30, runMin: 15, walkMin: 15, description: '5 min wandelen · 3× (5 min lopen + 3 min wandelen) · 5 min uitlopen' },
  // ──── JOUW STARTPUNT ────
  { nr: 10, week: 4, title: 'Eerste 20 minuten',    duration: 35, runMin: 20, walkMin: 15, description: '5 min wandelen · 20 min doorlopen (zone B) · 10 min uitwandelen' },
  { nr: 11, week: 4, title: 'Stabiele loop',        duration: 35, runMin: 20, walkMin: 15, description: '5 min wandelen · 20 min doorlopen (zone B) · 10 min uitwandelen' },
  { nr: 12, week: 4, title: 'Kwaliteitsloop',       duration: 38, runMin: 22, walkMin: 16, description: '5 min wandelen · 22 min doorlopen (zone B) · 11 min uitwandelen' },
  // Week 5
  { nr: 13, week: 5, title: 'Opbouw naar 25',       duration: 38, runMin: 23, walkMin: 15, description: '5 min wandelen · 23 min doorlopen (zone B) · 10 min uitwandelen' },
  { nr: 14, week: 5, title: 'Tempo vasthouden',     duration: 40, runMin: 25, walkMin: 15, description: '5 min wandelen · 25 min doorlopen (zone B) · 10 min uitwandelen' },
  { nr: 15, week: 5, title: 'Lange loop',           duration: 40, runMin: 25, walkMin: 15, description: '5 min wandelen · 25 min doorlopen (zone B) · 10 min uitwandelen' },
  // Week 6
  { nr: 16, week: 6, title: 'Herstelweek A',        duration: 35, runMin: 20, walkMin: 15, description: 'Bewust rustiger: 5 min in · 20 min zone B · 10 min uit' },
  { nr: 17, week: 6, title: 'Herstelweek B',        duration: 38, runMin: 23, walkMin: 15, description: '5 min in · 23 min zone B · 10 min uit' },
  { nr: 18, week: 6, title: 'Terugkeer naar 25',    duration: 40, runMin: 25, walkMin: 15, description: '5 min in · 25 min zone B · 10 min uit' },
  // Week 7
  { nr: 19, week: 7, title: 'Naar de 28',           duration: 43, runMin: 28, walkMin: 15, description: '5 min in · 28 min zone B · 10 min uit' },
  { nr: 20, week: 7, title: 'Stevige 28',           duration: 43, runMin: 28, walkMin: 15, description: '5 min in · 28 min zone B · 10 min uit' },
  { nr: 21, week: 7, title: 'Eerste 30',            duration: 45, runMin: 30, walkMin: 15, description: '5 min in · 30 min doorlopen · 10 min uitwandelen — mijlpaal!🎉' },
  // Week 8
  { nr: 22, week: 8, title: 'Stabiele 30',          duration: 45, runMin: 30, walkMin: 15, description: '5 min in · 30 min zone B · 10 min uit' },
  { nr: 23, week: 8, title: 'Variatie 28+2',        duration: 45, runMin: 30, walkMin: 15, description: '5 min in · 28 min zone B · 2 min stap omhoog · 10 min uit' },
  { nr: 24, week: 8, title: 'Sterke 30',            duration: 45, runMin: 30, walkMin: 15, description: '5 min in · 30 min zone B · 10 min uit' },
  // Week 9
  { nr: 25, week: 9, title: 'Richting 33',          duration: 48, runMin: 33, walkMin: 15, description: '5 min in · 33 min zone B · 10 min uit' },
  { nr: 26, week: 9, title: 'Duurloop 33',          duration: 48, runMin: 33, walkMin: 15, description: '5 min in · 33 min zone B · 10 min uit' },
  { nr: 27, week: 9, title: 'Zware 35',             duration: 50, runMin: 35, walkMin: 15, description: '5 min in · 35 min zone B · 10 min uit' },
  // Week 10
  { nr: 28, week: 10, title: 'Herstelweek C',       duration: 43, runMin: 28, walkMin: 15, description: 'Bewust rustiger · 5 min in · 28 min zone B · 10 min uit' },
  { nr: 29, week: 10, title: 'Terug naar 33',       duration: 48, runMin: 33, walkMin: 15, description: '5 min in · 33 min zone B · 10 min uit' },
  { nr: 30, week: 10, title: 'Sterke 35',           duration: 50, runMin: 35, walkMin: 15, description: '5 min in · 35 min zone B · 10 min uit' },
  // Week 11
  { nr: 31, week: 11, title: 'Richting 38',         duration: 53, runMin: 38, walkMin: 15, description: '5 min in · 38 min zone B · 10 min uit' },
  { nr: 32, week: 11, title: 'Solide 38',           duration: 53, runMin: 38, walkMin: 15, description: '5 min in · 38 min zone B · 10 min uit' },
  { nr: 33, week: 11, title: 'Preview 40',          duration: 55, runMin: 40, walkMin: 15, description: '5 min in · 40 min zone B · 10 min uit' },
  // Week 12 — finale
  { nr: 34, week: 12, title: 'Penultieme loop',     duration: 55, runMin: 40, walkMin: 15, description: '5 min in · 40 min zone B · 10 min uitwandelen' },
  { nr: 35, week: 12, title: '🏁 Eindloop',         duration: 55, runMin: 40, walkMin: 15, description: '5 min in · 40 min zone B met trots · 10 min uitwandelen — programma voltooid!' },
];

// NOTE: Upload je hardloopschema.pdf dan vervangen we dit door de exacte trainingen.
