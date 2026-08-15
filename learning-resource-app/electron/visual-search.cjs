/* eslint-disable @typescript-eslint/no-require-imports */

function normalizeCaptureRectangle(value, contentBounds) {
  if (!value || typeof value !== "object") throw new Error("Vùng chọn không hợp lệ.");
  const rectangle = {
    x: Math.round(Number(value.x)),
    y: Math.round(Number(value.y)),
    width: Math.round(Number(value.width)),
    height: Math.round(Number(value.height)),
  };
  if (!Object.values(rectangle).every(Number.isFinite)) throw new Error("Vùng chọn không hợp lệ.");
  if (rectangle.width < 12 || rectangle.height < 12) {
    throw new Error("Vùng chọn quá nhỏ để nhận dạng.");
  }
  if (rectangle.width > 4096 || rectangle.height > 4096 || rectangle.width * rectangle.height > 8_000_000) {
    throw new Error("Vùng chọn quá lớn. Hãy chọn một phần nội dung nhỏ hơn.");
  }
  if (
    rectangle.x < 0
    || rectangle.y < 0
    || rectangle.x + rectangle.width > contentBounds.width
    || rectangle.y + rectangle.height > contentBounds.height
  ) {
    throw new Error("Vùng chọn nằm ngoài cửa sổ ứng dụng.");
  }
  return rectangle;
}

module.exports = { normalizeCaptureRectangle };
