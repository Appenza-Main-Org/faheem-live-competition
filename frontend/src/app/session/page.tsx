"use client";

import { useState } from "react";
import SessionControls from "@/components/SessionControls";
import ModeSelector, { TutorMode } from "@/components/ModeSelector";
import TranscriptPanel from "@/components/TranscriptPanel";
import ImageUpload from "@/components/ImageUpload";
import AnswerInput from "@/components/AnswerInput";
import { useSessionSocket } from "@/hooks/useSessionSocket";

export default function SessionPage() {
  const [mode, setMode] = useState<TutorMode>("explain");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const { status, isActive, transcript, startSession, stopSession, sendText, sendImage } =
    useSessionSocket();

  function handleImageSelected(file: File) {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleImageClear() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  function handleImageSend() {
    if (!imageFile || !isActive) return;
    sendImage(imageFile, answer.trim());
    handleImageClear();
    setAnswer("");
  }

  function handleAnswerSubmit() {
    if (!answer.trim() || !isActive) return;
    sendText(answer.trim());
    setAnswer("");
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold leading-none">
            Faheem <span className="text-emerald-400">Live</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">فهيم لايف · Bilingual AI Tutor</p>
        </div>
        <ModeSelector selected={mode} onChange={setMode} />
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left panel — input area */}
        <div className="flex flex-col gap-6 w-full md:w-[420px] shrink-0 p-6 overflow-y-auto border-r border-slate-800">
          <ImageUpload
            onImageSelected={handleImageSelected}
            imagePreview={imagePreview}
            onClear={handleImageClear}
          />

          {imageFile && isActive && (
            <button
              onClick={handleImageSend}
              className="self-start text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              📷 Send image{answer.trim() ? " with caption" : ""}
            </button>
          )}

          <AnswerInput
            value={answer}
            onChange={setAnswer}
            onSubmit={handleAnswerSubmit}
            disabled={!isActive}
          />

          {/* Session controls */}
          <div className="flex justify-center pt-2">
            <SessionControls
              status={status}
              isActive={isActive}
              onStart={startSession}
              onStop={stopSession}
            />
          </div>
        </div>

        {/* Right panel — transcript */}
        <div className="flex-1 p-6 overflow-hidden hidden md:flex flex-col">
          <TranscriptPanel entries={transcript} />
        </div>
      </div>

      {/* Mobile transcript (below fold) */}
      <div className="md:hidden flex flex-col px-6 pb-6 h-64 border-t border-slate-800">
        <div className="pt-4 flex-1 overflow-hidden">
          <TranscriptPanel entries={transcript} />
        </div>
      </div>
    </div>
  );
}
