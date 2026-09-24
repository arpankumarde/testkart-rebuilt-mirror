import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PdfReaderSource } from "../components/PdfReader";
import { getReaderInfo } from "../endpoints/reader/info_GET.schema";
import { readerPageUrl, type ReaderDocumentRef } from "./readerDocumentRef";

// Opens a paid or preview document as watermarked page images rendered on the server, so neither the file nor
// a link to it ever reaches the browser.
export const useProtectedDocument = (ref: ReaderDocumentRef | null, enabled = true) => {
  const refKey = ref ? JSON.stringify(ref) : null;

  const query = useQuery({
    queryKey: ["reader", "info", refKey],
    queryFn: () => getReaderInfo(JSON.parse(refKey!) as ReaderDocumentRef),
    enabled: enabled && refKey !== null,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const info = query.data;

  const source = useMemo<PdfReaderSource | null>(() => {
    if (!refKey || !info) return null;
    const document = JSON.parse(refKey) as ReaderDocumentRef;
    return {
      kind: "images",
      cacheKey: ["reader", "page", refKey],
      pageCount: info.totalPages,
      loadPage: async (page) => ({
        imageUrl: readerPageUrl(document, page),
        ...(page === 1 ? info.firstPage : {}),
      }),
    };
  }, [refKey, info]);

  return {
    source,
    title: info?.title ?? null,
    totalPages: info?.totalPages ?? null,
    isLoading: enabled && refKey !== null && query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: () => void query.refetch(),
  };
};