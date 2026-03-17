import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const originHeader = req.headers.get("origin") || "";
  const allowedOrigins = ["lovable.app", "lovableproject.com", "localhost", "musicamagica.com", "vercel.app", "musicamagica.com.br"];
  if (!allowedOrigins.some((o) => originHeader.includes(o))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { taskId, origin } = await req.json();

    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!MERCADOPAGO_ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Create upsell placeholder task
    const { data: upsellTask, error: upsellError } = await supabase
      .from("music_tasks")
      .insert({
        child_name: `upsell-${task.child_name}`,
        age_group: task.age_group,
        theme: task.theme,
        music_style: task.music_style,
        user_email: task.user_email,
        status: "awaiting_payment",
        payment_status: "pending",
        lyrics: "__UPSELL__",
        price_paid: 15.00,
      })
      .select("id")
      .single();

    if (upsellError || !upsellTask) {
      throw new Error("Failed to create upsell task");
    }

    const customerEmail = task.user_email || `customer-${taskId.substring(0, 8)}@musicamagica.com`;
    const transactionAmount = 15.00;
    const productName = "Upgrade Pacote Encantado - +2 músicas";

    // Create Mercado Pago Pix payment
    const mpBody = {
      transaction_amount: transactionAmount,
      payment_method_id: "pix",
      statement_descriptor: "MUSICA MAGICA",
      payer: {
        email: customerEmail,
        first_name: task.child_name,
        identification: {
          type: "CPF",
          number: "00000000000",
        },
      },
      description: productName,
      external_reference: upsellTask.id,
      additional_info: {
        items: [
          {
            id: upsellTask.id,
            title: productName,
            description: "Upgrade para pacote com 2 músicas infantis adicionais personalizadas",
            category_id: "entertainment",
            quantity: 1,
            unit_price: transactionAmount,
          },
        ],
      },
    };

    console.log("Creating upsell MercadoPago Pix payment:", JSON.stringify(mpBody));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "X-Idempotency-Key": `upsell-${upsellTask.id}-${Date.now()}`,
      },
      body: JSON.stringify(mpBody),
    });

    const mpText = await mpResponse.text();
    console.log("MercadoPago upsell response:", mpText);

    let mpData;
    try {
      mpData = JSON.parse(mpText);
    } catch {
      throw new Error(`MercadoPago returned non-JSON: ${mpText.substring(0, 200)}`);
    }

    if (!mpResponse.ok) {
      throw new Error(`MercadoPago error (${mpResponse.status}): ${mpText.substring(0, 300)}`);
    }

    const paymentId = mpData.id;
    const brCode = mpData.point_of_interaction?.transaction_data?.qr_code || null;
    const brCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null;

    // Update upsell task with payment info
    await supabase
      .from("music_tasks")
      .update({
        billing_id: String(paymentId),
        payment_url: brCode || null,
      })
      .eq("id", upsellTask.id);

    return new Response(
      JSON.stringify({ billingId: String(paymentId), brCode, brCodeBase64, upsellTaskId: upsellTask.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-upsell-billing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao criar cobrança de upsell" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
