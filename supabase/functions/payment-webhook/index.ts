// Webhook de pagos — base para cuando actives cobros.
// Cambia el plan de un usuario a "pro" (o "free") cuando la pasarela de pago confirma un cobro.
//
// Cómo funciona hoy: recibe un JSON { user_id, plan, plan_until, provider, customer_id } con el encabezado
// x-webhook-secret igual a la variable WEBHOOK_SECRET. Cada pasarela (Wompi, Mercado Pago, RevenueCat…)
// manda su propio formato y su propia firma: cuando elijas una, adapta la función "leerEvento" a su documentación
// y verifica SU firma en lugar de (o además de) x-webhook-secret.
//
// Publicar:  supabase functions deploy payment-webhook --no-verify-jwt
// Secretos:  supabase secrets set WEBHOOK_SECRET=una-clave-larga-y-secreta
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

type Evento = { user_id: string; plan: "free" | "pro"; plan_until?: string | null; provider?: string; customer_id?: string };

function leerEvento(body: unknown): Evento | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b.user_id !== "string" || (b.plan !== "free" && b.plan !== "pro")) return null;
  return {
    user_id: b.user_id,
    plan: b.plan,
    plan_until: typeof b.plan_until === "string" ? b.plan_until : null,
    provider: typeof b.provider === "string" ? b.provider : undefined,
    customer_id: typeof b.customer_id === "string" ? b.customer_id : undefined,
  };
}

// Comparación en tiempo constante: evita adivinar el secreto midiendo cuánto tarda la respuesta.
function igualSeguro(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || secret.length < 32 || !igualSeguro(req.headers.get("x-webhook-secret") ?? "", secret)) return new Response("Unauthorized", { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 10_000) return new Response("Payload too large", { status: 413 });

  let ev: Evento | null = null;
  try { const txt = await req.text(); if (txt.length <= 10_000) ev = leerEvento(JSON.parse(txt)); } catch { /* cuerpo inválido */ }
  if (!ev) return new Response("Bad request", { status: 400 });

  // La clave service_role solo vive aquí, en el servidor. Nunca en la app.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.from("profiles").update({
    plan: ev.plan,
    plan_until: ev.plan_until,
    payment_provider: ev.provider ?? null,
    payment_customer_id: ev.customer_id ?? null,
  }).eq("id", ev.user_id);

  if (error) return new Response("Database error", { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
