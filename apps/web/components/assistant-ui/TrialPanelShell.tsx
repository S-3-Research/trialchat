"use client";
import type { ReactNode } from "react";
import { PanelRightClose } from "lucide-react";

export const PANEL_PADDING_X = "pl-6 pr-5";

/** Shared visual structure; callers own search vs. snapshot behavior. */
export function TrialPanelShell({ title, count, onClose, description, children }: {
  title: string;
  count: number;
  onClose: () => void;
  description?: ReactNode;
  children: ReactNode;
}) {
  return <section aria-label={title} className="w-full h-full flex flex-col pt-5 pb-5 min-w-0">
    <div className={`flex items-center justify-between mb-2 shrink-0 ${PANEL_PADDING_X}`}>
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}
        {count > 0 && <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold">{count}</span>}
      </h2>
      <button onClick={onClose} aria-label="Collapse trial panel" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><PanelRightClose className="w-4 h-4" strokeWidth={2} /></button>
    </div>
    {description && <div className={`shrink-0 pb-3 ${PANEL_PADDING_X}`}>{description}</div>}
    <div className="relative flex-1 min-h-0">
      <div className={`absolute inset-0 overflow-y-auto sidebar-scrollbar ${PANEL_PADDING_X} pt-4 pb-2`} style={{ maskImage: "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 1rem), transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 1rem, black calc(100% - 1rem), transparent 100%)" }}>
        {children}
      </div>
    </div>
  </section>;
}
