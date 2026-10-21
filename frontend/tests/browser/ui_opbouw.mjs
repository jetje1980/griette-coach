// Van het scherm afgelezen: zegt de app nog dat zij het niet verdraagt, en
// welke as staat er? Haar situatie: alles goed verdragen, ritme 3-4 dagen.
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
function sessie(date,runMin,walkMin,reps){const laps=[];const hr=130,p=8.2;
for(let i=0;i<reps;i++){laps.push({distance:(runMin/p)*1000,moving_time:runMin*60,average_heartrate:hr,average_cadence:80});
if(i<reps-1)laps.push({distance:(walkMin/11.5)*1000,moving_time:walkMin*60,average_heartrate:hr-20,average_cadence:54});}
const km=laps.reduce((s,l)=>s+l.distance,0)/1000,min=laps.reduce((s,l)=>s+l.moving_time,0)/60;
return{id:`w_${date}`,date,activityType:'run',source:'strava',distance:+km.toFixed(2),duration:Math.round(min),averageHR:hr,laps,confirmedByUser:true};}
const runs=[];for(let i=9;i>=0;i--)runs.push(sessie(addDays(TODAY,-(i*3+1)),5,2,4));
// Een eigen racedoel, ruim weg. Anders schuift deze test mee met de
// kalender: staat er een race binnen tien dagen, dan is de fase TAPER en
// groeit er terecht niets. De taperfase heeft zijn eigen test hieronder.
const RACE = addDays(TODAY, 120);
const s={gc_onboarding_done:'1',gc_workouts:JSON.stringify([...runs].reverse()),
gc_race_goals:JSON.stringify([{id:'test10k',name:'Testrace 10 km',distanceKm:10,
  targetTimeSec:65*60,date:RACE,type:'TARGET',priority:1,enabled:true,terrain:'road'}]),
gc_cycle_start:addDays(TODAY,-6),
gc_hr_settings:JSON.stringify({easyLow:129,easyHigh:132,released:154,vt1:132,vt2:156}),
gc_auth_session:JSON.stringify({access_token:'t',refresh_token:'t',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,user:{id:'00000000-0000-0000-0000-000000000001',email:'t@t.nl',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}})};
for(let i=0;i<80;i++){const d=addDays(TODAY,-i);const log={date:d,energy:2,sleep_quality:2,sleep_hours:7.5,steps:8000,
headache_severity:0,recovery_check:'good',training_recovery:0,muscle_type:'none'};
if(runs.some(r=>r.date===d))log.run_done=true; s[`gc_log_${d}`]=JSON.stringify(log);}
const b=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
const page=await b.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*supabase.co/**',r=>r.abort());
await page.addInitScript(([d])=>{for(const[k,v]of Object.entries(d))localStorage.setItem(k,v);},[s]);
console.log('\n████ Opbouw op het scherm ████\n');
await page.goto(BASE,{waitUntil:'networkidle'});await page.waitForTimeout(1600);
const klik=async t=>page.evaluate(x=>{const re=new RegExp(`^${x}$`,'i');
const el=[...document.querySelectorAll('button,a,div,span')].find(e=>re.test(e.textContent.trim())&&e.offsetHeight>0);el?.click();return !!el;},t);
await klik('Progressie');await page.waitForTimeout(800);await klik('Run');await page.waitForTimeout(1100);

const vorm = await page.textContent('[data-volgende-loop]').catch(()=>null);
const as = await page.textContent('[data-as]').catch(()=>null);
const rijp = await page.textContent('[data-rijpheid]').catch(()=>null);
console.log(`  sessie   : ${vorm}`);
console.log(`  as       : ${(as||'').slice(0,140)}`);
console.log(`  rijpheid : ${rijp}`);

ok('er staat een sessie', !!vorm, String(vorm));
ok('met langere blokken dan vijf minuten', /^([6-9]|1\d) min lopen/.test((vorm||'').trim()), String(vorm));
ok('en een ruime wandelpauze (geen 1 min)', !/\/ 1 min wandelen/.test(vorm||''), String(vorm));
ok('de as staat erbij', /langere blokken/.test(as||''), String(as));
ok('met hoeveel van de doelduur je blok dekt', /\d+% van/.test(as||''), String(as));
ok('de opbouwstatus zegt niet "0 van 2"', !/0 van \d/.test(rijp||''), String(rijp));
ok('maar dat de stap verdiend is', /verdiend/.test(rijp||''), String(rijp));
// ── Taperweek: minder van wat ze al doet, niet iets zwaarders ──
// Deze vormen stonden op niveau 0 ("op elk niveau bruikbaar") en kwamen
// daardoor voor iedereen in aanmerking — ook "25 min doorlopend" voor
// iemand met blokken van vijf minuten, in de week voor een race.
// Een tweede init-script, want bij een reload loopt het eerste opnieuw en
// zet het de oude race terug. Later toegevoegde scripts draaien later, dus
// deze wint.
await page.addInitScript((race) => {
  localStorage.setItem('gc_race_goals', JSON.stringify([{ id: 'soon', name: 'Race bijna',
    distanceKm: 10, targetTimeSec: 65 * 60, date: race, type: 'TARGET', priority: 1,
    enabled: true, terrain: 'road' }]));
}, addDays(TODAY, 5));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await klik('Progressie');await page.waitForTimeout(800);await klik('Run');await page.waitForTimeout(1100);
const taperVorm = await page.textContent('[data-volgende-loop]').catch(()=>null);
const taperAs = await page.textContent('[data-as]').catch(()=>null);
console.log(`\n  taper    : ${taperVorm}`);
console.log(`  as       : ${(taperAs||'').slice(0,120)}`);
ok('in de taper staat een sessie', !!taperVorm, String(taperVorm));
ok('en die is niet langer doorlopend dan ze kan',
  !/^(1[0-9]|2[0-9]|[3-9][0-9]) min doorlopend/.test((taperVorm||'').trim()), String(taperVorm));
ok('de as zegt dat er niets groeit', /niets/.test(taperAs||''), String(taperAs));

ok('geen JS-fout', errors.length===0, errors.join(' | '));
await b.close();
console.log(`\n${'█'.repeat(54)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(54)}`);
process.exit(fail?1:0);
