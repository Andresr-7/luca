// Luca · Enviar notificaciones push (solo desarrolladores).
// Secretos: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:luca.app.col@gmail.com)
// Cuerpo: { titulo, cuerpo, publico: "todos" | "pro" | "normal" | "<correo>", url? }
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const CORS = { "Access-Control-Allow-Origin": "https://andresr-7.github.io", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

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
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 }); ok++; }
    catch (e) { ko++; const c = (e as { statusCode?: number }).statusCode; if (c === 404 || c === 410) muertas.push(s.id); }
  }));
  if (muertas.length) await admin.from("push_subs").delete().in("id", muertas);
  await admin.from("push_envios").insert({ titulo, cuerpo, publico, enviados: ok, fallidos: ko });
  return json({ enviados: ok, fallidos: ko });
});
