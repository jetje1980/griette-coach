// Service worker: de app openen zonder netwerk, en nooit een oude versie
// blijven serveren.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT ER IS
//
// Zonder service worker en zonder manifest is een pictogram op je
// beginscherm een snelkoppeling naar een website. Android opent die in de
// browser, en zodra er iets misgaat — geen netwerk, een externe link, een
// terugkeer uit een andere app — sta je buiten de app in plaats van erin.
//
// Met een manifest (scope /griette-coach/) en deze worker wordt het een
// geïnstalleerde app met een eigen venster. Dat is geen cosmetica: het is
// het verschil tussen "de app sluit soms zomaar" en "de app blijft open".
//
// ─────────────────────────────────────────────────────────────────
// DE CACHESTRATEGIE, EN WAAROM DEZE
//
// Netwerk eerst, cache als vangnet. Andersom — cache eerst — is sneller en
// precies verkeerd voor deze app: dan zie je na een deploy dagenlang de
// oude versie, en dat is bij een coach die op jouw data rekent erger dan
// een halve seconde wachten.
//
// index.html wordt nooit uit de cache geserveerd zolang er netwerk is,
// zodat een nieuwe versie meteen binnenkomt. De gehashte bestanden in
// /assets/ mogen wél uit de cache: hun naam verandert bij elke build, dus
// een oude naam kan geen nieuwe inhoud verbergen.
// ─────────────────────────────────────────────────────────────────

const VERSIE = 'gc-v1';
const SCOPE = '/griette-coach/';
const SCHIL = [SCOPE, `${SCOPE}index.html`, `${SCOPE}manifest.webmanifest`];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSIE)
      .then(c => c.addAll(SCHIL).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== VERSIE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Alleen onze eigen bestanden. Supabase, de AI-aanroep en Google Fonts
  // gaan ongemoeid langs: een gecachete API-response is een verkeerd
  // antwoord dat er goed uitziet.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE)) return;
  if (e.request.method !== 'GET') return;

  // Gehashte bouwbestanden: cache first, want de naam is de versie.
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        const kopie = r.clone();
        caches.open(VERSIE).then(c => c.put(e.request, kopie)).catch(() => {});
        return r;
      })),
    );
    return;
  }

  // De rest, inclusief index.html: netwerk eerst.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const kopie = r.clone();
        caches.open(VERSIE).then(c => c.put(e.request, kopie)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request)
        .then(hit => hit || caches.match(`${SCOPE}index.html`))),
  );
});
