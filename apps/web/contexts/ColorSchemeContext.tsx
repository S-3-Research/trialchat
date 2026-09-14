"use client";

import { createContext, useContext, ReactNode } from "react";
import { useColorScheme as useColorSchemeHook, ColorScheme, ColorSchemePreference } from "@/hooks/useColorScheme";

type ColorSchemeContextType = {
  scheme: ColorScheme;
  preference: ColorSchemePreference;
  setScheme: (scheme: ColorScheme) => void;
  setPreference: (preference: ColorSchemePreference) => void;
  resetPreference: () => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorSchemeHook();

  return (
    <ColorSchemeContext.Provider value={colorScheme}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error("useColorScheme must be used within ColorSchemeProvider");
  }
  return context;
}
