"use client";
import { useCallback, useEffect, useState } from "react";
import { getOrCreateGuestUserId } from "@/lib/guestId";
import { addTrialBookmark, removeTrialBookmark, readBookmarks, BOOKMARK_EVENT, type TrialBookmark, type TrialSnapshot } from "@/lib/bookmarks";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<TrialBookmark[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const refresh = useCallback(() => {
    try {
      setBookmarks(readBookmarks(localStorage, getOrCreateGuestUserId()));
      setReady(true);
      setError(undefined);
    } catch { setError("Bookmarks could not be loaded. Check browser storage access."); }
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(BOOKMARK_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(BOOKMARK_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  const setBookmarked = (trialId: string, value: boolean, trial?: TrialSnapshot, provenance?: Pick<TrialBookmark, "sourceThreadId" | "sourceSearchId">) => {
    try {
      const userId = getOrCreateGuestUserId();
      if (value) addTrialBookmark(localStorage, userId, trialId, trial, provenance);
      else removeTrialBookmark(localStorage, userId, trialId);
      window.dispatchEvent(new Event(BOOKMARK_EVENT));
    } catch { setError("Could not save your bookmark. Please try again."); }
  };
  return { bookmarks, ready, error, refresh, setBookmarked, isTrialBookmarked: (id: string) => bookmarks.some((b) => b.trialId === id) };
}

