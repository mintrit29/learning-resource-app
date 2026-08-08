import assert from "node:assert/strict";
import path from "node:path";
import {
  createUploadStorageLocation,
  isPathInside,
  resolveScholarFlowDataRoot,
  resolveStoredUploadPath,
} from "../src/lib/storage/local-storage.ts";

const originalDataRoot = process.env.SCHOLARFLOW_DATA_ROOT;
const configuredRoot = path.resolve(".tmp", "storage-path-tests", "data");

try {
  assert.equal(
    resolveScholarFlowDataRoot(undefined, path.resolve("workspace")),
    path.resolve("workspace", "storage"),
  );
  assert.equal(resolveScholarFlowDataRoot(`  ${configuredRoot}  `), configuredRoot);
  assert.throws(
    () => resolveScholarFlowDataRoot("relative/data-root"),
    /must be an absolute path/,
  );

  assert.equal(isPathInside(configuredRoot, configuredRoot), true);
  assert.equal(isPathInside(configuredRoot, path.join(configuredRoot, "uploads")), true);
  assert.equal(isPathInside(configuredRoot, `${configuredRoot}-outside`), false);

  delete process.env.SCHOLARFLOW_DATA_ROOT;
  assert.equal(
    resolveStoredUploadPath("storage/uploads/user-123/document.pdf", "user-123"),
    path.resolve("storage", "uploads", "user-123", "document.pdf"),
  );

  process.env.SCHOLARFLOW_DATA_ROOT = configuredRoot;
  const location = createUploadStorageLocation("user-123", "document.pdf");
  assert.equal(location.directory, path.join(configuredRoot, "uploads", "user-123"));
  assert.equal(location.absolutePath, path.join(location.directory, "document.pdf"));
  assert.equal(location.storedPath, "uploads/user-123/document.pdf");

  assert.equal(
    resolveStoredUploadPath("uploads/user-123/document.pdf", "user-123"),
    location.absolutePath,
  );
  assert.equal(
    resolveStoredUploadPath("storage\\uploads\\user-123\\document.pdf", "user-123"),
    location.absolutePath,
  );

  const invalidStoredPaths = [
    "uploads/user-123/../other-user/private.pdf",
    "uploads/other-user/private.pdf",
    "storage/private.pdf",
    "../uploads/user-123/document.pdf",
    path.resolve(configuredRoot, "uploads", "user-123", "document.pdf"),
    "uploads/user-123",
    "uploads//user-123/document.pdf",
  ];
  for (const storedPath of invalidStoredPaths) {
    assert.equal(resolveStoredUploadPath(storedPath, "user-123"), null, storedPath);
  }

  assert.throws(
    () => createUploadStorageLocation("../other-user", "document.pdf"),
    /Invalid user id/,
  );
  assert.throws(
    () => createUploadStorageLocation("user-123", "../document.pdf"),
    /Invalid upload file name/,
  );

  console.log("PASS local storage paths: data root, legacy mapping, and containment");
} finally {
  if (originalDataRoot === undefined) delete process.env.SCHOLARFLOW_DATA_ROOT;
  else process.env.SCHOLARFLOW_DATA_ROOT = originalDataRoot;
}
