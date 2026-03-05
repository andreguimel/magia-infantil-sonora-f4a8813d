

# Botao de Reengajamento para Clientes com Musica Completa

## Objetivo
Adicionar um botao no modal de detalhes do pedido (admin) para enviar email de reengajamento a clientes que ja receberam sua musica, oferecendo 50% de desconto para criar uma nova.

## Mudancas

### 1. Nova Edge Function: `send-reengagement-email`
Criar `supabase/functions/send-reengagement-email/index.ts` baseada na estrutura existente do `send-recovery-email`:
- Verificacao de token admin (mesmo padrao HMAC)
- Recebe `email` e `childName` no body
- Envia email via Brevo com template diferente: tom positivo de quem ja comprou, mencionando o nome da crianca, convidando a criar outra musica com cupom **VOLTEI50** (50% de desconto)
- Link direciona para `/criar?coupon=VOLTEI50`
- Assunto: "Crie mais uma musica magica para [nome]! 50% OFF"

### 2. Atualizar OrderDetailModal
Em `src/components/admin/OrderDetailModal.tsx`:
- Adicionar novo botao "Enviar Email de Reengajamento" visivel apenas quando `payment_status === "paid"` e `status === "completed"` e `user_email` existe
- Estilo diferenciado (cor roxa/accent) para distinguir do botao de recuperacao existente
- Handler chama a nova Edge Function com o token admin

### 3. Suporte ao cupom VOLTEI50 na pagina de pagamento
Verificar se a pagina de pagamento (`Payment.tsx`) ja suporta cupons via URL genericamente. Se sim, apenas garantir que VOLTEI50 aplique 50%. Se nao, adicionar suporte.

## Detalhes Tecnicos

**Arquivos modificados:**
- `supabase/functions/send-reengagement-email/index.ts` (novo)
- `src/components/admin/OrderDetailModal.tsx` (novo botao)
- `src/pages/Payment.tsx` (suporte ao cupom VOLTEI50 se necessario)

**Cupom:** VOLTEI50 com 50% de desconto, aplicado via parametro `?coupon=VOLTEI50` na URL

