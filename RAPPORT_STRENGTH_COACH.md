# Strength Coach — implementatierapport

19 augustus 2026 · Live op https://jetje1980.github.io/griette-coach/

De hardloopcoach met rustdagpoort, PEM-logica, sessieforecast, racevoorspelling
en run-visualisaties is ongewijzigd gebleven. Alle 29 bestaande hardlooptests en
alle 35 weekkalendertests slagen nog steeds.

---

## 1. Welke Strength modes zijn geïmplementeerd — **DONE**

Drie gelijkwaardige vormen, te kiezen bij Lichaam → Training → Kracht:

| Mode | Wat | Loggen |
|---|---|---|
| **Gewichten** | dumbbells, kettlebells, gym | kg × sets × reps × RIR (het bestaande A/B-programma, ongewijzigd) |
| **Bands & mat** | lichaamsgewicht, minibands, lange banden, matje | band × sets × reps/hold × variant × tempo × RIR |
| **Coach class** | begeleide full-body les, video-first | vier vragen na afloop |

Bands & mat heeft een eigen zevendelig programma — band squat, hinge, glute
bridge, push-variant, band row, side plank, calf raise — met per oefening een
ladder van vier varianten. Die ladder is waar de overload vandaan komt.

---

## 2. Progressive overload zonder gewichten — **DONE**

De **Strength Progression Score** in `frontend/src/strength.js`. Hij is geijkt zo
dat **STRONG 30 op een medium band, volledig afgemaakt, bij RPE 6 = precies 100
punten**. Dat maakt elk getal leesbaar: 120 is anderhalve stap boven je
referentieles.

**Werk per oefening** = weerstand × sets × herhalingen × correcties:

| Knop | Effect |
|---|---|
| Bandweerstand | light 1,0 · medium 1,6 · heavy 2,3 · extra heavy 3,0 |
| Herhalingen | lineair |
| Sets | lineair |
| Isometrische hold | 3 seconden ≈ 1 herhaling |
| Eenbenig/eenarmig | × 1,3 |
| Volledig bewegingsbereik | × 1,1 (ingekort × 0,85) |
| Langzaam tempo | × 1,15 (snel × 0,92) |
| Rust ≤ 30 sec | × 1,08 |

**Werk per sessie** wordt gedeeld door de ervaren zwaarte en vermenigvuldigd met
de reserve:

- **Inspanning**: RPE 5 is neutraal; `factor = RPE / 5`, begrensd op 0,7–1,7.
  Dezelfde les op een lagere RPE levert dus automatisch een hogere score op.
- **Reserve**: RIR ≥ 4 → ×1,12 · RIR ≥ 2 → ×1,05 · RIR 0 → ×0,92. Zonder RIR
  telt "had je meer gekund": ja ×1,10 · beetje ×1,0 · nee ×0,93.
- **Afmaken**: volledig ×1 · gedeeltelijk ×0,6 · niet gedaan ×0.

Een gevolgde videoles logt geen losse sets; daar geldt duur × bandweerstand ×
afmaakfactor. Dat is het eerlijkste wat er over een groepsles te zeggen valt.

Wat de gebruiker ziet is niet de formule maar de uitkomst: **zwaardere band,
meer herhalingen, moeilijkere variant, langere hold, lagere RPE bij dezelfde
les, meer reserve**.

De score claimt geen fysiologische exactheid. Hij claimt consistentie: dezelfde
handeling levert altijd hetzelfde getal op, en elke factor staat in de code met
commentaar erbij.

---

## 3. Welke Coach Classes bestaan — **DONE**

| Les | Duur | Doel-RPE | Patronen | Bedoeld voor |
|---|---|---|---|---|
| STRONG 15 | 15 min | 4–5 | squat, glutes, core | Minimum viable — lage startdrempel |
| STRONG 25 | 25 min | 5–6 | + hinge, pull | De werkweekstandaard |
| **STRONG 30** | 30 min | 5–6 | **alle zeven** | Referentieles; hieraan wordt vooruitgang afgemeten |
| STRONG 35 | 35 min | 6–7 | alle zeven | Alleen bij een stabiele basis en een groene dag |
| RECOVERY FLOW 15 | 15 min | 2–3 | core | Mobiliteit; telt níet mee als krachtprikkel |

Blokstructuur: Prepare · Warm-up · Legs/glutes · Hinge/posterior · Push ·
Pull/houding · Core · Finish/recover.

**Bewegingspatronen** worden bewaakt over 28 dagen: squat/lunge, hinge, glutes,
push, pull/houding, core/carry, calves/voeten. De weging is afgestemd op deze
gebruiker — glutes, posterior chain, core en houding wegen zwaarder dan kuiten,
wegens perimenopauze, botprikkel en ondersteuning van het hardlopen. Ontbreekt
er een patroon, dan kiest de coach de les die het gat dicht en zegt erbij
waarom.

De coach kiest de les op: het besluit van de poort, beschikbare tijd,
trainingsfrequentie, gemiddelde RPE, en het gat in de patroondekking.

---

## 4. Hoe video/YouTube werkt — **DONE**

Alleen de externe URL en wat configuratie worden opgeslagen. Er wordt niets
gekopieerd, gedownload of zelf gehost.

1. Een YouTube-link wordt herkend in alle gangbare vormen (`watch?v=`,
   `youtu.be/`, `/embed/`, `/shorts/`, `/live/`).
2. Afspelen gebeurt via **youtube-nocookie.com/embed** — privacyvriendelijk, en
   alleen als de rechthebbende embedden toestaat.
3. Staat embedden uit, dan blijft de knop **"Openen op YouTube"** over. Naast de
   speler staat een regel die uitlegt wat er aan de hand is als hij niet start.
4. Een niet-YouTube-URL krijgt geen embed maar meteen **"▶ Open video"**.

Dit werkt voor elke openbaar beschikbare les, van welke aanbieder ook. De app is
niet van één merk afhankelijk.

---

## 5. Eigen URL's toevoegen — **DONE**

Lichaam → Training → Kracht → Coach class → **Mijn favoriete lessen**.

Per les in te vullen: titel, video-URL, Spotify-playlist (optioneel), materiaal,
duur en focus-patronen. Toevoegen, bewerken en verwijderen werken alle drie. De
herkende aanbieder wordt getoond zodra je een URL plakt, met de mededeling of
hij hier zal afspelen of in een nieuw tabblad opent.

Er staan vier startsuggesties klaar (Full body bands 30 min · Legs & glutes
bands 25 min · Core & posture 20 min · Recovery strength 15 min). Die worden pas
opgeslagen als je ze bewaart, dus de lijst blijft leeg tot je zelf iets kiest.

Eigen lessen verschijnen daarna overal waar standaardlessen verschijnen.

---

## 6. Hoe Spotify werkt — **DONE (optioneel, buiten de trainingsflow)**

Per les een optionele `spotifyUrl`. Twee knoppen: **"🎵 Open playlist in
Spotify"** en een inklapbare embed-speler. Er wordt geen audio gehost.

Spotify is nadrukkelijk een extraatje. De les start zonder muziek net zo goed.

---

## 7. Samenwerking met de hardloop-recovery gate — **DONE**

Dit was het gevaarlijkste punt van de hele opdracht, en de reden dat
`strengthGate.js` een apart bestand is.

**Volledige rust blijft volledige rust.** Kracht wordt nooit als troostprijs
aangeboden. Deze vier situaties leveren `FULL_REST` op, ongeacht wat de
hardlooppoort zegt:

1. PEM-signaal vandaag, of herstelgevoel op "PEM-achtig"
2. Coachbesluit rood
3. Drie of meer actieve symptomen
4. De hardlooppoort schrijft zelf volledige rust voor

Kracht komt alleen in beeld als lopen om een **belastingsreden** niet doorgaat
(gisteren gelopen, weekplafond bereikt) — nooit om een **herstelreden**.

De vijf besluiten:

| Besluit | Wanneer |
|---|---|
| **STRENGTH TODAY** | Volledige les vrijgegeven |
| **LIGHT STRENGTH** | 1 dag na een krachtsessie, of amber, of minimumdag, of vandaag al gelopen |
| **RECOVERY FLOW** | Blauw, hersteldag, weekplafond, of een slecht verdragen sessie |
| **WAIT** | 24–48u-respons van de vorige krachtsessie nog niet ingevuld |
| **FULL REST** | Zie hierboven |

Meegewogen: dagen sinds de vorige krachtsessie (minimaal 2 voor een volledige
les), krachtsessies per 7 dagen (maximaal 3), de laatste run en of die zwaar was
of slecht verdragen, RPE-historie, vertraagde respons, slaap en readiness, en de
zelf gemarkeerde dagcapaciteit.

---

## 8. Eerstvolgende Strength forecast — **DONE**

Vergelijkbare sessies zijn eerst dezelfde les; onder de drie waarnemingen vult
de coach aan met lessen van vergelijkbare duur (± 8 min).

| Onderdeel | Berekening |
|---|---|
| Les en duur | Uit het poortbesluit en de beschikbare tijd |
| Bandweerstand | Omhoog alleen bij: vorige les afgemaakt **én** RPE onder het doel **én** reserve over. Omlaag bij niet afgemaakt, RPE ≥ doel + 2, of geen reserve |
| Doel-RIR | 2–3 normaal, 3–4 bij lichte kracht |
| Verwachte RPE | Mediaan van vergelijkbare lessen, +1 bij een zwaardere band, −1 bij een lichtere, −0,5 bij drie of meer waarnemingen op dezelfde band |
| Verwachte score | Mediaan × 0,9 tot × 1,15 |
| Zekerheid | HOOG bij ≥4 vergelijkbare én ≥2 dezelfde les · GEMIDDELD bij ≥2 · anders LAAG |

Daaronder staat de vorige keer met band, RPE, of hij is afgemaakt en de score,
plus één zin in gewone taal, bijvoorbeeld: *"Zelfde les, zelfde band als 08-15
(RPE 7). Bij normaal herstel zou hij nu lichter moeten voelen."*

Is er geen RPE ingevuld bij de vorige sessie, dan zegt de coach dát — er wordt
geen vergelijking gesuggereerd die er niet is.

**Prestatievoorspelling en veilig coachadvies staan in aparte blokken.** Het
veilige advies noemt reserve, de doel-RPE van de les, en dat afbreken data is en
geen falen.

---

## 9. 4 / 8 / 12-week forecast — **DONE**

Wekelijkse capaciteitsgroei als bandbreedte, naar consistentie en herstel:

| Situatie | Groei per week |
|---|---|
| ≥ 2 sessies/week, geen PEM | 2,5–4,0% |
| ≥ 1,5 sessies/week | 1,8–3,0% |
| ≥ 1 sessie/week | 1,0–2,0% |
| Minder | 0,3–1,2% |

Correcties: één PEM-signaal in 28 dagen × 0,7–0,8 · twee of meer × 0,4–0,5 ·
afmaakpercentage onder 70% × 0,8–0,85 · dalende RPE-trend verhoogt de bovengrens
· stijgende RPE-trend verlaagt beide.

Samengesteld over de horizon. Bij twee sessies per week zonder PEM levert dat
over acht weken **+22 tot +37%** — het bereik dat de opdracht als voorbeeld
noemde.

Per horizon toont de app wat je mag verwachten, hoeveel sessies daarbij horen,
en de voorwaarden. Vier weken: routine wordt stabiel, eerste fotovergelijking.
Acht weken: duidelijke krachtprogressie waarschijnlijk, taille kan een trend
gaan tonen. Twaalf weken: eerste horizon waarop een oordeel over
lichaamssamenstelling verdedigbaar is.

Er staat expliciet bij: **dit gaat over trainingscapaciteit, niet over kilo's of
centimeters.**

---

## 10. Welke Strength visuals zijn toegevoegd — **DONE**

Onder Progressie → Strength, in deze volgorde:

1. **Krachtpoort** — besluit van vandaag met de reden
2. **Volgende sessie** — volledige forecast, vorige keer, veilig advies apart
3. **Word ik sterker?** — benchmarks start → nu
4. **Nu → 4 → 8 → 12 weken** — klikbare tijdlijn met voorwaarden
5. **Verwacht versus werkelijk** — omschakelbaar 4/8/12 weken
6. **Krachtcapaciteit per week** — lijn met de referentie op 100 als stippellijn
7. **Bandweerstand over tijd** — light → extra heavy
8. **Bewegingspatronen** — zeven iconen met dekking en telling
9. **Laatste 28 dagen** — sessies, afmaakpercentage, gemiddelde RPE, capaciteitsverandering

Het oude lifts-overzicht staat er nog, ingeklapt onder "Losse lifts en historie".

---

## 11. Benchmarks — **DONE**

Zeven stuks, niet meer. Twee ervan vullen zichzelf uit je sessies.

| Benchmark | Bron |
|---|---|
| Bandniveau | automatisch, zwaarste band bij RPE ≤ 7 |
| Squat/lunge reps | zelf invoeren |
| Glute bridge | zelf invoeren |
| Side plank (sec) | zelf invoeren |
| Push-variant | zelf invoeren |
| Pull/houding | zelf invoeren |
| STRONG 30 — RPE | automatisch uit je sessies (lager is beter) |

Weergave is altijd **START → NU**, met de datums erbij en de richting in kleur.

---

## 12. Hoe bodyfoto-checkpoints werken — **DONE**

Vaste ijkpunten op **dag 0, 28, 56 en 84**, gerekend vanaf je eerste fotoserie
(of vanaf je programmastartdatum zolang die er niet is). Binnen drie dagen
rondom een ijkpunt telt een serie mee.

Op zo'n dag verschijnt op **Vandaag** een kaart: *"📷 Progressiemoment — 4 weken
sinds je startfoto. Maak opnieuw voor, zij en achter."* Een gemist ijkpunt wordt
alsnog aangeboden. Drie aanzichten: voor, zij, achter.

Standaardisatie-instructies staan bij het maken van de foto's, niet weggestopt:
zelfde plek, zelfde licht, camera op heuphoogte, zelfde afstand, vergelijkbare
kleding, ontspannen staan, ongeveer hetzelfde tijdstip.

Foto's blijven waar ze al stonden: IndexedDB met back-up naar de private
Supabase-bucket. Aan de opslag is niets veranderd en er is niets verwijderd.

---

## 13. START / PREVIOUS / CURRENT — **DONE**

Onder Progressie → Body, boven alles: **Mijn verandering**.

Drie kolommen naast elkaar per aanzicht. START is de oudste serie, CURRENT de
nieuwste, PREVIOUS het één-na-laatste ijkpunt — bewust niet de vorige
willekeurige foto, anders vergelijk je twee dagen die te dicht op elkaar liggen.
PREVIOUS verschijnt pas vanaf drie series.

Tikken op een foto opent hem groot. Onder de vergelijking staat hoeveel tijd er
tussen zit; is dat minder dan drie weken, dan zegt de app dat je vooral licht en
houding vergelijkt en nog geen verandering.

Uitklapbaar: waar je zélf naar kunt kijken — taillecontour, houding,
spierdefinitie, hoe kleding valt. **Kwalitatief, met de mededeling erbij dat er
uit een foto geen vetpercentage, kilo's of centimeters af te lezen zijn.**

Slider/swipe-vergelijking is er niet; naast elkaar bleek op 360 px leesbaarder
dan een schuifregelaar. Zie §15.

---

## 14. Hoe recompositie wordt herkend — **DONE**

Gewicht stabiel (< 1 kg verschil) **+** taille ≥ 1 cm omlaag **+** krachtscore
≥ 5% omhoog = **positieve recompositie**, en dat wordt als winst gepresenteerd:

> *"Je gewicht staat vrijwel stil (−0,3 kg), je taille is 2,2 cm kleiner en je
> krachtcapaciteit is met 27% gestegen. Dat is precies het patroon waar je naartoe
> werkt: minder omtrek, meer weefsel dat iets doet. De weegschaal vertelt hier niet
> het hele verhaal."*

Vijf andere uitkomsten worden ook herkend: vorm verandert zonder gewichtsverlies,
gewicht én omtrek omlaag, zwaarder én sterker (uitdrukkelijk niet als terugval
gelezen), vroege signalen, en nog geen duidelijke trend.

In de regels eronder staat **gewicht neutraal gekleurd** — niet groen of rood.
Het is niet de hoofdindicator.

Beoordeeld wordt op: gewichtstrend, taille, heup, foto's, krachtprogressie,
bandprogressie en benchmarks.

---

## 15. Welke data nog te dun is — eerlijk

| Onderdeel | Status | Waarom |
|---|---|---|
| **4/8/12-week forecast** | Zekerheid LAAG | Er staan nog geen 8 krachtsessies in 28 dagen. De vooruitblik leunt nu vooral op algemene opbouwprincipes, niet op jouw data. Dat staat er ook letterlijk bij |
| **Verwacht versus werkelijk** | Nog niet beschikbaar | Vereist minstens 8 weken geschiedenis vóór vandaag |
| **Vetpercentage** | Niet getoond | Verschijnt alleen bij twee échte metingen, en dan als trend. Nooit uit beeld afgeleid |
| **Bandprogressie** | Vult zich | Wordt pas een lijn zodra je bij een paar sessies het bandniveau invult |
| **Side plank, push, pull** | Leeg | Deze drie benchmarks moet je één keer meten om een startpunt te hebben |
| **Fotovergelijking** | Wacht op start | Zonder dag-0-serie is er over twaalf weken niets te vergelijken. De coach vraagt er nu om |
| **Taille/heup** | Twee metingen nodig | Eén meting is een getal, twee is een trend |
| **Slider-fotovergelijking** | **NOT DONE** | Naast elkaar bleek op 360 px leesbaarder. Tikken vergroot wel |
| **Bewegingskwaliteit/techniek** | **PARTIAL** | Zit indirect in de variantladder (bijv. push-up: muur → verhoogd → knieën → vlak) en in het bewegingsbereik, maar er is geen aparte techniekscore |

---

## 16. Gewijzigde bestanden

**Nieuw (7):**

| Bestand | Wat |
|---|---|
| `frontend/src/data/strengthClasses.js` | Bandniveaus, patronen, vijf coach classes, bands & mat-programma, video/Spotify-URL-verwerking, eigen lessen |
| `frontend/src/strength.js` | Canoniek sessiemodel, Strength Progression Score, benchmarks, patroondekking, trends |
| `frontend/src/strengthGate.js` | De vijf krachtbesluiten, sessieforecast, 4/8/12-week outlook, verwacht vs werkelijk |
| `frontend/src/bodyProgress.js` | Fotocheckpoints, start/vorige/nu, recompositie-oordeel, body metrics |
| `frontend/src/components/StrengthToday.jsx` | Vandaag-kaart, videospeler, feedback in vier vragen |
| `frontend/src/components/StrengthModes.jsx` | Moduswissel, bands & mat-logging, coach classes en eigen lessen |
| `frontend/src/components/StrengthPanel.jsx` | Progressie → Strength: alle visuals |
| `frontend/src/components/MyChangePanel.jsx` | Mijn verandering: fotovergelijking en meetbare verandering |

**Gewijzigd (4):** `VandaagScreen.jsx` (krachtkaart + fotocheckpoint),
`ProgressieScreen.jsx` (Strength- en Body-tab), `LichaamScreen.jsx`
(moduswissel), `data/strengthClasses.js` (bands & mat toegevoegd).

**Niet aangeraakt:** Supabase-schema, RLS, storage, de hardloopcoach, de
weekkalender, de Strava-koppeling. Bestaande krachtsessies (programma A/B)
blijven staan en krijgen bij het inlezen automatisch een type toegewezen; er is
niets verwijderd of overschreven.

---

## 17. Welke tests zijn uitgevoerd

**97 logica-controles, alle geslaagd.** Onder meer:

- Referentiesessie scoort exact 100; lagere RPE, zwaardere band, langere les,
  meer reserve scoren hoger; gedeeltelijk of niet afgemaakt scoort lager
- Alle acht overload-knoppen verhogen het werk aantoonbaar
- Vijf classes bestaan, STRONG 30 dekt alle zeven patronen, recovery telt niet mee
- 25 minuten levert nooit een les van 30 minuten op
- YouTube-URL-herkenning in alle vormen; onbekende URL geeft geen embed maar wel
  een fallback; Spotify-playlist-embed
- Eigen les opslaan, bijwerken zonder duplicaat, verwijderen
- **PEM, rood, drie symptomen en een hardlooppoort op volledige rust leveren
  alle vier FULL_REST op, zonder les**
- Gisteren kracht zonder respons → WAIT; met respons maar één dag → LIGHT
- Drie sessies in 7 dagen → plafond
- Ontbrekende patronen gesignaleerd; coach kiest de les die het gat dicht
- Vier ijkpunten met de juiste datums; gemist ijkpunt wordt aangeboden
- Recompositie herkend en als winst beoordeeld; gewicht neutraal; geen
  vetpercentage zonder meting
- Oude A/B-sessies blijven bestaan, krijgen een type en zijn scoorbaar

**Acceptatiescenario uit de opdracht — geslaagd.** Gisteren gelopen, vandaag
GREEN, hardlooppoort blokkeert de run maar niet wegens volledige rust, 25
minuten beschikbaar, alleen mat en banden:

```
KRACHT VANDAAG                              gemiddeld
STRONG 25 — BANDS & MAT
25 min · Medium band · RPE 5–6
Matje + minibands
[▶ Start videoles]  [Zonder video gedaan]
```

Na afloop: voltooid ja/gedeeltelijk/nee · RPE 1–10 · band · had je meer gekund ·
notitie. De sessie telt daarna mee, de progressiescore wordt bijgewerkt, de
4/8/12-week forecast schuift mee, en het foto-ijkpunt blijft aan dag 28/56/84
hangen.

**Browsertest op 360, 390, 412 en 1280 px:** geen console- of paginafouten, geen
horizontale overflow, alle negen Strength-onderdelen en alle drie
Body-onderdelen renderen.

**Regressie:** 29 hardlooptests en 35 weekkalendertests slagen onverkort.

**Drie ruwe randen die de tests zichtbaar maakten en die nu weg zijn:** de
bandkeuze negeerde bewijs uit vergelijkbare lessen bij te weinig historie; de
ondertitel toonde de materiaallijst in plaats van de trainingsvorm; en er
verscheen "RPE ?" wanneer de vorige sessie geen RPE had.

---

## Eindstand

| # | Onderdeel | Status |
|---|---|---|
| 1 | Strength modes | **DONE** |
| 2 | Overload zonder gewichten | **DONE** |
| 3 | Coach Classes | **DONE** |
| 4 | Video / YouTube | **DONE** |
| 5 | Eigen URL's | **DONE** |
| 6 | Spotify | **DONE** |
| 7 | Samenwerking met de recovery gate | **DONE** |
| 8 | Eerstvolgende forecast | **DONE** |
| 9 | 4/8/12-week forecast | **DONE** |
| 10 | Strength visuals | **DONE** |
| 11 | Fotocheckpoints | **DONE** |
| 12 | START / PREVIOUS / CURRENT | **DONE** — slider NOT DONE, naast elkaar gekozen |
| 13 | Recompositie | **DONE** |
| 14 | Bewegingskwaliteit als aparte score | **PARTIAL** — zit in de variantladder |
| 15 | Betrouwbaarheid van de voorspellingen | **PARTIAL** — te weinig sessies; de app zegt dat zelf |
