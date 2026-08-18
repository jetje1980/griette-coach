# GRIËTTE COACH — IMPLEMENTATIE-, TEST- EN AUDITRAPPORT

Datum: 18 augustus 2026 · Opgesteld door: Claude (Anthropic) in Claude Code

---

## 1. EXECUTIVE SUMMARY

Deze ronde bestond uit twee delen: een volledige UI/IA- en legacy-cleanup, en het functioneel afmaken van de coach-logica (doelen, hartslag, cyclus/Ajovi-historie, performance-indicatoren).

Verwijderd: 8.900 regels onbereikbare legacy code (21 bestanden), waaronder een tweede, concurrerend hardloopsysteem. Vandaag is herbouwd als cockpit met een performance strip; Week is een executive view met bottleneck en conflicten; Lichaam is de enige detailhub; Progressie toont bewijs in plaats van invoertegels. Nieuw: één centrale goal engine met haalbaarheidscheck, instelbare hartslag- en RPE-kaders, volledige CRUD op menstruatie- en Ajovi-historie, en een Capture Center waarin geen item meer onvindbaar wordt.

Wat nog niet werkt: **Strava is BROKEN in productie** (GitHub Pages is statische hosting, `/api` bestaat daar niet) en **Trello is NOT IMPLEMENTED** (bewust uitgeschakeld met zichtbare melding). Handmatige invoer en screenshot-import werken volledig zonder beide.

Belangrijkste risico — en dit is het zwaarste punt van dit rapport: **de Supabase-opslag heeft geen authenticatie en geen `user_id`-isolatie.** Alle app-data gaat als generieke key/value-rijen naar één tabel `gc_coach_data`, geüpsert op `key` alleen, met een publishable (anon) key in de client. Cross-device sync werkt daardoor wel, maar er is geen technische scheiding tussen gebruikers en geen verifieerbare RLS. Progressiefoto's gaan naar bucket `progress-photos` met paden zonder gebruikersmap. Ik kon de server-side policies niet inspecteren en claim daar dus niets over.

**ALGEMENE STATUS: PARTIAL** — de coach-functionaliteit is bruikbaar, de data-architectuur en privacy zijn niet af.

---

## 2. VERSION / DEPLOYMENT

| Item | Waarde |
|---|---|
| Repository | `jetje1980/griette-coach` |
| Werkbranch | `claude/coach-app-archive-missing-0dgmzb` |
| Commit SHA (code) | `a2edb1a85c02ad8d41cffc1e22628970d646add2` |
| Deployment branch | `gh-pages` |
| Deployment commit | `7a0e56a` |
| Live URL | https://jetje1980.github.io/griette-coach/ |
| Live JS bundle | `assets/index-CJtvFkRt.js` (identiek aan lokale build — geverifieerd) |
| Builddatum | 18 augustus 2026 |
| Supabase project-ref | `osuqtfsxmquwqsbgzlqn` (`https://osuqtfsxmquwqsbgzlqn.supabase.co`) |
| Supabase key in client | `sb_publishable_...` (publishable/anon, hardcoded in `sync.js`, `store.js`, `photoStore.js`) |
| Supabase tabel | `gc_coach_data` (generiek key/value) |
| Supabase bucket | `progress-photos` |
| Backend (Express) | `backend/server.js` — bestaat in de repo, is **niet** gedeployed naar productie |
| Edge Functions | geen |

---

## 3. FILES CHANGED

Totaal deze ronde: **38 bestanden, +2.403 / −9.483 regels.**

### Nieuw
| Bestand | Wat / waarom |
|---|---|
| `src/goals.js` | Centrale doelenstore (7 domeinen), HR/RPE-instellingen, feasibility check, body-composition-oordeel. Vervangt verspreide hardcoded targets. |
| `src/components/GoalSettings.jsx` | UI om alle doelen en HR-kaders te bewerken, met haalbaarheidsoordeel per doel. |
| `src/performance.js` | Berekening van herstel-, run build- en shape-percentages, capaciteit, weekbelasting, tolerantie-overzicht. |
| `src/tasks.js` | Uniform TaskItem-model met status en bestemming; migreert oude `gc_inbox`-items. |
| `src/components/CaptureCenter.jsx` | Canonieke Capture: statussen, bestemmingskeuze, delegeren, parkeren. |
| `src/components/CycleHistory.jsx` | Menstruatiestarts toevoegen/wijzigen/verwijderen met intervalanalyse. |

### Verwijderd (onbereikbaar vanaf `App.jsx`, elk met levende vervanger)
`CheckIn.jsx` (2351), `Progressie.jsx` (1095), `Training.jsx` (945), `Coach.jsx` (782), `Glow.jsx` (500), `WeekFocus.jsx` (439), `Ritme.jsx` (422), `Calendar.jsx` (391), `Patronen.jsx` (382), `Eten.jsx` (328), `data/dailyMenus.js` (280), `Trainingsplan.jsx` (253), `PlanningContext.jsx` (219), `Lichaam.jsx` (199), `Badges.jsx` (121), `Header.jsx` (101), `data/tips.js` (72), `PlanningHub.jsx` (33), `MeerTab.jsx` (22), `VoortgangHub.jsx` (20), `TabBar.jsx` (17).

**Migratie-impact: geen.** Deze bestanden waren niet bereikbaar vanaf de app-root en schreven dus niets meer. Hun localStorage-sleutels zijn niet verwijderd.

### Gewijzigd (belangrijkste)
| Bestand | Wat | Migratie-impact |
|---|---|---|
| `VandaagScreen.jsx` | Herbouwd als cockpit: Decision Cockpit, performance strip, Wat Nu?-ranking, Top 3, dagplanning, compacte check-in met "Meer registreren". | Leest nu `gc_executive_focus` met terugval op `gc_focus_season`; oude sleutel blijft intact. |
| `LichaamScreen.jsx` | Subtabs naar Training/Herstel/Body/Cyclus/Voeding/Medicatie; bloedingsregistratie + dag 1; Ajovi-historie CRUD; cyclushistorie; Strava-status eerlijk. | Nieuwe logvelden `bleeding`, `cycle_day_one`. Ajovi-historie krijgt `id`-veld bij inlezen (backwards compatible). |
| `WeekScreen.jsx` | Weekdoel, bottleneck, conflicten; prioriteiten direct zichtbaar. | Weekdoel gebruikt **nieuwe** sleutel `gc_week_goal_` omdat `gc_week_focus_` al een ander model bevatte. |
| `ProgressieScreen.jsx` | Startscherm is "Bewijs dat ik verander"; 5K-tests CRUD; pace@HR; PLAN vs ACTUAL. | Geen. |
| `LevenScreen.jsx` | Subtabs Taken/Focus/Routines/Geld/Toekomst/Glow/Eten; twee gescheiden focusmodellen; Doelen-view. | Nieuwe sleutels `gc_executive_focus`, `gc_future_focus_seasons`. |
| `config.js` | `USER` komt uit bewerkbare `gc_body_config`; restrictieve gewoonte-labels geherformuleerd. | Bestaande waarden blijven default. |
| `ai.js` | Doelgewicht uit config (was 55 hardcoded in de prompt, 57 in config); canonieke voedingslogica toegevoegd. | Geen. |
| `data/sessionDetail.js` | HR-zone, warming-up en stopcriteria uit instellingen. | Geen. |
| `data/runningSchema.js` | Dode datum-helpers verwijderd (`getRunDate`, `getRunStatus`). | Geen — alleen door verwijderde code gebruikt. |
| `index.css` | `overflow-x: hidden` op body als layout-vangnet. | Geen. |

---

## 4. FUNCTIONALITY STATUS MATRIX

| Functionaliteit | Status | Getest? | Bewijs / locatie | Opmerking |
|---|---|---|---|---|
| Decision Cockpit | DONE | Ja | `VandaagScreen.jsx` `DecisionCockpit` | Status + actie + reden + "niet vandaag" in één kaart |
| GREEN/AMBER/BLUE/RED | DONE | Ja | `CoachAdvice.jsx` `computeHeadCoach` | Getoond bij alle viewports |
| Wat Nu | DONE | Ja | `computeWatNu` | Rankt op prioriteit, herkomst, cognitieve energie |
| Top 3 | DONE | Ja | `Top3` | Max 3, koppelt terug naar Capture |
| Transition Coach | PARTIAL | Ja | `Transitions` | Buffermomenten werken; AAN/UIT/GEREGULEERD als expliciete toestand is **niet** geïmplementeerd |
| Re-entry Mode | NOT IMPLEMENTED | n.v.t. | — | Zat in verwijderde legacy code; niet herbouwd |
| T1–T35 | DONE | Ja | `TrainingPlan.jsx` | Alle 35 uitklapbaar met volledige instructie |
| run/walk | DONE | Ja | `runningSchema.js` + `sessionDetail.js` | runMin/walkMin/reps per sessie |
| HR-based training | DONE | Ja | `goals.js` `loadHrSettings` | Instelbaar, niet meer hardcoded |
| delayed PEM / 24–48u | DONE | Ja | `workouts.js` `toleranceFor` + `RecoveryCheck` | Getest: slechte respons blokkeert BUILD |
| BUILD/HOLD/REPEAT/DELOAD/SWAP/TEST | DONE | Ja | `computeNextSession` | Getest via flow 2 |
| Editable running goals | DONE | Ja | `GoalSettings.jsx` | 7 run-metrics |
| Editable body goals | DONE | Ja | `GoalSettings.jsx` | Gewicht/taille/heup/vet%/kledingmaat |
| Goal feasibility | DONE | Ja | `goals.js` `feasibilityCheck` | Getest via flow 3 |
| Body composition | DONE | Nee (logica gebouwd, niet met echte reeks getest) | `bodyCompositionVerdict` | Herkent recompositie |
| Strength | DONE | Ja (eerdere ronde) | `strengthSchema.js` | 7 bewegingspatronen, RIR, overload-advies |
| Historical menstruation | DONE | Ja | `CycleHistory.jsx` | Create/edit/delete getest |
| Bleeding tracking | DONE | Ja | `LichaamScreen` `BLEEDING_OPTS` | 5 niveaus + dag 1 |
| Historical Ajovi | DONE | Ja | `AjoviTracker` | Create/edit/delete met dosis/notitie/bijwerking |
| Screenshot import | PARTIAL | Ja (flow + fallback) | `WorkoutForm.jsx` + `ai.extractWorkout` | Flow werkt; AI-extractie zelf **NOT VERIFIED** (geen AI-route in testomgeving) |
| Manual workout import | DONE | Ja | `WorkoutForm.jsx` | Werkt ook zonder backend |
| Strava | BROKEN | Ja | zie §9 | Geen backend in productie |
| Trello | NOT IMPLEMENTED | Ja (UI-melding) | `CaptureCenter.jsx` | Expliciet uitgeschakeld |
| Future Self | DONE | Ja (eerdere ronde) | `LevenScreen` `DreamBoard` | 6 domeinen, eigen foto's |
| Progress Wall | DONE | Ja | `ProgressieScreen` `TabOverzicht` | "Bewijs dat ik verander" |
| Supabase persistence | PARTIAL | Nee | `sync.js` | Key/value sync, geen source of truth — zie §11 |
| Cross-device persistence | PARTIAL | Nee | `sync.js` | Werkt technisch, maar zonder auth/isolatie — zie §12 |
| Authentication | NOT IMPLEMENTED | Ja (code-audit) | — | Geen `supabase.auth` in de codebase |
| RLS | NOT VERIFIED | Nee | — | Geen toegang tot Supabase-policies |
| Photo privacy | NOT VERIFIED | Nee | `photoStore.js` | Bucket-policy onbekend; paden zonder user-map |
| Mobile layout | DONE | Ja | 360/390/412px | 0 overflow, 0 console-errors |
| Desktop layout | DONE | Ja | 1280px | 0 overflow, 0 console-errors |

---

## 5. RUNNING ENGINE AUDIT

**CANONICAL RUNNING ENGINE:** T1–T35 run/walk-schema (`src/data/runningSchema.js`) met adaptieve sessiekeuze in `src/components/CoachAdvice.jsx` (`computeNextSession`) en volledige instructie via `src/data/sessionDetail.js`.

**LEGACY/CONFLICTING ENGINE:** **removed.** Het tweede systeem zat in `components/Training.jsx` (945 regels) met een vast raceplan en gebruikte `getRunDate()`/`getRunStatus()` uit `runningSchema.js` om sessies aan vaste kalenderdata te koppelen. Dat bestand is verwijderd en die twee helperfuncties zijn uit `runningSchema.js` gesloopt, zodat een lineair datumpad niet opnieuw kan ontstaan. Ook `Trainingsplan.jsx` (oude statische schemaweergave) is verwijderd.

**Hoe het nu werkt:**
- **Sessiereeks:** 35 sessies dienen als bibliotheek, niet als kalender. De volgende sessie is `max(gedane sessies) + 1` — maar alleen in de staat BUILD.
- **run/walk:** elke sessie heeft `runMin`, `walkMin`, `reps`, `duration`. De instructie toont warming-up, kern, run/walk-verhouding, HR-band, RPE-doel, doel, waarom, cooling-down, aanpassingscriteria en "coach observeert vandaag".
- **HR:** komt uit `gc_hr_settings` (easyLow, easyHigh, walkTrigger, resumeBelow, rpeEasy, rpeThreshold). De sessiekaart, de warming-up-instructie en de stopcriteria worden hieruit opgebouwd.
- **PEM/delayed tolerance blokkeert progressie:** `toleranceFor(workout, logs)` kijkt naar dag +1 en +2 na een training. Bij `poor` (delayed fatigue, brainfog, kortademigheid, PEM, of een expliciet "niet goed" op de herstelcheck) wordt BUILD nooit toegekend — het wordt REPEAT, of DELOAD bij PEM. Zonder een **expliciet beantwoorde** herstelcheck blijft de coach op HOLD; een groene ochtend alleen is niet genoeg.
- **Zware sessie remt ook:** RPE ≥ 7, zware benen, "nee" op meer gekund, of een gestopte sessie → HOLD (of DELOAD bij gestopt), ook bij groene readiness. Getest.
- **Gewijzigd afstand-/tempodoel:** `feasibilityCheck()` berekent de benodigde weekgroei uit echte workoutdata en vergelijkt met wat herstel toelaat (8%/week normaal, 5% bij recente PEM-signalen). Uitkomst: haalbaar / ambitieus / nu niet verantwoord, met de realistische week-schatting. **Een kortere deadline verhoogt de opbouwsnelheid niet** — de code schuift de datum, niet het schema.
- **Volume en intensiteit tegelijk:** de reeks verhoogt per stap óf loopduur óf pauzeverkorting, nooit beide, en de adaptieve staat kan alleen één stap vooruit. Er is geen codepad dat twee stappen tegelijk toekent.

**RUNNING ENGINE STATUS: PASS**

---

## 6. GOAL ENGINE AUDIT

Alle doelen staan in `gc_goals` en zijn te bewerken via **Leven → Focus → Doelen**.

| Domein | Metrics | Coachlogica die reageert |
|---|---|---|
| RUN | comfortabele run/walk-duur, aaneengesloten lopen, afstand, 5K-tijd, easy tempo, max hardloopdagen/week, max sessieduur | `feasibilityCheck()`; afstand-/duurdoel |
| BODY | gewicht, ondergrens, taille, heup, vetpercentage, kledingmaat | `shapeScore()` in de performance strip; AI-context |
| SHAPE | krachtfocus, squat, hinge, hip thrust, push-ups, sessies/week | Progressie → Strength |
| FRESHNESS | slaapuren, PEM-dagen/maand, automatische routines | Progressie → Fresh |
| MONEY | buffer | Progressie → Money |
| TIME | vrije avonden, beschermde uren | Progressie → Freedom |
| LIFE_WORK | max actieve projecten | WIP-limiet |

Hartslag- en RPE-kaders staan in `gc_hr_settings`, bewerkbaar op hetzelfde scherm.

**Opgeloste conflicten:**
- Doelgewicht stond op **57** in `config.js` en op **55** in de AI-prompt in `ai.js`. Nu één bron: `USER.goalWeight` uit `gc_body_config`, met `goalTarget('BODY','weight')` als doel-override.
- `minWeight` 45 was hardcoded in `ai.js` (`const MIN_WEIGHT = 45`) → nu `USER.minWeight`.
- HR 106–132 was hardcoded in `sessionDetail.js` en de RUNS-strings → nu uit instellingen.

**REMAINING HARDCODED PERSONAL GOALS:**
- `src/config.js` — `BODY_DEFAULTS` (startWeight 62.7, goalWeight 57, minWeight 45, hrZone 106–132). Dit zijn **defaults** die door `gc_body_config` en `gc_goals` worden overschreven, geen dominante waarden. Bewust behouden als startpunt.
- `src/config.js` — `PERSONAL_EVENTS`: vaste races en mijlpalen met data in 2026 (o.a. Trail 3 okt, Bereloop 30 okt). Deze zijn **weergave-only** (tijdlijn, countdown) en bepalen geen training. Eigen mijlpalen zijn wel toe te voegen via Progressie → Tijdlijn.
- `src/data/trainingBlocks.js` — `TRAINING_BLOCKS` met vaste blokdatums. Deze zijn richtinggevend; `blockExpectation()` schuift de verwachte einddatum op basis van werkelijke setbacks. Niet gekoppeld aan `gc_goals`.
- `src/ai.js` — `PRIK_SCHEMA` (Mounjaro-injectiedata) en de `EVENTS`-lijst in `buildContext`: hardcoded historische context voor de AI-prompt, niet bewerkbaar in de UI.
- `src/data/runningSchema.js` — `km_estimate` en `hrZone`-strings per sessie: schattingen die met `ACTUAL`-labels worden overschreven waar echte data bestaat.

---

## 7. MENSTRUATIE / PERIMENOPAUZE AUDIT

| Test | Resultaat |
|---|---|
| Historische menstruatiestart toevoegen (vrije datum) | PASS — twee starts toegevoegd (2026-06-15, 2026-07-18) |
| Edit (datum wijzigen) | PASS — 07-18 → 07-20 geverifieerd in storage |
| Delete | PASS — verwijderd uit storage |
| Dag 1-markering | PASS — "Nieuwe menstruatie gestart?" zet `gc_cycle_start` op de huidige datum en schuift de vorige naar historie |
| Bleeding intensity | PASS — Geen/Spotting/Licht/Normaal/Zwaar, opgeslagen als `log.bleeding` per dag |
| Spotting | PASS — eigen niveau |
| Historische patronen meegenomen | PASS — intervallen en gemiddelde cycluslengte berekend en getoond ("gemiddeld 33 dagen" bij de testdata) |
| Persoonlijke patroonanalyse | PASS — per fase gemiddelde slaap/energie/PEM, met aantal waarnemingen; conclusies pas vanaf 5 observaties per fase |
| Handmatige override | PASS — cyclusfase blijft handmatig instelbaar naast de berekende cyclusdag |
| Generieke dogma's verwijderd | PASS — "piek-energie", "beste moment voor intensere training" bestaan niet meer; vervangen door neutrale context |

**Opslag:** `gc_cycle_start` (nieuwste), `gc_cycle_history` (volledige lijst), `log.bleeding` en `log.cycle_day_one` per dag in `gc_log_{datum}`.

---

## 8. AJOVI AUDIT

| Test | Resultaat |
|---|---|
| Huidige injectie registreren | PASS — "Vandaag gegeven" schuift de volgende datum door |
| Historische injectie toevoegen | PASS — 2026-05-01 met dosis 225mg |
| Edit | PASS — notitie "goed verdragen" toegevoegd en teruggelezen |
| Delete | PASS — bevestigingsdialoog + verwijdering |
| Refresh | PASS — data blijft (localStorage) |
| Andere sessie/device | NOT VERIFIED — afhankelijk van Supabase-sync (§11) |
| Patroondata beschikbaar voor Coach | PASS — `ai.js` `migraineContext` gebruikt `gc_ajovi_history` samen met migraine, triggers, ernst en duur |

Velden: datum, dosis, notitie, bijwerking. Correlatie wordt in de coach-prompt niet als causaliteit gepresenteerd.

---

## 9. STRAVA — BEWIJS, GEEN AANNAME

**STRAVA STATUS: BROKEN (in productie)**

**Reden:** de live app staat op GitHub Pages, dat uitsluitend statische bestanden serveert. De Express-backend in `backend/server.js` met de endpoints `/api/strava/status|auth|callback|sync|activities|disconnect` is nergens gedeployed. `store.js` detecteert dit via `fetch('/api/strava/status')`; die request gaat naar `https://jetje1980.github.io/api/strava/status` en bestaat niet.

**Daadwerkelijk uitgevoerde tests** (met een Playwright-route die alle `/api/**` calls op 404 zet, om de productiesituatie te simuleren):

| Test | Resultaat |
|---|---|
| status endpoint | BROKEN — 404; app onderschepte `/api/strava/status` en `/api/strava/activities` |
| UI claimt "gekoppeld" | NEE (correct) — geverifieerd `false` |
| UI meldt onbereikbare backend | PASS — toont "Strava-backend niet bereikbaar" met uitleg dat handmatig/screenshot wel werkt |
| Handmatige invoer blijft werken zonder backend | PASS |
| Workout opslaan zonder backend | PASS — `gc_workouts` gevuld |
| OAuth start | NOT VERIFIED |
| OAuth callback | NOT VERIFIED |
| Token persistence | NOT VERIFIED |
| Activity read | NOT VERIFIED |
| Duplicate prevention | NOT VERIFIED |
| Disconnect / reconnect | NOT VERIFIED |

**Wat nodig is:** de Express-backend deployen (bijv. Fly.io, Railway, Render of een Supabase Edge Function), `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` daar zetten, de callback-URL in de Strava-app registreren, en de backend-URL in de frontend configureren (het veld voor een externe backend-URL bestaat al voor de AI-route in Instellingen; voor Strava gebruikt `api.js` nog relatieve paden).

---

## 10. TRELLO — BEWIJS, GEEN AANNAME

**TRELLO STATUS: NOT IMPLEMENTED** (zichtbaar en eerlijk uitgeschakeld)

In een eerdere fase van deze sessie is een Trello-client (`trello.js`) geschreven, maar die was nergens aangesloten en is verwijderd omdat de opdracht in deze ronde expliciet geen nieuwe externe integraties toestond. Wat er nu staat:

- In het Capture Center is "Trello Backlog" zichtbaar als bestemming, maar **disabled**, met de tekst **"Trello nog niet gekoppeld"** in waarschuwingskleur en een niet-klikbare rij. Getest: de tekst verschijnt en de rij is niet selecteerbaar.
- Het `TaskItem`-model bevat al `trelloCardId`, `trelloBoardId`, `trelloListId` en `trelloUrl`, plus `findByTrelloCard()` voor duplicaatpreventie. Een latere integratie hoeft het model niet te wijzigen.

| Test | Resultaat |
|---|---|
| auth | NOT APPLICABLE (geen integratie) |
| card creation | NOT APPLICABLE |
| correct board/list | NOT APPLICABLE |
| externalId / externalUrl | velden bestaan, ongebruikt |
| retry / idempotency | NOT APPLICABLE |
| duplicate prevention | helper aanwezig, ongebruikt |
| UI zegt eerlijk "niet gekoppeld" | PASS |

---

## 11. SUPABASE DATA AUDIT

**Architectuur nu:** `store.js` schrijft altijd naar localStorage; `sync.js` onderschept élke `localStorage.setItem` en pusht 2 seconden later **alle** `gc_*`-sleutels als key/value-rijen naar `gc_coach_data` (`upsert`, `onConflict: 'key'`). Bij het opstarten haalt `restoreFromCloud()` alle rijen op en schrijft ze terug in localStorage.

**Supabase is dus GEEN source of truth** — het is een key/value-back-up van localStorage. Er is geen schema, geen per-record-versionering en geen conflictresolutie behalve "laatste schrijver wint per sleutel".

| Datatype | Source of truth | Cache | Supabase table/bucket | user_id? | RLS? | Legacy local? |
|---|---|---|---|---|---|---|
| Daily logs (`gc_log_{datum}`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Gewicht, bloeddruk | localStorage (in daily log) | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Workouts (`gc_workouts`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Delayed feedback (`recovery_check` in log, `gc_adaptive_log`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Strength (`gc_strength_sessions`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Measurements (`gc_measurements`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Goals (`gc_goals`, `gc_body_config`, `gc_hr_settings`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Cycle (`gc_cycle_start`, `gc_cycle_history`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Bleeding (in daily log) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Ajovi (`gc_ajovi_history`, `gc_ajovi_next`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Capture/tasks (`gc_tasks`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | `gc_inbox` gemigreerd |
| Routines (`gc_routines`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Future Self (`gc_future_self`, `gc_dreamboard`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| Money (`gc_geld`, `gc_geld_history`) | localStorage | Supabase kv | `gc_coach_data` | NEE | NOT VERIFIED | — |
| **Progressiefoto's** | IndexedDB `gc_photos` | — | bucket `progress-photos`, pad `{datum}/{type}.jpg` | **NEE (geen user-map)** | NOT VERIFIED | — |
| **Dream Board-afbeeldingen** | IndexedDB `gc_dreams` | — | **geen** | n.v.t. | n.v.t. | **LOCAL-ONLY** |
| **Workout-screenshots** | IndexedDB `gc_workout_imgs` | — | **geen** | n.v.t. | n.v.t. | **LOCAL-ONLY** |
| **Foto-analyses** (`gc_photo_analysis_*`) | localStorage | — | **uitgesloten van sync** | n.v.t. | n.v.t. | **LOCAL-ONLY** |
| **Strava tokens** (`gc_strava_*`) | localStorage | — | **uitgesloten van sync** | n.v.t. | n.v.t. | **LOCAL-ONLY** (bewust) |
| **AI-sessiesleutel** | sessionStorage | — | nooit | n.v.t. | n.v.t. | verdwijnt bij sluiten browser |

**Structureel belangrijke sleutels die nog bestaan:** `gc_day_plan_{datum}`, `gc_day_actions_{datum}`, `gc_top3_{datum}`, `gc_transitions_{datum}`, `gc_shutdown_{datum}`, `gc_week_prio_{maandag}`, `gc_week_goal_{maandag}`, `gc_week_review_{maandag}`, `gc_5k_tests`, `gc_custom_events`, `gc_glow_events`, `gc_projecten`, `gc_food_prefs`, `gc_executive_focus`, `gc_future_focus_seasons`, `gc_focus_season` (legacy, alleen gelezen), `gc_week_focus_{maandag}` (legacy van verwijderde component, onaangeroerd), `gc_coach_report*`, `gc_monthly_bottleneck*`, `gc_current_run`, `gc_wip_limit`, `gc_ai_endpoint`, `gc_onboarding_done`, `gc_last_data_change`.

---

## 12. PRIVACY / SECURITY AUDIT

**AUTH: FAIL** — er is geen authenticatie. Nergens in de codebase staat `supabase.auth`, geen sign-in, geen sessie, geen `auth.uid()`. De app is volledig anoniem.

**RLS: NOT VERIFIED** — ik heb geen toegang tot het Supabase-project en kan de policies niet inspecteren. Wat ik uit de client wél feitelijk kan vaststellen:
- `gc_coach_data` wordt geüpsert met `onConflict: 'key'`, dus de primaire sleutel is `key` alleen. Er is **geen `user_id`-kolom** in de payload.
- `restoreFromCloud()` doet `select('key, value')` zonder filter en schrijft álles wat terugkomt naar localStorage.
- Als er geen restrictieve policy bestaat, kan iedere houder van de publishable key alle gezondheidsdata lezen en overschrijven. Aangezien de sync in de praktijk werkt zonder auth, is een permissieve anon-policy waarschijnlijk — maar dat is een gevolgtrekking, geen verificatie.

**PHOTO STORAGE: UNKNOWN** — bucket `progress-photos`, paden `{datum}/{type}.jpg` zonder gebruikersmap. Of de bucket publiek is, kon ik niet vaststellen.

**CROSS-APP ISOLATION: NOT VERIFIED** — ik heb geen zicht op de andere apps (Wardrobe, Reizen, Stijlstudio) en kan niet bepalen of die hetzelfde Supabase-project of dezelfde key gebruiken. Zolang alles in één project met één anon key en één generieke tabel staat, is de blast radius per definitie het hele project.

**CLIENT-SIDE SECRETS:**
- Supabase publishable/anon key, hardcoded in `sync.js`, `store.js` en `photoStore.js` — dit is per ontwerp publiek, maar alléén veilig ín combinatie met werkende RLS.
- **Geen** service-role key in de client (geverifieerd).
- **Geen** Anthropic API-key persistent in de browser: de oude `gc_api_key` wordt bij het opstarten uit localStorage verwijderd en naar sessionStorage gemigreerd; AI loopt primair via een server-proxy.

**Aanbevolen remediatie (niet uitgevoerd — vereist Supabase-toegang):**
```sql
-- 1. Auth invoeren in de app (Supabase Auth, magic link of e-mail/wachtwoord)
-- 2. Kolom toevoegen zonder bestaande data te raken
alter table gc_coach_data add column if not exists user_id uuid default auth.uid();
-- 3. Bestaande rijen toewijzen aan de eigenaar (vul het juiste uuid in)
update gc_coach_data set user_id = '<UUID_VAN_GRIETTE>' where user_id is null;
-- 4. Unieke sleutel per gebruiker in plaats van globaal
alter table gc_coach_data drop constraint if exists gc_coach_data_pkey;
alter table gc_coach_data add primary key (user_id, key);
-- 5. RLS aan
alter table gc_coach_data enable row level security;
create policy "eigen rijen lezen"    on gc_coach_data for select using (auth.uid() = user_id);
create policy "eigen rijen invoegen" on gc_coach_data for insert with check (auth.uid() = user_id);
create policy "eigen rijen wijzigen" on gc_coach_data for update using (auth.uid() = user_id);
create policy "eigen rijen wissen"   on gc_coach_data for delete using (auth.uid() = user_id);
-- 6. Storage: bucket privé + paden per gebruiker
update storage.buckets set public = false where id = 'progress-photos';
create policy "eigen foto's" on storage.objects for all
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
```
Let op: de client moet dan óók `user_id` meesturen en de fotopaden naar `{user_id}/{datum}/{type}.jpg` verplaatsen. Doe dit met een backup en readback-verificatie vóór het verwijderen van oude paden.

---

## 13. DATA MIGRATION STATUS

| Migratie | Voor | Na | Verificatie |
|---|---|---|---|
| `gc_inbox` → `gc_tasks` | 1 testitem met status "plannen" | 1 taak met status "planned" | PASS — getest in de browser, titel en status kloppen; `gc_inbox` wordt daarna opgeruimd |
| `gc_api_key` → sessionStorage | 1 sleutel in localStorage | localStorage leeg, sessionStorage gevuld | PASS — getest |
| `gc_focus_season` → `gc_executive_focus` | `{name: 'Oud seizoen'}` | seizoensnaam overgenomen | PASS — oude sleutel **niet** overschreven, alleen gelezen |
| Ajovi-historie krijgt `id` | items zonder id | items met gegenereerde id | PASS — backwards compatible bij inlezen |
| `gc_body_config` | bestond niet | defaults uit `config.js` | PASS — geen bestaande data geraakt |
| `gc_goals` | bestond niet | 4 doelen geseed uit config | PASS — eenmalig, alleen als leeg |

**Bewust niet verwijderd:** `gc_week_focus_{maandag}` (data van de verwijderde WeekFocus-component). Ik heb hier een echte bug voorkomen: mijn nieuwe weekdoel gebruikte eerst dezelfde sleutel, wat een object-model met een string zou hebben overschreven. Het weekdoel gebruikt nu `gc_week_goal_`; de oude data blijft leesbaar staan. Getest met een gesimuleerd legacy-object.

**Local-only data die nog bestaat:** Dream Board-afbeeldingen, workout-screenshots, foto-analyses, Strava-tokens (zie §11). Geen cloud-migratie uitgevoerd.

---

## 14. VISUALISATION AUDIT

| Visualisatie | Databron | Minimaal aantal datapunten | Fallback |
|---|---|---|---|
| Herstel% (strip) | slaap, energie, herstelgevoel, symptomen (3 dagen) | 2 ingevulde dagen | streepje + "te weinig check-ins" |
| Run build% (strip) | hoogste voltooide T-sessie | 0 | 0% + "nog niet gestart" |
| Shape% (strip) | gewichtsreeks + doel uit goal engine | 1 weging + doel | streepje + reden |
| Capaciteit (strip) | dagcapaciteit, energie, recente belasting | energie ingevuld | streepje |
| Gewichtstrend (sparkline) | `gc_log_*.weight` | 2 | grafiek verschijnt niet |
| Energietrend (30-dagen SVG) | `log.energy` | 3 | grafiek verschijnt niet |
| Weekbelasting (staafjes) | run-dagen per week, 4 weken | 0 (toont nullen) | — |
| Krachtvolume (staafjes) | kg×sets×reps per week | 1 sessie | leeg-state met uitleg |
| pace@HR / running economy | workouts met HR 120–135 | **3** | tekst: "nog te weinig sessies (n/3)" |
| Slaapkwaliteit (balken) | `log.sleep_quality` | 1 | balken op 0 |
| Bewijs dat ik verander | gewicht, taille, sessies, pace@HR, 5K, lift, buffer, vrije avonden, routines | per regel eigen minimum | regel wordt weggelaten |
| Foto start → vorige → nu | IndexedDB `gc_photos` | 2 sessies | sectie verschijnt niet |
| Bufferprogressie | `gc_geld` + historie | 1 stand | groeisectie verschijnt niet |
| Vrije tijd (4-weken trend) | `gc_day_plan_*.freeBlocks` | 0 | nullen |
| Tijdlijn mijlpalen | `PERSONAL_EVENTS` + `gc_custom_events` | — | — |
| Cyclusintervallen | `gc_cycle_history` | 2 starts | "gemiddeld" wordt weggelaten |

Regel gehandhaafd: **geen grafiek en geen percentage bij onvoldoende data.**

---

## 15. UX / INFORMATION ARCHITECTURE

**VANDAAG** — standaard zichtbaar: datum + seizoen, herstelcheck (alleen na training gisteren), Decision Cockpit (status, exacte sessie, twee redenen, "niet vandaag"), performance strip (4 KPI's), Wat Nu? (één actie), Top 3, dagplanning met beschermde blokken, compacte check-in (slaap, energie, herstel, klachten, gewicht) met "Meer registreren → Lichaam". Achter uitklap: Capture, dagtype/energie per dagdeel, shutdown. Overgangsmomenten alleen als er iets te bufferen valt. Verwijderd uit de primaire flow: medicatie, supplementen, voedingsvragen, hormonale registratie, migraine- en Ajovi-details, lichaamsmetingen, alcohol/water/eiwit, historische tabellen, lange tips. Paginahoogte ~1.580px in plaats van een formuliermuur.

**WEEK** — weekdoel, bottleneck van de week, weekprioriteiten (max 3, direct zichtbaar), conflicten (training vs herstel, training in beschermd blok, opeenstapeling werk+training), WIP-waarschuwing, vier samenvattingstegels, 7-dagenlijst, volgende week als strip, aankomende momenten, weekafsluiting. MERGED: de dubbele weekprioriteiten-uitklap. DELETED: losse Weekfocus-, Ritme- en Calendar-componenten.

**LICHAAM** — zes subtabs: Training (beslissen/registreren/T1–T35/roadmap/kracht/Strava), Herstel (symptomen, ADHD-pacing, migraine, delayed response), Body (volledige check-in + gewicht/bloeddruk/battery + maten met historie), Cyclus (bloeding, dag 1, patronen, cyclushistorie, Ajovi), Voeding, Medicatie. MERGED: check-in en maten samen in Body; het dubbele coachadvies is uit Herstel verwijderd.

**LEVEN** — zeven subtabs: Taken (Capture + projecten met WIP-limiet), Focus (seizoen + domeinen + doelen), Routines, Geld, Toekomst (Dream Board + Future Self), Glow, Eten. MERGED: Capture en projecten onder één Taken-tab. Focus Seasons is één model, geen twee.

**PROGRESSIE** — startscherm "Bewijs dat ik verander" (bewijsregels + foto's + volgende mijlpaal + streak), daarna Body, Run, Strength, Fresh, Money, Freedom, Routines, Tijdlijn. Geen invoerformulieren behalve 5K-tests en eigen mijlpalen (interpretatie hoort hier, invoer elders).

**COACH** — Nu, Weekanalyse, Maand. Bevat geen readiness-widget, geen Top 3, geen Wat Nu? — geverifieerd met een grep: geen tweede dagdashboard.

---

## 16. TEST RESULTS

| Command | Resultaat |
|---|---|
| `npm install` | PASS (dependencies al aanwezig, geen vulnerabilities gemeld) |
| `npm run build` | **PASS** — `vite build`, 93 modules, ~600 kB JS / 167 kB gzip, geen errors |
| `npm test` | NOT APPLICABLE — script bestaat niet in `package.json` (scripts: dev, build, preview) |
| `npm run lint` | NOT APPLICABLE — script bestaat niet |

**Viewporttests** (Playwright/Chromium, alle 6 hoofdtabs per viewport, gemeten op horizontale overflow, lege schermen, React-errors en console-errors):

| Viewport | Overflow | Lege schermen | Page errors | Console errors | Resultaat |
|---|---|---|---|---|---|
| 360 × 740 | 0 | 0 | 0 | 0 | PASS |
| 390 × 844 | 0 | 0 | 0 | 0 | PASS |
| 412 × 915 | 0 | 0 | 0 | 0 | PASS |
| 1280 × 800 | 0 | 0 | 0 | 0 | PASS |

---

## 17. USER FLOW TESTS

| Flow | Resultaat | Toelichting |
|---|---|---|
| FLOW 1 — nieuwe gebruiker → onboarding → doel → dashboard | **PASS** | Onboarding verschijnt bij lege storage; doelenscherm bereikbaar; dashboard laadt. Login bestaat niet (§12). |
| FLOW 2 — T-sessie loggen → feedback → delayed feedback → BUILD/HOLD | **PASS** | Zonder herstelcheck geen T10 (HOLD); na "goed hersteld" wordt T10 vrijgegeven |
| FLOW 3 — doel 5 km → 8 km → strategie verandert, safety blijft | **PASS** | Haalbaarheidscheck verschijnt met verdict; opbouwsnelheid wordt niet verhoogd |
| FLOW 4 — gewichtsdoel wijzigen → coach gebruikt nieuw target | **PASS** | 58 kg opgeslagen in `gc_goals`; Shape-KPI rekent met het nieuwe doel |
| FLOW 5 — historische menstruatie toevoegen → history + patroon | **PASS** | Create, edit en delete geverifieerd in storage; gemiddelde cycluslengte berekend |
| FLOW 6 — historische Ajovi → zichtbaar, edit, delete | **PASS** | Create met dosis, edit met notitie geverifieerd |
| FLOW 7 — Capture → Plannen → Vandaag → blijft vindbaar | **PASS** | Na refresh zichtbaar in dagplanning én onder status "Gepland" met bestemming |
| FLOW 8 — Capture → Trello → echte card of duidelijke melding | **PASS (als melding)** | "Trello nog niet gekoppeld", rij uitgeschakeld |
| FLOW 9 — Strava connect → OAuth → sync | **FAIL / PARTIAL** | Stopt bij stap 1: `/api/strava/status` bestaat niet in productie. App degradeert correct en meldt dit. Oorzaak: backend niet gedeployed. |
| FLOW 10 — progressiefoto → refresh → ander device | **PARTIAL / NOT VERIFIED** | Upload en refresh-persistentie werken (getest met Dream Board-afbeeldingen in IndexedDB). Cross-device niet te verifiëren zonder tweede sessie en zonder auth. |

---

## 18. BUGS FOUND AND FIXED

| Bug | Severity | Root cause | Fix | Retested? |
|---|---|---|---|---|
| LevenScreen crashte volledig bij openen van Focus | **P0** | `<TabFocus logs={logs} />` verwees naar een `logs` die LevenScreen niet als prop kreeg → `ReferenceError`, witte tab | `logs` doorgegeven vanuit App + default `{}` | Ja — tab laadt, alle 7 subtabs klikbaar |
| Twee concurrerende hardloopsystemen | **P0** | `Training.jsx` bevatte een vast raceplan met `getRunDate()`, naast T1–T35 | Component verwijderd, datum-helpers uit `runningSchema.js` gesloopt | Ja — één engine, `computeNextSession` |
| Conflicterende doelgewichten (57 in config, 55 in AI-prompt, 45 als floor) | **P1** | Waarden hardcoded op drie plekken | Centrale `gc_body_config` + `gc_goals`; `ai.js` leest `USER.goalWeight`/`USER.minWeight` | Ja — flow 4 |
| HR-zone 106–132 hardcoded | **P1** | Vaste strings in `sessionDetail.js` en RUNS | `gc_hr_settings` met 6 instelbare velden | Ja — build + UI |
| Horizontale overflow op 360/390/412px in Lichaam | **P1** | Lange knoptekst met `white-space: nowrap` (444px in een 358px container) | Tekst gesplitst, `whiteSpace: normal`, `overflow-x: hidden` op body als vangnet | Ja — 0 overflow op alle 4 viewports |
| Op handen zijnde key-collisie weekdoel | **P1** | Mijn eigen nieuwe weekdoel gebruikte `gc_week_focus_`, dezelfde sleutel als het objectmodel van de verwijderde WeekFocus | Nieuwe sleutel `gc_week_goal_`; oude data onaangeroerd | Ja — legacy-object blijft intact |
| Capture-items verdwenen na "plannen" | **P1** | Status werd gezet zonder zichtbare bestemming of filter | Capture Center met 5 statusfilters + bestemmingskeuze | Ja — flows 7 en 8 |
| Ajovi-historie niet backfillbaar | **P2** | Alleen "vandaag gegeven", geen datumveld | Volledige CRUD met datum, dosis, notitie, bijwerking | Ja — flow 6 |
| Focus Seasons modelconflict | **P2** | Eén sleutel `gc_focus_season` voor twee betekenissen | Twee gescheiden modellen (`gc_executive_focus`, `gc_future_focus_seasons`) | Ja — beide keys apart geverifieerd |
| Strava-UI suggereerde koppelbaarheid zonder backend | **P2** | Geen onderscheid tussen "niet gekoppeld" en "onbereikbaar" | `reachable`-vlag + expliciete melding | Ja — met 404-route getest |
| Restrictieve voedingsregels als harde coachregels | **P2** | "Geen suiker"/"weinig zout" als habits; geen bescherming tegen low energy availability | Labels geherformuleerd + canonieke voedingslogica in de coachcontext | Build; inhoudelijk niet met AI getest |
| 8.900 regels dode code | **P2** | 21 onbereikbare componenten | Verwijderd | Ja — build + alle tabs |
| Curly apostrophe brak de build | **P3** | `'Nog geen foto's'` in een JSX-string | Dubbele quotes | Ja |

---

## 19. REMAINING BUGS / TECH DEBT

| Item | Severity | Impact voor de gebruiker | Technische oorzaak | Aanbevolen volgende stap |
|---|---|---|---|---|
| Geen authenticatie | **P0** | Geen accountscheiding; wie de URL en anon key heeft, kan bij de data | Nooit gebouwd | Supabase Auth toevoegen (magic link), daarna §12-migratie |
| Geen `user_id` / RLS onverifieerbaar | **P0** | Gezondheidsdata mogelijk leesbaar buiten de eigenaar | `gc_coach_data` is generiek key/value, upsert op `key` | SQL uit §12 uitvoeren mét backup en readback |
| Fotopaden zonder gebruikersmap, bucket-policy onbekend | **P0** | Lichaamsfoto's mogelijk publiek toegankelijk | `{datum}/{type}.jpg` | Bucket op privé zetten, paden naar `{user_id}/...`, signed URLs |
| Supabase is geen source of truth | **P1** | Bij cache-clear vóór de eerste sync kan data verloren gaan; laatste-schrijver-wint per sleutel | localStorage-first met kv-back-up | Per datatype echte tabellen met schema, of bewust kv houden maar met user_id en versionering |
| Strava niet functioneel in productie | **P1** | Automatische import werkt niet | Backend niet gedeployed | Express-backend hosten en de URL configureerbaar maken (zoals al voor AI) |
| Dream Board- en workout-screenshots local-only | **P1** | Verlies bij cache-clear of ander device | IndexedDB zonder cloud-back-up | Naar dezelfde (privé) bucket als progressiefoto's |
| Trello niet geïmplementeerd | **P2** | Bestemming niet bruikbaar | Bewust buiten scope in deze ronde | OAuth + card-creatie met idempotencyKey |
| AI-extractie van screenshots niet geverifieerd | **P2** | Onbekend of de uitlezing goed werkt | Geen AI-route in de testomgeving | Testen met echte Garmin/Strava-screenshots en een werkende AI-route |
| Transition Coach mist AAN/UIT/GEREGULEERD | **P2** | Minder houvast bij overgangen | Alleen buffermomenten gebouwd | Toestand toevoegen aan het transitions-model |
| Re-entry Mode ontbreekt | **P2** | Geen expliciete modus na een lange pauze | Zat in verwijderde legacy code | Herbouwen bovenop de bestaande TEST-staat |
| `PERSONAL_EVENTS` en `PRIK_SCHEMA` hardcoded | **P3** | Verouderde races/prikdata in de AI-context | Vaste arrays in `config.js` en `ai.js` | Naar bewerkbare storage, net als eigen mijlpalen |
| Geen tests of linter | **P3** | Regressies alleen via handmatige browsertests te vinden | Nooit ingericht | Vitest + ESLint toevoegen |
| Bundle ~600 kB | **P3** | Trager eerste laden | Geen code-splitting | Dynamische imports per tab |

---

## 20. REGRESSION CHECK

Alle onderdelen expliciet nagelopen na de opruiming:

| Behouden functie | Status |
|---|---|
| Decision Cockpit | PASS — aanwezig, nu geïntegreerd |
| GREEN/AMBER/BLUE/RED | PASS |
| T1–T35 | PASS — alle 35 vindbaar en uitklapbaar |
| run/walk | PASS |
| delayed PEM / 24–48u | PASS — blokkeert BUILD, getest |
| historical cycle | PASS — uitgebreid met edit/delete |
| Capture | PASS — canoniek, met statussen |
| Transition Coach | PARTIAL — buffermomenten behouden, toestandsmodel niet gebouwd |
| Progress Wall | PASS — als "Bewijs dat ik verander" |
| Future Self | PASS |
| Strength | PASS |
| Screenshot import | PASS (flow) / AI-extractie NOT VERIFIED |
| Data persistence | PASS voor localStorage/IndexedDB; cloud zie §11 |
| Wat Nu | PASS — uitgebreid met ranking |
| Top 3 | PASS |
| WIP-limiet | PASS |
| Protected free time | PASS |
| Buffer €15k | PASS |
| Re-entry Mode | **REGRESSIE** — bestond in verwijderde legacy code, niet herbouwd |

**Gevonden regressie: één** — Re-entry Mode. Deze zat in `CheckIn.jsx`/`Coach.jsx` die niet bereikbaar waren vanaf de app-root, dus de gebruiker had er in de live app al geen toegang tot. Formeel is het geen live regressie, maar de functie staat nu ook niet meer in de code.

---

## 21. LIVE VERIFICATION CHECKLIST

| Check | Resultaat |
|---|---|
| Juiste JS bundle geladen | PASS — `gh-pages:index.html` verwijst naar `assets/index-CJtvFkRt.js`, identiek aan de lokale build |
| Huidige commit deployed | PASS — gh-pages `7a0e56a`, gebouwd uit code-commit `a2edb1a` |
| Geen oude bundle/cache | PASS — oude asset-hashes staan niet meer in `index.html` |
| Tabs werken | PASS — getest op 4 viewports tegen de productiebuild |
| User data verschijnt | PASS — geseede logs, plannen en taken renderen |
| Refresh werkt | PASS — data blijft na reload |
| Login werkt | NOT APPLICABLE — er is geen login |
| Create/update/delete werkt | PASS — geverifieerd voor workouts, doelen, cyclus, Ajovi, taken, 5K-tests |
| Live URL bereikbaar vanaf deze sandbox | NOT VERIFIED — uitgaand HTTPS naar github.io wordt door de sandbox geblokkeerd; verificatie is gedaan op de gedeployde bundle in de gh-pages branch en op een lokale server met dezelfde build |

---

## 22. FINAL VERDICT

```
OVERALL STATUS:
PARTIAL

SAFE TO USE AS DAILY COACH:
WITH LIMITATIONS
(de coachfunctionaliteit werkt; de dataopslag heeft geen accountscheiding)

DATA SAFETY:
PARTIAL
(niets verwijderd, migraties met readback geverifieerd, maar geen
 versionering en laatste-schrijver-wint per sleutel)

PRIVACY:
FAIL
(geen auth, geen user_id, RLS en bucket-policy NOT VERIFIED)

RUNNING COACH:
PASS

GOAL ADAPTATION:
PASS

TRELLO:
NOT IMPLEMENTED (UI meldt dit expliciet)

STRAVA:
BROKEN (geen backend in productie; app degradeert correct)

TOP 5 REMAINING ACTIONS:
1. Supabase Auth invoeren en gc_coach_data migreren naar (user_id, key)
   met RLS-policies — dit is de enige P0 die echt telt.
2. Bucket progress-photos op privé zetten en fotopaden per gebruiker
   maken; signed URLs testen.
3. Express-backend deployen zodat Strava-OAuth en -sync werken, en de
   backend-URL configureerbaar maken zoals nu al voor de AI-route.
4. Dream Board- en workout-screenshots naar cloudopslag zodat ze een
   cache-clear overleven.
5. AI-screenshotextractie testen met echte Garmin/Strava-screenshots
   en de Transition Coach-toestand + Re-entry Mode herbouwen.
```

---

## 23. SHAREABLE COPY BLOCK

=== COPY THIS TO CHATGPT FOR INDEPENDENT REVIEW ===

**Project:** Griëtte Coach — een persoonlijke performance-coach-webapp (React + Vite) voor één gebruiker: een vrouw van 46 met long COVID/PEM, ADHD en perimenopauze, die hardlopen opbouwt en aan lichaamssamenstelling werkt. De app moet vijf rollen combineren: performance coach, body-composition/healthy-aging coach, executive-function/Chief of Staff, herstelcoach bij PEM, en perimenopauze-coach.

**Repository / deployment:** GitHub `jetje1980/griette-coach`. Werkbranch `claude/coach-app-archive-missing-0dgmzb`, code-commit `a2edb1a85c02ad8d41cffc1e22628970d646add2`. Deployment via de `gh-pages` branch (commit `7a0e56a`) naar GitHub Pages: https://jetje1980.github.io/griette-coach/. Live JS-bundle `assets/index-CJtvFkRt.js`, identiek aan de lokale `vite build`-output (geverifieerd door de bundle-hash in `gh-pages:index.html` te vergelijken met `frontend/dist/assets/`). Er zijn geen tests en geen linter in het project (`package.json` heeft alleen `dev`, `build`, `preview`).

**Architectuur.** Puur client-side React-SPA, zes hoofdtabs: Vandaag, Week, Lichaam, Leven, Progressie, Coach. Alle state gaat naar `localStorage` met sleutels met prefix `gc_`. `src/sync.js` monkeypatcht `localStorage.setItem` en pusht 2 seconden later álle `gc_*`-sleutels als key/value-rijen naar één Supabase-tabel `gc_coach_data` (`upsert`, `onConflict: 'key'`); bij het opstarten haalt `restoreFromCloud()` alle rijen op en schrijft ze terug. Supabase-project-ref `osuqtfsxmquwqsbgzlqn`, met een publishable/anon key hardcoded in `sync.js`, `store.js` en `photoStore.js`. Binaire data staat in IndexedDB: `gc_photos` (progressiefoto's, met back-up naar Supabase Storage-bucket `progress-photos`, paden `{datum}/{type}.jpg`), `gc_dreams` (Dream Board-afbeeldingen, geen cloud-back-up) en `gc_workout_imgs` (workout-screenshots, geen cloud-back-up). Er is een Express-backend in `backend/server.js` (Strava-OAuth, SQLite, en een Anthropic-proxy op `/api/ai/messages`), maar die is **niet gedeployed** — GitHub Pages serveert alleen statische bestanden.

**Belangrijkste bestanden.** `src/components/VandaagScreen.jsx` (cockpit: Decision Cockpit, performance strip, Wat Nu?-ranking, Top 3, dagplanning, compacte check-in), `src/components/CoachAdvice.jsx` (`computeHeadCoach` bepaalt GREEN/AMBER/BLUE/RED en de adaptieve staat; `computeNextSession` kiest de volgende hardloopsessie), `src/workouts.js` (uniform WorkoutResult-model, tolerantie-analyse over 24–48u, pace@HR-trend, cardiac drift, sessievergelijking), `src/goals.js` (centrale doelenstore, HR/RPE-instellingen, feasibility check), `src/performance.js` (herstel-/run build-/shape-percentages), `src/tasks.js` (TaskItem met status en bestemming), `src/data/runningSchema.js` (T1–T35), `src/data/sessionDetail.js` (volledige sessie-instructie), `src/data/strengthSchema.js` (krachtprogramma's A/B + snack met RIR en progressive-overloadadvies), `src/components/LichaamScreen.jsx` (detailhub), `src/components/TrainingPlan.jsx`, `src/components/WorkoutForm.jsx` (handmatig + screenshot-import met verplichte bevestiging), `src/components/CaptureCenter.jsx`, `src/components/CycleHistory.jsx`, `src/components/GoalSettings.jsx`.

**Wat in deze ronde is veranderd.** Twee delen. Eerst een cleanup: 21 onbereikbare legacy componenten verwijderd (8.900 regels), waaronder `CheckIn.jsx` (2351 regels), `Progressie.jsx`, `Training.jsx`, `Coach.jsx` en `WeekFocus.jsx`. Cruciaal daarbij: `Training.jsx` bevatte een **tweede, concurrerend hardloopsysteem** met een vast raceplan gekoppeld aan kalenderdata; dat is weg, inclusief de helpers `getRunDate()`/`getRunStatus()`, zodat T1–T35 met de adaptieve engine de enige bron is. Vandaag is herbouwd als cockpit met detailregistratie achter "Meer registreren"; Week kreeg weekdoel, bottleneck en conflictdetectie; Lichaam werd de enige detailhub met zes subtabs; Progressie werd een bewijs-overzicht in plaats van invoertegels; Leven kreeg één Taken-plek (Capture + projecten) en één Focus-model.

Daarna functionele afmaak: een **centrale goal engine** (`gc_goals`, 7 domeinen RUN/BODY/SHAPE/FRESHNESS/MONEY/TIME/LIFE_WORK) met per doel `target_value`, `target_date`, `priority` en `status`, plus een **goal feasibility check** die de benodigde weekgroei uit echte workoutdata berekent en vergelijkt met wat herstel toelaat (8%/week normaal, 5% na recente PEM-signalen) en haalbaar/ambitieus/nu-niet-verantwoord teruggeeft — een kortere deadline verhoogt de opbouwsnelheid expliciet níet. **Hartslag- en RPE-kaders** zijn instelbaar geworden (`gc_hr_settings`: easyLow, easyHigh, walkTrigger, resumeBelow, rpeEasy, rpeThreshold) in plaats van hardcoded 106–132. **Menstruatie- en Ajovi-historie** hebben volledige CRUD met vrije datumkeuze. Een **performance strip** op Vandaag toont Herstel% (gewogen uit slaap/energie/herstelgevoel/symptomen), Run build%, Shape% (naar het ingestelde doel) en Capaciteit — met een streepje in plaats van een verzonnen getal bij te weinig data.

**Opgeloste conflicten in business rules.** Het doelgewicht stond op drie plekken verschillend (57 in `config.js`, 55 in de AI-prompt, 45 als floor): nu één bron. Restrictieve dieetregels ("geen suiker", "weinig zout") zijn geherformuleerd en de coachcontext bevat nu canonieke voedingslogica gericht op herstel, spiermassa, energie en bescherming tegen low energy availability, met body composition beoordeeld op de combinatie van gewichtstrend, taille, kracht en herstel (positieve recompositie wordt expliciet herkend). Het Focus Seasons-modelconflict is opgelost door twee gescheiden sleutels (`gc_executive_focus` voor het seizoen, `gc_future_focus_seasons` voor domeinen met PRIMARY/MAINTAIN/NOT_NOW); de oude `gc_focus_season` wordt alleen nog gelezen. Generieke cyclusdogma's ("ovulatie is het beste moment voor intensiteit") zijn vervangen door persoonlijke patronen met een minimum van 5 observaties per fase.

**Twee bugs die het waard zijn te noemen.** (1) Een P0 die de build niet vond: `LevenScreen` crashte volledig zodra de Focus-tab werd geopend, omdat een child `logs` kreeg dat de parent niet als prop had — `ReferenceError`, witte tab. Alleen een echte browsertest vond dit. (2) Een key-collisie die ik zelf introduceerde en repareerde: mijn nieuwe weekdoel gebruikte `gc_week_focus_`, exact de sleutel waarin de verwijderde WeekFocus-component een ander objectmodel bewaarde; nu `gc_week_goal_`, met de oude data onaangeroerd.

**Wat nog niet werkt.** **Strava is BROKEN in productie**: de app roept `/api/strava/status` aan, wat op GitHub Pages niet bestaat. Getest met een Playwright-route die alle `/api/**` op 404 zet: de app claimt níet dat Strava gekoppeld is, meldt "Strava-backend niet bereikbaar", en handmatige invoer plus opslag blijven volledig werken. OAuth, callback, token-persistentie, activity-sync, duplicaatpreventie en disconnect/reconnect zijn allemaal **NOT VERIFIED** omdat er geen backend is. **Trello is NOT IMPLEMENTED**: de bestemming is zichtbaar maar uitgeschakeld met de melding "Trello nog niet gekoppeld"; het TaskItem-model heeft de velden (`trelloCardId`, `trelloUrl`, plus een `findByTrelloCard()` voor duplicaatpreventie) al klaarstaan. De AI-extractie van workout-screenshots is als flow getest (upload → voorgevuld formulier → correctie → bevestigen → opslaan, met "niet betrouwbaar herkend" voor onzekere velden en niets opslaan vóór bevestiging), maar de extractie zelf is NOT VERIFIED omdat er geen AI-route in de testomgeving was.

**Het zwaarste openstaande punt: privacy.** Er is **geen authenticatie** in de app — nergens `supabase.auth`, geen sign-in, geen sessie. De tabel `gc_coach_data` heeft **geen `user_id`**: rijen worden geüpsert op `key` alleen, en `restoreFromCloud()` doet `select('key, value')` zonder filter. Gevolg: cross-device sync werkt wel, maar er is geen technische scheiding tussen gebruikers, en iedere houder van de publishable key kan potentieel alle gezondheidsdata lezen en overschrijven — inclusief dagelijkse logs, gewicht, symptomen, PEM-signalen en cyclusdata. De progressiefoto's gaan naar bucket `progress-photos` met paden zonder gebruikersmap. Ik had geen toegang tot het Supabase-project en kon de RLS-policies en de bucket-zichtbaarheid **niet inspecteren**; ik rapporteer die daarom als NOT VERIFIED, met de aantekening dat de sync in de praktijk zonder auth werkt, wat op een permissieve anon-policy wijst. Er staat géén service-role key in de client, en de Anthropic-sleutel wordt niet meer persistent in de browser bewaard (oude `gc_api_key` wordt bij het opstarten naar sessionStorage gemigreerd en uit localStorage verwijderd; AI loopt primair via een server-proxy).

**Local-only data (verlies bij cache-clear):** Dream Board-afbeeldingen (IndexedDB `gc_dreams`), workout-screenshots (IndexedDB `gc_workout_imgs`), foto-analyses (`gc_photo_analysis_*`) en Strava-tokens (`gc_strava_*`) — de laatste twee zijn bewust uitgesloten van sync.

**Teststatus.** `npm run build` PASS. `npm test` en `npm run lint` bestaan niet. Playwright/Chromium-tests op 360, 390, 412 en 1280 px: alle zes tabs, nul horizontale overflow, nul lege schermen, nul React-errors, nul console-errors. Acht van de tien voorgeschreven user flows PASS (onboarding→doel→dashboard; run loggen→delayed feedback→BUILD/HOLD-gating; doel 5→8 km met feasibility; gewichtsdoel wijzigen; historische menstruatie CRUD; historische Ajovi CRUD; Capture→Vandaag met persistentie na refresh; Capture→Trello met eerlijke melding). Flow 9 (Strava) faalt bij stap 1 door de ontbrekende backend. Flow 10 (foto cross-device) is PARTIAL: upload en refresh-persistentie werken, cross-device is zonder auth niet te verifiëren.

**Aanbevolen prioriteiten voor de volgende ronde:** (1) Supabase Auth + migratie van `gc_coach_data` naar primaire sleutel `(user_id, key)` met RLS-policies op select/insert/update/delete, uitgevoerd met backup en readback-verificatie; (2) bucket `progress-photos` op privé en fotopaden naar `{user_id}/{datum}/{type}.jpg` met signed URLs; (3) de Express-backend hosten zodat Strava werkt, en de backend-URL configureerbaar maken zoals dat al voor de AI-route bestaat; (4) Dream Board- en screenshot-afbeeldingen naar cloudopslag; (5) AI-screenshotextractie valideren met echte Garmin/Strava-screenshots, en de Transition Coach-toestand (AAN/UIT/GEREGULEERD) plus Re-entry Mode herbouwen — die laatste is de enige functie die in de code verdwenen is, hoewel hij al niet bereikbaar was in de live app.

**Vraag voor onafhankelijke review:** klopt de conclusie dat een key/value-tabel zonder `user_id` in combinatie met een anon key en zonder auth een reëel privacyrisico vormt voor gezondheidsdata, en is de voorgestelde migratie (§12 van het volledige rapport) de veiligste route zonder dataverlies? Let daarbij op de ordening: eerst auth invoeren, dan kolom toevoegen met default `auth.uid()`, dan bestaande rijen toewijzen, dan de primaire sleutel wijzigen, dan RLS aanzetten — en pas na readback-verificatie iets opruimen.

=== END COPY BLOCK ===
