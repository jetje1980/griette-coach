// De videolijst bij kracht: beheerbaar, en geen willekeurige links.
import { loadCoreVideos, addCoreVideo, removeCoreVideo, restoreCoreVideos,
  videoUrlIsOk, removedCount } from '../../src/coreVideoStore.js';
import { CORE_VIDEOS, videosForMinutes, VIDEO_SOURCE_NOTE } from '../../src/data/coreVideos.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${e ? ' — ' + String(e).slice(0, 200) : ''}`); }
};
const S = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 48 - t.length))}`);

let mem = {};
function store(seed = {}) {
  mem = { ...seed };
  globalThis.localStorage = {
    get length() { return Object.keys(mem).length; },
    key: i => Object.keys(mem)[i] ?? null,
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
  };
  globalThis.sessionStorage = globalThis.localStorage;
}

console.log('\n████ Video\'s bij kracht ████');

S('1 · De startlijst');
{
  store();
  const v = loadCoreVideos();
  ok('er staan video\'s in', v.length >= 5, String(v.length));
  ok('elke video heeft een titel en een https-link',
    v.every(x => x.title && /^https:\/\//.test(x.url)),
    v.filter(x => !x.title || !/^https:\/\//.test(x.url)).map(x => x.id).join(','));
  ok('alleen YouTube of Vimeo', v.every(x => videoUrlIsOk(x.url)),
    v.filter(x => !videoUrlIsOk(x.url)).map(x => x.url).join(' '));
  ok('geen dubbele links', new Set(v.map(x => x.url)).size === v.length);
  ok('de herkomst staat erbij dat ze niet nagekeken zijn',
    /niet nagekeken/.test(VIDEO_SOURCE_NOTE), VIDEO_SOURCE_NOTE);
}

S('2 · Filteren op de tijd die je hebt');
{
  const kort = videosForMinutes(10);
  ok('bij tien minuten vallen de lange eruit',
    kort.every(v => v.minutes == null || v.minutes <= 10),
    kort.map(v => `${v.id}:${v.minutes}`).join(' '));
  ok('en een onbekende duur blijft staan — onbekend is geen uitsluiting',
    kort.some(v => v.minutes == null));
}

S('3 · Eigen links toevoegen');
{
  store();
  const r = addCoreVideo({ title: 'Mijn core', url: 'https://www.youtube.com/watch?v=abc123',
    minutes: 12, note: 'rustig' });
  ok('een YouTube-link wordt opgeslagen', r.ok, r.reason);
  ok('en staat in de lijst', loadCoreVideos().some(v => v.title === 'Mijn core'));
  ok('met de bron "eigen"',
    loadCoreVideos().find(v => v.title === 'Mijn core')?.source === 'eigen');

  const twee = addCoreVideo({ title: 'Nog eens', url: 'https://www.youtube.com/watch?v=abc123' });
  ok('dezelfde link kan niet twee keer', !twee.ok, JSON.stringify(twee));

  const raar = addCoreVideo({ title: 'Iets anders', url: 'https://ergensanders.nl/video' });
  ok('een willekeurige site wordt geweigerd', !raar.ok, JSON.stringify(raar));
  ok('met een reden die zegt wat wel mag', /YouTube|Vimeo/.test(raar.reason || ''), raar.reason);

  const http = addCoreVideo({ title: 'Onveilig', url: 'http://www.youtube.com/watch?v=x' });
  ok('http zonder s wordt geweigerd', !http.ok, JSON.stringify(http));

  const leeg = addCoreVideo({ title: '', url: 'https://youtu.be/xyz987' });
  ok('zonder titel krijgt hij een nette naam', leeg.ok
    && loadCoreVideos().some(v => v.title === 'Eigen video'), JSON.stringify(leeg));
}

S('4 · Verwijderen, en het blijft verwijderd');
{
  store();
  const eerste = CORE_VIDEOS[0].id;
  removeCoreVideo(eerste);
  ok('de video is uit de lijst', !loadCoreVideos().some(v => v.id === eerste));
  ok('en dat is vastgelegd', removedCount() === 1, String(removedCount()));
  // Opnieuw laden (zoals na een update van de app) mag hem niet terugbrengen.
  ok('na herladen komt hij niet terug',
    !loadCoreVideos().some(v => v.id === eerste));
  restoreCoreVideos();
  ok('terughalen werkt wel als zij dat vraagt',
    loadCoreVideos().some(v => v.id === eerste));
}

S('5 · Een eigen video verwijderen raakt de startlijst niet');
{
  store();
  addCoreVideo({ title: 'Tijdelijk', url: 'https://vimeo.com/123456' });
  const voor = loadCoreVideos().length;
  const eigen = loadCoreVideos().find(v => v.title === 'Tijdelijk');
  removeCoreVideo(eigen.id);
  ok('alleen die ene is weg', loadCoreVideos().length === voor - 1, String(loadCoreVideos().length));
  ok('en er is niets als verwijderd gemarkeerd', removedCount() === 0, String(removedCount()));
}

S('6 · Kapotte opslag levert gewoon de startlijst');
{
  store({ gc_core_videos: 'dit is geen json' });
  ok('geen crash, wel de lijst', loadCoreVideos().length === CORE_VIDEOS.length,
    String(loadCoreVideos().length));
}

console.log(`\n${'█'.repeat(52)}\n  ${pass} geslaagd, ${fail} mislukt\n${'█'.repeat(52)}`);
process.exit(fail ? 1 : 0);
