// =====================================================================
// Comida di Buteco — Compartilhamento (geração de imagem + share API)
// =====================================================================

(function () {
  const NOTA_LABELS_SHARE = ['', 'fugiu...', 'meia boca', 'mais ou menos', 'muito bom!', 'trem da gota!'];
  const MESES_SHARE = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

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

  function formatarData(data) {
    if (!data) return '';
    const d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()} ${MESES_SHARE[d.getMonth()]} ${d.getFullYear()}`;
  }

  function aplicarRuidoPapel(ctx, x, y, w, h) {
    // Especks aleatórios pra textura sutil de papel
    const original = ctx.fillStyle;
    const numEspecks = Math.floor((w * h) / 600);
    for (let i = 0; i < numEspecks; i++) {
      const px = x + Math.random() * w;
      const py = y + Math.random() * h;
      const size = Math.random() * 1.2 + 0.4;
      const alpha = Math.random() * 0.13;
      ctx.fillStyle = `rgba(80, 50, 30, ${alpha})`;
      ctx.fillRect(px, py, size, size);
    }
    ctx.fillStyle = original;
  }

  function drawStar(ctx, cx, cy, size, fill, stroke) {
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

  function carregarImagem(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function desenharComTracking(ctx, texto, cx, cy, espacamento) {
    let largura = 0;
    for (const ch of texto) largura += ctx.measureText(ch).width + espacamento;
    largura -= espacamento;
    let x = cx - largura / 2;
    for (const ch of texto) {
      const w = ctx.measureText(ch).width;
      ctx.fillText(ch, x + w / 2, cy);
      x += w + espacamento;
    }
  }

  function desenharBranding(ctx) {
    // Faixa vermelha 0-75
    ctx.fillStyle = '#c83c1f';
    ctx.fillRect(0, 0, 810, 75);

    ctx.fillStyle = '#fffaee';
    ctx.font = '22px Bungee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    desenharComTracking(ctx, 'COMIDA DI BUTECO • MOC 2026', 405, 38, 3);
  }

  function desenharFoto(ctx, img, prato) {
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 75, 810, 795);

    if (img) {
      const scale = Math.max(810 / img.width, 795 / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (810 - drawW) / 2;
      const drawY = 75 + (795 - drawH) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 75, 810, 795);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#8b6f47';
      ctx.font = '700 38px Caveat';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`foto indisponível: ${prato}`, 405, 472);
    }

    // Gradiente preto no rodapé da foto pros nomes ficarem legíveis
    const grad = ctx.createLinearGradient(0, 650, 0, 870);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 650, 810, 220);
  }

  function desenharSeloEdicao(ctx, cx, cy) {
    // Selo amarelo rotacionado +12 deg (no canto superior direito da foto)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((12 * Math.PI) / 180);
    ctx.font = '18px Bungee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const seloLabel = 'ED. 2026';
    const espacamento = 3;
    let larguraTexto = 0;
    for (const ch of seloLabel) larguraTexto += ctx.measureText(ch).width + espacamento;
    larguraTexto -= espacamento;
    const padX = 18;
    const padY = 9;
    const altura = 18 + padY * 2;
    const largura = larguraTexto + padX * 2;
    // Sombra preta deslocada
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(-largura / 2 + 4, -altura / 2 + 4, largura, altura);
    // Selo amarelo
    ctx.fillStyle = '#f4b942';
    ctx.fillRect(-largura / 2, -altura / 2, largura, altura);
    // Borda preta
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 2;
    ctx.strokeRect(-largura / 2, -altura / 2, largura, altura);
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

  function desenharBotecoEPrato(ctx, boteco, prato) {
    // Selo ED. 2026 no canto superior direito da foto
    desenharSeloEdicao(ctx, 715, 130);

    // Nome do boteco em Bungee 26 branco/creme
    ctx.fillStyle = '#fffaee';
    ctx.font = '26px Bungee';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(boteco, 45, 720);

    // Nome do prato em Caveat 60 amarelo, rotacionado -1deg
    ctx.save();
    ctx.translate(45, 780);
    ctx.rotate(-Math.PI / 180);
    ctx.fillStyle = '#f4b942';
    ctx.font = '700 60px Caveat';
    ctx.textBaseline = 'alphabetic';

    const linhas = wrapText(ctx, prato, 720);
    for (let i = 0; i < linhas.length && i < 2; i++) {
      ctx.fillText(linhas[i], 0, i * 65);
    }
    ctx.restore();
  }

  function desenharNota(ctx, nota, data) {
    // Fundo creme 870-1140
    ctx.fillStyle = '#fffaee';
    ctx.fillRect(0, 870, 810, 270);

    aplicarRuidoPapel(ctx, 0, 870, 810, 270);

    // Borda inferior tracejada
    ctx.save();
    ctx.strokeStyle = '#8b6f47';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(45, 1138);
    ctx.lineTo(765, 1138);
    ctx.stroke();
    ctx.restore();

    // Label "MINHA NOTA"
    ctx.fillStyle = '#5c4a2f';
    ctx.font = '20px Bungee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    desenharComTracking(ctx, 'MINHA NOTA', 405, 895, 6);

    // 5 estrelas, 140px cada, gap 9
    const tamEstrela = 140;
    const gap = 9;
    const larguraEstrelas = 5 * tamEstrela + 4 * gap;
    const inicioX = 405 - larguraEstrelas / 2;
    for (let i = 0; i < 5; i++) {
      const cx = inicioX + i * (tamEstrela + gap) + tamEstrela / 2;
      if (nota >= i + 1) {
        drawStar(ctx, cx, 1000, tamEstrela, '#f4b942', '#c4901f');
      } else {
        drawStar(ctx, cx, 1000, tamEstrela, null, '#8b6f47');
      }
    }

    // Label da nota em Caveat rotacionado -1deg
    const notaLabel = NOTA_LABELS_SHARE[nota] || '';
    if (notaLabel) {
      ctx.save();
      ctx.translate(405, 1085);
      ctx.rotate(-Math.PI / 180);
      ctx.fillStyle = '#c83c1f';
      ctx.font = '700 42px Caveat';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(notaLabel, 0, 0);
      ctx.restore();
    }

    // Data em Caveat menor, rotacionado +1deg
    const dataFormatada = formatarData(data);
    if (dataFormatada) {
      ctx.save();
      ctx.translate(405, 1120);
      ctx.rotate(Math.PI / 180);
      ctx.fillStyle = '#8b6f47';
      ctx.font = '700 22px Caveat';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dataFormatada, 0, 0);
      ctx.restore();
    }
  }

  function desenharObs(ctx, obs) {
    // Fundo paper bg 1140-1330
    ctx.fillStyle = '#f4ead5';
    ctx.fillRect(0, 1140, 810, 190);

    aplicarRuidoPapel(ctx, 0, 1140, 810, 190);

    // Aspas decorativas
    ctx.save();
    ctx.fillStyle = 'rgba(200, 60, 31, 0.3)';
    ctx.font = '90px Bungee';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('"', 30, 1150);
    ctx.textAlign = 'right';
    ctx.fillText('"', 780, 1215);
    ctx.restore();

    // Trunca obs em ~100 chars
    let texto = obs;
    if (texto.length > 100) texto = texto.slice(0, 97).trimEnd() + '...';

    // Texto da obs em Caveat 38
    ctx.fillStyle = '#3d2f20';
    ctx.font = '700 38px Caveat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const linhas = wrapText(ctx, texto, 690);
    const lineHeight = 44;
    const limMax = 3;
    const usadas = Math.min(linhas.length, limMax);
    const yCentro = 1235;
    const yInicio = yCentro - ((usadas - 1) * lineHeight) / 2;
    for (let i = 0; i < usadas; i++) {
      ctx.fillText(linhas[i], 405, yInicio + i * lineHeight);
    }
  }

  function desenharAreaSemObs(ctx) {
    // Quando não tem obs, paper bg liso entre rating e footer
    ctx.fillStyle = '#f4ead5';
    ctx.fillRect(0, 1140, 810, 190);
    aplicarRuidoPapel(ctx, 0, 1140, 810, 190);
  }

  function desenharRodape(ctx, nome) {
    // Fundo preto 1330-1440 (110px tall — bem mais enxuto)
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 1330, 810, 110);

    const apelido = (nome || '').toLowerCase().replace(/\s+/g, '');

    // "@apelido esteve aqui!" em Caveat handwritten
    ctx.fillStyle = '#f4b942';
    ctx.font = '700 32px Caveat';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`@${apelido} esteve aqui!`, 405, 1370);

    // URL embaixo, pequena
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#fffaee';
    ctx.font = '13px Bungee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('vateiixeira.github.io/comidadebuteco', 405, 1408);
    ctx.restore();
  }

  async function desenharCard(dados) {
    const { nome, boteco, prato, nota, obs, foto, data } = dados;

    // Garante que as fontes carregaram (timeout 2s)
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('700 60px Caveat'),
          document.fonts.load('400 26px Bungee'),
          document.fonts.load('400 22px Lora'),
        ]),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (_) {
      // Segue desenhando com fallback de fonte do sistema
    }

    const canvas = document.createElement('canvas');
    canvas.width = 810;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';

    // Background paper geral
    ctx.fillStyle = '#f4ead5';
    ctx.fillRect(0, 0, 810, 1440);

    desenharBranding(ctx);

    const img = await carregarImagem(foto);
    desenharFoto(ctx, img, prato);
    desenharBotecoEPrato(ctx, boteco, prato);
    desenharNota(ctx, nota, data);

    const temObs = obs && obs.trim().length > 0;
    if (temObs) {
      desenharObs(ctx, obs.trim());
    } else {
      desenharAreaSemObs(ctx);
    }

    desenharRodape(ctx, nome);

    return canvas;
  }

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

  window.CDB_SHARE = {
    async compartilharAvaliacao(dados) {
      const canvas = await desenharCard(dados);
      const blob = await canvasParaBlob(canvas);
      const slug = slugBoteco(dados.boteco);
      const nomeArquivo = `comida-di-buteco-${slug}.png`;
      const file = new File([blob], nomeArquivo, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return { metodo: 'share' };
        } catch (e) {
          if (e.name === 'AbortError') return { metodo: 'cancelado' };
          console.warn('navigator.share falhou, fazendo download', e);
        }
      }

      fazerDownload(blob, nomeArquivo);
      return { metodo: 'download' };
    },
  };
})();
