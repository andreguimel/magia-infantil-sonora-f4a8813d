import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createToken(secret: string, code: string): Promise<string> {
  const encoder = new TextEncoder();
  const payload = {
    exp: Date.now() + 24 * 60 * 60 * 1000,
    role: 'affiliate',
    code,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${payloadB64}.${sigB64}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, password } = await req.json();
    if (!code || !password) {
      return new Response(JSON.stringify({ error: 'Código e senha são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminSecret = Deno.env.get('ADMIN_SECRET')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: link, error } = await supabase
      .from('tracking_links')
      .select('id, code, password_hash')
      .eq('code', code.toLowerCase().trim())
      .single();

    if (error || !link) {
      return new Response(JSON.stringify({ error: 'Código não encontrado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!link.password_hash) {
      return new Response(JSON.stringify({ error: 'Senha não configurada. Contate o administrador.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const inputHash = await hashPassword(password);
    if (inputHash !== link.password_hash) {
      return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await createToken(adminSecret, link.code);

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Requisição inválida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
