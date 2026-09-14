export default function DevTestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
      {children}
    </div>
  );
}
