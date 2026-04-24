# Aba "GALERA" — feed das últimas avaliações

**Data:** 2026-04-24
**Contexto:** tracker de Comida di Buteco MOC 2026

## Objetivo

Adicionar uma nova aba à barra de filtros que, ao invés de filtrar a lista de botecos, mostra um feed cronológico de todas as avaliações já feitas por qualquer usuário — um "o que a galera tá comendo" dentro do próprio app.

## Decisões tomadas no brainstorming

1. **Escopo do feed:** avaliações de **todos os usuários**, não só do usuário logado. O objetivo é social/competitivo, não histórico pessoal.
2. **Posicionamento da aba:** substitui o botão "TODOS" na barra de filtros existente. Mantém `grid-cols-4`, preservando legibilidade no mobile (foco do app). "TODOS" é redundante com FALTAM + JÁ FUI.
3. **Conteúdo de cada item:** foto do prato + nome da pessoa + nota (estrelas) + prato/boteco + tempo relativo + observação truncada em 2 linhas (quando existir).
4. **Volume:** todas as avaliações, sem paginação. Volume máximo estimado (~5 amigos × 20 botecos = 100 linhas) é baixo o suficiente pra não precisar.
5. **Interação:** clicar num item **não faz nada** — o feed é read-only. Pra avaliar, o usuário usa as abas FALTAM / JÁ FUI.

## Mudanças na UI

### Barra de filtros ([index.html:164](../../../index.html#L164))

O botão atual de TODOS:

```html
<button @click="filtro = 'todos'" ...>
  TODOS <span class="opacity-70">({{ stats.total }})</span>
</button>
```

Vira:

```html
<button @click="selecionarGalera" ...>
  GALERA
</button>
```

- Sem contador ao lado do label (o número de avaliações não é uma stat pessoal — ao contrário de FALTAM/JÁ FUI que contam o estado do próprio usuário).
- Handler dedicado `selecionarGalera` pra disparar `carregarFeed()` na hora do clique e manter `filtro.value = 'galera'`.
- Mesmo estilo visual (estados ativo/inativo idênticos aos outros botões).

### Renderização condicional ([index.html:207](../../../index.html#L207))

Hoje o app renderiza a lista de botecos em todas as abas (via o computed `lista`). Adicionar um ramo antes do `v-if="lista.length === 0"`:

```
v-if  filtro === 'galera'  →  renderiza <FeedGalera />  (inline, não é componente separado)
v-else-if  lista.length === 0  →  empty state atual
v-else  →  lista de botecos atual
```

### Item do feed (layout compacto)

```
┌─────────────────────────────────────────┐
│ [thumb] Vinicius  ★★★★★                │
│  80×80  Balança no Vento                │
│         Sertãozinho · há 2 h            │
│         "cerveja gelada e o bolinho..." │
└─────────────────────────────────────────┘
```

- Container: mesmo estilo paper dos cards atuais (`bg-[#fffaee]`, borda preta, shadow offset) — mas **não é `<button>`** (é `<div>`), já que o item não é clicável. Sem hover shift.
- Thumb: `w-20 h-20` (80px), `object-cover`, fallback igual ao card atual (`@error="$event.target.style.display='none'"`).
- Linha 1: nome da pessoa em `font-display` pequeno + 5 estrelas do mesmo SVG/estilo do card da lista, tamanho reduzido (`w-3.5 h-3.5`).
- Linha 2: prato em `font-handwritten` vermelho (`#c83c1f`), boteco em texto escuro menor.
- Linha 3: tempo relativo em `font-display` bem pequeno (`text-[10px] tracking-widest`), cor neutra (`#8b6f47`).
- Linha 4: obs em `font-handwritten`, entre aspas, `line-clamp-2`. Omitida se `obs` vazia.

### Estado vazio

Se o feed carregar com zero itens: reaproveita o visual do empty state atual (borda tracejada, ícone), texto: _"ninguém avaliou nada ainda. bora começar a correria?"_

### Erro e carregando

- **Carregando:** spinner centralizado, mesmo SVG usado no splash/login.
- **Erro:** mensagem discreta em `font-handwritten` vermelho, mesmo padrão de `erroLocal` e `erroLogin`. Botão "tentar de novo" que re-chama `carregarFeed()`.

## Mudanças no código ([app.js](../../../app.js))

### Novo estado

```js
const feedAvaliacoes = ref([]);     // lista crua vinda do Supabase
const carregandoFeed = ref(false);
const erroFeed = ref('');
```

### Índice de pratos (pra resolver `prato_id` em O(1))

Criar uma vez no setup:

```js
const dishById = new Map(dishes.map(d => [d.id, d]));
```

### Helper de tempo relativo

```js
function formatarTempoRelativo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  // > 7 dias: mostra dd/mm
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

### Carregar o feed

```js
async function carregarFeed() {
  carregandoFeed.value = true;
  erroFeed.value = '';
  try {
    const { data, error } = await sb
      .from('avaliacoes')
      .select('telefone, prato_id, nota, obs, atualizado_em, usuarios(nome)')
      .order('atualizado_em', { ascending: false });
    if (error) throw error;
    feedAvaliacoes.value = data || [];
  } catch (e) {
    console.error('carregarFeed', e);
    erroFeed.value = 'Deu ruim ao carregar. Tenta de novo.';
  } finally {
    carregandoFeed.value = false;
  }
}
```

### Handler do botão

```js
function selecionarGalera() {
  filtro.value = 'galera';
  carregarFeed();  // refetch a cada clique, pra pegar novidades
}
```

### Enriquecimento pra template

Em vez de fazer lookup dentro do template (ruim pra performance e legibilidade), um computed resolve os dados:

```js
const feedEnriquecido = computed(() =>
  feedAvaliacoes.value.map(a => {
    const d = dishById.get(a.prato_id);
    return {
      ...a,
      nome: a.usuarios?.nome || 'alguém',
      prato: d?.prato || '',
      boteco: d?.boteco || '',
      foto: d?.foto || '',
      tempoRel: formatarTempoRelativo(a.atualizado_em),
    };
  })
);
```

O `|| 'alguém'` cobre o caso defensivo de um telefone sem `usuarios` associado (FK garante que não acontece, mas Supabase pode devolver `null` no embed em alguns casos).

### Exports do `setup()`

Adicionar ao return: `feedEnriquecido`, `carregandoFeed`, `erroFeed`, `carregarFeed`, `selecionarGalera`.

## O que NÃO entra neste escopo (YAGNI)

- Sem subscriptions realtime do Supabase (refetch no clique da aba já dá conta).
- Sem paginação / infinite scroll.
- Sem filtros secundários dentro do feed (por pessoa, por nota, etc).
- Sem ação ao clicar num item (read-only, conforme decidido).
- Sem alteração no `schema.sql` — FK e campos necessários já existem.
- Sem edição da RLS — acesso anon já permite a query.

## Impacto em outros fluxos

- Usuário que clicava em TODOS perde esse atalho. Mitigação: FALTAM + JÁ FUI em conjunto cobrem todos os 20 botecos. O caso de uso real de "ver todos misturados" raramente aparece num tracker pessoal.
- Ratings do usuário logado podem aparecer no feed (é o comportamento esperado — ele vê as próprias + as dos outros). Não precisa filtrar.

## Critérios de sucesso

- Clicar em GALERA troca o conteúdo da lista pelo feed sem afetar as outras abas.
- Cada item mostra nome, prato, boteco, nota (estrelas), foto, tempo relativo, e obs (quando existir).
- Feed ordena por `atualizado_em` descendente.
- Estados de carregando, vazio e erro são renderizados corretamente.
- Não quebra nenhuma das abas existentes.
- Tempo relativo é em pt-BR e cobre os casos: <1 min, <1 h, <24 h, 1 dia, 2–6 dias, >7 dias.
