# Hardloopcoach: rustdagen en voorspellingen

Datum: 19 augustus 2026 · Live op https://jetje1980.github.io/griette-coach/

---

## Wat er mis was

De coach keek 's ochtends naar je slaap, energie, herstelgevoel en symptomen, en
kwam bij een groen beeld met de volgende sessie uit het schema. Wat hij níet deed:
kijken hoeveel je die week al gelopen had, hoeveel dagen er sinds je laatste run
zaten, of het 24–48u-venster van die run al voorbij was.

Het gevolg: drie groene ochtenden op rij leverden drie hardloopadviezen op. Er zat
geen enkele regel tussen die zei "je hebt deze week al genoeg gelopen".

Dat is precies de fout waar iemand met PEM aan onderdoor gaat, want de rekening van
een sessie komt pas een dag later binnen — als de coach de volgende sessie al heeft
voorgeschreven.

---

## 1. Welke rustdagregels zijn toegevoegd

Alles staat in `frontend/src/restday.js`. De poort draait vóór elke sessiekeuze en
levert altijd één van vijf besluiten op:

| Besluit | Betekenis |
|---|---|
| **RUN TODAY** | Hardlopen is vrijgegeven |
| **STRENGTH TODAY** | Lopen op slot, kracht kan wel — andere prikkel, andere hersteltijd |
| **ACTIVE RECOVERY** | Wandelen of mobiliteit. Bewegen mag, belasten niet |
| **FULL REST** | Niets vandaag. Rust ís de training |
| **WAIT FOR RESPONSE** | De vertraagde respons van de vorige sessie is nog niet bekend |

### De regels, in de volgorde waarin ze getoetst worden

**Systemische stops** — deze overrulen alles.
1. PEM-signaal vandaag, of herstelgevoel op "PEM-achtig" → **FULL REST**, minimaal 2 dagen
2. Coachbesluit rood → **FULL REST**
3. Drie of meer actieve symptomen → **FULL REST**

**Vertraagde respons (de kern van de PEM-logica).**
4. Vandaag al gelopen → **FULL REST**. Twee loopsessies op één dag bestaan niet
5. Vorige run slecht verdragen (vertraagde klachten in het 24–48u-venster) → **ACTIVE RECOVERY**, ongeacht hoe groen je ochtend is
6. Minder dan 2 dagen sinds de laatste run én nog geen herstelcheck ingevuld → **WAIT FOR RESPONSE**
7. Gisteren gelopen → **STRENGTH TODAY** (of actief herstel als die sessie zwaar was). Minstens één volledige rustdag tussen twee runs
8. Vorige sessie zwaar (RPE ≥ 7, zware benen, geen reserve, of gestopt) én minder dan 3 dagen geleden zonder ingevulde respons → **WAIT FOR RESPONSE**

**Belasting over de week.**
9. Al 3 loopdagen in de afgelopen 7 dagen → geen vierde. Het plafond is instelbaar via je doel "max hardloopdagen per week"
10. Weekvolume boven 110% van je gemiddelde van de vier voorgaande weken → **ACTIVE RECOVERY**
11. Zeven dagen achter elkaar belast, geen enkele rustdag → **FULL REST**

**Je eigen signalen.**
12. Coachkleur blauw → **ACTIVE RECOVERY**
13. Zelf als hersteldag gemarkeerd → **ACTIVE RECOVERY**. Dat weegt zwaarder dan het schema

Kracht wordt alleen aangeboden als er ook echt kracht kan: niet binnen twee dagen
na de vorige krachtsessie, en niet bij blauw of rood.

### Frequentie gaat nooit omhoog op alleen een groene ochtend

Een extra loopdag per week vraagt *alle* van deze voorwaarden tegelijk:

- onder het weekplafond
- geen enkele slecht verdragen sessie in 14 dagen
- geen enkel PEM-signaal in 14 dagen
- minstens 4 goed verdragen sessies in 14 dagen
- hooguit één sessie die nog op een herstelcheck wacht

Zolang er ook maar één voorwaarde niet klopt, blijft de frequentie staan en zegt de
coach welke voorwaarde het tegenhoudt.

### Nooit frequentie, volume en intensiteit tegelijk

Per week draait er hooguit één knop, met een vaste volgorde: **volume eerst**
(dat is wat het T1–T35-schema doet), **intensiteit** pas als volume stabiel is, en
**frequentie als laatste**. Bij een slecht verdragen sessie in de afgelopen twee
weken, of een zware sessie deze week, gaat er niets omhoog en zegt de coach dat het
een consolidatieweek is.

---

## 2. Wanneer de coach expliciet geen run adviseert

Op Vandaag verandert de kop mee. In de meting van vandaag, met 58 gelopen minuten
tegen een basis van 28:

> **GROEN — TRAINEN STAAT OP SLOT**
> 🚶 Actief herstel
> Bewegen mag, belasten niet. Wandelen of mobiliteit. Volgende loopmoment op zijn
> vroegst 08-21.
> · 58 min gelopen deze week tegen een basis van 28 min — meer dan 10% groei

De kleur blijft groen, want die beschrijft je toestand. De actie is een andere,
want die volgt de poort. "Wat nu?" zegt in hetzelfde geval "Wandelen — geen
trainingsprikkel", en de sessiekaart toont geen sessienummer maar een vooruitblik
op T7 met de datum waarop die vrijkomt.

---

## 3. Wat een run weer vrijgeeft na een vorige run

Alle vijf tegelijk:

1. Minstens één volledige rustdag sinds de laatste run
2. Een ingevulde herstelcheck 24–48u ná die run, zonder vertraagde klachten
3. Onder het weekplafond van loopdagen
4. Weekvolume onder 110% van de basis van de vier voorgaande weken
5. Geen PEM-signaal en geen blauwe of rode ochtend

Deze lijst staat ook in de app zelf, onder Progressie → Run, achter "Wat een run
weer vrijgeeft" — samen met de exacte datum waarop het eerstvolgende loopmoment
valt. Geen black box: je kunt altijd zien welke voorwaarde nog openstaat.

---

## 4. Hoe de voorspellingen berekend worden

Alles in `frontend/src/forecast.js`.

### Volgende sessie

Vergelijkbare sessies zijn: dezelfde geplande sessie uit het schema, plus runs met
een duur binnen een kwart van de geplande duur. Maximaal de laatste acht.

| Wat | Hoe |
|---|---|
| Duur | Uit het schema, aangepast door de adaptieve staat |
| Sessietempo | Mediaan van vergelijkbare sessies, band = mediane absolute afwijking met een ondergrens van 4% |
| Afstand | Duur gedeeld door de tempoband |
| Doelhartslag | Je eigen instelling (nu 106–132, wandelen boven 130) |
| Verwachte gem. hartslag | Mediaan van vergelijkbare sessies, band minimaal ±3 slagen |
| Tempo loopblokken | Uit het sessietempo afgeleid door de wandelafstand eraf te halen |
| Verwachte RPE | Mediaan ±1 |
| Zekerheid | HOOG bij ≥5 sessies waarvan ≥2 recent en <8% spreiding · GEMIDDELD bij ≥3 · anders LAAG |

De ondergrens op de bandbreedte is bewust: vier identieke sessies betekenen niet dat
de vijfde exact hetzelfde wordt. Zonder die ondergrens toonde de kaart een
afstandsrange van 2,00–2,00 km — schijnzekerheid.

### Race

Drie scenario's over dezelfde berekening, vanaf één anker: je sessietempo bij
hartslag in de easy-band. Voor 5 km telt een echte tijdtest zwaarder dan een
trainingsgemiddelde.

| Scenario | Trend | Terrein | Extra wandelen | Wegzakken |
|---|---|---|---|---|
| Conservatief | geen verdere winst | zwaarste opslag | +6% | volledig |
| Waarschijnlijk | 60% van de trend | midden | +2% | 70% |
| Stretch | volle trend | lichtste opslag | 0% | 40% |

Stretch verschijnt alleen als de laatste vier weken geen enkele slecht verdragen
sessie bevatten.

De correcties, elk met een reden:

- **Terrein.** Wegtempo wordt niet doorgetrokken naar trail of strand. Trail met
  hoogtemeters krijgt 8–15% opslag, strand en duin 5–12%. De opslag staat er
  expliciet bij.
- **Wegzakken over afstand.** Is je langste goed verdragen run korter dan 70% van
  de raceafstand, dan gaat er tot 12% bij. Trainingstempo over 3 km zegt weinig
  over kilometer 9.
- **Hartslagdrift.** Loopt je hartslag binnen een sessie gemiddeld meer dan 5
  slagen op, dan wordt dat tot 10% tragere pace op afstanden die je nog niet
  verdragen hebt.
- **Trendrem.** De waargenomen verbetering wordt afgetopt op 4 sec/km per week.
  Een korte goede reeks mag zich niet maandenlang doorprojecteren.

Zekerheid is HOOG bij ≥5 sessies, race binnen 8 weken, en een langste verdragen run
van ≥70% van de afstand. GEMIDDELD bij ≥40% dekking binnen 16 weken. Anders LAAG.

### Prestatievoorspelling en veilig advies staan altijd apart

Elke kaart heeft twee blokken met eigen koppen. **Prestatievoorspelling** mag
optimistisch zijn. **Veilig coachadvies** is dat nooit — dat noemt run/walk-ritme,
hartslaggrens, wandelen op klimmen, en zegt uitdrukkelijk dat de tijd een uitkomst
is en geen opdracht. Als je langste verdragen run onder de helft van de raceafstand
ligt, adviseert de coach een ruimere wandelverhouding dan het schema voorschrijft.

---

## 5. Welke visuals er staan (Progressie → Run)

1. **Rustdagpoort** — het besluit van vandaag, met dagen sinds de laatste run, loopdagen deze week, weekvolume tegen de basis, en het aantal rustdagen. Uitklapbaar: wat een run vrijgeeft, wat de frequentie tegenhoudt, welke knop deze week omhoog mag
2. **Volgende sessie** — de volledige forecast, met de vergelijkbare sessie eronder
3. **Runs en rustdagen (14 dagen)** — elke dag als tegel: run met kilometers, kracht, of rust; met ✓/✕/? voor de verdraagbaarheid
4. **Loopeconomie** — tempo bij gelijke hartslag over tijd, met projectielijn tot aan je laatste race en een gearceerde onzekerheidsband
5. **Verwacht versus werkelijk tempo** — open cirkel is verwacht, gevulde is gelopen, kleur toont de verdraagbaarheid. Onderaan: hoeveel sessies binnen 30 sec/km van de verwachting vielen
6. **Weekbelasting** — loopminuten per week over acht weken, met het aantal loopdagen boven elke staaf
7. **Hartslagdrift** — per sessie, gekleurd vanaf 5 en vanaf 8 slagen
8. **Hartslag tegenover tempo** — spreidingsdiagram met je bovengrens als stippellijn
9. **Racevoorspelling** — per race drie scenario's, veilig advies, en uitklapbaar waarop het gebaseerd is en wat het niet weet

Vandaag blijft compact: het besluit, vier getallen (duur, afstand, tempo, hartslag),
een zekerheidslabel en één regel advies. Niet meer.

---

## 6. Welke data nog te dun is

Dit is wat de coach op dit moment níet betrouwbaar kan zeggen, en waarom.

| Onderdeel | Status | Wat er nodig is |
|---|---|---|
| **Uren sinds de laatste run** | Wordt geschat op de dag | Workouts slaan geen starttijd op. Uit Strava komt die wel mee; handmatige invoer nog niet. Het 6–12u-venster is daardoor niet los te toetsen van het 24–48u-venster |
| **Tempo van de loopblokken** | Niet te splitsen | Het aangenomen wandeltempo (6:45/km) is sneller dan je sessiegemiddelde. Zolang er geen wandelsessie met afstand én tijd geregistreerd is, is de splitsing niet te maken. De coach zegt dit met zoveel woorden in plaats van een getal te verzinnen |
| **Hartslagdrift** | Alleen met ronden | Vereist splits met hartslag, of de hartslag van eerste en tweede helft apart. Uit Strava komt dit mee zodra er ronden zijn |
| **Hartslagherstel na inspanning** | Niet gemeten | Er is een veld voor in de instellingen maar geen invoer. Zou de zekerheid van de racevoorspelling meetbaar verhogen |
| **Racevoorspelling** | Zekerheid LAAG | Je langste goed verdragen run is een fractie van 10 km. Alles daarboven is extrapolatie, geen voorspelling. Dat verandert zodra er langere sessies met een bevestigde goede respons staan |
| **Slaap en readiness** | Alleen zelfrapportage | De poort gebruikt slaapuren en -kwaliteit uit je check-in. Er is geen apparaatdata; dat is een bewuste beperking, geen bug |
| **Loopeconomie-trend** | Vanaf 3 sessies | Onder de drie sessies met hartslag in de easy-band toont de grafiek geen lijn maar een uitleg |

---

## 7. Status per gevraagd onderdeel

| Onderdeel | Status |
|---|---|
| Trainingsfrequentie- en herstelpoort vóór elk hardloopadvies | **DONE** |
| Signalen: dagen sinds laatste run, runs/7d, km+min per 7 en 28 dagen, PEM, intensiteit, krachtbelasting, slaap, adaptieve staat | **DONE** |
| Uren sinds laatste run, 6–12u-venster apart | **PARTIAL** — geschat op de dag; starttijd ontbreekt bij handmatige invoer |
| Expliciet besluit RUN / STRENGTH / ACTIVE RECOVERY / FULL REST / WAIT | **DONE** |
| Een goede hersteldag is niet automatisch een hardloopdag | **DONE** |
| Frequentie nooit omhoog op alleen GREEN | **DONE** |
| Nooit frequentie + volume + intensiteit tegelijk | **DONE** |
| Forecast volgende sessie: structuur, duur, afstand, hartslag, tempo, RPE, zekerheid | **DONE** |
| Tempo loopblokken apart van sessietempo | **PARTIAL** — berekening werkt, maar wordt onderdrukt zolang er geen wandelsessie geregistreerd is |
| Vergelijking met de laatste vergelijkbare sessie | **DONE** |
| Racevoorspelling in drie scenario's met tijd-, tempo- en hartslagband | **DONE** |
| Gebaseerd op pace@HR, drift, RPE, 5K-tests, langste verdragen run, trend, PEM | **DONE** — hartslagherstel ontbreekt, dat wordt niet gemeten |
| Run/walk-aanbeveling per race, aangepast aan wat je verdraagt | **DONE** |
| Performance forecast strikt gescheiden van safe coach recommendation | **DONE** |
| Geen wegtempo doortrekken naar trail of hoogtemeters | **DONE** |
| Visuals: pace@HR verwacht vs werkelijk, sessie verwacht vs werkelijk, racetraject, weekkalender met rustdagen, weekbelasting, drift, HR-vs-tempo, zekerheidsband | **DONE** |
| Vandaag compact houden | **DONE** |

---

## 8. Wat er getest is

**Logica, 29 controles, alle geslaagd.** Onder meer: groene ochtend na een run
gisteren geeft geen run; drie loopdagen in een week blokkeert de vierde; een slecht
verdragen sessie blokkeert ook bij groen; frequentie kan niet omhoog zonder
tolerantiehistorie; er staat nooit meer dan één progressieknop open; conservatief is
in geen enkel scenario sneller dan waarschijnlijk; elke race heeft een terreinopslag.

**Browser, vier schermbreedtes** (360, 390, 412, 1280 px): geen console- of
paginafouten, geen horizontale overflow, alle negen onderdelen van het paneel
renderen, vijf grafieken tekenen.

**Twee fouten die de tests vonden en die nu weg zijn.** Een afstandsrange die naar
nul klapte bij identieke historie, en een finishtijd van `1:50:60` doordat seconden
werden afgerond ná het opdelen in minuten.

**Drie inconsistenties die de browsertest zichtbaar maakte en die nu weg zijn.**
"Wat nu?" stelde nog een run voor terwijl de poort rust voorschreef; de kop zei
"klaar voor training" op een hersteldag; en een tempo van 17:30/km voor de
loopblokken, een artefact van de wandelaftrek.

---

## Bijlage: Trello

De koppeling is nog niet af, met een aanwijsbare oorzaak. De API-key op de server is
geldig — dat is los getoetst. Het opgeslagen token hoort bij een *andere* API-key,
waardoor Trello `invalid key` terugstuurt.

Opnieuw koppelen kan nu vanuit de app zelf, onder Instellingen → Integraties:

1. **Stap 1 — Trello autoriseren.** De knop opent de autorisatielink die de server
   bouwt; de key komt niet in de app-bundel terecht
2. Trello toont een lange code
3. **Stap 2 — Opslaan.** Plak die code in het veld. De server toetst hem eerst bij
   Trello en slaat hem pas daarna op

Het token gaat rechtstreeks door naar de server en wordt bewaard in `app_secrets`,
alleen bereikbaar met de service role. Het staat niet in localStorage en niet in de
bundel — dat is geverifieerd: nul treffers voor de key en voor de autorisatie-URL in
`index-*.js`.

Zodra dat gedaan is werken board- en lijstkeuze en het aanmaken van kaarten
onmiddellijk; die code stond er al en is idempotent (dezelfde taak levert nooit een
tweede kaart op).

**Strava** draait wel: automatische synchronisatie elk uur, 30 activiteiten
ingelezen, tokens server-side ververst.
