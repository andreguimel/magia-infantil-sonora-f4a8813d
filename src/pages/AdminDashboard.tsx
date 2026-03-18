import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, LogOut, ShoppingCart, CheckCircle, XCircle, TrendingUp, DollarSign, Search, FileDown, Play, Trash2, Link, Plus, Copy, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import OrderDetailModal from "@/components/admin/OrderDetailModal";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Metrics {
  total: number;
  paid: number;
  pending: number;
  expired: number;
  completed: number;
  conversionRate: number;
  estimatedRevenue: number;
}

interface FunnelItem {
  stage: string;
  count: number;
}

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
  ref_code: string | null;
  price_paid: number | null;
}

interface TrackingLink {
  id: string;
  code: string;
  label: string;
  created_at: string;
  commission_percent: number;
  commission_paid: number;
  password_hash: string | null;
}

interface RefMetrics {
  [code: string]: { total: number; paid: number; revenue: number };
}

const FUNNEL_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(142 76% 36%)", "hsl(262 83% 58%)"];

function statusBadge(status: string | null) {
  switch (status) {
    case "paid": return <Badge className="bg-green-500/10 text-green-600 border-green-200">Pago</Badge>;
    case "pending": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">Pendente</Badge>;
    case "expired": return <Badge className="bg-red-500/10 text-red-600 border-red-200">Expirado</Badge>;
    case "cancelled": return <Badge className="bg-red-500/10 text-red-600 border-red-200">Cancelado</Badge>;
    default: return <Badge variant="secondary">{status || "—"}</Badge>;
  }
}

function exportCSV(orders: Order[]) {
  const headers = ["Nome", "Tema", "Estilo", "Email", "Pagamento", "Status", "Data", "Código Acesso", "Ref"];
  const rows = orders.map(o => [
    o.child_name, o.theme, o.music_style || "", o.user_email || "",
    o.payment_status || "", o.status,
    new Date(o.created_at).toLocaleDateString("pt-BR"),
    o.access_code || "", o.ref_code || "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAffiliateWeeklyCSV(orders: Order[], link: TrackingLink) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekOrders = orders.filter(o => o.ref_code === link.code && o.payment_status === 'paid' && new Date(o.created_at) >= weekAgo);
  const headers = ["Nome da Criança", "Tema", "Estilo", "Email", "Data", "Valor Venda", "Comissão"];
  const rows = weekOrders.map(o => {
    const price = o.price_paid || 9.90;
    const commission = price * (link.commission_percent / 100);
    return [
      o.child_name, o.theme, o.music_style || "", o.user_email || "",
      new Date(o.created_at).toLocaleDateString("pt-BR"),
      price.toFixed(2), commission.toFixed(2),
    ];
  });
  const totalRevenue = weekOrders.reduce((sum, o) => sum + (o.price_paid || 9.90), 0);
  const totalCommission = totalRevenue * (link.commission_percent / 100);
  rows.push(["TOTAL", "", "", "", "", totalRevenue.toFixed(2), totalCommission.toFixed(2)]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-semanal-${link.code}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [funnel, setFunnel] = useState<FunnelItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [refMetrics, setRefMetrics] = useState<RefMetrics>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [pageSize, setPageSize] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState(1);
  const [newLinkCode, setNewLinkCode] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkPassword, setNewLinkPassword] = useState("");
  const [newLinkCommission, setNewLinkCommission] = useState("50");
  const [creatingLink, setCreatingLink] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = sessionStorage.getItem("admin_token");

  const fetchData = async (p: string = period) => {
    if (!token) { navigate("/admin"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard?period=${p}`, {
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("admin_token");
        navigate("/admin");
        return;
      }
      const data = await res.json();
      setMetrics(data.metrics);
      setFunnel(data.funnel);
      setOrders(data.orders);
      setTrackingLinks(data.trackingLinks || []);
      setRefMetrics(data.refMetrics || {});
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate("/admin"); return; }
    fetchData();
  }, []);

  const handlePeriodChange = (v: string) => {
    setPeriod(v);
    fetchData(v);
  };

  const filteredOrders = orders
    .filter(o => {
      if (statusFilter === "all") return true;
      if (statusFilter === "abandoned") return o.payment_status === "expired" || o.payment_status === "cancelled";
      return o.payment_status === statusFilter;
    })
    .filter(o => {
      if (!search) return true;
      const q = search.toLowerCase();
      return o.child_name.toLowerCase().includes(q) || (o.user_email?.toLowerCase().includes(q) ?? false) || (o.ref_code?.toLowerCase().includes(q) ?? false);
    });

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = pageSize === 0 ? filteredOrders : filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, period, pageSize]);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token");
    navigate("/admin");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0 || !token) return;
    if (!confirm(`Excluir ${selectedIds.size} pedido(s)? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Falha ao excluir");
      toast({ title: "Excluído", description: `${selectedIds.size} pedido(s) removido(s)` });
      setSelectedIds(new Set());
      fetchData();
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir pedidos", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateLink = async () => {
    if (!newLinkCode.trim() || !newLinkLabel.trim() || !token) return;
    setCreatingLink(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "create_tracking_link", code: newLinkCode.trim(), label: newLinkLabel.trim(), password: newLinkPassword.trim() || undefined, commission_percent: Number(newLinkCommission) || 50 }),
      });
      if (res.status === 409) {
        toast({ title: "Erro", description: "Código já existe", variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error();
      toast({ title: "Link criado!" });
      setNewLinkCode("");
      setNewLinkLabel("");
      setNewLinkPassword("");
      setNewLinkCommission("50");
      fetchData();
    } catch {
      toast({ title: "Erro", description: "Falha ao criar link", variant: "destructive" });
    } finally {
      setCreatingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!token || !confirm("Excluir este link de rastreamento?")) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackingLinkId: linkId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Link removido" });
      fetchData();
    } catch {
      toast({ title: "Erro", description: "Falha ao excluir link", variant: "destructive" });
    }
  };

  const copyLinkUrl = (code: string) => {
    const url = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  const handlePayCommission = async (link: TrackingLink) => {
    const m = refMetrics[link.code] || { total: 0, paid: 0, revenue: 0 };
    const commissionDue = m.revenue * (link.commission_percent / 100);
    const balance = commissionDue - link.commission_paid;
    if (balance <= 0) {
      toast({ title: "Sem saldo pendente", description: "Toda a comissão já foi paga." });
      return;
    }
    const valueStr = prompt(`Quanto foi pago agora? (Saldo pendente: R$ ${balance.toFixed(2)})`, balance.toFixed(2));
    if (!valueStr) return;
    const value = parseFloat(valueStr.replace(",", "."));
    if (isNaN(value) || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const newTotal = link.commission_paid + value;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "update_commission_paid", linkId: link.id, commission_paid: newTotal }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Pagamento registrado!", description: `R$ ${value.toFixed(2)} registrado para ${link.label}` });
      fetchData();
    } catch {
      toast({ title: "Erro", description: "Falha ao registrar pagamento", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-baloo font-bold text-foreground">Painel Administrativo</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="h-4 w-4" /> Total Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{metrics.total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" /> Pagos
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-green-600">{metrics.paid}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-500" /> Abandonados
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-red-600">{metrics.expired}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Conversão
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{metrics.conversionRate}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-green-500" /> Receita
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">R$ {metrics.estimatedRevenue.toFixed(2)}</p></CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="tracking">
            <Link className="h-4 w-4 mr-1" /> Links de Rastreamento
          </TabsTrigger>
        </TabsList>

        {/* Funnel Tab */}
        <TabsContent value="funnel">
          {funnel.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funil de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 13 }} />
                      <Tooltip formatter={(v: number) => [v, "Pedidos"]} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {funnel.map((_, i) => (
                          <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Pedidos</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {filteredOrders.length} resultado{filteredOrders.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome, email ou ref..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-[220px]"
                  />
                </div>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 por pág.</SelectItem>
                    <SelectItem value="60">60 por pág.</SelectItem>
                    <SelectItem value="90">90 por pág.</SelectItem>
                    <SelectItem value="0">Mostrar tudo</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredOrders)} disabled={filteredOrders.length === 0}>
                  <FileDown className="h-4 w-4 mr-1" /> CSV
                </Button>
                {selectedIds.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir ({selectedIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Criança</TableHead>
                    <TableHead>Tema</TableHead>
                    <TableHead className="hidden md:table-cell">Estilo</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="hidden md:table-cell">Música</TableHead>
                    <TableHead className="hidden md:table-cell">Ref</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(o.id)}
                          onCheckedChange={() => toggleSelect(o.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium" onClick={() => setSelectedOrder(o)}>
                        <span className="flex items-center gap-1.5">
                          {o.audio_url && <Play className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                          {o.child_name}
                        </span>
                      </TableCell>
                      <TableCell onClick={() => setSelectedOrder(o)}>{o.theme}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs" onClick={() => setSelectedOrder(o)}>{o.music_style || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs" onClick={() => setSelectedOrder(o)}>{o.user_email || "—"}</TableCell>
                      <TableCell onClick={() => setSelectedOrder(o)}>{statusBadge(o.payment_status)}</TableCell>
                      <TableCell className="hidden md:table-cell" onClick={() => setSelectedOrder(o)}>
                        <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs" onClick={() => setSelectedOrder(o)}>
                        {o.ref_code ? <Badge variant="outline" className="text-xs">{o.ref_code}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs" onClick={() => setSelectedOrder(o)}>
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhum pedido encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <span className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)} de {filteredOrders.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                      Anterior
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .reduce<(number | string)[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        typeof p === 'string' ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={p}
                            variant={p === currentPage ? "default" : "outline"}
                            size="sm"
                            className="min-w-[36px]"
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </Button>
                        )
                      )}
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Links Tab */}
        <TabsContent value="tracking">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" /> Criar Novo Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Código (usado na URL)</label>
                  <Input
                    placeholder="ex: joao"
                    value={newLinkCode}
                    onChange={(e) => setNewLinkCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Nome / Label</label>
                  <Input
                    placeholder="ex: João Influencer"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    className="w-[220px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Senha do parceiro</label>
                  <Input
                    type="password"
                    placeholder="Senha de acesso"
                    value={newLinkPassword}
                    onChange={(e) => setNewLinkPassword(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Comissão (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50"
                    value={newLinkCommission}
                    onChange={(e) => setNewLinkCommission(e.target.value)}
                    className="w-[100px]"
                  />
                </div>
                <Button onClick={handleCreateLink} disabled={creatingLink || !newLinkCode.trim() || !newLinkLabel.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Criar
                </Button>
              </div>
              {newLinkCode.trim() && (
                <p className="text-xs text-muted-foreground mt-2">
                  URL: <code className="bg-muted px-1 py-0.5 rounded">{window.location.origin}/?ref={newLinkCode.trim().toLowerCase()}</code>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Links Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Checkouts</TableHead>
                    <TableHead>Pagos</TableHead>
                    <TableHead>Conversão</TableHead>
                    <TableHead>Receita</TableHead>
                    <TableHead>Comissão (%)</TableHead>
                    <TableHead>Comissão Devida</TableHead>
                    <TableHead>Comissão Paga</TableHead>
                    <TableHead>Saldo a Pagar</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackingLinks.map((link) => {
                    const m = refMetrics[link.code] || { total: 0, paid: 0, revenue: 0 };
                    const conv = m.total > 0 ? Math.round((m.paid / m.total) * 100) : 0;
                    const commissionDue = m.revenue * (link.commission_percent / 100);
                    const balance = commissionDue - link.commission_paid;
                    return (
                      <TableRow key={link.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{link.code}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{link.label}</TableCell>
                        <TableCell>{m.total}</TableCell>
                        <TableCell className="text-green-600 font-semibold">{m.paid}</TableCell>
                        <TableCell>{conv}%</TableCell>
                        <TableCell>R$ {m.revenue.toFixed(2)}</TableCell>
                        <TableCell>{link.commission_percent}%</TableCell>
                        <TableCell className="font-semibold">R$ {commissionDue.toFixed(2)}</TableCell>
                        <TableCell className="text-green-600">R$ {link.commission_paid.toFixed(2)}</TableCell>
                        <TableCell className={`font-bold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                          R$ {balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(link.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => copyLinkUrl(link.code)} title="Copiar URL">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              const pwd = prompt(`Definir nova senha para "${link.label}":`);
                              if (!pwd) return;
                              fetch(`${SUPABASE_URL}/functions/v1/admin-dashboard`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ action: "set_affiliate_password", linkId: link.id, password: pwd }),
                              }).then(r => {
                                if (r.ok) { toast({ title: "Senha definida!" }); fetchData(); }
                                else toast({ title: "Erro", variant: "destructive" });
                              });
                            }} title={link.password_hash ? "Redefinir senha" : "Definir senha"}>
                              <Key className={`h-4 w-4 ${link.password_hash ? "text-green-600" : "text-orange-500"}`} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => exportAffiliateWeeklyCSV(orders, link)} title="Relatório semanal">
                              <FileDown className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handlePayCommission(link)} title="Registrar pagamento">
                              <DollarSign className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteLink(link.id)} title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {trackingLinks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                        Nenhum link criado ainda
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OrderDetailModal order={selectedOrder} open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)} onRetrySuccess={() => { setSelectedOrder(null); fetchData(); }} />
    </div>
  );
}
