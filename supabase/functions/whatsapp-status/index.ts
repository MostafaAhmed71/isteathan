import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const gatewayUrl = (Deno.env.get("WHATSAPP_GATEWAY_URL") || "").replace(/\/$/, "");
  const gatewaySecret = Deno.env.get("WHATSAPP_GATEWAY_SECRET") || "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: cors });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: cors });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "ADMIN") {
    return Response.json({ error: "forbidden" }, { status: 403, headers: cors });
  }

  if (!gatewayUrl) {
    return Response.json(
      { connected: false, state: "gateway_not_configured", qr: null },
      { headers: cors },
    );
  }

  try {
    const r = await fetch(`${gatewayUrl}/status`, {
      headers: gatewaySecret ? { "X-WhatsApp-Secret": gatewaySecret } : {},
    });
    const data = await r.json().catch(() => ({})) as Record<string, unknown>;
    return Response.json(
      {
        connected: Boolean(data.connected),
        state: data.state ?? "disconnected",
        qr: typeof data.qr === "string" ? data.qr : null,
      },
      { headers: cors },
    );
  } catch {
    return Response.json(
      { connected: false, state: "gateway_offline", qr: null },
      { headers: cors },
    );
  }
});
