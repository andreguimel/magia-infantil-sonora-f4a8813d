import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Music, Mail, Calendar, User, Palette, Clock, Send, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Order {
  id: string;
  child_name: string;
  theme: string;
  user_email: string | null;
  payment_status: string | null;
  status: string;
  created_at: string;
  billing_id: string | null;
  music_style: string | null;
  age_group: string;
  lyrics: string | null;
  audio_url: string | null;
  download_url: string | null;
  access_code: string | null;
  download_expires_at: string | null;
}

function statusBadge(status: string | null) {
  switch (status) {
    case "paid": return <Badge className="bg-green-500/10 text-green-600 border-green-200">Pago</Badge>;
    case "pending": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Pendente</Badge>;
    case "expired": return <Badge className="bg-red-500/10 text-red-600 border-red-200">Expirado</Badge>;
    case "cancelled": return <Badge className="bg-red-500/10 text-red-600 border-red-200">Cancelado</Badge>;
    default: return <Badge variant="secondary">{status || "—"}</Badge>;
  }
}

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetrySuccess?: () => void;
}

export default function OrderDetailModal({ order, open, onOpenChange, onRetrySuccess }: Props) {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingReengagement, setSendingReengagement] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();

  if (!order) return null;

  const canSendRecovery = order.user_email && (order.payment_status === "expired" || order.payment_status === "cancelled" || order.payment_status === "pending");
  const canSendReengagement = order.user_email && order.payment_status === "paid" && order.status === "completed";
  const canRetry = order.payment_status === "paid" && (order.status === "failed" || order.status === "processing");

  const handleSendRecoveryEmail = async () => {
    if (!order.user_email) return;
    setSendingEmail(true);
    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-recovery-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: order.user_email, childName: order.child_name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      toast({ title: "✅ Email enviado!", description: `Email de recuperação enviado para ${order.user_email}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao enviar email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendReengagementEmail = async () => {
    if (!order.user_email) return;
    setSendingReengagement(true);
    try {
      const token = sessionStorage.getItem("admin_token");
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-reengagement-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: order.user_email, childName: order.child_name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      toast({ title: "✅ Email enviado!", description: `Email de reengajamento enviado para ${order.user_email}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao enviar email", variant: "destructive" });
    } finally {
      setSendingReengagement(false);
    }
  };

  const handleRetryGeneration = async () => {
    if (!order) return;
    setRetrying(true);
    try {
      const adminSecret = prompt("Insira o ADMIN_SECRET para re-gerar:");
      if (!adminSecret) { setRetrying(false); return; }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/start-music-after-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ taskId: order.id, adminSecret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao re-gerar");
      toast({ title: "✅ Geração reiniciada!", description: "A música está sendo gerada novamente." });
      onRetrySuccess?.();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao re-gerar música", variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> {order.child_name}
          </DialogTitle>
          <DialogDescription>Detalhes do pedido</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Tema</p>
            <p className="font-medium">{order.theme}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1"><Music className="h-3.5 w-3.5" /> Estilo</p>
            <p className="font-medium">{order.music_style || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Faixa Etária</p>
            <p className="font-medium">{order.age_group}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</p>
            <p className="font-medium">{order.user_email || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Pagamento</p>
            {statusBadge(order.payment_status)}
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Status Música</p>
            <Badge variant="secondary">{order.status}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Criado em</p>
            <p className="font-medium">{new Date(order.created_at).toLocaleString("pt-BR")}</p>
          </div>
          {order.access_code && (
            <div className="space-y-1">
              <p className="text-muted-foreground">Código de Acesso</p>
              <p className="font-mono font-bold text-primary">{order.access_code}</p>
            </div>
          )}
        </div>

        {order.download_expires_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Download expira em: {new Date(order.download_expires_at).toLocaleString("pt-BR")}
          </div>
        )}

        {/* Recovery Email Button */}
        {canSendRecovery && (
          <Button
            size="sm"
            onClick={handleSendRecoveryEmail}
            disabled={sendingEmail}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendingEmail ? "Enviando..." : "Enviar Email de Recuperação"}
          </Button>
        )}

        {/* Reengagement Email Button */}
        {canSendReengagement && (
          <Button
            size="sm"
            onClick={handleSendReengagementEmail}
            disabled={sendingReengagement}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendingReengagement ? "Enviando..." : "Enviar Email de Reengajamento (50% OFF)"}
          </Button>
        )}

        {/* Audio Player */}
        {order.audio_url && (
          <div className="space-y-2">
            <p className="text-sm font-medium">🎵 Áudio Gerado</p>
            <audio controls className="w-full" src={order.audio_url} preload="metadata" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={order.audio_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                </a>
              </Button>
              {order.download_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={order.download_url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar MP3
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lyrics */}
        {order.lyrics && (
          <div className="space-y-2">
            <p className="text-sm font-medium">📝 Letra</p>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-60 overflow-y-auto font-sans">
              {order.lyrics}
            </pre>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
