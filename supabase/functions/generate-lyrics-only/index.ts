import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const themeDescriptions: Record<string, string> = {
  animais: "animais fofinhos como coelhos, ursos, passarinhos",
  princesas: "princesas, castelos encantados, magia e bondade",
  "super-herois": "super-heróis, poderes especiais, coragem e aventura",
  "super-heroinas": "super-heroínas, poderes especiais, coragem e aventura feminina",
  espaco: "espaço sideral, foguetes, estrelas, planetas e aventura cósmica",
  natureza: "natureza, flores, borboletas, arco-íris e jardins encantados",
  dinossauros: "dinossauros, aventuras pré-históricas, fósseis e rugidos divertidos",
  futebol: "futebol, gols, jogadas incríveis, torcida e alegria no campo",
  fadas: "fadas encantadas, varinhas mágicas, jardins secretos e pó de estrela",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Origin validation for user-facing endpoint
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = ["lovable.app", "lovableproject.com", "localhost", "musicamagica.com", "vercel.app", "musicamagica.com.br"];
  if (!allowedOrigins.some((o) => origin.includes(o))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { childName, ageGroup, theme, userEmail, musicStyle } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const themeDesc = themeDescriptions[theme] || themeDescriptions.animais;

    const systemPrompt = `Você é um compositor de músicas infantis em português brasileiro. Crie letras alegres, rimadas, repetitivas e fáceis de decorar para crianças.

Regras:
- O NOME "${childName}" é o elemento MAIS IMPORTANTE da música. Ele DEVE aparecer pelo menos 4 vezes, incluindo no refrão
- O refrão DEVE começar ou terminar com o nome "${childName}"
- Use o nome "${childName}" de forma natural e melódica, como parte central das frases
- Use linguagem simples e adequada para crianças de ${ageGroup} anos
- O tema deve ser sobre: ${themeDesc}

ESTRUTURA OBRIGATÓRIA:
- Estrofe 1 (4 linhas) → Refrão (4 linhas) → Estrofe 2 (4 linhas) → Refrão (mesmas 4 linhas)
- O refrão DEVE ser repetido 2 vezes na música (após cada estrofe), com o MESMO texto exato
- A duração total deve ser de 1 minuto e 30 segundos a 2 minutos quando cantada

REPETIÇÕES (muito importante!):
- O refrão deve ter frases curtas e repetitivas, estilo "canta comigo"
- Priorize frases curtas e fáceis de cantar junto

- Use rimas AABB ou ABAB
- NÃO use emojis na letra
- NÃO inclua títulos ou marcações como "Estrofe 1" ou "Refrão"
- Retorne APENAS o texto da letra, sem explicações`;

    const lyricsResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Crie uma música infantil personalizada para ${childName}, uma criança de ${ageGroup} anos que adora ${themeDesc}.`,
            },
          ],
        }),
      }
    );

    if (!lyricsResponse.ok) {
      const errorText = await lyricsResponse.text();
      console.error("AI gateway error:", lyricsResponse.status, errorText);
      throw new Error(`AI gateway error: ${lyricsResponse.status}`);
    }

    const lyricsData = await lyricsResponse.json();
    const lyrics =
      lyricsData.choices?.[0]?.message?.content?.trim() ||
      lyricsData.choices?.[0]?.text?.trim() ||
      null;

    if (!lyrics) {
      console.error("Full AI response:", JSON.stringify(lyricsData));
      throw new Error("No lyrics generated");
    }

    console.log("Lyrics generated successfully, length:", lyrics.length);

    // Save to database with awaiting_payment status (NO Kie.ai call)
    const { data: insertedTask, error: dbError } = await supabase
      .from("music_tasks")
      .insert({
        child_name: childName,
        theme,
        age_group: ageGroup,
        status: "awaiting_payment",
        lyrics,
        user_email: userEmail || null,
        music_style: musicStyle || null,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError);
      throw new Error("Failed to save task");
    }

    return new Response(
      JSON.stringify({ taskId: insertedTask.id, lyrics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-lyrics-only error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao gerar letra" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
