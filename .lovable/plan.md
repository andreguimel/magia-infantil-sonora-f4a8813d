

## Plano: Adicionar campos de Email e WhatsApp na página Criar Música

### Contexto
O usuário quer capturar email e telefone diretamente na página `/criar` (CreateMusic) para ter contatos de marketing mesmo sem compra. A screenshot mostra o formulário atual — os campos serão inseridos nele.

### Alterações

**1. Frontend — `src/pages/CreateMusic.tsx`**
- Adicionar campo **Email do responsável** (obrigatório) logo após "Nome da criança", com ícone de email e validação de formato
- Adicionar campo **WhatsApp** (opcional) após o email, com máscara `(XX) XXXXX-XXXX`
- Atualizar interface `FormData` para incluir `userEmail` (já existe mas não é renderizado) e `userPhone`
- Salvar email/phone no `localStorage` junto com `musicResult` para pré-preencher Payment

**2. Frontend — `src/pages/Payment.tsx`**
- Pré-preencher o campo `parentEmail` com o email vindo do `musicResult` no localStorage
- Remover ou tornar opcional a coleta duplicada de email

**3. Backend — `src/services/musicPipeline.ts`**
- Enviar `userPhone` nas chamadas `generateLyricsOnly` e `saveCustomLyrics`

**4. Edge Functions — `generate-lyrics-only` e `save-custom-lyrics`**
- Receber e salvar `userPhone` na tabela `music_tasks`

**5. Migração SQL**
- `ALTER TABLE music_tasks ADD COLUMN user_phone text;`

### Posicionamento no formulário
```text
Nome da criança *
Email do responsável *    ← NOVO
WhatsApp (opcional)       ← NOVO
Faixa etária *
A música é para: *
...resto do formulário
```

