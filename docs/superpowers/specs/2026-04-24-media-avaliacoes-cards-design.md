# Média de avaliações nos cards

**Data:** 2026-04-24
**Contexto:** tracker de Comida di Buteco MOC 2026

## Objetivo

Mostrar a média geral de notas (com contagem) no canto superior direito de cada card de boteco, estilo `4.5 ⭐ (3)`. A média é calculada considerando as avaliações de todos os usuários do app.

## Decisões do brainstorming

1. **Cálculo:** inclui todos os usuários (inclusive o próprio). Média simples de `nota`.
2. **Exibição:** sempre que houver pelo menos 1 avaliação. Se nenhum usuário avaliou aquele prato, o selo de média não aparece.
3. **Formato:** `X.Y ⭐ (N)` — 1 casa decimal fixa, ícone de estrela amarela, contagem entre parênteses. Sempre 1 decimal pra evitar jumpy-look (`4.0` em vez de `4`).
4. **Atualização:** só no carregamento da página (sem realtime, sem refetch após nova avaliação nesta sessão).
5. **Layout — stack no canto superior direito:**
   - Card que você **não avaliou** → só o selo da média.
   - Card que você **já avaliou** → selo da média em cima, selo "JÁ FUI" embaixo (empilhados verticalmente).
6. **Agregação:** client-side em JS. Query puxa todas as linhas de `avaliacoes` (colunas `prato_id, nota`), agrupa e calcula no navegador. Zero mudança no schema.
7. **Quando carregar:** no mount, sem depender de login. Query corre em paralelo com o resto.

## Estado atual relevante

Os cards são renderizados em [index.html:269-329](../../../index.html#L269) (dentro do bloco `v-if="filtro !== 'galera'"`). Cada `<button>` tem dois elementos posicionados absolutamente no canto:

- **JÁ FUI** — `absolute top-3 right-3`, `bg-[#2d4a1f]`, `-rotate-6`, só quando `ratings[d.id]` é verdade.
- **Distância** — `absolute bottom-3 right-3`, `bg-[#f4b942]`, `rotate-3`, só quando `d._dist != null` (filtro PERTO ativo).

O `app.js` já tem `carregarRatings` rodando no mount (carrega só as avaliações do usuário logado). Vamos adicionar `carregarAgregados` que carrega todas.

## Mudanças

### Dados (app.js)

**Novo estado em `setup()`:**

```js
const agregadosAvaliacoes = ref([]); // array bruto de { prato_id, nota }
```

**Nova função após `carregarRatings`:**

```js
async function carregarAgregados() {
  const { data, error } = await sb
    .from('avaliacoes')
    .select('prato_id, nota');
  if (error) {
    console.error('carregarAgregados', error);
    return;
  }
  agregadosAvaliacoes.value = data || [];
}
```

Falha silenciosa (só log) — se a query não rolar, os cards só não mostram média. Graceful degradation.

**Novo computed após `feedEnriquecido`:**

```js
const mediasPorPrato = computed(() => {
  const acc = new Map();
  for (const a of agregadosAvaliacoes.value) {
    const cur = acc.get(a.prato_id) || { soma: 0, contagem: 0 };
    cur.soma += a.nota;
    cur.contagem += 1;
    acc.set(a.prato_id, cur);
  }
  const saida = new Map();
  for (const [id, { soma, contagem }] of acc) {
    saida.set(id, { media: soma / contagem, contagem });
  }
  return saida;
});
```

`Map` pra lookup O(1) no template. Duas passadas por clareza (agregação primeiro, depois cálculo final).

**Expor no return:**

```js
// state
agregadosAvaliacoes,
// computed
mediasPorPrato,
```

**Mount:** chamar `carregarAgregados()` logo na entrada do `onMounted`, fire-and-forget (sem `await`). A query independe de login — pode (e deve) rodar imediatamente. Quando a resposta chega, o computed `mediasPorPrato` reage e os cards preenchem os selos. Como a query é pequena (~100 linhas), o "pop-in" é imperceptível na prática. Sem necessidade de chamar de novo em `handleLogin` porque o mount já disparou antes da renderização dos cards.

```js
// dentro do onMounted, primeira linha:
carregarAgregados();
```

### UI (index.html)

**Card — substituir o bloco JÁ FUI por um container vertical:**

Localizar em [index.html:274-280](../../../index.html#L274) o bloco:

```html
<div v-if="ratings[d.id]" class="absolute top-3 right-3 z-10 bg-[#2d4a1f] text-[#f4ead5] px-3 py-1 -rotate-6 shadow-md">
  <div class="flex items-center gap-1">
    <svg ... checkmark ... />
    <span class="font-display text-[10px] tracking-widest">JÁ FUI</span>
  </div>
</div>
```

Substituir por um wrapper flex-column que abriga os dois selos (média + JÁ FUI):

```html
<div class="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
  <!-- Selo da média -->
  <div v-if="mediasPorPrato.get(d.id)" class="bg-[#fffaee] border-2 border-[#1a1410] px-2 py-1 shadow-[2px_2px_0_#1a1410] flex items-center gap-1">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f4b942" stroke="#c4901f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
    <span class="font-display text-xs text-[#1a1410]">{{ mediasPorPrato.get(d.id).media.toFixed(1) }}</span>
    <span class="font-display text-[10px] text-[#8b6f47]">({{ mediasPorPrato.get(d.id).contagem }})</span>
  </div>
  <!-- Selo JÁ FUI (só quando o usuário avaliou) -->
  <div v-if="ratings[d.id]" class="bg-[#2d4a1f] text-[#f4ead5] px-3 py-1 -rotate-6 shadow-md">
    <div class="flex items-center gap-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span class="font-display text-[10px] tracking-widest">JÁ FUI</span>
    </div>
  </div>
</div>
```

Regras do layout:
- Wrapper usa `flex flex-col items-end gap-1.5` — alinha os dois selos à direita, espaço pequeno entre eles.
- Selo da média: estilo paper (cream, borda preta, mini shadow tipo sticker), com estrela amarela, número em `font-display`, contagem menor cinza.
- Selo JÁ FUI: mantém o visual atual (verde, rotacionado), só herda a posição do wrapper em vez de se posicionar sozinho.

### Selo da média — detalhes visuais

- **Background:** `#fffaee` (cream paper) + `border-2 border-[#1a1410]` (borda preta grossa).
- **Shadow:** `shadow-[2px_2px_0_#1a1410]` — mini shadow offset igual ao dos cards, pra parecer um "sticker" colado no canto.
- **Padding:** `px-2 py-1` — compacto.
- **Estrela:** SVG igual ao das estrelas do card, mas 12×12px em vez de 16.
- **Número e contagem:** `font-display` (Bungee), tamanhos `text-xs` e `text-[10px]`, cores contrastantes (preto pro número, marrom pra contagem).
- **Sem rotação** no selo da média — o JÁ FUI embaixo é que tem a `-rotate-6`, dá o contraste visual.

## O que NÃO entra (YAGNI)

- Sem RPC/view no Supabase — aggregation é client-side.
- Sem recálculo em tempo real quando o usuário avalia algo novo nesta sessão. A média reflete o snapshot do mount; só vai atualizar no próximo reload. (Decisão explícita do usuário.)
- Sem loading state dedicado pro selo da média — enquanto carrega, o card renderiza sem o selo. Aparece "de repente" quando a query volta. Em 100 linhas a query é quase instantânea.
- Sem filtrar ou ordenar por média. (Vem depois se fizer sentido.)

## Impacto em outros fluxos

- **GALERA:** não afeta. Continua carregando seu próprio feed com `carregarFeed()`.
- **PERTO:** selo de distância fica no canto inferior direito, não colide.
- **Modal de avaliação:** sem mudanças.
- **Login:** ao logar, `carregarAgregados` roda em paralelo com `carregarRatings`. Adiciona uns poucos ms à latência total do login em redes lentas (uma query a mais em paralelo).

## Critérios de sucesso

- Cada card exibe `X.Y ⭐ (N)` no canto superior direito quando existe pelo menos 1 avaliação para aquele prato.
- Quando o usuário já avaliou, o selo "JÁ FUI" aparece empilhado logo abaixo.
- Card sem nenhuma avaliação no banco → sem selo de média (sem fallback "0.0" ou "—").
- A média é sempre exibida com 1 casa decimal.
- Se a query `carregarAgregados` falhar, os cards renderizam sem o selo (degradação limpa).
- Nenhum dos filtros (FALTAM / JÁ FUI / PERTO / GALERA) é afetado.
