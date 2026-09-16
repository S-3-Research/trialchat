import Script from "next/script";
import type { Metadata } from "next";
import "./globals.css";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { VoiceInputModeProvider } from "@/contexts/VoiceInputModeContext";
import { ColorSchemeProvider } from "@/contexts/ColorSchemeContext";
import { ThemeScript } from "@/components/ThemeScript";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "S-3 Demo",
  description: "Demo page",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" className={cn("text-base", "font-sans", geist.variable)}>
        <head>
          <ThemeScript />
          <Script
            src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
            strategy="beforeInteractive"
          />
          <Script 
            src="https://unpkg.com/@phosphor-icons/web" 
            strategy="lazyOnload" 
          />
        </head>
        <body className="antialiased min-h-screen flex flex-col bg-slate-950">
          <ColorSchemeProvider>
            <FontSizeProvider>
              <VoiceInputModeProvider>
                {children}
              </VoiceInputModeProvider>
            </FontSizeProvider>
          </ColorSchemeProvider>
        </body>
      </html>

  );
}
