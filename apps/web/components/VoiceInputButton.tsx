"use client";

import { useEffect, useState } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInputButton({ onTranscript, className = "" }: VoiceInputButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    lang: "en-US",
    continuous: false,
    interimResults: true,
  });

  const [showError, setShowError] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [displayInterim, setDisplayInterim] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Send final transcript to parent (只负责发送，不管定时器)
  useEffect(() => {
    if (transcript && !isListening) {
      console.log("📝 [VoiceInputButton] Final transcript:", transcript);
      setLastTranscript(transcript);
      setShowSuccess(true);
      onTranscript(transcript);
      resetTranscript();
    }
  }, [transcript, isListening, onTranscript, resetTranscript]);

  // Auto-hide success message (独立的定时器逻辑)
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setLastTranscript("");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Update interim display when listening (只负责更新内容)
  useEffect(() => {
    if (isListening && interimTranscript) {
      setDisplayInterim(interimTranscript);
    } else if (!isListening) {
      // 停止监听时立即清空
      setDisplayInterim("");
    }
  }, [interimTranscript, isListening]);

  // Auto-hide interim after 2 seconds of no updates (独立的定时器逻辑)
  useEffect(() => {
    if (displayInterim) {
      const timer = setTimeout(() => {
        setDisplayInterim("");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [displayInterim]);

  // Show error toast
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleClick = () => {
    console.log('[VoiceInputButton] Button clicked, isListening:', isListening, 'isSupported:', isSupported);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        title="Voice input is not supported in your browser"
        className={`relative rounded-full p-3 text-slate-400 ${className}`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
          <line x1="2" y1="2" x2="22" y2="22" strokeWidth={2} />
        </svg>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        title={isListening ? "Stop recording" : "Start voice input"}
        className={`
          group relative rounded-full w-9 h-9 transition-all duration-300 ease-out
          flex items-center justify-center
          ${isListening
            ? "bg-white text-red-500 shadow-lg shadow-red-500/20 ring-1 ring-red-500/40 scale-105"
            : "bg-white text-blue-500 hover:text-blue-600 hover:shadow-lg hover:shadow-blue-500/15 ring-1 ring-gray-200 hover:ring-blue-500/35 hover:scale-105"
          }
          ${className}
        `}
      >
        {/* Microphone Icon */}
        <svg
          className={`h-5 w-5 transition-transform duration-200 ${isListening ? 'scale-110' : 'group-hover:scale-110'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>

        {/* Listening indicator (pulsing rings) */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-xl bg-red-400/50 animate-ping" />
            <span className="absolute inset-0 rounded-xl bg-red-400/30 animate-pulse" />
          </>
        )}
      </button>

      {/* Interim transcript display - listening */}
      {displayInterim && (
        <div className="absolute bottom-full mb-1.5 left-0 right-0 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="rounded-lg bg-gradient-to-br from-blue-600/60 to-indigo-700/60 backdrop-blur-md px-3.5 py-2 text-xs text-white shadow-lg border border-white/30">
            <div className="flex items-center gap-2">
              {/* Animated wave indicator */}
              <div className="flex items-center gap-0.5">
                <span className="w-0.5 h-2 bg-wh2 left-0 min-w-[300px]l animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-0.5 h-3 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-0.5 h-2.5 bg-white/80 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="flex-1 font-medium drop-shadow-md truncate">{displayInterim}</span>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-blue-600/60 to-indigo-700/60 backdrop-blur-md rounded-sm rotate-45 -mt-0.5 border-r border-b border-white/30" />
          </div>
        </div>
      )}

      {/* Recognition complete - success message */}
      {showSuccess && lastTranscript && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[300px] max-w-[400px] animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500/65 to-blue-600/65 backdrop-blur-md px-3.5 py-2 text-xs text-white shadow-lg border border-white/35">
            <div className="flex items-center gap-2">
              {/* Success checkmark */}
              <svg className="h-4 w-4 flex-shrink-0 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1 truncate">
                <div className="font-medium drop-shadow-md">{lastTranscript}</div>
              </div>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-1.5 h-1.5 bg-gradient-to-br from-indigo-500/65 to-blue-600/65 backdrop-blur-md rounded-sm rotate-45 -mt-0.5 border-r border-b border-white/35" />
          </div>
        </div>
      )}

      {/* Error toast */}
      {showError && error && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-50 p-4 shadow-lg dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Voice Input Error
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
            <button
              onClick={() => setShowError(false)}
              className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
