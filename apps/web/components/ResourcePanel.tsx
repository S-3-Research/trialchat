"use client";

interface ResourcePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResourcePanel({ isOpen, onClose }: ResourcePanelProps) {
  if (!isOpen) return null;

  return (
    <div className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          MOCA Test
        </h2>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          aria-label="Close panel"
          type="button"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <iframe
          title="MOCA Test"
          className="h-full w-full rounded"
          src="https://www.mdcalc.com/calc/10044/montreal-cognitive-assessment-moca"
        />
      </div>
    </div>
  );
}
