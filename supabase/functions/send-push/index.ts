// Luca · Enviar notificaciones push (solo desarrolladores).
// Secretos: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:luca.app.col@gmail.com)
// Cuerpo: { titulo, cuerpo, publico: "todos" | "pro" | "normal" | "<correo>", url? }
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "https://andresr-7.github.io", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- Firebase Cloud Messaging (app de Android). Secreto: FCM_SERVICE_ACCOUNT = JSON de la cuenta de servicio ----
let fcmToken: { t: string; exp: number } | null = null;
const b64url = (b: ArrayBuffer | string) => btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function tokenFCM(sa: { client_email: string; private_key: string }) {
  if (fcmToken && fcmToken.exp > Date.now() + 60000) return fcmToken.t;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })), claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----|\s/g, ""), der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + claim));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + b64url(sig) });
  const j = await r.json(); fcmToken = { t: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }; return fcmToken.t;
}
async function enviarFCM(token: string, title: string, body: string, url: string): Promise<"ok" | "muerta" | "error"> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT"); if (!raw) return "error";
  const sa = JSON.parse(raw);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, { method: "POST", headers: { Authorization: "Bearer " + await tokenFCM(sa), "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: { url }, android: { priority: "HIGH", notification: { default_sound: true } } } }) });
  if (r.ok) return "ok";
  const t = await r.text(); return /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(t) ? "muerta" : "error";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // ¿Quién llama? Debe ser desarrollador.
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: dev } = await caller.rpc("es_dev");
  if (dev !== true) return json({ error: "Solo desarrolladores" }, 403);

  let b: { titulo?: string; cuerpo?: string; publico?: string; url?: string };
  try { b = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const titulo = String(b.titulo ?? "").slice(0, 60).trim(), cuerpo = String(b.cuerpo ?? "").slice(0, 180).trim(), publico = String(b.publico ?? "todos").trim().toLowerCase();
  if (!titulo || !cuerpo) return json({ error: "Falta título o mensaje" }, 400);

  const admin = createClient(url, service);
  let ids: string[] | null = null;
  if (publico !== "todos") {
    const { data: users } = await admin.rpc("admin_usuarios_srv");
    const lista = (users ?? []) as { id: string; email: string; tipo: string }[];
    ids = lista.filter((u) => publico.includes("@") ? u.email.toLowerCase() === publico : u.tipo === publico || (publico === "pro" && u.tipo === "desarrollador")).map((u) => u.id);
    if (!ids.length) return json({ enviados: 0, fallidos: 0, nota: "Nadie coincide con ese público" });
  }
  let q = admin.from("push_subs").select("id, endpoint, p256dh, auth");
  if (ids) q = q.in("user_id", ids);
  const { data: subs, error } = await q;
  if (error) return json({ error: "Error leyendo suscripciones" }, 500);

  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:luca.app.col@gmail.com", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);
  const payload = JSON.stringify({ title: titulo, body: cuerpo, url: b.url || "./" });
  let ok = 0, ko = 0; const muertas: number[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    if (s.endpoint.startsWith("fcm:")) {
      const r = await enviarFCM(s.endpoint.slice(4), titulo, cuerpo, b.url || "./");
      if (r === "ok") ok++; else { ko++; if (r === "muerta") muertas.push(s.id); }
      return;
    }
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" }); ok++; }
    catch (e) { ko++; const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) muertas.push(s.id); }
  }));
  if (muertas.length) await admin.from("push_subs").delete().in("id", muertas);
  await admin.from("push_envios").insert({ titulo, cuerpo, publico, enviados: ok, fallidos: ko });
  return json({ enviados: ok, fallidos: ko });
});
