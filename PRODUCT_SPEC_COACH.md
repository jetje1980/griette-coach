# Griëtte Coach — productcontract

Deze specificatie is leidend bij refactors, security-migraties en opslagwijzigingen. De app mag nooit worden teruggebracht tot een simpele fitnesslogger.

## Productdoel
Griëtte Coach is een **Life Performance OS + Performance Coach + persoonlijke Chief of Staff**. Centrale vraag: wat is vandaag de verstandigste keuze richting de toekomstige zelf, gegeven lichaam, herstelcapaciteit, agenda, energie en prioriteiten? Cognitieve belasting moet dalen.

## Navigatie
Exact zes hoofdtabs: **Vandaag, Week, Lichaam, Leven, Progressie, Coach**. Instellingen via tandwiel. Geen extra hoofdtabs.

## Vandaag — Decision Cockpit
Binnen circa 15 seconden zichtbaar: coachstatus, geïntegreerd advies, waarom, maximaal drie prioriteiten, ruimte/vrije tijd en één concrete `Wat nu?`-actie. Details pas secundair.

Dagstatussen: `GREEN — TRAIN`, `AMBER — MODIFY`, `BLUE — RECOVERY`, `RED — STOP & REVIEW`.

## Eén Head Coach
Running, Strength, Recovery, Women’s Performance, Nutrition/Body Composition en Life/Executive Function mogen intern bestaan, maar de gebruiker ziet één geïntegreerde koers.

## Long COVID / PEM
Session performance en delayed tolerance zijn aparte signalen. Progressie pas na beoordeling van 6–48u respons (vermoeidheid, breinmist, spier/loodgevoel, slaap, HR, functionele terugslag). Rode vlaggen signaleren voor medische beoordeling; geen autonome diagnoses.

## Adaptieve training
Besluiten: `BUILD`, `HOLD`, `REPEAT`, `DELOAD`, `SWAP`, `TEST`. Nooit volume én intensiteit tegelijk verhogen. Trainingsdoelen omvatten BASE, ECONOMY, THRESHOLD, SPEED, 5K SPECIFIC, LONG EASY, TEST. Analyse omvat o.a. pace@HR, HR@pace, drift, recovery, RPE, benen/reserve, symptomen en delayed response.

## T1–T35
Alle 35 sessies moeten vindbaar blijven met plan, doel, uitvoering, aanpassings-/stopcriteria en resultaatgeschiedenis.

## Training invoer
Volledig bruikbaar zonder Strava. Minimaal handmatig, screenshot met AI-extractie + gebruikerscontrole vóór opslag, en optioneel Strava. Bewaar bron, confidence en user confirmation. Runna is read-only externe context (`TRAINING_EXTERNAL`), nooit een concurrerende waarheid.

## Kracht
Volwaardige pijler: squat/lunge, hinge, hip thrust/glutes, push, pull, core/carry, calves/feet. Log gewicht/reps/sets/RIR/RPE en toon progressive overload.

## Perimenopauze
Leer individuele patronen; geen generieke cyclusdogma’s. Dagcontext kan bloeding, cyclus, hormonale symptomen, slaap, energie, breinmist, gewrichten, opvliegers, stemming, trainingsrespons en PEM bevatten. Bloeding: Geen/Spotting/Licht/Normaal/Zwaar; nieuwe menstruatie kan dag 1 zetten; handmatige override blijft mogelijk.

## Historische data
Gezondheidsdata, gewicht, trainingen, kracht, metingen en relevante context moeten backdate/edit/delete ondersteunen. PLAN en ACTUAL blijven onderscheiden.

## Body composition / voeding / healthy aging
Niet blind op gewicht sturen. Combineer gewichtstrend, taille, foto’s, kledingfit, kracht, performance en herstel. Geen agressieve energierestrictie ten koste van herstel, hormonen, spiermassa, huid of slaap. Healthy aging = sterk, fit, fris, verzorgd, goede houding/energie; geen extreem dun ideaal.

## Future Self / Progress Wall
Domeinen: BODY, RUN, LOOK/FRESHNESS, MONEY, TIME/FREEDOM, LIFE/WORK. Koppel langere doelen naar vandaag. Progress Wall toont bewijs van verandering: body, taille, gewichtstrend, lopen/pace@HR, strength PR’s, buffer, vrije avonden, routines en milestones.

## Geld en vrije tijd
Financiële rust (bufferdoel €15.000) is een Life Performance-domein. Vrije tijd is KPI; protected free time wordt niet automatisch volgepland.

## ADHD / executive function
Maximaal drie echte prioriteiten; MUST/SHOULD/COULD. Maak vage taken concreet (liefst 5–30 min). `Wat nu?` geeft één actie. Transition Coach werkt met PREPARE → TRANSITION → DO → RECOVER en states AAN/UIT/GEREGULEERD. Plan op tijd + fysieke/cognitieve/sociale energie + frictie/runway.

Minimum viable self-care kent minimum/normal/high-capacity/recovery varianten. WIP-limits: circa 3 werkprojecten, 2 privéprojecten, 1 primaire body-verandering. Focus Seasons: PRIMARY / MAINTAIN / NOT NOW. Maandelijkse bottleneck. Re-entry: welkom terug, vanaf vandaag; geen achterstandstaal.

## Capture
`Capture now, decide later`: supersnel, geen categorisatie verplicht. Status en bestemming zijn afzonderlijk.

Status: `OPEN`, `PLANNEN`, `DELEGEREN`, `PARKEREN`, `KLAAR`.
Bestemming: `TODAY`, `WEEK`, `CALENDAR`, `TRELLO`, `PROJECT`, `LATER`.

Items blijven inspecteerbaar met zoeken, aanpassen, undo/reopen en verwijderen. Externe sync-fout mag nooit het bronitem laten verdwijnen.

## Externe bronnen
**Trello = backlog/projecten. Google Calendar = tijd. Griëtte Coach = beslist wat aandacht krijgt.**

Trello-bestemming moet uiteindelijk een echte card maken met instelbaar board/list, labels optioneel, externalId/externalUrl/syncstatus en idempotentie tegen duplicaten. Coach mag Trello read-context gebruiken.

Google Calendar is source of truth voor afspraken, vrije blokken, werkblokken, routines, protected free time en trainingstijd. Meerdere agenda’s categoriseren (PRIVATE, FAMILY, TRAINING_EXTERNAL, HOLIDAYS, WORK_MANUAL), met read/write-instellingen. Slechts één bewust gekozen write-target. Runna-calendar read-only. Werkagenda mag vervangen worden door globale werktijden/dagbelasting.

Behoud precies één dagelijkse kalenderherinnering met link naar de Coach-app.

## Week
Executive weekview: doelen, training, agenda, actieve projecten/Trello, rust, vrije tijd, bottleneck en capaciteit. Geen operationele databaseview.

## Traceerbaarheid
Acties onthouden bron en externe koppeling: source, sourceId, externalProvider, externalId, externalUrl, syncState, lastSyncedAt. Geen stille duplicaten.

## UI
Rustig, gededupliceerd, progressieve disclosure. Informatie die niet nodig is voor de beslissing van dit moment staat niet prominent in beeld.

## Leren
Coach leert over trainingsverdraagbaarheid, HR/pace, perimenopauzepatronen, PEM, slaap/werkbelasting, routines en overgangsfrictie. Bij onvoldoende data geen schijnzekere conclusie.

## Acceptatiezin
De gewenste ervaring is: **“Dit is vandaag je beste koers.”** Niet: “Wat wil je vandaag allemaal doen?”
