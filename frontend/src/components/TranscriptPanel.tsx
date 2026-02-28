"use client";

import { useEffect, useRef } from "react";

export interface TranscriptEntry {
  role: "tutor" | "student";
  text: string;
  timestamp: string;
  imageUrl?: string; // local object URL, student messages only
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
}

export default function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Transcript · النص
      </h2>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {entries.length === 0 ? (
          <p className="text-slate-600 text-sm italic">
            Conversation will appear here…
          </p>
        ) : (
          entries.map((e, i) => (
            <div
              key={i}
              className={`flex flex-col gap-0.5 ${
                e.role === "tutor" ? "items-start" : "items-end"
              }`}
            >
              <span className="text-xs text-slate-500">
                {e.role === "tutor" ? "Faheem · فهيم" : "You · أنت"} · {e.timestamp}
              </span>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  e.role === "tutor"
                    ? "bg-slate-800 text-slate-200 rounded-tl-none"
                    : "bg-emerald-900 text-emerald-100 rounded-tr-none"
                }`}
              >
                {e.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.imageUrl}
                    alt="Attached image"
                    className="rounded-lg max-h-32 mb-1 w-full object-contain"
                  />
                )}
                {e.text}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
