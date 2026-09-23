import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postAdminContentEditSession } from "../endpoints/admin/content-edit/session_POST.schema";
import type { AdminEditType } from "./adminContentEdit";

/*
 * The teacher editors call /_api/teacher/* and /_api/upload/* through plain fetch. While an admin
 * editor is open, this tab's fetch adds the admin editing session to those calls only; every
 * other request, including the admin's own, goes out untouched.
 */
const SCOPED_PATH = /^\/_api\/(teacher|upload)\//;
const REFRESH_MS = 90 * 60 * 1000;

let activeToken: string | null = null;
let nativeFetch: typeof fetch | null = null;

function scopedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const base = nativeFetch ?? fetch;
  if (!activeToken) return base(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (url.origin !== window.location.origin || !SCOPED_PATH.test(url.pathname)) return base(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("Authorization", `Bearer ${activeToken}`);
  return base(input, { ...init, headers });
}

function attach(token: string) {
  activeToken = token;
  if (!nativeFetch) {
    nativeFetch = window.fetch.bind(window);
    window.fetch = scopedFetch;
  }
}

function detach() {
  activeToken = null;
  if (nativeFetch) {
    window.fetch = nativeFetch;
    nativeFetch = null;
  }
}

export function useAdminContentEditSession(type: AdminEditType, id: number | null) {
  const query = useQuery({
    queryKey: ["admin", "contentEditSession", type, id],
    queryFn: () => postAdminContentEditSession({ type, id: id! }),
    enabled: !!id,
    gcTime: 0,
    staleTime: REFRESH_MS,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const token = query.data?.token ?? null;
  const [attachedToken, setAttachedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    attach(token);
    setAttachedToken(token);
  }, [token]);

  useEffect(() => detach, []);

  return {
    /* The editor mounts only once its requests carry the session. */
    ready: !!token && attachedToken !== null,
    data: query.data,
    error: query.error,
    retry: query.refetch,
    isRetrying: query.isFetching,
  };
}