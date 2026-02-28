"use client";

import { useRef, useState } from "react";

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  imagePreview: string | null;
  onClear: () => void;
}

export default function ImageUpload({
  onImageSelected,
  imagePreview,
  onClear,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file.type.startsWith("image/")) {
      onImageSelected(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Image · صورة
      </h2>

      {imagePreview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Uploaded question"
            className="w-full max-h-48 object-contain bg-slate-900"
          />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-full w-7 h-7 flex items-center justify-center text-sm"
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-2 h-36 rounded-xl border-2 border-dashed
            cursor-pointer transition-colors duration-150 text-sm select-none
            ${dragging
              ? "border-emerald-500 bg-emerald-950/30 text-emerald-400"
              : "border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500 hover:text-slate-400"
            }
          `}
        >
          <span className="text-2xl">📷</span>
          <span>Drop an image or click to upload</span>
          <span className="text-xs text-slate-600">PNG, JPG, WEBP</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
