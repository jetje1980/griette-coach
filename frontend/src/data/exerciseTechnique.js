// Techniek per oefening: precies drie aanwijzingen, en een plek voor een
// demovideo die jij zelf kiest.
//
// Drie, niet vijf. Wie midden in een set staat kan er drie onthouden; bij
// vijf leest niemand meer mee. De volgorde is altijd dezelfde:
//
//   1. OPZET      hoe je begint — waar staan je voeten, waar is het gewicht
//   2. UITVOERING wat er tijdens de herhaling gebeurt
//   3. VALKUIL    het ene ding dat er meestal misgaat
//
// Over video: de app host of kopieert niets. Er wordt alleen een URL
// bewaard die jij zelf invult, en die wordt privacyvriendelijk ingesloten
// (youtube-nocookie). Staat er geen URL, dan geeft de app een zoeklink —
// dan kies jij zelf een demo die je bevalt.

const VIDEO_KEY = 'gc_exercise_videos';

export const TECHNIQUE = {
  // ── Programma A ───────────────────────────────────────────────
  a_squat: {
    wat: 'Een kniebuiging waarbij je één gewicht met twee handen tegen je borst houdt, alsof je een grote beker vasthoudt. Dat is ook wat het woord betekent: goblet is bokaal. Doordat het gewicht vóór je hangt blijf je vanzelf rechtop, in plaats van voorover te kantelen.',
    gewicht: 'Eén halter of kettlebell, vastgehouden bij de bovenkant. Begin licht — 6 tot 8 kilo — en ga pas zwaarder als je alle herhalingen netjes haalt.',
    search: 'goblet squat techniek',
    cues: [
      'Dumbbell tegen je borst, ellebogen naar binnen, voeten iets breder dan je heupen.',
      'Zak tussen je voeten in, knieën naar buiten in het spoor van je tenen.',
      'Laat je hielen niet loskomen — kom liever minder diep dan dat je naar voren kantelt.',
    ],
  },
  a_hinge: {
    wat: 'Je buigt vanuit je heupen naar voren, met je benen bijna gestrekt, en laat de gewichten langs je benen omlaag glijden. Deadlift betekent letterlijk: iets tillen dat stil ligt. Romanian is alleen de naam van deze variant. Je voelt hem aan de achterkant van je bovenbenen.',
    gewicht: 'Twee halters, één in elke hand. Begin met 5 kilo per hand. Dit voelt lichter dan het is, omdat je onderrug meedoet.',
    search: 'romanian deadlift dumbbell techniek',
    cues: [
      'Gewichten voor je dijen, knieën licht gebogen en dáár houden.',
      'Duw je heupen naar achteren tot je de rek in je hamstrings voelt, rug lang.',
      'Dit is geen squat: als je knieën verder buigen, zakt de rek weg en pakken je quads het over.',
    ],
  },
  a_glutes: {
    wat: 'Je zit op de grond met je rug tegen de zijkant van een bank of bed, voeten plat op de vloer. Van daaruit duw je je heupen omhoog, tot je lichaam een rechte plank vormt van knie tot schouder. Hip thrust is letterlijk heup-omhoog-duwen.',
    gewicht: 'Een halter of kettlebell op je heupbotten, met een opgevouwen handdoek eronder want het drukt. Hier kun je sneller zwaarder dan bij de rest — je bilspieren zijn de sterkste die je hebt.',
    search: 'hip thrust techniek',
    cues: [
      'Schouderbladen op de bank, voeten plat, schenen verticaal bovenin.',
      'Duw door je hielen en knijp je bilspieren één seconde vast op het hoogste punt.',
      'Kom niet hoger dan een rechte lijn heup–knie–schouder; verder is holle rug, geen bilspier.',
    ],
  },
  a_push: {
    wat: 'Opdrukken. Op je tenen of op je knieën. Op je knieën is geen mindere versie: het is dezelfde oefening met minder gewicht.',
    gewicht: 'Geen gewicht nodig — je tilt jezelf. Te zwaar? Zet je handen hoger, bijvoorbeeld op de rand van de bank. Te licht? Zet je voeten hoger.',
    search: 'push-up techniek knieen',
    cues: [
      'Handen iets breder dan schouders, lichaam één rechte lijn van hoofd tot knie of teen.',
      'Zak tot je borst vlak boven de grond is, ellebogen ongeveer 45° van je lijf.',
      'Laat je heupen niet doorzakken — knijp billen en buik aan, dan blijft de lijn staan.',
    ],
  },
  a_pull: {
    wat: 'Je steunt met één hand en één knie op een bank, staat voorovergebogen, en trekt met je andere arm een gewicht omhoog naar je heup. De beweging lijkt op roeien, en row is het Engelse woord voor roeien. Dumbbell is gewoon een losse halter.',
    gewicht: 'Eén halter. Hier kun je meer dan je denkt, want je rug is sterk. Begin met 6 tot 8 kilo.',
    search: 'dumbbell row single arm techniek',
    cues: [
      'Eén hand en knie op de bank, rug vlak, schouders evenwijdig aan de grond.',
      'Trek je elleboog langs je lijf naar achteren, schouderblad mee naar je ruggengraat.',
      'Draai je romp niet mee omhoog — dat maakt het zwaarder lijken zonder dat je rug meer doet.',
    ],
  },
  a_core: {
    wat: 'Je ligt op je rug met je armen recht omhoog en je knieën boven je heupen, als een kever die op zijn rug is beland — vandaar de naam. Je strekt steeds één arm en het tegenovergestelde been uit, langzaam.',
    gewicht: 'Geen gewicht. Zwaarder maak je hem door langzamer te gaan, niet door iets vast te pakken.',
    search: 'dead bug oefening techniek',
    cues: [
      'Op je rug, armen recht omhoog, knieën boven je heupen in een hoek van 90°.',
      'Strek tegengesteld arm en been langzaam uit, adem rustig uit.',
      'Je onderrug blijft de hele tijd tegen de mat; komt hij los, strek dan minder ver.',
    ],
  },
  a_calves: {
    wat: 'Op je tenen gaan staan en weer langzaam zakken. Calf is het Engelse woord voor kuit. Dit is de spier waarmee je bij elke stap afzet.',
    gewicht: 'Begin op twee benen zonder gewicht. Gaat dat makkelijk, doe hem dan op één been — dat is in één klap twee keer zo zwaar.',
    search: 'staande kuitheffing techniek',
    cues: [
      'Sta op de rand van een tree of verhoging, hielen vrij, licht steunen voor balans.',
      'Duw zo hoog mogelijk op je tenen en houd één seconde vast.',
      'Laat je hielen daarna volledig zakken — de rek onderin is de helft van het werk.',
    ],
  },

  // ── Programma B ───────────────────────────────────────────────
  b_lunge: {
    wat: 'Een kniebuiging met één been voor en één been achter, waarbij je op die plek blijft staan. Split betekent gesplitst: je benen staan uit elkaar. Je zakt recht omlaag; je stapt niet.',
    gewicht: 'Eerst zonder gewicht tot je stabiel staat. Daarna één halter in elke hand, 4 tot 5 kilo om te beginnen.',
    search: 'split squat techniek',
    cues: [
      'Grote stap naar voren, gewicht verdeeld, romp rechtop.',
      'Zak recht naar beneden tot je achterste knie vlak boven de grond is.',
      'Ga niet naar voren leunen; je voorste knie blijft boven je middenvoet.',
    ],
  },
  b_hinge: {
    wat: 'Een gewicht met een handvat tussen je voeten van de grond tillen door je heupen te strekken. Kettlebell is letterlijk ketelbel, naar de vorm. Je komt omhoog door je heupen naar voren te duwen, niet door je rug recht te trekken.',
    gewicht: 'Eén kettlebell, 8 tot 12 kilo. Van de grond tillen voelt zwaarder dan hetzelfde gewicht in je handen houden.',
    search: 'kettlebell deadlift techniek',
    cues: [
      'Kettlebell tussen je voeten, heupen hoog, borst open.',
      'Duw de grond weg en breng je heupen naar voren, knijp bovenin je billen aan.',
      'Til niet met je rug: als je schouders eerder omhoog komen dan je heupen, is het gewicht te zwaar.',
    ],
  },
  b_glutes: {
    wat: 'Een bruggetje op één been: je ligt op je rug, zet één voet op de grond en duwt je heupen omhoog terwijl het andere been in de lucht blijft. Glute is je bilspier.',
    gewicht: 'Geen gewicht nodig. Eén been doet hier al het werk dat anders twee benen deden.',
    search: 'single leg glute bridge techniek',
    cues: [
      'Eén voet plat, andere knie opgetrokken, armen naast je.',
      'Duw je heup omhoog tot een rechte lijn en houd je bekken waterpas.',
      'Zakt je bekken naar de vrije kant, dan is dat je grens — kort houden telt zwaarder dan hoog komen.',
    ],
  },
  b_push: {
    wat: 'Gewichten vanaf schouderhoogte recht boven je hoofd duwen, zittend of staand. Press betekent duwen.',
    gewicht: 'Twee halters. Begin licht — 3 tot 4 kilo per hand — want je schouders zijn kwetsbaarder dan je benen.',
    search: 'dumbbell shoulder press techniek',
    cues: [
      'Gewichten op schouderhoogte, polsen recht boven je ellebogen.',
      'Duw omhoog tot je armen gestrekt zijn, ribben omlaag en buik aangespannen.',
      'Buig niet achterover om het gewicht omhoog te krijgen; dan doet je onderrug het werk.',
    ],
  },
  b_pull: {
    wat: 'Een elastische band op borsthoogte voor je uit elkaar trekken, tot je schouderbladen naar elkaar toe komen. Pull-apart is uit-elkaar-trekken.',
    gewicht: 'Geen kilo\'s maar de stugheid van de band. Zwaarder betekent: een dikkere band, of je handen dichter bij elkaar pakken.',
    search: 'band pull apart techniek',
    cues: [
      'Band op borsthoogte, armen gestrekt, handen op schouderbreedte.',
      'Trek de band uit elkaar door je schouderbladen naar elkaar te brengen.',
      'Laat rustig terugkomen — de helft van het effect zit in het loslaten, niet in het trekken.',
    ],
  },
  b_carry: {
    wat: 'Met een zwaar gewicht in elke hand rechtop een stuk lopen. Een boer die met twee volle emmers sjouwt doet precies dit, en vandaar de naam.',
    gewicht: 'Zo zwaar als je kunt dragen zonder scheef te hangen. Dit is de oefening waarbij je het meeste gewicht aankunt — wees hier niet te voorzichtig.',
    search: 'farmer carry techniek',
    cues: [
      'Zwaar gewicht in elke hand, schouders naar achteren, blik vooruit.',
      'Loop rustig en rechtop, korte passen, buik licht aangespannen.',
      'Ga niet scheef hangen; als één kant zakt, is het gewicht te zwaar voor deze afstand.',
    ],
  },
  b_feet: {
    wat: 'Je tenen optillen terwijl je hielen op de grond blijven, en daarna je voetholte actief hol maken zonder je tenen te krullen. Het maakt de kleine spieren in je voet sterker, en die vangen elke stap op.',
    gewicht: 'Geen gewicht. Dit gaat om precisie, niet om kracht.',
    search: 'voetboog training hardlopen',
    cues: [
      'Blote voeten, sta rechtop met je gewicht verdeeld over de hele voet.',
      'Til alleen je tenen op, houd twee tellen, en zet ze gecontroleerd terug.',
      'Klauw niet met je tenen — het gaat om de boog optrekken, niet om knijpen.',
    ],
  },

  // ── Strength snack ────────────────────────────────────────────
  s_squat: { search: 'bodyweight squat techniek', cues: [
    'Voeten op heupbreedte, armen voor je uit voor balans.',
    'Zak rustig tot je dijen ongeveer evenwijdig zijn aan de grond.',
    'Hielen op de grond, knieën in het spoor van je tenen.',
  ] },
  s_push: { search: 'push-up techniek knieen', cues: [
    'Handen iets breder dan schouders, lijf recht.',
    'Zak tot je borst vlak boven de grond is.',
    'Heupen niet laten doorzakken; op je knieën is een volwaardige variant.',
  ] },
  s_glutes: { search: 'glute bridge techniek', cues: [
    'Op je rug, voeten plat, hielen dicht bij je billen.',
    'Duw je heupen omhoog en knijp bovenin één seconde aan.',
    'Kom niet hoger dan een rechte lijn — dat is holle rug, geen bilspier.',
  ] },
  s_core: { search: 'plank techniek', cues: [
    'Ellebogen onder je schouders, voeten op heupbreedte.',
    'Eén rechte lijn van hoofd tot hielen, buik en billen aangespannen.',
    'Stop zodra je heupen zakken; dertig goede seconden slaan een slappe minuut.',
  ] },

  // ── Bands & mat ───────────────────────────────────────────────
  bm_squat: { search: 'band squat techniek', cues: [
    'Band onder beide voeten, uiteinden op schouderhoogte.',
    'Zak tussen je voeten in; de band wordt zwaarder naarmate je omhoog komt.',
    'Laat de band je niet naar voren trekken — borst blijft open.',
  ] },
  bm_hinge: { search: 'band good morning techniek', cues: [
    'Band onder je voeten en over je nek of schouders.',
    'Heupen naar achteren, rug lang, tot je de rek in je hamstrings voelt.',
    'Knieën blijven licht gebogen en veranderen niet tijdens de beweging.',
  ] },
  bm_glutes: { search: 'banded glute bridge techniek', cues: [
    'Band net boven je knieën, voeten plat.',
    'Duw je knieën licht naar buiten tegen de band terwijl je je heupen optilt.',
    'Knijp bovenin aan; laat je knieën niet naar binnen vallen.',
  ] },
  bm_push: { search: 'push-up variant techniek', cues: [
    'Kies de variant waarbij je alle herhalingen netjes haalt: muur, verhoging, knie of teen.',
    'Zak gecontroleerd, ellebogen ongeveer 45° van je lijf.',
    'Liever een makkelijkere variant met volledige range dan een zware met halve.',
  ] },
  bm_pull: { search: 'band row techniek', cues: [
    'Band om je voeten of een vast punt, armen gestrekt.',
    'Trek je ellebogen langs je lijf naar achteren, schouderbladen naar elkaar.',
    'Trek niet met je nek mee — schouders blijven laag en ontspannen.',
  ] },
  bm_core: { search: 'side plank techniek', cues: [
    'Elleboog onder je schouder, voeten op elkaar of knieën gebogen.',
    'Til je heup op tot één rechte lijn en adem rustig door.',
    'Rol niet naar voren of achteren; de knievariant telt volwaardig mee.',
  ] },
  bm_calves: { search: 'kuitheffing voetboog hardlopen', cues: [
    'Sta op de rand van een verhoging, hielen vrij.',
    'Duw hoog op je tenen, één seconde vast, dan volledig laten zakken.',
    'Zonder de rek onderin train je maar de helft van de beweging.',
  ] },
  // ── Coach class: bands & mat ──────────────────────────────────
  // Dezelfde opbouw als hierboven: opzet, uitvoering, valkuil. Deze
  // oefeningen stonden in de lessen zonder techniekuitleg, dus zag je bij het
  // opendoen van een les niets staan.
  c_adem: { search: 'ademhaling ribben laag oefening', cues: [
    'Lig op je rug, knieën gebogen, één hand op je ribben en één op je buik.',
    'Adem rustig in door je neus; laat bij de uitademing je ribben naar beneden zakken.',
    'Til je schouders niet op bij het inademen — dan adem je hoog in plaats van diep.',
  ] },
  c_kat: { search: 'kat koe oefening techniek', cues: [
    'Op handen en knieën, handen onder je schouders, knieën onder je heupen.',
    'Rol wervel voor wervel van bol naar hol, rustig en zonder te forceren.',
    'Duw niet vanuit je onderrug alleen; de beweging hoort door je hele rug te lopen.',
  ] },
  c_heupcirkel: { search: 'heupcirkels staand mobiliteit', cues: [
    'Sta op één been, houd je eventueel licht vast, knie van het andere been op heuphoogte.',
    'Maak rustige cirkels vanuit je heup, niet vanuit je onderrug.',
    'Kantel je bekken niet mee — liever een kleinere cirkel die klopt.',
  ] },
  c_glutebridge_w: { search: 'glute bridge techniek', cues: [
    'Op je rug, voeten plat en heupbreed, hielen onder je knieën.',
    'Duw door je hielen omhoog en knijp je bilspieren één tel vast bovenin.',
    'Til niet vanuit je onderrug — als je die voelt in plaats van je billen, kom minder hoog.',
  ] },
  c_squat: { search: 'squat met band om knieen techniek', cues: [
    'Band net boven je knieën, voeten iets breder dan je heupen, tenen licht naar buiten.',
    'Zak tussen je voeten in en duw je knieën actief naar buiten tegen de band in.',
    'Laat je knieën niet naar binnen vallen — dat is precies wat de band zichtbaar maakt.',
  ] },
  c_split: { search: 'split squat techniek', cues: [
    'Grote stap naar voren, achterste hiel los, gewicht vooral op het voorste been.',
    'Zak recht naar beneden tot je achterste knie bijna de grond raakt, romp rechtop.',
    'Stap niet te klein: dan schuift het werk naar je knie in plaats van je bil.',
  ] },
  c_stepdown: { search: 'step down oefening techniek', cues: [
    'Sta met één voet op een verhoging, andere voet zweeft ernaast.',
    'Zak langzaam tot je hiel de grond tikt en kom terug omhoog via het standbeen.',
    'Zak niet met een plof — de controle omlaag is de hele oefening.',
  ] },
  c_rdl_band: { search: 'romanian deadlift band techniek', cues: [
    'Sta met beide voeten op de band, handvatten of uiteinden in je handen, knieën zacht.',
    'Duw je heupen naar achteren met een lange rug, tot je rek voelt in je hamstrings.',
    'Buig je knieën niet verder mee — dan wordt het een squat en verdwijnt de rek.',
  ] },
  c_goodmorning: { search: 'good morning band techniek', cues: [
    'Band onder je voeten en over je schouders, voeten op heupbreedte.',
    'Scharnier vanuit je heupen naar voren, rug lang, knieën licht gebogen.',
    'Rond je rug niet; kom minder ver naar voren als dat gebeurt.',
  ] },
  c_singleleg_rdl: { search: 'single leg romanian deadlift techniek', cues: [
    'Sta op één been, knie zacht, ander been licht van de grond.',
    'Scharnier naar voren terwijl het vrije been naar achteren strekt, heupen recht naar de grond.',
    'Laat je heup niet openklappen naar de zijkant — dan draai je in plaats van te scharnieren.',
  ] },
  c_hipthrust_band: { search: 'hip thrust band techniek', cues: [
    'Schouderbladen op een bank of bank, band om je knieën, voeten plat.',
    'Duw door je hielen omhoog tot je heupen op één lijn staan en knijp één tel.',
    'Kom niet hoger door je onderrug te hollen — de beweging stopt waar je billen stoppen.',
  ] },
  c_clamshell: { search: 'clamshell oefening techniek', cues: [
    'Op je zij, knieën gebogen, band om je knieën, heupen recht boven elkaar.',
    'Open je bovenste knie zonder je bekken achterover te kantelen.',
    'Rol niet naar achteren — leg desnoods je rug tegen een muur om te voelen wanneer dat gebeurt.',
  ] },
  c_kickback: { search: 'glute kickback techniek', cues: [
    'Op handen en knieën, rug in een neutrale stand.',
    'Strek één been naar achteren vanuit je bil, niet hoger dan je romp.',
    'Hol je onderrug niet om hoger te komen — de hoogte doet er niet toe, de bil wel.',
  ] },
  c_pushup: { search: 'push up techniek knieen', cues: [
    'Handen iets breder dan je schouders, lijf één rechte lijn van hoofd tot knie of hiel.',
    'Zak tot je borst laag is, ellebogen ongeveer 45 graden van je lijf.',
    'Laat je heupen niet zakken — de knievariant met een strakke romp is beter dan de tenenversie met een doorhang.',
  ] },
  c_bandpress: { search: 'band shoulder press techniek', cues: [
    'Band onder je voeten, handen op schouderhoogte, ribben laag.',
    'Duw recht omhoog tot je armen gestrekt zijn, oren vrij van je schouders.',
    'Duw niet vanuit een holle rug; span je buik aan voor je begint.',
  ] },
  c_bandrow: { search: 'band row techniek', cues: [
    'Zittend of staand, band om je voeten, armen gestrekt naar voren.',
    'Trek je ellebogen langs je lijf naar achteren en knijp je schouderbladen samen.',
    'Trek niet met je schouders omhoog — de beweging komt van je rug, niet van je nek.',
  ] },
  c_pullapart: { search: 'band pull apart techniek', cues: [
    'Band met beide handen vast, armen gestrekt op borsthoogte voor je.',
    'Trek de band uit elkaar tot je armen opzij staan, schouderbladen naar elkaar.',
    'Buig je ellebogen niet — dan doen je armen het werk in plaats van je rug.',
  ] },
  c_facepull: { search: 'face pull band techniek', cues: [
    'Band op ongeveer ooghoogte bevestigd, handvatten in beide handen.',
    'Trek naar je gezicht met je ellebogen hoog en breed, handen langs je slapen.',
    'Laat je ellebogen niet zakken — dan wordt het een row en mist je de achterkant van je schouder.',
  ] },
  c_deadbug: { search: 'dead bug oefening techniek', cues: [
    'Op je rug, armen recht omhoog, knieën boven je heupen in een hoek van 90 graden.',
    'Strek tegenovergestelde arm en been langzaam uit terwijl je onderrug tegen de grond blijft.',
    'Komt je onderrug los, dan ga je te ver — strek minder ver en houd de druk.',
  ] },
  c_plank: { search: 'plank techniek', cues: [
    'Ellebogen recht onder je schouders, onderarmen plat, voeten op heupbreedte.',
    'Span je billen en buik aan tot je lijf één lijn is; adem gewoon door.',
    'Til je billen niet omhoog en laat ze niet zakken — een korte goede plank telt meer dan een lange slappe.',
  ] },
  c_sideplank: { search: 'side plank techniek', cues: [
    'Op je zij, elleboog recht onder je schouder, knieën of voeten op elkaar.',
    'Duw je heup omhoog tot je lijf één lijn is van schouder tot knie of enkel.',
    'Zak niet naar voren of achteren; je bovenste schouder hoort recht boven de onderste te blijven.',
  ] },
  c_pallof: { search: 'pallof press band techniek', cues: [
    'Band opzij van je bevestigd op borsthoogte, beide handen tegen je borst, sta stevig.',
    'Duw je handen recht vooruit en houd ze daar terwijl de band je probeert te draaien.',
    'Laat je romp niet meedraaien — ga dichter bij het ankerpunt staan als dat niet lukt.',
  ] },
  c_hollow: { search: 'hollow hold techniek', cues: [
    'Op je rug, onderrug stevig tegen de grond gedrukt, armen naast je oren of langs je lijf.',
    'Til schouders en benen net los en houd die druk in je onderrug vast.',
    'Komt je onderrug los, dan zijn je benen te laag — breng ze hoger en houd de druk.',
  ] },
  c_birddog: { search: 'bird dog oefening techniek', cues: [
    'Op handen en knieën, rug neutraal, blik naar de grond.',
    'Strek tegenovergestelde arm en been uit tot ze op romphoogte staan.',
    'Kantel niet mee naar één kant — liever lager strekken en stil blijven.',
  ] },
  c_carry: { search: 'farmer carry techniek', cues: [
    'Een zwaar gewicht in elke hand, schouders laag en naar achteren.',
    'Loop rechtop met korte, rustige passen en een aangespannen romp.',
    'Hang niet scheef en kijk niet naar beneden; adem gewoon door tijdens het lopen.',
  ] },
  c_calf: { search: 'kuitheffen techniek', cues: [
    'Sta op de rand van een trede, hielen vrij, licht vasthouden voor balans.',
    'Duw hoog op je tenen, één tel vasthouden, dan langzaam volledig laten zakken.',
    'Sla de rek onderin niet over — daar zit de helft van de oefening.',
  ] },
  c_voetboog: { search: 'voetboog oefening short foot', cues: [
    'Zit of sta met je voet plat op de grond, tenen ontspannen.',
    'Trek je voetboog omhoog door je bal naar je hiel te trekken, zonder je tenen te krullen.',
    'Krul je tenen wel, dan doe je het met de verkeerde spieren — begin dan zittend opnieuw.',
  ] },
};

// ── Hoe gewichten werken, in gewone woorden ────────────────────
//
// Zij vroeg om duidelijker uitleg: "wat een goblet squat is enzo, en hoe
// gewichten gebruiken, in jip-en-janneke-taal".
//
// Wat er stond waren drie technische aanwijzingen per oefening. Die gaan
// over hoe je een beweging goed uitvoert, en ze gaan er stilzwijgend van
// uit dat je al weet wát de beweging is. "Dumbbell tegen je borst,
// ellebogen naar binnen" helpt niemand die zich afvraagt wat een goblet
// squat eigenlijk is. Daarom staat er nu per oefening eerst een zin die
// de naam uitlegt en zegt wat je gaat doen, en daarna wat je vastpakt en
// hoe zwaar.
//
// Wat hieronder staat, staat één keer: het geldt voor elke oefening en
// hoort niet veertien keer herhaald te worden.
export const GEWICHTEN_UITLEG = [
  {
    kop: 'Serie en herhaling',
    tekst: 'Een herhaling is de beweging één keer: één keer zakken en weer omhoog. '
      + 'Een serie is een rijtje herhalingen achter elkaar, zonder rust. "3 series van '
      + '10" betekent dus: tien keer, rusten, tien keer, rusten, tien keer. Tussen de '
      + 'series rust je ongeveer twee minuten — korter voelt stoerder maar maakt de '
      + 'volgende serie alleen slechter.',
  },
  {
    kop: 'Hoe zwaar',
    tekst: 'Het juiste gewicht is het gewicht waarbij de laatste twee herhalingen zwaar '
      + 'zijn maar nog netjes gaan. Kun je er makkelijk vijf bij doen, dan is het te '
      + 'licht. Gaat de laatste herhaling alleen nog met zwaaien of een holle rug, dan '
      + 'is het te zwaar. Je raadt de eerste keer, en na één training weet je het.',
  },
  {
    kop: 'Wanneer zwaarder',
    tekst: 'Haal je alle series met twee of drie herhalingen over, dan is dat gewicht '
      + 'klaar: de volgende keer één kilo erbij, of één herhaling per serie erbij. Eén '
      + 'van de twee, niet allebei tegelijk. Dat lijkt weinig — één kilo per twee weken '
      + 'is in drie maanden zes kilo.',
  },
  {
    kop: 'Waarom zwaar en weinig',
    tekst: 'Voor hardlopen werkt zwaar met weinig herhalingen beter dan licht met veel. '
      + 'Je wordt er niet zwaarder van: je zenuwstelsel leert je bestaande spieren '
      + 'harder aanspannen, en daardoor kost elke stap minder. Dat is precies waarom je '
      + 'hartslag bij hetzelfde tempo zakt. Vijf herhalingen die echt zwaar zijn doen '
      + 'daarvoor meer dan vijftien makkelijke.',
  },
  {
    kop: 'Heb je geen gewichten',
    tekst: 'Een volle rugzak, een waterfles van vijf liter of een pak kattenbakvulling '
      + 'werken prima. Het lichaam telt kilo\'s, niet merken. Alleen bij oefeningen waar '
      + 'je het gewicht met één hand vasthoudt is een echte halter prettiger.',
  },
];

export function techniqueFor(exerciseId) {
  return TECHNIQUE[exerciseId] || null;
}

// ── Video's: alleen een URL, nooit het bestand ──────────────────
export function loadExerciseVideos() {
  try { return JSON.parse(localStorage.getItem(VIDEO_KEY) || '{}'); } catch { return {}; }
}

export function saveExerciseVideo(exerciseId, url) {
  const all = loadExerciseVideos();
  const clean = (url || '').trim();
  if (!clean) delete all[exerciseId]; else all[exerciseId] = clean;
  localStorage.setItem(VIDEO_KEY, JSON.stringify(all));
  return all;
}

// Een zoeklink, zodat je zelf een demo kiest die je bevalt. De app kiest
// hem niet voor je en slaat geen video op.
export function searchUrl(exerciseId, name = '') {
  const q = TECHNIQUE[exerciseId]?.search || name;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
