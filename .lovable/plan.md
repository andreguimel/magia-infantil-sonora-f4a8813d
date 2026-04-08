

## Plano: Compactar seção de pagamento abaixo da letra

### Problema
Após a letra, há muitos blocos separados (timer, card motivacional, benefícios, planos, CTA com social proof) que geram scroll excessivo antes do botão de compra.

### Solução
Condensar tudo em **2 blocos** logo abaixo da letra:

**Bloco 1 — Card motivacional compacto** (1 linha, sem emojis gigantes)
- Frase curta: "Transforme essa letra em música para {nome}! 🎵" — inline, sem o bloco grande atual

**Bloco 2 — Card único de checkout** (tudo junto num só card)
- Timer de urgência (1 linha no topo)
- Benefícios em linha horizontal (ícones lado a lado, não lista vertical)
- Seleção de plano (mantém os 2 botões)
- Social proof compacto (1 linha: ⭐ 4.9/5 • 2.847 músicas)
- Preço + botão CTA
- Badge de segurança

### Alterações em `src/pages/Preview.tsx`

**1. Remover card motivacional separado** — transformar em 1 linha de texto acima do card de checkout

**2. Benefícios: lista vertical → linha horizontal**
- De 3 itens empilhados para 3 ícones lado a lado com texto curto (ex: "🎵 MP3 • 📄 PDF • ⬇️ Download")

**3. Unificar timer + benefícios + planos + social proof + CTA** em um único `card-float`
- Timer no topo (compacto)
- Benefícios em 1 linha
- Planos
- Social proof (1 linha)
- Preço + botão

### Resultado
O botão de compra fica visível com muito menos scroll — quase imediatamente abaixo da letra.

