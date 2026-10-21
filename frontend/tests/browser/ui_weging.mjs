// De weging en het advies, van het scherm afgelezen — met haar eigen geval:
// trager bij dezelfde hartslag, maar de wandelpauze werd korter.
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
function sessie({date,runMin,walkMin,reps,runPace,hr}){const laps=[];
for(let i=0;i<reps;i++){laps.push({distance:(runMin/runPace)*1000,moving_time:runMin*60,average_heartrate:hr,average_cadence:80});
if(i<reps-1)laps.push({distance:(walkMin/11.5)*1000,moving_time:walkMin*60,average_heartrate:hr-20,average_cadence:54});}
const km=laps.reduce((s,l)=>s+l.distance,0)/1000,min=laps.reduce((s,l)=>s+l.moving_time,0)/60;
return{id:`w_${date}`,date,activityType:'run',source:'strava',distance:+km.toFixed(2),duration:Math.round(min),averageHR:hr,laps,confirmedByUser:true};}
const runs=[];
for(let i=0;i<4;i++)runs.push(sessie({date:addDays(TODAY,-56+i*4),runMin:5,walkMin:2,reps:4,runPace:8.0,hr:130}));
for(let i=0;i<4;i++)runs.push(sessie({date:addDays(TODAY,-16+i*4),runMin:5,walkMin:1,reps:4,runPace:8.42,hr:130}));
const s={gc_onboarding_done:'1',gc_workouts:JSON.stringify([...runs].reverse()),
gc_hr_settings:JSON.stringify({easyLow:129,easyHigh:132,released:154,vt1:132,vt2:156}),
gc_auth_session:JSON.stringify({access_token:'t',refresh_token:'t',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,user:{id:'00000000-0000-0000-0000-000000000001',email:'t@t.nl',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}})};
for(let i=0;i<70;i++){const d=addDays(TODAY,-i);const log={date:d,energy:2,sleep_quality:2,sleep_hours:7.4,steps:7800,headache_severity:0,recovery_check:'good',training_recovery:0};
if(runs.some(r=>r.date===d))log.run_done=true; s[`gc_log_${d}`]=JSON.stringify(log);}
const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page=await b.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*supabase.co/**',r=>r.abort());
await page.addInitScript(([d])=>{for(const[k,v]of Object.entries(d))localStorage.setItem(k,v);},[s]);
console.log('\n████ De weging op het scherm ████\n');
await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForTimeout(1600);
const klik=async t=>page.evaluate(x=>{const re=new RegExp(`^${x}$`,'i');
const el=[...document.querySelectorAll('button,a,div,span')].find(e=>re.test(e.textContent.trim())&&e.offsetHeight>0);el?.click();return !!el;},t);
await klik('Progressie');await page.waitForTimeout(800);await klik('Run');await page.waitForTimeout(1000);

const niveau = await page.getAttribute('[data-economie-lezing]','data-economie-lezing').catch(()=>null);
ok('de lezing is "dichter", niet "achteruit"', niveau==='dichter', String(niveau));
const tekst = await page.evaluate(()=>document.body.innerText);
ok('het woord achteruit valt niet', !/loopeconomie gaat achteruit/i.test(tekst));
ok('de wandelpauze wordt met getallen genoemd',
  /wandelpauze tussen je blokken werd 60 seconden korter/.test(tekst), tekst.match(/wandelpauze[^.]{0,80}/)?.[0]);

const factoren = await page.evaluate(()=>[...document.querySelectorAll('[data-factor]')]
  .map(e=>({id:e.getAttribute('data-factor'),gewicht:e.getAttribute('data-gewicht')})));
ok('er staat een weging met meerdere factoren', factoren.length>=4, JSON.stringify(factoren));
ok('de vorm van de sessie weegt zwaar',
  factoren.some(f=>f.id==='vorm'&&f.gewicht==='groot'), JSON.stringify(factoren));
ok('en niet-vastgelegde factoren heten onbekend, niet nul',
  factoren.some(f=>f.gewicht==='onbekend'), JSON.stringify(factoren));

const advies = await page.getAttribute('[data-economie-advies]','data-economie-advies').catch(()=>null);
ok('er staat een advies met een uitspraak', advies==='verklaard_door_factoren', String(advies));
ok('het advies zegt dat dit geen vormverlies is', /geen vormverlies/.test(tekst));
ok('en noemt wat zij kan doen om het te toetsen',
  /wandelpauze één sessie terug op de oude lengte/.test(tekst));
const vorm = await page.textContent('[data-sessievorm]').catch(()=>null);
ok('de vorm staat met getallen op het scherm', /wandelpauze 2 → 1 min/.test(vorm||''), String(vorm));
ok('geen JS-fout', errors.length===0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(56)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(56)}`);
process.exit(fail?1:0);
