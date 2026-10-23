// De 75-dagenkaart in het echte scherm: starten, afvinken, en de boodschap.
import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4173/griette-coach/';
let pass=0,fail=0;
const ok=(n,c,e='')=>{if(c){pass++;console.log(`  ✓ ${n}`);}else{fail++;console.log(`  ✗ ${n}${e?' — '+String(e).slice(0,250):''}`);}};
const NL=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'});
const TODAY=NL.format(new Date());
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
const s={gc_onboarding_done:'1',
gc_auth_session:JSON.stringify({access_token:'t',refresh_token:'t',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,user:{id:'00000000-0000-0000-0000-000000000001',email:'t@t.nl',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}})};
for(let i=0;i<40;i++){const d=addDays(TODAY,-i);
s[`gc_log_${d}`]=JSON.stringify({date:d,energy:2,sleep_quality:2,sleep_hours:7.5,steps:8000,headache_severity:0,recovery_check:'good'});}
const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page=await b.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*supabase.co/**',r=>r.abort());
await page.addInitScript(([d])=>{for(const[k,v]of Object.entries(d))localStorage.setItem(k,v);},[s]);
console.log('\n████ 75 dagen op het scherm ████\n');
await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForTimeout(1600);
const klik=async t=>page.evaluate(x=>{const re=new RegExp(`^${x}$`,'i');
const el=[...document.querySelectorAll('button,a,div,span')].find(e=>re.test(e.textContent.trim())&&e.offsetHeight>0);el?.click();return !!el;},t);

await klik('Vandaag'); await page.waitForTimeout(900);
ok('de kaart staat op Vandaag',
  await page.locator('[data-challenge]').count() > 0, 'geen [data-challenge]');
ok('en nog niet gestart',
  await page.getAttribute('[data-challenge]','data-challenge') === 'niet-gestart',
  String(await page.getAttribute('[data-challenge]','data-challenge')));

await page.click('[data-challenge-start]'); await page.waitForTimeout(700);
ok('na starten staat hij op dag 1',
  await page.getAttribute('[data-challenge]','data-challenge-dag') === '1',
  String(await page.getAttribute('[data-challenge]','data-challenge-dag')));
const bericht = await page.textContent('[data-challenge-bericht]').catch(()=>null);
console.log(`  bericht: ${(bericht||'').slice(0,130)}`);
ok('met een bericht voor vandaag', !!bericht && bericht.length > 40, String(bericht));
ok('en de vraag om een foto',
  await page.getAttribute('[data-challenge-foto]','data-challenge-foto') === 'nee',
  String(await page.getAttribute('[data-challenge-foto]','data-challenge-foto')));

// De oefeningen
await page.click('text=De acht minuten'); await page.waitForTimeout(500);
const oef = await page.locator('[data-oefening]').count();
ok('zestien oefeningen met uitleg', oef === 16, String(oef));
const tekst = await page.evaluate(()=>document.body.innerText);
ok('de video staat erbij', /IEu57_V0OHI|hourglass/i.test(tekst) || /Victoria/i.test(tekst));
ok('met de waarschuwing dat de inhoud niet nagekeken is',
  /reconstructie|niet nagekeken/i.test(tekst), 'waarschuwing ontbreekt');
ok('en per oefening staat waar je het voelt', /Voel je in/i.test(tekst));

// Afvinken
await page.click('[data-challenge-circuit]'); await page.waitForTimeout(700);
ok('afgevinkt', await page.getAttribute('[data-challenge]','data-challenge') === 'gedaan',
  String(await page.getAttribute('[data-challenge]','data-challenge')));
const na = await page.textContent('[data-challenge-bericht]').catch(()=>null);
console.log(`  na afvinken: ${(na||'').slice(0,150)}`);
ok('het bericht verandert en legt uit wat er gebeurt',
  !!na && /zenuwstelsel|hersenen leren/.test(na), String(na).slice(0,160));
ok('en belooft niets zichtbaars op dag 1',
  /nog niet/.test(na||''), String(na).slice(0,200));

// De herstelversie is te vinden
await page.click('text=De herstelversie'); await page.waitForTimeout(400);
const t2 = await page.evaluate(()=>document.body.innerText);
ok('de herstelversie staat erbij', /rust op een rode dag is geen uitzondering/i.test(t2));

ok('geen JS-fout', errors.length===0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail?1:0);
