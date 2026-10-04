function renderTile({ width, height, y, rows, iterations }) {
  const pixels = Buffer.alloc(width * rows * 3);
  for (let row = 0; row < rows; row++) {
    const cy = ((y + row) / height) * 2.4 - 1.2;
    for (let x = 0; x < width; x++) {
      const cx = (x / width) * 3.4 - 2.5;
      let zx = 0, zy = 0, n = 0;
      while (zx * zx + zy * zy <= 4 && n < iterations) {
        const nextX = zx * zx - zy * zy + cx;
        zy = 2 * zx * zy + cy;
        zx = nextX;
        n++;
      }
      const i = (row * width + x) * 3;
      if (n === iterations) {
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      } else {
        const t = n / iterations;
        pixels[i] = Math.floor(9 * (1 - t) * t * t * t * 255);
        pixels[i + 1] = Math.floor(15 * (1 - t) * (1 - t) * t * t * 255);
        pixels[i + 2] = Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255);
      }
    }
  }
  return pixels;
}
module.exports = { renderTile };
