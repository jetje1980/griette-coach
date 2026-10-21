// Van het scherm afgelezen: staat er bij de trainingen dezelfde cyclusdag
// als in de Cyclus-tab? Zij schreef haar starts weg als platte datums.
import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4173/griette-coach/';
let pass=0,fail=0;
const ok=(n,c,e='')=>{if(c){pass++;console.log(`  ✓ ${n}`);}else{fail++;console.log(`  ✗ ${n}${e?' — '+String(e).slice(0,300):''}`);}};
const NL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam',
  year: 'numeric', month: '2-digit', day: '2-digit' });
// Dezelfde kalenderdag als de app: die rekent alles in Europe/Amsterdam.
// toISOString() geeft de UTC-datum en dat is 's avonds al de vorige dag —
// precies de fout waarvoor datetime.js bestaat, en die ik hier zelf maakte.
const TODAY = NL.format(new Date());
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
function runWalk(date,p,hr){const laps=[];for(let i=0;i<4;i++){laps.push({distance:(5/p)*1000,moving_time:300,average_heartrate:hr,average_cadence:80});
if(i<3)laps.push({distance:(2/11.5)*1000,moving_time:120,average_heartrate:hr-20,average_cadence:54});}
const km=laps.reduce((s,l)=>s+l.distance,0)/1000;
return{id:`w_${date}`,date,activityType:'run',source:'strava',distance:+km.toFixed(2),duration:26,averageHR:hr,laps,confirmedByUser:true};}
const runs=[];for(let i=0;i<6;i++)runs.push(runWalk(addDays(TODAY,-30+i*5),8.3,130));
// Precies zoals de app het wegschrijft: platte datumstrings in de historie en
// ruwe tekst in gc_cycle_start.
const cyclusStarts=[addDays(TODAY,-86),addDays(TODAY,-58),addDays(TODAY,-30),addDays(TODAY,-2)];
const s={gc_onboarding_done:'1',gc_workouts:JSON.stringify([...runs].reverse()),
gc_cycle_history:JSON.stringify(cyclusStarts), gc_cycle_start:cyclusStarts[cyclusStarts.length-1],
gc_hr_settings:JSON.stringify({easyLow:129,easyHigh:132,released:154,vt1:132,vt2:156}),
gc_auth_session:JSON.stringify({access_token:'t',refresh_token:'t',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,user:{id:'00000000-0000-0000-0000-000000000001',email:'t@t.nl',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}})};
for(let i=0;i<95;i++){const d=addDays(TODAY,-i);const log={date:d,energy:2,sleep_quality:2,sleep_hours:7.4,steps:7800,headache_severity:0,recovery_check:'good'};
if(runs.some(r=>r.date===d))log.run_done=true; s[`gc_log_${d}`]=JSON.stringify(log);}
const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page=await b.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*supabase.co/**',r=>r.abort());
await page.addInitScript(([d])=>{for(const[k,v]of Object.entries(d))localStorage.setItem(k,v);},[s]);
console.log('\n████ Dezelfde cyclusdag op elk scherm ████\n');
await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForTimeout(1600);
const klik=async t=>page.evaluate(x=>{const re=new RegExp(`^${x}$`,'i');
const el=[...document.querySelectorAll('button,a,div,span')].find(e=>re.test(e.textContent.trim())&&e.offsetHeight>0);el?.click();return !!el;},t);

// De Cyclus-tab
await klik('Lichaam');await page.waitForTimeout(800);await klik('Cyclus');await page.waitForTimeout(900);
const tabTekst = await page.evaluate(()=>document.body.innerText);
const alleDagen = tabTekst.match(/Cyclusdag \d+/g) || [];
console.log('  alle "Cyclusdag"-vermeldingen op de tab:', alleDagen.join(' | '));
console.log('  opslag gc_cycle_start:', await page.evaluate(()=>localStorage.getItem('gc_cycle_start')));
console.log('  vandaag volgens de app:', await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}));
const tabDag = (tabTekst.match(/Cyclusdag (\d+)/)||[])[1];
console.log(`  Cyclus-tab : cyclusdag ${tabDag || '(geen)'}`);
ok('de Cyclus-tab noemt een cyclusdag', !!tabDag, tabTekst.slice(0,120));
ok('en die is 3 (start twee dagen terug)', tabDag === '3', String(tabDag));

// De trainingen
await klik('Progressie');await page.waitForTimeout(800);await klik('Run');await page.waitForTimeout(1000);
const dagen = await page.evaluate(()=>[...document.querySelectorAll('[data-sessierij] [data-cyclusdag]')]
  .map(e=>e.textContent.trim()));
console.log(`  trainingen : ${dagen.join('  ·  ')}`);
ok('er staan sessierijen', dagen.length >= 3, String(dagen.length));
ok('geen enkele zegt "onbekend"', !dagen.some(t=>/onbekend/.test(t)), dagen.join(' | '));
ok('allemaal met een cyclusdag', dagen.every(t=>/cyclusdag \d+/.test(t)), dagen.join(' | '));

// En de weging gebruikt hem ook
const tekst = await page.evaluate(()=>document.body.innerText);
const cyclusFactor = await page.evaluate(()=>{
  const el=[...document.querySelectorAll('[data-factor]')].find(e=>e.getAttribute('data-factor')==='cyclus');
  return el ? el.getAttribute('data-gewicht') + ': ' + el.textContent.slice(0,120) : null;});
console.log(`  weging     : ${cyclusFactor || '(geen cyclusfactor)'}`);
ok('de cyclus is geen "onbekend" meer in de weging',
  cyclusFactor == null || !/^onbekend/.test(cyclusFactor), String(cyclusFactor));
ok('geen JS-fout', errors.length===0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(54)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(54)}`);
process.exit(fail?1:0);
