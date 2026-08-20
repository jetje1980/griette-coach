// Griëtte Coach — Strava-integratie.
//
// Scope: read,activity:read_all — genoeg voor activiteiten inclusief privé-
// activiteiten, hartslag en streams. Bewust GÉÉN activity:write.
//
// approval_prompt=force is essentieel: met 'auto' hergebruikt Strava een
// eerdere, smallere toestemming en blijft een token met alleen 'read' staan.
//
// verify_jwt staat uit omdat Strava /callback aanroept zonder Supabase-token
// en pg_cron /cron-sync aanroept met een eigen geheim. Alle gebruikersroutes
// valideren de JWT expliciet in de code; identiteit komt nooit uit de body.
//
// Secrets: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, APP_URL

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "https://jetje1980.github.io/griette-coach/";

const REQUIRED_SCOPES = ["read", "activity:read_all"];

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const configured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  return error || !data?.user ? null : data.user;
}

const scopeList = (s: string | null) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const missingScopes = (s: string | null) => {
  const have = scopeList(s);
  return REQUIRED_SCOPES.filter(r => !have.includes(r));
};

async function freshToken(userId: string) {
  const db = admin();
  const { data: conn } = await db.from("strava_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return { token: null as string | null, scope: null as string | null, refreshed: false };

  if (new Date(conn.expires_at).getTime() - Date.now() > 120_000) {
    return { token: conn.access_token, scope: conn.scope, refreshed: false };
  }

  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: "refresh_token", refresh_token: conn.refresh_token,
    }),
  });
  if (!r.ok) return { token: null, scope: conn.scope, refreshed: false };
  const t = await r.json();

  await db.from("strava_connections").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return { token: t.access_token as string, scope: conn.scope, refreshed: true };
}

async function fetchActivities(token: string, perPage = 30) {
  const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Strava API ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

async function importActivities(userId: string, activities: Record<string, unknown>[]) {
  const db = admin();
  let imported = 0, skipped = 0;
  for (const a of activities) {
    const { error } = await db.from("workout_imports").insert({
      user_id: userId,
      external_provider: "strava",
      external_id: String(a.id),
      external_url: `https://www.strava.com/activities/${a.id}`,
      payload: a,
    });
    if (error) skipped++; else imported++;
  }
  return { imported, skipped, total: activities.length };
}

function paceFrom(distanceM: number, movingSec: number): string | null {
  if (!distanceM || !movingSec) return null;
  const s = movingSec / (distanceM / 1000);
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}
function hms(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
           : `${m}:${String(s).padStart(2, "0")}`;
}

// Ronden en splits van één activiteit. Dit is wat loop- en wandelblokken
// van elkaar scheidbaar maakt; de lijst-endpoint van Strava levert ze niet.
function segmentsOf(detail: Record<string, any>) {
  const laps = (detail.laps || []).map((l: Record<string, number>) => ({
    distance: l.distance, movingTime: l.moving_time,
    avgHr: l.average_heartrate ?? null, maxHr: l.max_heartrate ?? null,
    pace: paceFrom(l.distance, l.moving_time),
  }));
  const splits = (detail.splits_metric || []).map((s: Record<string, number>) => ({
    km: s.split, distance: s.distance, movingTime: s.moving_time,
    avgHr: s.average_heartrate ?? null,
    pace: paceFrom(s.distance, s.moving_time),
  }));
  return { laps, splits };
}

// Streams uitdunnen. Een run van een half uur levert ~1800 punten per reeks;
// dat hoeft niet allemaal over de lijn. Eén punt per twee seconden is ruim
// genoeg om loop- en wandelblokken te onderscheiden, en scheelt de helft.
function thinStreams(streams: Record<string, any>, everyNth = 2) {
  const out: Record<string, number[]> = {};
  for (const key of ["time", "velocity_smooth", "distance", "heartrate", "cadence", "altitude"]) {
    const d = streams?.[key]?.data;
    if (!Array.isArray(d)) continue;
    out[key] = everyNth <= 1 ? d : d.filter((_: unknown, i: number) => i % everyNth === 0);
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const route = url.pathname.split("/").pop() || "status";

  if (route === "cron-sync") {
    if (!configured()) return json({ error: "Strava niet geconfigureerd" }, 503);

    const provided = req.headers.get("x-cron-secret") || "";
    const db = admin();
    const { data: secretRow } = await db.from("app_secrets")
      .select("value").eq("name", "strava_cron_secret").maybeSingle();
    if (!secretRow?.value || provided !== secretRow.value) {
      return json({ error: "Ongeldig cron-geheim" }, 401);
    }

    const { data: conns } = await db.from("strava_connections").select("user_id, scope");
    const results: Record<string, unknown>[] = [];
    for (const c of conns || []) {
      try {
        if (missingScopes(c.scope).length) {
          results.push({ user: c.user_id, skipped: "scope ontbreekt" });
          continue;
        }
        const { token, refreshed } = await freshToken(c.user_id);
        if (!token) { results.push({ user: c.user_id, error: "geen token" }); continue; }
        const activities = await fetchActivities(token, 30);
        const res = await importActivities(c.user_id, activities);
        results.push({ user: c.user_id, refreshed, ...res });
      } catch (e) {
        results.push({ user: c.user_id, error: (e as Error).message });
      }
    }

    await db.from("app_secrets").upsert({
      name: "strava_last_cron", value: new Date().toISOString(),
    }, { onConflict: "name" });

    return json({ ok: true, ranAt: new Date().toISOString(), connections: results.length, results });
  }

  if (route === "callback") {
    if (!configured()) return new Response("Strava niet geconfigureerd", { status: 503 });
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");
    const grantedScope = url.searchParams.get("scope");
    if (url.searchParams.get("error")) {
      return new Response(null, { status: 302, headers: { Location: `${APP_URL}?strava=denied` } });
    }
    if (!code || !userId) return new Response("Ongeldige callback", { status: 400 });

    const r = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        code, grant_type: "authorization_code",
      }),
    });
    if (!r.ok) return new Response("Token-uitwisseling mislukt", { status: 502 });
    const t = await r.json();
    const scope = grantedScope || t.scope || null;

    await admin().from("strava_connections").upsert({
      user_id: userId,
      athlete_id: t.athlete?.id ?? null,
      athlete_name: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ") || null,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(),
      scope,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    const missing = missingScopes(scope);
    const q = missing.length
      ? `strava=partial&missing=${encodeURIComponent(missing.join(","))}`
      : "strava=connected";
    return new Response(null, { status: 302, headers: { Location: `${APP_URL}?${q}` } });
  }

  const user = await requireUser(req);
  if (!user) return json({ error: "Niet ingelogd" }, 401);

  if (route === "status") {
    if (!configured()) {
      return json({ connected: false, configured: false, reachable: true,
        requiredScopes: REQUIRED_SCOPES,
        reason: "STRAVA_CLIENT_ID/SECRET niet ingesteld als Edge Function secret" });
    }
    const db = admin();
    const { data } = await db.from("strava_connections")
      .select("athlete_id, athlete_name, scope, expires_at").eq("user_id", user.id).maybeSingle();
    if (!data) {
      return json({ connected: false, configured: true, reachable: true, requiredScopes: REQUIRED_SCOPES });
    }
    const { data: last } = await db.from("app_secrets")
      .select("value").eq("name", "strava_last_cron").maybeSingle();
    const { count } = await db.from("workout_imports")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("external_provider", "strava");

    const missing = missingScopes(data.scope);
    return json({
      connected: true, configured: true, reachable: true,
      athlete: data.athlete_name ?? null,
      athleteId: data.athlete_id ?? null,
      scopes: scopeList(data.scope),
      requiredScopes: REQUIRED_SCOPES,
      missingScopes: missing,
      scopeOk: missing.length === 0,
      expiresAt: data.expires_at,
      autoSyncAt: last?.value ?? null,
      importedCount: count ?? null,
    });
  }

  // Reeds geïmporteerde activiteiten uit de database. Overleeft een verlopen
  // token, kent ook wat de cron ophaalde, en raakt geen Strava-limieten.
  if (route === "imported") {
    const since = url.searchParams.get("since");
    const limit = Math.min(400, Number(url.searchParams.get("limit")) || 200);
    const { data, error } = await admin().from("workout_imports")
      .select("external_id, external_url, payload")
      .eq("user_id", user.id).eq("external_provider", "strava")
      .order("imported_at", { ascending: false }).limit(limit);
    if (error) return json({ error: error.message }, 500);
    const out = (data || []).map(r => {
      const a = (r.payload || {}) as Record<string, any>;
      const local = String(a.start_date_local || a.start_date || "");
      return { externalId: String(r.external_id), url: r.external_url ?? null,
        date: local.slice(0, 10) || null, startLocal: local || null,
        hasSegments: Boolean(a.__laps || a.__splits),
        hasDerived: Boolean(a.__derivedLaps) };
    }).filter(a => a.date && (!since || a.date >= since));
    return json(out);
  }

  if (route === "auth") {
    if (!configured()) return json({ error: "Strava niet geconfigureerd" }, 503);
    const redirect = `${SUPABASE_URL}/functions/v1/coach-strava/callback`;
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}` +
      `&response_type=code&redirect_uri=${encodeURIComponent(redirect)}` +
      `&approval_prompt=force&scope=${encodeURIComponent(REQUIRED_SCOPES.join(","))}` +
      `&state=${user.id}`;
    return json({ url: authUrl, scopes: REQUIRED_SCOPES });
  }

  if (route === "disconnect") {
    await admin().from("strava_connections").delete().eq("user_id", user.id);
    return json({ ok: true, connected: false });
  }

  const { token, scope, refreshed } = await freshToken(user.id);
  if (!token) return json({ error: "Niet gekoppeld aan Strava" }, 400);

  const missing = missingScopes(scope);
  if (missing.length && route !== "activities") {
    return json({ error: `Ontbrekende Strava-toestemming: ${missing.join(", ")}`,
      missingScopes: missing, needsReauth: true }, 403);
  }

  const sv = async (path: string) => {
    const r = await fetch(`https://www.strava.com/api/v3${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Strava API ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return r.json();
  };

  try {
    if (route === "activities") return json(await sv("/athlete/activities?per_page=30"));

    // Ronden en splits van één activiteit, en meteen bewaard bij de import.
    // Ze worden lui opgehaald: alleen voor sessies waar de app ze nodig
    // heeft, zodat de Strava-limieten niet onnodig worden aangesproken.
    if (route === "detail") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id ontbreekt" }, 400);
      const detail = await sv(`/activities/${id}?include_all_efforts=false`);
      const { laps, splits } = segmentsOf(detail);

      const db = admin();
      const { data: row } = await db.from("workout_imports")
        .select("payload").eq("user_id", user.id)
        .eq("external_provider", "strava").eq("external_id", String(id)).maybeSingle();
      if (row) {
        await db.from("workout_imports")
          .update({ payload: { ...(row.payload || {}), __laps: laps, __splits: splits } })
          .eq("user_id", user.id).eq("external_provider", "strava").eq("external_id", String(id));
      }

      return json({
        ok: true, id: String(detail.id),
        date: (detail.start_date_local || "").slice(0, 10),
        laps, splits,
        hasHeartrate: Boolean(detail.has_heartrate),
        averageCadence: detail.average_cadence ?? null,
      });
    }

    // De ruwe streams van één activiteit.
    //
    // Hiervoor bestaat een concrete reden. Haar horloge legt geen ronden vast
    // op de overgang lopen/wandelen, dus levert Strava alleen kilometersplits
    // — en daar zit lopen en wandelen dóór elkaar. De streams bevatten wél
    // per seconde de snelheid, de hartslag en meestal de cadans, en daaruit
    // zijn de blokken alsnog af te leiden. De app doet die afleiding zelf
    // (streamSegments.js); deze route levert alleen de gegevens.
    if (route === "streams") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id ontbreekt" }, 400);
      const everyNth = Math.max(1, Math.min(5, Number(url.searchParams.get("every")) || 2));

      let raw: Record<string, any> | null = null;
      try {
        raw = await sv(`/activities/${id}/streams` +
          "?keys=time,velocity_smooth,distance,heartrate,cadence&key_by_type=true");
      } catch (e) {
        return json({ ok: false, id: String(id), available: false,
          reason: `Strava gaf geen streams terug: ${(e as Error).message}` });
      }

      const streams = thinStreams(raw || {}, everyNth);
      const n = streams.time?.length ?? 0;
      if (!n) {
        return json({ ok: true, id: String(id), available: false,
          reason: "Deze activiteit heeft geen bruikbare streams." });
      }

      return json({
        ok: true, id: String(id), available: true,
        everyNth, points: n,
        keys: Object.keys(streams),
        hasCadence: Array.isArray(streams.cadence) && streams.cadence.some(c => c > 0),
        streams,
      });
    }

    if (route === "latest") {
      const list = await sv("/athlete/activities?per_page=1");
      if (!Array.isArray(list) || !list.length) {
        return json({ ok: true, activity: null, note: "Geen activiteiten gevonden" });
      }
      const detail = await sv(`/activities/${list[0].id}?include_all_efforts=false`);
      let streams: Record<string, { data?: unknown[] }> | null = null;
      try {
        streams = await sv(`/activities/${detail.id}/streams?keys=time,heartrate,distance,velocity_smooth,cadence,altitude&key_by_type=true`);
      } catch { streams = null; }

      const movingTime = detail.moving_time;
      const distance = detail.distance;
      const { laps, splits } = segmentsOf(detail);
      return json({
        ok: true, refreshed, scopes: scopeList(scope),
        activity: {
          id: String(detail.id), name: detail.name,
          type: detail.sport_type || detail.type,
          startLocal: detail.start_date_local,
          date: (detail.start_date_local || "").slice(0, 10),
          distanceKm: distance ? +(distance / 1000).toFixed(2) : null,
          movingTime: movingTime ? hms(movingTime) : null,
          elapsedTime: detail.elapsed_time ? hms(detail.elapsed_time) : null,
          pacePerKm: paceFrom(distance, movingTime),
          averageHr: detail.average_heartrate ?? null,
          maxHr: detail.max_heartrate ?? null,
          hasHeartrate: Boolean(detail.has_heartrate),
          elevationGain: detail.total_elevation_gain ?? null,
          url: `https://www.strava.com/activities/${detail.id}`,
          laps, splits,
          streamsAvailable: streams ? Object.keys(streams) : [],
          streamPointCount: streams?.time?.data?.length ?? null,
        },
      });
    }

    if (route === "sync") {
      const activities = await fetchActivities(token, 30);
      const res = await importActivities(user.id, activities);
      return json({ ok: true, count: res.imported, skipped: res.skipped, total: res.total, refreshed });
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }

  return json({ error: "Onbekende route" }, 404);
});
