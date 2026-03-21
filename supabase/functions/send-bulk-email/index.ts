import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get('ADMIN_SECRET');
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!adminSecret || !brevoApiKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, adminSecret))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { emails, subject, htmlContent } = await req.json();

    if (!Array.isArray(emails) || emails.length === 0 || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'emails, subject and htmlContent required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (emails.length > 200) {
      return new Response(JSON.stringify({ error: 'Maximum 200 emails per batch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Música Mágica', email: 'andreguimel@gmail.com' },
            to: [{ email }],
            subject,
            htmlContent,
          }),
        });

        if (res.ok) {
          results.push({ email, success: true });
        } else {
          const errData = await res.text();
          results.push({ email, success: false, error: `HTTP ${res.status}` });
        }
      } catch (e) {
        results.push({ email, success: false, error: e.message });
      }

      // Rate limit: 200ms delay between sends
      if (emails.indexOf(email) < emails.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ sent, failed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
