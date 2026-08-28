/* eslint-disable @typescript-eslint/no-require-imports */

const { randomBytes } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const { ComponentManager } = require("./component-manager.cjs");
const { normalizeCaptureRectangle, targetOcrSize } = require("./visual-search.cjs");
const { allowSearchMicrophone } = require("./microphone-permission.cjs");

const HOST = "127.0.0.1";
const HEALTH_PATH = "/api/health";
const EMBEDDING_HEALTH_PATH = "/health";
const STARTUP_TIMEOUT_MS = 120_000;
const EMBEDDING_LISTEN_TIMEOUT_MS = 30_000;
const EMBEDDING_RESTART_BASE_DELAY_MS = 1_000;
const EMBEDDING_RESTART_MAX_DELAY_MS = 15_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

let mainWindow = null;
let serverProcess = null;
let serverStartupError = null;
let serverUrl = null;
let embeddingProcess = null;
let embeddingStartupError = null;
let embeddingUrl = null;
let embeddingPort = null;
let embeddingRestartAttempts = 0;
let embeddingRestartTimer = null;
let isQuitting = false;
let allowQuit = false;
let logStream = null;
let logFilePath = null;
let componentManager = null;
let serverHealthToken = null;
let isRestartingEmbedding = false;

app.disableHardwareAcceleration();
app.enableSandbox();
const userDataOverride = process.env.SCHOLARFLOW_USER_DATA_ROOT;
if (userDataOverride) {
  if (!path.isAbsolute(userDataOverride)) {
    throw new Error("SCHOLARFLOW_USER_DATA_ROOT phải là đường dẫn tuyệt đối");
  }
  app.setPath("userData", path.resolve(userDataOverride));
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  if (logStream) logStream.write(line);
  if (!app.isPackaged && process.stdout?.writable && !process.stdout.destroyed) {
    try {
      process.stdout.write(line, () => {});
    } catch {
      // A detached development launch may close its console pipe before Electron exits.
      // The persistent desktop log remains available, so stdout failure is non-fatal.
    }
  }
}

// Prevent a closed parent console from crashing the Electron main process with EPIPE.
process.stdout?.on?.("error", () => {});

function initializeLogging() {
  const logDirectory = path.join(app.getPath("userData"), "logs");
  mkdirSync(logDirectory, { recursive: true });
  logFilePath = path.join(logDirectory, "desktop.log");
  logStream = createWriteStream(logFilePath, { flags: "a" });
}

function writeCriticalLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  if (logFilePath) appendFileSync(logFilePath, line, "utf8");
  if (!app.isPackaged) process.stderr.write(line);
}

function getOrCreateEncryptionKey() {
  const keyPath = path.join(app.getPath("userData"), ".encryption-key");
  const legacyAuthPath = path.join(app.getPath("userData"), ".auth-secret");
  if (existsSync(keyPath)) return readFileSync(keyPath, "utf8").trim();
  const key = existsSync(legacyAuthPath)
    ? readFileSync(legacyAuthPath, "utf8").trim()
    : randomBytes(48).toString("base64url");
  writeFileSync(keyPath, key, { encoding: "utf8", mode: 0o600 });
  return key;
}

function resetImportedFilesForLocalLibrary() {
  const markerPath = path.join(app.getPath("userData"), ".local-library-v1");
  if (existsSync(markerPath)) return;
  const dataRoot = path.resolve(app.getPath("userData"), "data");
  const uploadsRoot = path.resolve(dataRoot, "uploads");
  if (uploadsRoot !== dataRoot && uploadsRoot.startsWith(`${dataRoot}${path.sep}`)) {
    rmSync(uploadsRoot, { recursive: true, force: true });
  }
  writeFileSync(markerPath, new Date().toISOString(), "utf8");
  writeLog("Đã dọn các bản sao tài liệu cũ khi chuyển sang thư viện local.");
}

function sanitizedChildEnvironment() {
  const environment = { ...process.env };
  [
    "ELECTRON_RUN_AS_NODE",
    "NODE_OPTIONS",
    "NODE_PATH",
    "SCHOLARFLOW_USER_DATA_ROOT",
    "EMBEDDING_SERVICE_URL",
    "EMBEDDING_HOST",
    "EMBEDDING_PORT",
    "SCHOLARFLOW_MODEL_CACHE",
    "SCHOLARFLOW_EMBEDDING_MOCK",
    "AI_PROVIDER_ENCRYPTION_KEY",
    "DOCLING_RS_HOME",
    "PDFIUM_DYNAMIC_LIB_PATH",
    "DOCLING_LAYOUT_ONNX",
    "DOCLING_OCR_REC_ONNX",
    "DOCLING_OCR_DICT",
    "DOCLING_TABLEFORMER_ENCODER",
    "DOCLING_TABLEFORMER_DECODER",
    "DOCLING_TABLEFORMER_BBOX",
    "SCHOLARFLOW_TESSDATA_PATH",
  ].forEach((key) => delete environment[key]);
  return environment;
}

function getDesktopDataEnvironment(resolvedEmbeddingUrl) {
  const dataRoot = path.join(app.getPath("userData"), "data");
  mkdirSync(dataRoot, { recursive: true });
  const databasePath = path.join(dataRoot, "scholarflow.db").replaceAll("\\", "/");
  const serverRoot = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.resolve(__dirname, "..");
  const documentRuntimeRoot = path.join(app.getPath("userData"), "runtimes", "docling");
  const modelCache = path.join(app.getPath("userData"), "models");

  return {
    SCHOLARFLOW_DATA_ROOT: dataRoot,
    SCHOLARFLOW_MODEL_CACHE: modelCache,
    DATABASE_URL: `file:${databasePath}`,
    EMBEDDING_SERVICE_URL: resolvedEmbeddingUrl,
    EMBEDDING_DEVICE: "cpu",
    EMBEDDING_REQUEST_BATCH_SIZE: "16",
    SCHOLARFLOW_SQLITE_VEC_PATH: path.join(
      serverRoot,
      "node_modules",
      "sqlite-vec-windows-x64",
      "vec0.dll",
    ),
    DOCLING_RS_HOME: documentRuntimeRoot,
    PDFIUM_DYNAMIC_LIB_PATH: path.join(documentRuntimeRoot, "pdfium", "lib"),
    SCHOLARFLOW_TESSDATA_PATH: path.join(documentRuntimeRoot, "models", "tesseract"),
  };
}

function getEmbeddingRuntimePaths() {
  const runtimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, "embedding-runtime")
    : path.resolve(__dirname, "..", "embedding-runtime");
  const serviceEntry = path.join(runtimeRoot, "service.mjs");
  if (!existsSync(serviceEntry)) {
    throw new Error(`Thiếu local embedding runtime: ${serviceEntry}`);
  }
  return { runtimeRoot, serviceEntry };
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close((error) => {
        if (error) reject(error);
        else if (port) resolve(port);
        else reject(new Error("Không tìm được cổng local cho ScholarFlow"));
      });
    });
  });
}

function forwardEmbeddingLogs(child) {
  child.stdout?.on("data", (chunk) => writeLog(`[embedding] ${String(chunk).trimEnd()}`));
  child.stderr?.on("data", (chunk) => writeLog(`[embedding:error] ${String(chunk).trimEnd()}`));
  child.on("exit", (code, signal) => {
    writeLog(`Local embedding runtime đã dừng (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    if (embeddingProcess === child) embeddingProcess = null;
    if (!isQuitting && !isRestartingEmbedding && embeddingPort) scheduleEmbeddingRestart();
  });
}

function scheduleEmbeddingRestart() {
  if (isQuitting || !embeddingPort || embeddingRestartTimer) return;
  embeddingRestartAttempts += 1;
  const delay = Math.min(
    EMBEDDING_RESTART_BASE_DELAY_MS * embeddingRestartAttempts,
    EMBEDDING_RESTART_MAX_DELAY_MS,
  );
  writeLog(`Embedding runtime sẽ tự khởi động lại sau ${delay} ms.`);
  embeddingRestartTimer = setTimeout(async () => {
    embeddingRestartTimer = null;
    try {
      startEmbeddingService(embeddingPort);
      await waitForEmbeddingServer(embeddingUrl);
      embeddingRestartAttempts = 0;
      writeLog("Embedding runtime đã tự khôi phục.");
    } catch (error) {
      writeLog(`Không thể tự khôi phục embedding runtime: ${error instanceof Error ? error.message : String(error)}`);
      scheduleEmbeddingRestart();
    }
  }, delay);
}

function startEmbeddingService(port) {
  const { runtimeRoot, serviceEntry } = getEmbeddingRuntimePaths();
  const modelCache = path.join(app.getPath("userData"), "models");
  mkdirSync(modelCache, { recursive: true });
  embeddingPort = port;
  embeddingUrl = `http://${HOST}:${port}`;
  embeddingStartupError = null;

  const environment = {
    ...sanitizedChildEnvironment(),
    EMBEDDING_HOST: HOST,
    EMBEDDING_PORT: String(port),
    EMBEDDING_MODEL: "BAAI/bge-m3",
    EMBEDDING_BATCH_SIZE: "4",
    EMBEDDING_MAX_BATCH_TEXTS: "32",
    SCHOLARFLOW_MODEL_CACHE: modelCache,
    NODE_ENV: app.isPackaged ? "production" : "development",
    ...(process.env.SCHOLARFLOW_EMBEDDING_MOCK === "1"
      ? { SCHOLARFLOW_EMBEDDING_MOCK: "1" }
      : {}),
  };
  const runtimeBinary = app.isPackaged
    ? process.execPath
    : process.env.SCHOLARFLOW_NODE_BINARY || "node";
  if (app.isPackaged) environment.ELECTRON_RUN_AS_NODE = "1";

  embeddingProcess = spawn(runtimeBinary, [serviceEntry], {
    cwd: runtimeRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  embeddingProcess.once("error", (error) => {
    embeddingStartupError = error;
    writeLog(`Không thể khởi động local embedding runtime: ${error.message}`);
  });
  forwardEmbeddingLogs(embeddingProcess);
  writeLog(`Đang khởi động local BGE-M3 tại ${embeddingUrl}`);
}

function requestEmbeddingHealth(url) {
  return new Promise((resolve) => {
    const request = http.get(`${url}${EMBEDDING_HEALTH_PATH}`, { timeout: 2_000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 10_000) response.destroy();
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve(null));
  });
}

async function waitForEmbeddingServer(url) {
  const deadline = Date.now() + EMBEDDING_LISTEN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (embeddingStartupError) throw embeddingStartupError;
    if (!embeddingProcess || embeddingProcess.exitCode !== null) {
      throw new Error("Local embedding runtime đã dừng trước khi khởi động xong");
    }

    const health = await requestEmbeddingHealth(url);
    if (health?.status === "error") {
      throw new Error(`Không thể nạp BGE-M3 local: ${health.error || "unknown error"}`);
    }
    if (health?.status === "missing" || health?.status === "loading" || health?.status === "ready") return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local embedding runtime khởi động quá thời gian cho phép");
}

function forwardServerLogs(child) {
  child.stdout?.on("data", (chunk) => writeLog(`[server] ${String(chunk).trimEnd()}`));
  child.stderr?.on("data", (chunk) => writeLog(`[server:error] ${String(chunk).trimEnd()}`));
  child.on("exit", (code, signal) => {
    writeLog(`Next.js server đã dừng (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    if (!isQuitting && mainWindow) {
      dialog.showErrorBox(
        "ScholarFlow đã dừng",
        "Dịch vụ local của ứng dụng đã dừng ngoài dự kiến. Hãy mở lại ScholarFlow.",
      );
      app.quit();
    }
  });
}

function startNextServer(port, healthToken, resolvedEmbeddingUrl) {
  const commonEnvironment = {
    ...sanitizedChildEnvironment(),
    ...getDesktopDataEnvironment(resolvedEmbeddingUrl),
    HOSTNAME: HOST,
    PORT: String(port),
    NEXT_TELEMETRY_DISABLED: "1",
    SCHOLARFLOW_DESKTOP: "1",
    SCHOLARFLOW_HEALTH_TOKEN: healthToken,
    AI_PROVIDER_ENCRYPTION_KEY: getOrCreateEncryptionKey(),
  };

  if (app.isPackaged) {
    const serverRoot = path.join(process.resourcesPath, "app");
    const serverEntry = path.join(serverRoot, "server.js");
    if (!existsSync(serverEntry)) {
      throw new Error(`Thiếu Next.js standalone server: ${serverEntry}`);
    }

    serverProcess = spawn(process.execPath, [serverEntry], {
      cwd: serverRoot,
      env: { ...commonEnvironment, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } else {
    const projectRoot = path.resolve(__dirname, "..");
    const nextEntry = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
    if (!existsSync(nextEntry)) {
      throw new Error("Chưa cài dependencies. Hãy chạy npm install trước khi mở desktop dev.");
    }

    serverProcess = spawn(process.env.SCHOLARFLOW_NODE_BINARY || "node", [
      nextEntry,
      "dev",
      "--hostname",
      HOST,
      "--port",
      String(port),
    ], {
      cwd: projectRoot,
      env: { ...commonEnvironment, NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  serverProcess.once("error", (error) => {
    serverStartupError = error;
    writeLog(`Không thể khởi động Next.js server: ${error.message}`);
  });
  forwardServerLogs(serverProcess);
}

async function waitForServer(url, healthToken) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serverStartupError) throw serverStartupError;
    if (!serverProcess || serverProcess.exitCode !== null) {
      throw new Error("Dịch vụ local dừng trước khi khởi động xong");
    }

    try {
      const ready = await new Promise((resolve) => {
        const request = http.get(
          `${url}${HEALTH_PATH}`,
          {
            timeout: 2_000,
            headers: { "x-scholarflow-health-token": healthToken },
          },
          (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
              body += chunk;
              if (body.length > 2_000) response.destroy();
            });
            response.on("end", () => {
              try {
                const result = JSON.parse(body);
                resolve(
                  response.statusCode === 200
                    && result.status === "ok"
                    && result.application === "scholarflow-desktop"
                    && result.protocolVersion === 1,
                );
              } catch {
                resolve(false);
              }
            });
          },
        );
        request.once("timeout", () => request.destroy());
        request.once("error", () => resolve(false));
      });
      if (ready) return;
    } catch {
      // The server may still be compiling on first launch.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("ScholarFlow khởi động quá thời gian cho phép");
}

async function requestProcessingRecovery(url, healthToken) {
  return new Promise((resolve) => {
    const request = http.request(
      `${url}/api/desktop/recover-processing`,
      {
        method: "POST",
        timeout: 10_000,
        headers: { "x-scholarflow-health-token": healthToken },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 10_000) response.destroy();
        });
        response.on("end", () => {
          try {
            const result = JSON.parse(body);
            resolve(response.statusCode === 200 ? result : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve(null));
    request.end();
  });
}

function isAllowedAppUrl(targetUrl) {
  if (!serverUrl) return false;
  try {
    return new URL(targetUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

function openExternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      void shell.openExternal(parsed.toString());
    }
  } catch {
    // Ignore malformed URLs instead of passing them to the operating system.
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 540,
    show: false,
    backgroundColor: "#f6f7fb",
    title: "ScholarFlow",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedAppUrl(targetUrl)) {
      event.preventDefault();
      openExternalUrl(targetUrl);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedAppUrl(url)) openExternalUrl(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const needsSetup = componentManager
    ? Object.values(componentManager.getQuickStatuses()).some((component) => !component.optional && component.status !== "ready")
    : false;
  void mainWindow.loadURL(`${serverUrl}${needsSetup ? "/setup/components" : ""}`);
}

async function requestUploadFileMigration(url, healthToken) {
  return new Promise((resolve) => {
    const request = http.request(
      `${url}/api/desktop/migrate-upload-files`,
      {
        method: "POST",
        timeout: 10_000,
        headers: { "x-scholarflow-health-token": healthToken },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 10_000) response.destroy();
        });
        response.on("end", () => {
          try {
            resolve(response.statusCode === 200 ? JSON.parse(body) : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve(null));
    request.end();
  });
}

async function restartEmbeddingService() {
  if (!embeddingPort || isQuitting) return;
  isRestartingEmbedding = true;
  try {
    await stopEmbeddingService();
    startEmbeddingService(embeddingPort);
    await waitForEmbeddingServer(embeddingUrl);
  } finally {
    isRestartingEmbedding = false;
  }
}

async function hasActiveDocumentJobs() {
  if (!serverUrl || !serverHealthToken) return true;
  return new Promise((resolve) => {
    const request = http.get(`${serverUrl}/api/desktop/component-removal-check`, {
      timeout: 3_000,
      headers: { "x-scholarflow-health-token": serverHealthToken },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try { resolve(Boolean(JSON.parse(body).active)); } catch { resolve(true); }
      });
    });
    request.once("timeout", () => request.destroy());
    request.once("error", () => resolve(true));
  });
}

function registerComponentIpc() {
  const sendProgress = (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("components:progress", progress);
  };
  const legacyRoots = [
    path.resolve(__dirname, "..", ".docling-runtime"),
    ...(app.isPackaged ? [path.join(process.resourcesPath, "document-runtime")] : []),
  ];
  componentManager = new ComponentManager({
    userDataRoot: app.getPath("userData"),
    legacyDoclingRoots: legacyRoots,
    onProgress: sendProgress,
    onModelChanged: restartEmbeddingService,
    canRemove: async () => !(await hasActiveDocumentJobs()),
  });
  ipcMain.handle("components:status", () => componentManager.getStatuses());
  ipcMain.handle("components:install", (_event, id) => componentManager.install(id));
  ipcMain.handle("components:cancel", (_event, id) => componentManager.cancel(id));
  ipcMain.handle("components:verify", (_event, id) => componentManager.verify(id));
  ipcMain.handle("components:remove", (_event, id) => componentManager.remove(id));
}

function registerVisualSearchIpc() {
  ipcMain.handle("visual-search:capture-region", async (event, value) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      throw new Error("Không thể chụp vùng chọn từ cửa sổ này.");
    }
    const rectangle = normalizeCaptureRectangle(value, mainWindow.getContentBounds());
    const image = await mainWindow.webContents.capturePage(rectangle);
    if (image.isEmpty()) throw new Error("Không chụp được vùng đã chọn.");
    const size = image.getSize();
    const ocrSize = targetOcrSize(size.width, size.height);
    const ocrImage = ocrSize.width === size.width && ocrSize.height === size.height
      ? image
      : image.resize({ width: ocrSize.width, height: ocrSize.height, quality: "best" });
    return {
      dataUrl: `data:image/jpeg;base64,${ocrImage.toJPEG(94).toString("base64")}`,
      width: ocrSize.width,
      height: ocrSize.height,
    };
  });
}

async function getDocumentStorageLocation(documentId) {
  if (!serverUrl || !serverHealthToken || typeof documentId !== "string" || documentId.length > 128) {
    return null;
  }
  const response = await fetch(`${serverUrl}/api/desktop/document-location/${encodeURIComponent(documentId)}`, {
    headers: { "x-scholarflow-health-token": serverHealthToken },
    signal: AbortSignal.timeout(3_000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const body = await response.json().catch(() => null);
  return body && typeof body.filePath === "string" ? body.filePath : null;
}

function registerDocumentIpc() {
  ipcMain.handle("documents:reveal-in-folder", async (event, documentId) => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      throw new Error("Không thể mở thư mục tài liệu từ cửa sổ này.");
    }
    const storedPath = await getDocumentStorageLocation(documentId);
    const dataRoot = path.resolve(app.getPath("userData"), "data");
    const uploadsRoot = path.resolve(dataRoot, "uploads");
    const segments = storedPath?.replaceAll("\\", "/").split("/") ?? [];
    const absolutePath = path.resolve(dataRoot, ...segments);
    if (
      segments[0] !== "uploads"
      || segments.some((segment) => !segment || segment === "." || segment === "..")
      || absolutePath === uploadsRoot
      || !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)
      || !existsSync(absolutePath)
    ) {
      throw new Error("File lưu trong ScholarFlow không còn tồn tại.");
    }
    shell.showItemInFolder(absolutePath);
    return true;
  });
}

function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once("exit", onExit);
  });
}

async function stopServer() {
  const child = serverProcess;
  if (!child) return;
  serverProcess = null;
  const pid = child.pid;

  if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  const exited = await waitForProcessExit(child, SHUTDOWN_TIMEOUT_MS);

  if (!exited && process.platform === "win32" && pid) {
    writeLog("Dịch vụ local không dừng đúng hạn; đang dừng process tree.");
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (!exited) {
    child.kill("SIGKILL");
  }
}

async function stopEmbeddingService() {
  if (embeddingRestartTimer) {
    clearTimeout(embeddingRestartTimer);
    embeddingRestartTimer = null;
  }
  const child = embeddingProcess;
  if (!child) return;
  embeddingProcess = null;
  const pid = child.pid;

  if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  const exited = await waitForProcessExit(child, SHUTDOWN_TIMEOUT_MS);

  if (!exited && process.platform === "win32" && pid) {
    writeLog("Local embedding runtime không dừng đúng hạn; đang dừng process tree.");
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else if (!exited) {
    child.kill("SIGKILL");
  }
}

async function bootstrap() {
  initializeLogging();
  resetImportedFilesForLocalLibrary();
  registerComponentIpc();
  registerVisualSearchIpc();
  registerDocumentIpc();
  embeddingPort = await findFreePort();
  startEmbeddingService(embeddingPort);

  const port = await findFreePort();
  const healthToken = randomBytes(32).toString("base64url");
  serverHealthToken = healthToken;
  serverUrl = `http://${HOST}:${port}`;
  writeLog(`Khởi động ScholarFlow tại ${serverUrl}`);
  startNextServer(port, healthToken, embeddingUrl);
  await Promise.all([waitForServer(serverUrl, healthToken), waitForEmbeddingServer(embeddingUrl)]);
  const uploadMigration = await requestUploadFileMigration(serverUrl, healthToken);
  if (uploadMigration?.migrated) {
    writeLog(`Đã đổi tên ${uploadMigration.migrated} file tài liệu cũ sang tên dễ đọc.`);
  }
  const recovery = await requestProcessingRecovery(serverUrl, healthToken);
  if (recovery?.scheduled) {
    writeLog(`Đã xếp lại ${recovery.scheduled} tài liệu bị gián đoạn.`);
  }
  writeLog("Dịch vụ local đã sẵn sàng; đang mở cửa sổ ứng dụng.");
  createMainWindow();
  void componentManager.verifyAdoptedComponents();
  void componentManager.importLegacyDocling().then((imported) => {
    if (imported) writeLog("Đã nhập Docling runtime cũ vào vùng thành phần cục bộ.");
  });
}

if (!hasSingleInstanceLock) {
  app.exit(0);
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    const canUseMic = (webContents, permission, requestingUrl, details, mediaTypes) => allowSearchMicrophone({
      permission, requestingUrl, serverUrl, mediaTypes, isMainFrame: details.isMainFrame,
      sameWindow: Boolean(mainWindow && !mainWindow.isDestroyed() && webContents === mainWindow.webContents),
      pageUrl: webContents?.getURL(),
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, origin, details) =>
      canUseMic(webContents, permission, details.requestingUrl || origin, details, [details.mediaType]));
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) =>
      callback(canUseMic(webContents, permission, details.requestingUrl, details, details.mediaTypes)));
    return bootstrap();
  }).catch((error) => {
    writeCriticalLog(`Khởi động thất bại: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    dialog.showErrorBox(
      "Không thể mở ScholarFlow",
      error instanceof Error ? error.message : "Ứng dụng không thể khởi động.",
    );
    app.quit();
  });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    isQuitting = true;
    void Promise.all([stopServer(), stopEmbeddingService()]).finally(() => {
      allowQuit = true;
      logStream?.end();
      app.quit();
    });
  });
}
