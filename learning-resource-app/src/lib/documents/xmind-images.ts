import type JSZip from "jszip";
import { Readable } from "node:stream";
import { loadImage } from "@napi-rs/canvas";

export type XmindImage = { source: string; dataUrl?: string; width?: number; height?: number; warning?: string };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

// Only resources physically inside the workbook. Never fetch links or read disk paths.
export function xmindResourcePath(source: string) {
  let value: string;
  try { value = decodeURIComponent(source.replace(/^xap:/i, "")); } catch { return null; }
  if (!/^(resources|attachments)\//.test(value) || /[\\:\u0000?#]/.test(value)) return null;
  if (value.split("/").some(part => !part || part === "." || part === "..")) return null;
  return value;
}

// Read dimensions BEFORE decoding, so a tiny compressed pixel bomb cannot allocate huge memory.
export function rasterInfo(data: Buffer): { mime: string; width: number; height: number } | null {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return { mime: "image/png", width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length >= 4 && data[0] === 255 && data[1] === 216) {
    let offset = 2;
    while (offset + 4 <= data.length) {
      if (data[offset++] !== 255) return null;
      while (data[offset] === 255) offset++;
      const marker = data[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > data.length) return null;
      const size = data.readUInt16BE(offset);
      if (size < 2 || offset + size > data.length) return null;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && size >= 7) {
        return { mime: "image/jpeg", height: data.readUInt16BE(offset + 3), width: data.readUInt16BE(offset + 5) };
      }
      offset += size;
    }
  }
  if (data.length >= 30 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    const kind = data.toString("ascii", 12, 16);
    if (kind === "VP8X") return { mime: "image/webp", width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    if (kind === "VP8 " && data.subarray(23, 26).equals(Buffer.from([157,1,42]))) return { mime: "image/webp", width: data.readUInt16LE(26) & 16383, height: data.readUInt16LE(28) & 16383 };
    if (kind === "VP8L" && data[20] === 47) {
      const bits = data.readUInt32LE(21);
      return { mime: "image/webp", width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
    }
  }
  return null;
}

export function createXmindImageReader(zip: JSZip) {
  let total = 0;
  let references = 0;
  const cache = new Map<string, XmindImage>();
  return async (source: string): Promise<XmindImage> => {
    if (++references > 100) return { source, warning: "Vượt giới hạn 100 ảnh nhúng; ảnh này chưa được đọc." };
    const cached = cache.get(source);
    if (cached) {
      if (cached.dataUrl) total += Buffer.byteLength(cached.dataUrl.split(",")[1], "base64");
      return total > MAX_TOTAL_BYTES ? { source, warning: "Tổng ảnh hiển thị vượt 32 MB; ảnh này chưa được đọc." } : cached;
    }
    let result: XmindImage;
    try {
      const resource = xmindResourcePath(source);
      if (!resource) throw new Error("Đường dẫn ảnh không được hỗ trợ; chỉ đọc ảnh nhúng trong XMind.");
      const entry = zip.file(resource);
      if (!entry || (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName?.includes("..")) throw new Error("Ảnh nhúng bị thiếu hoặc có đường dẫn không an toàn.");
      const stream = new Readable().wrap(entry.nodeStream());
      const parts: Buffer[] = [];
      let bytes = 0;
      try {
        for await (const part of stream) {
          bytes += part.length;
          total += part.length;
          if (bytes > MAX_IMAGE_BYTES || total > MAX_TOTAL_BYTES) throw new Error("Ảnh vượt 8 MB hoặc tổng ảnh vượt 32 MB sau giải nén.");
          parts.push(part);
        }
      } finally { stream.destroy(); }
      const data = Buffer.concat(parts);
      const info = rasterInfo(data);
      if (!info) throw new Error("Ảnh hỏng hoặc không phải PNG/JPEG/WebP được hỗ trợ.");
      if (info.width < 1 || info.height < 1 || info.width > 10000 || info.height > 10000 || info.width * info.height > 16_000_000) throw new Error("Ảnh vượt giới hạn 16 triệu điểm ảnh hoặc kích thước không hợp lệ.");
      await loadImage(data); // reject corrupt bitstreams, not just valid-looking headers
      result = { source, width: info.width, height: info.height, dataUrl: `data:${info.mime};base64,${data.toString("base64")}` };
    } catch (error) {
      result = { source, warning: error instanceof Error ? error.message : "Không đọc được ảnh nhúng." };
    }
    cache.set(source, result);
    return result;
  };
}
