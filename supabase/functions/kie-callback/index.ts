import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MAGIC-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase config");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json();
    console.log("Kie.ai callback received:", JSON.stringify(payload).substring(0, 1000));

    const url = new URL(req.url);
    const internalId = url.searchParams.get("internalId");
    const callbackToken = url.searchParams.get("token");
    let taskId = url.searchParams.get("taskId") || payload.data?.taskId;

    // Verify callback token using HMAC
    if (internalId && callbackToken) {
      const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
      if (KIE_API_KEY) {
        const encoder = new TextEncoder();
        const keyData = await crypto.subtle.importKey(
          "raw", encoder.encode(KIE_API_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const expectedSig = await crypto.subtle.sign("HMAC", keyData, encoder.encode(internalId));
        const expectedToken = Array.from(new Uint8Array(expectedSig)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (callbackToken !== expectedToken) {
          console.error("Invalid callback token for internalId:", internalId);
          return new Response(JSON.stringify({ status: "unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else if (!taskId) {
      console.error("No internalId or taskId in callback");
      return new Response(JSON.stringify({ status: "error", message: "No task identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip intermediate callbacks
    const callbackType = payload.data?.callbackType;
    if (callbackType && callbackType !== "complete") {
      console.log(`Skipping intermediate callback type: ${callbackType}`);
      return new Response(JSON.stringify({ status: "skipped", callbackType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = payload.code === 200 ? "completed" : "failed";

    let audioUrl: string | null = null;
    let errorMessage: string | null = null;

    if (status === "completed") {
      const songs = payload.data?.data;
      if (Array.isArray(songs) && songs.length > 0) {
        audioUrl = songs[0].audio_url || songs[0].audioUrl || null;
      }

      if (!audioUrl) {
        console.error("No audio URL in completed callback:", JSON.stringify(payload.data));
        errorMessage = "No audio URL in response";
      }
    } else {
      errorMessage = payload.msg || "Generation failed";
    }

    const updateColumn = internalId ? "id" : "task_id";
    const updateValue = internalId || taskId;

    // If we have an audio URL, download it and store in Storage
    let downloadUrl: string | null = null;
    let downloadExpiresAt: string | null = null;
    let accessCode: string | null = null;

    if (audioUrl) {
      try {
        console.log("Downloading audio from:", audioUrl);
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }

        const audioBlob = await audioResponse.arrayBuffer();
        const filePath = `${updateValue}.mp3`;

        console.log(`Uploading ${audioBlob.byteLength} bytes to music-files/${filePath}`);

        const { error: uploadError } = await supabase.storage
          .from("music-files")
          .upload(filePath, audioBlob, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Generate short-lived signed URL (7 days). The business window remains 30 days
        // via on-demand regeneration in get-my-songs using the access code.
        const SIGNED_URL_DURATION_SECONDS = 7 * 24 * 60 * 60;
        const { data: signedData, error: signedError } = await supabase.storage
          .from("music-files")
          .createSignedUrl(filePath, SIGNED_URL_DURATION_SECONDS);

        if (signedError || !signedData?.signedUrl) {
          console.error("Signed URL error:", signedError);
          throw new Error("Failed to create signed URL");
        }

        downloadUrl = signedData.signedUrl;
        downloadExpiresAt = new Date(Date.now() + SIGNED_URL_DURATION_SECONDS * 1000).toISOString();

        // Generate unique access code
        let codeUnique = false;
        let attempts = 0;
        while (!codeUnique && attempts < 10) {
          accessCode = generateAccessCode();
          const { data: existing } = await supabase
            .from("music_tasks")
            .select("id")
            .eq("access_code", accessCode)
            .maybeSingle();
          if (!existing) codeUnique = true;
          attempts++;
        }

        console.log(`Stored audio successfully. Access code: ${accessCode}, Signed URL expires: ${downloadExpiresAt}`);
      } catch (storageError) {
        console.error("Storage error (non-fatal):", storageError);
        // Continue with original audio URL if storage fails
      }
    }

    console.log(`Updating task by ${updateColumn}=${updateValue}: status=${audioUrl ? "completed" : "failed"}`);

    const { error: dbError } = await supabase
      .from("music_tasks")
      .update({
        status: audioUrl ? "completed" : "failed",
        audio_url: downloadUrl || audioUrl,
        error_message: errorMessage,
        download_url: downloadUrl,
        download_expires_at: downloadExpiresAt,
        access_code: accessCode,
      })
      .eq(updateColumn, updateValue);

    if (dbError) {
      console.error("DB update error:", dbError);
      return new Response(JSON.stringify({ status: "error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Send email if user provided one
    if (audioUrl && (downloadUrl || audioUrl)) {
      try {
        const { data: taskData } = await supabase
          .from("music_tasks")
          .select("user_email, child_name, access_code, download_url, lyrics")
          .eq(updateColumn, updateValue)
          .single();

        if (taskData?.user_email) {
          console.log("Sending download email to:", taskData.user_email);
          const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-download-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              email: taskData.user_email,
              childName: taskData.child_name,
              accessCode: taskData.access_code,
              downloadUrl: taskData.download_url,
              lyrics: taskData.lyrics,
            }),
          });
          console.log("Email send result:", emailResponse.status);
        }
      } catch (emailError) {
        console.error("Email send error (non-fatal):", emailError);
      }
    }

    return new Response(JSON.stringify({ status: "received" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kie-callback error:", e);
    return new Response(
      JSON.stringify({ status: "error", message: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
