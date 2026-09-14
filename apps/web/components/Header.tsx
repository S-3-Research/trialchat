"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useFontSize } from "@/contexts/FontSizeContext";
import { useVoiceInputMode } from "@/contexts/VoiceInputModeContext";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

// Set to true to re-enable sign-in, false to show "coming soon" notice
const SIGN_IN_ENABLED = false;

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSignInNotice, setShowSignInNotice] = useState(false);
  const [isClinicianMode, setIsClinicianMode] = useState(false);
  const { preference, setPreference } = useColorScheme();
  const { fontSize, setFontSize } = useFontSize();
  const { mode, setMode } = useVoiceInputMode();

  // Detect clinician role from localStorage
  useEffect(() => {
    const checkClinicianRole = () => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem(INTAKE_STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setIsClinicianMode(data.role === "clinician");
        } catch {
          setIsClinicianMode(false);
        }
      } else {
        setIsClinicianMode(false);
      }
    };

    checkClinicianRole();

    // Cross-tab storage changes
    window.addEventListener("storage", checkClinicianRole);
    // Same-tab: after intake completes or role changes
    window.addEventListener("intake-role-updated", checkClinicianRole);

    return () => {
      window.removeEventListener("storage", checkClinicianRole);
      window.removeEventListener("intake-role-updated", checkClinicianRole);
    };
  }, []);

  const handleExitClinicianMode = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(INTAKE_STORAGE_KEY);
    }
    setIsClinicianMode(false);
    window.dispatchEvent(new CustomEvent("clinician-mode-exited"));
  };

  const toggleTheme = () => {
    setPreference(preference === "dark" ? "light" : "dark");
  };

  const handleThemeChange = (newPreference: "light" | "dark" | "system") => {
    setPreference(newPreference);
  };

  return (
    <>
    <header className="flex-none px-0 py-4 flex items-center justify-between mx-auto max-w-6xl w-[95%] z-50 transition-all duration-300 ease-in-out">
      {/* Left: Logo Area */}
      <div className="flex items-center gap-3">
        <Link href="/trial-chat" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 flex items-center justify-center bg-gradient-to-br from-slate-200 to-white dark:from-slate-700 dark:to-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 group-hover:scale-105 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-slate-700 dark:text-slate-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                {/* Small AI Sparkle */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 dark:bg-blue-400 rounded-full blur-[2px] animate-pulse"></div>
            </div>
            {/* Title */}
            <span className="text-xl font-bold tracking-tight text-slate-700 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-br dark:from-slate-200 dark:to-slate-400 group-hover:opacity-80 transition-opacity">TrialChat</span>
        </Link>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 md:gap-3">
        
        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
            <Link href="/trial-chat" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all text-sm font-medium">
                {/* Outlined Home Icon */}
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                Home
            </Link>

            <Link href="/trial-chat/docs" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all text-sm font-medium">
                {/* Outlined Document Icon */}
                <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Docs
            </Link>

            <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenu.Trigger asChild>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all text-sm font-medium group">
                        {/* Outlined Settings Icon */}
                        <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-[60] min-w-[260px] rounded-xl border py-2 shadow-xl border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 animate-in fade-in-0 zoom-in-95"
                      sideOffset={8}
                      align="end"
                    >
                      <div className="px-3 py-2.5">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Font Size</div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            {([
                                { value: "small", label: "A-", detail: "Small" },
                                { value: "medium", label: "A", detail: "Medium" },
                                { value: "large", label: "A+", detail: "Large" }
                            ] as const).map(({ value, label, detail }) => (
                                <button
                                    key={value}
                                    onClick={() => setFontSize(value)}
                                    className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-md transition-all ${
                                        fontSize === value 
                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                    }`}
                                    title={detail}
                                >
                                    <span className={`font-medium leading-none ${value === 'small' ? 'text-xs' : value === 'medium' ? 'text-sm' : 'text-base'}`}>
                                        {label}
                                    </span>
                                </button>
                            ))}
                        </div>
                      </div>
                      
                      <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                      
                      <div className="px-3 py-2.5">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Voice Input</div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            {[
                                { value: "web-speech", label: "Web Speech", icon: "🌐" },
                                { value: "whisper", label: "Whisper", icon: "🤖" },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setMode(option.value as 'web-speech' | 'whisper')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-all ${
                                        mode === option.value
                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-medium ring-1 ring-black/5 dark:ring-white/10' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    <span>{option.icon}</span>
                                    <span>{option.label}</span>
                                </button>
                            ))}
                        </div>
                      </div>
                      
                      <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                      
                      <div className="px-3 py-2.5">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Theme</div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            {['light', 'dark', 'system'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => handleThemeChange(t as 'light' | 'dark' | 'system')}
                                    className={`flex-1 text-xs py-1.5 rounded-md capitalize transition-all ${
                                        preference === t 
                                            ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white font-medium ring-1 ring-black/5 dark:ring-white/10' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                      </div>

                        
                      <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                      
                      <div className="px-3 py-2.5 flex flex-col gap-2">
                          <DropdownMenu.Item asChild>
                            <Link
                              href="/trial-chat/settings"
                              className="flex items-center gap-2 w-full px-2 py-2 text-xs font-medium text-slate-700 rounded-lg border border-slate-200 bg-slate-50/50 transition-colors hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600 cursor-pointer outline-none group"
                            >
                              <div className="p-1 rounded-md bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 group-hover:border-slate-300 dark:group-hover:border-slate-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                                </svg>
                              </div>
                              <span>General Preferences</span>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </Link>
                          </DropdownMenu.Item>

                          <DropdownMenu.Item asChild>
                            <Link
                              href="/trial-chat/personalization"
                              className="flex items-center gap-2 w-full px-2 py-2 text-xs font-medium text-slate-700 rounded-lg border border-slate-200 bg-slate-50/50 transition-colors hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600 cursor-pointer outline-none group"
                            >
                              <div className="p-1 rounded-md bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 group-hover:border-slate-300 dark:group-hover:border-slate-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                              </div>
                              <span>Personalization</span>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3 ml-auto opacity-50 group-hover:opacity-100">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                              </svg>
                            </Link>
                          </DropdownMenu.Item>
                        </div>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </nav>

        {/* Divider */}
        <div className="mr-4 h-5 w-[1px] bg-slate-300 dark:bg-white/10 hidden md:block"></div>

        {/* Mobile Settings Icon */}
        <DropdownMenu.Root>
             <DropdownMenu.Trigger asChild>
                <button className="p-2 rounded-full text-slate-500 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors block md:hidden">
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
             </DropdownMenu.Trigger>
             <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-[60] min-w-[200px] rounded-xl border py-2 shadow-xl border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95" align="end">
                  <DropdownMenu.Item asChild><Link href="/" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Home</Link></DropdownMenu.Item>
                  <DropdownMenu.Item asChild><Link href="/trial-chat/personalization" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Personalization</Link></DropdownMenu.Item>
                  <DropdownMenu.Item asChild><Link href="/trial-chat/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Settings</Link></DropdownMenu.Item>
                </DropdownMenu.Content>
             </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Theme Toggle Button (Quick access) */}
        <button 
            onClick={toggleTheme} 
            className="w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:shadow-md hover:shadow-slate-200 dark:bg-white/5 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:shadow-black/20" 
            title="Toggle Dark Mode"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 hidden dark:block text-amber-300">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 block dark:hidden text-slate-600">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
            </svg>
        </button>
        
        {/* Font Size Toggle (Quick access) */}
        <button
            onClick={() => setFontSize(fontSize === 'small' ? 'medium' : fontSize === 'medium' ? 'large' : 'small')}
            className="w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:shadow-md hover:shadow-slate-200 dark:bg-white/5 dark:border-white/20 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:shadow-black/20"
            title={`Font size: ${fontSize}`}
        >
            <span className="font-bold select-none leading-none text-[13px]">
                {fontSize === 'small' ? 'A-' : fontSize === 'medium' ? 'A' : 'A+'}
            </span>
        </button>

        {/* Avatar */}
        <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-[2px]">
                <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                    <button
                        onClick={() => {
                            setShowSignInNotice(true);
                            setTimeout(() => setShowSignInNotice(false), 3000);
                        }}
                        className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        IN
                    </button>
                </div>
            </div>
            {showSignInNotice && (
                <div className="absolute right-0 top-11 z-[70] w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-3.5 py-3 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in-0 zoom-in-95">
                    <div className="font-semibold text-slate-800 dark:text-white mb-1">Sign-in coming soon</div>
                    Sign-in is temporarily disabled. Stay tuned!
                </div>
            )}
        </div>
      </div>
    </header>

    {/* Clinician Mode Banner */}
    {isClinicianMode && (
      <div className="flex-none w-full bg-emerald-600 dark:bg-emerald-700 text-white z-40">
        <div className="mx-auto max-w-6xl w-[95%] flex items-center justify-between gap-3 py-2 px-1">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-sm font-semibold tracking-wide">Clinician Mode</span>
            <span className="hidden sm:inline text-sm text-emerald-100">— viewing as a healthcare professional</span>
          </div>
          <button
            onClick={handleExitClinicianMode}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-100 hover:text-white transition-colors whitespace-nowrap underline underline-offset-2 decoration-emerald-300 hover:decoration-white"
          >
            Exit clinician mode
          </button>
        </div>
      </div>
    )}
    </>
  );
}
