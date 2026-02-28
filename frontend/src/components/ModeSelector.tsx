"use client";

export type TutorMode = "explain" | "quiz" | "homework";

const MODES: { id: TutorMode; label: string; labelAr: string }[] = [
  { id: "explain", label: "Explain", labelAr: "شرح" },
  { id: "quiz",    label: "Quiz",    labelAr: "اختبار" },
  { id: "homework", label: "Homework", labelAr: "واجب" },
];

interface ModeSelectorProps {
  selected: TutorMode;
  onChange: (mode: TutorMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
            selected === m.id
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          }`}
        >
          {m.label} · {m.labelAr}
        </button>
      ))}
    </div>
  );
}
