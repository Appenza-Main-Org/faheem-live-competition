"use client";

export type TutorMode = "explain" | "quiz" | "homework";

const MODES: { id: TutorMode; label: string }[] = [
  { id: "explain",  label: "Explain"  },
  { id: "quiz",     label: "Quiz"     },
  { id: "homework", label: "Homework" },
];

interface ModeSelectorProps {
  selected: TutorMode;
  onChange: (mode: TutorMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex rounded-xl bg-slate-800/80 border border-slate-700/50 p-0.5 gap-0.5">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            selected === m.id
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-700/60"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
