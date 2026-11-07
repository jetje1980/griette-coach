// Het dagplan naar Ameland in het echte scherm: staat het tabblad er,
// klopt de inhoud, en komt een ingevuld veld werkelijk in het dagboek?
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

// Een race over vijf weken, en genoeg geschiedenis om een niveau en een
// cyclus uit te rekenen.
const RACE = addDays(TODAY, 35);

const loop = (datum, meters, sec, hr) => ({
  id: `w_${datum}`, date: datum, activityType: 'run',
  distance: +(meters / 1000).toFixed(2), duration: Math.round(sec / 60) + 5, averageHR: hr,
  laps: [{ movingTime: sec, distance: meters, avgHr: hr }],
});

const seed = {
  gc_onboarding_done: '1',
  gc_race_goals: JSON.stringify([{ id: 'ameland', name: 'Ameland Adventure Run 5 km',
    distanceKm: 5, targetTimeSec: 2100, date: RACE, type: 'TARGET', priority: 1,
    enabled: true, terrain: 'trail' }]),
  gc_workouts: JSON.stringify([
    loop(addDays(TODAY, -19), 988, 480, 142),
    loop(addDays(TODAY, -15), 935, 480, 147),
    loop(addDays(TODAY, -13), 1000, 548, 144),
    loop(TODAY, 1000, 525, 137),
  ]),
  gc_hr_settings: JSON.stringify({ easyLow: 106, easyHigh: 145, walkTrigger: 150,
    resumeBelow: 105, recoveryHR: null, rpeEasy: 4, rpeThreshold: 6 }),
  gc_auth_session: JSON.stringify({ access_token: 't', refresh_token: 't',
    token_type: 'bearer', expires_in: 999999,
    expires_at: Math.floor(Date.now() / 1000) + 999999,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 't@t.nl',
      aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }),
};
// Twee menstruatiestarts, zodat de laatluteale week te berekenen is.
seed[`gc_log_${addDays(TODAY, -38)}`] = JSON.stringify({ date: addDays(TODAY, -38), cycle_day_one: true });
seed[`gc_log_${addDays(TODAY, -10)}`] = JSON.stringify({ date: addDays(TODAY, -10), cycle_day_one: true });
// Een oplopende rusthartslag, zodat het eetadvies scherp hoort te staan.
[[-40, 54], [-38, 55], [-36, 57], [-4, 63], [-2, 64], [0, 66]].forEach(([d, hr]) => {
  const datum = addDays(TODAY, d);
  const bestaand = seed[`gc_log_${datum}`] ? JSON.parse(seed[`gc_log_${datum}`]) : { date: datum };
  seed[`gc_log_${datum}`] = JSON.stringify({ ...bestaand, hr_rest: hr,
    weight: d < -20 ? 63.5 : 61.5 });
});

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await b.newPage({ viewport: { width: 390, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.route('**/*supabase.co/**', r => r.abort());
await page.addInitScript(([d]) => {
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}, [seed]);

console.log('\n████ Dagplan naar Ameland op het scherm ████\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

const klik = async t => page.evaluate(x => {
  const re = new RegExp(`^${x}$`, 'i');
  const el = [...document.querySelectorAll('button, a, div, span')]
    .find(e => re.test(e.textContent.trim()) && e.offsetHeight > 0);
  el?.click(); return !!el;
}, t);

ok('er is een tabblad Ameland', await klik('Ameland'), 'tabblad niet gevonden');
await page.waitForTimeout(1200);
await page.waitForSelector('[data-raceplan]', { timeout: 8000 }).catch(() => {});

const aantal = Number(await page.getAttribute('[data-raceplan]', 'data-raceplan'));
ok('het plan loopt tot de race', aantal === 36, String(aantal));

const weken = Number(await page.getAttribute('[data-weken]', 'data-weken'));
ok('de weken staan er', weken >= 5, String(weken));
const wekenTekst = await page.textContent('[data-weken]');
console.log(`  weken: ${wekenTekst.replace(/\s+/g, ' ').slice(0, 150)}`);
ok('met loop- en krachtdagen per week', /× lopen/.test(wekenTekst) && /× kracht/.test(wekenTekst));

const knoppen = Number(await page.getAttribute('[data-knoppen]', 'data-knoppen'));
ok('de knoppen om aan te draaien staan er', knoppen >= 4, String(knoppen));
ok('met frequentie erbij', await page.locator('[data-knop="frequentie"]').count() === 1);
ok('en eten', await page.locator('[data-knop="eten"]').count() === 1);
const eten = await page.textContent('[data-knop="eten"]');
ok('de eetknop noemt de oplopende rusthartslag',
  /Rusthartslag \+/.test(eten), eten.replace(/\s+/g, ' ').slice(0, 140));

// De dagkaarten
const dagen = await page.locator('[data-dag]').count();
ok('er staan dagkaarten', dagen >= 30, String(dagen));
const vandaag = page.locator(`[data-dag="${TODAY}"]`);
ok('vandaag staat erbij', await vandaag.count() === 1);
ok('en staat open', await page.locator('[data-vandaag-let-op]').count() === 1,
  'de kaart van vandaag hoort uitgeklapt te beginnen');
const letop = await page.textContent('[data-vandaag-let-op]');
ok('met de waarschuwing dat Vandaag leidend is', /op Vandaag/.test(letop), letop);

// Een krachtdag heeft oefeningen
const krachtDagen = await page.locator('[data-dag-soort="kracht"]').count();
ok('er staan krachtdagen', krachtDagen >= 8, String(krachtDagen));

// De race zelf
const raceKaart = page.locator(`[data-dag="${RACE}"]`);
ok('de racedag staat erin', await raceKaart.count() === 1);
ok('en is als race gemarkeerd',
  await page.getAttribute(`[data-dag="${RACE}"]`, 'data-dag-soort') === 'race',
  String(await page.getAttribute(`[data-dag="${RACE}"]`, 'data-dag-soort')));

// Invullen: een waarde moet in het dagboek belanden
await vandaag.locator('[data-veld="stress_load"][data-waarde="1"]').click();
await page.waitForTimeout(900);
const opgeslagen = await page.evaluate((d) => {
  try { return JSON.parse(localStorage.getItem(`gc_log_${d}`) || '{}'); } catch { return {}; }
}, TODAY);
ok('een ingevuld veld komt in het dagboek van die dag',
  opgeslagen.stress_load === 1, JSON.stringify(opgeslagen).slice(0, 160));

// En de uitleg bij een veld is op te vragen
await vandaag.locator('text=Spanning vandaag').first().click();
await page.waitForTimeout(400);
const uitleg = await vandaag.textContent();
ok('bij een veld staat wat ermee gebeurt',
  /stressvolle dag|belasting/.test(uitleg), uitleg.replace(/\s+/g, ' ').slice(0, 200));

// ── Gewicht: doel instellen en de afweging zien ──────────────
await page.locator('[data-gewicht-doel]').fill('57');
await page.locator('[data-gewicht-doel]').blur();
await page.waitForTimeout(700);
const gew = await page.textContent('[data-gewicht]');
console.log(`  gewicht: ${gew.replace(/\s+/g, ' ').slice(0, 200)}`);
ok('het doelgewicht wordt bewaard', /doel 57 kg/.test(gew), gew.slice(0, 120));
ok('met de winst in seconden per kilometer',
  /seconden per kilometer/.test(gew), gew.replace(/\s+/g, ' ').slice(0, 220));
ok('en met wat het kost', /economie zakte/.test(gew));
ok('en het advies om het na elkaar te doen', /Ná elkaar/.test(gew));

await page.locator('[data-gewichtsfase="behoud"]').click();
await page.waitForTimeout(700);
ok('de gekozen fase staat in de app',
  await page.locator('[data-brandstof="behoud"]').count() === 1,
  'brandstofregel ontbreekt');

// ── Met terugwerkende kracht invullen ────────────────────────
await page.locator('[data-terugwerkend] >> text=Met terugwerkende kracht invullen').click();
await page.waitForTimeout(500);
ok('het invulpaneel gaat open',
  await page.getAttribute('[data-terugwerkend]', 'data-terugwerkend') === 'open');
ok('met zestig dagen in beeld',
  Number(await page.getAttribute('[data-terugwerkend-rijen]', 'data-terugwerkend-rijen')) === 60,
  String(await page.getAttribute('[data-terugwerkend-rijen]', 'data-terugwerkend-rijen')));
ok('en drie kolommen naast elkaar',
  await page.locator('[data-kolom]').count() === 3,
  String(await page.locator('[data-kolom]').count()));

// Twee verschillende metingen op dezelfde dag: ze mogen elkaar niet
// overschrijven of in elkaars kolom belanden — dat deed de vorige versie,
// die één metriek tegelijk toonde en de invoervelden hergebruikte.
const gisteren = addDays(TODAY, -1);
await page.locator(`[data-dag-invoer="hr_rest_${gisteren}"]`).fill('58');
await page.locator(`[data-dag-invoer="hr_rest_${gisteren}"]`).blur();
await page.waitForTimeout(700);
await page.locator(`[data-dag-invoer="weight_${gisteren}"]`).fill('61.2');
await page.locator(`[data-dag-invoer="weight_${gisteren}"]`).blur();
await page.waitForTimeout(900);
const terug = await page.evaluate((d) => {
  try { return JSON.parse(localStorage.getItem(`gc_log_${d}`) || '{}'); } catch { return {}; }
}, gisteren);
ok('de rusthartslag staat in het dagboek', terug.hr_rest === 58, JSON.stringify(terug));
ok('en het gewicht ernaast, niet eroverheen', terug.weight === 61.2, JSON.stringify(terug));
ok('de kolom gewicht toont geen hartslag',
  await page.inputValue(`[data-dag-invoer="weight_${gisteren}"]`) === '61.2',
  await page.inputValue(`[data-dag-invoer="weight_${gisteren}"]`));

// ── Dagen ruilen op het scherm ───────────────────────────────
// Twee dagen die werkelijk van soort verschillen — niet "morgen en
// overmorgen" op goed geluk. Staat hardlopen een paar dagen op slot
// (bijvoorbeeld na een zware week), dan zijn de eerstvolgende dagen
// allebei rust en test een vaste keuze niets. Welke twee dagen het zijn,
// doet er voor het ruilen niet toe; dát ze verschillen wel.
const dagSoorten = await page.evaluate(() => [...document.querySelectorAll('[data-dag]')]
  .map(el => ({ date: el.getAttribute('data-dag'),
    kind: el.getAttribute('data-dag-soort'),
    opSlot: el.getAttribute('data-dag-opslot') === '1' })));
// Dagen die door de poort op slot staan tellen niet mee: die tonen rust
// omdat lopen geblokkeerd is, niet omdat het weekpatroon dat zegt. Ruil je
// er een loopdag mee, dan blijven ze allebei staan waar ze stonden — en
// dat is juist gedrag, geen fout in het ruilen.
const toekomst = dagSoorten.filter(d => d.date > TODAY && !d.opSlot);
const morgen = (toekomst.find(d => d.kind === 'run') || toekomst[0]).date;
const voorKind = toekomst.find(d => d.date === morgen).kind;
const ander = toekomst.find(d => d.kind !== voorKind && d.kind !== 'race');
const overmorgen = ander?.date;
const voorKind2 = ander?.kind;
console.log(`      ruilen: ${morgen} (${voorKind}) ↔ ${overmorgen} (${voorKind2})`);
ok('de twee dagen verschillen van soort', !!overmorgen && voorKind !== voorKind2,
  `${morgen} ${voorKind} vs ${overmorgen} ${voorKind2}`);

await page.locator(`[data-dag="${morgen}"]`).first().click();   // uitklappen
await page.waitForTimeout(400);
await page.locator(`[data-ruil-knop="${morgen}"]`).click();
await page.waitForTimeout(400);
ok('er staan dagen om mee te ruilen',
  await page.locator('[data-ruil-keuzes]').count() === 1);
await page.locator(`[data-ruil-met="${overmorgen}"]`).first().click();
await page.waitForTimeout(800);

ok('de twee dagen hebben van soort gewisseld',
  await page.getAttribute(`[data-dag="${morgen}"]`, 'data-dag-soort') === voorKind2
  && await page.getAttribute(`[data-dag="${overmorgen}"]`, 'data-dag-soort') === voorKind,
  `${await page.getAttribute(`[data-dag="${morgen}"]`, 'data-dag-soort')} / `
  + `${await page.getAttribute(`[data-dag="${overmorgen}"]`, 'data-dag-soort')}`);
ok('en zijn gemarkeerd als geruild',
  await page.locator(`[data-geruild="${overmorgen}"]`).count() >= 1);
const bewaardeRuil = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('gc_plan_swaps') || '[]'); } catch { return []; }
});
ok('de ruil staat in de opslag', bewaardeRuil.length === 1, JSON.stringify(bewaardeRuil));

// Terugdraaien
await page.locator(`[data-dag="${morgen}"]`).first().click();
await page.waitForTimeout(300);
await page.locator(`[data-ruil-knop="${morgen}"]`).click();
await page.waitForTimeout(300);
await page.locator('[data-ruil-terug]').first().click();
await page.waitForTimeout(700);
ok('terugdraaien herstelt de oorspronkelijke dag',
  await page.getAttribute(`[data-dag="${morgen}"]`, 'data-dag-soort') === voorKind,
  String(await page.getAttribute(`[data-dag="${morgen}"]`, 'data-dag-soort')));

ok('geen JS-fout', errors.length === 0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
