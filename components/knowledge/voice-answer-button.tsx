"use client";

import { Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  bytesToBase64,
  encodeWavPcm16,
  WAV_TARGET_SAMPLE_RATE,
} from "@/lib/audio/wav";

/** 与 /api/ai/transcribe 的上限保持一致：16kHz 单声道 60 秒约 1.9MB，留足余量。 */
const MAX_RECORDING_MS = 60_000;
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

type Status = "idle" | "recording" | "transcribing";
type AudioContextCtor = new () => AudioContext;

/**
 * 把任意浏览器录音转成 16kHz 单声道 WAV。
 * 先用 AudioContext 解码，再用 OfflineAudioContext 完成声道下混与重采样，
 * 避免手写重采样带来的音质和边界问题。
 */
async function convertToWav(blob: Blob) {
  const audioContextCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!audioContextCtor) throw new Error("AudioContext is unavailable");

  const context = new audioContextCtor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.max(1, Math.ceil(decoded.duration * WAV_TARGET_SAMPLE_RATE));
    const offline = new OfflineAudioContext(1, frames, WAV_TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWavPcm16(rendered.getChannelData(0), WAV_TARGET_SAMPLE_RATE);
  } finally {
    void context.close();
  }
}

export function VoiceAnswerButton({
  disabled = false,
  onBusyChange,
  onTranscript,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onTranscript: (text: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const releaseResources = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // 仅做卸载清理，不在这里同步状态。
  useEffect(() => () => releaseResources(), [releaseResources]);

  const transcribe = useCallback(async (blob: Blob) => {
    setStatus("transcribing");
    try {
      const base64 = bytesToBase64(await convertToWav(blob));
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64, mimeType: "audio/wav" }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const record = payload !== null && typeof payload === "object"
        ? payload as Record<string, unknown>
        : {};

      if (!response.ok) {
        setMessage(typeof record.error === "string" ? record.error : "语音转写失败，请稍后重试。");
        return;
      }
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!text) {
        setMessage("没有识别到语音内容，请靠近麦克风重试。");
        return;
      }
      setMessage(null);
      onTranscript(text);
    } catch {
      setMessage("录音处理失败，请重试。");
    } finally {
      setStatus("idle");
      onBusyChange?.(false);
    }
  }, [onBusyChange, onTranscript]);

  function stopRecording() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    setMessage(null);

    if (
      typeof navigator === "undefined"
      || typeof MediaRecorder === "undefined"
      || !navigator.mediaDevices?.getUserMedia
    ) {
      setMessage("当前浏览器不支持录音，请使用桌面版 Chrome 或 Edge。");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setMessage("无法访问麦克风，请检查浏览器的麦克风权限。");
      return;
    }

    const mimeType = PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setMessage("当前浏览器无法开始录音，请改用桌面版 Chrome 或 Edge。");
      return;
    }

    chunksRef.current = [];
    streamRef.current = stream;
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      releaseResources();
      if (blob.size === 0) {
        setStatus("idle");
        onBusyChange?.(false);
        setMessage("没有录到声音，请重试。");
        return;
      }
      void transcribe(blob);
    };
    recorder.onerror = () => {
      releaseResources();
      setStatus("idle");
      onBusyChange?.(false);
      setMessage("录音失败，请重试。");
    };

    recorder.start();
    setStatus("recording");
    onBusyChange?.(true);
    timerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
  }

  const recording = status === "recording";
  const busy = status === "transcribing";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-pressed={recording}
          disabled={disabled || busy}
          onClick={recording ? stopRecording : () => void startRecording()}
          size="sm"
          type="button"
          variant={recording ? "destructive" : "outline"}
        >
          {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          {recording ? "停止并转写" : busy ? "转写中…" : "语音输入"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {recording ? "正在录音，最长 60 秒" : "录音只用于转写，本站不保存音频"}
        </span>
      </div>
      <p
        aria-live="polite"
        className="text-xs text-rose-600 dark:text-rose-400"
        role="status"
      >
        {message ?? ""}
      </p>
    </div>
  );
}
