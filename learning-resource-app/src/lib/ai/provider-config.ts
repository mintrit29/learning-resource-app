import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const providerTypes = ["OPENROUTER", "OLLAMA", "CUSTOM"] as const;
export type ProviderType = (typeof providerTypes)[number];

export const providerSchema = z.object({
  type: z.enum(providerTypes),
  displayName: z.string().trim().min(2).max(80),
  baseUrl: z.url().trim(),
  apiKey: z.string().trim().max(500).optional().default(""),
  defaultChatModel: z.string().trim().min(1).max(160),
  isActive: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (value.type !== "OLLAMA" && !value.apiKey) {
    context.addIssue({ code: "custom", path: ["apiKey"], message: "API key là bắt buộc" });
  }
});

function encryptionKey() {
  const secret = process.env.AI_PROVIDER_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("Thiếu AI_PROVIDER_ENCRYPTION_KEY hoặc AUTH_SECRET");
  return createHash("sha256").update(secret).digest();
}

export function encryptApiKey(value: string) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptApiKey(value: string | null) {
  if (!value) return "";
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("API key đã mã hóa không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export function publicProvider<T extends { apiKeyEncrypted: string | null }>(provider: T) {
  const { apiKeyEncrypted: _secret, ...safe } = provider;
  void _secret;
  return { ...safe, hasApiKey: Boolean(provider.apiKeyEncrypted) };
}
