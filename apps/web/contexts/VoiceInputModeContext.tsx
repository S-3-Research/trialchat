"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type VoiceInputMode = "web-speech" | "whisper";

interface VoiceInputModeContextType {
  mode: VoiceInputMode;
  setMode: (mode: VoiceInputMode) => void;
}

const VoiceInputModeContext = createContext<VoiceInputModeContextType | undefined>(undefined);

export function VoiceInputModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<VoiceInputMode>("whisper");

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("voiceInputMode");
    if (saved === "web-speech" || saved === "whisper") {
      setModeState(saved);
    }
  }, []);

  const setMode = (newMode: VoiceInputMode) => {
    setModeState(newMode);
    localStorage.setItem("voiceInputMode", newMode);
  };

  return (
    <VoiceInputModeContext.Provider value={{ mode, setMode }}>
      {children}
    </VoiceInputModeContext.Provider>
  );
}

export function useVoiceInputMode() {
  const context = useContext(VoiceInputModeContext);
  if (context === undefined) {
    throw new Error("useVoiceInputMode must be used within a VoiceInputModeProvider");
  }
  return context;
}
