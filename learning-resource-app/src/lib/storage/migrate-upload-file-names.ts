import { access, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import {
  createNamedUploadStorageLocation,
  resolveStoredUploadPath,
} from "@/lib/storage/local-storage";

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Move legacy UUID-named uploads into readable, per-document directories. */
export async function migrateUploadFileNames() {
  const documents = await db.document.findMany({
    select: { id: true, filePath: true, originalFileName: true },
  });
  let migrated = 0;

  for (const document of documents) {
    const sourcePath = resolveStoredUploadPath(document.filePath);
    if (!sourcePath) continue;
    const destination = createNamedUploadStorageLocation(document.id, document.originalFileName);
    if (path.resolve(sourcePath) === path.resolve(destination.absolutePath)) continue;

    const sourceExists = await exists(sourcePath);
    const destinationExists = await exists(destination.absolutePath);
    if (!sourceExists && !destinationExists) continue;

    await mkdir(destination.directory, { recursive: true });
    if (sourceExists && !destinationExists) await rename(sourcePath, destination.absolutePath);

    try {
      await db.document.update({
        where: { id: document.id },
        data: { filePath: destination.storedPath },
      });
      migrated += 1;
    } catch (error) {
      if (sourceExists && !destinationExists && await exists(destination.absolutePath)) {
        await rename(destination.absolutePath, sourcePath).catch(() => undefined);
      }
      throw error;
    }
  }

  return migrated;
}
