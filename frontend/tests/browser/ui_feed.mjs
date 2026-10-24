// De dagelijkse fotoreeks in het echte scherm, en de scheiding met de
// wekelijkse progressiefoto's.
//
// De echte photoStore (IndexedDB) wordt hier wél gebruikt — dat is het punt:
// de node-suite toetst de filterlogica, deze toetst of een dagfoto werkelijk
// in de feed belandt en niet in de progressiesessies.
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 250) : ''}`); }
};
const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
const TODAY = NL.format(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };

const seed = { gc_onboarding_done: '1',
  gc_challenge75: JSON.stringify({ id: 'vs75', startDate: addDays(TODAY, -3),
    days: {}, startedAt: new Date().toISOString() }),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }) };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed]);

console.log('\n████ De dagelijkse feed ████\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

// Foto's rechtstreeks in IndexedDB zetten: één verkeerd opgeslagen 'front'
// (zoals haar foto van dag 1), twee goede dagfoto's en één echt aanzicht.
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
await page.evaluate(async ([pix, d1, d2, d3, aanzicht]) => {
  // Versie 2 en géén upgrade-handler: dat is de versie die de app zelf
  // gebruikt. Met een hóger nummer openen bumpt de database, en dan faalt
  // de app met een VersionError en ziet hij geen enkele foto meer. (Mijn
  // eerste versie van deze test deed dat, en brak daarmee het ding dat hij
  // moest toetsen.)
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('gc_photos', 2);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const put = (rec) => new Promise(done => {
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(rec);
    tx.oncomplete = done; tx.onerror = done;
  });
  await put({ id: `${d1}_front`, date: d1, type: 'front', base64: pix,
    mimeType: 'image/png', source: 'challenge75', savedAt: new Date().toISOString() });
  await put({ id: `${d2}_dag`, date: d2, type: 'dag', base64: pix,
    mimeType: 'image/png', source: 'challenge75', savedAt: new Date().toISOString() });
  await put({ id: `${d3}_dag`, date: d3, type: 'dag', base64: pix,
    mimeType: 'image/png', source: 'challenge75', savedAt: new Date().toISOString() });
  await put({ id: `${aanzicht}_voor`, date: aanzicht, type: 'voor', base64: pix,
    mimeType: 'image/png', savedAt: new Date().toISOString() });
}, [PIXEL, addDays(TODAY, -3), addDays(TODAY, -2), addDays(TODAY, -1), addDays(TODAY, -5)]);

// Herladen zodat de verhuizing bij het opstarten draait.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);

const klik = async t => page.evaluate(x => {
  const re = new RegExp(`^${x}$`, 'i');
  const el = [...document.querySelectorAll('button, a, div, span')]
    .find(e => re.test(e.textContent.trim()) && e.offsetHeight > 0);
  el?.click(); return !!el;
}, t);

// De feed-tab
await klik('Progressie'); await page.waitForTimeout(800);
ok('er is een tab "75 dagen"', await klik('75 dagen'), 'tab niet gevonden');
await page.waitForTimeout(700);

// ── Afvinken op het tabblad dat "75 dagen" heet ──────────────
//
// Zij vroeg twee keer waar ze haar acht minuten kon afvinken. De kaart
// stond op Vandaag (onder het dagadvies) en in Kracht (onder de lessen),
// maar niet op het tabblad met zijn eigen naam — de eerste plek waar je
// kijkt. Nu wel, en het is dezelfde kaart op dezelfde opslag.
await page.waitForSelector('[data-challenge]', { timeout: 6000 }).catch(() => {});
ok('de afvinkkaart staat op het tabblad 75 dagen',
  await page.locator('[data-challenge]').count() >= 1);
ok('en wijst de juiste dag aan',
  await page.locator('[data-challenge-dag="4"]').count() === 1,
  await page.evaluate(() => document.querySelector('[data-challenge]')
    ?.getAttribute('data-challenge-dag')));
ok('met een knop om de acht minuten af te vinken',
  await page.locator('[data-challenge-circuit]').count() >= 1);
await page.locator('[data-challenge-circuit]').first().click();
await page.waitForTimeout(500);
ok('afvinken hier werkt', await page.locator('[data-challenge="gedaan"]').count() >= 1);
const opslag = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('gc_challenge75') || '{}'));
ok('en komt in dezelfde opslag als de kaart op Vandaag',
  opslag.days?.[TODAY]?.kind === 'circuit', JSON.stringify(opslag.days));
// Wachten op het element in plaats van op de klok: de feed leest IndexedDB
// en decodeert de beelden, en hoe lang dat duurt hangt van de machine af.
await page.waitForSelector('[data-feed-foto]', { timeout: 8000 }).catch(() => {});
const aantal = await page.locator('[data-feed-foto]').count();
ok('alle drie de dagfoto\'s staan in de feed', aantal === 3, String(aantal));
const dagen = await page.evaluate(() => [...document.querySelectorAll('[data-feed-foto]')]
  .map(e => e.getAttribute('data-feed-foto')));
ok('met een dagnummer per foto', dagen.every(d => Number(d) >= 1), dagen.join(','));
const feedTekst = await page.evaluate(() => document.body.innerText);
ok('en de uitleg dat dit los staat van de progressiefoto\'s',
  /los van je wekelijkse progressiefoto/i.test(feedTekst));
ok('vergelijken van eerste naast laatste kan',
  await page.locator('[data-feed-vergelijk]').count() === 1);

// ── Twee foto's per dag, vanuit het raster ───────────────────
//
// Zij vroeg waar ze de foto's toevoegt, en daarna: ik wil er elke dag twee
// kunnen uploaden. Op de dagkaart kon er één, en alleen voor vandaag, en
// alleen zolang er nog géén foto stond. Nu zitten beide plekken bij de dag
// zelf — ook bij een dag van vorige week.
await page.click('[data-challenge-raster-knop]'); await page.waitForTimeout(600);

// Let op de scope: de kaart zelf toont óók twee fotoplekken (die van
// vandaag). Alles wat hier wordt aangewezen staat in het dagvenster van
// het raster, anders test je per ongeluk de kaart van vandaag.
const D = '[data-challenge-dagdetail] ';

await page.click('[data-dag="2"]'); await page.waitForTimeout(600);
ok('een eerdere dag heeft twee fotoplekken',
  await page.locator(`${D}[data-dagfoto]`).count() === 2,
  String(await page.locator(`${D}[data-dagfoto]`).count()));
ok('de eerste plek is gevuld',
  await page.getAttribute(`${D}[data-dagfoto="dag"]`, 'data-dagfoto-staat') === 'ja',
  String(await page.getAttribute(`${D}[data-dagfoto="dag"]`, 'data-dagfoto-staat')));
ok('en de tweede staat klaar',
  await page.getAttribute(`${D}[data-dagfoto="dag2"]`, 'data-dagfoto-staat') === 'nee',
  String(await page.getAttribute(`${D}[data-dagfoto="dag2"]`, 'data-dagfoto-staat')));

// Dag 3 is gisteren, en heeft al één foto. Precies haar geval: er staat er
// één, en ze wil er een tweede bij op dezelfde dag.
await page.click('[data-dag="3"]'); await page.waitForTimeout(600);
ok('een dag met één foto houdt één plek open',
  await page.locator(`${D}[data-dagfoto][data-dagfoto-staat="nee"]`).count() === 1,
  String(await page.locator(`${D}[data-dagfoto][data-dagfoto-staat="nee"]`).count()));
await page.setInputFiles(`${D}[data-dagfoto="dag2"] input[type=file]`, {
  name: 'tweede.png', mimeType: 'image/png', buffer: Buffer.from(PIXEL, 'base64') });
await page.waitForTimeout(1800);
ok('na toevoegen staan er twee bij die dag',
  await page.locator(`${D}[data-dagfoto][data-dagfoto-staat="ja"]`).count() === 2,
  await page.textContent('[data-challenge-dagdetail]').catch(() => ''));
const bijDag3 = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('gc_challenge75') || '{}').days || {};
  const rec = Object.values(d).find(x => x.day === 3);
  return rec ? Object.keys(rec.photos || {}) : [];
});
ok('de tweede is vastgelegd bij dag 3', bijDag3.includes('dag2'), JSON.stringify(bijDag3));
ok('het vakje in het raster toont twee stipjes',
  await page.getAttribute('[data-dag="3"] [data-dag-fotos]', 'data-dag-fotos') === '2',
  String(await page.getAttribute('[data-dag="3"] [data-dag-fotos]', 'data-dag-fotos')));

// En in de feed staan het twee losse beelden van dezelfde dag.
await page.waitForTimeout(600);
const plekken = await page.evaluate(() => [...document.querySelectorAll('[data-feed-foto="3"]')]
  .map(e => e.getAttribute('data-feed-plek')).sort());
ok('de feed toont beide plekken van dag 3 apart',
  plekken.join(',') === 'dag,dag2', JSON.stringify(plekken));

// En nu de progressiesessies: daar mag geen dagfoto in staan
await klik('Body'); await page.waitForTimeout(1500);
const rijen = await page.evaluate(() => [...document.querySelectorAll('[data-foto-rij]')]
  .map(e => e.getAttribute('data-foto-rij')));
console.log(`  progressiesessies: ${rijen.join(' · ') || '(geen)'}`);
ok('geen lege rijen van dagfoto-datums tussen de progressiesessies',
  !rijen.some(d => [addDays(TODAY, -1), addDays(TODAY, -2), addDays(TODAY, -3)].includes(d)),
  rijen.join(','));

// ── Pas nu de opslag nakijken ────────────────────────────────
// Een eigen verbinding naar IndexedDB openen terwijl de app de zijne nog
// gebruikt, laat diens getDaily() leeg teruggeven. Daarom staat deze
// controle achteraan, en niet tussen het laden en de feed.
const soorten = await page.evaluate(async () => {
  const db = await new Promise(res => { const r = indexedDB.open('gc_photos', 2);
    r.onsuccess = () => res(r.result); });
  return new Promise(res => {
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').getAll();
    req.onsuccess = () => res((req.result || []).map(p => `${p.date}:${p.type}`).sort());
  });
});
console.log(`  opslag: ${soorten.join(' · ')}`);
ok('de verkeerd opgeslagen foto is verhuisd naar de dagelijkse soort',
  !soorten.some(s => s.endsWith(':front')), soorten.join(' '));
// Drie gezaaide dagfoto's plus de tweede van dag 3, hierboven via het
// raster toegevoegd — die hoort in dezelfde opslag terecht te komen en niet
// in een eigen hoekje.
ok('en staat nu als dagfoto', soorten.filter(s => /:dag2?$/.test(s)).length === 4,
  soorten.join(' '));
ok('het echte aanzicht is onaangeroerd', soorten.some(s => s.endsWith(':voor')),
  soorten.join(' '));

ok('geen JS-fout', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
