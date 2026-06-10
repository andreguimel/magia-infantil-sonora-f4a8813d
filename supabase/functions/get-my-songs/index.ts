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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase config");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { accessCode } = await req.json();

    if (!accessCode || typeof accessCode !== "string") {
      return new Response(
        JSON.stringify({ error: "Código de acesso é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedCode = accessCode.trim().toUpperCase();

    const { data: tasks, error: fetchError } = await supabase
      .from("music_tasks")
      .select("id, child_name, theme, created_at, download_url, download_expires_at, access_code, status, lyrics")
      .eq("access_code", normalizedCode)
      .eq("status", "completed");

    if (fetchError) {
      console.error("DB fetch error:", fetchError);
      throw new Error("Erro ao buscar músicas");
    }

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado. Verifique e tente novamente." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each task, check if signed URL expired and regenerate if within 30 days of creation
    const songs = [];
    for (const task of tasks) {
      let audioUrl = task.download_url;
      let expiresAt = task.download_expires_at;

      const createdAt = new Date(task.created_at);
      const maxExpiry = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (expiresAt && new Date(expiresAt) < now && now < maxExpiry) {
        // Regenerate short-lived signed URL (7 days max, capped by remaining business window)
        const SIGNED_URL_DURATION_SECONDS = 7 * 24 * 60 * 60;
        const remainingSeconds = Math.min(
          SIGNED_URL_DURATION_SECONDS,
          Math.floor((maxExpiry.getTime() - now.getTime()) / 1000),
        );
        const filePath = `${task.id}.mp3`;

        const { data: signedData, error: signedError } = await supabase.storage
          .from("music-files")
          .createSignedUrl(filePath, remainingSeconds);

        if (!signedError && signedData?.signedUrl) {
          audioUrl = signedData.signedUrl;
          expiresAt = new Date(now.getTime() + remainingSeconds * 1000).toISOString();

          // Update in DB
          await supabase
            .from("music_tasks")
            .update({ download_url: audioUrl, download_expires_at: expiresAt })
            .eq("id", task.id);
        }
      }

      const isExpired = now > maxExpiry;

      songs.push({
        id: task.id,
        childName: task.child_name,
        theme: task.theme,
        audioUrl: isExpired ? null : audioUrl,
        expiresAt: isExpired ? null : expiresAt,
        isExpired,
        createdAt: task.created_at,
        lyrics: (task as any).lyrics || null,
      });
    }

    return new Response(
      JSON.stringify({ songs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-my-songs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
