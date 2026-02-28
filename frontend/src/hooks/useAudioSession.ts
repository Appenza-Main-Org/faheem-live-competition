"use client";

import { useRef, useState, useCallback } from "react";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/api/session";

// Audio constants — must match backend expectations
const MIC_SAMPLE_RATE = 16000;   // Gemini input: 16kHz
const OUT_SAMPLE_RATE = 24000;   // Gemini output: 24kHz
const SAMPLES_PER_CHUNK = Math.floor((MIC_SAMPLE_RATE * 100) / 1000); // 100ms chunks

type SessionStatus = "idle" | "connecting" | "connected" | "error";

export function useAudioSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [isActive, setIsActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const scheduleAudioChunk = useCallback((pcmBytes: ArrayBuffer) => {
    const ctx = playbackContextRef.current;
    if (!ctx) return;

    const int16 = new Int16Array(pcmBytes);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, OUT_SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  }, []);

  function startMicCapture(
    ctx: AudioContext,
    stream: MediaStream,
    ws: WebSocket
  ) {
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    let accumulatedSamples: Float32Array[] = [];
    let accumulatedCount = 0;

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const float32 = event.inputBuffer.getChannelData(0);
      accumulatedSamples.push(new Float32Array(float32));
      accumulatedCount += float32.length;

      if (accumulatedCount >= SAMPLES_PER_CHUNK) {
        const int16 = new Int16Array(accumulatedCount);
        let offset = 0;
        for (const chunk of accumulatedSamples) {
          for (let i = 0; i < chunk.length; i++) {
            const clamped = Math.max(-1, Math.min(1, chunk[i]));
            int16[offset++] = clamped * 32767;
          }
        }
        ws.send(int16.buffer);
        accumulatedSamples = [];
        accumulatedCount = 0;
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  }

  const startSession = useCallback(async () => {
    setStatus("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const captureCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      audioContextRef.current = captureCtx;

      const playbackCtx = new AudioContext({ sampleRate: OUT_SAMPLE_RATE });
      playbackContextRef.current = playbackCtx;
      nextPlayTimeRef.current = playbackCtx.currentTime;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[WS] Connected");
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "status" && msg.value === "connected") {
              setStatus("connected");
              setIsActive(true);
              startMicCapture(captureCtx, stream, ws);
            } else if (msg.type === "error") {
              console.error("[WS] Server error:", msg.value);
              setStatus("error");
            }
          } catch {
            console.warn("[WS] Unparseable text message:", event.data);
          }
        } else {
          scheduleAudioChunk(event.data as ArrayBuffer);
        }
      };

      ws.onclose = () => {
        console.log("[WS] Closed");
        cleanup();
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        setStatus("error");
        cleanup();
      };
    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("error");
      cleanup();
    }
  }, [scheduleAudioChunk]);

  const stopSession = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("END");
      ws.close();
    }
    cleanup();
  }, []);

  function cleanup() {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    playbackContextRef.current?.close();
    playbackContextRef.current = null;

    wsRef.current = null;

    setIsActive(false);
    setStatus("idle");
  }

  return { status, isActive, startSession, stopSession };
}
