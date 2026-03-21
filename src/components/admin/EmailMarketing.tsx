import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Users, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Order {
  id: string;
  child_name: string;
  user_email: string | null;
  payment_status: string | null;
  status: string;
  created_at: string;
  price_paid: number | null;
}

interface Contact {
  email: string;
  childName: string;
  paymentStatus: string | null;
  orderStatus: string;
  lastOrder: string;
}

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

const TEMPLATES: EmailTemplate[] = [
  {
    name: "Recuperação (Carrinho Abandonado)",
    subject: "🎵 {nome} ainda está esperando! 50% OFF",
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#7c3aed">🎵 A música de {nome} está quase pronta!</h2>
<p>Oi! Notamos que você começou a criar uma música especial para <strong>{nome}</strong>, mas não finalizou o pedido.</p>
<p>Temos uma surpresa: use o cupom <strong style="color:#7c3aed;font-size:20px">RESGATE50</strong> e ganhe <strong>50% de desconto</strong>!</p>
<p style="text-align:center;margin:30px 0">
<a href="https://musicamagica.com/criar?coupon=RESGATE50" style="background:#7c3aed;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Criar Música com 50% OFF</a>
</p>
<p style="color:#666;font-size:13px">Essa oferta é por tempo limitado!</p>
</div>`,
  },
  {
    name: "Reengajamento (Cliente Existente)",
    subject: "🎶 Crie outra música para {nome}! 50% OFF",
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#7c3aed">🎶 Que tal mais uma música mágica?</h2>
<p>A música de <strong>{nome}</strong> ficou incrível! Que tal criar mais uma com um tema diferente?</p>
<p>Como agradecimento por ser nosso cliente, use o cupom <strong style="color:#7c3aed;font-size:20px">VOLTEI50</strong> e ganhe <strong>50% de desconto</strong>!</p>
<p style="text-align:center;margin:30px 0">
<a href="https://musicamagica.com/criar?coupon=VOLTEI50" style="background:#7c3aed;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Criar Nova Música com 50% OFF</a>
</p>
<p style="color:#666;font-size:13px">Aproveite essa oferta especial!</p>
</div>`,
  },
  {
    name: "Personalizado",
    subject: "",
    body: "",
  },
];

export default function EmailMarketing({ orders }: { orders: Order[] }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateIdx, setTemplateIdx] = useState(0);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number } | null>(null);

  const contacts = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const o of orders) {
      if (!o.user_email) continue;
      const existing = map.get(o.user_email);
      if (!existing || new Date(o.created_at) > new Date(existing.lastOrder)) {
        map.set(o.user_email, {
          email: o.user_email,
          childName: o.child_name,
          paymentStatus: o.payment_status,
          orderStatus: o.status,
          lastOrder: o.created_at,
        });
      }
    }
    return Array.from(map.values());
  }, [orders]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (filter === "paid") list = list.filter(c => c.paymentStatus === "paid");
    else if (filter === "pending") list = list.filter(c => c.paymentStatus === "pending");
    else if (filter === "abandoned") list = list.filter(c => c.paymentStatus === "expired" || c.paymentStatus === "cancelled");
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.email.toLowerCase().includes(s) || c.childName.toLowerCase().includes(s));
    }
    return list;
  }, [contacts, filter, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.email)));
    }
  };

  const toggleOne = (email: string) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email);
    else next.add(email);
    setSelected(next);
  };

  const selectTemplate = (idx: number) => {
    setTemplateIdx(idx);
    setSubject(TEMPLATES[idx].subject);
    setBody(TEMPLATES[idx].body);
  };

  const handleSend = async () => {
    if (selected.size === 0) {
      toast({ title: "Selecione ao menos um contato", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Preencha assunto e corpo do email", variant: "destructive" });
      return;
    }

    const confirm = window.confirm(`Enviar email para ${selected.size} contato(s)?`);
    if (!confirm) return;

    setSending(true);
    setLastResult(null);

    try {
      const token = sessionStorage.getItem("admin_token");
      // For each selected email, personalize the template
      const selectedContacts = contacts.filter(c => selected.has(c.email));
      const emails = selectedContacts.map(c => c.email);
      
      // Use the first selected contact's name for preview, but send individually for personalization
      // We'll send in batches where each email gets personalized content
      let totalSent = 0;
      let totalFailed = 0;

      // Send in batches of 50
      const batchSize = 50;
      for (let i = 0; i < selectedContacts.length; i += batchSize) {
        const batch = selectedContacts.slice(i, i + batchSize);
        const batchEmails = batch.map(c => c.email);
        
        // For personalized templates, we need to send one by one
        const needsPersonalization = subject.includes("{nome}") || body.includes("{nome}");
        
        if (needsPersonalization) {
          for (const contact of batch) {
            const personalizedSubject = subject.replace(/\{nome\}/g, contact.childName);
            const personalizedBody = body.replace(/\{nome\}/g, contact.childName);
            
            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-bulk-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                emails: [contact.email],
                subject: personalizedSubject,
                htmlContent: personalizedBody,
              }),
            });
            const data = await res.json();
            if (data.sent) totalSent += data.sent;
            if (data.failed) totalFailed += data.failed;
          }
        } else {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-bulk-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              emails: batchEmails,
              subject,
              htmlContent: body,
            }),
          });
          const data = await res.json();
          if (data.sent) totalSent += data.sent;
          if (data.failed) totalFailed += data.failed;
        }
      }

      setLastResult({ sent: totalSent, failed: totalFailed });
      toast({
        title: `✅ ${totalSent} enviado(s)${totalFailed > 0 ? `, ${totalFailed} falha(s)` : ""}`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const statusLabel = (s: string | null) => {
    if (s === "paid") return <Badge className="bg-green-100 text-green-800">Pago</Badge>;
    if (s === "pending") return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    if (s === "expired" || s === "cancelled") return <Badge className="bg-red-100 text-red-800">Abandonado</Badge>;
    return <Badge variant="outline">{s || "—"}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" /> Modelo de Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t, i) => (
              <Button
                key={i}
                variant={templateIdx === i ? "default" : "outline"}
                size="sm"
                onClick={() => selectTemplate(i)}
              >
                {t.name}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Assunto</label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Assunto do email (use {nome} para personalizar)"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Corpo (HTML)</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Conteúdo HTML do email (use {nome} para personalizar)"
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Use <code>{"{nome}"}</code> para inserir o nome da criança automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Contatos ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="abandoned">Abandonados</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar por email ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="border rounded-md overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Criança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Pedido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.email}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(c.email)}
                        onCheckedChange={() => toggleOne(c.email)}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{c.email}</TableCell>
                    <TableCell className="text-sm">{c.childName}</TableCell>
                    <TableCell>{statusLabel(c.paymentStatus)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.lastOrder).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Send Button */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              {selected.size} contato(s) selecionado(s)
              {lastResult && (
                <span className="ml-3">
                  | Último envio: ✅ {lastResult.sent} enviado(s)
                  {lastResult.failed > 0 && <span className="text-destructive"> ❌ {lastResult.failed} falha(s)</span>}
                </span>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : `Enviar para ${selected.size} contato(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
