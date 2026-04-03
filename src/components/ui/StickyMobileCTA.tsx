import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function StickyMobileCTA() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const pricingEl = document.getElementById("preco");

    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY < 400) {
        setVisible(false);
        return;
      }

      // Hide when pricing section is in viewport
      if (pricingEl) {
        const rect = pricingEl.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setVisible(false);
          return;
        }
      }

      setVisible(true);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        >
          <div className="bg-card/95 backdrop-blur-lg border-t border-border px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
            <div>
              <p className="text-xs text-muted-foreground">A partir de</p>
              <p className="text-lg font-baloo font-extrabold text-primary">R$ 19,90</p>
            </div>
            <button
              onClick={() => navigate("/criar")}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-bold px-5 py-3 rounded-full text-sm shadow-pink hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-4 h-4" />
              Criar música agora
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
