import { motion } from "framer-motion";

const steps = [
  {
    number: "1",
    emoji: "✏️",
    title: "Preencha",
    description: "Digite o nome da criança, idade, tema favorito e uma mensagem especial opcional",
    color: "bg-primary",
  },
  {
    number: "2",
    emoji: "🪄",
    title: "A Magia Acontece",
    description: "Nossa IA cria letra e música personalizados em menos de 1 minuto",
    color: "bg-secondary",
  },
  {
    number: "3",
    emoji: "👀",
    title: "Pré-visualize",
    description: "Veja a letra personalizada gratuitamente antes de comprar",
    color: "bg-mint",
  },
  {
    number: "4",
    emoji: "🎁",
    title: "Baixe e Curta!",
    description: "Pague via Pix e receba o download instantâneo do pacote completo",
    color: "bg-accent",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-background">
      <div className="container-rounded">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="badge-fun mb-4 inline-block">🚀 Super Fácil</span>
          <h2 className="text-3xl md:text-4xl font-baloo font-bold mb-4">
            4 passos para a <span className="text-gradient">felicidade</span>
          </h2>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Linha conectora (desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-rainbow -translate-y-1/2 rounded-full" />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {/* Card */}
                <div className="card-float text-center relative z-10">
                  {/* Número com emoji */}
                  <div className="relative inline-block mb-4">
                    <div className={`w-16 h-16 ${step.color} rounded-full flex items-center justify-center text-2xl font-baloo font-extrabold text-primary-foreground shadow-lg`}>
                      {step.number}
                    </div>
                    <span className="absolute -top-2 -right-2 text-2xl animate-wiggle">
                      {step.emoji}
                    </span>
                  </div>

                  <h3 className="text-lg font-baloo font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
