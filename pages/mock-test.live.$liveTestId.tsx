import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getLiveTestsDetails } from "../endpoints/live-tests/details_GET.schema";
import { liveTestPath } from "../helpers/liveTestRoutes";
import { isNotFoundError } from "../helpers/isNotFoundError";
import { NotFoundState } from "../components/NotFoundState";
import { Skeleton } from "../components/Skeleton";

/*
 * Retired URL. The published app answers it with a 301 from the prefetch; this
 * covers client-side navigation and the preview. Accepts an id or a slug, and
 * keeps the query string so a PayU return still reaches the payment check.
 */
export default function LegacyLiveTestRedirect() {
  const { liveTestId = "" } = useParams<{ liveTestId: string }>();
  const { search } = useLocation();
  const lookup = /^\d+$/.test(liveTestId) ? { id: Number(liveTestId) } : { slug: liveTestId };

  const { data, error } = useQuery({
    queryKey: ["legacyLiveTestSlug", liveTestId],
    queryFn: () => getLiveTestsDetails(lookup),
    enabled: liveTestId !== "",
    retry: (failureCount, err) => !isNotFoundError(err) && failureCount < 2,
  });

  if (data) return <Navigate to={`${liveTestPath(data.slug)}${search}`} replace={true} />;
  if (error || liveTestId === "") return <NotFoundState kind="live" />;
  return <Skeleton style={{ height: "24rem", margin: "var(--spacing-6)" }} />;
}
