// Zorgen dat een nieuwe versie ook echt aankomt.
//
// Het probleem: de bundelnaam heeft een hash, dus zodra index.html vernieuwt
// laadt de nieuwe code vanzelf. Maar index.html zélf heeft geen hash. GitHub
// Pages serveert hem met een cache-header van tien minuten, en een Android-
// snelkoppeling op je beginscherm houdt hem in de praktijk veel langer vast.
//
// Gevolg: je opent de app, ziet de oude versie, en er is niets dat zegt dat
// er een nieuwe is. Precies wat er gebeurde met de galerijknop — die stond
// wél in productie, maar kwam niet op je telefoon aan.
//
// Deze plugin doet twee dingen:
//   1. schrijft version.json met een stempel van deze build;
//   2. zet dezelfde stempel in index.html, plus een klein script dat de twee
//      vergelijkt en één keer herlaadt als ze verschillen.

import { writeFileSync } from 'fs';
import { join } from 'path';

export function buildStamp() {
  const stamp = new Date().toISOString();
  let outDir = 'dist';
  let bundle = null;

  return {
    name: 'gc-build-stamp',
    apply: 'build',

    configResolved(config) { outDir = config.build.outDir; },

    generateBundle(_opts, bundleFiles) {
      bundle = Object.keys(bundleFiles).find(f => /^assets\/index-.*\.js$/.test(f)) || null;
    },

    transformIndexHtml(html) {
      return {
        html,
        tags: [
          { tag: 'meta', attrs: { name: 'gc-build', content: stamp }, injectTo: 'head' },
          {
            tag: 'script',
            children: versionCheck(stamp),
            injectTo: 'head',
          },
        ],
      };
    },

    closeBundle() {
      writeFileSync(join(outDir, 'version.json'),
        JSON.stringify({ build: stamp, bundle }, null, 2));
    },
  };
}

// Het script dat in de pagina komt te staan. Bewust klein, bewust inline, en
// bewust ná het laden: een versiecheck mag het opstarten nooit vertragen.
//
// De sessionStorage-vlag voorkomt een herlaadlus als version.json om wat voor
// reden dan ook niet klopt. Eén poging per sessie, meer niet.
function versionCheck(stamp) {
  return `
(function () {
  var HERE = ${JSON.stringify(stamp)};
  function check() {
    try {
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          if (!v || !v.build || v.build === HERE) return;
          if (sessionStorage.getItem('gc_reloaded_for') === v.build) return;
          sessionStorage.setItem('gc_reloaded_for', v.build);
          location.reload();
        })
        .catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === 'complete') setTimeout(check, 800);
  else window.addEventListener('load', function () { setTimeout(check, 800); });
  // En opnieuw kijken zodra je de app terugpakt uit de achtergrond — dat is
  // op een telefoon de meest voorkomende manier om hem te openen.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') check();
  });
})();
`.trim();
}
