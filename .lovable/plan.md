

# Sistema de Links de Rastreamento (Affiliate/UTM Tracking)

## Objetivo
Permitir que o admin crie links personalizados para influenciadores/parceiros e rastreie quais vendas vieram de cada link.

## Como funciona

1. O admin cria um "link de rastreamento" no painel (ex: `musicamagica.com.br/?ref=joao`).
2. Quando um visitante acessa o site por esse link, o parâmetro `ref` é salvo no `localStorage`.
3. O `ref` é enviado junto com o pedido na criação da billing e salvo na tabela `music_tasks`.
4. No painel admin, aparece uma nova aba/seção mostrando métricas por referência (quantos cliques, quantos pagaram, receita estimada).

## Mudancas

### 1. Migração de banco de dados
Adicionar duas colunas na tabela `music_tasks`:
- `ref_code TEXT` — código do influenciador/parceiro
- Criar nova tabela `tracking_links` para o admin gerenciar os links:

```text
tracking_links
├── id (uuid, PK)
├── code (text, unique) — ex: "joao", "maria"
├── label (text) — nome de exibição, ex: "João Influencer"
├── created_at (timestamptz)
```

RLS: deny all (acesso via service_role nas edge functions, igual music_tasks).

### 2. Frontend — Captura do `ref` (Index.tsx / App.tsx)
- Na landing page, ler `?ref=CODIGO` da URL e salvar em `localStorage` como `ref_code`.
- Persistir para que funcione mesmo se o usuário navegar entre páginas antes de comprar.

### 3. Frontend — Enviar `ref` no checkout (Payment.tsx + musicPipeline.ts)
- Ler `ref_code` do `localStorage` e enviá-lo na chamada `createBilling`.

### 4. Edge Function — Salvar `ref` (create-billing/index.ts)
- Receber `refCode` no body e salvar na coluna `ref_code` da `music_tasks`.

### 5. Edge Function — CRUD de links (admin-dashboard/index.ts)
- GET: retornar lista de `tracking_links` + métricas agregadas (total de tasks, pagos, receita por `ref_code`).
- POST: criar novo link de rastreamento.
- DELETE: remover link.

### 6. Painel Admin — Seção de Links (AdminDashboard.tsx)
- Nova aba "Links de Rastreamento" com:
  - Botão para criar novo link (código + label).
  - Tabela mostrando: código, label, total de acessos (tasks criadas), pagamentos confirmados, receita estimada, botão para copiar URL.
  - Coluna `ref_code` visível na tabela de pedidos existente para filtrar por influenciador.

## Arquivos modificados
- `supabase/functions/create-billing/index.ts` — receber e salvar `refCode`
- `supabase/functions/admin-dashboard/index.ts` — CRUD tracking_links + métricas por ref
- `src/services/musicPipeline.ts` — passar `refCode` para createBilling
- `src/pages/Payment.tsx` — ler ref do localStorage
- `src/pages/Index.tsx` ou `src/App.tsx` — capturar `?ref=` e salvar no localStorage
- `src/pages/AdminDashboard.tsx` — nova seção de links de rastreamento

## Arquivos novos
- Migração SQL (via ferramenta de migração)

