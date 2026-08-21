import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDirectory = path.join(
  projectRoot,
  "test-fixtures",
  "scholarflow",
  "03_negative_cases",
);
const targetPath = path.join(targetDirectory, "02_file_qua_40mb.pdf");

await mkdir(targetDirectory, { recursive: true });
await writeFile(targetPath, Buffer.alloc(40 * 1024 * 1024 + 1));
console.log(`Đã tạo file kiểm thử dung lượng: ${targetPath}`);
