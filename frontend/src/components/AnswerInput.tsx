"use client";

import { useRef } from "react";

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: AnswerInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Your Answer · إجابتك
      </h2>

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={3}
          placeholder="Type your answer… (Enter to submit, Shift+Enter for newline)"
          dir="auto"
          className="
            flex-1 resize-none rounded-xl bg-slate-800 border border-slate-700
            px-4 py-3 text-sm text-slate-100 placeholder-slate-600
            focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600
            disabled:opacity-40 transition-colors duration-150
          "
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="
            h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500
            text-white font-semibold text-sm transition-all duration-150
            disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
          "
        >
          Send
        </button>
      </div>
    </div>
  );
}
