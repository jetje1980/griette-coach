// Uniform TaskItem-model: elke taak/actie heeft een traceerbare herkomst en
// een expliciete bestemming. Geen item mag onvindbaar worden.
//
// TaskItem = {
//   id, title,
//   source: 'capture' | 'trello' | 'calendar' | 'manual' | 'coach',
//   sourceId,
//   status: 'inbox' | 'planned' | 'scheduled' | 'delegated' | 'parked' | 'done',
//   destination: null | 'today' | 'week' | 'calendar' | 'trello' | 'project' | 'later',
//   date, startTime, endTime, priority,
//   trelloCardId, trelloBoardId, trelloListId, trelloUrl,
//   calendarEventId, calendarId, calendarLink, calendarStatus ('ok'|'deleted'),
//   projectId, projectName,
//   delegatedTo, delegatedAt, followUpDate, reviewDate, note,
//   createdAt, updatedAt
// }

const KEY = 'gc_tasks';
const LEGACY_INBOX = 'gc_inbox';

export const TASK_STATUSES = [
  { id: 'inbox',     label: 'Open',         emoji: '📥' },
  { id: 'planned',   label: 'Gepland',      emoji: '📅' },
  { id: 'delegated', label: 'Gedelegeerd',  emoji: '🤝' },
  { id: 'parked',    label: 'Geparkeerd',   emoji: '🅿️' },
  { id: 'done',      label: 'Klaar',        emoji: '✓' },
];

export const DESTINATION_LABELS = {
  today: 'Vandaag',
  week: 'Deze week',
  calendar: 'Agenda',
  trello: 'Trello Backlog',
  project: 'Project',
  later: 'Later / geparkeerd',
};

// ── Migratie: oude gc_inbox items overzetten (eenmalig) ─────────
function migrate() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_INBOX) || '[]');
    if (!legacy.length) return;
    const existing = loadRaw();
    const now = new Date().toISOString();
    const STATUS_MAP = { open: 'inbox', plannen: 'planned', delegeer: 'delegated', park: 'parked', done: 'done' };
    for (const item of legacy) {
      if (existing.some(t => t.sourceId === `legacy_${item.id}`)) continue;
      existing.push({
        id: `t_${item.id}`,
        title: item.text,
        source: 'capture',
        sourceId: `legacy_${item.id}`,
        status: STATUS_MAP[item.status] || 'inbox',
        destination: null,
        createdAt: item.date || now,
        updatedAt: now,
      });
    }
    localStorage.setItem(KEY, JSON.stringify(existing));
    localStorage.removeItem(LEGACY_INBOX);
  } catch { /* migratie is best-effort */ }
}

function loadRaw() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function loadTasks() {
  migrate();
  return loadRaw().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function persist(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }

export function createTask(fields) {
  const arr = loadTasks();
  const now = new Date().toISOString();
  const task = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    source: 'capture',
    status: 'inbox',
    destination: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
  arr.unshift(task);
  persist(arr);
  return task;
}

export function updateTask(id, patch) {
  const arr = loadTasks();
  const idx = arr.findIndex(t => t.id === id);
  if (idx < 0) return null;
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  persist(arr);
  return arr[idx];
}

export function deleteTask(id) {
  persist(loadTasks().filter(t => t.id !== id));
}

export function getTask(id) {
  return loadTasks().find(t => t.id === id) || null;
}

export function tasksByStatus(status) {
  return loadTasks().filter(t => t.status === status);
}

// Duplicaat-preventie: bestaat er al een taak voor deze externe bron?
export function findByTrelloCard(cardId) {
  return loadTasks().find(t => t.trelloCardId === cardId) || null;
}

// ── Dagacties (Vandaag) — gekoppeld aan TaskItems ───────────────
// item = { id, taskId, title, done, trelloUrl }
export function getDayActions(date) {
  try { return JSON.parse(localStorage.getItem(`gc_day_actions_${date}`) || '[]'); } catch { return []; }
}
export function saveDayActions(date, arr) {
  localStorage.setItem(`gc_day_actions_${date}`, JSON.stringify(arr));
}

// Taak afronden — overal doorvoeren (taak zelf + dagacties + Top 3)
export function completeTask(taskId, date) {
  updateTask(taskId, { status: 'done' });
  if (date) {
    const actions = getDayActions(date).map(a => a.taskId === taskId ? { ...a, done: true } : a);
    saveDayActions(date, actions);
  }
}

// Bestemming als leesbare tekst (voor de inbox-weergave)
export function destinationText(task) {
  if (!task.destination) return null;
  switch (task.destination) {
    case 'today':    return `Vandaag${task.date ? ` (${task.date})` : ''}`;
    case 'week':     return task.date ? `Week — ${task.date}` : 'Weekprioriteit';
    case 'calendar':
      if (task.calendarStatus === 'deleted') return 'Agenda-afspraak verwijderd';
      return `Agenda ${task.date || ''} ${task.startTime || ''}`.trim();
    case 'trello':   return 'Trello Backlog';
    case 'project':  return `Project: ${task.projectName || task.projectId || ''}`;
    case 'later':    return 'Later / geparkeerd';
    default:         return task.destination;
  }
}

// Follow-ups van gedelegeerde taken die (over)tijd zijn
export function dueFollowUps(todayStr) {
  return loadTasks().filter(t =>
    t.status === 'delegated' && t.followUpDate && t.followUpDate <= todayStr
  );
}
