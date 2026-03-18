import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  User,
  Calendar,
  Heart,
  MessageSquare,
  ArrowLeft,
  Music,
  Mail,
  Phone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MagicButton } from "@/components/ui/MagicButton";
import { FloatingElements } from "@/components/ui/FloatingElements";
import { useToast } from "@/hooks/use-toast";
import { generateLyricsOnly } from "@/services/musicPipeline";

const genderOptions = [
  { value: "menino", label: "Menino", emoji: "👦" },
  { value: "menina", label: "Menina", emoji: "👧" },
];

const themesByGender: Record<string, { value: string; label: string; emoji: string }[]> = {
  menino: [
    { value: "animais", label: "🐻 Animais", emoji: "🐻" },
    { value: "super-herois", label: "🦸 Super-heróis", emoji: "🦸" },
    { value: "espaco", label: "🚀 Espaço", emoji: "🚀" },
    { value: "dinossauros", label: "🦕 Dinossauros", emoji: "🦕" },
    { value: "futebol", label: "⚽ Futebol", emoji: "⚽" },
  ],
  menina: [
    { value: "princesas", label: "👸 Princesas", emoji: "👸" },
    { value: "super-heroinas", label: "🦸‍♀️ Super-heroínas", emoji: "🦸‍♀️" },
    { value: "fadas", label: "🧚 Fadas", emoji: "🧚" },
    { value: "animais", label: "🐱 Animais", emoji: "🐱" },
    { value: "natureza", label: "🌸 Natureza", emoji: "🌸" },
  ],
};

const ageGroups = [
  { value: "0-2", label: "0-2 anos" },
  { value: "3-4", label: "3-4 anos" },
  { value: "5-6", label: "5-6 anos" },
  { value: "7-8", label: "7-8 anos" },
  { value: "9-10", label: "9-10 anos" },
  { value: "11+", label: "11+ anos" },
];

const musicStyles = [
  { value: "pop-infantil", label: "Pop Infantil", emoji: "🎤", desc: "Alegre e dançante" },
  { value: "mpb-acustico", label: "MPB / Acústico", emoji: "🎸", desc: "Violão e voz suave" },
  { value: "sertanejo", label: "Sertanejo", emoji: "🤠", desc: "Divertido e animado" },
  { value: "rock-infantil", label: "Rock Infantil", emoji: "🎸", desc: "Guitarras e energia" },
  { value: "bossa-nova", label: "Bossa Nova", emoji: "🎷", desc: "Suave e melódico" },
  { value: "reggae", label: "Reggae", emoji: "🌴", desc: "Relaxante e tropical" },
];

interface FormData {
  childName: string;
  ageGroup: string;
  gender: string;
  theme: string;
  userEmail?: string;
  userPhone?: string;
  customLyrics?: string;
  musicStyle?: string;
}

export default function CreateMusic() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Fire ViewContent pixel event
  useEffect(() => {
    if (typeof window.fbq === "function") {
      window.fbq("track", "ViewContent", { content_name: "CreateMusic" });
    }
  }, []);
  const [hasCustomLyrics, setHasCustomLyrics] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    childName: "",
    ageGroup: "",
    gender: "",
    theme: "",
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.childName.trim()) {
      toast({ title: "Opa! 🎵", description: "Digite o nome da criança para continuar", variant: "destructive" });
      return;
    }
    if (!formData.ageGroup) {
      toast({ title: "Opa! 🎵", description: "Selecione a faixa etária", variant: "destructive" });
      return;
    }
    if (!formData.gender) {
      toast({ title: "Opa! 🎵", description: "Selecione menino ou menina", variant: "destructive" });
      return;
    }
    if (!formData.theme) {
      toast({ title: "Opa! 🎵", description: "Escolha um tema favorito", variant: "destructive" });
      return;
    }
    if (!formData.theme) {
      toast({ title: "Opa! 🎵", description: "Escolha um tema favorito", variant: "destructive" });
      return;
    }

    if (hasCustomLyrics && (!formData.customLyrics || formData.customLyrics.trim().length < 20)) {
      toast({ title: "Opa! 🎵", description: "A letra precisa ter pelo menos 20 caracteres", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      let taskId: string;
      let lyrics: string;

      if (hasCustomLyrics && formData.customLyrics?.trim()) {
        // Custom lyrics: save directly to DB without AI generation
        const { saveCustomLyrics } = await import("@/services/musicPipeline");
        const result = await saveCustomLyrics(formData);
        taskId = result.taskId;
        lyrics = formData.customLyrics.trim();
      } else {
        // AI-generated lyrics
        const result = await generateLyricsOnly(formData);
        taskId = result.taskId;
        lyrics = result.lyrics;
      }

      localStorage.setItem("selectedPlan", "single");
      localStorage.removeItem("packageSongsRemaining");
      localStorage.removeItem("packageSongs");
      
      localStorage.setItem(
        "musicResult",
        JSON.stringify({ taskId, formData, lyrics })
      );
      navigate("/preview");
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "Erro na geração 😔",
        description: error instanceof Error ? error.message : "Algo deu errado. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [formData, navigate, toast]);

  const storedPlan = localStorage.getItem("selectedPlan") || "single";
  const isPacote = storedPlan === "pacote";
  const packageSongsRaw = isPacote ? localStorage.getItem("packageSongs") : null;
  const packageSongs: { childName: string }[] = packageSongsRaw ? JSON.parse(packageSongsRaw) : [];
  const packageSongsRemaining = parseInt(localStorage.getItem("packageSongsRemaining") || "0", 10);
  const isPackageFollowUp = isPacote && packageSongsRemaining > 0;

  return (
    <div className="min-h-screen bg-background stars-bg relative overflow-hidden">
      <FloatingElements />

      <div className="container-rounded py-8 relative z-10">
        {/* Package progress */}
        {isPackageFollowUp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className="card-float bg-primary/5 border border-primary/20 text-center py-3">
              <p className="text-sm font-medium">
                🎁 Pacote Encantado — Música {4 - packageSongsRemaining} de 3
              </p>
              <p className="text-xs text-muted-foreground">
                {packageSongsRemaining} {packageSongsRemaining === 1 ? "música restante" : "músicas restantes"} • Já pago!
              </p>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full bg-card shadow-soft flex items-center justify-center hover:scale-105 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl md:text-3xl font-baloo font-bold">
            Criar minha <span className="text-gradient">música mágica</span>
          </h1>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Formulário */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="card-float">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome da criança */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <User className="w-4 h-4 text-primary" />
                    Nome da criança *
                  </label>
                  <Input
                    placeholder="Ex: Joãozinho"
                    value={formData.childName}
                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                    className="h-12 rounded-xl border-2 border-border focus:border-primary transition-colors"
                    maxLength={30}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Este nome aparecerá na letra da música
                  </p>
                </div>

                {/* Idade */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    Faixa etária *
                  </label>
                  <Select
                    value={formData.ageGroup}
                    onValueChange={(value) => setFormData({ ...formData, ageGroup: value })}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-2 border-border focus:border-primary">
                      <SelectValue placeholder="Selecione a idade" />
                    </SelectTrigger>
                    <SelectContent>
                      {ageGroups.map((age) => (
                        <SelectItem key={age.value} value={age.value}>
                          {age.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gênero */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Heart className="w-4 h-4 text-primary" />
                    A música é para: *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {genderOptions.map((g) => (
                      <motion.button
                        key={g.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, gender: g.value, theme: "" })}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.gender === g.value
                            ? "border-primary bg-primary/10 shadow-pink"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="text-3xl block mb-1">{g.emoji}</span>
                        <span className="text-sm font-medium">{g.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Tema */}
                <AnimatePresence>
                  {formData.gender && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <Sparkles className="w-4 h-4 text-secondary" />
                        Tema favorito *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(themesByGender[formData.gender] || []).map((theme) => (
                          <motion.button
                            key={theme.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, theme: theme.value })}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              formData.theme === theme.value
                                ? "border-primary bg-primary/10 shadow-pink"
                                : "border-border bg-card hover:border-primary/50"
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="text-2xl block mb-1">{theme.emoji}</span>
                            <span className="text-sm font-medium">
                              {theme.label.split(" ")[1]}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Estilo Musical */}
                <AnimatePresence>
                  {formData.theme && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <Music className="w-4 h-4 text-primary" />
                        Estilo musical (opcional)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {musicStyles.map((style) => (
                          <motion.button
                            key={style.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, musicStyle: formData.musicStyle === style.value ? "" : style.value })}
                            className={`p-3 rounded-xl border-2 transition-all ${
                              formData.musicStyle === style.value
                                ? "border-primary bg-primary/10 shadow-pink"
                                : "border-border bg-card hover:border-primary/50"
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="text-2xl block mb-1">{style.emoji}</span>
                            <span className="text-xs font-medium block">{style.label}</span>
                            <span className="text-[10px] text-muted-foreground">{style.desc}</span>
                          </motion.button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Se não escolher, o estilo será definido automaticamente pelo tema
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>








                {/* Opção de letra própria */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Music className="w-4 h-4 text-primary" />
                    Já tem uma letra pronta?
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <motion.button
                      type="button"
                      onClick={() => {
                        setHasCustomLyrics(false);
                        setFormData({ ...formData, customLyrics: "" });
                      }}
                      className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        !hasCustomLyrics
                          ? "border-primary bg-primary/10 shadow-pink"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      ✨ Gerar com IA
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => {
                        setHasCustomLyrics(true);
                        setFormData({ ...formData, customLyrics: formData.customLyrics || "" });
                      }}
                      className={`p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        hasCustomLyrics
                          ? "border-primary bg-primary/10 shadow-pink"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      ✍️ Escrever minha letra
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {hasCustomLyrics && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Textarea
                          placeholder="Cole ou escreva a letra da música aqui..."
                          value={formData.customLyrics || ""}
                          onChange={(e) => setFormData({ ...formData, customLyrics: e.target.value })}
                          className="min-h-[180px] rounded-xl border-2 border-border focus:border-primary transition-colors resize-none"
                          maxLength={3000}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Máximo 3000 caracteres • Esta letra será cantada exatamente como escrita
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botão de submit */}
                <MagicButton
                  size="lg"
                  className="w-full"
                  loading={isLoading}
                  disabled={isLoading}
                >
                  {!isLoading && <Sparkles className="w-5 h-5" />}
                  {hasCustomLyrics ? "Continuar com minha letra!" : "Gerar música mágica!"}
                </MagicButton>
              </form>
            </div>
          </motion.div>

          {/* Preview/Info lateral */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Card de preview */}
            <div className="card-float text-center">
              <div className="text-6xl mb-4">🎵</div>
              <h3 className="text-xl font-baloo font-bold mb-2">Prévia ao vivo</h3>
              <AnimatePresence mode="wait">
                {formData.childName ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-muted/50 rounded-2xl p-4 mt-4"
                  >
                    <p className="text-sm text-muted-foreground mb-2">Sua música será sobre:</p>
                    <p className="font-baloo font-bold text-lg text-gradient">
                      "{formData.childName}"
                    </p>
                    {formData.theme && formData.gender && (
                      <p className="text-sm mt-2">
                        Tema: <span className="font-semibold">{(themesByGender[formData.gender] || []).find((t) => t.value === formData.theme)?.label}</span>
                      </p>
                    )}
                    {formData.ageGroup && (
                      <p className="text-sm">
                        Idade: <span className="font-semibold">{ageGroups.find((a) => a.value === formData.ageGroup)?.label}</span>
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground"
                  >
                    Preencha o formulário para ver a prévia
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* O que você vai receber */}
            <div className="card-float">
              <h3 className="font-baloo font-bold mb-4 flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                O que você vai receber:
              </h3>
              <ul className="space-y-3">
                {[
                  "🎵 Música completa cantada com o nome da criança",
                  "📝 Letra exclusiva personalizada",
                  "⬇️ Download instantâneo após pagamento",
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

          </motion.div>
        </div>
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-4xl p-12 text-center max-w-md mx-4 shadow-magic"
            >
              <motion.div
                className="text-7xl mb-6"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🪄
              </motion.div>
              <h2 className="text-2xl font-baloo font-bold mb-4">
                Gerando sua letra mágica...
              </h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ✨ Criando letra personalizada...
                </motion.span>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Isso leva apenas alguns segundos
              </p>
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-rainbow"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 120, ease: "linear" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
