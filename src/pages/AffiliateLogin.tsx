import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link, LogIn } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function AffiliateLogin() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/affiliate-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ code: code.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.error || "Falha no login", variant: "destructive" });
        return;
      }
      sessionStorage.setItem("affiliate_token", data.token);
      navigate("/parceiro/dashboard");
    } catch {
      toast({ title: "Erro", description: "Falha na conexão", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Link className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-baloo">Painel do Parceiro</CardTitle>
          <p className="text-sm text-muted-foreground">Acompanhe suas vendas e comissões</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Seu código</label>
              <Input
                placeholder="ex: joao"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !code.trim() || !password.trim()}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
