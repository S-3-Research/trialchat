import TestModeSync from "@/components/TestModeSync";

export default function TrialChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TestModeSync />
      {children}
    </>
  );
}
