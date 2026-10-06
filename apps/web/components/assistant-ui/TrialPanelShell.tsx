"use client";
import type { ReactNode } from "react";
import { PanelRightClose, Maximize2, Minimize2 } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

export const PANEL_PADDING_X = "pl-6 pr-5";

/** Shared visual structure; callers own search vs. snapshot behavior. */
export function TrialPanelShell({ title, count, onClose, isFullscreen, onToggleFullscreen, fullscreenDisabled, headerActions, statusBadge, description, selfScrollingBody, children }: {
  title: string;
  count: number;
  onClose?: () => void;
  /** Whether this panel is currently the sole visible panel (desktop
   * layoutMode === "trial-full"/"chat-full" — see AssistantPanel.tsx).
   * Only meaningful together with `onToggleFullscreen`. */
  isFullscreen?: boolean;
  /** Toggles this panel between the default dual-panel layout and taking
   * over the whole surface. Rendered as its own Maximize2/Minimize2
   * button. */
  onToggleFullscreen?: () => void;
  /** Renders the same fullscreen button, but disabled (dimmed, no-op) —
   * used by the bookmark snapshot panel, which is always locked to the
   * dual layout, so it keeps the exact same header controls as the
   * regular Trial Panel/Chat pair instead of silently dropping the
   * button (consistency over hiding). */
  fullscreenDisabled?: boolean;
  /** Extra controls rendered to the right of the title (e.g. the Trial
   * Panel's New Search / Search History icon row). Rendered alongside
   * `onClose`/`onToggleFullscreen` if supplied. */
  headerActions?: ReactNode;
  /** A short-lived confirmation pill (see components/ui/TransientBadge.tsx)
   * rendered next to the title — e.g. "Filters updated" after a Panel
   * refine lands, or a bookmark/unbookmark confirmation. */
  statusBadge?: ReactNode;
  description?: ReactNode;
  /** Set when `children` already manages its own scrolling + top/bottom
   * fade (e.g. TrialSearchStartForm, which needs its own internal scroll
   * region so its CTA footer can stay pinned outside of it — see that
   * component's own doc comment). Skips this shell's own scroll
   * container/fade overlays entirely so the two don't nest — a child
   * scroll area within a parent scroll area (both independently faded)
   * otherwise visibly doubles up the fade band at the shared edge. */
  selfScrollingBody?: boolean;
  children: ReactNode;
}) {
  return <section aria-label={title} className="w-full h-full flex flex-col pt-4 pb-5 min-w-0">
    <div className={`flex items-center justify-between mb-2 shrink-0 ${PANEL_PADDING_X}`}>
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0">{title}
          {count > 0 && <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold">{count}</span>}
        </h2>
        {statusBadge}
      </div>
      <div className="flex items-center gap-1">
        {headerActions}
        {(onToggleFullscreen || fullscreenDisabled) && (
          <Tooltip label={fullscreenDisabled ? "Fullscreen unavailable for bookmarked trials" : isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <button
              onClick={fullscreenDisabled ? undefined : onToggleFullscreen}
              disabled={fullscreenDisabled}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className={`p-1.5 rounded-lg ${fullscreenDisabled ? "text-slate-300 dark:text-slate-600 cursor-not-allowed" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" strokeWidth={2} /> : <Maximize2 className="w-4 h-4" strokeWidth={2} />}
            </button>
          </Tooltip>
        )}
        {onClose && (
          <Tooltip label="Collapse trial panel">
            <button onClick={onClose} aria-label="Collapse trial panel" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><PanelRightClose className="w-4 h-4" strokeWidth={2} /></button>
          </Tooltip>
        )}
      </div>
    </div>
    {description && <div className={`shrink-0 pb-3 ${PANEL_PADDING_X}`}>{description}</div>}
    {selfScrollingBody ? (
      // Child owns its own scroll region + fade — just give it the
      // available box and the shared horizontal padding, nothing else
      // (no second scroll container, no second fade overlay stacked on
      // top of the child's own).
      <div className={`relative flex-1 min-h-0 ${PANEL_PADDING_X}`}>{children}</div>
    ) : (
      <div className="relative flex-1 min-h-0">
        <div className={`absolute inset-0 overflow-y-auto sidebar-scrollbar ${PANEL_PADDING_X} pt-4 pb-2`}>
          {children}
        </div>
        {/* Simple gradient-overlay fade instead of a `mask-image` on the
         * scroll container itself — two thin pointer-events-none divs
         * layered on top of the scroll area's edges, fading from the
         * panel's own background color to transparent. Matches the panel
         * chrome's bg (see AssistantPanel.tsx's `bg-white dark:bg-[#181D26]`
         * on the outer rounded-[32px] wrapper) so the fade reads as part of
         * the panel rather than a visible seam. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white dark:from-[#181D26] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white dark:from-[#181D26] to-transparent" />
      </div>
    )}
  </section>;
}
