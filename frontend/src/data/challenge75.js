// De 75-dagenuitdaging: elke dag acht minuten, en wat er werkelijk verandert.
//
// ─────────────────────────────────────────────────────────────────
// EERST DE EERLIJKHEID OVER DE OEFENINGEN
//
// Zij koos deze video als dagelijkse basis:
//
//   VICTORIA'S SECRET FULL BODY WORKOUT // 8MIN HOURGLASS BODY WORKOUT
//   https://youtu.be/IEu57_V0OHI
//
// Ik heb die video niet kunnen bekijken — youtube.com is vanuit de omgeving
// waarin deze app wordt gebouwd niet bereikbaar, en de oefeningen staan
// nergens beschreven die ik wél kan bereiken. De titel heb ik kunnen
// bevestigen, de inhoud niet.
//
// Daarom staat hieronder NIET "de oefeningen uit de video". Het is een
// reconstructie: een volwaardig achtminutencircuit dat past bij wat die
// titel belooft, door mij opgezet, met de uitvoering en de reden per
// oefening erbij. Zestien blokken van dertig seconden zonder pauze — de
// gangbare vorm voor zo'n video.
//
// Zij kijkt de video één keer en vervangt wat afwijkt; dat kan per oefening
// in de app. Verzinnen wat erin zit en het "de video" noemen zou betekenen
// dat ze traint op iets dat ik heb bedacht terwijl ze denkt dat het van de
// video komt. Dat is precies het soort stille aanname waar deze app niet
// aan mee hoort te doen.
//
// ─────────────────────────────────────────────────────────────────
// EN DE EERLIJKHEID OVER "ELKE DAG, 75 DAGEN"
//
// Acht minuten lichaamsgewicht is licht; dagelijks is daarvoor goed te
// verdedigen. Maar deze app is gebouwd rond rustdagen en PEM-bescherming,
// en een reeks die "elke dag, hoe dan ook" eist, leert je je lichaam te
// overrulen. Dat is precies het patroon van 2024–2025.
//
// Daarom geldt in deze uitdaging één regel die hem eerlijk houdt:
//
//   Een rode dag telt mee als je de herstelversie doet.
//
// Hersteldag? Dan vijf minuten mobiliteit in plaats van het circuit, en de
// dag is afgevinkt. Niet "gemist", niet "streak kwijt". Zo meet de reeks
// trouw aan jezelf in plaats van trouw aan een vinkje.
// ─────────────────────────────────────────────────────────────────

export const CHALLENGE = {
  id: 'vs75',
  name: '75 dagen · acht minuten per dag',
  days: 75,
  videoUrl: 'https://youtu.be/IEu57_V0OHI',
  videoTitle: "Victoria's Secret full body workout — 8 min hourglass",
  videoNote: 'Titel bevestigd, inhoud niet nagekeken: YouTube was niet bereikbaar '
    + 'vanuit de bouwomgeving. De oefeningen hieronder zijn mijn reconstructie — '
    + 'kijk de video één keer en pas aan wat afwijkt.',
};

// ── Het circuit ─────────────────────────────────────────────────
//
// Zestien blokken van 30 seconden, zonder pauze. Opbouw: benen en billen
// eerst (grootste spiergroepen, dus daar begint je hartslag), dan romp, dan
// schouders en rug, en af met iets rustigs.
//
// `seconds` is de werktijd. `cue` is wat je doet, `why` waarom het erin
// staat, en `felt` waar je het hoort te voelen — dat laatste is de
// goedkoopste manier om te merken of je het goed doet.
export const CIRCUIT = [
  { id: 'c1', name: 'Squats', seconds: 30,
    cue: 'Voeten op heupbreedte, gewicht op je hielen, knieën naar buiten. Zak tot je bovenbenen bijna horizontaal zijn.',
    why: 'Grootste spiergroep van je lichaam. Dit is de motor van het hele circuit.',
    felt: 'voorkant bovenbenen en billen' },
  { id: 'c2', name: 'Glute bridge', seconds: 30,
    cue: 'Op je rug, voeten dicht bij je billen. Duw je heupen omhoog tot je lichaam één lijn is, knijp bovenin één seconde aan.',
    why: 'Billen zonder je onderrug te belasten — en bilspieren dragen je loopblokken.',
    felt: 'billen, niet je onderrug' },
  { id: 'c3', name: 'Lunges wisselend', seconds: 30,
    cue: 'Stap naar voren, achterste knie naar de grond, voorste knie boven je enkel. Wissel elke stap.',
    why: 'Eenbenig. Hardlopen is eenbenig werk, dus dit telt dubbel voor jou.',
    felt: 'voorste bovenbeen en bil' },
  { id: 'c4', name: 'Donkey kicks links', seconds: 30,
    cue: 'Op handen en knieën, rug vlak. Duw één hiel naar het plafond zonder je rug te hollen.',
    why: 'Isoleert de bil zonder gewicht.',
    felt: 'bovenkant bil' },
  { id: 'c5', name: 'Donkey kicks rechts', seconds: 30,
    cue: 'Zelfde oefening, andere kant: op handen en knieën, hiel naar het plafond, rug vlak. Houd je heupen recht in plaats van mee te draaien.',
    why: 'Links en rechts apart gedaan, want één bil is altijd sterker en die neemt het werk over als je ze samen doet.',
    felt: 'bovenkant bil' },
  { id: 'c6', name: 'Fire hydrants', seconds: 30,
    cue: 'Op handen en knieën, breng je knie zijwaarts omhoog. Romp blijft stil.',
    why: 'De zijkant van je bil — die houdt je bekken recht bij het landen.',
    felt: 'zijkant bil' },
  { id: 'c7', name: 'Side leg raises links', seconds: 30,
    cue: 'Op je zij, onderste been gebogen. Til je bovenste been op tot heuphoogte, rustig terug.',
    why: 'Zelfde spier, andere hoek.',
    felt: 'zijkant heup' },
  { id: 'c8', name: 'Side leg raises rechts', seconds: 30,
    cue: 'Andere kant, zelfde uitvoering: op je zij, onderste been gebogen, bovenste been tot heuphoogte en rustig terug. Houd je bovenlichaam stil.',
    why: 'Links en rechts apart, want één heup is altijd sterker — en bij hardlopen zie je dat verschil terug in hoe je landt.',
    felt: 'zijkant heup' },
  { id: 'c9', name: 'Plank', seconds: 30,
    cue: 'Ellebogen onder je schouders, ribben naar beneden, billen aan. Je lichaam is één plank.',
    why: 'Tegenhouden: je romp mag niet doorzakken. De basis van alles.',
    felt: 'hele romp, niet je onderrug' },
  { id: 'c10', name: 'Hollow hold', seconds: 30,
    cue: 'Op je rug, onderrug tegen de mat, schouders en benen net van de grond. Zak je rug los, breng je benen hoger.',
    why: 'Trekt je ribben naar je bekken — dit is de houding die een middel platter laat ogen.',
    felt: 'diep in je buik' },
  { id: 'c11', name: 'Bicycle crunches', seconds: 30,
    cue: 'Elleboog naar tegenoverliggende knie, rustig en gecontroleerd. Niet trekken aan je nek.',
    why: 'Draaiing, en dat is wat je bij hardlopen tegenhoudt.',
    felt: 'zijkant buik' },
  { id: 'c12', name: 'Leg raises', seconds: 30,
    cue: 'Benen gestrekt omhoog en langzaam terug, onderrug tegen de mat. Komt je rug los, buig je knieën.',
    why: 'Onderbuik, de plek die het laatst meekomt.',
    felt: 'onderbuik' },
  { id: 'c13', name: 'Push-ups (op knieën mag)', seconds: 30,
    cue: 'Handen onder je schouders, lichaam één lijn. Op je knieën is geen makkelijkere versie, het is de juiste versie tot je het anders aankunt.',
    why: 'Het enige duwwerk in dit circuit.',
    felt: 'borst, schouders, triceps' },
  { id: 'c14', name: 'Superman', seconds: 30,
    cue: 'Op je buik, armen en benen licht van de grond, nek lang. Twee seconden vast, dan zakken.',
    why: 'Je achterkant. Zonder dit train je alleen de voorkant en dat trekt je schouders naar voren.',
    felt: 'onderrug en bovenrug' },
  { id: 'c15', name: 'Shoulder taps in plank', seconds: 30,
    cue: 'In plank, tik met één hand je andere schouder aan. Je heupen mogen niet wiebelen.',
    why: 'Anti-draaien plus schouders — twee dingen in één.',
    felt: 'romp en schouders' },
  { id: 'c16', name: 'Dead bug', seconds: 30,
    cue: 'Op je rug, tegenoverliggende arm en been strekken en terug. Onderrug blijft tegen de mat.',
    why: 'Afsluiter: spanning houden terwijl je beweegt. Precies wat hardlopen van je romp vraagt.',
    felt: 'diep in je buik' },
];

export const CIRCUIT_TOTAL_SECONDS = CIRCUIT.reduce((s, x) => s + x.seconds, 0);

// ── De herstelversie ────────────────────────────────────────────
// Voor een rode dag, een PEM-signaal of de dag na een race. Vijf minuten,
// en hij telt volwaardig mee voor de reeks.
export const RECOVERY_VERSION = [
  { id: 'r1', name: 'Ademhaling, ribben laag', seconds: 60,
    cue: 'Op je rug, hand op je buik. Vijf seconden in, zeven uit.',
    why: 'Zet je zenuwstelsel op herstel in plaats van op werk.' },
  { id: 'r2', name: 'Kat–koe', seconds: 60,
    cue: 'Op handen en knieën, rug rond en hol, rustig op je adem.',
    why: 'Beweging zonder belasting.' },
  { id: 'r3', name: 'Glute bridge, rustig', seconds: 60,
    cue: 'Tien keer, zonder knijpen bovenin.',
    why: 'Doorbloeding in je billen, geen prikkel.' },
  { id: 'r4', name: 'Bird dog', seconds: 60,
    cue: 'Tegenoverliggende arm en been, acht keer per kant, langzaam.',
    why: 'Houdt je romp wakker zonder hem te belasten.' },
  { id: 'r5', name: 'Benen tegen de muur', seconds: 60,
    cue: 'Benen omhoog tegen de muur, ogen dicht.',
    why: 'Afsluiten. Dit is de dag waarop rust de training is.' },
];

// ── Wat er wanneer verandert ────────────────────────────────────
//
// Zij vroeg: vertel me elke dag wat er strakker en getonder wordt. Dat doe
// ik, maar dan met wat er wérkelijk gebeurt — want een belofte die niet
// uitkomt werkt precies één keer.
//
// De fasen hieronder zijn de gangbare tijdlijn van krachtadaptatie bij
// lichaamsgewichtwerk. In de eerste weken verandert er veel, maar niet in
// de spiegel: dat is je zenuwstelsel. Zichtbare verandering komt later en
// hangt net zo hard aan je eten en je slaap als aan de acht minuten.
export const PHASES = [
  {
    from: 1, to: 7, label: 'Week 1 · je zenuwstelsel leert',
    happening: 'Wat er nu verandert, zie je nog niet: je hersenen leren de juiste '
      + 'spieren op het juiste moment aanzetten. Daarom voelt dag 5 lichter dan dag 1 '
      + 'zonder dat je sterker bent geworden.',
    visible: 'Nog niets in de spiegel, en dat is normaal. Wat je wel merkt: je houdt '
      + 'de plank langer vol en je squat zakt dieper.',
    focus: 'Vorm boven tempo. Volg de video, maar zak dieper dan zij als je dat kunt.',
  },
  {
    from: 8, to: 21, label: 'Week 2–3 · spanning en houding',
    happening: 'Je diepe buikspieren en bilspieren gaan meer spanning dragen. Je '
      + 'houding verandert het eerst: ribben lager, bekken neutraler.',
    visible: 'Je middel lijkt smaller doordat je anders staat, niet doordat er vet weg '
      + 'is. Dat is geen illusie — zo zie je er ook uit.',
    focus: 'Let bij de hollow hold en de dead bug op je onderrug. Blijft die tegen de '
      + 'mat, dan werkt het.',
  },
  {
    from: 22, to: 42, label: 'Week 4–6 · spieruithoudingsvermogen',
    happening: 'Je spieren kunnen langer spanning houden. Dertig seconden plank voelt '
      + 'als iets dat je kunt, niet als iets dat je overleeft.',
    visible: 'De eerste echte verandering in vorm: billen ronder, schouders breder '
      + 'ogend, armen steviger. Bij de billen gaat het het snelst, omdat daar het '
      + 'meeste werk naartoe gaat.',
    focus: 'Tijd om zwaarder te maken: langzamer zakken, één seconde vasthouden '
      + 'bovenin, of een tweede ronde.',
  },
  {
    from: 43, to: 60, label: 'Week 7–8,5 · zichtbaar voor anderen',
    happening: 'Spiermassa verandert nu meetbaar, vooral in je billen en schouders. '
      + 'Dit is ook de periode waarin je kleding anders gaat zitten.',
    visible: 'Rond dag 50 zien anderen het. Je middel-heupverhouding verschuift: '
      + 'billen erbij en romp strakker geeft die vorm, niet alleen gewichtsverlies.',
    focus: 'Acht minuten is nu te weinig prikkel voor je billen. Hang er een tweede '
      + 'workout aan of doe het circuit twee keer.',
  },
  {
    from: 61, to: 75, label: 'Week 9–11 · het wordt wie je bent',
    happening: 'Vijfenzeventig dagen op rij is geen project meer maar een gewoonte. '
      + 'Dat is de grootste winst, groter dan elke afzonderlijke oefening.',
    visible: 'Vergelijk je foto van vandaag met dag 1, niet met gisteren. Dagelijks '
      + 'zie je niets; over 75 dagen zie je iemand anders staan.',
    focus: 'Beslis nu wat er na dag 75 komt. Een reeks die abrupt stopt, verliest in '
      + 'drie weken wat hij in elf heeft opgebouwd.',
  },
];

export function phaseForDay(dag) {
  return PHASES.find(p => dag >= p.from && dag <= p.to) || PHASES[PHASES.length - 1];
}

// ── Mijlpalen, met iets dat waar is ─────────────────────────────
export const MILESTONES = {
  1: 'Dag 1. De moeilijkste is niet dag 40, het is morgen.',
  3: 'Drie dagen. Je zenuwstelsel is al aan het leren, ook al voel je dat nog niet.',
  7: 'Een week. Vanaf hier merk je dat de plank korter duurt dan hij deed.',
  10: 'Tien dagen, en je bent door de fase waarin de meeste mensen stoppen.',
  14: 'Twee weken. Je houding is meetbaar veranderd — ribben lager, bekken neutraler.',
  21: 'Drie weken. Dit is het punt waarop het eerder een gewoonte dan een besluit wordt.',
  25: 'Een derde. Kijk nu naar je foto van dag 1 en niet naar die van gisteren.',
  30: 'Dertig dagen. Je spieren houden spanning langer vast; dat is geen gevoel, dat is adaptatie.',
  40: 'Dag 40. Vanaf hier verandert ook de vorm, niet alleen het vermogen.',
  50: 'Vijftig. Dit is ongeveer het moment waarop anderen het zien.',
  60: 'Zestig dagen. Nog vijftien, en dan is dit gewoon hoe je dag eruitziet.',
  70: 'Zeventig. Bedenk nu wat er op dag 76 gebeurt.',
  75: 'Vijfenzeventig dagen, elke dag. Zet je foto van vandaag naast die van dag 1.',
};
