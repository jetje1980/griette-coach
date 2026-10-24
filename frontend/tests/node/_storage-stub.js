// Installeert een nagemaakte localStorage vóórdat er iets uit src/ wordt
// geladen.
//
// Nodig omdat sync.js bij het laden al `localStorage.setItem` bindt: een
// module die photoStore importeert, raakt dat aan vóór de eerste regel van
// de test. ESM-imports worden gehoist, dus dit bestand moet als eerste
// geïmporteerd worden — daarom staat het apart en niet in de testen zelf.
let mem = {};
globalThis.__testStorage = {
  reset(seed = {}) { mem = { ...seed }; return mem; },
  raw() { return mem; },
};
const api = {
  get length() { return Object.keys(mem).length; },
  key: i => Object.keys(mem)[i] ?? null,
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; },
  clear: () => { mem = {}; },
};
globalThis.localStorage = api;
globalThis.sessionStorage = api;
