

## Plano: Unificar Preview + Pagamento na mesma tela

### Problema atual
O fluxo tem 3 etapas com navegação entre páginas: `/criar` → `/preview` → `/pagamento`. A transição preview→pagamento é um ponto de abandono.

### Solução
Mesclar a página `/preview` com o formulário de pagamento, eliminando a navegação para `/pagamento`. O usuário verá a letra à esquerda e o formulário de pagamento completo à direita, tudo numa única tela.

### Layout da nova página `/preview`

```text
┌─────────────────────────────────────────────────┐
│  ← Voltar    Prévia da sua música! 🎵           │
├────────────────────┬────────────────────────────┤
│                    │  🎶✨ Imagine essa letra    │
│   LETRA DA MÚSICA  │  ganhando vida!            │
│   (editável)       │                            │
│                    │  ✅ MP3 completo            │
│                    │  ✅ PDF com letra           │
│                    │  ✅ Download instantâneo    │
│                    │                            │
│                    │  Escolha o plano:           │
│                    │  [Música Mágica R$9,90]     │
│                    │  [Pacote Encantado R$24,90] │
│                    │                            │
│                    │  Nome completo *            │
│                    │  Email *  (pré-preenchido)  │
│                    │  CPF *                      │
│                    │  ☐ Aceito os termos         │
│                    │                            │
│                    │  [💳 PAGAR VIA PIX]         │
│                    │                            │
│                    │  ── ou após pagar ──        │
│                    │  [QR Code Pix]              │
│                    │  [Gerando música...]        │
│                    │  [🎵 Download pronto!]      │
└────────────────────┴────────────────────────────┘
```

### Alterações

**1. `src/pages/Preview.tsx` — Refatoração completa**
- Mover toda a lógica de pagamento de `Payment.tsx` para dentro de `Preview.tsx`
- O lado esquerdo mantém a letra editável (como está hoje)
- O lado direito terá: frase chamativa → benefícios → seleção de plano → formulário de dados (nome, email pré-preenchido, CPF, termos) → botão de pagamento
- Após pagamento: exibir QR code Pix, polling de status, tela de geração e tela de conclusão com downloads — tudo inline no lado direito
- Suportar cupons de desconto (URL param e localStorage), admin bypass, e lógica de pacote

**2. `src/pages/Payment.tsx` — Redirect**
- Transformar em redirect simples para `/preview` (para URLs compartilhadas ou bookmarks antigos)
- Manter compatibilidade com `?coupon=`, `?admin=`, `?paid=true` passando os params

**3. `src/App.tsx`**
- Manter a rota `/pagamento` apontando para o Payment.tsx (que agora é só redirect)

**4. Nenhuma alteração no backend**
- Edge functions permanecem iguais
- `musicPipeline.ts` permanece igual

### Benefícios
- Elimina 1 clique/navegação do funil (menos abandono)
- Email já pré-preenchido da página `/criar`
- Experiência mais fluida: ver letra → pagar → receber música sem sair da página

