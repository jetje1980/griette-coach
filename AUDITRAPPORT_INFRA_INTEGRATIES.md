# GRIËTTE COACH — INFRA- EN INTEGRATIE-AUDITRAPPORT

Datum: 18 augustus 2026 · Strava-verificatie bijgewerkt 19 augustus 2026
Opgesteld door: Claude (Anthropic) in Claude Code
Vervolg op: `AUDITRAPPORT.md` (18 augustus 2026)

---

## 1. EXECUTIVE SUMMARY

Deze ronde ging over productie-infrastructuur: authenticatie, gebruikersisolatie, RLS, private opslag, datamigratie en echte integraties.

**Belangrijke correctie op het vorige rapport.** Dat rapport meldde "geen `user_id`, RLS NOT VERIFIED" op basis van clientcode. Met daadwerkelijke beheerstoegang tot Supabase blijkt de database al goed te staan: `gc_coach_data` heeft `user_id uuid NOT NULL DEFAULT auth.uid()`, RLS aan, en een `Owner access`-policy op `auth.uid() = user_id`. De bucket `progress-photos` is privé met vier owner-policies. Wat er wél mis was: de primaire sleutel stond op `(key)` in plaats van `(user_id, key)`, en de **app had geen eigen authenticatie** — hij erfde ongemerkt de sessie van een andere app op hetzelfde origin (`jetje1980.github.io`).

Opgelost: PK naar `(user_id, key)` na geverifieerde backup (73 rijen, identieke hash voor en na). Een expliciete AuthGate met eigen sessieopslag. Eén gedeelde Supabase-client in plaats van drie. Sync herschreven zodat de cloud leidend is en mislukte schrijfacties in een zichtbare wachtrij blijven staan. Dream Board-afbeeldingen en workout-screenshots gaan nu naar private opslag met readback-verificatie. De directe browser-AI-route met `dangerous-direct-browser-access` is verwijderd (0 hits in de bundle) en vervangen door een JWT-geverifieerde Edge Function. Drie Edge Functions live: `coach-ai`, `coach-strava`, `coach-trello`.

Strava is inmiddels end-to-end geverifieerd (19 aug): OAuth voltooid met scopes `read,activity:read_all`, 30 activiteiten geimporteerd inclusief hartslag, server-side token-refresh aantoonbaar uitgevoerd en duplicaatpreventie getest. Trello is volledig gebouwd; de API-key op de server is geldig, maar het opgeslagen token hoort bij een andere key — Trello antwoordt daarom `invalid key`. Vernieuwen kan sinds 19 aug vanuit de app zelf (Instellingen → Integraties → Trello, twee stappen); zie §22 stap 3.

**ALGEMENE STATUS: PARTIAL** — privacy, auth, RLS en Strava zijn PASS; alleen Trello staat nog op AWAITING USER ACTION.

---

## 2. REPO / BRANCH / COMMITS

| Item | Waarde |
|---|---|
| Repository | `jetje1980/griette-coach` |
| Branch | `claude/coach-app-archive-missing-0dgmzb` |
| Commit (code) | `5920017` |
| Vorige commit deze sessie | `4d79088` (rapport), `a2edb1a` (goal engine) |
| Deployment branch | `gh-pages`, commit `f5fe213` |
| Live bundle | `assets/index-JsI6S6JT.js` — identiek aan lokale build (geverifieerd) |

---

## 3. DEPLOYMENT

| Laag | Waar |
|---|---|
| Frontend | GitHub Pages — https://jetje1980.github.io/griette-coach/ |
| Auth | Supabase Auth (e-mail/wachtwoord + magic link) |
| Data | Supabase Postgres, tabel `gc_coach_data` (+ 4 nieuwe tabellen) |
| Private media | Supabase Storage, bucket `progress-photos` (privé) |
| AI | Supabase Edge Function `coach-ai` (verify_jwt = true) |
| Strava | Supabase Edge Function `coach-strava` v2 — **werkend** |
| Trello | Supabase Edge Function `coach-trello` (verify_jwt = true) |
| Oude Express-backend | Niet meer gebruikt door de frontend; `api.js` wordt nergens meer aangeroepen voor Strava |

---

## 4. SUPABASE PROJECT

| Item | Waarde |
|---|---|
| Project-ref | `osuqtfsxmquwqsbgzlqn` |
| Naam | `griette@yahoo.com's Project` |
| Status | ACTIVE_HEALTHY, regio eu-west-1, Postgres 17.6 |
| Client key | `sb_publishable_...` (anon/publishable, publiek bedoeld) |
| Service role in client | **NEE** — geverifieerd, 0 hits in de bundle |

**Dit project wordt gedeeld met andere apps.** Naast de Coach-tabellen staan er `slovenie_*` (reis-app), `users`, `sessions`, `photos`, `comments`, `feedback`, `beta_codes`, `group_state`, `warmup_answers`. Zie §12 voor de isolatie-analyse.

Bestaande Edge Functions van andere apps (ongemoeid gelaten): `log-session`, `paris-chat`, `kompas-api`, `kompas-app`, `fitness-ai`.

---

## 5. AUTH STATUS

**PASS**

- Provider: e-mail (wachtwoord al ingesteld en bevestigd voor `griette@yahoo.com`, laatste login 18 aug 14:23). Magic link als tweede optie ingebouwd.
- `src/supabase.js`: één gedeelde client met `persistSession`, `autoRefreshToken`, `detectSessionInUrl`.
- **Eigen `storageKey: 'gc_auth_session'`.** Dit is een wezenlijke wijziging: alle apps van jou draaien op `jetje1980.github.io`, en Supabase bewaart sessies per origin. Coach pikte daardoor de sessie van een andere app op zonder eigen login. Nu heeft Coach een eigen sessie.
- `src/components/AuthGate.jsx`: zonder geldige sessie komt er geen coach-data in beeld. Sessieherstel na refresh, token-refresh en verlopen sessies via `onAuthStateChange`. Bij uitloggen worden `gc_*`-caches en de drie IndexedDB-databases gewist.
- Geen client-side namaaklogin, geen hardcoded toegangscode.

**Gevolg voor jou:** je moet één keer inloggen in Coach met je e-mailadres en wachtwoord. Daarna blijft de sessie staan.

---

## 6. RLS POLICIES (exact)

Alle vijf Coach-tabellen: rol `authenticated`, conditie op `auth.uid()`. Geverifieerd met een query op `pg_policies`.

```sql
-- gc_coach_data
CREATE POLICY "Owner access" ON public.gc_coach_data
  FOR ALL TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- gc_coach_data_backup_20260818  (deze ronde toegevoegd)
CREATE POLICY "backup owner access" ON public.gc_coach_data_backup_20260818
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- strava_connections / workout_imports / task_links  (deze ronde toegevoegd)
CREATE POLICY "strava owner access" ON public.strava_connections FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "imports owner access" ON public.workout_imports FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "task links owner access" ON public.task_links FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
```

Storage (`storage.objects`), al aanwezig vóór deze ronde:

```sql
-- vier policies, telkens: bucket_id = 'progress-photos' AND owner_id = auth.uid()::text
"progress photos owner select" (SELECT)
"progress photos owner insert" (INSERT)
"progress photos owner update" (UPDATE)
"progress photos owner delete" (DELETE)
```

---

## 7. TABELLEN / SCHEMA

| Tabel | Kolommen | PK | RLS |
|---|---|---|---|
| `gc_coach_data` | `user_id uuid NOT NULL DEFAULT auth.uid()`, `key text`, `value text`, `updated_at timestamptz` | **`(user_id, key)`** (was `(key)`) | ✅ |
| `gc_coach_data_backup_20260818` | kopie van bovenstaande | geen (backup) | ✅ |
| `strava_connections` | `user_id`, `athlete_id`, `athlete_name`, `access_token`, `refresh_token`, `expires_at`, `scope`, timestamps | `(user_id)` | ✅ |
| `workout_imports` | `id`, `user_id`, `external_provider`, `external_id`, `external_url`, `payload jsonb`, `imported_at` | `(id)`, unique `(user_id, external_provider, external_id)` | ✅ |
| `task_links` | `id`, `user_id`, `task_id`, `external_provider`, `external_id`, `external_url`, `external_board_id`, `external_list_id`, `sync_state`, `idempotency_key`, `last_synced_at` | `(id)`, unique `(user_id, external_provider, idempotency_key)` | ✅ |

FK: `gc_coach_data.user_id → auth.users(id) ON DELETE CASCADE` (idem voor de nieuwe tabellen).

---

## 8. BUCKETS / POLICIES

| Bucket | Publiek | Objecten | Policies |
|---|---|---|---|
| `progress-photos` | **false (privé)** | 6 (alle met `owner_id`) | 4 owner-policies (select/insert/update/delete) |
| `slovenie-bingo` | publiek | 2 | anon select/insert — **andere app** |

Padconventie voor nieuwe uploads: `{user_id}/progress/{datum}/{type}.jpg`, `{user_id}/dreamboard/{id}.jpg`, `{user_id}/workouts/{id}.jpg`. Bestaande 6 foto's staan nog op het oude pad `{datum}/{type}.jpeg` en blijven leesbaar (de app leest beide locaties). **Niets verwijderd.**

Beveiliging leunt op `owner_id`, niet op het pad — de oude paden zijn dus even veilig als de nieuwe.

---

## 9. MIGRATIE BEFORE/AFTER

| Migratie | Voor | Na | Verificatie |
|---|---|---|---|
| Backup `gc_coach_data` | 73 rijen | 73 rijen in backuptabel | hash `d11dabd1a4570779cd49b149f133d16c` identiek |
| Backup als JSON | — | 135.121 bytes lokaal | bestand aanwezig |
| PK `(key)` → `(user_id, key)` | 73 rijen, hash `d11dab…` | 73 rijen, hash `d11dab…` | **identiek — 0 verlies** |
| RLS op backuptabel | uit | aan | `relrowsecurity = true` |
| `missing_keys` | — | **0** | rijtelling en hash gelijk |
| `duplicate_keys` | — | **0** | PK garandeert uniciteit per gebruiker |

Geen enkele rij, foto of localStorage-sleutel verwijderd.

---

## 10. LOCAL-ONLY DATA REMAINING

| Data | Status na deze ronde |
|---|---|
| Dream Board-afbeeldingen (`gc_dreams`) | **Opgelost** — uploaden naar private bucket met readback; IndexedDB blijft cache |
| Workout-screenshots (`gc_workout_imgs`) | **Opgelost** — idem, plus terugval naar cloud bij ontbrekend lokaal bestand |
| Progressiefoto's (`gc_photos`) | Al in de cloud; nieuwe uploads onder gebruikerspad |
| Foto-analyses (`gc_photo_analysis_*`) | **Nog local-only** — bewust uitgesloten van sync (grote AI-teksten) |
| Strava-tokens (`gc_strava_*`) | **Niet meer relevant** — tokens staan nu server-side in `strava_connections` |
| AI-sleutel | **Verwijderd** — `gc_api_key` en `gc_api_key_session` worden bij het opstarten gewist |
| `gc_auth_session` | Sessietoken, hoort lokaal te blijven |
| `gc_pending_sync` | Wachtrij-index, hoort lokaal te blijven |

---

## 11. CROSS-DEVICE TEST

**PARTIAL / NOT VERIFIED.** De architectuur is er (cloud leidend, hydratatie bij opstarten, media in private opslag), maar ik kon geen echte twee-device-test doen: uitgaand HTTPS naar `supabase.co` is geblokkeerd in mijn sandbox (`HTTP 000` bij curl, `ERR_TUNNEL_CONNECTION_FAILED` in de browser). Wat ik wél verifieerde:

- De sync-code stuurt `user_id` mee en gebruikt `onConflict: 'user_id,key'` — passend bij de nieuwe PK.
- `restoreFromCloud()` filtert op `user_id` en respecteert lokale wijzigingen die nog in de wachtrij staan.
- Bij netwerkfout blijft de wachtrij staan en verschijnt een zichtbare melding met retry-knop (getest: met geblokkeerd netwerk toont de app de foutmelding en verliest niets).

**Jij kunt dit in twee minuten bevestigen:** log in op telefoon A, voeg een gewicht toe, log in op telefoon B en ververs.

---

## 12. CROSS-APP ISOLATIE

**PASS voor anonieme toegang, PARTIAL voor authenticated.**

Apps die dit Supabase-project delen (op basis van tabelnamen): de Coach-app, een Slovenië/reis-app (`slovenie_*`, `users`, `sessions`, `photos`, `comments`, `warmup_answers`, `group_state`, `beta_codes`, `feedback`) en enkele Edge Functions (`kompas-*`, `paris-chat`, `fitness-ai`).

- **Coach-tabellen:** alle vijf uitsluitend rol `authenticated` met `auth.uid() = user_id`. De andere apps gebruiken de anon-key en komen er dus niet bij — bewezen in TEST A: `permission denied for table gc_coach_data`.
- **Coach-bucket:** privé, owner-scoped. Andere apps' buckets (`slovenie-bingo`) zijn publiek maar staan los.
- **Restrisico:** zou een andere app ooit inloggen met Supabase Auth als dezelfde gebruiker, dan zou die app technisch bij `gc_coach_data` kunnen. Dat risico is deze ronde verkleind doordat Coach een eigen `storageKey` heeft en de sessie niet meer deelt. Volledige isolatie vraagt een apart Supabase-project voor Coach — dat is mijn advies op termijn, maar het is geen acute lek.

---

## 13. STRAVA STATUS

**WORKING** — end-to-end geverifieerd op 19 augustus 2026 tegen het echte account.

### Wat er mis was
De authorization-URL vroeg `scope=activity:read_all` met `approval_prompt=auto`.
Twee problemen: `read` ontbrak, en met `auto` hergebruikt Strava een eerdere,
smallere toestemming zonder opnieuw te vragen — waardoor een token met alleen
`read` bleef staan. Gefixt naar `scope=read,activity:read_all` en
`approval_prompt=force`.

### Bewijs uit de database (niet uit code-inspectie)

| Test | Resultaat |
|---|---|
| OAuth voltooid | **PASS** — `strava_connections` bevat athlete `16399113` (Griette Vonck) |
| Verleende scopes | **PASS** — `read,activity:read_all` (exact wat vereist is) |
| `activity:write` aangevraagd | **NEE** — bewust niet; 0 hits in de bundle |
| Access + refresh token aanwezig | **PASS** — beide gezet, server-side in `strava_connections` |
| Token-refresh server-side | **PASS** — `created_at` 18 aug 22:03, `updated_at` 19 aug 05:45; alleen `freshToken()` schrijft die velden. `expires_at` 11:45 = precies 6 uur na de refresh |
| Activiteiten opgehaald | **PASS** — 30 activiteiten geïmporteerd, 3 apr t/m 18 aug |
| Hartslagdata beschikbaar | **PASS** — 30 van 30 met `has_heartrate = true` |
| Duplicaatpreventie | **PASS** — herhaalde insert van dezelfde `external_id` geweigerd door de unique constraint; 1 rij blijft 1 rij |
| Tokens in browser/localStorage | **NEE** — geverifieerd: 0 Strava-tokens in de bundle |

### Meest recente activiteit, opgehaald via de app zelf

| Veld | Waarde |
|---|---|
| Naam / type | Nachtloop — Run |
| Datum | 18 augustus 2026, 21:09 |
| Afstand | 2,16 km |
| Duur (bewegend) | 21:48 (1308 s) |
| Pace | 10:07 /km |
| Hartslag | gemiddeld **140** · max **177** bpm |
| Laps | 3 (avg HR 133 / 149 / 134) |
| Streams | time, heart_rate, distance, velocity_smooth, cadence, altitude |
| Strava-id | 19799144166 |

Deze waarden komen uit `workout_imports` — dus via de eigen OAuth-keten van de
app, niet via een externe connector. Ze komen exact overeen met wat Strava zelf
voor deze activiteit toont.

## 14. TRELLO STATUS

**AWAITING USER ACTION**

Volledig gebouwd als Edge Function `coach-trello` (verify_jwt = true):

| Onderdeel | Status |
|---|---|
| `/status`, `/boards`, `/lists`, `/cards` | gebouwd |
| `/create-card` met naam, beschrijving, due | gebouwd |
| `externalId`, `externalUrl`, `boardId`, `listId`, `syncState`, `lastSyncedAt` opgeslagen | gebouwd (`task_links` + TaskItem) |
| **Idempotentie** — `idempotency_key = task:{taskId}`, unique constraint | gebouwd; een tweede aanroep geeft de bestaande card terug (`duplicate: true`) |
| Board/lijst kiezen in Instellingen → Integraties | gebouwd |
| Capture → Trello Backlog | gebouwd, pas actief als de status `connected` is |
| End-to-end getest met echte Trello-account | **NOT VERIFIED** |

Zonder `TRELLO_API_KEY`/`TRELLO_TOKEN` toont de bestemming "Trello nog niet gekoppeld" en is hij niet klikbaar.

---

## 15. AI SECURITY

**PASS**

- Edge Function `coach-ai` met `verify_jwt: true`; extra controle op de `Authorization`-header in de functie zelf. Identiteit komt nooit uit de request-body.
- De Anthropic-sleutel staat uitsluitend als Edge Function secret. Zonder secret antwoordt de functie met 503 en een duidelijke melding.
- **`dangerous-direct-browser-access` volledig verwijderd** — 0 hits in de gebouwde bundle (was 1).
- `gc_api_key` en `gc_api_key_session` worden bij elke start gewist.
- De AI-sleutelinvoer is uit Instellingen verwijderd; er staat nu uitleg dat de sleutel server-side staat.
- Screenshot-analyse loopt via dezelfde geauthenticeerde route.

---

## 16. SECRETS AUDIT

Scan op de gedeployde bundle `dist/assets/index-CvqaPTw0.js`:

| Patroon | Hits | Oordeel |
|---|---|---|
| `service_role` | 0 | ✅ |
| JWT-header `eyJhbGciOiJIUzI1NiIs…` | 0 | ✅ |
| `STRAVA_CLIENT_SECRET` | 0 | ✅ |
| `TRELLO_TOKEN` | 0 | ✅ |
| `dangerous-direct-browser-access` | 0 | ✅ (was 1) |
| `sk-ant-` | 1 | placeholder-tekst in de UI, geen sleutel |
| `sb_publishable_…` | 1 | publishable/anon key — publiek bedoeld, veilig mét RLS |

---

## 17. SECURITY TESTS (uitgevoerd)

Uitgevoerd als echte Postgres-rollen met gezette JWT-claims, dus tegen de werkelijke policies.

| Test | Verwacht | Resultaat |
|---|---|---|
| **A** — anon leest `gc_coach_data` | geblokkeerd | **PASS** — `ERROR 42501: permission denied for table gc_coach_data` |
| **A2** — anon leest backuptabel | geblokkeerd | **PASS** — zelfde foutmelding |
| **C** — eigenaar leest eigen data | toegestaan | **PASS** — 73 rijen |
| **D** — andere ingelogde gebruiker leest data van Griëtte | geblokkeerd | **PASS** — 0 rijen |
| **D2** — andere gebruiker leest backuptabel | geblokkeerd | **PASS** — 0 rijen |
| **E** — eigenaar ziet eigen foto's | toegestaan | **PASS** — 6 objecten |
| **F** — andere gebruiker ziet foto's van Griëtte | geblokkeerd | **PASS** — 0 objecten |
| **B** — anoniem foto downloaden | geblokkeerd | **PASS (afgeleid)** — bucket `public = false` en select-policy vereist `owner_id = auth.uid()`; anon heeft geen policy |
| **G** — secrets in browserbundle | geen | **PASS** — zie §16 |
| **H** — uitgelogd toont geen privédata | geen data | **PASS** — loginscherm, geen gewicht/PEM/Wat Nu zichtbaar, caches gewist |

Supabase security advisor: **geen kritieke bevindingen**. Twee WARN-items: `pg_net` staat in het public schema (bestaand, niet van Coach) en "leaked password protection" staat uit (aanrader, zie §22).

---

## 18. REGRESSIETEST

Uitgevoerd achter de AuthGate met een gesimuleerde sessie (netwerk geblokkeerd in de sandbox), viewport 390 × 844.

| Functie | Resultaat |
|---|---|
| Decision Cockpit + GREEN/AMBER/BLUE/RED | PASS |
| Wat Nu | PASS |
| Top 3 | PASS |
| Performance strip | PASS |
| T1–T35 trainingsplan | PASS |
| Volgende-sessie-gating (geen BUILD zonder herstelcheck) | PASS |
| Herstelcheck / delayed PEM | PASS |
| Bleeding-registratie (5 niveaus) | PASS |
| Cyclushistorie zichtbaar | PASS |
| Ajovi-historie zichtbaar | PASS |
| Capture + bestemmingskeuze | PASS |
| Trello-bestemming meldt eerlijke status | PASS |
| Doelen (goal engine) | PASS |
| Strava-sectie meldt eerlijke status | PASS |
| Subtabs: Lichaam 6/6, Leven 7/7, Progressie 9/9, Coach 3/3 | PASS |
| Page errors | **0** |

**Geen regressies gevonden.**

---

## 19. BUGS FOUND / FIXED

| Bug | Severity | Oorzaak | Fix | Hertest |
|---|---|---|---|---|
| App had geen eigen authenticatie en erfde de sessie van een andere app op hetzelfde origin | **P0** | Geen auth-code; Supabase deelt sessies per origin | AuthGate + eigen `storageKey` | Ja |
| PK `(key)` in plaats van `(user_id, key)` | **P0** | Oorspronkelijk schema | Migratie na backup | Ja — hash identiek |
| Backuptabel bevatte gezondheidsdata zonder RLS | **P0** (door mij geïntroduceerd, direct gedicht) | `CREATE TABLE AS SELECT` erft geen RLS | RLS + owner-policy in dezelfde migratie | Ja |
| Directe browser-AI-route met `dangerous-direct-browser-access` | **P1** | Fallback uit eerdere ronde | Verwijderd; alles via `coach-ai` | Ja — 0 hits |
| Drie losse Supabase-clients | **P1** | Historisch gegroeid | Eén gedeelde client | Ja |
| Mislukte cloud-writes verdwenen stil | **P1** | Fire-and-forget sync | Wachtrij + zichtbare melding + retry | Ja |
| Dream Board- en screenshot-afbeeldingen alleen lokaal | **P1** | Geen cloudpad | `mediaStore` met upload + readback | Build + code |
| Fotopaden zonder gebruikersmap | **P2** | Oude conventie | Nieuwe uploads onder `{user_id}/…`; oude paden blijven leesbaar | Build |

---

## 20. REMAINING BUGS / TECH DEBT

| Item | Severity | Impact | Volgende stap |
|---|---|---|---|
| Trello-token hoort bij een andere API-key | P2 | Capture → Trello niet bruikbaar tot het token vernieuwd is; key zelf is geldig | §22, stap 3 |
| Cross-device niet echt getest | P2 | Onbekend of hydratatie in de praktijk vlekkeloos gaat | Zelf twee toestellen testen |
| 6 oude foto's op legacy pad | P3 | Geen (blijven leesbaar en privé) | Optioneel migreren met copy→verify→delete |
| Foto-analyses local-only | P3 | Verlies bij cache-clear | Naar `gc_coach_data` of eigen tabel |
| `pg_net` in public schema | P3 | Supabase-waarschuwing, niet van Coach | Verplaatsen naar `extensions` |
| Leaked password protection uit | P3 | Zwak wachtwoord blijft mogelijk | Aanzetten in Supabase Auth |
| Coach deelt project met andere apps | P3 | Restrisico bij gedeelde authenticated user | Apart project op termijn |
| Geen Vitest/ESLint | P3 | Regressies alleen via browsertests | Toevoegen |
| Oude Express-backend nog in repo | P3 | Verwarrend, niet gebruikt | Opruimen of documenteren |

---

## 21. TEST COMMANDS / RESULTS

| Command | Resultaat |
|---|---|
| `npm install` | PASS |
| `npm run build` | **PASS** — vite build, geen errors |
| `npm test` | NOT APPLICABLE — script bestaat niet |
| `npm run lint` | NOT APPLICABLE — script bestaat niet |

Browsertests (Playwright/Chromium) op de gedeployde build:

| Viewport | Loginpoort blokkeert data | Overflow | Page errors |
|---|---|---|---|
| 360 × 740 | PASS | 0 | 0 |
| 390 × 844 | PASS | 0 | 0 |
| 412 × 915 | PASS | 0 | 0 |
| 1280 × 800 | PASS | 0 | 0 |

Live verificatie: `gh-pages` commit `a317927`, `index.html` verwijst naar `assets/index-CvqaPTw0.js`, identiek aan de lokale build.

---

## 22. USER ACTION REQUIRED

Drie stappen. **Plak geen sleutels in de chat** — zet ze direct in Supabase.

### Stap 1 — Eén keer inloggen in Coach (1 minuut)
Open https://jetje1980.github.io/griette-coach/ en log in met `griette@yahoo.com` en je wachtwoord. Coach heeft nu een eigen sessie en erft er geen meer van een andere app. Weet je het wachtwoord niet: klik "Stuur me een inloglink".

### Stap 2 — Strava aanzetten (VOLTOOID op 19 aug 2026)
1. Ga naar **https://www.strava.com/settings/api** en open je API-applicatie (of maak er een aan).
2. Zet bij **Authorization Callback Domain** exact: `osuqtfsxmquwqsbgzlqn.supabase.co`
3. Noteer **Client ID** en **Client Secret**.
4. Ga naar **Supabase → Project `osuqtfsxmquwqsbgzlqn` → Edge Functions → Secrets** en voeg toe:
   - `STRAVA_CLIENT_ID` = je Client ID
   - `STRAVA_CLIENT_SECRET` = je Client Secret
   - `APP_URL` = `https://jetje1980.github.io/griette-coach/`
5. Open in Coach **Instellingen → Integraties → Koppel Strava** en geef toestemming.

Deel de Client Secret met niemand, ook niet in een chat.

### Stap 3 — Trello aanzetten

*Bijgewerkt 19 aug.* De API-key stáát goed en is los getoetst: geldig. Het
opgeslagen token hoort alleen bij een **andere** API-key, waardoor Trello
`invalid key` terugstuurt. Alleen het token moet dus vernieuwd worden, en dat kan
nu vanuit de app zelf — je hoeft niet meer in het Supabase-dashboard te zijn.

1. Open in Coach **Instellingen → Integraties → Trello**.
2. Klik **Stap 1 — Trello autoriseren**. De link wordt server-side gebouwd, dus de
   API-key komt niet in de app terecht. Geef toestemming aan "Griette Coach".
3. Trello toont daarna een lange code. Plak die in het veld en klik
   **Stap 2 — Opslaan**. De server toetst de code eerst bij Trello en bewaart hem
   pas als hij werkt, in `app_secrets` — niet in je browser.
4. Kies daarna je board en backlog-lijst. `Griette prive` en de lijst `backlog`
   staan al voorgeselecteerd.

Het token uit de database wint van het token in de omgeving, dus het oude,
verkeerde secret hoeft niet eens verwijderd te worden.

### Optioneel — wachtwoordbescherming
**Supabase → Authentication → Policies → Password protection** aanzetten (controleert tegen bekende gelekte wachtwoorden).

Na stap 2 en 3 werken Strava en Trello direct; er hoeft geen code meer bij. Laat het me weten, dan test ik ze end-to-end en werk ik dit rapport bij naar WORKING.

---

## 23. FINAL VERDICT

```
OVERALL STATUS:
PARTIAL

PRIVACY:
PASS
(anon geblokkeerd op tabelniveau, user-isolatie bewezen, bucket privé,
 geen secrets in de client)

SUPABASE AUTH:
PASS

RLS:
PASS
(bewezen met echte roltests, niet alleen SQL gelezen)

ANONYMOUS HEALTH DATA ACCESS:
BLOCKED

PROGRESS PHOTOS:
PRIVATE

CROSS-DEVICE CORE DATA:
PARTIAL / NOT VERIFIED
(architectuur is er; echte twee-device-test niet mogelijk in de sandbox)

STRAVA:
WORKING
(OAuth voltooid met read+activity:read_all, 30 activiteiten geimporteerd,
 token-refresh en duplicaatpreventie geverifieerd)

TRELLO:
AWAITING USER OAUTH
(volledig gebouwd, wacht op API_KEY/TOKEN)

BUILD:
PASS

REGRESSION:
PASS
(geen regressies; 0 page errors)

DATA SAFETY:
PASS
(73 rijen voor en na, hash identiek, niets verwijderd)

TOP 5 REMAINING ACTIONS:
1. Eenmalig inloggen in Coach (stap 1 hierboven).
2. Trello-secrets zetten en board kiezen (stap 3).
3. Cross-device zelf bevestigen met twee toestellen.
4. Op termijn een apart Supabase-project voor Coach, los van de andere apps.
5. Strava-sync periodiek laten lopen zodat nieuwe runs vanzelf binnenkomen.
```

---

## 24. SHAREABLE COPY BLOCK

=== COPY THIS TO CHATGPT FOR INDEPENDENT REVIEW ===

**Project:** Griëtte Coach — persoonlijke performance-coach-webapp (React + Vite, single user) voor iemand met long COVID/PEM, ADHD en perimenopauze. Frontend op GitHub Pages: https://jetje1980.github.io/griette-coach/. Repo `jetje1980/griette-coach`, branch `claude/coach-app-archive-missing-0dgmzb`, code-commit `cd9aa82`, deployment `gh-pages` commit `a317927`, live bundle `assets/index-CvqaPTw0.js` (hash geverifieerd identiek aan de lokale `vite build`). Geen tests of linter in het project (`package.json` heeft alleen dev/build/preview).

**Supabase.** Project-ref `osuqtfsxmquwqsbgzlqn` (eu-west-1, Postgres 17.6, ACTIVE_HEALTHY). Dit project wordt gedeeld met andere apps van dezelfde eigenaar (`slovenie_*`-tabellen van een reis-app, plus `users`, `sessions`, `photos`, `comments`; en Edge Functions `kompas-api`, `kompas-app`, `paris-chat`, `fitness-ai`, `log-session`). De client gebruikt een publishable/anon key die hardcoded in de bundle staat — publiek bedoeld en alleen veilig in combinatie met RLS.

**Wat deze ronde is veranderd.** Een eerdere audit concludeerde op basis van clientcode dat `gc_coach_data` geen `user_id` had en dat RLS niet geverifieerd was. Met daadwerkelijke beheerstoegang bleek dat onjuist: de tabel had al `user_id uuid NOT NULL DEFAULT auth.uid()`, RLS aan, en een `Owner access`-policy `FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. De bucket `progress-photos` was al privé (`public = false`) met vier owner-policies op `owner_id = auth.uid()::text`.

Wat er wél mis was, en nu is opgelost: (1) de primaire sleutel stond op `(key)` in plaats van `(user_id, key)`, waardoor twee gebruikers op dezelfde sleutel zouden botsen; (2) de app had **geen eigen authenticatie** en pikte de Supabase-sessie op van een andere app op hetzelfde origin (`jetje1980.github.io`) — Supabase bewaart sessies per origin, dus dit werkte per ongeluk; (3) er waren drie losse Supabase-clients; (4) mislukte cloud-writes verdwenen stil; (5) er was nog een directe browser-AI-route met de header `anthropic-dangerous-direct-browser-access`.

Aanpak: eerst backup (tabel `gc_coach_data_backup_20260818` plus lokale JSON, 73 rijen, md5 `d11dabd1a4570779cd49b149f133d16c`), daarna PK-migratie naar `(user_id, key)`. Na migratie: 73 rijen, identieke hash, nul verlies. Belangrijk detail: `CREATE TABLE AS SELECT` erft geen RLS, dus de backuptabel was even een nieuw lek — in dezelfde migratie is daar RLS plus owner-policy op gezet.

Nieuw in de frontend: `src/supabase.js` (één gedeelde client met eigen `storageKey: 'gc_auth_session'`), `src/components/AuthGate.jsx` (e-mail/wachtwoord plus magic link; zonder sessie geen data; bij uitloggen worden `gc_*`-caches en drie IndexedDB-databases gewist), een herschreven `src/sync.js` (cloud leidend, hydratatie bij opstarten, `user_id` expliciet mee, `onConflict: 'user_id,key'`, en een persistente wachtrij zodat een mislukte schrijfactie niet stil verdwijnt maar zichtbaar wordt met retry-knop), en `src/mediaStore.js` (Dream Board-afbeeldingen en workout-screenshots naar de private bucket met readback-verificatie; lokale kopie blijft staan, niets wordt verwijderd zonder bewijs).

**Nieuwe database-objecten**, alle met RLS `FOR ALL TO authenticated USING (auth.uid() = user_id)`: `strava_connections` (PK `user_id`; access/refresh token, `expires_at` — tokens staan server-side, niet meer in localStorage), `workout_imports` (unique `(user_id, external_provider, external_id)` zodat een sync dezelfde activiteit nooit twee keer importeert), `task_links` (unique `(user_id, external_provider, idempotency_key)` zodat dubbel tikken of een retry nooit een tweede Trello-card oplevert).

**Drie Edge Functions gedeployed.** `coach-ai` (verify_jwt = true) proxyt naar Anthropic met een server-side secret; de directe browserroute is verwijderd en `dangerous-direct-browser-access` heeft nu 0 hits in de bundle (was 1). `coach-strava` (verify_jwt = false omdat Strava de callback zonder Supabase-token aanroept; alle andere routes valideren de JWT expliciet in de code en halen de identiteit nooit uit de request-body) doet status, OAuth-start met `state = user_id`, callback, token-refresh, activities, sync met duplicaatpreventie en disconnect. `coach-trello` (verify_jwt = true) doet status, boards, lijsten, kaarten en idempotente card-creatie.

**Securitytests, echt uitgevoerd** als Postgres-rollen met gezette JWT-claims tegen de werkelijke policies: anon die `gc_coach_data` leest krijgt `ERROR 42501: permission denied for table gc_coach_data` (dus geblokkeerd op grant-niveau, nog vóór RLS); de eigenaar ziet 73 rijen; een andere authenticated user ziet 0 rijen; hetzelfde patroon voor de backuptabel; de eigenaar ziet 6 foto-objecten, een andere user 0; de bucket is `public = false`. Secretsscan op de gedeployde bundle: 0 hits op `service_role`, JWT-headers, `STRAVA_CLIENT_SECRET`, `TRELLO_TOKEN` en `dangerous-direct-browser-access`; de enige `sk-ant-` hit is placeholder-tekst in de UI. Supabase security advisor meldt geen kritieke problemen, wel twee WARN-items: `pg_net` staat in het public schema (bestaand, niet van Coach) en leaked-password-protection staat uit.

**Browsertests** op de gedeployde build, viewports 360/390/412/1280: de AuthGate blokkeert alle coach-data, geen horizontale overflow, nul page-errors. Uitgelogd wordt geen gezondheidsdata getoond, ook niet uit een gevulde localStorage-cache. Regressietest achter de poort (met gesimuleerde sessie, want uitgaand HTTPS is geblokkeerd in de testomgeving): Decision Cockpit, Wat Nu, Top 3, performance strip, T1–T35, de gating die BUILD tegenhoudt tot de herstelcheck is beantwoord, bleeding-registratie, cyclushistorie, Ajovi-historie, Capture met bestemmingskeuze, goal engine, en 25 subtabs — alles werkt, nul page-errors, geen regressies.

**Wat nog niet af is.** Strava en Trello staan op AWAITING USER ACTION: de code is compleet en gedeployed, maar `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` en `TRELLO_API_KEY`/`TRELLO_TOKEN` moeten door de eigenaar als Edge Function secrets worden gezet — die horen niet in een chat en ik heb er geen tool voor. Zonder secrets antwoorden de functies met `configured: false` en zegt de UI letterlijk dat de sleutels ontbreken; er wordt nergens een werkende koppeling geclaimd. Cross-device is PARTIAL/NOT VERIFIED: de architectuur is er, maar een echte twee-device-test kon niet omdat de testomgeving `supabase.co` niet mag bereiken (curl geeft HTTP 000, de browser `ERR_TUNNEL_CONNECTION_FAILED`). Verder blijven zes progressiefoto's op het oude pad `{datum}/{type}.jpeg` staan — bewust niet verplaatst, want de beveiliging leunt op `owner_id` en niet op het pad, en Fase 20 verbiedt verwijderen zonder bewijs; de app leest beide locaties. Foto-analyses (`gc_photo_analysis_*`) zijn nog local-only.

**Restrisico dat het vermelden waard is:** Coach deelt één Supabase-project met andere apps van dezelfde eigenaar. Anonieme toegang tot Coach-data is bewezen geblokkeerd, maar zou een andere app ooit met Supabase Auth als dezelfde gebruiker inloggen, dan zou die technisch bij `gc_coach_data` kunnen. Dit risico is verkleind doordat Coach nu een eigen sessie-`storageKey` heeft; volledige isolatie vraagt een apart project.

**Vraag voor onafhankelijke review:** (1) Is de migratievolgorde correct en veilig uitgevoerd — backup met hash-verificatie, dan PK-wijziging, dan hertelling en hash-vergelijking? (2) Klopt de conclusie dat `permission denied` op anon-niveau plus `auth.uid() = user_id` policies voldoende is voor gezondheidsdata in een gedeeld project, of is een apart Supabase-project noodzakelijk in plaats van aanbevolen? (3) Is `verify_jwt = false` op `coach-strava` verdedigbaar gezien de callback-eis, nu alle andere routes de JWT expliciet valideren en `state` de user_id draagt — of introduceert die `state`-parameter een risico dat ik over het hoofd zie?

=== END COPY BLOCK ===
