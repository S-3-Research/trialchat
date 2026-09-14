"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type FontSize = "small" | "medium" | "large";

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem("fontSize") as FontSize | null;
    if (saved) {
      setFontSizeState(saved);
    }
  }, []);

  useEffect(() => {
    // Apply font size to the page
    const root = document.documentElement;
    root.classList.remove("text-sm", "text-base", "text-lg");
    
    if (fontSize === "small") {
      root.classList.add("text-sm");
      root.style.fontSize = "14px";
    } else if (fontSize === "large") {
      root.classList.add("text-lg");
      root.style.fontSize = "18px";
    } else {
      root.classList.add("text-base");
      root.style.fontSize = "16px";
    }
  }, [fontSize]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem("fontSize", size);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error("useFontSize must be used within FontSizeProvider");
  }
  return context;
}
