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

  function carregarImagem(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

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

  // Exporta no window pra uso pelo app.js
  window.CDB_SHARE = {
    _slugBoteco: slugBoteco,
    _wrapText: wrapText,
    _desenharCard: desenharCard,
    async compartilharAvaliacao(_dados) {
      throw new Error('not implemented yet');
    },
  };
})();
