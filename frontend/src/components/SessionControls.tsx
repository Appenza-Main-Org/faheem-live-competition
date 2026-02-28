"use client";

import type { SessionStatus } from "@/hooks/useSessionSocket";

const STATUS_STYLES: Record<SessionStatus, string> = {
  idle: "bg-slate-700 text-slate-300",
  connecting: "bg-yellow-900 text-yellow-300 animate-pulse",
  connected: "bg-emerald-900 text-emerald-300",
  error: "bg-red-900 text-red-300",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "Ready to start",
  connecting: "Connecting...",
  connected: "Session active",
  error: "Error — try again",
};

interface SessionControlsProps {
  status: SessionStatus;
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function SessionControls({
  status,
  isActive,
  onStart,
  onStop,
}: SessionControlsProps) {
  const variant = status;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className={`px-4 py-2 rounded-full text-sm font-medium ${STATUS_STYLES[variant]}`}>
        {STATUS_LABELS[variant]}
      </div>

      {isActive && (
        <div className="flex gap-1 items-end h-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-1.5 bg-emerald-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 80}ms`, height: `${8 + i * 6}px` }}
            />
          ))}
        </div>
      )}

      <button
        onClick={isActive ? onStop : onStart}
        className={`
          w-48 h-14 rounded-2xl text-lg font-semibold transition-all duration-200
          ${isActive
            ? "bg-red-600 hover:bg-red-500 active:scale-95"
            : "bg-emerald-600 hover:bg-emerald-500 active:scale-95"
          }
        `}
      >
        {isActive ? "Stop Session" : "Start Session"}
      </button>
    </div>
  );
}
