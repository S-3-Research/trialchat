export const DEMOS = {
  'trial-chat': {
    id: 'trial-chat',
    name: 'Trial Chat',
    description: 'AI-powered chat interface for clinical trials',
    path: '/trial-chat',
    hidden: false,
  },
} as const;

export type DemoId = keyof typeof DEMOS;

/**
 * Verify password with the server and set cookie if valid
 */
export async function verifyPassword(
  demoId: DemoId,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/demo-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demoId, password }),
    });

    const data = await response.json();
    return data;
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Check if demo is unlocked by reading cookie
 * This is client-side check only
 */
export function isDemoUnlockedClient(demoId: DemoId): boolean {
  if (typeof document === 'undefined') return false;
  
  const cookies = document.cookie.split(';');
  const demoCookie = cookies.find(cookie => 
    cookie.trim().startsWith(`demo-${demoId}=`)
  );
  
  const isUnlocked = demoCookie?.includes('unlocked') ?? false;
  
  // Debug logging
  console.log(`[demoAuth] Checking ${demoId}:`, {
    allCookies: document.cookie,
    demoCookie,
    isUnlocked
  });
  
  return isUnlocked;
}

/**
 * Check if demo is unlocked by calling API
 * This is server-verified check
 */
export async function isDemoUnlocked(demoId: DemoId): Promise<boolean> {
  try {
    const response = await fetch(`/api/demo-auth?demoId=${demoId}`);
    const data = await response.json();
    return data.unlocked ?? false;
  } catch {
    return false;
  }
}

/**
 * Lock a demo by removing its cookie
 */
export function lockDemo(demoId: DemoId): void {
  if (typeof document === 'undefined') return;
  
  // Set cookie to expire immediately
  document.cookie = `demo-${demoId}=; path=/; max-age=0`;
}

/**
 * Lock all demos
 */
export function lockAllDemos(): void {
  Object.keys(DEMOS).forEach(demoId => {
    lockDemo(demoId as DemoId);
  });
}
