import { useState, useEffect, lazy, Suspense } from "react";
import { Sparkles, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HEADLINES = [
  "O Nome do Seu Filho em uma Música Cheia de Amor",
  "Uma Música Única, Educativa e Inesquecível",
  "A Trilha Sonora da Infância do Seu Filho Começa Aqui",
];

// Lazy load heavy components
const FloatingElements = lazy(() =>
  import("@/components/ui/FloatingElements").then((m) => ({ default: m.FloatingElements }))
);
const MagicMockup = lazy(() =>
  import("@/components/landing/mockup/MagicMockup").then((m) => ({ default: m.MagicMockup }))
);

export function Hero() {
  const navigate = useNavigate();
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger CSS animations after mount
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const initialCount = 1234 + 250; // Static to avoid layout shift
  const todayCount = 42;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background stars-bg">
      <Suspense fallback={null}>
        <FloatingElements />
      </Suspense>

      <div className="container-rounded relative z-10 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content - NO framer-motion, use CSS transitions */}
          <div
            className={`text-center lg:text-left transition-all duration-700 ${
              mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <div className="inline-flex items-center gap-2 badge-fun mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Feito com IA + Muito Amor</span>
            </div>

            {/* H1 is the LCP element - render immediately, no opacity:0 */}
            <div className="text-3xl md:text-4xl lg:text-5xl font-baloo font-extrabold leading-tight mb-6 min-h-[4.5rem] md:min-h-[5.5rem] lg:min-h-[7rem] flex items-center">
              <h1>
                <span className="text-gradient">{HEADLINES[headlineIndex]} 🎶</span>
              </h1>
            </div>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
              A IA Música Mágica escreve uma letra linda e educativa com o nome da sua criança, adiciona ritmo, uma banda completa e te entrega uma música pronta por apenas <span className="line-through text-muted-foreground/60">R$39,90</span> <span className="font-bold text-primary">R$19,90</span>.
              <span className="text-primary font-semibold"> É algo marcante e inesquecível! Aproveite essa oferta por tempo limitado!</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
              <button
                onClick={() => navigate("/criar")}
                className="btn-magic w-full sm:w-auto flex items-center justify-center gap-2 text-lg"
              >
                <Music className="w-5 h-5" />
                Crie a letra da música grátis agora!
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center lg:text-left mb-4">
              ✅ Pagamento seguro via Pix • Download instantâneo
            </p>

            {/* Mini testimonials */}
            <div className="flex flex-col gap-2 mb-6 text-sm">
              {[
                { initials: "MS", text: '"Chorei de emoção quando ouvi!" — Mariana S.' },
                { initials: "PL", text: '"Meu filho ouve todo dia antes de dormir!" — Pedro L.' },
                { initials: "AP", text: '"Presente mais especial que já dei!" — Ana P.' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                    {t.initials}
                  </div>
                  <span className="flex items-center gap-1">
                    <span className="text-accent text-xs">⭐⭐⭐⭐⭐</span>
                    <span className="text-xs">{t.text}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="text-xl">🎵</span>
                <span className="text-sm">
                  Mais de{" "}
                  <span className="font-bold text-primary tabular-nums">
                    {initialCount.toLocaleString("pt-BR")}
                  </span>
                  {" "}músicas criadas!
                </span>
              </span>
              <span className="text-muted-foreground/40 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-sm">
                🔥 <span className="font-semibold text-foreground">{todayCount}</span> criadas hoje
              </span>
            </div>
          </div>

          {/* Magic Mockup - lazy loaded */}
          <div
            className={`transition-all duration-700 delay-300 ${
              mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <Suspense fallback={<div className="h-[420px] rounded-[2rem] bg-muted/30 animate-pulse" />}>
              <MagicMockup />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
