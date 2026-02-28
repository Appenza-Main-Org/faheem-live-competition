"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  role: "tutor" | "student";
  text: string;
  timestamp: string;
  imageUrl?: string;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isThinking?: boolean;
}

export default function TranscriptPanel({
  entries,
  isThinking = false,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, isThinking]);

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (entries.length === 0 && !isThinking) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-600 flex items-center justify-center text-3xl shadow-lg">
          🎓
        </div>
        <div>
          <p className="text-base font-semibold text-slate-300">
            Your math tutor is ready
          </p>
          <p className="text-sm text-slate-500 mt-1.5">
            Press <span className="text-emerald-400 font-semibold">Start</span> — type a problem, speak it, or snap a photo
          </p>
        </div>
        <div className="flex gap-3 mt-1 text-xs text-slate-600">
          <span className="px-2.5 py-1 rounded-full bg-slate-800/80">📝 Type</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-800/80">🎙 Speak</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-800/80">📷 Snap</span>
        </div>
      </div>
    );
  }

  // ── Conversation ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-2 space-y-4">

      {entries.map((e, i) => (
        <div
          key={i}
          className={`flex gap-3 ${e.role === "student" ? "flex-row-reverse" : "flex-row"}`}
        >
          {/* Avatar */}
          <div
            className={`
              flex-none w-8 h-8 rounded-full flex items-center justify-center
              text-xs font-bold shrink-0 mt-0.5
              ${e.role === "tutor"
                ? "bg-emerald-700 text-emerald-100"
                : "bg-slate-600 text-slate-200"
              }
            `}
          >
            {e.role === "tutor" ? "F" : "U"}
          </div>

          {/* Bubble + timestamp */}
          <div
            className={`flex flex-col gap-1 max-w-[76%] ${
              e.role === "student" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`
                px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${e.role === "tutor"
                  ? "bg-slate-800/90 text-slate-100 rounded-tl-sm border border-slate-700/40"
                  : "bg-emerald-700/20 text-emerald-50 rounded-tr-sm border border-emerald-700/30"
                }
              `}
            >
              {e.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.imageUrl}
                  alt="Shared image"
                  className="rounded-xl max-h-48 mb-2.5 w-full object-contain bg-slate-900"
                />
              )}
              <p className="whitespace-pre-wrap">{e.text}</p>
            </div>
            <span className="text-xs text-slate-600 px-1">{e.timestamp}</span>
          </div>
        </div>
      ))}

      {/* ── Thinking indicator ─────────────────────────────────────────────── */}
      {isThinking && (
        <div className="flex gap-3">
          <div className="flex-none w-8 h-8 rounded-full bg-emerald-700 text-emerald-100 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
            F
          </div>
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-slate-800/90 border border-slate-700/40">
            <div className="flex gap-1.5 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
