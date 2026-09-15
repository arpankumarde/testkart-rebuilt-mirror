import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type ListUrlParamUpdates = Record<string, string | number | null | undefined>;

/*
 * List filters a dashboard can link to live in the URL, so a tile's link lands
 * on exactly the rows it counted and the sidebar link (no params) resets them.
 *
 * read() only accepts whitelisted values, so a stale or hand-edited link falls
 * back instead of reaching an endpoint's enum check. write() sets several keys
 * in one navigation - react-router's setter reads the params from render, so
 * back-to-back calls would keep only the last change. It replaces the history
 * entry, so Back still returns to the page the link was clicked on. Empty,
 * null and undefined values remove the key.
 */
export const useListUrlParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const read = useCallback(
    <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
      const value = searchParams.get(key);
      return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
    },
    [searchParams]
  );

  const readId = useCallback(
    (key = "id"): number | null => {
      const raw = searchParams.get(key);
      if (raw === null || !/^\d+$/.test(raw)) return null;
      const id = Number(raw);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    },
    [searchParams]
  );

  const write = useCallback(
    (updates: ListUrlParamUpdates) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return { searchParams, read, readId, write };
};