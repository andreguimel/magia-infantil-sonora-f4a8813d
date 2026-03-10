import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

// Lazy load non-critical routes
const CreateMusic = lazy(() => import("./pages/CreateMusic"));
const Preview = lazy(() => import("./pages/Preview"));
const Payment = lazy(() => import("./pages/Payment"));
const MyMusic = lazy(() => import("./pages/MyMusic"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AffiliateLogin = lazy(() => import("./pages/AffiliateLogin"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));

// Lazy load non-critical UI components
const PurchaseNotification = lazy(() =>
  import("./components/ui/PurchaseNotification").then((m) => ({ default: m.PurchaseNotification }))
);

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
      <Suspense fallback={null}>
        <PurchaseNotification />
      </Suspense>
      <BrowserRouter>
        <RefCapture />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-2xl animate-pulse">🎵</span></div>}>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
