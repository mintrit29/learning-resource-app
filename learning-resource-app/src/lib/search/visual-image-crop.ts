export type ImageCropRectangle = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type Size = { height: number; width: number };

/** Map a selection on an object-fit: contain preview back to original image pixels. */
export function mapSelectionToImageCrop(
  selection: ImageCropRectangle,
  preview: Size,
  image: Size,
): ImageCropRectangle | null {
  if (preview.width <= 0 || preview.height <= 0 || image.width <= 0 || image.height <= 0) return null;
  const scale = Math.min(preview.width / image.width, preview.height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const offsetX = (preview.width - renderedWidth) / 2;
  const offsetY = (preview.height - renderedHeight) / 2;
  const left = Math.max(offsetX, selection.x);
  const top = Math.max(offsetY, selection.y);
  const right = Math.min(offsetX + renderedWidth, selection.x + selection.width);
  const bottom = Math.min(offsetY + renderedHeight, selection.y + selection.height);
  if (right <= left || bottom <= top) return null;

  const x = Math.max(0, Math.floor((left - offsetX) / scale));
  const y = Math.max(0, Math.floor((top - offsetY) / scale));
  const rightPixel = Math.min(image.width, Math.ceil((right - offsetX) / scale));
  const bottomPixel = Math.min(image.height, Math.ceil((bottom - offsetY) / scale));
  return { x, y, width: rightPixel - x, height: bottomPixel - y };
}
