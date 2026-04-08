

## Plano: Stepper + Social Proof + Timer de Urgência

### 1. Stepper de progresso no topo da página `/preview`
Adicionar uma barra visual de 4 passos abaixo do header, visível em todos os estados:

```text
[✓ Personalizar] ─── [● Ver Letra] ─── [○ Pagar] ─── [○ Música Pronta]
```

- Cada `PaymentState` mapeia para um step ativo
- Cores: step completo = primary, atual = primary com pulso, futuro = muted
- Componente inline no `Preview.tsx`, sem arquivo separado

**Arquivo**: `src/pages/Preview.tsx`

### 2. Social proof no card de CTA (estado "preview")
Adicionar logo acima do botão "Quero a música!" no card da direita:

- Linha com: `⭐ 4.9/5 • 2.847 músicas criadas`
- Mini depoimento de 1 linha: _"Meu filho amou! Ouve toda hora"_ — Ana, SP
- Badge: `🔒 Pagamento 100% seguro`

Também adicionar no estado "form" (acima do botão de gerar QR Code).

**Arquivo**: `src/pages/Preview.tsx`

### 3. Timer de urgência no estado "preview"
Mover o countdown (que hoje só aparece no estado "form") para também aparecer no card de CTA do estado "preview", acima da seleção de plano.

Texto: "⏳ Oferta por tempo limitado" com timer regressivo visual.

**Arquivo**: `src/pages/Preview.tsx`

### Resumo de alterações
Apenas 1 arquivo será modificado: `src/pages/Preview.tsx`
- Stepper visual (mapeamento PaymentState → step index)
- Social proof (texto estático + mini depoimento)
- Timer reutilizado do estado "form" para "preview"

