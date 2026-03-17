import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, childName, accessCode, downloadUrl, lyrics } = await req.json();

    if (!email || !childName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fdf2f8; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    h1 { color: #ec4899; font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .access-code { background: linear-gradient(135deg, #fce7f3, #ede9fe); border-radius: 16px; padding: 20px; margin: 24px 0; }
    .access-code p { color: #6b7280; font-size: 13px; margin: 0 0 8px; }
    .access-code .code { font-size: 32px; font-weight: 800; color: #ec4899; letter-spacing: 3px; margin: 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 16px; font-weight: 700; font-size: 16px; margin: 12px 0; }
    .btn-secondary { display: inline-block; background: #f3f4f6; color: #374151; text-decoration: none; padding: 14px 32px; border-radius: 16px; font-weight: 600; font-size: 14px; margin: 8px 0; border: 2px solid #e5e7eb; }
    .lyrics-box { background: #fefce8; border-radius: 16px; padding: 20px; margin: 24px 0; text-align: left; }
    .lyrics-box h3 { color: #854d0e; font-size: 14px; margin: 0 0 12px; }
    .lyrics-box pre { color: #713f12; font-size: 13px; line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: 'Segoe UI', Arial, sans-serif; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
      <h1>A música de ${sanitizeHtml(childName)} está pronta!</h1>
      <p class="subtitle">Sua música mágica personalizada foi gerada com sucesso.</p>
      
      ${accessCode ? `
      <div class="access-code">
        <p>Seu código de acesso:</p>
        <p class="code">${accessCode}</p>
      </div>
      ` : ""}
      
      ${downloadUrl ? `
      <a href="${downloadUrl}" class="btn">⬇️ Baixar Música (MP3)</a>
      <p style="color: #9ca3af; font-size: 12px;">O link expira em 30 dias</p>
      ` : ""}

      ${lyrics ? `
      <div class="lyrics-box">
        <h3>📝 Letra da Música</h3>
        <pre>${lyrics}</pre>
      </div>
      ` : ""}
    </div>
    <p class="footer">
      Música Mágica para Crianças 🎶<br>
      Este é um e-mail automático, não responda.
    </p>
  </div>
</body>
</html>`;
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Música Mágica", email: "andreguimel@gmail.com" },
        to: [{ email }],
        subject: `🎵 A música de ${childName} está pronta!`,
        htmlContent,
      }),
    });

    const brevoData = await brevoResponse.json();
    console.log("Brevo response:", JSON.stringify(brevoData));

    if (!brevoResponse.ok) {
      throw new Error(brevoData.message || `Brevo error ${brevoResponse.status}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-download-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao enviar e-mail" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
