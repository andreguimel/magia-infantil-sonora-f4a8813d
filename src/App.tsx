import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import CreateMusic from "./pages/CreateMusic";
import Preview from "./pages/Preview";
import Payment from "./pages/Payment";
import MyMusic from "./pages/MyMusic";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { PurchaseNotification } from "./components/ui/PurchaseNotification";

const queryClient = new QueryClient();

// Capture ref param from URL and persist to localStorage
function RefCapture() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    localStorage.setItem("ref_code", ref);
  }
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PurchaseNotification />
      <BrowserRouter>
        <RefCapture />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/criar" element={<CreateMusic />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/pagamento" element={<Payment />} />
          <Route path="/minhas-musicas" element={<MyMusic />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos" element={<TermsOfUse />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
