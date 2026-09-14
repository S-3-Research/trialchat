/**
 * Debug logger factory.
 *
 * Logging is enabled when ANY of the following is true:
 *   - NODE_ENV !== 'production'   → npm run dev 自动开启
 *   - NEXT_PUBLIC_DEBUG === 'true' → env 变量手动开启（适用于 staging 等任意环境）
 *
 * Usage:
 *   const log = createLogger('MyComponent');
 *   log('Something happened:', data);  // → [MyComponent] Something happened: ...
 */

export const isDebugEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEBUG === "true";

export function createLogger(tag: string) {
  return (...args: unknown[]): void => {
    if (isDebugEnabled) {
      console.log(`[${tag}]`, ...args);
    }
  };
}
