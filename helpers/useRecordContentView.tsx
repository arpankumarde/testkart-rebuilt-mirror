import { useEffect } from "react";
import {
  CONTENT_VIEW_DEDUP_MINUTES,
  postContentViewRecord,
  type ContentViewKind,
} from "../endpoints/content-views/record_POST.schema";

const STORAGE_PREFIX = "tk:content-view:";
const WINDOW_MS = CONTENT_VIEW_DEDUP_MINUTES * 60 * 1000;
/* Used when sessionStorage is blocked, so re-renders and refetches still send one request. */
const memory = new Map<string, number>();

const lastSent = (key: string): number => {
  try {
    const stored = Number(window.sessionStorage.getItem(STORAGE_PREFIX + key));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // Storage unavailable; fall through to memory.
  }
  return memory.get(key) ?? 0;
};

const markSent = (key: string, at: number) => {
  memory.set(key, at);
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, String(at));
  } catch {
    // Memory alone still covers this tab.
  }
};

/**
 * Records one public view of a published post once it has rendered. Only the public article views
 * call this, never the admin previews. A tab sends at most one request per post inside the window,
 * and the server applies the same window per visitor.
 */
export function useRecordContentView(kind: ContentViewKind, id: number | null | undefined) {
  useEffect(() => {
    if (!id) return;
    const key = `${kind}:${id}`;
    const now = Date.now();
    if (now - lastSent(key) < WINDOW_MS) return;
    markSent(key, now);
    postContentViewRecord({ kind, id }).catch(() => {
      // A lost view is not worth surfacing to the reader.
    });
  }, [kind, id]);
}
