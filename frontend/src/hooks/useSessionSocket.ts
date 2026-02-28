"use client";

import { useCallback, useRef, useState } from "react";

import type { TranscriptEntry } from "@/components/TranscriptPanel";

// Matches the new backend path
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/session";

// Matches the status shape SessionControls already expects
export type SessionStatus = "idle" | "connecting" | "connected" | "error";

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useSessionSocket() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const append = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev, entry]);
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────

  const startSession = useCallback(() => {
    if (wsRef.current) return; // already open

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Wait for the server's {"type":"status","value":"connected"} before
      // marking the session live — avoids a race on slow connections.
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return; // binary frames ignored here

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        // Non-JSON plain text — treat as a raw tutor message
        append({ role: "tutor", text: event.data, timestamp: timestamp() });
        return;
      }

      if (msg.type === "status" && msg.value === "connected") {
        setStatus("connected");
        // Faheem's opening line comes from the server stub echo or real Gemini.
        // Append a local placeholder so the transcript isn't empty on connect.
        append({
          role: "tutor",
          text: "Ahlan wa sahlan! أهلاً وسهلاً! I'm Faheem. What would you like to practice?",
          timestamp: timestamp(),
        });
      } else if (msg.type === "message" && typeof msg.text === "string") {
        append({ role: "tutor", text: msg.text, timestamp: timestamp() });
      } else if (msg.type === "recap" && msg.data) {
        const data = msg.data as Record<string, unknown>;
        const summary =
          typeof data.summary === "string"
            ? data.summary
            : "Session complete.";
        append({ role: "tutor", text: summary, timestamp: timestamp() });
      } else if (msg.type === "error" && typeof msg.value === "string") {
        setStatus("error");
        append({ role: "tutor", text: `⚠ ${msg.value}`, timestamp: timestamp() });
      }
    };

    ws.onclose = () => {
      setStatus("idle");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setStatus("error");
      wsRef.current = null;
    };
  }, [append]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("END");
      ws.close();
    }
    wsRef.current = null;
    setStatus("idle");
  }, []);

  // ── Send text ──────────────────────────────────────────────────────────────

  const sendText = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Append the student's message to the transcript immediately (optimistic)
      append({ role: "student", text, timestamp: timestamp() });

      // Send as JSON so the backend can distinguish text from binary audio
      ws.send(JSON.stringify({ type: "text", text }));
    },
    [append]
  );

  // ── Send image ─────────────────────────────────────────────────────────────

  const sendImage = useCallback(
    async (file: File, caption: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      // Local object URL for the transcript thumbnail
      const imageUrl = URL.createObjectURL(file);

      // Optimistic transcript entry — show thumbnail + caption immediately
      append({
        role: "student",
        text: caption || "📷",
        imageUrl,
        timestamp: timestamp(),
      });

      const base64 = await fileToBase64(file);
      ws.send(
        JSON.stringify({
          type: "image",
          mimeType: file.type,
          data: base64,
          caption,
        })
      );
    },
    [append]
  );

  return {
    status,
    isActive: status === "connected",
    transcript,
    startSession,
    stopSession,
    sendText,
    sendImage,
  };
}

// ── Module-level helpers ──────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      resolve((reader.result as string).split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
