// Corta automaticamente as bordas transparentes ou brancas de uma imagem,
// para que logos com "sobra" de espaço em branco ao redor pareçam do mesmo
// tamanho que logos que já preenchem todo o quadro.
//
// Funciona apenas para imagens do mesmo dominio (uploads locais) ou de
// servidores que permitem CORS. Se nao for possivel (imagem externa sem
// CORS), a imagem original e mantida sem cortes, sem quebrar nada.
window.autoTrimImage = function (url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const { data } = ctx.getImageData(0, 0, w, h);

        // referencia de fundo: media dos 4 cantos da imagem
        function pixelAt(x, y) {
          const idx = (y * w + x) * 4;
          return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        }
        const corners = [pixelAt(0, 0), pixelAt(w - 1, 0), pixelAt(0, h - 1), pixelAt(w - 1, h - 1)];
        const avgAlpha = corners.reduce((s, c) => s + c[3], 0) / 4;
        const bgIsTransparent = avgAlpha < 10;
        const refColor = bgIsTransparent
          ? [255, 255, 255]
          : [
              corners.reduce((s, c) => s + c[0], 0) / 4,
              corners.reduce((s, c) => s + c[1], 0) / 4,
              corners.reduce((s, c) => s + c[2], 0) / 4
            ];

        const COLOR_TOLERANCE = 18; // distancia de cor para considerar "igual ao fundo"

        function isBackground(idx) {
          const a = data[idx + 3];
          if (a < 10) return true; // pixel transparente sempre conta como fundo
          if (bgIsTransparent) return false; // fundo transparente, mas esse pixel tem cor -> conteudo
          const dr = data[idx] - refColor[0];
          const dg = data[idx + 1] - refColor[1];
          const db = data[idx + 2] - refColor[2];
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          return dist < COLOR_TOLERANCE;
        }

        // tolera uma pequena quantidade de ruido/sombra suave por linha/coluna,
        // em vez de exigir 100% dos pixels como fundo
        const rowNoiseLimit = Math.max(2, Math.round(w * 0.006));
        const colNoiseLimit = Math.max(2, Math.round(h * 0.006));

        function rowHasContent(y) {
          const base = y * w * 4;
          let count = 0;
          for (let x = 0; x < w; x++) {
            if (!isBackground(base + x * 4)) {
              count++;
              if (count > rowNoiseLimit) return true;
            }
          }
          return false;
        }
        function colHasContent(x) {
          let count = 0;
          for (let y = 0; y < h; y++) {
            if (!isBackground((y * w + x) * 4)) {
              count++;
              if (count > colNoiseLimit) return true;
            }
          }
          return false;
        }

        let top = 0, bottom = h - 1, left = 0, right = w - 1;
        while (top < bottom && !rowHasContent(top)) top++;
        while (bottom > top && !rowHasContent(bottom)) bottom--;
        while (left < right && !colHasContent(left)) left++;
        while (right > left && !colHasContent(right)) right--;

        const cw = right - left + 1;
        const ch = bottom - top + 1;

        // nada relevante para cortar
        if (cw <= 0 || ch <= 0 || (cw >= w * 0.98 && ch >= h * 0.98)) {
          resolve(null);
          return;
        }

        const out = document.createElement('canvas');
        out.width = cw;
        out.height = ch;
        out.getContext('2d').drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL('image/png'));
      } catch (e) {
        // provavelmente imagem de outro dominio sem CORS liberado
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
};
