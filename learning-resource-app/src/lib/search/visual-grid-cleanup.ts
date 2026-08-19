export function removeLongGridLines(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (width < 80 || height < 80 || data.length < width * height * 4) return false;
  const rows: number[] = [];
  const columns: number[] = [];
  const isDark = (offset: number) => (
    data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114
  ) < 180;

  for (let y = 0; y < height; y += 1) {
    let currentRun = 0;
    let longestRun = 0;
    for (let x = 0; x < width; x += 1) {
      if (isDark((y * width + x) * 4)) {
        currentRun += 1;
        longestRun = Math.max(longestRun, currentRun);
      } else {
        currentRun = 0;
      }
    }
    if (longestRun >= width * 0.45) rows.push(y);
  }
  for (let x = 0; x < width; x += 1) {
    let currentRun = 0;
    let longestRun = 0;
    for (let y = 0; y < height; y += 1) {
      if (isDark((y * width + x) * 4)) {
        currentRun += 1;
        longestRun = Math.max(longestRun, currentRun);
      } else {
        currentRun = 0;
      }
    }
    if (longestRun >= height * 0.45) columns.push(x);
  }
  if (rows.length < 2 || columns.length < 2) return false;

  const whitenPixel = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  };
  for (const row of rows) {
    for (let offset = -2; offset <= 2; offset += 1) {
      const y = row + offset;
      if (y < 0 || y >= height) continue;
      for (let x = 0; x < width; x += 1) whitenPixel(x, y);
    }
  }
  for (const column of columns) {
    for (let offset = -2; offset <= 2; offset += 1) {
      const x = column + offset;
      if (x < 0 || x >= width) continue;
      for (let y = 0; y < height; y += 1) whitenPixel(x, y);
    }
  }
  return true;
}
