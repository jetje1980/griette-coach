// De testrunner. `npm test` draait hier alles langs.
//
// ─────────────────────────────────────────────────────────────────
// WAAROM DIT BESTAND BESTAAT
//
// Alle testsuites van deze app zijn maandenlang buiten de repo geschreven,
// in een tijdelijke map. Ze deden hun werk — ze hebben een app-brede crash
// gevonden, twee motoren die elkaar tegenspraken, een leeg gelezen
// leerlaag, een taperadvies van 25 minuten doorlopend voor iemand met
// blokken van vijf — maar ze verdwenen met de sessie waarin ze gemaakt
// waren. Een test die niet in de repo staat, bestaat de volgende keer niet.
//
// Hier staan ze nu wel, met twee soorten:
//
//   tests/node/     rekenlogica, gebundeld met esbuild en in node gedraaid
//                   tegen een nagemaakte localStorage
//   tests/browser/  de echte app in Chromium, met gevulde opslag — de enige
//                   soort die ziet of een scherm daadwerkelijk opkomt
//
// De browsersuites hebben een gebouwde app nodig die op poort 4173 staat
// (`npm run build` en dan een statische server op dist/), plus Playwright.
// Ontbreekt een van de twee, dan slaat de runner ze over en zegt dat — hij
// doet niet alsof alles groen is.
// ─────────────────────────────────────────────────────────────────

import { readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hier = dirname(fileURLToPath(import.meta.url));
const alleenNode = process.argv.includes('--node');
const alleenBrowser = process.argv.includes('--browser');
const filter = process.argv.find(a => a.startsWith('--only='))?.slice(7) || null;

const BASIS_URL = process.env.TEST_URL || 'http://127.0.0.1:4173/griette-coach/';

function node(cmd, args, opties = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', cwd: hier, ...opties });
}

// ── Draaien de node-suites? ─────────────────────────────────────
function draaiNode() {
  const bestanden = readdirSync(join(hier, 'node')).filter(f => f.endsWith('.js'))
    .filter(f => !filter || f.includes(filter)).sort();
  const uit = [];
  for (const f of bestanden) {
    const bron = join(hier, 'node', f);
    const bundel = join(hier, 'node', f.replace(/\.js$/, '.bundle.mjs'));
    const b = node('node', [join(hier, 'tools', 'bundle.mjs'), bron, bundel]);
    if (b.status !== 0) {
      uit.push({ naam: f, ok: false, reden: 'bundelen mislukt', log: b.stderr?.slice(-600) });
      continue;
    }
    const r = node('node', [bundel]);
    const regel = (r.stdout || '').split('\n').reverse()
      .find(l => /geslaagd/.test(l)) || '';
    uit.push({ naam: f, ok: r.status === 0, samenvatting: regel.trim(),
      log: r.status === 0 ? null : (r.stdout || '').split('\n').filter(l => l.includes('✗')).join('\n') });
  }
  return uit;
}

// ── Draaien de browsersuites? ───────────────────────────────────
async function bereikbaar(url) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2500);
    const r = await fetch(url, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

async function draaiBrowser() {
  const map = join(hier, 'browser');
  const bestanden = readdirSync(map).filter(f => f.endsWith('.mjs'))
    .filter(f => !filter || f.includes(filter)).sort();

  let playwright = true;
  try { await import('playwright'); } catch { playwright = false; }
  if (!playwright) {
    return bestanden.map(f => ({ naam: f, overgeslagen: true,
      reden: 'playwright niet geïnstalleerd (npm i -D playwright)' }));
  }
  if (!await bereikbaar(BASIS_URL)) {
    return bestanden.map(f => ({ naam: f, overgeslagen: true,
      reden: `geen app op ${BASIS_URL} — bouw met "npm run build" en serveer dist/ op poort 4173` }));
  }

  const uit = [];
  for (const f of bestanden) {
    const r = node('node', [join(map, f)]);
    const regel = (r.stdout || '').split('\n').reverse()
      .find(l => /geslaagd/.test(l)) || '';
    uit.push({ naam: f, ok: r.status === 0, samenvatting: regel.trim(),
      log: r.status === 0 ? null : (r.stdout || r.stderr || '').split('\n')
        .filter(l => l.includes('✗') || l.includes('Error')).slice(0, 8).join('\n') });
  }
  return uit;
}

// ── Verslag ─────────────────────────────────────────────────────
function rapport(titel, rijen) {
  if (!rijen.length) return { mislukt: 0, overgeslagen: 0 };
  console.log(`\n── ${titel} ${'─'.repeat(Math.max(0, 52 - titel.length))}`);
  let mislukt = 0, overgeslagen = 0;
  for (const r of rijen) {
    if (r.overgeslagen) {
      overgeslagen++;
      console.log(`  ⊘ ${r.naam.padEnd(18)} overgeslagen — ${r.reden}`);
      continue;
    }
    if (r.ok) {
      console.log(`  ✓ ${r.naam.padEnd(18)} ${r.samenvatting || ''}`);
    } else {
      mislukt++;
      console.log(`  ✗ ${r.naam.padEnd(18)} ${r.samenvatting || r.reden || ''}`);
      if (r.log) console.log(r.log.split('\n').map(l => `      ${l}`).join('\n'));
    }
  }
  return { mislukt, overgeslagen };
}

console.log('\n████ Testsuite griette-coach ████');

let mislukt = 0, overgeslagen = 0;
if (!alleenBrowser) {
  const r = rapport('Rekenlogica (node)', draaiNode());
  mislukt += r.mislukt; overgeslagen += r.overgeslagen;
}
if (!alleenNode) {
  const r = rapport('De app in de browser', await draaiBrowser());
  mislukt += r.mislukt; overgeslagen += r.overgeslagen;
}

console.log(`\n${'█'.repeat(56)}`);
console.log(`  ${mislukt === 0 ? 'alles groen' : `${mislukt} suite(s) mislukt`}`
  + (overgeslagen ? ` · ${overgeslagen} overgeslagen` : ''));
console.log('█'.repeat(56) + '\n');
process.exit(mislukt ? 1 : 0);
