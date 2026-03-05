import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendBrevoEmail(apiKey: string, to: string, subject: string, htmlContent: string) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: "Música Mágica", email: "andreguimel@gmail.com" },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Brevo error:", JSON.stringify(data));
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Origin validation
  const originHeader = req.headers.get("origin") || "";
  const allowedOrigins = ["lovable.app", "lovableproject.com", "localhost", "musicamagica.com", "vercel.app", "musicamagica.com.br"];
  if (!allowedOrigins.some((o) => originHeader.includes(o))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { taskId, plan, origin, customerName, customerEmail: reqEmail, customerCpf, discountPercent, refCode } = await req.json();

    const ABACATEPAY_API_KEY = Deno.env.get("ABACATEPAY_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

    if (!ABACATEPAY_API_KEY) throw new Error("ABACATEPAY_API_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the task
    const { data: task, error: fetchError } = await supabase
      .from("music_tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      return new Response(
        JSON.stringify({ error: "Task not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine price in cents, applying discount if provided
    let priceInCents = plan === "pacote" ? 2490 : 990;
    if (discountPercent && typeof discountPercent === "number" && discountPercent > 0 && discountPercent <= 50) {
      priceInCents = Math.round(priceInCents * (1 - discountPercent / 100));
    }
    const productName = plan === "pacote"
      ? `Pacote Encantado - 3 músicas personalizadas`
      : `Música Mágica para ${task.child_name}`;

    const customerEmail = reqEmail || task.user_email || `customer-${taskId.substring(0, 8)}@musicamagica.com`;

    // Update task with customer email and ref_code if provided
    const updateFields: Record<string, string> = {};
    if (reqEmail && reqEmail !== task.user_email) updateFields.user_email = reqEmail;
    if (refCode) updateFields.ref_code = refCode;
    if (Object.keys(updateFields).length > 0) {
      await supabase.from("music_tasks").update(updateFields).eq("id", taskId);
    }

    // Create PIX QR Code directly (real PIX, not a billing link)
    console.log("Creating PIX QR Code...");
    const pixBody = {
      amount: priceInCents,
      expiresIn: 900, // 15 minutes
      description: productName,
      customer: {
        name: customerName || task.child_name,
        email: customerEmail,
        cellphone: "11999999999",
        taxId: customerCpf || "52998224725",
      },
      metadata: {
        externalId: taskId,
      },
    };

    const pixResponse = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
      },
      body: JSON.stringify(pixBody),
    });

    const pixText = await pixResponse.text();
    console.log("AbacatePay PIX response:", pixText);

    let pixData;
    try {
      pixData = JSON.parse(pixText);
    } catch {
      throw new Error(`AbacatePay returned non-JSON: ${pixText.substring(0, 200)}`);
    }

    if (!pixResponse.ok) {
      throw new Error(`AbacatePay PIX error (${pixResponse.status}): ${pixText.substring(0, 300)}`);
    }

    const pixId = pixData.data?.id || pixData.id;
    const brCode = pixData.data?.brCode || pixData.brCode;
    const brCodeBase64 = pixData.data?.brCodeBase64 || pixData.brCodeBase64;

    console.log("Extracted pixId:", pixId);

    // Update task with pix info (store pix ID in billing_id for webhook tracking)
    const { error: updateError } = await supabase
      .from("music_tasks")
      .update({
        billing_id: pixId || null,
        payment_url: brCode || null,
        payment_status: "pending",
      })
      .eq("id", taskId);

    if (updateError) {
      console.error("DB update error:", updateError);
    }

    // Send admin notification email (fire-and-forget)
    if (BREVO_API_KEY) {
      const priceFormatted = (priceInCents / 100).toFixed(2).replace(".", ",");
      const planLabel = plan === "pacote" ? "Pacote Encantado (3 músicas)" : "Música Avulsa";
      const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
  .container { max-width: 520px; margin: 0 auto; padding: 24px; }
  .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .badge { display: inline-block; background: #fef3c7; color: #92400e; border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  h2 { color: #1f2937; margin: 0 0 20px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .label { color: #6b7280; }
  .value { color: #111827; font-weight: 600; }
  .price { color: #059669; font-size: 22px; font-weight: 800; margin-top: 16px; }
</style></head>
<body><div class="container"><div class="card">
  <div class="badge">🛒 Cliente Iniciou</div>
  <h2>Novo checkout iniciado!</h2>
  <div class="row"><span class="label">👶 Criança</span><span class="value">${task.child_name}</span></div>
  <div class="row"><span class="label">🎨 Tema</span><span class="value">${task.theme}</span></div>
  <div class="row"><span class="label">📦 Plano</span><span class="value">${planLabel}</span></div>
  <div class="row"><span class="label">👤 Cliente</span><span class="value">${customerName || "(não informado)"}</span></div>
  <div class="row"><span class="label">📧 E-mail</span><span class="value">${customerEmail}</span></div>
  <div class="row"><span class="label">🪪 CPF</span><span class="value">${customerCpf || "(não informado)"}</span></div>
  ${discountPercent ? `<div class="row"><span class="label">🏷️ Desconto</span><span class="value">${discountPercent}%</span></div>` : ""}
  <div class="price">💰 R$ ${priceFormatted}</div>
</div></div></body></html>`;

      sendBrevoEmail(BREVO_API_KEY, "andreguimel@gmail.com", "🛒 Cliente Iniciou — Música Mágica", adminHtml)
        .catch((e) => console.error("Failed to send admin email:", e));
    }

    return new Response(
      JSON.stringify({ billingId: pixId, brCode, brCodeBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-billing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao criar cobrança" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
