// Default tests need no models. VOICE_TEST_MODEL_CACHE opts into real local Whisper VI/EN tests.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { GET, POST } from "../src/app/api/search/voice/route.ts";
const require = createRequire(new URL("../embedding-runtime/package.json", import.meta.url));
const ffmpeg = require("ffmpeg-static");
const temp = await mkdtemp(path.join(tmpdir(), "scholarflow-voice-test-"));
const realCache = process.env.VOICE_TEST_MODEL_CACHE;
const probe = net.createServer().listen(0, "127.0.0.1"); await once(probe, "listening"); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
process.env.EMBEDDING_SERVICE_URL = origin;
process.env.SCHOLARFLOW_MODEL_CACHE = realCache || temp;
const logs = [];
const child = spawn(process.execPath, ["embedding-runtime/service.mjs"], { env: { ...process.env, EMBEDDING_PORT: String(port), SCHOLARFLOW_EMBEDDING_MOCK: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", data => logs.push(String(data))); child.stderr.on("data", data => logs.push(String(data)));
function encode(args) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args, "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "64k", "-f", "webm", "pipe:1"], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString()); return result.stdout;
}
const silence = encode(["-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1"]);
const req = (audio, extra = {}) => new Request("http://127.0.0.1:3333/api/search/voice", { method: "POST", headers: { origin: "http://127.0.0.1:3333", "content-type": "audio/webm", ...extra }, body: audio });
try {
  for (let i = 0; i < 100; i++) { if ((await fetch(`${origin}/health`).catch(() => null))?.ok) break; await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.equal((await fetch(`${origin}/health`)).status, 200, logs.join(""));
  assert.equal((await POST(req(silence, { origin: "https://example.com" }))).status, 403);
  if (!realCache) {
    assert.equal((await (await GET()).json()).ready, false);
    assert.equal((await POST(req(silence))).status, 503);
    // Presence fixtures only; invalid/silent inputs must fail before ONNX is ever loaded.
    const root = path.join(temp, "onnx-community/whisper-base"); await mkdir(path.join(root, "onnx"), { recursive: true });
    for (const file of ["config.json", "tokenizer.json", "generation_config.json", "preprocessor_config.json", "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"]) await writeFile(path.join(root, file), "test");
  }
  assert.equal((await (await GET()).json()).ready, true);
  assert.equal((await POST(req(silence))).status, 422);
  const long = encode(["-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "34"]);
  assert.equal((await POST(req(long))).status, 413);
  const invalid = await POST(req(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)])));
  assert.equal(invalid.status, 502);
  assert.equal((await fetch(`${origin}/transcribe?mode=voice`, { method: "POST", headers: { "X-Audio-Extension": "wav" }, body: silence })).status, 415);
  console.log("PASS voice API + real FFmpeg: origin, missing model, silence, duration limit, corrupt WebM, wrong extension; no library writes");
  if (realCache) {
    for (const [file, words] of [["02_audio_tieng_viet.mp3", /mạng|máy tính|tài liệu/i], ["03_audio_tieng_anh.wav", /network|computer|learning|database/i]]) {
      const audio = encode(["-i", path.join("test-fixtures/scholarflow/06_mindmap_audio", file)]);
      const start = Date.now(); const response = await POST(req(audio)); const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body)); assert.match(body.text, words);
      console.log(`PASS real Whisper ${file} ${(Date.now() - start) / 1000}s: ${body.text}`);
    }
  }
} finally {
  child.kill();
  if (child.exitCode === null) await once(child, "exit");
  await rm(temp, { recursive: true, force: true });
}
