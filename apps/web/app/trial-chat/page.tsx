
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFontSize } from "@/contexts/FontSizeContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { ClinicianModal } from "@/components/ClinicianModal";
import { buildTrackedUrl } from "@/lib/trackLink";

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showClinicianModal, setShowClinicianModal] = useState(false);
  const { scheme, preference, setPreference } = useColorScheme();
  const isLight = scheme === 'light';
  const { fontSize, setFontSize } = useFontSize();
  const nextFontSize = { small: 'medium', medium: 'large', large: 'small' } as const;
  const fontSizeLabel = { small: 'A−', medium: 'A', large: 'A+' } as const;
  // Read the raw query string directly from window.location instead of
  // useSearchParams() so this doesn't force a Suspense boundary around the
  // whole landing page during static generation.
  const [chatHref, setChatHref] = useState("/trial-chat/chat");
  useEffect(() => {
    const qs = window.location.search;
    if (qs) setChatHref(`/trial-chat/chat${qs}`);
  }, []);


  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes custom-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        @keyframes custom-fadeInUp {
            0% { opacity: 0; transform: translateY(28px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-custom-float { animation: custom-float 6s ease-in-out infinite; }
        .animate-custom-fade-in-up {
            opacity: 0;
            animation: custom-fadeInUp 0.65s cubic-bezier(0.22,1,0.36,1) forwards;
        }

        /* Nav link hover underline */
        .nav-link {
            position: relative;
            padding-bottom: 2px;
        }
        .nav-link::after {
            content: '';
            position: absolute;
            bottom: -2px; left: 0;
            width: 0; height: 1.5px;
            background: currentColor;
            transition: width 0.25s ease;
            border-radius: 2px;
        }
        .nav-link:hover::after { width: 100%; }

        /* Tilt card smooth transition */
        .tilt-card {
            transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
            will-change: transform;
            transform-style: preserve-3d;
        }
        .tilt-card:hover {
            box-shadow: 0 24px 60px rgba(0,0,0,0.25);
        }
        .glass-panel {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        }
        
        .glass-card {
            background: rgba(15, 23, 42, 0.22); 
            backdrop-filter: blur(8px);
            border: 1px solid rgba(148, 163, 184, 0.08); 
        }

        .text-gradient-logo {
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-image: linear-gradient(135deg, #cbd5e1 0%, #475569 100%);
        }
        
        .bg-noise {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
        }

        /* ── Light mode overrides ── */
        .landing-light .glass-panel {
            background: rgba(255, 255, 255, 0.32);
            border: 1px solid rgba(148, 163, 184, 0.3);
            box-shadow: 0 8px 32px 0 rgba(100, 116, 139, 0.15);
        }
        .landing-light .glass-card {
            background: rgba(248, 250, 252, 0.55);
            border: 1px solid rgba(148, 163, 184, 0.18);
        }
        .landing-light .text-gradient-logo {
            background-image: linear-gradient(135deg, #334155 0%, #64748b 100%);
        }

        /* ── Custom scrollbar ── */
        .landing-scroll {
            scrollbar-width: thin;
            scrollbar-color: transparent transparent;
        }
        .landing-scroll::-webkit-scrollbar { width: 3px; }
        .landing-scroll::-webkit-scrollbar-track { background: transparent; }
        .landing-scroll::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 9999px;
            transition: background 0.4s ease, width 0.4s ease;
        }
        .landing-scroll:hover {
            scrollbar-color: rgba(100,116,139,0.3) transparent;
        }
        .landing-scroll:hover::-webkit-scrollbar { width: 4px; }
        .landing-scroll:hover::-webkit-scrollbar-thumb {
            background: rgba(100,116,139,0.3);
        }
        .landing-scroll.is-scrolling {
            scrollbar-color: rgba(100,116,139,0.6) transparent;
        }
        .landing-scroll.is-scrolling::-webkit-scrollbar { width: 5px; }
        .landing-scroll.is-scrolling::-webkit-scrollbar-thumb {
            background: rgba(100,116,139,0.6);
        }
        /* light mode */
        .landing-scroll.landing-light-scroll:hover {
            scrollbar-color: rgba(71,85,105,0.3) transparent;
        }
        .landing-scroll.landing-light-scroll:hover::-webkit-scrollbar-thumb {
            background: rgba(71,85,105,0.3);
        }
        .landing-scroll.landing-light-scroll.is-scrolling {
            scrollbar-color: rgba(71,85,105,0.55) transparent;
        }
        .landing-scroll.landing-light-scroll.is-scrolling::-webkit-scrollbar-thumb {
            background: rgba(71,85,105,0.55);
        }
      `}} />

      <div
        onScroll={(e) => {
          const el = e.currentTarget as HTMLDivElement & { _scrollTimer?: ReturnType<typeof setTimeout> };
          el.classList.add('is-scrolling');
          clearTimeout(el._scrollTimer);
          el._scrollTimer = setTimeout(() => el.classList.remove('is-scrolling'), 600);
        }}
        className={`landing-scroll ${isLight ? 'landing-light-scroll' : ''} min-h-screen md:h-screen w-full md:overflow-auto flex items-start justify-center p-0 md:p-6 lg:p-8 transition-colors duration-500 md:min-w-[1080px] ${isLight ? 'bg-slate-100' : 'bg-slate-950'}`}>
          <main className={`landing-light-wrapper relative w-full md:min-h-full max-w-[1920px] mx-auto md:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col transition-colors duration-500 ${isLight ? 'landing-light bg-white/80 ring-1 ring-slate-200' : 'bg-slate-900 ring-1 ring-white/10'}`}>
            
            {/* 1. Background Image Layer with Cinematic Blur */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/images/landing_bg_female_2.jpg"
                    alt="Background Ambience"
                    fill
                    priority
                    sizes="100vw"
                    className={`object-cover transition-opacity duration-500 ${isLight ? 'opacity-100 mix-blend-luminosity' : 'opacity-100 mix-blend-overlay'}`}
                    style={{ objectPosition: '50% 20%' }}
                />
                {/* Gradient overlays */}
                {isLight ? (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-0 via-white/20 to-white/60"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-transparent to-slate-50/60"></div>
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-slate-900/70 to-slate-900/50"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/30"></div>
                    </>
                )}
                {/* Noise Texture */}
                <div className="absolute inset-0 bg-noise opacity-30 mix-blend-soft-light pointer-events-none"></div>
            </div>

            {/* 2. Navigation Bar (Simplified for integration) */}
            <nav className="relative z-20 flex justify-between items-center px-6 py-6 md:px-16 md:py-12">
                {/* Brand - functionally purely decorative here as Header is global */}
                <div className="flex items-center gap-3 group cursor-pointer opacity-100 transition-opacity">
                    {/* SVG Logo Chat Bubble */}
                    <div className={`relative w-10 h-10 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform duration-300 ${
                        isLight
                            ? 'bg-gradient-to-br from-slate-200 to-white shadow-sm border border-slate-200'
                            : 'bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg border border-white/10'
                    }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${isLight ? 'text-slate-700' : 'text-slate-100'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        {/* Small AI Sparkle */}
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full blur-[2px] animate-pulse ${isLight ? 'bg-blue-500' : 'bg-blue-400'}`}></div>
                    </div>
                    <span className={`text-xl font-bold tracking-tight group-hover:opacity-80 transition-opacity ${
                        isLight ? 'text-slate-700' : 'text-gradient-logo'
                    }`}>TrialChat</span>
                </div>

                {/* Simple Menu */}
                <div className={`hidden md:flex items-center gap-6 text-sm font-medium transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    <span className={`nav-link transition-colors cursor-pointer ${isLight ? 'hover:text-slate-900' : 'hover:text-white'}`}>Why TrialChat</span>
                    <span className={`nav-link transition-colors cursor-pointer ${isLight ? 'hover:text-slate-900' : 'hover:text-white'}`}>How it Works</span>

                    {/* Icon + Updates buttons group */}
                    <div className="flex items-center gap-2">
                    {/* Theme toggle */}
                    <button
                        onClick={() => setPreference(preference === 'dark' ? 'light' : 'dark')}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 border hover:scale-110 active:scale-95 ${
                            isLight
                                ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:shadow-md hover:shadow-slate-200'
                                : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:shadow-md hover:shadow-black/20'
                        }`}
                        aria-label="Toggle theme"
                    >
                        {isLight ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="5" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                        )}
                    </button>

                    {/* Font size toggle */}
                    <button
                        onClick={() => setFontSize(nextFontSize[fontSize])}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 border hover:scale-110 active:scale-95 ${
                            isLight
                                ? 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:shadow-md hover:shadow-slate-200'
                                : 'bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:shadow-md hover:shadow-black/20'
                        }`}
                        aria-label="Change font size"
                        title={`Font size: ${fontSize}`}
                    >
                        <span className="font-bold leading-none text-[13px]">
                            {fontSizeLabel[fontSize]}
                        </span>
                    </button>

                    <Link href="/trial-chat/updates" className={`px-4 py-2 rounded-full border transition-all duration-200 flex items-center gap-2 hover:scale-105 active:scale-95 ${
                        isLight ? 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:shadow-md hover:shadow-slate-200' : 'border-white/20 bg-white/5 hover:bg-white/10 hover:shadow-md hover:shadow-black/20'
                    }`}>
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Updates
                    </Link>

                    </div>{/* end buttons group */}
                </div>

                {/* Mobile Menu Button - Hamburger */}
                <button 
                    className="md:hidden p-2 text-slate-300 hover:text-white transition-colors relative z-50"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        {isMobileMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        )}
                    </svg>
                </button>

                {/* Mobile Menu Overlay */}
                 {isMobileMenuOpen && (
                    <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-xl md:hidden flex flex-col items-center justify-center space-y-8 animate-custom-fade-in-up">
                        <span className="text-2xl font-light text-slate-300 hover:text-white cursor-pointer">Why TrialChat</span>
                        <span className="text-2xl font-light text-slate-300 hover:text-white cursor-pointer">How it Works</span>
                        <Link href="/trial-chat/updates" className="text-2xl font-bold text-white flex items-center gap-3">
                            Updates
                        </Link>
                    </div>
                )}
            </nav>

            {/* 3. Main Content Area */}
            <div className="relative z-10 flex-1 flex flex-col md:flex-row items-end md:items-center justify-between px-6 md:px-16 pb-12 md:pb-0">
                
                {/* Left Side: Massive Typography */}
                <div className="w-full md:w-1/2 flex flex-col justify-end md:pb-24 space-y-4 self-end">
                    {/* Subtitle Tag */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wider uppercase w-fit animate-custom-fade-in-up transition-colors duration-300 ${
                        isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-400/20 text-blue-200'
                    }`} style={{animationDelay: '0.1s'}}>
                        <i className="ph ph-brain text-lg"></i>
                        Alzheimer&apos;s disease Clinical Navigator
                    </div>

                    {/* Main Giant Title */}
                    <h1 className={`leading-[0.9] tracking-tighter mix-blend-overlay opacity-90 animate-custom-fade-in-up transition-colors duration-300 ${isLight ? 'text-slate-800' : 'text-slate-100'}`} style={{animationDelay: '0.25s', fontFamily: 'sans-serif', fontSize: 'clamp(3.5rem, 8vw + 1rem, 9rem)'}}>
                        <span className="font-light">trial</span><span className="font-bold">chat</span>
                    </h1>
                    
                    {/* Tagline */}
                    <p className={`text-lg md:text-2xl font-light max-w-lg animate-custom-fade-in-up transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} style={{animationDelay: '0.4s'}}>
                        Connecting seniors, caregivers, and clinicians to{' '}
                        <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Alzheimer&apos;s research</span>
                        {' '}with clarity and compassion.
                    </p>

                    {/* Footer / Credits (Desktop Position) */}
                    <div className={`hidden md:block pt-12 opacity-60 text-xs font-mono animate-custom-fade-in-up transition-colors duration-300 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} style={{animationDelay: '0.55s'}}>
                        <p>TRIALCHAT is provided by <a href={buildTrackedUrl("https://s-3.io", { cta: "footer-s3-link" })} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80 transition-opacity">S-3 Research LLC</a></p>
                        <p className="mt-1">© 2026 All Rights Reserved</p>
                    </div>
                </div>

                {/* Right Side: The Glass "Interface" Card */}
                <div className="w-full md:w-[420px] lg:w-[480px] animate-custom-fade-in-up" style={{ animationDelay: '0.5s' }}>

                {/* Card with hover lift */}
                <div className="rounded-3xl overflow-hidden transition-transform duration-300 hover:scale-[1.02] hover:-translate-y-1">
                    
                    {/* Main Glass Container */}
                    <div className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden group">
                        
                        {/* Decorative blurred circle behind content */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/30 transition-colors duration-500"></div>

                        {/* Intro Text inside Card */}
                        <div className="mb-8 relative z-10">
                            <h2 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${isLight ? 'text-slate-800' : 'text-white'}`}>Find your path.</h2>
                            <p className={`text-sm leading-relaxed transition-colors duration-300 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                Navigating clinical trials shouldn&apos;t be confusing. We simplify the journey for Alzheimer patients and their families.
                            </p>
                        </div>

                        {/* CTA Button Area */}
                        <div className="relative z-10 flex flex-col gap-3">
                            {/* Button 1: Learn about Alzheimer's disease — hidden, kept for future re-enable */}
                            {false && (
                            <Link href={chatHref} className="w-full block group/btn relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-200 to-slate-400 p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900">
                                <div className="relative h-full w-full rounded-xl bg-slate-900 px-6 py-4 transition-all group-hover/btn:bg-slate-800">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-200 group-hover/btn:text-white transition-colors">Learn about Alzheimer&apos;s disease</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-200 group-hover/btn:translate-x-1 transition-transform">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                            )}

                            {/* Button 2: Match me to Trials — blue shimmer */}
                            <div className="shimmer-border-btn transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25">
                                <Link
                                    href="/trial-chat/chat?skip_intake=1&open_match=1"
                                    className={`flex items-center justify-between w-full py-4 px-6 rounded-[10px] transition-colors focus:outline-none ${isLight ? 'bg-white hover:bg-slate-50' : 'bg-[#0f1623] hover:bg-slate-800'}`}
                                >
                                    <span className="flex items-center gap-2 font-semibold">
                                        <span className={`bg-gradient-to-r bg-clip-text text-transparent ${isLight ? 'from-blue-600 to-sky-500' : 'from-blue-400 to-sky-300'}`}>
                                            Match me to trials
                                        </span>
                                    </span>
                                    <svg className={`w-4 h-4 fill-current ${isLight ? 'text-blue-500' : 'text-blue-400'}`} viewBox="0 0 24 24">
                                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                    </svg>
                                </Link>
                            </div>

                            {/* Button 3: Use as a clinician — hidden, kept for future re-enable */}
                            {false && (
                            <button
                                onClick={() => setShowClinicianModal(true)}
                                className={`flex items-center justify-between w-full py-4 px-6 rounded-[10px] border transition-all focus:outline-none group/clinician ${
                                    isLight 
                                        ? 'border-slate-200 bg-transparent hover:bg-slate-50 text-slate-600 hover:text-slate-900' 
                                        : 'border-white/10 bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <span className="flex items-center gap-2 font-medium text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 opacity-70">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                    Use as a clinician
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover/clinician:translate-x-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                            </button>
                            )}
                        </div>

                        {/* Space between CTA and Feature Stack */}
                        <div className="flex items-center justify-center mt-4 mb-4">
                            {/* <div className={`h-px w-16 ${isLight ? 'bg-slate-300/70' : 'bg-white/20'}`}></div> */}
                        </div>

                        {/* Feature Stack */}
                        <div className="space-y-3 relative z-10">
                            <p className={`text-md font-semibold leading-relaxed mb-3 transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>How we help.</p>
                            {/* Feature 1 */}
                            <div className="glass-card p-3.5 rounded-xl flex items-center gap-3 cursor-default">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner opacity-80 transition-colors duration-300 ${isLight ? 'bg-blue-50/70 text-blue-500' : 'bg-slate-800/35 text-blue-300'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className={`text-[13px] font-medium transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Personalized Education</h3>
                                    <p className={`text-[11px] transition-colors duration-300 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Learn about Alzheimer&apos;s disease on your terms.</p>
                                </div>
                            </div>

                            {/* Feature 2 */}
                            <div className="glass-card p-3.5 rounded-xl flex items-center gap-3 cursor-default">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner opacity-80 transition-colors duration-300 ${isLight ? 'bg-purple-50/70 text-purple-500' : 'bg-slate-800/35 text-purple-300'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className={`text-[13px] font-medium transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Smart Trial Matching</h3>
                                    <p className={`text-[11px] transition-colors duration-300 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Find studies fitting your needs & location.</p>
                                </div>
                            </div>

                            {/* Feature 3 */}
                            <div className="glass-card p-3.5 rounded-xl flex items-center gap-3 cursor-default">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner opacity-80 transition-colors duration-300 ${isLight ? 'bg-emerald-50/70 text-emerald-500' : 'bg-slate-800/35 text-emerald-300'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className={`text-[13px] font-medium transition-colors duration-300 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Simplified Engagement</h3>
                                    <p className={`text-[11px] transition-colors duration-300 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Connect directly to trial sites.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>{/* end card hover div */}

                {/* Trust Badges — below the card */}
                <div className={`mt-6 mb-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] md:text-xs font-medium uppercase tracking-widest transition-colors duration-300 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {/* <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                            </svg>
                            HIPAA Compliant
                        </div> */}
                        <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                            </svg>
                            Secure & Private
                        </div>
                        <div className="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                                <path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
                            </svg>
                            Expert Guidance
                        </div>
                    </div>
                </div>{/* end outer card wrapper */}

            </div>

            {/* Mobile Footer */}
            <div className={`md:hidden p-6 text-center text-xs backdrop-blur-md border-t transition-colors duration-300 ${
                isLight ? 'text-slate-500 bg-white/80 border-slate-200' : 'text-slate-600 bg-slate-950/80 border-white/5'
            }`}>
                <p>TRIALCHAT is provided by <a href={buildTrackedUrl("https://s-3.io", { cta: "footer-s3-link" })} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80 transition-opacity">S-3 Research LLC</a></p>
                <Link href="/trial-chat/updates" className="mt-2 inline-block text-slate-400 underline">View Updates</Link>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 left-1/3 w-[1px] h-full bg-white/5 pointer-events-none hidden lg:block"></div>
            <div className="absolute top-0 left-2/3 w-[1px] h-full bg-white/5 pointer-events-none hidden lg:block"></div>
            
          </main>
      </div>

      {showClinicianModal && (
        <ClinicianModal onClose={() => setShowClinicianModal(false)} />
      )}
    </>
  );
}
