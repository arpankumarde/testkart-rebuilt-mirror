import { useCallback, useState } from "react";

/*
 * The page number of a server-paged list. It falls back to page 1 whenever
 * filterKey changes (search, status, sort), without an extra render that
 * would first fetch the old page under the new filters.
 */
export const useListPage = (filterKey: string): [number, (page: number) => void] => {
  const [state, setState] = useState({ key: filterKey, page: 1 });
  const page = state.key === filterKey ? state.page : 1;
  const setPage = useCallback((next: number) => setState({ key: filterKey, page: next }), [filterKey]);
  return [page, setPage];
};