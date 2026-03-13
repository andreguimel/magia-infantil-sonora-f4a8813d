import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ShoppingCart, CheckCircle, TrendingUp, DollarSign, RefreshCw, Percent, FileDown, CalendarDays } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface WeekOrder {
  id: string;
  child_name: string;
  theme: string;
  music_style: string | null;
  created_at: string;
  payment_status: string | null;
  price_paid: number | null;
}

interface WeekData {
  weekStart: string;
  weekEnd: string;
  count: number;
  revenue: number;
  commission: number;
  orders: WeekOrder[];
}

interface AffiliateData {
  label: string;
  code: string;
  commissionPercent: number;
  metrics: {
    total: number;
    paid: number;
    conversionRate: number;
    revenue: number;
    commissionDue: number;
    commissionPaid: number;
    balance: number;
  };
  weeks: WeekData[];
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getSaleType(pricePaid: number | null): string {
  const price = pricePaid || 9.90;
  if (price >= 24) return "Pacote";
  if (price >= 14) return "Upsell";
  return "Avulsa";
}

function getSaleTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  if (type === "Pacote") return "default";
  if (type === "Upsell") return "secondary";
  return "outline";
}

function exportWeekCSV(week: WeekData, label: string, commissionPercent: number) {
  const headers = ["Nome da Criança", "Tema", "Estilo", "Tipo", "Data", "Valor Venda", "Comissão"];
  const rows = week.orders.map(o => {
    const price = o.price_paid || 9.90;
    return [
      o.child_name,
      o.theme,
      o.music_style || "",
      getSaleType(o.price_paid),
      new Date(o.created_at).toLocaleDateString("pt-BR"),
      price.toFixed(2),
      (price * commissionPercent / 100).toFixed(2),
    ];
  });
  const totalRow = ["TOTAL", "", "", "", "", week.revenue.toFixed(2), week.commission.toFixed(2)];
  const csv = [headers, ...rows, totalRow].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-${label}-${week.weekStart}-a-${week.weekEnd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AffiliateDashboard() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = sessionStorage.getItem("affiliate_token");

  const fetchData = async () => {
    if (!token) { navigate("/parceiro"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/affiliate-stats`, {
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        sessionStorage.removeItem("affiliate_token");
        navigate("/parceiro");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { navigate("/parceiro"); return; }
    fetchData();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("affiliate_token");
    navigate("/parceiro");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-baloo font-bold text-foreground">Painel do Parceiro</h1>
            {data && (
              <p className="text-muted-foreground text-sm mt-1">
                Olá, <span className="font-semibold text-foreground">{data.label}</span> · Código: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{data.code}</code>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>

        {data && (
          <>
            {/* Performance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <ShoppingCart className="h-4 w-4" /> Checkouts
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{data.metrics.total}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" /> Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{data.metrics.paid}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" /> Conversão
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{data.metrics.conversionRate}%</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-500" /> Receita Gerada
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">R$ {data.metrics.revenue.toFixed(2)}</p></CardContent>
              </Card>
            </div>

            {/* Commission Cards */}
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Percent className="h-5 w-5" /> Comissões ({data.commissionPercent}%)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Comissão Devida</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-primary">R$ {data.metrics.commissionDue.toFixed(2)}</p></CardContent>
              </Card>
              <Card className="border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Já Pago</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">R$ {data.metrics.commissionPaid.toFixed(2)}</p></CardContent>
              </Card>
              <Card className={data.metrics.balance > 0 ? "border-orange-200" : "border-green-200"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Saldo a Receber</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${data.metrics.balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                    R$ {data.metrics.balance.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Reports */}
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5" /> Relatórios Semanais
            </h2>
            {data.weeks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma venda registrada ainda.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.weeks.map((week) => (
                  <Card key={week.weekStart}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Semana {formatDate(week.weekStart)} — {formatDate(week.weekEnd)}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-4 text-sm">
                          <span><strong>{week.count}</strong> venda{week.count !== 1 ? "s" : ""}</span>
                          <span>Receita: <strong className="text-green-600">R$ {week.revenue.toFixed(2)}</strong></span>
                          <span>Comissão: <strong className="text-primary">R$ {week.commission.toFixed(2)}</strong></span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => exportWeekCSV(week, data.code, data.commissionPercent)}>
                          <FileDown className="h-4 w-4 mr-1" /> CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Criança</TableHead>
                            <TableHead>Tema</TableHead>
                            <TableHead>Estilo</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Comissão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {week.orders.map((o) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-medium">{o.child_name}</TableCell>
                              <TableCell>{o.theme}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{o.music_style || "—"}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {new Date(o.created_at).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>R$ {(o.price_paid || 9.90).toFixed(2).replace('.', ',')}</TableCell>
                              <TableCell className="text-primary font-semibold">
                                R$ {((o.price_paid || 9.90) * data.commissionPercent / 100).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <span className="text-2xl animate-pulse">📊</span>
          </div>
        )}
      </div>
    </div>
  );
}
