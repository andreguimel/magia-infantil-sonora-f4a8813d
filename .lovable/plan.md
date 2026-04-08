

## Plano: Adicionar campo de telefone no checkout

### Alterações

**1. `src/pages/Preview.tsx`**
- Adicionar state `parentPhone` 
- Adicionar campo de input com ícone `Phone` entre Email e CPF
- Formatação automática de telefone `(XX) XXXXX-XXXX`
- Enviar `parentPhone` no `createBilling`

**2. `src/services/musicPipeline.ts`**
- Expandir `customerData` para incluir `phone?: string`
- Enviar `customerPhone` no body do `create-billing`

**3. `supabase/functions/create-billing/index.ts`**
- Ler `customerPhone` do body
- Salvar no campo `user_phone` da tabela `music_tasks` (coluna já existe)

### Resultado
O telefone é capturado no checkout e salvo no banco, disponível no painel admin para contato com o cliente.

