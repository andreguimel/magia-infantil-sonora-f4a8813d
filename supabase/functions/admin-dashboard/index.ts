import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

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
    if (!adminSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin token
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, adminSecret))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Handle DELETE
    if (req.method === 'DELETE') {
      const body = await req.json();
      
      // Delete tracking link
      if (body.trackingLinkId) {
        const { error: delError } = await supabase.from('tracking_links').delete().eq('id', body.trackingLinkId);
        if (delError) throw delError;
        return new Response(JSON.stringify({ deleted: 1 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Delete orders
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: 'ids array required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: delError } = await supabase.from('music_tasks').delete().in('id', ids);
      if (delError) throw delError;
      return new Response(JSON.stringify({ deleted: ids.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle POST
    if (req.method === 'POST') {
      const body = await req.json();
      const { action, code, label } = body;

      // Update commission_paid
      if (action === 'update_commission_paid') {
        const { linkId, commission_paid } = body;
        if (!linkId || commission_paid == null) {
          return new Response(JSON.stringify({ error: 'linkId and commission_paid required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { error: updErr } = await supabase
          .from('tracking_links')
          .update({ commission_paid: Number(commission_paid) })
          .eq('id', linkId);
        if (updErr) throw updErr;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Set affiliate password
      if (action === 'set_affiliate_password') {
        const { linkId, password: pwd } = body;
        if (!linkId || !pwd) {
          return new Response(JSON.stringify({ error: 'linkId and password required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pwd));
        const passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        const { error: updErr } = await supabase
          .from('tracking_links')
          .update({ password_hash: passwordHash })
          .eq('id', linkId);
        if (updErr) throw updErr;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'create_tracking_link') {
        if (!code || !label) {
          return new Response(JSON.stringify({ error: 'code and label required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Hash password if provided
        let passwordHash = null;
        if (body.password) {
          const encoder = new TextEncoder();
          const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(body.password));
          passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        const insertData: Record<string, unknown> = { code: code.toLowerCase().trim(), label: label.trim() };
        if (body.commission_percent != null) insertData.commission_percent = Number(body.commission_percent);
        if (passwordHash) insertData.password_hash = passwordHash;
        const { data, error: insertError } = await supabase
          .from('tracking_links')
          .insert(insertData)
          .select()
          .single();
        if (insertError) {
          if (insertError.code === '23505') {
            return new Response(JSON.stringify({ error: 'Código já existe' }), {
              status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw insertError;
        }
        return new Response(JSON.stringify({ link: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'all';

    let query = supabase
      .from('music_tasks')
      .select('id, child_name, theme, user_email, payment_status, status, created_at, billing_id, music_style, age_group, lyrics, audio_url, download_url, access_code, download_expires_at, ref_code')
      .order('created_at', { ascending: false });

    if (period === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      query = query.gte('created_at', d.toISOString());
    } else if (period === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      query = query.gte('created_at', d.toISOString());
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    // Fetch tracking links
    const { data: trackingLinks } = await supabase
      .from('tracking_links')
      .select('id, code, label, created_at, commission_percent, commission_paid, password_hash')
      .order('created_at', { ascending: false });

    // Compute ref metrics
    const refMetrics: Record<string, { total: number; paid: number; revenue: number }> = {};
    for (const o of (orders || [])) {
      if (o.ref_code) {
        if (!refMetrics[o.ref_code]) refMetrics[o.ref_code] = { total: 0, paid: 0, revenue: 0 };
        refMetrics[o.ref_code].total++;
        if (o.payment_status === 'paid') {
          refMetrics[o.ref_code].paid++;
          refMetrics[o.ref_code].revenue += 9.90;
        }
      }
    }

    const total = orders?.length || 0;
    const paid = orders?.filter(o => o.payment_status === 'paid').length || 0;
    const pending = orders?.filter(o => o.payment_status === 'pending').length || 0;
    const expired = orders?.filter(o => o.payment_status === 'expired' || o.payment_status === 'cancelled').length || 0;
    const completed = orders?.filter(o => o.status === 'completed').length || 0;
    const conversionRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    const estimatedRevenue = paid * 9.90;

    const funnel = [
      { stage: 'Checkout Iniciado', count: total },
      { stage: 'Pagamento Pendente', count: pending + paid + completed },
      { stage: 'Pago', count: paid },
      { stage: 'Música Gerada', count: completed },
    ];

    return new Response(JSON.stringify({
      metrics: { total, paid, pending, expired, completed, conversionRate, estimatedRevenue },
      funnel,
      orders: orders || [],
      trackingLinks: trackingLinks || [],
      refMetrics,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
