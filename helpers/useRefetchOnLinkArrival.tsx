import { useEffect, useRef } from "react";

/*
 * Lists stay cached for 30 minutes and never refetch on mount, so a list opened
 * from a dashboard tile could be older than the number on the tile. Pass true
 * while the page is showing a tile's URL params; the list refetches once.
 */
export const useRefetchOnLinkArrival = (fromLink: boolean, isFetching: boolean, refetch: () => unknown) => {
  const refetched = useRef(false);
  useEffect(() => {
    if (refetched.current || !fromLink) return;
    refetched.current = true;
    if (!isFetching) refetch();
  }, [fromLink, isFetching, refetch]);
};