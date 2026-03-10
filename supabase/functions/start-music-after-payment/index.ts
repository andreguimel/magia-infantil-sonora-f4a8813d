import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const themeStyles: Record<string, string> = {
  animais: "children's music, cheerful, playful, happy, cute, acoustic guitar, ukulele, bright, fun, singalong",
  princesas: "children's music, cheerful, happy, magical, fairy tale, gentle, harp, flute, joyful, bright",
  "super-herois": "children's music, cheerful, happy, heroic, energetic, upbeat, drums, brass, fun, exciting",
  "super-heroinas": "children's music, cheerful, happy, heroic, energetic, upbeat, girl power, fun, exciting",
  espaco: "children's music, cheerful, happy, cosmic, wonder, synth, playful, bright, adventure, fun",
  natureza: "children's music, cheerful, happy, peaceful, folk, acoustic, joyful, bright, singalong, fun",
  dinossauros: "children's music, cheerful, happy, adventurous, playful, stomping beats, fun, exciting",
  futebol: "children's music, cheerful, happy, energetic, stadium chant, upbeat, clapping, whistles, fun",
  fadas: "children's music, cheerful, happy, magical, ethereal, gentle, harp, bells, whimsical, bright",
};

const musicStyleTags: Record<string, string> = {
  "pop-infantil": "children's music, pop, cheerful, catchy, upbeat, fun",
  "mpb-acustico": "children's music, MPB, acoustic guitar, gentle, warm, Brazilian",
  "sertanejo": "children's music, sertanejo, acoustic guitar, fun, Brazilian country",
  "rock-infantil": "children's music, rock, electric guitar, energetic, fun, drums",
  "bossa-nova": "children's music, bossa nova, gentle, jazzy, acoustic, Brazilian",
  "reggae": "children's music, reggae, tropical, relaxed, happy, fun",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow calls from the app or from service role (webhook)
  const origin = req.headers.get("origin") || "";
  const authorization = req.headers.get("authorization") || "";
  const isServiceRole = authorization.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "NONE");
  const allowedOrigins = ["lovable.app", "lovableproject.com", "localhost", "musicamagica.com", "vercel.app", "musicamagica.com.br"];
  if (!isServiceRole && !allowedOrigins.some((o) => origin.includes(o))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { taskId, adminSecret } = await req.json();

    const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");

    if (!KIE_API_KEY) throw new Error("KIE_API_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const isAdminBypass = adminSecret && ADMIN_SECRET && adminSecret === ADMIN_SECRET;

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

    // Validate status (skip for admin bypass)
    if (!isAdminBypass && task.status !== "awaiting_payment") {
      return new Response(
        JSON.stringify({ error: `Invalid task status: ${task.status}. Expected awaiting_payment.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For admin bypass on failed tasks, reset error state
    if (isAdminBypass && task.status === "failed") {
      await supabase
        .from("music_tasks")
        .update({ error_message: null, audio_url: null, status: "awaiting_payment" })
        .eq("id", taskId);
      console.log("Admin bypass: reset failed task", taskId);
    }

    // If admin bypass, mark as paid
    if (isAdminBypass) {
      await supabase
        .from("music_tasks")
        .update({ payment_status: "paid" })
        .eq("id", taskId);
      console.log("Admin bypass: payment marked as paid for task", taskId);
    }

    // Send lyrics to Kie.ai
    const style = (task.music_style && musicStyleTags[task.music_style]) || themeStyles[task.theme] || themeStyles.animais;
    // Generate HMAC token for callback verification
    const kieKey = KIE_API_KEY!;
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      "raw", encoder.encode(kieKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", keyData, encoder.encode(taskId));
    const token = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
    const callBackUrl = `${SUPABASE_URL}/functions/v1/kie-callback?internalId=${taskId}&token=${token}`;

    console.log("Sending to Kie.ai after payment...");

    const kieResponse = await fetch("https://api.kie.ai/api/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: task.lyrics,
        customMode: true,
        instrumental: false,
        model: "V4",
        callBackUrl,
        style,
        title: task.child_name,
      }),
    });

    const kieData = await kieResponse.json();
    console.log("Kie.ai response:", JSON.stringify(kieData));

    if (!kieResponse.ok || kieData.code !== 200) {
      // Update task as failed
      await supabase
        .from("music_tasks")
        .update({ status: "failed", error_message: `Kie.ai error: ${kieData.msg || kieResponse.status}` })
        .eq("id", taskId);

      throw new Error(`Kie.ai error: ${kieData.msg || kieResponse.status}`);
    }

    const kieTaskId = kieData.data?.taskId;

    // Update task to processing with Kie task ID
    const { error: updateError } = await supabase
      .from("music_tasks")
      .update({ status: "processing", task_id: kieTaskId || null })
      .eq("id", taskId);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error("Failed to update task status");
    }

    return new Response(
      JSON.stringify({ success: true, kieTaskId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("start-music-after-payment error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao iniciar geração" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
