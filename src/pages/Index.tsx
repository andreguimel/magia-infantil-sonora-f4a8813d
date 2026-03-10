import { lazy, Suspense } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

// Lazy load below-fold sections
const Features = lazy(() => import("@/components/landing/Features").then(m => ({ default: m.Features })));
const RealExamples = lazy(() => import("@/components/landing/RealExamples").then(m => ({ default: m.RealExamples })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const Testimonials = lazy(() => import("@/components/landing/Testimonials").then(m => ({ default: m.Testimonials })));
const Pricing = lazy(() => import("@/components/landing/Pricing").then(m => ({ default: m.Pricing })));
const Guarantee = lazy(() => import("@/components/landing/Guarantee").then(m => ({ default: m.Guarantee })));
const FAQ = lazy(() => import("@/components/landing/FAQ").then(m => ({ default: m.FAQ })));
const Footer = lazy(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));
const ExitIntentPopup = lazy(() => import("@/components/ui/ExitIntentPopup").then(m => ({ default: m.ExitIntentPopup })));
const UrgencyBanner = lazy(() => import("@/components/ui/UrgencyBanner").then(m => ({ default: m.UrgencyBanner })));
const WhatsAppButton = lazy(() => import("@/components/ui/WhatsAppButton").then(m => ({ default: m.WhatsAppButton })));
const StickyMobileCTA = lazy(() => import("@/components/ui/StickyMobileCTA").then(m => ({ default: m.StickyMobileCTA })));

function IntermediateCTA() {
  const navigate = useNavigate();
  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 via-lavender/5 to-secondary/5">
      <div className="container-rounded">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-5xl block mb-4">💛</span>
          <h2 className="text-3xl md:text-4xl font-baloo font-bold mb-4">
            Sua criança merece esse{" "}
            <span className="text-gradient">momento mágico</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Imagine o sorriso ao ouvir o próprio nome cantado em uma música feita só pra ela!
          </p>
          <button onClick={() => navigate("/criar")} className="btn-magic text-lg flex items-center justify-center gap-2 mx-auto">
            <Sparkles className="w-5 h-5" />
            Criar música personalizada — R$ 9,90
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            ✅ Pagamento seguro via Pix • Download instantâneo
          </p>
        </div>
      </div>
    </section>
  );
}

const LazySection = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="min-h-[200px]" />}>{children}</Suspense>
);

const Index = () => {
  return (
    <main className="min-h-screen">
      <Suspense fallback={null}><UrgencyBanner /></Suspense>
      <Navbar />
      <Hero />
      <LazySection><RealExamples /></LazySection>
      <LazySection><Features /></LazySection>
      <LazySection><HowItWorks /></LazySection>
      <LazySection><Testimonials /></LazySection>
      <IntermediateCTA />
      <LazySection><Pricing /></LazySection>
      <LazySection><Guarantee /></LazySection>
      <LazySection><FAQ /></LazySection>
      <LazySection><Footer /></LazySection>
      <Suspense fallback={null}><ExitIntentPopup /></Suspense>
      <Suspense fallback={null}><WhatsAppButton /></Suspense>
      <Suspense fallback={null}><StickyMobileCTA /></Suspense>
    </main>
  );
};

export default Index;
