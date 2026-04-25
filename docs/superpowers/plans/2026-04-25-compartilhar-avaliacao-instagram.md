# Compartilhar avaliação no Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar botão "compartilhar no insta" no modal de avaliação que gera uma imagem 1080×1920 (Instagram Stories) e dispara `navigator.share` no celular ou faz download no desktop.

**Architecture:** Novo arquivo `share.js` isolado contém toda a lógica de geração de imagem via Canvas API e Web Share API. `app.js` ganha estado de toast e função `compartilharAvaliacaoAtual` que delega para `share.js`. `index.html` ganha o botão no modal e o componente de toast.

**Tech Stack:** Vue 3 (CDN), Canvas API, Web Share API, Tailwind (CDN). Sem build, sem framework de teste — verificação manual no navegador.

---

## Convenções deste plano

- **Sem testes automatizados:** o projeto não tem suite. Cada tarefa termina com verificação manual no navegador (instruções explícitas).
- **Commits:** seguem o padrão do log do projeto (`feat - X`, `ui - X`, `fix - X`). Sem `chore`/`refactor`.
- **Servidor local:** rodar `python -m http.server 8000` no diretório raiz e abrir `http://localhost:8000` no navegador. Para testar mobile, abrir DevTools (F12), modo dispositivo (Ctrl+Shift+M), perfil iPhone ou similar.
- **Login para testar:** já existe usuário no Supabase ou criar novo via login screen. Salvar pelo menos uma avaliação antes de testar share (botão só aparece pra avaliação salva).

## Estrutura de arquivos depois deste plano

```
share.js              NOVO — geração de imagem + share API
app.js                MODIFICADO — toast state, compartilharAvaliacaoAtual
index.html            MODIFICADO — load script, botão modal, toast component
```

---

## Task 1: Criar share.js com helpers

Cria o arquivo novo com helpers utilitários. Sem geração de imagem ainda — só o esqueleto com `slugBoteco` e `wrapText`. Botões e canvas vêm depois.

**Files:**
- Create: `share.js`
- Modify: `index.html` (carrega o script)

- [ ] **Step 1: Criar share.js com esqueleto**

```js
// =====================================================================
// Comida di Buteco — Compartilhamento (geração de imagem + share API)
// =====================================================================

(function () {
  // ----- helpers -----

  function slugBoteco(nome) {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function wrapText(ctx, text, maxWidth) {
    const palavras = (text || '').split(/\s+/).filter(Boolean);
    const linhas = [];
    let atual = '';
    for (const p of palavras) {
      const tentativa = atual ? atual + ' ' + p : p;
      if (ctx.measureText(tentativa).width <= maxWidth) {
        atual = tentativa;
      } else {
        if (atual) linhas.push(atual);
        atual = p;
      }
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  // Exporta no window pra uso pelo app.js
  window.CDB_SHARE = {
    _slugBoteco: slugBoteco,
    _wrapText: wrapText,
    async compartilharAvaliacao(_dados) {
      throw new Error('not implemented yet');
    },
  };
})();
```

- [ ] **Step 2: Adicionar `<script src="share.js">` em index.html**

Editar `index.html` na seção de scripts no final (próximo da linha 476). Adicionar entre `dishes.js` e `app.js`:

```html
<!-- Config + dados + app (nessa ordem) -->
<script src="config.js"></script>
<script src="dishes.js"></script>
<script src="share.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 3: Verificar no navegador**

1. Iniciar servidor: `python -m http.server 8000`
2. Abrir `http://localhost:8000` no navegador
3. Abrir DevTools (F12), aba Console
4. Executar:
```js
window.CDB_SHARE._slugBoteco("Divino's Bar")
// esperado: "divino-s-bar"

window.CDB_SHARE._slugBoteco("Gordo's Bar")
// esperado: "gordo-s-bar"
```

Esperado: ambas as chamadas retornam as strings esperadas. App carrega normal (login screen aparece, sem erros no console).

- [ ] **Step 4: Commit**

```bash
git add share.js index.html
git commit -m "feat - esqueleto de share.js com helpers slugBoteco e wrapText"
```

---

## Task 2: Drawing — branding strip + photo block

Implementa as duas primeiras seções do canvas: faixa de branding no topo e foto do prato. Adiciona uma função interna `_desenharCard(ctx, dados)` chamável via console pra inspeção visual.

**Files:**
- Modify: `share.js`

- [ ] **Step 1: Adicionar função carregarImagem em share.js**

Adicionar dentro do IIFE em `share.js`, depois de `wrapText`:

```js
function carregarImagem(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
```

(Resolve com `null` em vez de rejeitar — assim a função de desenho pode tratar foto faltando como caso normal.)

- [ ] **Step 2: Adicionar função desenharBranding em share.js**

Adicionar depois de `carregarImagem`:

```js
function desenharBranding(ctx) {
  // Faixa vermelha 0-120
  ctx.fillStyle = '#c83c1f';
  ctx.fillRect(0, 0, 1080, 120);

  // Texto centralizado
  ctx.fillStyle = '#fffaee';
  ctx.font = '32px Bungee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Tracking visual: usar letter spacing manual via espaços extra ou
  // desenhar caractere por caractere. Simplificação: texto direto.
  ctx.fillText('COMIDA DI BUTECO • MOC 2026', 540, 60);
}
```

- [ ] **Step 3: Adicionar função desenharFoto em share.js**

```js
function desenharFoto(ctx, img, prato) {
  // Background da área caso a foto não cubra
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 120, 1080, 900);

  if (img) {
    // object-fit: cover dentro de 1080x900 começando em y=120
    const scale = Math.max(1080 / img.width, 900 / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (1080 - drawW) / 2;
    const drawY = 120 + (900 - drawH) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 120, 1080, 900);
    ctx.clip();
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    // Fallback texto centralizado quando foto falha
    ctx.fillStyle = '#8b6f47';
    ctx.font = '52px Caveat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('foto indisponível', 540, 570);
  }

  // Gradiente preto no rodapé da foto (últimos 280px: 740-1020)
  const grad = ctx.createLinearGradient(0, 740, 0, 1020);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 740, 1080, 280);
}

function desenharBotecoEPrato(ctx, boteco, prato) {
  // Nome do boteco em Bungee 36 branco/creme
  ctx.fillStyle = '#fffaee';
  ctx.font = '36px Bungee';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(boteco, 60, 920);

  // Nome do prato em Caveat 84 amarelo, rotacionado -1deg
  ctx.save();
  ctx.translate(60, 1000);
  ctx.rotate(-Math.PI / 180); // -1 grau
  ctx.fillStyle = '#f4b942';
  ctx.font = '84px Caveat';
  ctx.textBaseline = 'alphabetic';

  const linhas = wrapText(ctx, prato, 960);
  for (let i = 0; i < linhas.length && i < 2; i++) {
    ctx.fillText(linhas[i], 0, i * 90);
  }
  ctx.restore();
}
```

- [ ] **Step 4: Adicionar função interna _desenharCard que monta o canvas**

Adicionar antes do `window.CDB_SHARE`:

```js
async function desenharCard(dados) {
  const { boteco, prato, foto } = dados;

  // Garante que as fontes carregaram (timeout 2s)
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 84px Caveat'),
        document.fonts.load('400 32px Bungee'),
        document.fonts.load('400 24px Lora'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch (_) {
    // Segue desenhando com fallback de fonte do sistema
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background paper geral (será sobrescrito pelas seções)
  ctx.fillStyle = '#f4ead5';
  ctx.fillRect(0, 0, 1080, 1920);

  desenharBranding(ctx);

  const img = await carregarImagem(foto);
  desenharFoto(ctx, img, prato);
  desenharBotecoEPrato(ctx, boteco, prato);

  return canvas;
}
```

- [ ] **Step 5: Expor _desenharCard no window pra debug**

Atualizar o `window.CDB_SHARE`:

```js
window.CDB_SHARE = {
  _slugBoteco: slugBoteco,
  _wrapText: wrapText,
  _desenharCard: desenharCard,
  async compartilharAvaliacao(_dados) {
    throw new Error('not implemented yet');
  },
};
```

- [ ] **Step 6: Verificar no navegador**

1. Recarregar `http://localhost:8000` (com DevTools aberto)
2. Console:
```js
const c = await window.CDB_SHARE._desenharCard({
  boteco: 'Bar do Soró',
  prato: 'Surpresinha do Soró',
  foto: 'images/bar-do-soro.jpg'
});
document.body.appendChild(c);
c.style.position = 'fixed';
c.style.top = '0';
c.style.left = '0';
c.style.width = '270px';  // visualização 1/4
c.style.zIndex = '9999';
c.style.border = '2px solid red';
```

Esperado: aparece no canto superior esquerdo um canvas mostrando a faixa vermelha "COMIDA DI BUTECO • MOC 2026" no topo, foto do prato preenchendo o meio, gradiente escuro no rodapé da foto, nome do boteco em branco e nome do prato em amarelo cursivo. Resto do canvas é creme (paper).

Pra testar foto faltando:
```js
document.body.removeChild(c);
const c2 = await window.CDB_SHARE._desenharCard({
  boteco: 'Bar Teste',
  prato: 'Prato Teste',
  foto: 'imagem-que-nao-existe.jpg'
});
document.body.appendChild(c2);
c2.style.cssText = c.style.cssText;
```

Esperado: bloco da foto mostra "foto indisponível" em texto cinza centralizado.

- [ ] **Step 7: Commit**

```bash
git add share.js
git commit -m "feat - desenho da faixa de branding e foto do card de share"
```

---

## Task 3: Drawing — bloco da nota (estrelas + label)

Implementa o bloco branco com estrelas e label da nota.

**Files:**
- Modify: `share.js`

- [ ] **Step 1: Adicionar constante NOTA_LABELS_SHARE no escopo do IIFE**

Adicionar logo no início do IIFE, antes dos helpers:

```js
const NOTA_LABELS_SHARE = ['', 'fugiu...', 'meia boca', 'mais ou menos', 'muito bom!', 'trem da gota!'];
```

- [ ] **Step 2: Adicionar função drawStar**

Adicionar entre `wrapText` e `carregarImagem`:

```js
function drawStar(ctx, cx, cy, size, fill, stroke) {
  // Pontos do mesmo SVG das estrelas no app (viewBox 0 0 24 24)
  const points = [
    [12, 2], [15.09, 8.26], [22, 9.27], [17, 14.14], [18.18, 21.02],
    [12, 17.77], [5.82, 21.02], [7, 14.14], [2, 9.27], [8.91, 8.26]
  ];
  const scale = size / 24;
  const ox = cx - size / 2;
  const oy = cy - size / 2;

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const px = ox + x * scale;
    const py = oy + y * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2, scale * 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
```

- [ ] **Step 3: Adicionar função desenharNota**

Adicionar antes de `desenharCard`:

```js
function desenharNota(ctx, nota) {
  // Fundo creme do bloco 1020-1380
  ctx.fillStyle = '#fffaee';
  ctx.fillRect(0, 1020, 1080, 360);

  // Borda inferior tracejada (2px com gap de 8px)
  ctx.save();
  ctx.strokeStyle = '#8b6f47';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 8]);
  ctx.beginPath();
  ctx.moveTo(60, 1378);
  ctx.lineTo(1020, 1378);
  ctx.stroke();
  ctx.restore();

  // Label "MINHA NOTA"
  ctx.fillStyle = '#5c4a2f';
  ctx.font = '26px Bungee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Tracking 8px: desenha letra por letra
  const label = 'MINHA NOTA';
  const espacamento = 8;
  let larguraTotal = 0;
  for (const ch of label) larguraTotal += ctx.measureText(ch).width + espacamento;
  larguraTotal -= espacamento;
  let x = 540 - larguraTotal / 2;
  for (const ch of label) {
    const w = ctx.measureText(ch).width;
    ctx.fillText(ch, x + w / 2, 1075);
    x += w + espacamento;
  }

  // 5 estrelas, 110px cada, gap 12px, centradas em y=1185
  const tamEstrela = 110;
  const gap = 12;
  const larguraEstrelas = 5 * tamEstrela + 4 * gap;
  const inicioX = 540 - larguraEstrelas / 2;
  for (let i = 0; i < 5; i++) {
    const cx = inicioX + i * (tamEstrela + gap) + tamEstrela / 2;
    if (nota >= i + 1) {
      drawStar(ctx, cx, 1185, tamEstrela, '#f4b942', '#c4901f');
    } else {
      drawStar(ctx, cx, 1185, tamEstrela, null, '#8b6f47');
    }
  }

  // Label da nota em Caveat rotacionado -1deg
  const notaLabel = NOTA_LABELS_SHARE[nota] || '';
  if (notaLabel) {
    ctx.save();
    ctx.translate(540, 1310);
    ctx.rotate(-Math.PI / 180);
    ctx.fillStyle = '#c83c1f';
    ctx.font = '56px Caveat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(notaLabel, 0, 0);
    ctx.restore();
  }
}
```

- [ ] **Step 4: Chamar desenharNota em desenharCard**

Atualizar a função `desenharCard`. Substituir a assinatura e o corpo final:

Localizar:
```js
async function desenharCard(dados) {
  const { boteco, prato, foto } = dados;
```

Substituir por:
```js
async function desenharCard(dados) {
  const { boteco, prato, foto, nota } = dados;
```

E ao final, depois de `desenharBotecoEPrato(ctx, boteco, prato);`, adicionar:
```js
  desenharNota(ctx, nota);
```

- [ ] **Step 5: Verificar no navegador**

1. Recarregar `http://localhost:8000`
2. Console:
```js
const c = await window.CDB_SHARE._desenharCard({
  boteco: 'Bar do Soró',
  prato: 'Surpresinha do Soró',
  foto: 'images/bar-do-soro.jpg',
  nota: 4
});
document.body.appendChild(c);
c.style.cssText = 'position:fixed;top:0;left:0;width:270px;z-index:9999;border:2px solid red';
```

Esperado: abaixo da foto aparece bloco creme com "MINHA NOTA" em letras pretas tracking-widest, 5 estrelas (4 amarelas preenchidas, 1 vazia com contorno cinza), e o texto "muito bom!" em vermelho cursivo abaixo. Borda tracejada marrom no rodapé do bloco.

Testar com nota=1 (texto "fugiu...") e nota=5 (todas as estrelas amarelas, "trem da gota!"):
```js
document.body.removeChild(c);
const c2 = await window.CDB_SHARE._desenharCard({
  boteco: 'Bar do Soró', prato: 'Surpresinha', foto: 'images/bar-do-soro.jpg', nota: 5
});
document.body.appendChild(c2);
c2.style.cssText = c.style.cssText;
```

- [ ] **Step 6: Commit**

```bash
git add share.js
git commit -m "feat - bloco de nota com estrelas e label do card de share"
```

---

## Task 4: Drawing — bloco da obs (condicional) + rodapé

Implementa o bloco da observação (só se houver) e o rodapé preto com nome do usuário, URL e selo ED. 2026.

**Files:**
- Modify: `share.js`

- [ ] **Step 1: Adicionar função desenharObs**

Adicionar antes de `desenharCard`:

```js
function desenharObs(ctx, obs) {
  // Fundo paper bg do bloco 1380-1620
  ctx.fillStyle = '#f4ead5';
  ctx.fillRect(0, 1380, 1080, 240);

  // Aspas decorativas (Bungee 120 vermelho 30% opaco)
  ctx.save();
  ctx.fillStyle = 'rgba(200, 60, 31, 0.3)';
  ctx.font = '120px Bungee';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('"', 40, 1395);
  ctx.textAlign = 'right';
  ctx.fillText('"', 1040, 1480);
  ctx.restore();

  // Trunca obs em 120 chars
  let texto = obs;
  if (texto.length > 120) texto = texto.slice(0, 117).trimEnd() + '...';

  // Texto da obs em Caveat 52 marrom escuro, centralizado no bloco
  ctx.fillStyle = '#3d2f20';
  ctx.font = '52px Caveat';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const linhas = wrapText(ctx, texto, 920);
  const lineHeight = 60;
  const limMax = 4;
  const usadas = Math.min(linhas.length, limMax);
  const yCentro = 1500; // meio do bloco (1380 + 240/2)
  const yInicio = yCentro - ((usadas - 1) * lineHeight) / 2;
  for (let i = 0; i < usadas; i++) {
    ctx.fillText(linhas[i], 540, yInicio + i * lineHeight);
  }
}
```

- [ ] **Step 2: Adicionar função desenharRodape**

```js
function desenharRodape(ctx, nome, yInicio) {
  // Fundo preto do rodapé
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, yInicio, 1080, 1920 - yInicio);

  // Texto principal "@apelido jogou no comida di buteco moc"
  ctx.fillStyle = '#f4b942';
  ctx.font = '28px Bungee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const apelido = (nome || '').toLowerCase().replace(/\s+/g, '');
  ctx.fillText(`@${apelido} JOGOU NO COMIDA DI BUTECO MOC`, 540, yInicio + 80);

  // URL embaixo
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fffaee';
  ctx.font = '24px Bungee';
  ctx.fillText('vateiixeira.github.io/comidadebuteco', 540, yInicio + 140);
  ctx.restore();

  // Selo ED. 2026 rotacionado +12deg no canto inferior direito
  ctx.save();
  ctx.translate(940, 1830);
  ctx.rotate((12 * Math.PI) / 180);
  // Fundo do selo (medir antes pra calcular tamanho)
  ctx.font = '22px Bungee';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Tracking visual: usar mesmo padrão do MINHA NOTA
  const seloLabel = 'ED. 2026';
  const espacamento = 4;
  let larguraTexto = 0;
  for (const ch of seloLabel) larguraTexto += ctx.measureText(ch).width + espacamento;
  larguraTexto -= espacamento;
  const padX = 24;
  const padY = 12;
  const altura = 22 + padY * 2;
  const largura = larguraTexto + padX * 2;
  ctx.fillStyle = '#f4b942';
  ctx.fillRect(-largura / 2, -altura / 2, largura, altura);
  // Texto
  ctx.fillStyle = '#1a1410';
  let x = -larguraTexto / 2;
  for (const ch of seloLabel) {
    const w = ctx.measureText(ch).width;
    ctx.fillText(ch, x + w / 2, 0);
    x += w + espacamento;
  }
  ctx.restore();
}
```

- [ ] **Step 3: Compor obs + rodapé em desenharCard**

Atualizar `desenharCard`. Atualizar destructure:
```js
async function desenharCard(dados) {
  const { nome, boteco, prato, nota, obs, foto } = dados;
```

Ao final, depois de `desenharNota(ctx, nota);`, adicionar:
```js
  const temObs = obs && obs.trim().length > 0;
  if (temObs) {
    desenharObs(ctx, obs.trim());
    desenharRodape(ctx, nome, 1620);
  } else {
    desenharRodape(ctx, nome, 1380);
  }
```

- [ ] **Step 4: Verificar no navegador (com obs)**

1. Recarregar `http://localhost:8000`
2. Console:
```js
const c = await window.CDB_SHARE._desenharCard({
  nome: 'Vinicius',
  boteco: 'Bar do Soró',
  prato: 'Surpresinha do Soró',
  foto: 'images/bar-do-soro.jpg',
  nota: 4,
  obs: 'cerveja gelada e o atendimento foi nota mil. voltarei!'
});
document.body.appendChild(c);
c.style.cssText = 'position:fixed;top:0;left:0;width:270px;z-index:9999;border:2px solid red';
```

Esperado: depois do bloco da nota, bloco creme/paper com aspas grandes vermelhas opacas e texto da observação em letra cursiva marrom escuro centralizado. Embaixo, faixa preta com "@vinicius JOGOU NO COMIDA DI BUTECO MOC" em amarelo, URL "vateiixeira.github.io/comidadebuteco" creme abaixo, e selo amarelo "ED. 2026" rotacionado no canto direito.

- [ ] **Step 5: Verificar no navegador (sem obs)**

```js
document.body.removeChild(c);
const c2 = await window.CDB_SHARE._desenharCard({
  nome: 'Vi',
  boteco: 'Bar do Soró',
  prato: 'Surpresinha',
  foto: 'images/bar-do-soro.jpg',
  nota: 5,
  obs: ''
});
document.body.appendChild(c2);
c2.style.cssText = 'position:fixed;top:0;left:0;width:270px;z-index:9999;border:2px solid red';
```

Esperado: sem o bloco creme da obs. Faixa preta do rodapé sobe e fica maior (de 1380 a 1920 = 540px de altura). Selo "ED. 2026" continua no canto direito.

- [ ] **Step 6: Verificar obs longa (truncamento)**

```js
document.body.removeChild(c2);
const c3 = await window.CDB_SHARE._desenharCard({
  nome: 'Vinicius', boteco: 'Bar Teste', prato: 'Prato Teste', foto: 'images/bar-do-soro.jpg', nota: 3,
  obs: 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation'
});
document.body.appendChild(c3);
c3.style.cssText = 'position:fixed;top:0;left:0;width:270px;z-index:9999;border:2px solid red';
```

Esperado: obs aparece truncada com "..." ao final, em até 4 linhas, sem vazar do bloco.

- [ ] **Step 7: Commit**

```bash
git add share.js
git commit -m "feat - bloco de obs e rodape do card de share"
```

---

## Task 5: Implementar share API + fallback de download

Substitui o stub `compartilharAvaliacao` pela implementação real: gera blob, tenta `navigator.share`, faz download como fallback.

**Files:**
- Modify: `share.js`

- [ ] **Step 1: Adicionar função canvasParaBlob**

Adicionar entre `desenharCard` e `window.CDB_SHARE`:

```js
function canvasParaBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob retornou null'));
      },
      'image/png'
    );
  });
}
```

- [ ] **Step 2: Adicionar função fazerDownload**

```js
function fazerDownload(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 3: Substituir o stub compartilharAvaliacao**

Localizar:
```js
async compartilharAvaliacao(_dados) {
  throw new Error('not implemented yet');
},
```

Substituir por:
```js
async compartilharAvaliacao(dados) {
  const canvas = await desenharCard(dados);
  const blob = await canvasParaBlob(canvas);
  const slug = slugBoteco(dados.boteco);
  const nomeArquivo = `comida-di-buteco-${slug}.png`;
  const file = new File([blob], nomeArquivo, { type: 'image/png' });

  // Tenta share API primeiro
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return { metodo: 'share' };
    } catch (e) {
      // Usuário cancelou (AbortError) — não é erro, retorna sem dar share
      if (e.name === 'AbortError') return { metodo: 'cancelado' };
      // Outro erro: cai no fallback de download
      console.warn('navigator.share falhou, fazendo download', e);
    }
  }

  // Fallback: download
  fazerDownload(blob, nomeArquivo);
  return { metodo: 'download' };
},
```

- [ ] **Step 4: Verificar no navegador (desktop — fallback download)**

1. Recarregar `http://localhost:8000`
2. Console:
```js
const r = await window.CDB_SHARE.compartilharAvaliacao({
  nome: 'Vinicius',
  boteco: 'Bar do Soró',
  prato: 'Surpresinha do Soró',
  foto: 'images/bar-do-soro.jpg',
  nota: 4,
  obs: 'muito bom!'
});
console.log(r);
```

Esperado em desktop: navegador baixa um arquivo `comida-di-buteco-bar-do-soro.png`. Console imprime `{metodo: 'download'}`. Abre o PNG e confere visualmente: 1080×1920, todas as seções no lugar (branding, foto, nota, obs, rodapé).

- [ ] **Step 5: Verificar no navegador (mobile emulado — share)**

No DevTools, ativar modo dispositivo (Ctrl+Shift+M), perfil iPhone. Recarregar a página. Repetir o teste do Step 4.

Em emulador desktop o `canShare` ainda pode retornar false (depende do navegador). Se cair no download, ok. Se conseguir testar em celular real depois, o resultado deve ser `{metodo: 'share'}` e abrir a sheet nativa.

- [ ] **Step 6: Commit**

```bash
git add share.js
git commit -m "feat - share API com fallback de download para o card"
```

---

## Task 6: Adicionar toast no app.js + index.html

Adiciona estado de toast no Vue e o componente que mostra na tela.

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Adicionar state e função mostrarToast em app.js**

Localizar a seção `// ----- estado -----` em `app.js` (linha ~56). Depois de `const agregadosAvaliacoes = ref([]);` (linha ~82), adicionar:

```js
    const toast = ref(null); // { msg, tipo } ou null
    let toastTimer = null;
```

Localizar a seção `// ----- helpers -----` (linha ~148). Antes de `function telefoneValido`, adicionar:

```js
    function mostrarToast(msg, tipo = 'sucesso') {
      toast.value = { msg, tipo };
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.value = null; }, 4000);
    }
```

- [ ] **Step 2: Expor toast no return**

Localizar o return final do `setup()` (linha ~382). Adicionar `toast` na seção `// state`:

```js
    return {
      // state
      user, ratings, filtro, aberto,
      telefoneInput, nomeInput, precisaNome, erroLogin, carregandoLogin, carregandoApp,
      notaInput, obsInput, carregandoModal,
      userLocation, obtendoLocal, erroLocal,
      feedAvaliacoes, carregandoFeed, erroFeed, agregadosAvaliacoes,
      toast,
```

- [ ] **Step 3: Adicionar componente toast no index.html**

Localizar o final do `<div id="app">` (linha ~464, fechamento do `</div>` do app principal). Antes do `</div>` que fecha `#app`, adicionar:

```html
      <!-- =========================================================
           TOAST
           ========================================================= -->
      <div
        v-if="toast"
        class="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-6 py-4 border-2 border-[#1a1410] shadow-[4px_4px_0_#1a1410] animate-fadeIn font-handwritten text-xl max-w-[90vw] text-center"
        :class="toast.tipo === 'erro' ? 'bg-[#c83c1f] text-[#fffaee]' : 'bg-[#f4b942] text-[#1a1410]'"
      >
        {{ toast.msg }}
      </div>
```

- [ ] **Step 4: Verificar no navegador**

1. Recarregar `http://localhost:8000`, fazer login
2. Console:
```js
// Acessa o app Vue (via internal Vue ref)
const vm = document.querySelector('#app').__vue_app__._instance.proxy;
vm.toast = { msg: 'salvo no caderninho!', tipo: 'sucesso' };
```

Esperado: toast amarelo aparece no rodapé centralizado, com borda preta e sombra hard, texto cursivo. Some sozinho depois de... espera, esse teste seta direto, então não dispara o timer. Pra testar o timer, precisa chamar a função:

```js
// Simula chamando via ação Vue
vm.$.setupState.toast = { msg: 'teste timer', tipo: 'sucesso' };
// Aguarda 4s e verifica que sumiu (não some sozinho nesse caso, só via mostrarToast)
```

Verificação alternativa que dispara o timer:
- Implementar primeiro a Task 7 (que chama `mostrarToast`) e testar o timer no fluxo real.
- Por enquanto, validação visual: setar o `toast` direto e confirmar que o componente renderiza corretamente.

Testar variante de erro:
```js
vm.toast = { msg: 'deu ruim ao gerar a imagem', tipo: 'erro' };
```

Esperado: toast com fundo vermelho, texto creme. Mesmo posicionamento e estilo.

Limpar:
```js
vm.toast = null;
```

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "feat - componente de toast com state em app.js"
```

---

## Task 7: Adicionar botão de share no modal + integração

Adiciona o botão "compartilhar no insta" no modal e a função `compartilharAvaliacaoAtual` que conecta tudo.

**Files:**
- Modify: `app.js`
- Modify: `index.html`

- [ ] **Step 1: Adicionar state carregandoShare em app.js**

Localizar (linha ~73): `const carregandoModal = ref(false);`

Adicionar logo abaixo:
```js
    const carregandoShare = ref(false);
```

- [ ] **Step 2: Adicionar função compartilharAvaliacaoAtual em app.js**

Localizar a função `apagarRating` (linha ~337). Depois dela (antes do `// ----- mount`), adicionar:

```js
    async function compartilharAvaliacaoAtual() {
      if (!aberto.value || !ratings.value[aberto.value.id]) return;
      const r = ratings.value[aberto.value.id];
      const dish = aberto.value;
      carregandoShare.value = true;
      try {
        const res = await window.CDB_SHARE.compartilharAvaliacao({
          nome: user.value.nome,
          boteco: dish.boteco,
          prato: dish.prato,
          nota: r.nota,
          obs: r.obs,
          foto: dish.foto,
        });
        if (res.metodo === 'download') {
          mostrarToast('imagem salva! abre o insta e posta como story', 'sucesso');
        }
      } catch (e) {
        console.error('compartilhar', e);
        mostrarToast('deu ruim ao gerar a imagem', 'erro');
      } finally {
        carregandoShare.value = false;
      }
    }
```

- [ ] **Step 3: Expor carregandoShare e compartilharAvaliacaoAtual no return**

Localizar o return final. Atualizar:

`// state` — adicionar `carregandoShare`:
```js
      notaInput, obsInput, carregandoModal, carregandoShare,
```

`// actions` — adicionar `compartilharAvaliacaoAtual`:
```js
      handleLogin, handleLogout, handleTelefoneInput,
      abrirModal, fecharModal, salvarRating, apagarRating, compartilharAvaliacaoAtual,
      selecionarPerto,
      carregarFeed, selecionarGalera,
```

- [ ] **Step 4: Adicionar botão no modal em index.html**

Localizar o botão "ATUALIZAR / SALVAR AVALIAÇÃO" (linha ~440-448) e o botão "APAGAR AVALIAÇÃO" (linha ~450-460).

Entre os dois, adicionar:

```html
            <button
              v-if="ratings[aberto.id]"
              @click="compartilharAvaliacaoAtual"
              :disabled="carregandoShare"
              class="mt-2 w-full bg-[#c83c1f] text-[#fffaee] py-3 font-display tracking-[0.2em] text-sm hover:bg-[#1a1410] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg v-if="carregandoShare" class="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
              <span>{{ carregandoShare ? 'GERANDO IMAGEM...' : 'COMPARTILHAR NO INSTA' }}</span>
            </button>
```

- [ ] **Step 5: Verificar no navegador (fluxo completo)**

1. Recarregar `http://localhost:8000`, fazer login
2. Salvar uma avaliação em qualquer boteco (ex: nota 4 + obs "muito bom")
3. Reabrir o modal do mesmo boteco

Esperado: botão "COMPARTILHAR NO INSTA" vermelho aparece entre ATUALIZAR e APAGAR, com ícone de Instagram (câmera quadrada).

4. Clicar em COMPARTILHAR NO INSTA

Esperado em desktop: botão entra em loading com spinner + texto "GERANDO IMAGEM...". Depois de ~500ms, navegador baixa o PNG e aparece toast amarelo "imagem salva! abre o insta e posta como story" no rodapé. Toast some sozinho em 4s.

5. Conferir o PNG baixado: verificar visualmente que tem branding, foto, nota correta, obs correta, nome de usuário correto e selo ED. 2026.

- [ ] **Step 6: Verificar avaliação nova (botão não deve aparecer)**

1. Abrir o modal de um boteco que ainda não foi avaliado

Esperado: só botão SALVAR AVALIAÇÃO. Sem botão de compartilhar e sem botão de apagar.

- [ ] **Step 7: Verificar erro (foto inválida — manual)**

Não dá pra simular erro real fácil sem mexer no código. Pular esse caso na verificação manual — o caminho de erro foi coberto no try/catch e mostra toast vermelho.

- [ ] **Step 8: Commit**

```bash
git add app.js index.html
git commit -m "feat - botao compartilhar no insta no modal de avaliacao"
```

---

## Task 8: Limpeza de debug e verificação final

Remove os helpers `_slugBoteco`, `_wrapText` e `_desenharCard` que foram expostos pra debug, deixando só a API pública. Faz um sanity check geral.

**Files:**
- Modify: `share.js`

- [ ] **Step 1: Remover exposições de debug em share.js**

Localizar:
```js
window.CDB_SHARE = {
  _slugBoteco: slugBoteco,
  _wrapText: wrapText,
  _desenharCard: desenharCard,
  async compartilharAvaliacao(dados) {
```

Substituir por:
```js
window.CDB_SHARE = {
  async compartilharAvaliacao(dados) {
```

- [ ] **Step 2: Verificar que o app continua funcionando**

1. Recarregar `http://localhost:8000`, fazer login
2. Console: `window.CDB_SHARE._desenharCard` → esperado `undefined`
3. Console: `typeof window.CDB_SHARE.compartilharAvaliacao` → esperado `'function'`
4. Repetir o fluxo do Task 7 Step 5 (clicar compartilhar) — deve funcionar igual.

- [ ] **Step 3: Verificação final no celular real (se possível)**

Se você tiver o site no GitHub Pages ou rodar `python -m http.server 8000 --bind 0.0.0.0` e acessar pelo IP da rede local no celular:

1. Abrir no Safari iOS ou Chrome Android
2. Login, salvar avaliação, reabrir modal
3. Clicar COMPARTILHAR NO INSTA
4. Esperado: sheet nativa abre. Instagram aparece como destino. Selecionar Instagram → vai pro picker de Story/DM.
5. Postar como Story e conferir o resultado no Insta.

Se não der pra testar no celular agora, ok — o caminho desktop já validou geração + download. Marcar pra testar quando puder.

- [ ] **Step 4: Commit final**

```bash
git add share.js
git commit -m "fix - remove helpers de debug do share.js"
```

---

## Resumo dos commits esperados

```
feat - esqueleto de share.js com helpers slugBoteco e wrapText
feat - desenho da faixa de branding e foto do card de share
feat - bloco de nota com estrelas e label do card de share
feat - bloco de obs e rodape do card de share
feat - share API com fallback de download para o card
feat - componente de toast com state em app.js
feat - botao compartilhar no insta no modal de avaliacao
fix - remove helpers de debug do share.js
```

8 commits, escopo isolado por commit, fácil de reverter qualquer pedaço sem afetar o resto.
