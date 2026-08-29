// Isolated library, real Small + BGE. Build/prepare-desktop first; never uses the user's database.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
const workspace = process.cwd();
const root = path.resolve(process.env.QA_AUDIO_ROOT || ".tmp/audio-small-integration-20260828");
if (!root.startsWith(path.join(workspace, ".tmp") + path.sep)) throw new Error("QA_AUDIO_ROOT must stay inside this project's .tmp directory");
const cache = process.env.QA_AUDIO_CACHE || path.join(process.env.APPDATA, "ScholarFlow/models");
await mkdir(path.join(root, "data"), { recursive: true });
async function port() {
  const probe = net.createServer().listen(0, "127.0.0.1");
  await once(probe, "listening"); const value = probe.address().port;
  await new Promise(resolve => probe.close(resolve)); return value;
}
const runtimePort = await port(), webPort = await port();
const runtime = `http://127.0.0.1:${runtimePort}`, origin = `http://127.0.0.1:${webPort}`;
const backend = spawn(process.execPath, [path.join(workspace, "embedding-runtime/service.mjs")], {
  windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, EMBEDDING_PORT: String(runtimePort), SCHOLARFLOW_MODEL_CACHE: cache, SCHOLARFLOW_EMBEDDING_MOCK: "0" },
});
const web = spawn(process.execPath, [path.join(workspace, ".next/standalone/server.js")], {
  cwd: path.join(workspace, ".next/standalone"), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(webPort), NODE_ENV: "production",
    SCHOLARFLOW_DATA_ROOT: path.join(root, "data"), DATABASE_URL: "file:" + path.join(root, "data/scholarflow.db").replaceAll("\\", "/"),
    SCHOLARFLOW_MODEL_CACHE: cache, DOCLING_RS_HOME: path.join(process.env.APPDATA, "ScholarFlow/runtimes/docling"),
    EMBEDDING_SERVICE_URL: runtime, AI_PROVIDER_ENCRYPTION_KEY: "isolated-audio-test-no-provider",
    SCHOLARFLOW_DESKTOP: "1", SCHOLARFLOW_HEALTH_TOKEN: "audio-upload-qa-only" },
});
for (const child of [backend, web]) {
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  child.on("error", error => { console.error(error); web.kill(); backend.kill(); });
}
await writeFile(path.join(root, "server.json"), JSON.stringify({ root, origin, runtime }));
console.log(`Isolated audio QA: ${origin}\nResults/data: ${root}`);
const stop = () => { web.kill(); backend.kill(); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
await once(web, "exit"); backend.kill();
