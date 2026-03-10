import { useState, useRef } from "react";
import { Play, Pause, Music } from "lucide-react";

const examples = [
  { name: "Pedro Guímel", emoji: "⚽", theme: "Futebol", url: "/audio/demo-pedro.mp3", color: "bg-primary" },
  { name: "Isabela", emoji: "👑", theme: "Princesa", url: "/audio/demo-isabela-real.mp3", color: "bg-secondary" },
  { name: "Amanda", emoji: "👑", theme: "Princesa", url: "/audio/demo-amanda-real.mp3", color: "bg-accent" },
];

export function RealExamples() {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  const togglePlay = (index: number) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    if (playingIndex === index) {
      audio.pause();
      setPlayingIndex(null);
    } else {
      // Pause any currently playing
      if (playingIndex !== null) {
        audioRefs.current[playingIndex]?.pause();
      }
      audio.play();
      setPlayingIndex(index);
    }
  };

  const handleEnded = (index: number) => {
    if (playingIndex === index) setPlayingIndex(null);
  };

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container-rounded">
        <div className="text-center mb-12">
          <span className="badge-fun mb-4 inline-block">🎧 Ouça Agora</span>
          <h2 className="text-3xl md:text-4xl font-baloo font-bold mb-3">
            Músicas <span className="text-gradient">reais</span> criadas pela nossa IA
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Aperte o play e veja a qualidade das músicas personalizadas!
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {examples.map((ex, i) => {
            const isActive = playingIndex === i;
            return (
              <div
                key={i}
                className={`card-float text-center transition-all duration-300 ${isActive ? "ring-2 ring-primary shadow-magic" : ""}`}
              >
                <audio
                  ref={(el) => { audioRefs.current[i] = el; }}
                  src={ex.url}
                  preload="metadata"
                  onEnded={() => handleEnded(i)}
                />

                <div className="relative inline-block mb-3">
                  <div className={`w-16 h-16 ${ex.color} rounded-full flex items-center justify-center text-3xl shadow-lg`}>
                    {ex.emoji}
                  </div>
                  {isActive && (
                    <span className="absolute -top-1 -right-1 text-lg animate-wiggle">🎵</span>
                  )}
                </div>

                <h3 className="font-baloo font-bold text-lg mb-0.5">
                  Música do {ex.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  <Music className="w-3 h-3 inline mr-1" />{ex.theme}
                </p>

                <button
                  onClick={() => togglePlay(i)}
                  className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground scale-110 shadow-lg"
                      : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105"
                  }`}
                >
                  {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                {/* Mini sound wave */}
                {isActive && (
                  <div className="flex items-end justify-center gap-0.5 h-4 mt-3">
                    {[0.6, 1, 0.4, 0.8, 0.5, 1, 0.7].map((h, j) => (
                      <div
                        key={j}
                        className="w-1 bg-primary/60 rounded-full animate-pulse"
                        style={{ height: `${h * 16}px`, animationDelay: `${j * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
