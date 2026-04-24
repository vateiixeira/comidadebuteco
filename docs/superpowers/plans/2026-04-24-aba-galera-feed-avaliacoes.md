# Aba GALERA — Feed de Avaliações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a aba "TODOS" por "GALERA", que mostra um feed cronológico de todas as avaliações feitas por todos os usuários do app.

**Architecture:** App Vue 3 sem build (CDN). Adiciona estado novo (`feedAvaliacoes`, `carregandoFeed`, `erroFeed`) + duas funções (`carregarFeed`, `selecionarGalera`) + um computed (`feedEnriquecido`) em `app.js`. Em `index.html` troca o botão TODOS por GALERA e adiciona um ramo de renderização condicional (`v-if="filtro === 'galera'"`) que mostra o feed no lugar da lista de botecos.

**Tech Stack:** Vue 3 (CDN), Tailwind (CDN), Supabase JS v2 (CDN). Sem bundler, sem test runner — verificação é manual no browser.

**Spec:** [docs/superpowers/specs/2026-04-24-aba-galera-feed-avaliacoes-design.md](../specs/2026-04-24-aba-galera-feed-avaliacoes-design.md)

## Nota sobre "testes"

O projeto não tem test suite (CLAUDE.md: "no install, no test suite, no lint config"). Cada tarefa traz passos de **verificação manual no browser**: "abra tal página, clique em tal botão, confirme que vê tal resultado". Isso ocupa o papel dos `pytest` do TDD tradicional.

Para rodar localmente: `python -m http.server 8000` na raiz do repo, depois abra `http://localhost:8000`. Ou abra `index.html` direto no browser.

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| [app.js](../../../app.js) | Modificar | Estado, computeds, ações do feed |
| [index.html](../../../index.html) | Modificar | Swap do botão + renderização do feed |
| [dishes.js](../../../dishes.js) | Não muda | — |
| [config.js](../../../config.js) | Não muda | — |
| [schema.sql](../../../schema.sql) | Não muda | FK e RLS já suportam a query |

---

## Task 1: Trocar botão TODOS por GALERA

Mudança puramente visual no botão. O valor `'galera'` não é tratado por `lista` (computed em [app.js:75-85](../../../app.js#L75-L85)), então cai no `return dishes` — clicar em GALERA mostrará todos os 20 botecos, igual TODOS fazia. Fallback visual aceitável enquanto o feed não existe.

**Files:**
- Modify: `index.html` (botão TODOS, atualmente em linhas 194-200)

- [ ] **Step 1: Verificar estado atual no browser**

Rode `python -m http.server 8000` na raiz do repo (ou abra `index.html` direto). Faça login. Você deve ver 4 botões de filtro: `FALTAM (N) | JÁ FUI (N) | PERTO | TODOS (20)`. Clicar em TODOS mostra todos os 20 botecos.

- [ ] **Step 2: Substituir o botão TODOS**

Em [index.html:194-200](../../../index.html#L194-L200), substitua:

```html
<button
  @click="filtro = 'todos'"
  :class="filtro === 'todos' ? 'bg-[#1a1410] text-[#f4b942] shadow-[3px_3px_0_#c83c1f]' : 'bg-[#fffaee] text-[#1a1410] hover:bg-[#f4b942]'"
  class="py-2 px-1 font-display text-[10px] sm:text-[11px] tracking-widest border-2 border-[#1a1410] transition-all"
>
  TODOS <span class="opacity-70">({{ stats.total }})</span>
</button>
```

Por:

```html
<button
  @click="filtro = 'galera'"
  :class="filtro === 'galera' ? 'bg-[#1a1410] text-[#f4b942] shadow-[3px_3px_0_#c83c1f]' : 'bg-[#fffaee] text-[#1a1410] hover:bg-[#f4b942]'"
  class="py-2 px-1 font-display text-[10px] sm:text-[11px] tracking-widest border-2 border-[#1a1410] transition-all"
>
  GALERA
</button>
```

Note: contador `({{ stats.total }})` foi removido (conforme spec — GALERA não é uma stat pessoal).

- [ ] **Step 3: Verificar**

Recarregue o browser. O 4º botão agora mostra "GALERA" (sem número). Clicar em GALERA:
- Estiliza o botão como ativo (fundo preto, texto amarelo, sombra vermelha).
- Mostra todos os 20 botecos (fallback do computed `lista` — será substituído na Task 4).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "ui - botao galera substitui todos nos filtros"
```

---

## Task 2: Adicionar helpers `formatarTempoRelativo` e `dishById`

Helpers puros, sem efeito visível ainda. Serão consumidos pelo computed em Task 4.

**Files:**
- Modify: `app.js` (adicionar função após `formatarDistancia` em [app.js:34-38](../../../app.js#L34-L38), adicionar `dishById` dentro do `setup()` após [app.js:43](../../../app.js#L43))

- [ ] **Step 1: Adicionar `formatarTempoRelativo` no escopo do módulo**

Depois da função `formatarDistancia` ([app.js:38](../../../app.js#L38)), adicione:

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
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Adicionar `dishById` dentro do `setup()`**

Dentro do `setup()`, logo após a linha `const dishes = window.CDB_DISHES;` ([app.js:43](../../../app.js#L43)), adicione:

```js
    const dishById = new Map(dishes.map(d => [d.id, d]));
```

(Indentação: 4 espaços, igual ao resto do setup.)

- [ ] **Step 3: Verificar que o parse não quebrou**

Recarregue o browser com DevTools aberto. Console deve estar limpo (sem `SyntaxError` nem `ReferenceError`). O app deve funcionar exatamente como antes (login, abrir modal, etc).

Verificação adicional (opcional) — cole no console:

```js
// Espera: "agora há pouco"
(function(){ const f = (iso) => { const ms = Date.now() - new Date(iso).getTime(); const min = Math.floor(ms/60000); if (min<1) return 'agora há pouco'; if (min<60) return `há ${min} min`; const h = Math.floor(min/60); if (h<24) return `há ${h} h`; const dias = Math.floor(h/24); if (dias===1) return 'ontem'; if (dias<7) return `há ${dias} dias`; const d=new Date(iso); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }; console.log(f(new Date().toISOString())); console.log(f(new Date(Date.now()-3600000).toISOString())); console.log(f(new Date(Date.now()-86400000).toISOString())); })();
```

Saída esperada: `agora há pouco`, `há 1 h`, `ontem`.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "ui - helpers para feed da galera (tempo relativo e indice de pratos)"
```

---

## Task 3: Adicionar estado e ações do feed

Adiciona `feedAvaliacoes`, `carregandoFeed`, `erroFeed`, `carregarFeed()`, `selecionarGalera()`. Ainda sem UI — vai dar pra ver a query rodando via Network tab.

**Files:**
- Modify: `app.js` (estado após [app.js:62](../../../app.js#L62), funções após `selecionarPerto` que termina em [app.js:130](../../../app.js#L130), return no final)
- Modify: `index.html` (handler do botão GALERA)

- [ ] **Step 1: Adicionar estado do feed**

Dentro do `setup()`, depois da linha `const erroLocal = ref('');` ([app.js:62](../../../app.js#L62)), adicione:

```js
    const feedAvaliacoes = ref([]);
    const carregandoFeed = ref(false);
    const erroFeed = ref('');
```

- [ ] **Step 2: Adicionar `carregarFeed` e `selecionarGalera`**

Depois da função `selecionarPerto` (que termina em [app.js:130](../../../app.js#L130), fechando com `}`), adicione:

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

    function selecionarGalera() {
      filtro.value = 'galera';
      carregarFeed();
    }
```

- [ ] **Step 3: Expor no `return` do setup**

No bloco `return { ... }` no final do setup (atualmente em [app.js:294-308](../../../app.js#L294-L308)), adicione às linhas correspondentes:

Na seção `// state`, adicione:
```js
      feedAvaliacoes, carregandoFeed, erroFeed,
```

Na seção `// actions`, adicione:
```js
      carregarFeed, selecionarGalera,
```

(Não precisa ordem específica — só adicionar antes do `}` que fecha o return.)

- [ ] **Step 4: Atualizar o handler do botão GALERA**

Em [index.html](../../../index.html), no botão GALERA (o que você editou na Task 1), troque:

```html
@click="filtro = 'galera'"
```

Por:

```html
@click="selecionarGalera"
```

- [ ] **Step 5: Verificar a query**

Recarregue. Abra DevTools → aba Network → filtre por `avaliacoes`. Clique em GALERA. Deve aparecer uma request GET para:

```
{SUPABASE_URL}/rest/v1/avaliacoes?select=telefone,prato_id,nota,obs,atualizado_em,usuarios(nome)&order=atualizado_em.desc
```

Status: `200 OK`. Response: JSON array. Se você (ou algum amigo) já tem avaliação salva, cada item deve ter o shape:

```json
{
  "telefone": "31999999999",
  "prato_id": "balanca-vento",
  "nota": 5,
  "obs": "...",
  "atualizado_em": "2026-04-24T...",
  "usuarios": { "nome": "Vinicius" }
}
```

A UI ainda mostra a lista de botecos (porque `lista` cai no fallback `return dishes`) — isso é esperado. O feed será renderizado na Task 4.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html
git commit -m "feat - estado e query do feed da galera"
```

---

## Task 4: Renderizar o feed (template + computed)

Adiciona o computed `feedEnriquecido` e substitui a lista de botecos pelo feed quando `filtro === 'galera'`.

**Files:**
- Modify: `app.js` (computed após o `lista` em [app.js:75-85](../../../app.js#L75-L85), expor no return)
- Modify: `index.html` (envolver a lista atual num `v-else`, adicionar novo bloco `v-if="filtro === 'galera'"` antes)

- [ ] **Step 1: Adicionar `feedEnriquecido` computed**

Dentro do setup, depois do computed `lista` (que termina em [app.js:85](../../../app.js#L85), fechando com `});`), adicione:

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

- [ ] **Step 2: Expor no return**

Na seção `// computed` do return do setup, adicione:

```js
      feedEnriquecido,
```

- [ ] **Step 3: Envolver a lista atual num `v-else`**

Em [index.html](../../../index.html), localize o bloco da lista (a partir de `<!-- Lista -->` em [index.html:207](../../../index.html#L207) até o `</div>` que fecha o `v-else` da lista de botecos — o `</div>` em [index.html:277](../../../index.html#L277)).

Atualmente tem duas divs irmãs:
1. `<div v-if="lista.length === 0" ...>` (empty state)
2. `<div v-else class="space-y-3">` (lista de cards)

Envolva essas duas numa div pai com `v-if="filtro !== 'galera'"`:

Antes (linhas 207-277, resumido):

```html
<!-- Lista -->
<div v-if="lista.length === 0" class="text-center py-12 ...">
  ...
</div>

<div v-else class="space-y-3">
  <button v-for="d in lista" ...>...</button>
</div>
```

Depois:

```html
<!-- Lista de botecos (abas faltam / jafui / perto) -->
<div v-if="filtro !== 'galera'">
  <div v-if="lista.length === 0" class="text-center py-12 ...">
    ...
  </div>

  <div v-else class="space-y-3">
    <button v-for="d in lista" ...>...</button>
  </div>
</div>
```

Mantenha o conteúdo interno intacto — só envelopar.

- [ ] **Step 4: Adicionar o bloco do feed antes do `v-if="filtro !== 'galera'"`**

Imediatamente antes da div que você acabou de criar (`<div v-if="filtro !== 'galera'">`), cole:

```html
<!-- Feed da galera -->
<div v-if="filtro === 'galera'">
  <div v-if="feedEnriquecido.length === 0" class="text-center py-12 bg-[#fffaee] border-2 border-dashed border-[#8b6f47]">
    <p class="font-handwritten text-2xl text-[#5c4a2f] -rotate-1">
      ninguém avaliou nada ainda. bora começar a correria?
    </p>
  </div>

  <div v-else class="space-y-3">
    <div
      v-for="(a, i) in feedEnriquecido"
      :key="a.telefone + '-' + a.prato_id + '-' + i"
      class="bg-[#fffaee] border-2 border-[#1a1410] shadow-[4px_4px_0_#1a1410] flex"
    >
      <div class="relative w-20 h-20 flex-shrink-0 bg-[#1a1410] overflow-hidden">
        <img
          :src="a.foto"
          :alt="a.prato"
          loading="lazy"
          class="w-full h-full object-cover"
          @error="$event.target.style.display='none'"
        />
      </div>
      <div class="flex-1 p-3 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-display text-xs tracking-widest text-[#1a1410] truncate">{{ a.nome }}</span>
          <div class="flex gap-0.5 flex-shrink-0">
            <svg
              v-for="n in 5"
              :key="n"
              width="14" height="14" viewBox="0 0 24 24"
              :fill="a.nota >= n ? '#f4b942' : 'none'"
              :stroke="a.nota >= n ? '#c4901f' : '#8b6f47'"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        </div>
        <p class="font-handwritten text-lg text-[#c83c1f] leading-tight truncate">{{ a.prato }}</p>
        <p class="text-[11px] text-[#5c4a2f] leading-tight truncate">
          {{ a.boteco }} · <span class="font-display tracking-widest text-[10px] text-[#8b6f47]">{{ a.tempoRel }}</span>
        </p>
        <p v-if="a.obs" class="font-handwritten text-base text-[#3d2f20] mt-1 line-clamp-2">"{{ a.obs }}"</p>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Verificar**

Recarregue. Clique em GALERA:
- Se o banco tiver zero avaliações: aparece o empty state _"ninguém avaliou nada ainda..."_.
- Se tiver avaliações: cada item mostra thumb (80×80), nome, estrelas preenchidas conforme nota, nome do prato em vermelho handwritten, boteco + tempo relativo, e (se tiver obs) a observação truncada em 2 linhas entre aspas.
- Clicar nos outros filtros (FALTAM, JÁ FUI, PERTO) volta a mostrar a lista normal de botecos.
- A aba GALERA não abre o modal ao clicar num item (comportamento esperado — feed é read-only).

Caso não haja avaliação no banco e você quiser testar rapidamente: crie uma via Supabase SQL Editor:

```sql
insert into avaliacoes (telefone, prato_id, nota, obs)
values ('SEU_TELEFONE_11_DIGITOS', 'balanca-vento', 5, 'teste do feed');
```

Depois lembra de apagar: `delete from avaliacoes where obs = 'teste do feed';`.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html
git commit -m "feat - renderizar feed da galera com avaliacoes"
```

---

## Task 5: Estados de carregando e erro

Adiciona spinner durante fetch e banner de erro com retry.

**Files:**
- Modify: `index.html` (dentro do bloco `v-if="filtro === 'galera'"` criado na Task 4)

- [ ] **Step 1: Inserir blocos de loading e erro no início do bloco da GALERA**

Essa edição é cirúrgica — só adiciona dois blocos novos no topo do `<div v-if="filtro === 'galera'">` e troca um `v-if` por `v-else-if` na div do empty state. O bloco do feed (`<div v-else class="space-y-3">`) não muda.

**1a.** Logo depois da linha `<div v-if="filtro === 'galera'">` (a que você criou na Task 4), insira:

```html
  <!-- Carregando -->
  <div v-if="carregandoFeed" class="flex justify-center py-12">
    <svg class="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c83c1f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>

  <!-- Erro -->
  <div v-else-if="erroFeed" class="text-center py-10 bg-[#fffaee] border-2 border-dashed border-[#c83c1f]">
    <p class="font-handwritten text-xl text-[#c83c1f] -rotate-1 mb-3">⚠ {{ erroFeed }}</p>
    <button
      @click="carregarFeed"
      class="bg-[#1a1410] text-[#f4b942] py-2 px-5 font-display tracking-widest text-xs hover:bg-[#c83c1f] transition-colors"
    >
      TENTAR DE NOVO
    </button>
  </div>
```

**1b.** Na div do empty state logo abaixo, troque o `v-if` por `v-else-if`:

Antes:
```html
  <div v-if="feedEnriquecido.length === 0" class="text-center py-12 bg-[#fffaee] border-2 border-dashed border-[#8b6f47]">
```

Depois:
```html
  <div v-else-if="feedEnriquecido.length === 0" class="text-center py-12 bg-[#fffaee] border-2 border-dashed border-[#8b6f47]">
```

A cadeia final de condicionais fica: `v-if="carregandoFeed"` → `v-else-if="erroFeed"` → `v-else-if="feedEnriquecido.length === 0"` → `v-else` (o feed).

- [ ] **Step 2: Verificar loading**

Abra DevTools → Network → throttle pra "Slow 3G". Navegue pra outra aba, volta pra GALERA. Deve aparecer o spinner por 1-2 segundos antes do conteúdo carregar.

Desligue o throttle depois.

- [ ] **Step 3: Verificar erro**

Pra simular erro, quebre temporariamente o nome da tabela em `carregarFeed` em [app.js](../../../app.js):

```js
.from('avaliacoes_BROKEN')
```

Recarregue, clique em GALERA. Deve aparecer o banner vermelho tracejado com "⚠ Deu ruim ao carregar. Tenta de novo." e o botão "TENTAR DE NOVO".

Clique em "TENTAR DE NOVO" → re-dispara a query, que falha de novo → banner continua.

**Reverta a mudança** (`avaliacoes_BROKEN` → `avaliacoes`). Clique novamente e confirme que volta ao normal.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat - estados de carregando e erro no feed da galera"
```

---

## Task 6: Smoke test final e deploy

- [ ] **Step 1: Smoke test completo local**

Com todas as mudanças em `main` local:

1. Abra em aba anônima (pra limpar cache).
2. Login com seu telefone.
3. Clique em cada aba: FALTAM, JÁ FUI, PERTO, GALERA. Todas devem funcionar.
4. Em GALERA: confira nome, estrelas, prato/boteco, tempo relativo, e obs (se houver avaliação com obs).
5. Volte pra FALTAM: a lista de botecos aparece normal.
6. Abra um boteco, dê uma nota, salve. Volte pra GALERA: a nova avaliação deve aparecer no topo.
7. Faça logout. Faça login de novo. Tudo deve funcionar igual.

- [ ] **Step 2: Deploy**

```bash
git push origin main
```

GH Pages vai republicar em ~30-60s (repo root é o deploy raiz — conforme [README.md:39](../../../README.md#L39)).

- [ ] **Step 3: Smoke test em produção**

Abra a URL pública do app (aba anônima pra não pegar cache antigo). Repita os passos do smoke test local. Se algo divergir, investigar.

- [ ] **Step 4: Commit (se houver ajuste)**

Se o smoke test revelar algum bug, corrija, commit, push, verifique de novo. Não feche a tarefa até passar em produção.
