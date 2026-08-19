# Griëtte Coach — masteropdracht, implementatierapport

19 augustus 2026 · Live op https://jetje1980.github.io/griette-coach/

Deze ronde is bewust niet over de hele opdracht uitgesmeerd. Ik heb drie
onderdelen echt afgemaakt en getest, en van de rest staat hieronder eerlijk
wat er wel en niet is. Wat er niet is, is niet half aangezet.

---

## Wat er deze ronde bij is gekomen

### 1. Het pace-model — **DONE**

Dit stond drie keer in de opdracht, inclusief als eindprincipe:
**run pace ≠ walk pace ≠ session pace.** Het was ook precies wat ik vorige
ronde als PARTIAL had gemeld. Nu af.

`frontend/src/pace.js` behandelt de drie als verschillende grootheden:

| Begrip | Wat het is |
|---|---|
| **Run pace** | Tempo in de hardloopblokken |
| **Walk pace** | Tempo in de wandelblokken |
| **Session pace** | Gemiddelde over de hele sessie, wandelen inbegrepen |

Het sessietempo wordt nergens meer als hardloopsnelheid gepresenteerd. In de
forecast staan alle drie apart, met eronder: *"Het sessietempo telt de
wandelblokken mee en is dus lager dan je hardloopsnelheid."* En daarnaast
altijd: *"Hartslag is de instructie, tempo is de uitkomst."*

**Een echte vondst tijdens het bouwen.** Ik begon met absolute
tempodrempels — sneller dan 8:30/km is lopen, langzamer dan 9:30/km is
wandelen. Dat werkt niet voor jou. Je loopt in deze fase rond 10:00/km, en
het schema noemt een wandeltempo van 6:30–7:00/km. Dat laatste is bijna
9 km/u; dat is geen wandelen maar snelwandelen, en het zou betekenen dat je
wandelt sneller dan je loopt. Met absolute grenzen belandde elk blok aan de
verkeerde kant.

De classificatie werkt nu **relatief binnen één sessie**: de snellere blokken
zijn de loopblokken, de tragere de wandelblokken, met de hartslag als
bevestiging. Robuust of je nu 6:00 of 12:00 per kilometer loopt. Elke
automatische keuze is aan te tikken en om te zetten, en die correctie blijft
bewaard — dat is de "laat gebruiker corrigeren, bewaar correcties" uit §5.5.

De terugval voor het wandeltempo staat nu op 9:30/km in plaats van 6:45/km,
met de reden in de code.

**Running economy** (§5.3) draait nu op het echte looptempo bij gelijke
hartslag, niet op het sessiegemiddelde. De grafiek toont beide lijnen: run
pace en hartslag. Gaat het tempo omhoog terwijl de hartslag meestijgt, dan
zegt de coach dat het harder werken is en geen economie. De historische
5 km in 25–30 min staat erbij als context, met de expliciete tekst dat het
geen norm voor vandaag is.

**Strava laps en splits** (§5.5) worden nu daadwerkelijk opgehaald. De
lijst-endpoint van Strava levert geen ronden, dus er is een `/detail`-route
bijgekomen die ze per activiteit ophaalt en bij de import bewaart. Ze worden
lui aangevuld: hooguit drie recente runs per sessie, zodat de Strava-limieten
ruim blijven.

### 2. Evidence-informed Goal → Action Engine (§39) — **DONE**

`frontend/src/leverage.js`. De keten die je beschreef:

**DOEL → DRIVERS → BOTTLENECK → ACTIE → METING → REVIEW → AANPASSEN**

Zes domeinen met elk hun eigen beïnvloedbare drivers: Glow, Body, Run,
Strength, Freshness en Tijd. Elke driver beoordeelt zichzelf uit jouw data
en levert een status: op orde, wankel, knelpunt, of niet gemeten. De driver
met de slechtste status en het hoogste gewicht is de bottleneck.

De **hefboom van vandaag** is niet de langste lijst maar de actie met de
hoogste verwachte opbrengst binnen de capaciteit van vandaag. Een driver die
meerdere doelen tegelijk deblokkeert weegt zwaarder — dat is wat "hoogste
hefboom" betekent.

Bij elk advies zit **"Waarom dit?"** met hooguit vier korte redenen. Geen
essay tenzij je doorklikt.

De twee acceptatietests uit §39.12 en §39.13 slagen:

> **Glow bij slecht slapen.** De coach adviseert *"Bescherm de avond: geen
> extra afspraak, geen late training."* Geen beautychecklist, geen
> behandeling, geen huidanalyse. De bottleneck is slaap.

> **Sneller strakker bij AMBER.** De coach adviseert *"Leg je matje en
> banden nu klaar op de plek waar je traint. Dat is de echte drempel."*
> Geen extra cardio, geen calorierestrictie. Waarom: krachtconsistentie is
> de beperkende factor, en dat blokkeert Body en Run tegelijk.

Bij PEM of rood komt er **geen trainingsactie** uit — alleen wat herstel,
slaap, stress of routine dient.

De **learning loop** werkt zoals gevraagd: wordt een actie herhaaldelijk
overgeslagen, dan zegt de coach *"Dat is geen kwestie van discipline maar
van frictie — wat staat er in de weg?"* Markeer je iets twee keer als
irritant, dan stopt hij ermee.

**Review windows**: herstel en slaap dagelijks, trainingsbelasting en
routines wekelijks, lichaamssamenstelling en loopeconomie pas na vier tot
acht weken, foto's maandelijks. Met de vijf besluiten CONTINUE, ADJUST,
REPLACE, PAUSE en ESCALATE.

### 3. Daily Aliveness / State Shift Engine (§20, §21) — **DONE**

`frontend/src/aliveness.js`. Niet "beweeg vijf minuten" maar:

> *Zet één nummer van Charlotte de Witte aan en dans tot het afgelopen is.*
> *Doe je ogen dicht, zet Andrea Bocelli op en waan je vijf minuten in Rome.*
> *Pak een frisse appel, ga even buiten zitten en eet hem zonder telefoon.*

Twaalf toestanden (energie, verzachten, aarden, spelen, mooi voelen, vrij
voelen, sterk voelen, ontvangen, maken, verbeelden, verbinden, herstellen),
duur 1 tot 20 minuten, en een keuze die rekening houdt met energie, herstel,
PEM, beschikbare tijd, plek en of je AAN, UIT of gereguleerd bent.

De vier knoppen staan op Vandaag: mini-reset, 5 minuten droomleven, 3
stukjes droomleven, 1% Future Self.

**Persoonlijke ankers** (§21) onder Leven → Toekomst: muziek, een plek in je
hoofd, iets zintuiglijks, een activiteit. Elk anker mag aan een toestand
hangen. Vraag je om verbeelding, dan krijg je jouw muziek en jouw plek terug
— maar je energie-anker belandt niet in een verstillingsvoorstel. Dat was
een echte fout die de tests vonden: eerst kreeg je *"Zet Andrea Bocelli hard
aan in de keuken en zing mee"*, wat komisch mis is.

**Feedback**: veel / beetje / niet / irritant. Wat je irritant noemt komt
niet terug. Wat je pas kreeg staat drie dagen achteraan, zodat het geen
herhaling wordt.

De toon is getest: geen uitroeptekens, geen infantiele aanspreekvorm, en
elk voorstel is een ervaring en geen taak.

**Wat maakt mij levend** (§25) staat er ook: twaalf categorieën, de zes
vragen uit de opdracht, en de mogelijkheid om aan te geven welke verlangens
al jaren terugkeren.

---

## Wat er al stond en onaangeroerd is gebleven

| § | Onderdeel | Status |
|---|---|---|
| 3 | Head Coach, één besluit, GREEN/AMBER/BLUE/RED | **DONE** |
| 4 | PEM, delayed tolerance, BUILD/HOLD/REPEAT/DELOAD/SWAP/TEST | **DONE** |
| 5 | Run/walk-schema, hartslag leidend, rustdagpoort, race-forecast | **DONE** |
| 6 | Strength als volwaardige pijler, zeven bewegingspatronen | **DONE** |
| 7 | Cyclus en menstruatie met backdating en override | **DONE** |
| 8 | Ajovi-logboek met historische invoer | **DONE** |
| 9 | Centrale bewerkbare doelen | **DONE** |
| 10 | Body composition en recompositie | **DONE** |
| 18 | ADHD executive coach, max 3 prioriteiten, WIP-limieten | **DONE** |
| 33 | Navigatie en progressive disclosure ongewijzigd | **DONE** |
| 34 | Capture/task-model met status los van bestemming | **DONE** |
| 35 | Auth, RLS, private buckets, geen secrets in de bundel | **DONE** |

---

## Wat er níet is — eerlijk, en waarom

| § | Onderdeel | Status | Waarom |
|---|---|---|---|
| 11 | Glow / gezichtsfoto-KPI | **PARTIAL** | Glow bestaat als doeldomein met drivers en bottleneck. De maandelijkse gestandaardiseerde gezichtsfoto met kwalitatieve vergelijking is er nog niet; de bodyfoto-infrastructuur ligt er wel en is herbruikbaar |
| 12 | Personal Knowledge Base | **NOT IMPLEMENTED** | Basisprofiel, eigen notities en bronrechten per domein. Geen half werk gemaakt: dit vraagt een eigen datamodel plus rechtenlaag |
| 13 | Document ingestion en profile insights | **NOT IMPLEMENTED** | Vraagt PDF- en DOCX-extractie server-side, plus een insight-model met bronverwijzing. Te groot om er deze ronde iets werkends van te maken |
| 14 | Identity Workshop, suggest-first | **NOT IMPLEMENTED** | Hangt aan §12 en §13: zonder bronnen kan de coach geen onderbouwd voorstel voor kernwaarden doen, en een leeg AI-praatje is precies wat je niet wilt |
| 15 | Trello als profielbron | **NOT IMPLEMENTED** | De backlog-koppeling zelf is gebouwd en idempotent, maar wacht nog op een geldig token (zie onder). Read-only profielanalyse is er niet |
| 16 | Google Calendar | **NOT IMPLEMENTED** | Geen enkele koppeling. Er is geen placeholder of nep-UI die suggereert dat het werkt |
| 17 | Runna | **NOT IMPLEMENTED** | Geen import, geen TRAINING_EXTERNAL-model. Idem: niets dat doet alsof |
| 22 | Warmte, familie, vriendschap, flair | **PARTIAL** | Zit in de aliveness-bibliotheek (spraakbericht, mooie tafel, echte vraag aan je kind, bellen tijdens wandelen). Geen apart domein met reflectievragen |
| 24 | Relational resonance, leunen, ontvangen | **PARTIAL** | De RECEIVE-toestand bestaat met drie oefeningen: hulp aannemen zonder compenseren, iemand anders laten kiezen, een compliment aannemen. Het model met externe bron, onderliggende behoefte, zelfvoorziening en relationeel verzoek is er niet |
| 26 | Future Self outer + felt | **PARTIAL** | Future Self bestaat onder Leven. De dagelijkse vraag "welke kleine keuze geeft vandaag 5–10% meer van deze kwaliteit" is nu de 1%-knop; DO/PROTECT/EXPERIENCE als doeltypen is er niet |
| 27–29 | Visual moodboard, Style DNA, visual modes | **PARTIAL** | Beeldopslag bestaat (private bucket, owner-only). "Wat trekt mij hierin aan" per beeld, de stijl-DNA en de vier visuele modi zijn er niet |
| 30 | Sociaal succes als Future Self-domein | **NOT IMPLEMENTED** | Bewust: je schreef er zelf bij dat het niet als sociale productiviteit gemeten mag worden, en ik wilde er geen KPI-achtig scherm van maken zonder dat goed doordacht te hebben |
| 32 | Vandaag → Future Self, max één actie per domein | **PARTIAL** | De hefboom-kaart geeft nu één actie voor lichaam/prestatie en de aliveness-kaart één voor ervaring. De expliciete drieslag body / life-work / experience met maximaal één elk is er niet als vaste structuur |

---

## Integraties — werkt het écht? (§36)

### Strava — **DONE**

Aantoonbaar werkend, met echte data uit je account:

- OAuth met scopes `read,activity:read_all`, `approval_prompt=force`
- Server-side token-refresh, aantoonbaar uitgevoerd (`updated_at` > `created_at`)
- 30 activiteiten geïmporteerd, alle met hartslag
- Automatische sync elk uur via pg_cron, laatste run HTTP 200
- **Nieuw deze ronde**: laps en splits per activiteit via `/detail`, met run/walk-classificatie en handmatige correctie
- Duplicaatpreventie via unique constraint, getest
- Geen `activity:write` aangevraagd

De runs van 17 en 18 augustus staan als echte trainingen in de app, met
sessienummer en `run_done`.

### Trello — **PARTIAL, wacht op één handeling van jou**

De code is compleet en getest: authenticatie, kaarten aanmaken met
idempotentie, kaart-id en URL opgeslagen in `task_links`, foutafhandeling.

De API-key op de server is geldig — dat heb ik los getoetst. Het opgeslagen
**token hoort bij een andere API-key**, waardoor Trello `invalid key`
terugstuurt. Vernieuwen kan in twee stappen vanuit de app:
**Instellingen → Integraties → Trello**.

Read-only profielanalyse (§15) bestaat niet.

### Runna — **NOT IMPLEMENTED**

Niets. Geen model, geen placeholder.

### Google Calendar — **NOT IMPLEMENTED**

Niets.

---

## Data en privacy (§35)

**Canoniek per datatype:**

| Data | Bron van waarheid |
|---|---|
| Daglogs, doelen, workouts, krachtsessies | Supabase `gc_coach_data`, owner-only RLS. localStorage is cache |
| Strava-activiteiten | Supabase `workout_imports`, RLS op `auth.uid()` |
| Trello-koppelingen | Supabase `task_links`, unique op idempotency key |
| Progressiefoto's | Private Supabase-bucket + IndexedDB als offline kopie |
| Tokens en secrets | Uitsluitend Edge Function secrets en `app_secrets` (service-role) |

**Dubbele bronnen die nog bestaan.** Dit is de eerlijke stand:

- `gc_*`-sleutels in localStorage zijn cache met een schrijfwachtrij naar
  Supabase. Bij uitloggen worden ze gewist, inclusief de drie
  IndexedDB-databases.
- De nieuwe sleutels van deze ronde (`gc_anchors`, `gc_aliveness_list`,
  `gc_aliveness_feedback`, `gc_leverage_log`, `gc_pace_corrections`) lopen
  mee in dezelfde synchronisatie, maar zijn nog niet apart geverifieerd op
  cross-device gedrag.
- Zes progressiefoto's staan nog op het oude pad `{datum}/{type}.jpeg` in
  plaats van `{user_id}/progress/...`. Bewust niet verplaatst: de beveiliging
  leunt op `owner_id` en niet op het pad, en de app leest beide locaties.
- Foto-analyses (`gc_photo_analysis_*`) zijn nog local-only.

**Geen** gezondheidsdata in de repo, **geen** publieke foto-URL's, **geen**
API-secrets in de bundel — dat laatste is opnieuw gescand.

---

## Gewijzigde bestanden

**Nieuw (5):**

| Bestand | Wat |
|---|---|
| `frontend/src/pace.js` | Drie tempo's, relatieve run/walk-classificatie, correcties, loopeconomie, voorspelling, historische context |
| `frontend/src/leverage.js` | Drivers per domein, bottleneck, hefboom van vandaag, adherentie, review windows |
| `frontend/src/aliveness.js` | Toestanden, ervaringenbibliotheek, ankers, feedbackloop, vier knoppen, "wat maakt mij levend" |
| `frontend/src/components/LeverageCard.jsx` | Compacte kaart op Vandaag plus volledig overzicht per doel |
| `frontend/src/components/AlivenessCard.jsx` | De vier knoppen op Vandaag plus de ankerbibliotheek |

**Gewijzigd (6):** `forecast.js` (drie tempo's), `stravaIngest.js` (laps en
splits, lui aanvullen), `integrations.js` (detail-route), `App.jsx`
(segmentverrijking bij opstarten), `components/RunForecastPanel.jsx`
(economie- en segmentkaart, drie tempo's), `components/VandaagScreen.jsx` en
`components/LevenScreen.jsx` (nieuwe kaarten).

**Edge Function**: `coach-strava` naar v10 met de `/detail`-route.

**Migraties**: geen. Geen schemawijziging, geen datamigratie, niets
verwijderd.

---

## Tests

**69 nieuwe controles, alle geslaagd**, waaronder:

- De drie tempo's zijn echt drie getallen: run 6:15 · walk 7:30 · sessie 6:40, en het sessietempo ligt tussen de andere twee in
- Zonder ronden wordt er geen looptempo verzonnen, en dat wordt uitgelegd
- Segmentclassificatie, correctie, en dat de correctie meetelt in het tempo
- Loopeconomie: bij gelijke hartslag 50 sec/km winst wordt herkend als echte economie
- De acceptatietests §39.12 (glow) en §39.13 (body bij AMBER)
- Bij PEM levert de hefboom nooit een trainingsadvies op
- Learning loop noemt frictie, niet discipline
- Acceptatietest G: AAN en groen geeft iets speels, blauw geeft iets zachts, PEM geeft alleen wat niets vraagt
- Ankers horen bij de juiste toestand; het energie-anker belandt niet in een verstillingsvoorstel
- Toon: geen uitroeptekens, geen infantiele taal

**Regressie**: 29 hardlooptests, 35 weekkalendertests en 97 strength-tests
slagen onverkort.

**Browsertest** op 360, 390, 412 en 1280 px: geen console- of paginafouten,
geen horizontale overflow, alle panelen renderen.

**Vier fouten die de tests vonden en die nu weg zijn:** absolute
tempodrempels die voor deze gebruiker aan de verkeerde kant uitkwamen; een
onmogelijk wandeltempo als terugval; ankers die onzichtbaar werden zodra ze
aan een toestand hingen; en muziek voor verstilling in een voorstel om de
keuken bij elkaar te zingen.

---

## Mogelijke regressies

- De ronden-verrijking doet bij het opstarten tot drie Strava-aanroepen. Bij
  veel runs zonder ronden kan dat een paar opstarts duren voordat alles
  gevuld is. Er zit geen retry-storm in, maar het is nieuw gedrag.
- Vandaag heeft er twee kaarten bij (hefboom en aliveness). Beide zijn
  compact, maar de pagina is langer dan §33 strikt voorschrijft. Zeg het als
  je ze liever inklapt.
- `gc_pace_corrections` en `gc_anchors` zijn nieuwe sleutels; bij een oude
  browsersessie zonder cloud-hydratie zijn ze leeg tot je iets invult.

---

## Wat ik bewust niet heb aangeraakt

Het Supabase-schema, de RLS-policies, de storage-buckets, de hardloopcoach
met zijn rustdagpoort en race-forecast, de Strength Coach van vorige ronde,
de weekkalender, de navigatie en de bestaande gebruikersdata. Er is niets
verwijderd en niets overschreven.
