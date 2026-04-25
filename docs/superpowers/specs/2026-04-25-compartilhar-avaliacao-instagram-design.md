# Compartilhar avaliação no Instagram — Design

**Data:** 2026-04-25
**Status:** Aprovado para implementação

## Contexto

O app hoje permite avaliar pratos do Comida di Buteco MOC 2026 e mostra um feed da galera, mas não tem nenhuma forma de compartilhar uma avaliação fora do app. Como o público-alvo são os 5 amigos que usam o tracker (e qualquer um que queira entrar), faz sentido gerar um cardzinho visual da avaliação que a pessoa possa jogar no Instagram Stories — tanto pra "marcar a passagem" pelo boteco quanto como convite implícito pros amigos entrarem.

Web/Instagram hoje: o Instagram não aceita compartilhamento direto de URL/texto pro feed via web. O caminho viável é gerar uma imagem (PNG) e disparar `navigator.share({ files: [...] })`, que no celular abre a sheet nativa onde Instagram aparece como destino (Stories ou DM).

## Objetivo

Adicionar um botão "compartilhar no insta" no modal de avaliação que:
1. Aparece quando o usuário já tem uma avaliação salva pro prato (não na primeira avaliação ainda não-salva).
2. Gera uma imagem 1080×1920 (Instagram Stories) com a avaliação formatada na linguagem visual do app.
3. Dispara o share nativo do navegador no celular; faz download como fallback no desktop.

## Não-objetivos

- Compartilhar no feed permanente do Instagram (não suportado pela web).
- Compartilhamento "automático" sem confirmação do usuário.
- Personalização do card pelo usuário (templates, escolher cores, etc.).
- Outros formatos (1:1, 4:5) — só Stories 9:16.
- Tracking de quantos shares foram feitos.

## Arquitetura

### Novo arquivo: `share.js`

Carregado em `index.html` entre `dishes.js` e `app.js`. Expõe uma única função no `window`:

```js
window.CDB_SHARE = {
  async compartilharAvaliacao({ nome, boteco, prato, nota, obs, foto })
}
```

Campo `foto` é a URL relativa que vem direto do `dishes.js` (ex: `images/balanca-vento.jpg`).

**Por que arquivo separado:** geração de imagem é ~150 linhas isoladas (canvas, fonts, share API) sem relação com Vue/Supabase. Misturar com `app.js` (já em ~400 linhas) prejudica a leitura. Padrão "tudo no `window`" combina com o estilo CDN-only do projeto.

A função:
1. Aguarda fontes carregarem via `document.fonts.load()` para Bungee, Caveat, Lora.
2. Cria um `<canvas>` off-screen 1080×1920 (não vai pro DOM).
3. Carrega a foto do prato via `new Image()` (foto é local em `images/`, sem CORS).
4. Desenha o card seguindo o layout especificado abaixo.
5. Converte para `Blob` via `canvas.toBlob('image/png')`.
6. Tenta `navigator.share({ files: [new File([blob], '...', { type: 'image/png' })] })`.
7. Se `navigator.canShare({ files })` retornar false, dispara download via `<a download>`.
8. Lança erro se foto falhar ou conversão para blob falhar — `app.js` mostra toast de erro.

### Integração em `app.js`

- Nova função `compartilharAvaliacaoAtual()` que monta o objeto a partir de `aberto.value` (boteco, prato, foto), `ratings.value[aberto.value.id]` (nota, obs) e `user.value.nome`, então chama `window.CDB_SHARE.compartilharAvaliacao(...)`.
- Novo state `carregandoShare` (boolean) pra spinner do botão.
- Novo state `toast` (`{ msg: string, tipo: 'sucesso' | 'erro' } | null`) e função `mostrarToast(msg, tipo)` que define o state e limpa em 4s.
- Função exposta no return do `setup()`.

### Mudanças em `index.html`

1. Carregar `share.js` antes de `app.js`.
2. Botão novo no modal, entre ATUALIZAR e APAGAR, com `v-if="ratings[aberto.id]"`. Estilo: vermelho (`#c83c1f`), Bungee, mesma estrutura do botão SALVAR mas variante secundária.
3. Componente toast no fim do `<div id="app">`: `<div v-if="toast" class="fixed bottom-5 ...">`, fundo varia por tipo, auto-some via `v-if`.

## Layout do card (1080×1920)

Linguagem visual: paper bg `#f4ead5`, fontes Bungee (display, all caps), Caveat (handwritten cursivo), Lora (body); cores `#1a1410` (preto), `#c83c1f` (vermelho), `#f4b942` (amarelo), `#2d4a1f` (verde), `#fffaee` (creme); sombras hard-offset; badges rotacionados.

**Faixa de branding (0–120px)**
Background `#c83c1f`. Texto centralizado: `COMIDA DI BUTECO • MOC 2026` em Bungee 32px, cor `#fffaee`, tracking-widest.

**Foto do prato (120–1020px, 900px de altura)**
- Foto carregada e renderizada com efeito `object-fit: cover` no canvas:
  ```
  scale = Math.max(1080 / img.width, 900 / img.height)
  drawW = img.width * scale; drawH = img.height * scale
  drawX = (1080 - drawW) / 2; drawY = 120 + (900 - drawH) / 2
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ```
  Aplicar `ctx.save() / ctx.beginPath() / ctx.rect(0, 120, 1080, 900) / ctx.clip()` antes pra garantir que nada vaza fora da área.
- Background `#1a1410` por baixo (caso a foto não cubra perfeitamente).
- Overlay no rodapé da foto (últimos 280px): gradiente vertical de `rgba(0,0,0,0)` para `rgba(0,0,0,0.85)`.
- Sobre o overlay, alinhado à esquerda com 60px de padding:
  - Nome do boteco em Bungee 36px, cor `#fffaee`, tracking-widest, posição `y=900`.
  - Nome do prato em Caveat 84px, cor `#f4b942`, rotação `-1°`, posição `y=975`. Quebra de linha automática se ultrapassar 960px de largura.

**Bloco da nota (1020–1380px, 360px)**
Background `#fffaee`. Borda inferior tracejada (2 linhas pretas com gap de 8px) imitando o `border-b-2 border-dashed` do Tailwind.
- Label `MINHA NOTA` em Bungee 26px, tracking 8px, cor `#5c4a2f`, centralizado, `y=1075`.
- 5 estrelas centralizadas, cada uma 110px, gap de 12px. Preenchidas: `fill #f4b942 stroke #c4901f`. Vazias: `fill none stroke #8b6f47`. Posição `y=1130` (centro vertical das estrelas em ~1185).
- Label da nota (`fugiu...` / `meia boca` / `mais ou menos` / `muito bom!` / `trem da gota!`) em Caveat 56px, cor `#c83c1f`, rotação `-1°`, centralizado, `y=1310`.

**Bloco da obs (1380–1620px, 240px)** — só se `obs` existir e for não-vazia
Background `#f4ead5` (paper). Aspas grandes decorativas (Bungee 120px, cor `#c83c1f` com opacidade 0.3) nos cantos superior-esquerdo (40px da esquerda, 1430 de y) e inferior-direito (1000px da esquerda, 1600 de y). Texto em Caveat 52px, cor `#3d2f20`, centralizado horizontal e verticalmente no bloco. Quebra de linha automática se passar de 920px de largura. Trunca em ~120 caracteres com `...` se for muito longa.

Se `obs` for vazia, esse bloco não é desenhado e o rodapé sobe pra `y=1380`, ocupando 1380–1920 (540px de altura).

**Rodapé (1620–1920 ou 1380–1920)**
Background `#1a1410`.
- Texto principal em Bungee 28px, cor `#f4b942`, centralizado: `@{nome.toLowerCase()} JOGOU NO COMIDA DI BUTECO MOC`. Posição vertical: 60px abaixo do topo do bloco.
- URL embaixo em Bungee 24px, cor `#fffaee`, opacidade 0.7, centralizado: `vateiixeira.github.io/comidadebuteco`. Posição vertical: 60px abaixo do texto principal.
- Selo `ED. 2026` rotacionado +12°, fundo `#f4b942`, cor `#1a1410`, Bungee 22px tracking-widest, posicionado no canto inferior direito (x=900, y=1820), padding interno 24×12px.

### Quebra de texto (word wrap)

Helper `wrapText(ctx, text, maxWidth, lineHeight)` que retorna um array de linhas. Usado para nome do prato, observação. Itera palavras, mede com `ctx.measureText`, quebra quando passa de `maxWidth`.

## Fluxo do compartilhamento (UX)

1. Usuário abre modal de boteco já avaliado.
2. Vê 3 botões empilhados: **ATUALIZAR** (preto/amarelo, primário, igual hoje), **COMPARTILHAR NO INSTA** (vermelho `#c83c1f`, secundário, novo), **APAGAR AVALIAÇÃO** (link discreto, igual hoje).
3. Toca em COMPARTILHAR → `carregandoShare = true`, botão mostra spinner + texto "GERANDO IMAGEM..." (mesmo padrão visual do `carregandoModal`).
4. `share.js` aguarda fontes (~50ms se já carregadas), carrega foto (~50–200ms), desenha (~100ms), gera blob (~100ms). Total esperado 200–500ms.
5. Em mobile com share API: sheet nativa abre. Instagram aparece como destino (vai pro picker de Story/DM). Outros apps (WhatsApp, etc.) também aparecem.
6. Em desktop ou sem share API: download da imagem + toast amarelo "imagem salva! abre o insta e posta como story".
7. Em qualquer caso, `carregandoShare = false` ao final (ou em caso de erro).

### Botão só pra avaliação salva

`v-if="ratings[aberto.id]"` no botão de share. Avaliação ainda não salva (primeira vez no modal) não tem o botão — usuário salva primeiro, reabre, compartilha. Isso evita o caso "compartilhei mas o save falhou e a galera vê uma avaliação que não existe no banco".

## Fallback desktop

`navigator.canShare({ files: [pngFile] })` retorna `false` em desktop (sem share sheet nativa pra arquivos) e em mobile browsers antigos.

Quando false:
1. `URL.createObjectURL(blob)` cria URL temporária.
2. Cria `<a>` com `download="comida-di-buteco-{slug-do-boteco}.png"` e `href` na URL temporária.
3. Anexa ao DOM, dispara `.click()`, remove.
4. `URL.revokeObjectURL` depois de 1s.
5. App mostra toast: "imagem salva! abre o insta e posta como story" (sucesso, fundo amarelo).

Não tenta abrir Instagram automaticamente — não existe deep link confiável de upload via web. Usuário desktop não é público-alvo (CLAUDE.md: mobile-first), só não quebra.

### Slug do boteco

Helper `slugBoteco(nome)`: lowercase, remove acentos via `normalize('NFD').replace(/[̀-ͯ]/g, '')`, troca não-alfanuméricos por `-`, colapsa hífens repetidos, trim. Ex: "Divino's Bar" → "divino-s-bar".

## Toast

Componente novo simples no Vue:
- State em `app.js`: `toast = ref(null)` (objeto `{ msg, tipo }` ou null).
- Função `mostrarToast(msg, tipo = 'sucesso')`: seta `toast.value`, agenda `setTimeout(() => toast.value = null, 4000)`.
- Markup no `index.html` no fim do `<div id="app">`:
  ```html
  <div v-if="toast" class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] animate-fadeIn ..." :class="toast.tipo === 'erro' ? 'bg-[#c83c1f] text-[#fffaee]' : 'bg-[#f4b942] text-[#1a1410]'">
    {{ toast.msg }}
  </div>
  ```
- Estilo: padding 16×24px, borda preta 2px, sombra hard `4px_4px_0_#1a1410`, Caveat 22px ou Bungee 14px (decidir na implementação pelo que fica melhor com o tom da mensagem).

## Tratamento de erros

- **Fonte não carrega:** `document.fonts.load` com timeout de 2s. Se falhar, segue desenhando — fallback de fonte do sistema renderiza o texto, não fica quebrado.
- **Foto não carrega:** se `img.onerror` disparar, desenha o card sem foto (preenche o espaço da foto com `#1a1410` e desenha um texto centralizado `prato em foto indisponível` em Caveat). Não bloqueia o share.
- **Canvas/blob falha:** captura no try/catch da `compartilharAvaliacao`, lança erro. `app.js` mostra toast de erro.
- **Share API falha (usuário cancela):** `navigator.share` rejeita com `AbortError`. Tratar como caso normal (não mostra erro), só finaliza loading.
- **Share API falha (outro motivo):** mostra toast de erro.

## Plano de testes (manual, mobile-first)

Não tem suite de testes no projeto. Verificar manualmente em ordem:
1. iOS Safari (alvo principal): salva avaliação, fecha modal, reabre, clica compartilhar, verifica que sheet abre com Insta listado, conclui share pra Story.
2. Chrome Android: mesmo fluxo.
3. Chrome desktop: verifica que faz download e mostra toast.
4. Avaliação sem `obs`: verifica layout sem o bloco da obs (rodapé sobe).
5. Boteco com prato de nome longo (ex: "Dobradinha com toque de alho-poró"): verifica word-wrap.
6. Obs longa (>120 chars): verifica truncamento.
7. Boteco com aspas no nome (ex: "Gordo's Bar", "Divino's Bar"): verifica que o slug do download fica ok e o nome no card renderiza certo.

## Riscos conhecidos

- `document.fonts.load` pode dar resultados inconsistentes em iOS Safari antigo (<16). Mitigado pelo timeout + fallback de fonte do sistema.
- Foto carregada como `<img>` em canvas exige `crossOrigin = 'anonymous'` se vier de outro domínio. Como as fotos são locais (`images/...`), não é problema. Se no futuro fotos virem de Supabase Storage, precisa configurar CORS lá.
- iOS Safari teve bugs históricos em `canvas.toBlob` com PNG grande — 1080×1920 é razoável (~1–3MB), mas se der problema, `toDataURL` é fallback.

## Estrutura de arquivos depois desta mudança

```
.
├── index.html       (modificado: carrega share.js, novo botão, toast)
├── app.js           (modificado: compartilharAvaliacaoAtual, toast state)
├── share.js         (NOVO: geração da imagem + share API + fallback)
├── config.js
├── dishes.js
├── schema.sql
├── README.md
└── docs/superpowers/specs/2026-04-25-compartilhar-avaliacao-instagram-design.md
```
