"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Square, X } from "lucide-react";
import { VoiceSearchSession, type VoiceRecorder, type VoiceState } from "@/lib/search/voice-search-session";

export function VoiceSearchButton({ reset, onState, onTranscript }: {
  reset: number; onState(state: VoiceState): void; onTranscript(text: string): void;
}) {
  const session = useRef<VoiceSearchSession | null>(null);
  const callbacks = useRef({ onState, onTranscript });
  const [phase, setPhase] = useState<VoiceState["phase"]>("idle");
  useEffect(() => { callbacks.current = { onState, onTranscript }; }, [onState, onTranscript]);
  useEffect(() => {
    const current = new VoiceSearchSession({
      async ready(signal) {
        const response = await fetch("/api/search/voice", { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error("Không kiểm tra được Whisper.");
        return (await response.json()).ready === true;
      },
      async microphone() {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          throw new Error("Ghi âm chưa được hỗ trợ.");
        }
        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      },
      recorder(stream) {
        return new MediaRecorder(stream as MediaStream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64_000 }) as unknown as VoiceRecorder;
      },
      async transcribe(audio, signal) {
        const timeout = AbortSignal.timeout(120_000);
        try {
          const response = await fetch("/api/search/voice", {
            method: "POST", headers: { "Content-Type": "audio/webm" }, body: audio,
            signal: AbortSignal.any([signal, timeout]),
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || typeof data?.text !== "string") throw new Error(data?.message || "Không nhận dạng được lời nói. Hãy thử lại.");
          return data.text;
        } catch (error) {
          if (timeout.aborted) throw new Error("Nhận dạng mất quá lâu. Hãy thử lại khi máy bớt bận hoặc gõ trực tiếp.");
          throw error;
        }
      },
      onState(state) { setPhase(state.phase); callbacks.current.onState(state); },
      onTranscript(text) { callbacks.current.onTranscript(text); },
    });
    session.current = current;
    const hide = () => { if (document.hidden) current.cancel(); };
    const leave = () => current.cancel();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") current.cancel(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("keydown", escape);
    return () => {
      current.cancel(); session.current = null;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => { session.current?.cancel(); }, [reset]);
  const busy = phase === "requesting" || phase === "recording" || phase === "transcribing";
  return <>
    <button type="button" className={`voice-search-button ${phase === "recording" ? "recording" : ""}`}
      aria-label={phase === "recording" ? "Dừng ghi âm và tìm" : "Tìm bằng giọng nói"}
      title="Nói để tìm tài liệu (tối đa 30 giây)" disabled={busy && phase !== "recording"}
      onClick={() => phase === "recording" ? session.current?.stop() : void session.current?.start()}>
      {phase === "recording" ? <><Square size={16} /> Dừng</> : busy ? <LoaderCircle size={18} className="spin" /> : <Mic size={19} />}
    </button>
    {busy ? <button type="button" className="voice-search-button" aria-label="Hủy ghi âm hoặc nhận dạng" onClick={() => session.current?.cancel()}><X size={16} /> Hủy</button> : null}
  </>;
}
