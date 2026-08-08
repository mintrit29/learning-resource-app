import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const embeddingRuntimeRoot = path.join(projectRoot, "embedding-runtime");

async function requireDirectory(directory, label) {
  const info = await stat(directory).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`${label} chưa tồn tại: ${directory}`);
  }
}

await requireDirectory(standaloneRoot, "Next.js standalone output");
await requireDirectory(path.join(projectRoot, ".next", "static"), "Next.js static assets");
await requireDirectory(path.join(projectRoot, "prisma", "migrations"), "SQLite migrations");
await requireDirectory(
  path.join(embeddingRuntimeRoot, "node_modules", "@huggingface", "transformers"),
  "Local embedding runtime dependencies",
);

// Never ship development databases or a previously packaged application inside
// the next desktop bundle, even if file tracing encountered a migration copy.
await rm(path.join(standaloneRoot, "storage"), { recursive: true, force: true });
await rm(path.join(standaloneRoot, "dist-electron"), { recursive: true, force: true });

await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(path.join(projectRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static"), {
  recursive: true,
  force: true,
});
await cp(
  path.join(projectRoot, "prisma", "migrations"),
  path.join(standaloneRoot, "prisma", "migrations"),
  { recursive: true, force: true },
);

for (const dependency of [
  "sqlite-vec",
  "sqlite-vec-windows-x64",
  "@firecrawl/pdf-inspector",
  "@firecrawl/pdf-inspector-win32-x64-msvc",
  "docling.rs",
  "docling.rs-win32-x64-msvc",
]) {
  const dependencyRoot = path.join(projectRoot, "node_modules", dependency);
  await requireDirectory(dependencyRoot, dependency);
  await cp(
    dependencyRoot,
    path.join(standaloneRoot, "node_modules", dependency),
    { recursive: true, force: true },
  );
}

const publicDirectory = path.join(projectRoot, "public");
const publicInfo = await stat(publicDirectory).catch(() => null);
if (publicInfo?.isDirectory()) {
  await cp(publicDirectory, path.join(standaloneRoot, "public"), { recursive: true, force: true });
}

process.stdout.write(`Đã chuẩn bị desktop runtime tại ${standaloneRoot}\n`);
