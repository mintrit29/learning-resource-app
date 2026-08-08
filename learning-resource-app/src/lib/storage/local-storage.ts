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

export function getUserUploadsDirectory(userId: string) {
  if (!isSafePathSegment(userId)) {
    throw new Error("Invalid user id for local storage");
  }

  const uploadsRoot = getUploadsRoot();
  const userDirectory = path.resolve(uploadsRoot, userId);
  if (!isPathInside(uploadsRoot, userDirectory) || userDirectory === uploadsRoot) {
    throw new Error("Invalid user upload directory");
  }
  return userDirectory;
}

export type UploadStorageLocation = {
  absolutePath: string;
  directory: string;
  storedPath: string;
};

export function createUploadStorageLocation(
  userId: string,
  storedFileName: string,
): UploadStorageLocation {
  if (!isSafePathSegment(storedFileName)) {
    throw new Error("Invalid upload file name");
  }

  const directory = getUserUploadsDirectory(userId);
  const absolutePath = path.resolve(directory, storedFileName);
  if (!isPathInside(directory, absolutePath) || absolutePath === directory) {
    throw new Error("Invalid upload file path");
  }

  return {
    absolutePath,
    directory,
    storedPath: [UPLOADS_DIRECTORY, userId, storedFileName].join("/"),
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

  if (segments[0] !== UPLOADS_DIRECTORY || segments.length < 3) return null;
  return segments;
}

/** Resolve a database filePath only when it belongs to the expected user's upload tree. */
export function resolveStoredUploadPath(storedPath: string, expectedUserId: string) {
  if (!isSafePathSegment(expectedUserId)) return null;

  const segments = normalizeStoredUploadSegments(storedPath);
  if (!segments || segments[1] !== expectedUserId) return null;

  const userDirectory = getUserUploadsDirectory(expectedUserId);
  const absolutePath = path.resolve(resolveScholarFlowDataRoot(), ...segments);
  if (!isPathInside(userDirectory, absolutePath) || absolutePath === userDirectory) {
    return null;
  }

  return absolutePath;
}
