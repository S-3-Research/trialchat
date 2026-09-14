import Header from "@/components/Header";
import TestModeBanner from "@/components/TestModeBanner";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen w-full overflow-hidden flex flex-col relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Cinematic Background - Light Mode */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-200 via-slate-100 to-white opacity-100 dark:opacity-0 transition-opacity duration-500 pointer-events-none"></div>
      
      {/* Cinematic Background - Dark Mode (Matches Homepage Texture) */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-0 dark:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      
      {/* Shared Noise Texture */}
      <div className="absolute inset-0 top-0 left-0 w-full h-full bg-noise opacity-[0.03] dark:opacity-[0.05] pointer-events-none z-0 mix-blend-overlay"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full w-full">
        <TestModeBanner />
        <Header />
        <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {children}
        </main>
      </div>
    </div>
  );
}
