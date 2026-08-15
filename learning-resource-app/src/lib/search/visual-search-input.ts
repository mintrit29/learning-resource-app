const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodeSearchRegionDataUrl(value: string) {
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error("Ảnh vùng chọn phải là PNG hoặc JPEG.");
  const buffer = Buffer.from(match[2], "base64");
  const isPng = buffer.length >= PNG_HEADER.length && buffer.subarray(0, PNG_HEADER.length).equals(PNG_HEADER);
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!isPng && !isJpeg) throw new Error("Dữ liệu ảnh vùng chọn không hợp lệ.");
  return buffer;
}
