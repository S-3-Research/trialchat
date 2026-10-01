import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ThreadNavigation } from "@/components/bookmarks/ThreadScope";
import SettingsPage from "@/app/(trial-chat)/(main)/settings/page";
import { IntakeFormEdit } from "@/components/IntakeFormEdit";
import { INTAKE_STORAGE_KEY } from "@/lib/types/intake";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), append: vi.fn(), switchToNewThread: vi.fn(),
  switchToThread: vi.fn(), getThread: vi.fn(), setText: vi.fn(),
}));
const aui = {
  thread: { append: mocks.append, getState: () => ({ messages: [] }) },
  threads: { switchToNewThread: mocks.switchToNewThread, switchToThread: mocks.switchToThread },
  composer: { setText: mocks.setText },
};
vi.mock("@assistant-ui/react", () => ({ useAui: () => aui, useAuiState: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/agentClient", () => ({ createAgentClient: () => ({ threads: { get: mocks.getThread } }) }));
vi.mock("@/lib/guestId", () => ({ getOrCreateGuestUserId: () => "visitor" }));
let root: ReactTestRenderer | undefined;
let storage: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  storage = new Map();
  const store = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  vi.stubGlobal("sessionStorage", store);
  vi.stubGlobal("localStorage", store);
  vi.stubGlobal("window", { location: { href: "https://example.com/chat?new=1" }, history: { replaceState: vi.fn() }, dispatchEvent: vi.fn() });
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; vi.unstubAllGlobals(); });

describe("canonical chat entry", () => {
  it("hands the clinician request to a new conversation once", async () => {
    storage.set("clinician_prescreen_prompt", "Screen this patient");
    await act(async () => { root = create(<ThreadNavigation enabled={false} />); });
    expect(mocks.append).not.toHaveBeenCalled();
    await act(async () => { root?.update(<ThreadNavigation enabled />); });
    expect(mocks.switchToNewThread).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledWith("Screen this patient");
    expect(storage.has("clinician_prescreen_prompt")).toBe(false);
    await act(async () => { root?.update(<ThreadNavigation />); });
    expect(mocks.append).toHaveBeenCalledOnce();
  });
  it("preserves bookmarked thread entry without sending a pending clinician request", async () => {
    window.location.href = "https://example.com/chat?thread=saved";
    storage.set("clinician_prescreen_prompt", "Screen this patient");
    mocks.getThread.mockResolvedValue({ metadata: { userId: "visitor", initialPrompt: "Compare these trials" } });
    await act(async () => { root = create(<ThreadNavigation />); });
    expect(mocks.switchToThread).toHaveBeenCalledWith("saved");
    expect(mocks.setText).toHaveBeenCalledWith("Compare these trials");
    expect(mocks.append).not.toHaveBeenCalled();
  });
  it("saves guest preferences and returns to the new chat without calling the retired tools API", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const intake = { role: "user", intent: "trial_matching", response_style: "balanced" };
    storage.set(INTAKE_STORAGE_KEY, JSON.stringify(intake));
    await act(async () => { root = create(<SettingsPage />); });
    const updated = { ...intake, response_style: "concise" };
    await act(async () => { await root!.root.findByType(IntakeFormEdit).props.onSave(updated); });
    expect(JSON.parse(storage.get(INTAKE_STORAGE_KEY)!)).toEqual(updated);
    expect(mocks.push).toHaveBeenCalledWith("/chat");
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRestore();
  });
});
