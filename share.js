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
