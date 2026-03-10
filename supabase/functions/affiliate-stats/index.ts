import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; code?: string }> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return { valid: false };

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
    if (!valid) return { valid: false };

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return { valid: false };
    if (payload.role !== 'affiliate' || !payload.code) return { valid: false };

    return { valid: true, code: payload.code };
  } catch {
    return { valid: false };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get('ADMIN_SECRET');
    if (!adminSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const result = await verifyToken(token, adminSecret);

    if (!result.valid || !result.code) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = result.code;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get tracking link info
    const { data: link, error: linkErr } = await supabase
      .from('tracking_links')
      .select('id, code, label, commission_percent, commission_paid')
      .eq('code', code)
      .single();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: 'Link não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count orders with this ref_code
    const { data: orders } = await supabase
      .from('music_tasks')
      .select('id, payment_status')
      .eq('ref_code', code);

    const total = orders?.length || 0;
    const paid = orders?.filter(o => o.payment_status === 'paid').length || 0;
    const conversionRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    const revenue = paid * 29.90;
    const commissionDue = revenue * (link.commission_percent / 100);
    const balance = commissionDue - link.commission_paid;

    return new Response(JSON.stringify({
      label: link.label,
      code: link.code,
      commissionPercent: link.commission_percent,
      metrics: {
        total,
        paid,
        conversionRate,
        revenue,
        commissionDue,
        commissionPaid: link.commission_paid,
        balance,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
