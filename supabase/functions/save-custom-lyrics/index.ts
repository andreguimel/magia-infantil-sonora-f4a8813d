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

  // Origin validation
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = ["lovable.app", "lovableproject.com", "localhost", "musicamagica.com", "vercel.app", "musicamagica.com.br"];
  if (!allowedOrigins.some((o) => origin.includes(o))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { childName, ageGroup, theme, lyrics, userEmail, userPhone, musicStyle } = await req.json();

    if (!childName || !ageGroup || !theme || !lyrics || lyrics.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos ou letra muito curta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing env vars");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: insertedTask, error: dbError } = await supabase
      .from("music_tasks")
      .insert({
        child_name: childName,
        theme,
        age_group: ageGroup,
        status: "awaiting_payment",
        lyrics: lyrics.trim(),
        user_email: userEmail || null,
        user_phone: userPhone || null,
        music_style: musicStyle || null,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError);
      throw new Error("Failed to save task");
    }

    return new Response(
      JSON.stringify({ taskId: insertedTask.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("save-custom-lyrics error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao salvar letra" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
