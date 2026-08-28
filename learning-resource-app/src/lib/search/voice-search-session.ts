// Framework-independent lifecycle so permission/recording/network races can be tested.
export type VoiceState = { phase: "idle" | "requesting" | "recording" | "transcribing" | "error"; message: string; missing?: boolean };
type Stream = { getTracks(): { stop(): void }[] };
export type VoiceRecorder = {
  state: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start(timeslice: number): void;
  stop(): void;
};
type Dependencies = {
  ready(signal: AbortSignal): Promise<boolean>;
  microphone(): Promise<Stream>;
  recorder(stream: Stream): VoiceRecorder;
  transcribe(audio: Blob, signal: AbortSignal): Promise<string>;
  onState(state: VoiceState): void;
  onTranscript(text: string): void;
  maxMs?: number;
};

export class VoiceSearchSession {
  private generation = 0;
  private phase: VoiceState["phase"] = "idle";
  private controller: AbortController | null = null;
  private stream: Stream | null = null;
  private recorder: VoiceRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private deps: Dependencies;
  constructor(deps: Dependencies) { this.deps = deps; }
  private publish(phase: VoiceState["phase"], message = "", missing = false) {
    this.phase = phase; this.deps.onState({ phase, message, missing });
  }
  private release() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.recorder) {
      this.recorder.onstop = this.recorder.ondataavailable = this.recorder.onerror = null;
      try { if (this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* A disconnected device can already be stopped. */ }
    }
    this.recorder = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null; this.chunks = []; this.bytes = 0;
  }
  cancel() {
    this.generation++; this.controller?.abort(); this.controller = null;
    this.release(); this.publish("idle");
  }
  async start() {
    if (["requesting", "recording", "transcribing"].includes(this.phase)) return;
    this.cancel();
    const id = this.generation;
    const controller = new AbortController(); this.controller = controller;
    this.publish("requesting", "Đang kiểm tra Whisper và mở microphone…");
    try {
      const ready = await this.deps.ready(controller.signal);
      if (id !== this.generation) return;
      if (!ready) { this.publish("error", "Cần tải Whisper Base để tìm bằng giọng nói.", true); return; }
      const stream = await this.deps.microphone();
      if (id !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const recorder = this.deps.recorder(stream); this.recorder = recorder;
      recorder.ondataavailable = ({ data }) => {
        if (id !== this.generation) return;
        this.bytes += data.size;
        if (this.bytes > 2 * 1024 * 1024) { this.cancel(); this.publish("error", "Bản ghi quá lớn. Hãy nói ngắn hơn."); return; }
        if (data.size) this.chunks.push(data);
      };
      recorder.onerror = () => { if (id === this.generation) { this.cancel(); this.publish("error", "Microphone bị gián đoạn. Hãy thử lại."); } };
      recorder.onstop = () => { if (id === this.generation) void this.finish(id, controller); };
      recorder.start(250);
      this.publish("recording", "Đang nghe — nói yêu cầu tìm tài liệu rồi bấm Dừng.");
      this.timer = setTimeout(() => this.stop(), this.deps.maxMs ?? 30_000);
    } catch (error) {
      if (id !== this.generation) return;
      this.release();
      const name = error instanceof Error ? error.name : "";
      this.publish("error", name === "NotAllowedError" || name === "SecurityError"
        ? "Chưa được phép dùng microphone. Hãy cho phép ScholarFlow dùng mic trong cài đặt Windows."
        : name === "NotFoundError" ? "Không tìm thấy microphone. Hãy cắm hoặc bật mic rồi thử lại."
        : name === "NotReadableError" ? "Không mở được microphone. Mic có thể đang bận hoặc đã bị ngắt."
        : "Không mở được chức năng giọng nói. Kiểm tra mic và Whisper rồi thử lại.");
    }
  }
  stop() {
    if (this.phase !== "recording" || !this.recorder) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.publish("transcribing", "Đang chuyển lời nói thành chữ… Lần đầu có thể chậm do nạp model.");
    try { this.recorder.stop(); } catch {
      this.cancel(); this.publish("error", "Microphone bị gián đoạn. Hãy thử lại."); return;
    }
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
  }
  private async finish(id: number, controller: AbortController) {
    const audio = new Blob(this.chunks, { type: "audio/webm" });
    this.release();
    this.publish("transcribing", "Đang chuyển lời nói thành chữ… Lần đầu có thể chậm do nạp model.");
    try {
      if (audio.size < 16) throw new Error("Bản ghi quá ngắn. Hãy nói lại.");
      const text = await this.deps.transcribe(audio, controller.signal);
      if (id !== this.generation) return;
      this.publish("idle", "Đã điền lời nói vào ô tìm kiếm. Bạn có thể sửa nếu nhận chưa đúng.");
      this.deps.onTranscript(text);
    } catch (error) {
      if (id !== this.generation) return;
      this.publish("error", error instanceof Error ? error.message : "Không nhận dạng được lời nói.");
    }
  }
}
