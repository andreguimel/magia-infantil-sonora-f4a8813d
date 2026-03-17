import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
    if (!valid) return false;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return false;
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get("ADMIN_SECRET");
    if (!adminSecret) throw new Error("Server misconfigured");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || !(await verifyToken(token, adminSecret))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, childName } = await req.json();
    if (!email || !childName) {
      return new Response(JSON.stringify({ error: "Email e nome são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    const couponLink = `https://musicamagica.com.br/criar?coupon=RESGATE50`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fdf2f8; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #ffffff; border-radius: 24px; padding: 40px 32px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    h1 { color: #ec4899; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
    .coupon-box { background: linear-gradient(135deg, #fce7f3, #ede9fe); border-radius: 16px; padding: 20px; margin: 24px 0; }
    .coupon-box p { color: #6b7280; font-size: 13px; margin: 0 0 8px; }
    .coupon-box .code { font-size: 28px; font-weight: 800; color: #ec4899; letter-spacing: 3px; margin: 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 16px; font-weight: 700; font-size: 16px; margin: 16px 0; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="font-size: 48px; margin-bottom: 16px;">🎵</div>
      <h1>A música de ${sanitizeHtml(childName)} está esperando por você!</h1>
      <p class="subtitle">
        Notamos que você começou a criar uma música mágica personalizada para ${sanitizeHtml(childName)}, mas não finalizou a compra.<br><br>
        Temos uma surpresa especial: use o cupom abaixo e ganhe <strong>50% de desconto</strong>! 🎉
      </p>
      
      <div class="coupon-box">
        <p>Seu cupom exclusivo:</p>
        <p class="code">RESGATE50</p>
      </div>

      <a href="${couponLink}" class="btn">🎶 Criar Música com Desconto</a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 8px;">Oferta por tempo limitado!</p>
    </div>
    <p class="footer">
      Música Mágica para Crianças 🎶<br>
      Este é um e-mail automático, não responda.
    </p>
  </div>
</body>
</html>`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Música Mágica", email: "andreguimel@gmail.com" },
        to: [{ email }],
        subject: `🎵 ${childName} ainda está esperando a música mágica! 50% OFF`,
        htmlContent,
      }),
    });

    const brevoData = await brevoRes.json();
    if (!brevoRes.ok) throw new Error(brevoData.message || `Brevo error ${brevoRes.status}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-recovery-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao enviar" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
