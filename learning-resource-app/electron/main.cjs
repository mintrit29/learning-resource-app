/* eslint-disable @typescript-eslint/no-require-imports */

const { randomBytes } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow, dialog, session, shell } = require("electron");

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
  if (!app.isPackaged) process.stdout.write(line);
}

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

function getOrCreateAuthSecret() {
  const secretPath = path.join(app.getPath("userData"), ".auth-secret");
  try {
    if (existsSync(secretPath)) return readFileSync(secretPath, "utf8").trim();
    const secret = randomBytes(48).toString("base64url");
    writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600 });
    return secret;
  } catch (error) {
    writeLog(`Không thể lưu auth secret: ${error instanceof Error ? error.message : String(error)}`);
    return randomBytes(48).toString("base64url");
  }
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
    "DOCLING_RS_HOME",
    "PDFIUM_DYNAMIC_LIB_PATH",
    "DOCLING_LAYOUT_ONNX",
    "DOCLING_OCR_REC_ONNX",
    "DOCLING_OCR_DICT",
    "DOCLING_TABLEFORMER_ENCODER",
    "DOCLING_TABLEFORMER_DECODER",
    "DOCLING_TABLEFORMER_BBOX",
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
  const documentRuntimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, "document-runtime")
    : path.resolve(__dirname, "..", ".docling-runtime");
  const documentRuntimeEnvironment = existsSync(documentRuntimeRoot)
    ? {
        DOCLING_RS_HOME: documentRuntimeRoot,
        PDFIUM_DYNAMIC_LIB_PATH: path.join(documentRuntimeRoot, "pdfium", "lib"),
      }
    : {};

  return {
    SCHOLARFLOW_DATA_ROOT: dataRoot,
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
    ...documentRuntimeEnvironment,
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
    if (!isQuitting && embeddingPort) scheduleEmbeddingRestart();
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
    if (health?.status === "loading" || health?.status === "ready") return;
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
    AUTH_URL: `http://${HOST}:${port}`,
    NEXTAUTH_URL: `http://${HOST}:${port}`,
    AUTH_TRUST_HOST: "true",
    AUTH_SECRET: process.env.AUTH_SECRET || getOrCreateAuthSecret(),
    NEXT_TELEMETRY_DISABLED: "1",
    SCHOLARFLOW_DESKTOP: "1",
    SCHOLARFLOW_HEALTH_TOKEN: healthToken,
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
    if (isAllowedAppUrl(url)) void mainWindow.loadURL(url);
    else openExternalUrl(url);
    return { action: "deny" };
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(serverUrl);
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
  embeddingPort = await findFreePort();
  startEmbeddingService(embeddingPort);
  await waitForEmbeddingServer(embeddingUrl);

  const port = await findFreePort();
  const healthToken = randomBytes(32).toString("base64url");
  serverUrl = `http://${HOST}:${port}`;
  writeLog(`Khởi động ScholarFlow tại ${serverUrl}`);
  startNextServer(port, healthToken, embeddingUrl);
  await waitForServer(serverUrl, healthToken);
  const recovery = await requestProcessingRecovery(serverUrl, healthToken);
  if (recovery?.scheduled) {
    writeLog(`Đã xếp lại ${recovery.scheduled} tài liệu bị gián đoạn.`);
  }
  writeLog("Dịch vụ local đã sẵn sàng; đang mở cửa sổ ứng dụng.");
  createMainWindow();
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
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
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
