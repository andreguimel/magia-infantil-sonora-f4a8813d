

## Plano: Ferramenta de Email Marketing no Painel Admin

### O que será criado
Uma nova aba "Email Marketing" no painel admin onde o administrador pode:
- Ver todos os contatos (emails) dos pedidos
- Filtrar contatos por status de pagamento (todos, pagos, pendentes, abandonados)
- Selecionar contatos individualmente ou todos de uma vez
- Escolher entre modelos de mensagem pré-definidos (Recuperação com cupom 50%, Reengajamento, Promoção personalizada)
- Editar o assunto e corpo do email antes de enviar
- Enviar para os contatos selecionados via Brevo

### Alterações

**1. Edge Function — `send-bulk-email/index.ts` (nova)**
- Recebe lista de emails, assunto e conteúdo HTML
- Valida token admin (mesmo padrão das outras funções)
- Envia via Brevo API para cada destinatário
- Sanitiza conteúdo para segurança

**2. Frontend — `src/components/admin/EmailMarketing.tsx` (novo componente)**
- Extrai contatos únicos (com email) dos pedidos já carregados
- Filtros: status de pagamento, busca por nome/email
- Checkboxes para seleção individual + "selecionar todos"
- 3 modelos de mensagem pré-prontos:
  - **Recuperação**: cupom RESGATE50 para abandonos
  - **Reengajamento**: cupom VOLTEI50 para clientes que já compraram
  - **Personalizado**: assunto e corpo editáveis
- Textarea para editar o corpo antes de enviar
- Botão "Enviar para X selecionados" com confirmação
- Contador de emails enviados/erros

**3. Frontend — `src/pages/AdminDashboard.tsx`**
- Adicionar nova aba "Email Marketing" no TabsList
- Importar e renderizar o componente EmailMarketing passando os pedidos como prop

### Modelos de mensagem
```text
1. Recuperação (Carrinho Abandonado)
   Assunto: 🎵 {nome} ainda está esperando! 50% OFF
   Corpo: Template com cupom RESGATE50

2. Reengajamento (Cliente Existente)
   Assunto: 🎶 Crie outra música para {nome}! 50% OFF
   Corpo: Template com cupom VOLTEI50

3. Personalizado
   Assunto: [editável]
   Corpo: [editável]
```

### Detalhes técnicos
- Os contatos são derivados dos pedidos já carregados (sem nova query)
- Emails duplicados são agrupados (mostra o pedido mais recente)
- Envio sequencial com delay de 200ms entre emails para respeitar rate limits do Brevo
- O componente EmailMarketing recebe `orders: Order[]` como prop

