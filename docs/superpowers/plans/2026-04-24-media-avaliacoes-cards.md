# Média de Avaliações nos Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar a média geral de notas (com contagem) no canto superior direito dos cards de boteco, empilhada acima do selo "JÁ FUI" quando o usuário já avaliou.

**Architecture:** Client-side aggregation. Uma nova query carrega `(prato_id, nota)` de todas as `avaliacoes` no mount (fire-and-forget). Um `computed` agrupa e calcula `{media, contagem}` por `prato_id`. Template do card ganha um wrapper flex-column no canto superior direito com dois selos: média (sempre que existe ≥1 avaliação) + "JÁ FUI" (quando o usuário avaliou).

**Tech Stack:** Vue 3 (CDN), Tailwind (CDN), Supabase JS v2 (CDN). Sem bundler, sem test runner — verificação manual no browser.

**Spec:** [docs/superpowers/specs/2026-04-24-media-avaliacoes-cards-design.md](../specs/2026-04-24-media-avaliacoes-cards-design.md)

## Nota sobre "testes"

Sem test suite. Cada tarefa tem passos de verificação manual: abra o browser, confirme visualmente ou via DevTools.

Pra rodar local: `python -m http.server 8000` na raiz. Ou testar direto em produção depois do push (GH Pages republica em ~30-60s).

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| [app.js](../../../app.js) | Modificar | Novo state, query, computed, mount |
| [index.html](../../../index.html) | Modificar | Wrapper flex-col no card com selo da média |
| [schema.sql](../../../schema.sql) | Não muda | — |
| [dishes.js](../../../dishes.js) | Não muda | — |

---

## Task 1: Dados + agregação no app.js

Adiciona o estado, a função que carrega todas as avaliações, o computed de médias, e dispara o load no mount. Sem efeito visual ainda (Task 2 renderiza).

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Adicionar ref `agregadosAvaliacoes`**

Dentro do `setup()`, na seção de state. Coloque logo após a linha `const erroFeed = ref('');` (que foi adicionada na feature anterior):

```js
    const agregadosAvaliacoes = ref([]);
```

- [ ] **Step 2: Adicionar `carregarAgregados` function**

Dentro do `setup()`, na seção de actions. Coloque logo após a função `carregarFeed` (que termina com uma chave `}` fechando o `async function carregarFeed() { ... }`):

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

Note que essa função é "fire-and-forget" — não expõe estado de loading/erro pra UI. Se falhar, só loga no console e os cards renderizam sem o selo (graceful degradation).

- [ ] **Step 3: Adicionar computed `mediasPorPrato`**

Dentro do `setup()`, na seção de computeds. Coloque logo após o computed `feedEnriquecido` (que foi adicionado na feature GALERA e termina com `)` e `;`):

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

- [ ] **Step 4: Expor no `return` do setup**

No bloco `return { ... }` no final do `setup()`, adicione nas seções correspondentes (seguindo o padrão existente: expõe tanto a ref quanto o computed derivado, igual ao par `feedAvaliacoes` + `feedEnriquecido`):

Na seção `// state`:
```js
      agregadosAvaliacoes,
```

Na seção `// computed`:
```js
      mediasPorPrato,
```

- [ ] **Step 5: Chamar `carregarAgregados()` no mount**

Localize o bloco `onMounted(async () => { ... })` no final do setup. Adicione `carregarAgregados();` como **primeira linha** dentro do callback, antes do `const telSalvo = localStorage.getItem(...)`:

Antes:
```js
    onMounted(async () => {
      const telSalvo = localStorage.getItem('cdb_telefone');
      if (!telSalvo) {
        carregandoApp.value = false;
        return;
      }
      ...
    });
```

Depois:
```js
    onMounted(async () => {
      carregarAgregados();
      const telSalvo = localStorage.getItem('cdb_telefone');
      if (!telSalvo) {
        carregandoApp.value = false;
        return;
      }
      ...
    });
```

Sem `await` — fire-and-forget. A query roda em paralelo com a lógica de auto-login.

- [ ] **Step 6: Verificar no browser (DevTools)**

Abra o app no browser. Antes mesmo de logar, abra DevTools → aba Network, filtre por `avaliacoes`.

Reload a página. Deve aparecer uma request GET:
```
{SUPABASE_URL}/rest/v1/avaliacoes?select=prato_id,nota
```
Status `200 OK`. Response: array JSON com `prato_id` e `nota` (sem `telefone`, sem `obs`).

Verificar que o console não mostra erros (a não ser `carregarAgregados` se tiver problema, e nesse caso é pra investigar).

Não haverá mudança visual ainda (Task 2 fará isso).

**Teste opcional no console:** cole e confirme que o computed agrega corretamente:

```js
// No console do DevTools, depois da query carregar:
// (precisa pegar a instância do app — mais fácil testar visualmente na Task 2)
```

Pula o teste no console se for chato — o importante é confirmar que a request rodou e a resposta chegou.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat - agregacao de medias por prato (state + query + computed)"
```

---

## Task 2: Selo da média no card (template)

Substitui o bloco JÁ FUI isolado por um wrapper flex-column que abriga o selo da média em cima e o JÁ FUI embaixo.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Substituir o bloco JÁ FUI no card**

Localize em `index.html` dentro do `<button v-for="d in lista" ...>` o bloco atual do selo JÁ FUI. Ele está dentro do bloco `v-if="filtro !== 'galera'"` (wrapper da lista) e começa com:

```html
            <div v-if="ratings[d.id]" class="absolute top-3 right-3 z-10 bg-[#2d4a1f] text-[#f4ead5] px-3 py-1 -rotate-6 shadow-md">
              <div class="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span class="font-display text-[10px] tracking-widest">JÁ FUI</span>
              </div>
            </div>
```

(Esse bloco deve estar logo dentro do `<button>`, antes do bloco do `d._dist` da distância.)

Substitua por:

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

Note:
- O wrapper externo (`<div class="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">`) tem o `absolute` e posicionamento que antes estavam no selo JÁ FUI.
- O selo JÁ FUI interno **não tem mais `absolute top-3 right-3`** — herda posição do wrapper.
- O selo JÁ FUI mantém a rotação `-rotate-6`.
- O selo da média **não tem rotação** — mantém vertical pra legibilidade do número.
- O bloco da distância (`d._dist`, `absolute bottom-3 right-3`) **não muda** — continua separado no canto inferior direito.

- [ ] **Step 2: Verificar no browser**

Abra o app. Faça login. Pra testar bem, garante que o banco tem pelo menos 1-2 avaliações (se não tiver, cria uma dando nota num boteco).

Verificar visualmente:

1. **Card sem avaliação** (nenhum usuário avaliou aquele prato) → canto superior direito fica **vazio** (nem selo de média nem JÁ FUI).

2. **Card que só outra pessoa avaliou** (mas não você) → aparece só o **selo da média** no canto. Ex: `⭐ 4.5 (1)`.

3. **Card que você avaliou** (e talvez outros também) → aparece o **selo da média em cima** e o **selo "JÁ FUI" empilhado embaixo**.

4. **Card no filtro PERTO** → selo da distância continua no canto **inferior direito**, sem conflito.

5. **Filtros FALTAM / JÁ FUI / PERTO** → todos mostram o selo da média corretamente nos cards aplicáveis.

6. **Aba GALERA** → não afetada (ela usa template diferente).

Se em algum card a média aparecer como `0.0` ou `NaN`, é bug — investigar.

Se a data do banco estiver vazia, teste criando uma avaliação no próprio app e recarregando a página.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat - selo de media no card com stack do ja fui"
```

---

## Task 3: Smoke test e deploy

- [ ] **Step 1: Smoke test completo local**

Verifique todos os casos da Task 2 Step 2. Também:

- Faça login com um usuário que tem avaliações e um sem — confirma que o selo da média aparece igual pros dois (é global, não depende de quem tá logado).
- Avalia um novo boteco, salva, recarrega a página → confirma que a média do card atualizou (sua nota entrou).
- Clica PERTO, confirma que distância + média convivem sem sobreposição.

- [ ] **Step 2: Deploy**

```bash
git push origin main
```

GH Pages republica em ~30-60s.

- [ ] **Step 3: Smoke test em produção**

Abra a URL pública em aba anônima. Repita os casos principais (login, confere média, confere stack JÁ FUI, confere PERTO). Se algo divergir do local, investigar.

- [ ] **Step 4: Commit de ajustes (se necessário)**

Se o smoke test revelar bug, corrija, commit, push, verifica de novo.
