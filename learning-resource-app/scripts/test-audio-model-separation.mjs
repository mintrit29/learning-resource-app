import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { isUploadWhisperReady } from "../src/lib/desktop/component-availability.ts";

const root = await mkdtemp(path.join(tmpdir(), "scholarflow-asr-separation-"));
const previousCache = process.env.SCHOLARFLOW_MODEL_CACHE;
process.env.SCHOLARFLOW_MODEL_CACHE = root;
const required = ["config.json", "generation_config.json", "preprocessor_config.json", "tokenizer.json", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"];
async function presence(variant) {
  const modelRoot = path.join(root, "onnx-community", variant);
  await mkdir(path.join(modelRoot, "onnx"), { recursive: true });
  for (const file of required) await writeFile(path.join(modelRoot, file), "presence fixture, not a real model");
}
try {
  assert.equal(await isUploadWhisperReady(), false);
  await presence("whisper-base");
  assert.equal(await isUploadWhisperReady(), false, "Base must not satisfy the upload prerequisite");
  await presence("whisper-small");
  assert.equal(await isUploadWhisperReady(), false, "Existing Small without VAD must require update");
  await mkdir(path.join(root, "onnx-community/whisper-small/vad"), { recursive: true });
  await writeFile(path.join(root, "onnx-community/whisper-small/vad/silero_vad.onnx"), "presence fixture");
  assert.equal(await isUploadWhisperReady(), true);
  await rm(path.join(root, "onnx-community/whisper-base"), { recursive: true });
  assert.equal(await isUploadWhisperReady(), true);
  await rm(path.join(root, "onnx-community/whisper-small/generation_config.json"));
  assert.equal(await isUploadWhisperReady(), false, "An incomplete Small cache must not accept uploads");
  const runtime = await readFile(new URL("../embedding-runtime/service.mjs", import.meta.url), "utf8");
  assert.match(runtime, /const UPLOAD_WHISPER_MODEL = "onnx-community\/whisper-small"/);
  assert.match(runtime, /loadWhisperModel\(UPLOAD_WHISPER_MODEL, uploadTranscriptionState\)/);
  assert.match(runtime, /cancelled, vad/);
  assert.doesNotMatch(runtime, /whisper-base|vietnameseCandidate/);
  for (const route of ["upload/route.ts", "[id]/reextract/route.ts"]) {
    const source = await readFile(new URL(`../src/app/api/documents/${route}`, import.meta.url), "utf8");
    assert.match(source, /isUploadWhisperReady\(\)/);
    assert.doesNotMatch(source, /isWhisperReady\(\)/);
  }
  await assert.rejects(readFile(new URL("../src/app/api/search/voice/route.ts", import.meta.url)), { code: "ENOENT" });
  const ui = await readFile(new URL("../src/components/search/semantic-search.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /VoiceSearch|voiceBusy|voiceReset/);
  const main = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
  assert.match(main, /setPermissionCheckHandler\(\(\) => false\)/);
  console.log("PASS Small + VAD required for uploads/reextract; Base not sufficient; microphone UI/API removed");
} finally {
  if (previousCache === undefined) delete process.env.SCHOLARFLOW_MODEL_CACHE;
  else process.env.SCHOLARFLOW_MODEL_CACHE = previousCache;
  await rm(root, { recursive: true, force: true });
}
