import { useQuery } from "@tanstack/react-query";
import {
  getIfscLookup,
  isValidIfscFormat,
  IfscLookupError,
  type OutputType as IfscRecord,
} from "../endpoints/ifsc-lookup_GET.schema";

export const IFSC_LOOKUP_QUERY_KEY = "ifsc-lookup";

/*
 * Resolves a bank name from an IFSC code. Only runs once the code is a
 * complete, well-formed IFSC, so it does not fire on every keystroke.
 */
export const useIfscLookup = (ifsc: string) => {
  const normalized = ifsc.trim().toUpperCase();

  return useQuery<IfscRecord, IfscLookupError>({
    queryKey: [IFSC_LOOKUP_QUERY_KEY, normalized],
    queryFn: () => getIfscLookup({ ifsc: normalized }),
    enabled: isValidIfscFormat(normalized),
    /* A branch record is fixed, so once fetched it never needs refreshing and
       re-typing a code the user already tried costs nothing. */
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    /* "Not found" is an answer, not a blip - retrying it just delays the
       warning. A directory that could not be reached is worth one retry. */
    retry: (failureCount, error) =>
      !(error instanceof IfscLookupError && error.notFound) && failureCount < 1,
  });
};
