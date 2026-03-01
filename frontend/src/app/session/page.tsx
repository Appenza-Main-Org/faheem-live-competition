"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionSocket, LiveState } from "@/hooks/useSessionSocket";
import TranscriptPanel from "@/components/TranscriptPanel";
import ModeSelector, { type TutorMode } from "@/components/ModeSelector";
import { log } from "@/lib/log";

// ── Live state indicator ────────────────────────────────────────────────────
const STATE_CONFIG: Record<LiveState, { dot: string; label: string; pulse: boolean }> = {
  idle:       { dot: "bg-slate-500",   label: "Ready",       pulse: false },
  connecting: { dot: "bg-yellow-400",  label: "Connecting…", pulse: true  },
  connected:  { dot: "bg-emerald-400", label: "Live",        pulse: false },
  thinking:   { dot: "bg-sky-400",     label: "Thinking…",   pulse: true  },
  seeing:     { dot: "bg-violet-400",  label: "Seeing…",     pulse: true  },
  listening:  { dot: "bg-rose-400",    label: "Listening…",  pulse: true  },
  speaking:     { dot: "bg-emerald-500", label: "Speaking…",   pulse: true  },
  interrupted:  { dot: "bg-orange-400", label: "Interrupted",  pulse: false },
  error:        { dot: "bg-red-500",    label: "Error",        pulse: false },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const [mode, setMode]               = useState<TutorMode>("explain");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [text, setText]               = useState("");
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const autoVoiceRef      = useRef(false);   // set true when Start auto-triggers voice

  const {
    status,
    isActive,
    isThinking,
    liveState,
    voiceActive,
    transcript,
    startSession,
    stopSession,
    sendText,
    sendImage,
    startVoice,
    stopVoice,
  } = useSessionSocket();

  const state   = STATE_CONFIG[liveState];
  const canSend = isActive && (imageFile !== null || text.trim().length > 0);

  // ── Auto-start voice once session is live ──────────────────────────────────
  useEffect(() => {
    if (liveState === "connected" && autoVoiceRef.current) {
      autoVoiceRef.current = false;
      startVoice();
    }
  }, [liveState, startVoice]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    log.image("Image selected", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });
    e.target.value = "";
  }

  function handleImageClear() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  function handleSend() {
    if (!canSend) return;
    if (imageFile) {
      sendImage(imageFile, text.trim(), mode);
      handleImageClear();
      setText("");
    } else {
      sendText(text.trim(), mode);
      setText("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleModeChange(m: TutorMode) {
    setMode(m);
    log.mode(`Tab → ${m}`);
  }

  function handleVoiceToggle() {
    if (voiceActive) {
      log.voice("User stopped voice");
      stopVoice();
    } else {
      log.voice("User started voice");
      startVoice();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-none flex items-center gap-4 px-5 h-14 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur z-10">

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-sm font-bold text-white">
            F
          </div>
          <span className="font-bold text-base tracking-tight">
            Faheem <span className="text-emerald-400">Math</span>
          </span>
        </div>

        {/* Mode Tab Bar — centered */}
        <div className="flex-1 flex justify-center">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        {/* Live state pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 shrink-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${state.dot} ${state.pulse ? "animate-pulse" : ""}`}
          />
          <span className="text-xs text-slate-300 font-medium">{state.label}</span>
        </div>
      </header>

      {/* ── Transcript ──────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <TranscriptPanel
          entries={transcript}
          isThinking={isThinking && isActive}
        />
      </main>

      {/* ── Image attachment preview ──────────────────────────────────────── */}
      {imagePreview && imageFile && (
        <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-t border-slate-800/60 bg-slate-900/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Attachment preview"
            className="h-11 w-11 rounded-lg object-cover border border-slate-700 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{imageFile.name}</p>
            <p className="text-xs text-slate-500">
              {(imageFile.size / 1024).toFixed(1)} KB · {imageFile.type}
            </p>
          </div>
          <button
            onClick={handleImageClear}
            className="flex-none text-slate-500 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Composer bar ────────────────────────────────────────────────────── */}
      <div className="flex-none flex items-end gap-2 px-4 py-3 border-t border-slate-800/60 bg-slate-950">

        {/* Attach image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!isActive}
          title="Snap or upload a math problem"
          className={`
            flex-none w-10 h-10 rounded-xl flex items-center justify-center
            text-base transition-all duration-150
            ${imageFile
              ? "bg-emerald-700 text-white ring-1 ring-emerald-500"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          📷
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Voice toggle */}
        <button
          onClick={handleVoiceToggle}
          disabled={!isActive}
          title={voiceActive ? "Stop voice" : "Speak your math problem"}
          className={`
            flex-none w-10 h-10 rounded-xl flex items-center justify-center
            text-base transition-all duration-150
            ${voiceActive
              ? "bg-rose-600 text-white ring-2 ring-rose-500/40 animate-pulse"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          {voiceActive ? "⏹" : "🎙"}
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isActive}
          rows={1}
          placeholder={
            voiceActive
              ? "Listening… speak or type your math problem"
              : imageFile
              ? "Ask about the problem in the image… (optional)"
              : isActive
              ? "Type a math problem… (Enter to send)"
              : "Click Start to begin — mic starts automatically"
          }
          dir="auto"
          className="
            flex-1 resize-none rounded-xl bg-slate-800 border border-slate-700
            px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500
            focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600
            disabled:opacity-40 transition-colors leading-relaxed max-h-28 overflow-y-auto
          "
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title={imageFile ? "Send math problem image" : "Send"}
          className="
            flex-none w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500
            text-white flex items-center justify-center font-bold text-base
            transition-all duration-150
            disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
          "
        >
          ↑
        </button>

        {/* Start / End session */}
        <button
          onClick={() => {
            if (isActive) {
              stopSession();
            } else {
              autoVoiceRef.current = true;  // auto-start voice once connected
              startSession();
            }
          }}
          disabled={status === "connecting"}
          className={`
            flex-none px-4 h-10 rounded-xl text-sm font-semibold whitespace-nowrap
            transition-all duration-150 active:scale-95
            ${isActive
              ? "bg-red-600/90 hover:bg-red-500 text-white"
              : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {status === "connecting" ? "…" : isActive ? "End" : "Start"}
        </button>
      </div>

    </div>
  );
}
