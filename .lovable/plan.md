

## Plano: Aumentar preços para R$ 19,90 / R$ 39,90 com preço riscado

### Resumo
Atualizar todos os preços de R$ 9,90 → R$ 19,90 (avulsa) e R$ 24,90 → R$ 39,90 (pacote), com preços "De" riscados para ancoragem de valor. Upsell ajustado proporcionalmente.

### Novos preços
| Plano | De (riscado) | Por (atual) |
|-------|-------------|-------------|
| Avulsa | R$ 39,90 | R$ 19,90 |
| Pacote | R$ 79,90 | R$ 39,90 |
| Upsell | — | R$ 25,00 |

### Arquivos a alterar

**1. `src/components/landing/Pricing.tsx`**
- Avulsa: price "19,90", adicionar `originalPrice: "39,90"`
- Pacote: price "39,90", originalPrice "79,90"
- Atualizar textos dos botões CTA

**2. `src/pages/Preview.tsx`**
- `planInfo.single`: price "19,90", priceNum "19.90"
- `planInfo.pacote`: price "39,90", priceNum "39.90"
- Atualizar preços exibidos nos botões de seleção de plano

**3. `src/components/landing/Hero.tsx`**
- Atualizar texto "por apenas R$19,90" + adicionar "de R$39,90"

**4. `src/pages/Index.tsx`**
- CTA intermediário: "R$ 19,90"

**5. `src/components/ui/StickyMobileCTA.tsx`**
- "A partir de R$ 19,90"

**6. Backend — `supabase/functions/create-billing/index.ts`**
- `priceInCents`: pacote 3990, avulsa 1990

**7. Backend — `supabase/functions/create-upsell-billing/index.ts`**
- `price_paid` e `transactionAmount`: 25.00

**8. `index.html`**
- Atualizar JSON-LD structured data de 29.90 para 39.90

