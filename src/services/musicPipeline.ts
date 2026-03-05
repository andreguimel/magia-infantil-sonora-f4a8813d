const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

interface GenerateLyricsParams {
  childName: string;
  ageGroup: string;
  theme: string;
  userEmail?: string;
  musicStyle?: string;
}

interface GenerateLyricsResult {
  taskId: string;
  lyrics: string;
}

interface TaskStatus {
  status: "awaiting_payment" | "processing" | "completed" | "failed";
  audio_url: string | null;
  lyrics: string | null;
  error_message: string | null;
}

// Step 1: Generate lyrics only (no Kie.ai cost)
export async function generateLyricsOnly(params: GenerateLyricsParams): Promise<GenerateLyricsResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-lyrics-only`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao gerar letra" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  const data = await response.json();
  return { taskId: data.taskId, lyrics: data.lyrics };
}

// Save custom lyrics (user-written, no AI generation)
export async function saveCustomLyrics(params: GenerateLyricsParams & { customLyrics?: string }): Promise<{ taskId: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/save-custom-lyrics`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      childName: params.childName,
      ageGroup: params.ageGroup,
      theme: params.theme,
      lyrics: params.customLyrics,
      userEmail: params.userEmail,
      musicStyle: params.musicStyle,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao salvar letra" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  const data = await response.json();
  return { taskId: data.taskId };
}

export async function createBilling(
  taskId: string,
  plan: string,
  customerData?: { name: string; email: string; cpf: string },
  discountPercent?: number
): Promise<{ billingId: string; brCode: string; brCodeBase64: string }> {
  const refCode = localStorage.getItem("ref_code") || undefined;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-billing`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      taskId,
      plan,
      origin: window.location.origin,
      customerName: customerData?.name,
      customerEmail: customerData?.email,
      customerCpf: customerData?.cpf,
      discountPercent,
      refCode,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao criar cobrança" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  return response.json();
}

export async function createUpsellBilling(taskId: string): Promise<{ billingId: string; brCode: string; brCodeBase64: string; upsellTaskId: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-upsell-billing`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId, origin: window.location.origin }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao criar cobrança de upsell" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  return response.json();
}

// Step 3: Start music generation after payment (called by webhook or manually)
export async function startMusicAfterPayment(taskId: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/start-music-after-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao iniciar geração" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }
}

// Admin bypass: skip payment and start generation directly
export async function adminBypassPayment(taskId: string, adminSecret: string): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/start-music-after-payment`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId, adminSecret }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro no bypass admin" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }
}

// Check payment status from database
export async function checkPaymentStatus(taskId: string): Promise<{ payment_status: string; status: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-task`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao verificar pagamento" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  return response.json();
}

export async function checkTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-task`, {
    method: "POST",
    headers,
    body: JSON.stringify({ taskId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro ao verificar status" }));
    throw new Error(error.error || `Erro ${response.status}`);
  }

  return response.json();
}

export function pollTaskStatus(
  taskId: string,
  onUpdate: (status: TaskStatus) => void,
  onError: (error: Error) => void,
  intervalMs = 5000,
  timeoutMs = 600000
): () => void {
  const startTime = Date.now();
  let stopped = false;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3;

  const poll = async () => {
    if (stopped) return;

    if (Date.now() - startTime > timeoutMs) {
      onError(new Error("Tempo limite excedido. A geração está demorando mais que o esperado."));
      return;
    }

    try {
      const status = await checkTaskStatus(taskId);
      consecutiveErrors = 0; // Reset on success
      onUpdate(status);

      if (status.status === "processing" || status.status === "awaiting_payment") {
        setTimeout(poll, intervalMs);
      }
    } catch (e) {
      consecutiveErrors++;
      if (!stopped) {
        if (consecutiveErrors >= maxConsecutiveErrors) {
          onError(new Error("Não foi possível verificar o status após várias tentativas. Tente novamente."));
        } else {
          // Retry with backoff
          setTimeout(poll, intervalMs * (consecutiveErrors + 1));
        }
      }
    }
  };

  poll();

  return () => {
    stopped = true;
  };
}
