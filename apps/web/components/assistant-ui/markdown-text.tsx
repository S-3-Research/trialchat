"use client";

import { memo } from "react";
import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for assistant messages, wired into
 * `MessagePrimitive.Content`'s `components.Text` slot (see thread.tsx).
 * Styling follows the "calm clinical assistant" design system: dark navy
 * headings, semibold field labels, thin light-gray dividers, simple
 * bullet-based metadata.
 */
const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cx(
        "mt-4 mb-2 scroll-m-20 text-lg font-semibold text-slate-800 dark:text-slate-100 first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cx(
        "mt-4 mb-2 scroll-m-20 text-base font-semibold text-slate-800 dark:text-slate-100 first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cx(
        "mt-3 mb-1.5 scroll-m-20 text-[15px] font-semibold text-slate-800 dark:text-slate-100 first:mt-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cx("mb-3 leading-[1.7] last:mb-0", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cx(
        "font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
        className,
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cx("mb-3 ml-5 list-disc space-y-1 last:mb-0", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cx("mb-3 ml-5 list-decimal space-y-1 last:mb-0", className)}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cx("leading-[1.6] pl-1", className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong
      className={cx("font-semibold text-slate-800 dark:text-slate-100", className)}
      {...props}
    />
  ),
  em: ({ className, ...props }) => (
    <em className={cx("italic", className)} {...props} />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cx("my-4 border-t border-slate-200 dark:border-slate-700", className)}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cx(
        "mb-3 border-l-2 border-slate-200 pl-3 text-slate-500 last:mb-0 dark:border-slate-700 dark:text-slate-400",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table
        className={cx(
          "w-full border-collapse text-[13.5px]",
          className,
        )}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cx(
        "border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cx(
        "border-b border-slate-100 px-2 py-1.5 align-top dark:border-slate-800",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cx(
        "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cx(
        "mb-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[13px] text-slate-100 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
});

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}
