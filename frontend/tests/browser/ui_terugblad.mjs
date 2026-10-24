// Terugbladeren naar een eerdere dag mag nooit een wit scherm geven.
//
// WAT ER MIS WAS
//
// De 75-dagenkaart las de fase van de dag, en dayNumber() geeft null voor
// elke dag vóór de startdatum. dailyMessage greep daarna naar fase.focus:
// TypeError in de render, en een TypeError in de render neemt de hele boom
// mee. Zij bladerde terug naar een dag van vóór 24 oktober en de app was
// weg — geen foutmelding, een wit scherm.
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

// De uitdaging start vandaag, zodat elke eerdere dag ervóór valt — precies
// haar situatie.
const seed = { gc_onboarding_done: '1',
  gc_challenge75: JSON.stringify({ id: 'vs75', startDate: TODAY,
    days: { [TODAY]: { day: 1, kind: 'circuit', doneAt: new Date().toISOString() } },
    startedAt: new Date().toISOString() }),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }) };
for (let i = 0; i < 20; i++) {
  const d = addDays(TODAY, -i);
  seed[`gc_log_${d}`] = JSON.stringify({ date: d, energy: 2, sleep_quality: 2,
    sleep_hours: 7.5, steps: 8000, headache_severity: 0, recovery_check: 'good' });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed]);

console.log('\n████ Terugbladeren naar eerdere dagen ████\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

// Terugbladeren: de dagkiezer op Vandaag. Zoek de knop die een dag terug gaat.
async function eenDagTerug() {
  return page.evaluate(() => {
    const kandidaat = [...document.querySelectorAll('button, div, span')]
      .find(e => ['‹', '◀', '◂', '<', '←'].includes(e.textContent.trim()) && e.offsetHeight > 0);
    if (kandidaat) { kandidaat.click(); return 'knop'; }
    // Anders via de datumkiezer.
    const input = document.querySelector('input[type="date"]');
    if (input) return 'datumveld';
    return null;
  });
}

const hoe = await eenDagTerug();
await page.waitForTimeout(900);

// Lukt de knop niet, dan via het datumveld op Lichaam.
if (hoe !== 'knop') {
  await page.evaluate((d) => {
    const input = document.querySelector('input[type="date"]');
    if (input) {
      input.value = d;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, addDays(TODAY, -2));
  await page.waitForTimeout(1200);
}

const tekst = await page.evaluate(() => document.body.innerText);
const leeg = tekst.trim().length < 60;
console.log(`  navigatie via: ${hoe || '(niet gevonden)'} · schermtekst: ${tekst.trim().length} tekens`);
ok('het scherm is niet leeg', !leeg, tekst.slice(0, 120));
ok('de navigatie staat er nog', /Vandaag/i.test(tekst) && /Progressie/i.test(tekst),
  tekst.slice(0, 160));
ok('geen JS-fout bij het terugbladeren', errors.length === 0, errors.join(' | '));

// Nu expliciet een dag vóór de start, via de datumkiezer op Lichaam.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, div, span')]
    .find(e => /^Lichaam$/i.test(e.textContent.trim()) && e.offsetHeight > 0);
  el?.click();
});
await page.waitForTimeout(900);
await page.evaluate((d) => {
  for (const input of document.querySelectorAll('input[type="date"]')) {
    input.value = d;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, addDays(TODAY, -7));
await page.waitForTimeout(1400);
const t2 = await page.evaluate(() => document.body.innerText);
ok('een dag van een week terug geeft ook geen wit scherm', t2.trim().length > 60,
  t2.slice(0, 120));
ok('nog steeds geen JS-fout', errors.length === 0, errors.join(' | '));

// En de kaart op Vandaag voor een dag vóór de start zegt dat netjes.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('button, a, div, span')]
    .find(e => /^Vandaag$/i.test(e.textContent.trim()) && e.offsetHeight > 0);
  el?.click();
});
await page.waitForTimeout(1200);
const soort = await page.getAttribute('[data-challenge]', 'data-challenge').catch(() => null);
console.log(`  challengekaart op een eerdere dag: ${soort}`);
ok('de kaart zegt dat de uitdaging toen nog niet liep, of toont die dag',
  soort === 'voor-start' || soort === 'open' || soort === 'gedaan', String(soort));
ok('en er is nergens een JS-fout gevallen', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
