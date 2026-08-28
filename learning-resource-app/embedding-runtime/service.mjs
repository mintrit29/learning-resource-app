import http from "node:http";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import ffmpegPath from "ffmpeg-static";

const HOST = process.env.EMBEDDING_HOST?.trim() || "127.0.0.1";
const PORT = readInteger("EMBEDDING_PORT", 8001, 1, 65535);
const MODEL_NAME = process.env.EMBEDDING_MODEL?.trim() || "BAAI/bge-m3";
const WHISPER_MODEL = process.env.WHISPER_MODEL?.trim() || "onnx-community/whisper-base";
const CACHE_DIRECTORY = path.resolve(
  process.env.SCHOLARFLOW_MODEL_CACHE?.trim() || path.join(process.cwd(), "models-cache"),
);
const MODEL_BATCH_SIZE = readInteger("EMBEDDING_BATCH_SIZE", 4, 1, 16);
const MAX_BATCH_TEXTS = readInteger("EMBEDDING_MAX_BATCH_TEXTS", 32, 1, 128);
const MAX_TEXT_LENGTH = 20_000;
const DIMENSIONS = 1024;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_AUDIO_REQUEST_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_PCM_BYTES = 60 * 60 * 16_000 * 4;
const MOCK_MODE = process.env.SCHOLARFLOW_EMBEDDING_MOCK === "1";
const REQUIRED_MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model.onnx",
  "onnx/model.onnx_data",
];
const REQUIRED_WHISPER_FILES = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

const state = {
  status: "loading",
  extractor: null,
  error: null,
  loadedAt: null,
  progress: null,
};

const transcriptionState = {
  status: "idle",
  transcriber: null,
  error: null,
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

async function readBinaryBody(request, limit) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > limit) {
      const error = new Error("Audio file is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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

async function loadWhisperModel() {
  if (transcriptionState.status === "ready" && transcriptionState.transcriber) {
    return transcriptionState.transcriber;
  }
  if (transcriptionState.status === "loading" && transcriptionState.loadingPromise) {
    return transcriptionState.loadingPromise;
  }

  transcriptionState.status = "loading";
  transcriptionState.error = null;
  transcriptionState.loadingPromise = (async () => {
    const modelRoot = path.join(CACHE_DIRECTORY, ...WHISPER_MODEL.split("/"));
    try {
      await Promise.all(REQUIRED_WHISPER_FILES.map((file) => access(path.join(modelRoot, file))));
    } catch {
      const error = new Error("Whisper chưa được cài đặt. Hãy mở Cài đặt → Thành phần cục bộ.");
      error.statusCode = 503;
      throw error;
    }

    const { env, pipeline } = await import("@huggingface/transformers");
    env.cacheDir = CACHE_DIRECTORY;
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    const transcriber = await pipeline("automatic-speech-recognition", WHISPER_MODEL, {
      device: "cpu",
      dtype: "q8",
    });
    transcriptionState.transcriber = transcriber;
    transcriptionState.status = "ready";
    process.stdout.write(`[transcription] ready model=${WHISPER_MODEL} backend=onnxruntime-node\n`);
    return transcriber;
  })().catch((error) => {
    transcriptionState.status = error?.statusCode === 503 ? "missing" : "error";
    transcriptionState.error = error instanceof Error ? error.message : String(error);
    transcriptionState.loadingPromise = null;
    throw error;
  });
  return transcriptionState.loadingPromise;
}

async function decodeAudio(audio, extension, voice = false) {
  if (!ffmpegPath) throw new Error("FFmpeg runtime is unavailable");
  // Microphone recordings stay in memory. Uploaded documents keep their existing decoder.
  const workDirectory = voice ? null : await mkdtemp(path.join(os.tmpdir(), "scholarflow-audio-"));
  const inputPath = workDirectory ? path.join(workDirectory, `input.${extension}`) : "pipe:0";
  const maxPcmBytes = voice ? 32 * 16000 * 4 : MAX_AUDIO_PCM_BYTES;
  try {
    if (workDirectory) await writeFile(inputPath, audio);
    return await new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-i", inputPath,
        "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "1", "-ar", "16000", "pipe:1",
      ], { windowsHide: true, stdio: [voice ? "pipe" : "ignore", "pipe", "pipe"] });
      if (voice) { child.stdin.on("error", () => {}); child.stdin.end(audio); }
      const output = [];
      const errors = [];
      let timedOut = false;
      const decodeTimer = voice ? setTimeout(() => { timedOut = true; child.kill(); }, 15_000) : null;
      child.once("close", () => { if (decodeTimer) clearTimeout(decodeTimer); });
      let outputBytes = 0;
      child.stdout.on("data", (chunk) => {
        outputBytes += chunk.length;
        if (outputBytes > maxPcmBytes) {
          child.kill();
          return;
        }
        output.push(chunk);
      });
      child.stderr.on("data", (chunk) => errors.push(chunk));
      child.once("error", reject);
      child.once("close", (code) => {
        if (timedOut) {
          reject(new Error("Không giải mã được bản ghi trong thời gian cho phép"));
        } else if (outputBytes > maxPcmBytes) {
          const error = new Error(voice ? "Bản ghi quá dài" : "Âm thanh dài quá 60 phút");
          error.statusCode = 413;
          reject(error);
        } else if (code !== 0) {
          reject(new Error(`Không đọc được âm thanh: ${Buffer.concat(errors).toString("utf8").slice(0, 300)}`));
        } else {
          const pcm = Buffer.concat(output);
          resolve(new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4)).slice());
        }
      });
    });
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true });
  }
}

async function transcribeAudio(audio, extension, voice = false, cancelled = () => false) {
  const samples = await decodeAudio(audio, extension, voice);
  if (samples.length < 1600) {
    const error = new Error("Âm thanh quá ngắn hoặc không có dữ liệu");
    error.statusCode = voice ? 422 : 400;
    throw error;
  }
  if (voice) {
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    if (!Number.isFinite(energy) || Math.sqrt(energy / samples.length) < 0.001) {
      const error = new Error("Không nghe thấy lời nói"); error.statusCode = 422; throw error;
    }
  }
  if (cancelled()) throw new Error("Transcription cancelled");
  const transcriber = await loadWhisperModel();
  if (cancelled()) throw new Error("Transcription cancelled");
  const startedAt = performance.now();
  const sample = samples.subarray(0, Math.min(samples.length, 30 * 16000));
  const transcriptionOptions = (language, returnTimestamps) => ({
    language,
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: returnTimestamps,
  });
  const vietnameseCandidate = await transcriber(sample, transcriptionOptions("vi", samples.length <= sample.length));
  if (cancelled()) throw new Error("Transcription cancelled");
  const englishCandidate = await transcriber(sample, transcriptionOptions("en", samples.length <= sample.length));
  const languageScore = (value, language) => {
    const text = String(value?.text || "").toLowerCase();
    const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
    const vocabulary = language === "vi"
      ? new Set(["và", "là", "của", "trong", "cho", "một", "các", "được", "không", "với", "tài", "liệu", "học", "bài", "nội", "dung"])
      : new Set(["and", "is", "are", "the", "of", "in", "for", "a", "an", "to", "with", "can", "about", "learning"]);
    const commonWords = words.filter((word) => vocabulary.has(word)).length;
    const diacritics = text.match(/[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/g)?.length ?? 0;
    const unexpectedSymbols = text.match(/[^\p{L}\p{N}\s.,!?;:'"()\-]/gu)?.length ?? 0;
    return commonWords * 5 + (language === "vi" ? diacritics * 1.5 : Math.max(0, words.length - diacritics) * 0.08) + Math.min(words.length, 30) * 0.1 - unexpectedSymbols;
  };
  const vietnameseScore = languageScore(vietnameseCandidate, "vi");
  const englishScore = languageScore(englishCandidate, "en");
  const language = vietnameseScore > englishScore ? "vi" : "en";
  const selectedCandidate = language === "vi" ? vietnameseCandidate : englishCandidate;
  const output = samples.length <= sample.length
    ? selectedCandidate
    : await transcriber(samples, transcriptionOptions(language, true));
  const chunks = Array.isArray(output?.chunks) ? output.chunks.flatMap((chunk) => {
    const text = typeof chunk?.text === "string" ? chunk.text.trim() : "";
    const timestamp = Array.isArray(chunk?.timestamp) ? chunk.timestamp : [];
    if (!text) return [];
    return [{ text, start: Number(timestamp[0]) || 0, end: Number(timestamp[1]) || null }];
  }) : [];
  return {
    model: WHISPER_MODEL,
    language,
    text: typeof output?.text === "string" ? output.text.trim() : "",
    chunks,
    duration_seconds: Math.round(samples.length / 16000),
    elapsed_ms: Math.round((performance.now() - startedAt) * 100) / 100,
  };
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

    if (request.method === "POST" && requestUrl.pathname === "/transcribe") {
      const voice = requestUrl.searchParams.get("mode") === "voice";
      const extension = String(request.headers["x-audio-extension"] || "").toLowerCase();
      if (!(voice ? ["webm"] : ["mp3", "wav", "m4a"]).includes(extension)) {
        const error = new Error("Unsupported audio extension");
        error.statusCode = 415;
        throw error;
      }
      const audio = await readBinaryBody(request, voice ? 2 * 1024 * 1024 : MAX_AUDIO_REQUEST_BYTES);
      if (!audio.length) {
        const error = new Error("Audio file is empty");
        error.statusCode = 400;
        throw error;
      }
      const result = await enqueueInference(() => {
        if (response.destroyed) throw new Error("Transcription cancelled");
        return transcribeAudio(audio, extension, voice, () => response.destroyed);
      });
      if (!response.destroyed) sendJson(response, 200, result);
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
  if (typeof transcriptionState.transcriber?.dispose === "function") await transcriptionState.transcriber.dispose();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
