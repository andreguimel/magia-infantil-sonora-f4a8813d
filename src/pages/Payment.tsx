import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  ArrowLeft,
  Check,
  Clock,
  QrCode,
  Sparkles,
  Download,
  Music,
  Plus,
  Copy,
  User,
  Mail,
  CreditCard,
} from "lucide-react";
import { MagicButton } from "@/components/ui/MagicButton";
import { FloatingElements } from "@/components/ui/FloatingElements";
import { useToast } from "@/hooks/use-toast";
import { createBilling, createUpsellBilling, startMusicAfterPayment, adminBypassPayment, pollTaskStatus, checkPaymentStatus } from "@/services/musicPipeline";
import SongDownloads from "@/components/SongDownloads";
import { Checkbox } from "@/components/ui/checkbox";

interface MusicData {
  childName: string;
  ageGroup: string;
  theme: string;
  musicStyle?: string;
}

interface TaskStatus {
  status: string;
  audio_url?: string;
  error_message?: string;
  access_code?: string;
  download_url?: string;
  lyrics?: string;
}

interface PackageSong {
  childName: string;
  audioUrl: string;
}

type PaymentState = "form" | "qrcode" | "confirmed" | "generating" | "completed";

const planInfo = {
  single: { label: "Música Mágica", price: "9,90", priceNum: "9.90", description: "1 música personalizada" },
  pacote: { label: "Pacote Encantado", price: "24,90", priceNum: "24.90", description: "3 músicas personalizadas" },
};

const VALID_COUPON = "MAGICA10";
const DISCOUNT_PERCENT = 10;

function getExitCoupon(): string | null {
  return localStorage.getItem("exitCoupon");
}

const RECOVERY_COUPON = "RESGATE50";
const REENGAGEMENT_COUPON = "VOLTEI50";
const RECOVERY_DISCOUNT_PERCENT = 50;

function applyDiscount(priceStr: string, discountPct: number): string {
  const price = parseFloat(priceStr.replace(",", "."));
  const discounted = price * (1 - discountPct / 100);
  return discounted.toFixed(2).replace(".", ",");
}

function getPackageSongsRemaining(): number {
  return parseInt(localStorage.getItem("packageSongsRemaining") || "0", 10);
}

function getPackageSongs(): PackageSong[] {
  try {
    return JSON.parse(localStorage.getItem("packageSongs") || "[]");
  } catch {
    return [];
  }
}

function savePackageSong(song: PackageSong) {
  const songs = getPackageSongs();
  songs.push(song);
  localStorage.setItem("packageSongs", JSON.stringify(songs));
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Reject all same digits
  if (/^(\d)\1{10}$/.test(digits)) return false;
  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [musicData, setMusicData] = useState<MusicData | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const [paymentState, setPaymentState] = useState<PaymentState>("form");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(900);
  const [stopPolling, setStopPolling] = useState<(() => void) | null>(null);
  const [brCode, setBrCode] = useState<string | null>(null);
  const [isCreatingBilling, setIsCreatingBilling] = useState(false);
  const [isCreatingUpsell, setIsCreatingUpsell] = useState(false);
  const [upsellBrCode, setUpsellBrCode] = useState<string | null>(null);
  const [upsellTaskId, setUpsellTaskId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // brCode/brCodeBase64 removed — we now use only the billing paymentUrl

  // Form fields
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentCpf, setParentCpf] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const selectedPlan = localStorage.getItem("selectedPlan") || "single";
  const plan = planInfo[selectedPlan as keyof typeof planInfo];
  const isPacote = selectedPlan === "pacote";
  // Check coupon from localStorage or from URL param (e.g. ?coupon=RESGATE50)
  const urlCoupon = searchParams.get("coupon")?.toUpperCase() || null;
  const appliedCoupon = urlCoupon || getExitCoupon();
  const hasDiscount = appliedCoupon === VALID_COUPON;
  const hasRecoveryDiscount = appliedCoupon === RECOVERY_COUPON || appliedCoupon === REENGAGEMENT_COUPON;
  // Use state so displayPrice stays stable even after localStorage.removeItem("exitCoupon")
  const [displayPrice] = useState(() => {
    if (hasRecoveryDiscount) return applyDiscount(plan.price, RECOVERY_DISCOUNT_PERCENT);
    if (hasDiscount) return applyDiscount(plan.price, DISCOUNT_PERCENT);
    return plan.price;
  });
  const [appliedDiscount] = useState(() => hasDiscount || hasRecoveryDiscount);
  const [discountPercent] = useState(() => hasRecoveryDiscount ? RECOVERY_DISCOUNT_PERCENT : hasDiscount ? DISCOUNT_PERCENT : 0);
  const [songsRemaining, setSongsRemaining] = useState(getPackageSongsRemaining());
  const [packageSongs, setPackageSongs] = useState<PackageSong[]>(getPackageSongs());
  const isPackageSong = isPacote && songsRemaining > 0;

  // Fire InitiateCheckout pixel event
  useEffect(() => {
    if (typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout", {
        content_name: plan?.label,
        value: parseFloat(displayPrice.replace(",", ".")),
        currency: "BRL",
      });
    }
  }, []);

  // Fire Purchase pixel event when completed
  useEffect(() => {
    if (paymentState === "completed" && typeof window.fbq === "function") {
      window.fbq("track", "Purchase", {
        content_name: plan?.label,
        value: parseFloat(displayPrice.replace(",", ".")),
        currency: "BRL",
      });
    }
  }, [paymentState]);

  // Load task data
  useEffect(() => {
    const stored = localStorage.getItem("musicData");
    const storedTaskId = localStorage.getItem("musicTaskId");
    if (stored && storedTaskId) {
      setMusicData(JSON.parse(stored) as MusicData);
      setTaskId(storedTaskId);
      // Pre-fill email from musicData or musicResult
      const data = JSON.parse(stored) as any;
      if (data.userEmail) setParentEmail(data.userEmail);
    } else {
      navigate("/criar");
    }
    // Also try to pre-fill from musicResult (CreateMusic stores email there)
    try {
      const musicResult = JSON.parse(localStorage.getItem("musicResult") || "{}");
      if (musicResult?.formData?.userEmail && !parentEmail) {
        setParentEmail(musicResult.formData.userEmail);
      }
    } catch {}
  }, [navigate]);

  // Admin bypass via URL parameter ?admin=SECRET
  useEffect(() => {
    if (!taskId || paymentState !== "form") return;
    const params = new URLSearchParams(window.location.search);
    const adminSecret = params.get("admin");
    if (!adminSecret) return;

    let cancelled = false;
    const doBypass = async () => {
      try {
        await adminBypassPayment(taskId, adminSecret);
        if (!cancelled) {
          // Initialize package state if it's a package plan
          if (isPacote && songsRemaining === 0) {
            localStorage.setItem("packageSongsRemaining", "3");
            localStorage.setItem("packageSongs", "[]");
            setSongsRemaining(3);
            setPackageSongs([]);
          }
          await handleStartGeneration();
        }
      } catch (e) {
        console.log("Admin bypass failed, continuing normal flow:", e);
      }
    };
    doBypass();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, paymentState]);

  // Auto-start generation for package follow-up songs (already paid)
  useEffect(() => {
    if (isPackageSong && taskId && paymentState === "form") {
      handleStartGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackageSong, taskId, paymentState]);

  // Handle return from AbacatePay (paid=true in URL) — start polling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "true" || !taskId || (paymentState !== "form" && paymentState !== "qrcode")) return;

    // Upsell return
    if (params.get("upsell") === "true") {
      localStorage.setItem("selectedPlan", "pacote");
      localStorage.setItem("packageSongsRemaining", "2");
      const currentSongs = getPackageSongs();
      if (musicData && audioUrl) {
        const alreadyHas = currentSongs.some(s => s.childName === musicData.childName);
        if (!alreadyHas) {
          savePackageSong({ childName: musicData.childName, audioUrl });
        }
      }
      localStorage.removeItem("musicResult");
      localStorage.removeItem("musicData");
      localStorage.removeItem("musicTaskId");
      navigate("/criar");
      return;
    }

    // Normal payment return — poll for confirmation
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const pollPayment = async () => {
      if (cancelled) return;
      attempts++;

      try {
        const status = await checkPaymentStatus(taskId);

        if (status.payment_status === "paid" || status.status === "processing" || status.status === "completed") {
          if (cancelled) return;
          if (isPacote) {
            localStorage.setItem("packageSongsRemaining", "3");
            localStorage.setItem("packageSongs", "[]");
            setSongsRemaining(3);
            setPackageSongs([]);
          } else {
            localStorage.removeItem("packageSongsRemaining");
            localStorage.removeItem("packageSongs");
            setSongsRemaining(0);
            setPackageSongs([]);
          }

          if (status.status === "completed") {
            setPaymentState("completed");
            return;
          }

          await handleStartGeneration();
          return;
        }

        if (attempts < maxAttempts && !cancelled) {
          setTimeout(pollPayment, 2000);
        }
      } catch {
        if (!cancelled && attempts < maxAttempts) {
          setTimeout(pollPayment, 3000);
        }
      }
    };

    pollPayment();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, paymentState]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { stopPolling?.(); };
  }, [stopPolling]);

  // Countdown timer
  useEffect(() => {
    if (paymentState !== "form" && paymentState !== "qrcode") return;
    if (isPackageSong) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentState, isPackageSong]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartGeneration = useCallback(async () => {
    if (!taskId) return;

    // Show "confirmed" state for 2.5 seconds before generating
    setPaymentState("confirmed");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    setPaymentState("generating");

    try {
      // Try to start generation - may fail if webhook already started it
      try {
        await startMusicAfterPayment(taskId);
      } catch (e) {
        // If 400, the task is likely already processing (webhook beat us) — that's fine
        console.log("startMusicAfterPayment failed (likely already started by webhook):", e);
      }

      const stop = pollTaskStatus(
        taskId,
        (status) => {
          if (status.status === "completed" && status.audio_url) {
            setAudioUrl(status.audio_url);
            setAccessCode((status as any).access_code || null);
            setLyrics((status as any).lyrics || null);
            setPaymentState("completed");

            if (isPacote) {
              const remaining = getPackageSongsRemaining();
              if (remaining > 0) {
                localStorage.setItem("packageSongsRemaining", String(remaining - 1));
                setSongsRemaining(remaining - 1);
              }
              const currentData = JSON.parse(localStorage.getItem("musicData") || "{}");
              savePackageSong({ childName: currentData.childName, audioUrl: status.audio_url });
              setPackageSongs(getPackageSongs());
            }
          } else if (status.status === "failed") {
            toast({
              title: "Erro na geração 😔",
              description: status.error_message || "A geração da música falhou.",
              variant: "destructive",
            });
            setPaymentState("form");
          }
        },
        (error) => {
          toast({
            title: "Erro 😔",
            description: error.message,
            variant: "destructive",
          });
          setPaymentState("form");
        }
      );

      setStopPolling(() => stop);
    } catch (error) {
      toast({
        title: "Erro 😔",
        description: error instanceof Error ? error.message : "Erro ao iniciar geração.",
        variant: "destructive",
      });
      setPaymentState("form");
    }
  }, [taskId, toast, isPacote]);

  const handleSubmitPayment = async () => {
    if (!taskId) return;

    // Validate
    if (!parentName.trim()) {
      toast({ title: "Preencha seu nome", variant: "destructive" });
      return;
    }
    if (!isValidEmail(parentEmail)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    if (!isValidCpf(parentCpf)) {
      toast({ title: "CPF inválido", description: "Digite os 11 dígitos do CPF", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: "Aceite os termos", description: "Você precisa concordar com os Termos de Uso e Política de Privacidade.", variant: "destructive" });
      return;
    }

    setIsCreatingBilling(true);
    try {
      const cpfDigits = parentCpf.replace(/\D/g, "");
      const result = await createBilling(
        taskId,
        selectedPlan,
        { name: parentName.trim(), email: parentEmail.trim(), cpf: cpfDigits },
        discountPercent > 0 ? discountPercent : undefined
      );
      // Coupon has been used — clear it
      if (appliedDiscount) localStorage.removeItem("exitCoupon");
      setBrCode(result.brCode);
      setPaymentState("qrcode");

      // Start polling for payment confirmation immediately
      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 120; // ~4 minutes

      const pollPayment = async () => {
        if (cancelled) return;
        attempts++;

        try {
          const status = await checkPaymentStatus(taskId);

          if (status.payment_status === "paid" || status.status === "processing" || status.status === "completed") {
            if (cancelled) return;
            if (isPacote) {
              localStorage.setItem("packageSongsRemaining", "3");
              localStorage.setItem("packageSongs", "[]");
              setSongsRemaining(3);
              setPackageSongs([]);
            } else {
              localStorage.removeItem("packageSongsRemaining");
              localStorage.removeItem("packageSongs");
              setSongsRemaining(0);
              setPackageSongs([]);
            }

            if (status.status === "completed") {
              setPaymentState("completed");
              return;
            }

            await handleStartGeneration();
            return;
          }

          if (attempts < maxAttempts && !cancelled) {
            setTimeout(pollPayment, 2000);
          }
        } catch {
          if (!cancelled && attempts < maxAttempts) {
            setTimeout(pollPayment, 3000);
          }
        }
      };

      // Start polling after a small delay (give webhook time)
      setTimeout(pollPayment, 3000);

      // Store cleanup
      const cleanupRef = () => { cancelled = true; };
      setStopPolling(() => cleanupRef);
    } catch (error) {
      console.error("Error creating billing:", error);
      toast({
        title: "Erro ao criar cobrança",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsCreatingBilling(false);
    }
  };

  const handleCopyCode = async () => {
    if (!brCode) return;
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código Pix copiado! 📋" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleCreateNextSong = () => {
    localStorage.removeItem("musicResult");
    localStorage.removeItem("musicData");
    localStorage.removeItem("musicTaskId");
    navigate("/criar");
  };

  if (!musicData) return null;

  return (
    <div className="min-h-screen bg-background stars-bg relative overflow-hidden">
      <FloatingElements />

      <div className="container-rounded py-8 relative z-10">
        {/* Package progress indicator */}
        {isPacote && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((num) => {
                const songIndex = num - 1;
                const completedSongs = getPackageSongs();
                const isCompleted = songIndex < completedSongs.length;
                const isCurrent = songIndex === completedSongs.length;
                return (
                  <div key={num} className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                          ? "bg-primary/20 text-primary border-2 border-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : num}
                    </div>
                    {num < 3 && (
                      <div className={`w-8 h-0.5 ${isCompleted ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Música {Math.min(getPackageSongs().length + 1, 3)} de 3 do Pacote Encantado
            </p>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate("/preview")}
            className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-baloo font-bold">
              {paymentState === "completed" ? (
                <span className="text-gradient">Sua música está pronta!</span>
              ) : paymentState === "generating" ? (
                <span className="text-gradient">Gerando sua música...</span>
              ) : paymentState === "confirmed" ? (
                <span className="text-gradient">Pagamento confirmado!</span>
              ) : isPackageSong ? (
                <span className="text-gradient">Gerando sua música...</span>
              ) : paymentState === "qrcode" ? (
                <span className="text-gradient">Escaneie o QR Code</span>
              ) : (
                <>
                  Finalize o <span className="text-gradient">pagamento</span>
                </>
              )}
            </h1>
            <p className="text-muted-foreground">
              Música para {musicData.childName}
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Form with parent data */}
          {paymentState === "form" && !isPackageSong && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              {/* Timer */}
              <div className="card-float mb-6 text-center bg-accent/20">
                <div className="flex items-center justify-center gap-2 text-accent-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold">
                    Oferta expira em: {formatTimeLeft(timeLeft)}
                  </span>
                </div>
              </div>

              <div className="card-float">
                {/* Product info */}
                <div className="text-center border-b border-border pb-6 mb-6">
                  <span className="text-5xl block mb-4">{isPacote ? "🎁" : "🎵"}</span>
                  <h3 className="font-baloo font-bold text-xl mb-2">
                    {plan.label} para {musicData.childName}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {plan.description}
                  </p>
                  {appliedDiscount && (
                    <p className="text-lg text-muted-foreground line-through">
                      R$ {plan.price}
                    </p>
                  )}
                  <p className="text-4xl font-baloo font-extrabold text-gradient">
                    R$ {displayPrice}
                  </p>
                  {appliedDiscount && (
                    <p className="text-sm font-semibold text-accent-foreground bg-accent/30 rounded-full px-3 py-1">
                      🎉 Cupom MAGICA10 aplicado — 10% OFF
                    </p>
                  )}
                </div>

                {/* Parent data form */}
                <div className="space-y-4 mb-6">
                  <h4 className="font-baloo font-bold text-lg text-center mb-2">
                    Dados do responsável
                  </h4>

                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Nome completo"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      maxLength={100}
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="E-mail"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      maxLength={255}
                    />
                  </div>

                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="CPF (apenas números)"
                      value={parentCpf}
                      onChange={(e) => setParentCpf(formatCpf(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 text-left bg-muted/50 rounded-xl p-4 mb-6">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    Li e concordo com os{" "}
                    <a href="/termos" target="_blank" className="text-primary underline hover:text-primary/80">
                      Termos de Uso
                    </a>{" "}
                    e a{" "}
                    <a href="/privacidade" target="_blank" className="text-primary underline hover:text-primary/80">
                      Política de Privacidade
                    </a>.
                  </label>
                </div>

                {/* Submit button */}
                <MagicButton
                  size="lg"
                  className="w-full"
                  loading={isCreatingBilling}
                  onClick={handleSubmitPayment}
                >
                  <QrCode className="w-5 h-5" />
                  Gerar QR Code Pix
                </MagicButton>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Compra 100% segura · Dados protegidos com criptografia
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: QR Code displayed */}
          {paymentState === "qrcode" && brCode && (
            <motion.div
              key="qrcode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              {/* Timer */}
              <div className="card-float mb-6 text-center bg-accent/20">
                <div className="flex items-center justify-center gap-2 text-accent-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="font-bold">
                    Oferta expira em: {formatTimeLeft(timeLeft)}
                  </span>
                </div>
              </div>

              <div className="card-float text-center">
                <div className="inline-flex items-center gap-2 bg-mint/20 text-mint-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <QrCode className="w-4 h-4" />
                  Pague via Pix — R$ {displayPrice}
                </div>

                {/* QR Code */}
                <div className="bg-white rounded-2xl p-8 inline-block mb-6 shadow-soft">
                  <QRCode value={brCode} size={280} level="M" />
                </div>

                <p className="text-muted-foreground text-sm mb-4">
                  Escaneie o QR Code Pix acima com o app do seu banco ou copie o código abaixo
                </p>

                {/* Copy PIX code button */}
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-6"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar código Pix"}
                </button>

                {/* Polling indicator */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <motion.div
                    className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Aguardando confirmação do pagamento...
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  Após o pagamento, a geração da música iniciará automaticamente
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 2.5: Payment Confirmed */}
          {paymentState === "confirmed" && (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="max-w-xl mx-auto"
            >
              <div className="card-float text-center py-12">
                <motion.div
                  className="text-8xl mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  ✅
                </motion.div>
                <motion.h2
                  className="text-3xl font-baloo font-bold mb-3 text-gradient"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Pagamento confirmado!
                </motion.h2>
                <motion.p
                  className="text-muted-foreground text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  Preparando a magia para {musicData.childName}...
                </motion.p>
                <motion.div
                  className="mt-6 flex justify-center gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-3 h-3 rounded-full bg-primary"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Generating */}
          {(paymentState === "generating" || (paymentState === "form" && isPackageSong)) && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="card-float text-center">
                <motion.div
                  className="text-7xl mb-6"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  🪄
                </motion.div>
                <h2 className="text-2xl font-baloo font-bold mb-4">
                  Criando sua música mágica...
                </h2>
                <p className="text-muted-foreground mb-4">
                  {isPackageSong
                    ? `Gerando a música de ${musicData.childName} (incluída no pacote)`
                    : `Pagamento confirmado! Agora estamos gerando a música de ${musicData.childName}.`}
                </p>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    🎵 Compondo sua música... isso pode levar até 2 minutos
                  </motion.span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-rainbow"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 120, ease: "linear" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Completed */}
          {paymentState === "completed" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto"
            >
              <div className="card-float text-center">
                <motion.div
                  className="text-8xl mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  🎉
                </motion.div>

                <h2 className="text-2xl font-baloo font-bold mb-4">
                  <span className="text-gradient">Parabéns!</span> Sua música está pronta!
                </h2>

                <p className="text-muted-foreground mb-6">
                  A música de {musicData.childName} foi gerada com sucesso!
                </p>

                {audioUrl && (
                  <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                    <audio controls className="w-full" src={audioUrl}>
                      Seu navegador não suporta o player de áudio.
                    </audio>
                  </div>
                )}

                <div className="space-y-4">
                  {audioUrl && (
                    <SongDownloads
                      childName={musicData.childName}
                      audioUrl={audioUrl}
                      lyrics={lyrics}
                      theme={musicData.theme}
                    />
                  )}

                  {accessCode && (
                    <div className="bg-accent/20 border-2 border-accent/40 rounded-2xl p-5 text-center">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        📋 Seu código de acesso:
                      </p>
                      <p className="font-mono text-2xl font-extrabold tracking-widest text-foreground mb-2">
                        {accessCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Guarde este código! Use-o para acessar suas músicas por até 30 dias.
                      </p>
                      <button
                        onClick={() => navigate("/minhas-musicas")}
                        className="text-primary text-sm font-semibold hover:underline mt-3 inline-block"
                      >
                        Acessar minhas músicas →
                      </button>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    🔗 Acesse suas músicas em <button onClick={() => navigate("/minhas-musicas")} className="text-primary font-semibold hover:underline">/minhas-musicas</button> com seu código
                  </p>
                </div>
              </div>

              {/* Package: Next song CTA */}
              {isPacote && songsRemaining > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="card-float mt-6 bg-gradient-to-br from-primary/10 to-lavender/10 border-2 border-primary/30"
                >
                  <div className="text-center">
                    <span className="badge-fun mb-4 inline-block">🎁 Pacote Encantado</span>
                    <h3 className="font-baloo font-bold text-xl mb-2">
                      Você ainda tem {songsRemaining} {songsRemaining === 1 ? "música" : "músicas"} para criar!
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Crie músicas para irmãos, primos ou amigos — já está incluso no seu pacote!
                    </p>
                    <MagicButton size="lg" className="w-full" onClick={handleCreateNextSong}>
                      <Plus className="w-5 h-5" />
                      Criar próxima música
                    </MagicButton>
                  </div>
                </motion.div>
              )}

              {/* Package: All songs completed */}
              {isPacote && songsRemaining === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="card-float mt-6 bg-gradient-to-br from-mint/10 to-lavender/10 border-2 border-mint/30"
                >
                  <div className="text-center">
                    <span className="text-4xl block mb-3">🎊</span>
                    <h3 className="font-baloo font-bold text-xl mb-2">
                      Pacote completo!
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Todas as 3 músicas do seu pacote foram criadas com sucesso!
                    </p>

                    <div className="space-y-2 mb-4">
                      {getPackageSongs().map((song, i) => (
                        <div key={i} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{song.childName}</span>
                          </div>
                          <button
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = song.audioUrl;
                              a.download = `${song.childName}.mp3`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Upsell for single plan */}
              {!isPacote && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="card-float mt-6 bg-gradient-to-br from-accent/20 to-peach/20 border-2 border-accent/30"
                >
                  <div className="text-center">
                    <span className="badge-fun mb-4 inline-block">🎁 Oferta Especial</span>
                    <h3 className="font-baloo font-bold text-xl mb-2">
                      Que tal mais 2 músicas?
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Crie músicas para irmãos, primos ou amigos!
                    </p>
                    <p className="text-2xl font-baloo font-bold text-gradient mb-4">
                      +2 músicas por apenas R$ 15,00
                      <span className="block text-sm text-muted-foreground line-through">
                        De R$ 19,80
                      </span>
                    </p>

                    <AnimatePresence mode="wait">
                      {!upsellBrCode ? (
                        <MagicButton
                          key="upsell-btn"
                          variant="accent"
                          size="md"
                          loading={isCreatingUpsell}
                          onClick={async () => {
                            if (!taskId) return;
                            setIsCreatingUpsell(true);
                            try {
                              const result = await createUpsellBilling(taskId);
                              setUpsellBrCode(result.brCode);
                              setUpsellTaskId(result.upsellTaskId);

                              // Poll for upsell payment
                              let cancelled = false;
                              let attempts = 0;
                              const maxAttempts = 120;

                              const pollUpsell = async () => {
                                if (cancelled) return;
                                attempts++;
                                try {
                                  const status = await checkPaymentStatus(result.upsellTaskId);
                                  if (status.payment_status === "paid" || status.status === "processing" || status.status === "completed") {
                                    if (cancelled) return;
                                    localStorage.setItem("selectedPlan", "pacote");
                                    localStorage.setItem("packageSongsRemaining", "2");
                                    const currentSongs = getPackageSongs();
                                    if (musicData && audioUrl) {
                                      const alreadyHas = currentSongs.some(s => s.childName === musicData.childName);
                                      if (!alreadyHas) {
                                        savePackageSong({ childName: musicData.childName, audioUrl });
                                      }
                                    }
                                    localStorage.removeItem("musicResult");
                                    localStorage.removeItem("musicData");
                                    localStorage.removeItem("musicTaskId");
                                    navigate("/criar");
                                    return;
                                  }
                                  if (attempts < maxAttempts && !cancelled) {
                                    setTimeout(pollUpsell, 2000);
                                  }
                                } catch {
                                  if (!cancelled && attempts < maxAttempts) {
                                    setTimeout(pollUpsell, 3000);
                                  }
                                }
                              };

                              setTimeout(pollUpsell, 3000);
                            } catch (error) {
                              console.error("Upsell billing error:", error);
                              toast({
                                title: "Erro ao criar cobrança",
                                description: error instanceof Error ? error.message : "Tente novamente",
                                variant: "destructive",
                              });
                            } finally {
                              setIsCreatingUpsell(false);
                            }
                          }}
                        >
                          Quero mais músicas!
                        </MagicButton>
                      ) : (
                        <motion.div
                          key="upsell-qr"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2"
                        >
                          <div className="inline-flex items-center gap-2 bg-mint/20 text-mint-foreground px-4 py-2 rounded-full text-sm font-medium mb-4">
                            <QrCode className="w-4 h-4" />
                            Pague via Pix — R$ 15,00
                          </div>

                          <div className="bg-white rounded-2xl p-6 inline-block mb-4 shadow-soft">
                            <QRCode value={upsellBrCode} size={240} level="M" />
                          </div>

                          <p className="text-muted-foreground text-sm mb-3">
                            Escaneie o QR Code com o app do seu banco
                          </p>

                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(upsellBrCode!);
                                toast({ title: "Código Pix copiado! 📋" });
                              } catch {
                                toast({ title: "Erro ao copiar", variant: "destructive" });
                              }
                            }}
                            className="inline-flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium transition-colors mb-4"
                          >
                            <Copy className="w-4 h-4" />
                            Copiar código Pix
                          </button>

                          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <motion.div
                              className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            />
                            Aguardando pagamento...
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
