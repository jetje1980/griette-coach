// Haar eigen verlangens als bron voor mini-momenten.
//
// `gc_aliveness_list` werd opgeslagen en vervolgens alleen teruggetoond. Dat is
// zonde: dat lijstje is het enige in de app dat zij zelf heeft geschreven over
// wat haar levend maakt, en het was precies de bron die de voorstellen
// persoonlijk had kunnen maken.
//
// ─────────────────────────────────────────────────────────────────
// DE VERTAALREGEL
//
// Een verlangen is geen taak. "Zwemmen in open water" mag nooit "ga zwemmen"
// worden — dat is geen mini-moment maar een opdracht die vandaag waarschijnlijk
// niet kan, en die op een slechte dag ronduit wrang is.
//
// Wat wél kan is de miniatuur: het kleinste stukje dat vandaag past en dat
// echt naar dat verlangen ruikt. Klaarleggen. Kiezen waar. Vijf minuten van de
// sfeer opzoeken. Dat is geen afleidingstruc en geen kinderachtig substituut;
// het is de eerste vierkante centimeter van iets dat ze wil.
//
// Twee dingen die dit bewust NIET doet:
//   · geen enthousiaste vertaling die het verlangen kleiner maakt dan het is
//     ("even in bad, net zo fijn als de zee!");
//   · geen fysieke variant op een dag waarop het lichaam dat niet toestaat.
//     De kosten hieronder zijn met opzet laag; de kostenfilter in aliveness.js
//     doet de rest.
// ─────────────────────────────────────────────────────────────────

// De sleutel wordt hier rechtstreeks gelezen en niet via aliveness.js
// geïmporteerd: dat bestand importeert dit bestand, en een kringetje tussen die
// twee is het soort afhankelijkheid dat later stil breekt.
const ALIVE_KEY = 'gc_aliveness_list';

function loadAlivenessList() {
  try {
    const a = JSON.parse(localStorage.getItem(ALIVE_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

// Per categorie een paar vormen. Elke vorm krijgt een toestand, een tag en een
// prijs, zodat hij door dezelfde poort moet als elk bibliotheekitem.
//
// `mini` krijgt de tekst van haar verlangen letterlijk mee. Dat is met opzet:
// haar woorden lezen anders dan de mijne, ook als de zin eromheen van mij is.
const VORMEN = {
  water: [
    { key: 'prep', state: 'FREE', tag: 'water', cost: 'none', minutes: 5,
      mini: (t) => `Leg klaar wat je nodig hebt voor ${lower(t)} en kies één plek waar je deze week het water in wilt. Verder niets.` },
    { key: 'sense', state: 'BEAUTIFUL', tag: 'water', cost: 'none', minutes: 5,
      mini: (t) => `Zoek één foto of geluid op van ${lower(t)} en blijf er vijf minuten bij. Ogen dicht mag.` },
  ],
  movement: [
    { key: 'prep', state: 'FREE', tag: 'beweging', cost: 'none', minutes: 5,
      mini: (t) => `Zet klaar wat je nodig hebt voor ${lower(t)} en schrijf op welke dag deze week het past.` },
    { key: 'small', state: 'ENERGIZE', tag: 'beweging', cost: 'medium', minutes: 5,
      mini: (t) => `Doe vijf minuten het kleinste stukje van ${lower(t)} — niet de hele versie, alleen het begin.` },
  ],
  music: [
    { key: 'play', state: 'ENERGIZE', tag: 'muziek', cost: 'low', minutes: 5,
      mini: (t) => `${cap(t)} — zet het nu aan, één nummer lang, en doe verder niets anders.` },
    { key: 'list', state: 'CREATE', tag: 'muziek', cost: 'none', minutes: 5,
      mini: (t) => `Maak een lijstje van drie nummers die horen bij ${lower(t)}. Alleen de titels.` },
  ],
  beauty: [
    { key: 'one', state: 'BEAUTIFUL', tag: 'schoonheid', cost: 'none', minutes: 5,
      mini: (t) => `Zoek in huis één ding op dat past bij ${lower(t)} en zet het waar je het ziet.` },
  ],
  immersion: [
    { key: 'five', state: 'ESCAPE', tag: 'opgaan', cost: 'none', minutes: 5,
      mini: (t) => `Vijf minuten ${lower(t)}, en dan mag je stoppen. Zet er desnoods een wekker bij.` },
  ],
  creation: [
    { key: 'start', state: 'CREATE', tag: 'maken', cost: 'low', minutes: 5,
      mini: (t) => `Begin vijf minuten aan ${lower(t)} zonder dat het af hoeft. Het mag lelijk zijn.` },
  ],
  solitude: [
    { key: 'claim', state: 'GROUND', tag: 'alleen', cost: 'none', minutes: 5,
      mini: (t) => `Neem vijf minuten voor ${lower(t)}. Deur dicht, telefoon weg.` },
  ],
  novelty: [
    { key: 'pick', state: 'FREE', tag: 'nieuw', cost: 'none', minutes: 5,
      mini: (t) => `Kies één concrete plek of dag voor ${lower(t)} en zet hem in je agenda. Meer niet.` },
  ],
  play: [
    { key: 'do', state: 'PLAY', tag: 'spelen', cost: 'low', minutes: 5,
      mini: (t) => `Doe vijf minuten ${lower(t)}, precies zoals het in je opkwam toen je het opschreef.` },
  ],
  resonance: [
    { key: 'return', state: 'RECEIVE', tag: 'resonantie', cost: 'none', minutes: 5,
      mini: (t) => `Ga vijf minuten terug naar ${lower(t)} — in je hoofd, in een foto, in muziek.` },
  ],
  intimacy: [
    { key: 'reach', state: 'CONNECT', tag: 'nabijheid', cost: 'low', minutes: 5,
      mini: (t) => `Stuur één bericht aan wie hoort bij ${lower(t)}. Eén zin is genoeg.` },
  ],
  contribution: [
    { key: 'one', state: 'CONNECT', tag: 'bijdragen', cost: 'low', minutes: 5,
      mini: (t) => `Doe het kleinste stukje van ${lower(t)} dat vandaag past. Eén ding.` },
  ],
};

function lower(t) {
  const s = String(t || '').trim();
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : 'wat je opschreef';
}
function cap(t) {
  const s = String(t || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Je muziek';
}

// De kandidaten uit haar eigen lijst, in hetzelfde formaat als de bibliotheek.
// `place: ['home', 'away']` waar de vorm dat toelaat — voorbereiden en kiezen
// kan overal; iets aanzetten of doen niet.
export function personalCandidates() {
  const lijst = loadAlivenessList();
  const uit = [];

  for (const item of lijst) {
    const vormen = VORMEN[item.category] || VORMEN.play;
    for (const v of vormen) {
      uit.push({
        id: `al_${item.id}_${v.key}`,
        state: v.state,
        minutes: v.minutes,
        cost: v.cost,
        place: v.cost === 'none' ? ['home', 'away'] : ['home'],
        tag: v.tag,
        source: 'aliveness_item',
        sourceItemId: item.id,
        // Een terugkerend verlangen weegt zwaarder: dat is iets wat blijft
        // kloppen, geen inval van één avond.
        recurring: !!item.recurring,
        text: () => v.mini(item.text),
      });
    }
  }
  return uit;
}


// ── 1% Future Self ──────────────────────────────────────────────
// Een eigen bron, en dat is het punt.
//
// De eerste versie gaf deze knop dezelfde kandidaten als "vijf minuten van je
// droomleven", met een ander etiket erboven. Dat viel op in de test: beide
// knoppen leverden precies dezelfde toestanden op. En terecht — het was
// dezelfde vraag.
//
// Maar het zijn twee verschillende vragen. Droomleven gaat over hoe je wilt
// dat het vóélt. Dit gaat over wie je wilt zijn: welk gedrag hoort bij de
// versie van jou die je aan het worden bent. Dat is geen ontspanning maar een
// kleine identiteitsbevestiging, en die komt uit wat je zelf hebt vastgelegd —
// je seizoensfocus en je actieve doelen.
const EXEC_FOCUS_KEY = 'gc_executive_focus';
const GOALS_KEY = 'gc_goals';

function leesJson(key, terug) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? terug;
  } catch { return terug; }
}

// De vormen zijn bewust gedragsmatig: doen, kiezen, weigeren, vastleggen.
// Niets om bij te ontspannen — dat is de andere knop.
// De zinnen zijn zo gebouwd dat ze lopen of `w` nu een seizoensfocus is
// ("iemand die haar lichaam serieus neemt") of een doelnaam ("Bereloop 10 km").
// Vandaar dat de focus als citaat achteraan staat en niet middenin de zin —
// anders krijg je "de versie van jou die iemand die haar lichaam serieus
// neemt", en dat leest als een fout in plaats van als een coach.
const IDENTITEIT = [
  { key: 'focus_one', state: 'STRONG', tag: 'identiteit', cost: 'low', minutes: 10,
    mini: (w) => `Je richt je nu op: ${lower(w)}. Wat zou die versie van jou vandaag vijf minuten doen? Doe precies dat ene.` },
  { key: 'focus_guard', state: 'FREE', tag: 'grens', cost: 'none', minutes: 5,
    mini: (w) => `Zeg vandaag één ding af dat niets te maken heeft met: ${lower(w)}. Zonder uitleg.` },
  { key: 'goal_step', state: 'CREATE', tag: 'doel', cost: 'low', minutes: 10,
    mini: (w) => `Zet het kleinste zichtbare stapje richting: ${lower(w)}. Iets wat je morgen terugziet.` },
  { key: 'goal_evidence', state: 'STRONG', tag: 'bewijs', cost: 'none', minutes: 5,
    mini: (w) => `Schrijf één zin op die bewijst dat dit al aan het gebeuren is: ${lower(w)}. Eén zin, geen lijst.` },
];

// Waar de identiteit vandaan komt: je seizoensfocus eerst, dan je doelen.
function identiteitsbronnen() {
  const uit = [];
  const exec = leesJson(EXEC_FOCUS_KEY, null);
  if (exec?.primaryFocus) uit.push({ id: 'focus', woorden: exec.primaryFocus });
  else if (exec?.seasonName) uit.push({ id: 'season', woorden: exec.seasonName });

  const goals = leesJson(GOALS_KEY, []);
  if (Array.isArray(goals)) {
    for (const g of goals.filter(x => x?.enabled !== false && x?.name).slice(0, 3)) {
      uit.push({ id: `goal_${g.id}`, woorden: g.name });
    }
  }
  return uit;
}

export function futureSelfCandidates() {
  const bronnen = identiteitsbronnen();
  // Zonder seizoensfocus en zonder doelen is er niets persoonlijks te zeggen.
  // Dan blijft deze knop leeg en valt hij terug op de bibliotheek — beter dan
  // een verzonnen identiteit.
  if (!bronnen.length) return [];

  const uit = [];
  for (const b of bronnen) {
    for (const v of IDENTITEIT) {
      uit.push({
        id: `fs_${b.id}_${v.key}`,
        state: v.state,
        minutes: v.minutes,
        cost: v.cost,
        place: v.cost === 'none' ? ['home', 'away'] : ['home'],
        tag: v.tag,
        source: 'aliveness_item',
        futureSelf: true,
        text: () => v.mini(b.woorden),
      });
    }
  }
  return uit;
}
