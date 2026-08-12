import http from "node:http";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const HOST = process.env.EMBEDDING_HOST?.trim() || "127.0.0.1";
const PORT = readInteger("EMBEDDING_PORT", 8001, 1, 65535);
const MODEL_NAME = process.env.EMBEDDING_MODEL?.trim() || "BAAI/bge-m3";
const CACHE_DIRECTORY = path.resolve(
  process.env.SCHOLARFLOW_MODEL_CACHE?.trim() || path.join(process.cwd(), "models-cache"),
);
const MODEL_BATCH_SIZE = readInteger("EMBEDDING_BATCH_SIZE", 4, 1, 16);
const MAX_BATCH_TEXTS = readInteger("EMBEDDING_MAX_BATCH_TEXTS", 32, 1, 128);
const MAX_TEXT_LENGTH = 20_000;
const DIMENSIONS = 1024;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MOCK_MODE = process.env.SCHOLARFLOW_EMBEDDING_MOCK === "1";
const REQUIRED_MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model.onnx",
  "onnx/model.onnx_data",
];

const state = {
  status: "loading",
  extractor: null,
  error: null,
  loadedAt: null,
  progress: null,
};

let inferenceQueue = Promise.resolve();

function readInteger(name, fallback, minimum, maximum) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_REQUEST_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeVector(values) {
  if (!Array.isArray(values) || values.length !== DIMENSIONS) {
    throw new Error(`Unexpected embedding dimensions: ${values?.length ?? "unknown"}`);
  }
  let squaredNorm = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error("Embedding contains a non-finite value");
    squaredNorm += value * value;
  }
  const norm = Math.sqrt(squaredNorm);
  if (!Number.isFinite(norm) || norm === 0) throw new Error("Embedding has an invalid norm");
  return values.map((value) => value / norm);
}

function createMockExtractor() {
  return async (texts) => ({
    tolist() {
      return texts.map((text) => {
        const vector = Array.from({ length: DIMENSIONS }, (_, index) => {
          const code = text.charCodeAt(index % Math.max(1, text.length)) || 1;
          return ((code * (index + 17)) % 997) / 997 - 0.5;
        });
        return normalizeVector(vector);
      });
    },
  });
}

function sanitizeProgress(event) {
  if (!event || typeof event !== "object") return null;
  return {
    status: typeof event.status === "string" ? event.status : null,
    file: typeof event.file === "string" ? event.file : null,
    progress: Number.isFinite(event.progress) ? Math.round(event.progress * 10) / 10 : null,
    loaded: Number.isFinite(event.loaded) ? event.loaded : null,
    total: Number.isFinite(event.total) ? event.total : null,
  };
}

async function loadModel() {
  try {
    await mkdir(CACHE_DIRECTORY, { recursive: true });
    if (MOCK_MODE) {
      state.extractor = createMockExtractor();
    } else {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.cacheDir = CACHE_DIRECTORY;
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      const modelRoot = path.join(CACHE_DIRECTORY, ...MODEL_NAME.split("/"));
      try {
        await Promise.all(REQUIRED_MODEL_FILES.map((file) => access(path.join(modelRoot, file))));
      } catch {
        state.status = "missing";
        state.error = "BGE-M3 chưa được cài đặt";
        process.stdout.write(`[embedding] missing model=${MODEL_NAME}\n`);
        return;
      }
      state.extractor = await pipeline("feature-extraction", MODEL_NAME, {
        device: "cpu",
        dtype: "fp32",
        use_external_data_format: true,
        progress_callback(event) {
          state.progress = sanitizeProgress(event);
        },
      });
    }
    state.status = "ready";
    state.loadedAt = Date.now() / 1000;
    state.progress = null;
    process.stdout.write(`[embedding] ready model=${MODEL_NAME} backend=onnxruntime-node\n`);
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`[embedding] load failed: ${state.error}\n`);
  }
}

function healthPayload() {
  return {
    status: state.status,
    model: MODEL_NAME,
    device: "cpu",
    backend: MOCK_MODE ? "mock" : "onnxruntime-node",
    batch_size: MODEL_BATCH_SIZE,
    max_batch_texts: MAX_BATCH_TEXTS,
    dimensions: DIMENSIONS,
    loaded_at: state.loadedAt,
    progress: state.progress,
    error: state.error,
  };
}

async function runEmbedding(texts) {
  const startedAt = performance.now();
  const embeddings = [];
  for (let offset = 0; offset < texts.length; offset += MODEL_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + MODEL_BATCH_SIZE);
    const output = await state.extractor(batch, { pooling: "cls", normalize: true });
    const vectors = output.tolist();
    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new Error("Embedding runtime returned an unexpected batch shape");
    }
    embeddings.push(...vectors.map(normalizeVector));
  }
  return {
    model: MODEL_NAME,
    dimensions: DIMENSIONS,
    embeddings,
    elapsed_ms: Math.round((performance.now() - startedAt) * 100) / 100,
  };
}

function enqueueInference(operation) {
  const queued = inferenceQueue.then(operation, operation);
  inferenceQueue = queued.catch(() => undefined);
  return queued;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, state.status === "error" ? 503 : 200, healthPayload());
      return;
    }

    if (request.method === "POST" && requestUrl.pathname === "/embed") {
      if (state.status !== "ready" || !state.extractor) {
        sendJson(response, 503, {
          detail: state.status === "missing"
            ? "BGE-M3 chưa được cài đặt. Hãy mở Cài đặt → Thành phần cục bộ."
            : state.status === "error"
            ? `Embedding model failed to load: ${state.error}`
            : "Embedding model is still loading",
        });
        return;
      }

      const payload = await readJsonBody(request);
      if (!Array.isArray(payload.texts) || payload.texts.length < 1 || payload.texts.length > MAX_BATCH_TEXTS) {
        const error = new Error(`texts must contain between 1 and ${MAX_BATCH_TEXTS} items`);
        error.statusCode = 400;
        throw error;
      }
      const texts = payload.texts.map((text) => typeof text === "string" ? text.trim() : "");
      if (texts.some((text) => !text)) {
        const error = new Error("Texts must not be empty");
        error.statusCode = 400;
        throw error;
      }
      if (texts.some((text) => text.length > MAX_TEXT_LENGTH)) {
        const error = new Error("A text exceeds the 20,000 character limit");
        error.statusCode = 413;
        throw error;
      }

      sendJson(response, 200, await enqueueInference(() => runEmbedding(texts)));
      return;
    }

    sendJson(response, 404, { detail: "Not found" });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    sendJson(response, statusCode, {
      detail: error instanceof Error ? error.message : "Embedding request failed",
    });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`[embedding] listening http://${HOST}:${PORT}\n`);
  void loadModel();
});

async function shutdown() {
  server.close();
  if (typeof state.extractor?.dispose === "function") await state.extractor.dispose();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
