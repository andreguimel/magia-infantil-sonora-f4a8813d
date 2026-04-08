

## Plano: Layout de coluna única no Preview

### O que muda
Transformar o layout de 2 colunas (`grid lg:grid-cols-2`) no estado "preview" para **1 coluna**, colocando todo o conteúdo de pagamento (timer, benefícios, planos, CTA) logo abaixo da letra.

### Alterações em `src/pages/Preview.tsx`

**1. Remover grid de 2 colunas (linha ~681)**
- Trocar `<div className="grid lg:grid-cols-2 gap-8">` por `<div className="max-w-2xl mx-auto space-y-6">`

**2. Reordenar o conteúdo em sequência vertical**
A ordem ficará:
1. Letra da música (card editável)
2. Card motivacional ("imagine essa letra ganhando vida...")
3. Timer de urgência
4. Benefícios ("Ao comprar você recebe")
5. Seleção de plano
6. CTA com social proof + botão de compra

**3. Remover wrappers de coluna**
- Eliminar os `<motion.div>` que separavam left/right columns
- Manter as animações mas sem `delay: 0.4` na segunda metade (tudo aparece junto)

### Resultado
Experiência de scroll natural: o usuário lê a letra → rola para baixo → vê o CTA e paga. Funciona melhor em mobile e desktop, sem conteúdo "escondido" ao lado.

