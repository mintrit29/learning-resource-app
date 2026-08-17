import path from "node:path";

const DATA_ROOT_ENVIRONMENT_VARIABLE = "SCHOLARFLOW_DATA_ROOT";
const UPLOADS_DIRECTORY = "uploads";
const LEGACY_STORAGE_DIRECTORY = "storage";

function isSafePathSegment(value: string) {
  return (
    value.length > 0
    && value !== "."
    && value !== ".."
    && !value.includes("/")
    && !value.includes("\\")
    && !value.includes("\0")
  );
}

const WINDOWS_RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/** Keep the user's name readable while making it safe on desktop file systems. */
export function sanitizeUploadFileName(originalFileName: string) {
  const leafName = originalFileName.replaceAll("\\", "/").split("/").at(-1) ?? originalFileName;
  const cleaned = leafName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  const safeName = !cleaned || WINDOWS_RESERVED_FILE_NAME.test(cleaned)
    ? `document_${cleaned || "file"}`
    : cleaned;
  if (safeName.length <= 180) return safeName;

  const extension = path.extname(safeName).slice(0, 20);
  const baseName = safeName.slice(0, Math.max(1, 180 - extension.length)).replace(/[. ]+$/g, "");
  return `${baseName}${extension}`;
}

/**
 * Resolve ScholarFlow's writable data directory.
 *
 * Electron supplies an absolute SCHOLARFLOW_DATA_ROOT under app.getPath("userData").
 * Source-level tests fall back to <working directory>/storage.
 */
export function resolveScholarFlowDataRoot(
  configuredRoot = process.env[DATA_ROOT_ENVIRONMENT_VARIABLE],
  workingDirectory = process.cwd(),
) {
  const trimmedRoot = configuredRoot?.trim();
  if (trimmedRoot) {
    if (!path.isAbsolute(trimmedRoot)) {
      throw new Error(`${DATA_ROOT_ENVIRONMENT_VARIABLE} must be an absolute path`);
    }
    return path.resolve(trimmedRoot);
  }

  return path.resolve(workingDirectory, LEGACY_STORAGE_DIRECTORY);
}

export function isPathInside(root: string, candidate: string) {
  const relativePath = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relativePath === ""
    || (
      relativePath !== ".."
      && !relativePath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relativePath)
    )
  );
}

export function getUploadsRoot() {
  return path.join(resolveScholarFlowDataRoot(), UPLOADS_DIRECTORY);
}

export type UploadStorageLocation = {
  absolutePath: string;
  directory: string;
  storedPath: string;
};

export function createUploadStorageLocation(
  storedFileName: string,
): UploadStorageLocation {
  if (!isSafePathSegment(storedFileName)) {
    throw new Error("Invalid upload file name");
  }

  const directory = getUploadsRoot();
  const absolutePath = path.resolve(directory, storedFileName);
  if (!isPathInside(directory, absolutePath) || absolutePath === directory) {
    throw new Error("Invalid upload file path");
  }

  return {
    absolutePath,
    directory,
    storedPath: [UPLOADS_DIRECTORY, storedFileName].join("/"),
  };
}

export function createNamedUploadStorageLocation(
  storageId: string,
  originalFileName: string,
): UploadStorageLocation {
  const safeFileName = sanitizeUploadFileName(originalFileName);
  if (!isSafePathSegment(storageId) || !isSafePathSegment(safeFileName)) {
    throw new Error("Invalid named upload path");
  }

  const uploadsRoot = getUploadsRoot();
  const directory = path.resolve(uploadsRoot, storageId);
  const absolutePath = path.resolve(directory, safeFileName);
  if (!isPathInside(uploadsRoot, absolutePath) || absolutePath === uploadsRoot) {
    throw new Error("Invalid named upload path");
  }

  return {
    absolutePath,
    directory,
    storedPath: [UPLOADS_DIRECTORY, storageId, safeFileName].join("/"),
  };
}

function normalizeStoredUploadSegments(storedPath: string) {
  if (!storedPath || storedPath.includes("\0")) return null;

  const normalizedPath = storedPath.replaceAll("\\", "/");
  if (
    normalizedPath.startsWith("/")
    || normalizedPath.startsWith("//")
    || /^[A-Za-z]:\//.test(normalizedPath)
  ) {
    return null;
  }

  const segments = normalizedPath.split("/");
  if (segments.some((segment) => !isSafePathSegment(segment))) return null;

  // Files uploaded before SCHOLARFLOW_DATA_ROOT used a cwd-relative
  // storage/uploads/<user-id>/<file> value. Only that exact legacy prefix is
  // mapped onto the configured data root.
  if (segments[0] === LEGACY_STORAGE_DIRECTORY) segments.shift();

  if (segments[0] !== UPLOADS_DIRECTORY || segments.length < 2) return null;
  return segments;
}

/** Resolve current and legacy database paths only inside ScholarFlow's upload tree. */
export function resolveStoredUploadPath(storedPath: string) {
  const segments = normalizeStoredUploadSegments(storedPath);
  if (!segments) return null;

  const uploadsRoot = getUploadsRoot();
  const absolutePath = path.resolve(resolveScholarFlowDataRoot(), ...segments);
  if (!isPathInside(uploadsRoot, absolutePath) || absolutePath === uploadsRoot) {
    return null;
  }

  return absolutePath;
}
