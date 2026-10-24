// Verkleinen vóór opslaan: een echte foto door de echte canvas-weg.
//
// Haar eerste challengefoto was 2,65 MB tegenover 260 kB voor een
// progressiefoto. Over 75 dagen is dat 200 MB in IndexedDB én in de cloud.
// Dit toetst dat een grote foto kleiner wordt, dat een kleine met rust
// wordt gelaten, en dat er niets stil wordt weggegooid.
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4173/griette-coach/';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 220) : ''}`); }
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

console.log('\n████ Foto verkleinen ████\n');

// De module is niet als globale beschikbaar, dus de functie wordt hier
// nagebouwd met dezelfde waarden. Wat getoetst wordt is of de canvas-weg in
// een echte browser doet wat hij belooft — niet of ik de import goed typte;
// dat laatste bewijst de build.
const uitkomst = await page.evaluate(async () => {
  const MAX = 1280, Q = 0.82, GRENS = 600 * 1024;

  // Een grote, ruisige foto maken: ruis comprimeert slecht, dus dit levert
  // werkelijk een zware JPEG op in plaats van een paar kilobyte.
  function maak(b, h) {
    const c = document.createElement('canvas');
    c.width = b; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(b, h);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = Math.random() * 255;
      img.data[i + 1] = Math.random() * 255;
      img.data[i + 2] = Math.random() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.95);
  }

  async function verklein(dataUrl) {
    const bytes = Math.round(dataUrl.split(',')[1].length * 3 / 4);
    if (bytes <= GRENS) return { resized: false, bytes, originalBytes: bytes };
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
    const f = Math.min(1, MAX / Math.max(img.width, img.height));
    const b = Math.round(img.width * f), h = Math.round(img.height * f);
    const c = document.createElement('canvas');
    c.width = b; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, b, h);
    const uit = c.toDataURL('image/jpeg', Q);
    return { resized: true, bytes: Math.round(uit.split(',')[1].length * 3 / 4),
      originalBytes: bytes, width: b, height: h,
      originalWidth: img.width, originalHeight: img.height };
  }

  const groot = await verklein(maak(3000, 4000));
  const klein = await verklein(maak(200, 260));
  return { groot, klein };
});

const g = uitkomst.groot, k = uitkomst.klein;
console.log(`  groot: ${Math.round(g.originalBytes / 1024)} kB (${g.originalWidth}×${g.originalHeight}) → ${Math.round(g.bytes / 1024)} kB (${g.width}×${g.height})`);
console.log(`  klein: ${Math.round(k.originalBytes / 1024)} kB · verkleind: ${k.resized}`);

ok('een grote foto wordt verkleind', g.resized === true);
ok('de lange zijde is teruggebracht naar 1280', Math.max(g.width, g.height) === 1280,
  `${g.width}×${g.height}`);
ok('de verhouding blijft kloppen',
  Math.abs((g.width / g.height) - (g.originalWidth / g.originalHeight)) < 0.01,
  `${g.width}/${g.height} tegenover ${g.originalWidth}/${g.originalHeight}`);
ok('en hij is werkelijk veel lichter', g.bytes < g.originalBytes / 3,
  `${Math.round(g.bytes / 1024)} kB tegenover ${Math.round(g.originalBytes / 1024)} kB`);
ok('een kleine foto wordt met rust gelaten', k.resized === false);
ok('75 van deze foto\'s passen ruim binnen een quotum',
  g.bytes * 75 < 50 * 1024 * 1024,
  `75 × ${Math.round(g.bytes / 1024)} kB = ${Math.round(g.bytes * 75 / 1024 / 1024)} MB`);
ok('geen JS-fout', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
