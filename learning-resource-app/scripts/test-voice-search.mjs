import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { VoiceSearchSession } from "../src/lib/search/voice-search-session.ts";
import { normalizeVoiceQuery, readVoiceBody, VOICE_MAX_BYTES } from "../src/lib/search/voice-search-input.ts";
const require = createRequire(import.meta.url);
const { allowSearchMicrophone } = require("../electron/microphone-permission.cjs");
const trusted = { permission: "media", sameWindow: true, isMainFrame: true, mediaTypes: ["audio"], serverUrl: "http://127.0.0.1:3333", pageUrl: "http://127.0.0.1:3333/search", requestingUrl: "http://127.0.0.1:3333/search" };
assert.equal(allowSearchMicrophone(trusted), true);
for (const change of [{ mediaTypes: ["video"] }, { mediaTypes: ["audio", "video"] }, { mediaTypes: ["unknown"] }, { isMainFrame: false }, { sameWindow: false }, { permission: "geolocation" }, { pageUrl: "http://127.0.0.1:3333/settings" }, { requestingUrl: "http://127.0.0.1:3334/search" }, { serverUrl: "https://example.com" }]) assert.equal(allowSearchMicrophone({ ...trusted, ...change }), false);
assert.equal(normalizeVoiceQuery("  tài liệu\n mạng  máy tính "), "tài liệu mạng máy tính");
for (const value of [null, "", "?!", "a".repeat(501)]) assert.throws(() => normalizeVoiceQuery(value));
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]);
const request = (body = webm, headers = {}) => new Request("http://127.0.0.1:3333/api/search/voice", { method: "POST", headers: { origin: "http://127.0.0.1:3333", "content-type": "audio/webm", ...headers }, body });
assert.deepEqual(await readVoiceBody(request()), webm);
assert.deepEqual(await readVoiceBody(new Request("http://localhost:3333/api/search/voice", { method: "POST", headers: { host: "127.0.0.1:3333", origin: "http://127.0.0.1:3333", "content-type": "audio/webm" }, body: webm })), webm);
await assert.rejects(readVoiceBody(request(webm, { host: "evil.example", origin: "http://evil.example" })), error => error.status === 403);
for (const [req, status] of [[request(webm, { origin: "https://bad.example" }), 403], [request(webm, { "content-type": "text/plain" }), 415], [request(Buffer.alloc(40)), 415], [request(Buffer.alloc(0)), 400], [request(Buffer.alloc(VOICE_MAX_BYTES + 1)), 413], [request(webm, { "content-length": String(VOICE_MAX_BYTES + 1) }), 413]]) await assert.rejects(readVoiceBody(req), error => error.status === status);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(overrides = {}) {
  const states = [], texts = [];
  let stopped = 0, microphoneCalls = 0, transcriptions = 0;
  const stream = { getTracks: () => [{ stop: () => { stopped++; } }] };
  const recorder = {
    state: "inactive", onstop: null, ondataavailable: null, onerror: null,
    start() { this.state = "recording"; },
    stop() { this.state = "inactive"; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob([webm]) }); this.onstop?.(); }); },
  };
  const session = new VoiceSearchSession({
    ready: async () => true, microphone: async () => { microphoneCalls++; return stream; }, recorder: () => recorder,
    transcribe: async () => { transcriptions++; return "tài liệu mạng máy tính"; },
    ...overrides, onState: state => states.push(state), onTranscript: text => texts.push(text),
  });
  return { session, states, texts, recorder, stream, counts: () => ({ stopped, microphoneCalls, transcriptions }) };
}
let f = fixture(); await f.session.start(); assert.equal(f.states.at(-1).phase, "recording");
f.session.stop(); await tick(); assert.deepEqual(f.texts, ["tài liệu mạng máy tính"]); assert.equal(f.counts().stopped, 1); f.session.cancel();
f = fixture({ ready: async () => false }); await f.session.start(); assert.equal(f.states.at(-1).missing, true); assert.equal(f.counts().microphoneCalls, 0);
f = fixture({ microphone: async () => { throw new DOMException("denied", "NotAllowedError"); } }); await f.session.start(); assert.match(f.states.at(-1).message, /Chưa được phép/);
const permission = deferred(); f = fixture({ microphone: () => permission.promise }); const starting = f.session.start(); await tick(); f.session.cancel(); permission.resolve(f.stream); await starting; assert.equal(f.counts().stopped, 1); assert.equal(f.texts.length, 0);
f = fixture(); await f.session.start(); f.session.cancel(); await tick(); assert.equal(f.counts().transcriptions, 0); assert.equal(f.counts().stopped, 1);
const pending = deferred(); f = fixture({ transcribe: () => pending.promise }); await f.session.start(); f.session.stop(); await tick(); f.session.cancel(); pending.resolve("kết quả cũ"); await tick(); assert.equal(f.texts.length, 0);
const old = deferred(); let calls = 0; f = fixture({ transcribe: async () => ++calls === 1 ? old.promise : "kết quả mới" }); await f.session.start(); f.session.stop(); await tick(); f.session.cancel(); await f.session.start(); f.session.stop(); await tick(); old.resolve("kết quả cũ"); await tick(); assert.deepEqual(f.texts, ["kết quả mới"]); f.session.cancel();
f = fixture(); await f.session.start(); f.recorder.ondataavailable({ data: new Blob([Buffer.alloc(VOICE_MAX_BYTES + 1)]) }); await tick(); assert.equal(f.states.at(-1).phase, "error"); assert.equal(f.counts().transcriptions, 0);
f = fixture({ maxMs: 5 }); await f.session.start(); await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(f.texts.length, 1); f.session.cancel();
f = fixture(); await f.session.start(); f.recorder.onerror(); await tick(); assert.equal(f.counts().stopped, 1); assert.equal(f.states.at(-1).phase, "error");
f = fixture(); await f.session.start(); f.recorder.stop = () => { throw new Error("device gone"); }; f.session.cancel(); assert.equal(f.counts().stopped, 1);
console.log("PASS voice search: trusted audio-only permission, input validation/limits, missing model, permission denial, stop/cancel, late permission, stale transcription, retry, auto-stop, device error and cleanup");
