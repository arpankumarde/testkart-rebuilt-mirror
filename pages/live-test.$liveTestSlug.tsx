import { Navigate, useLocation, useParams } from "react-router-dom";
import { liveTestPath } from "../helpers/liveTestRoutes";

/*
 * Retired URL. Live test detail pages moved to /mock-test/live/:slug. The
 * published app answers it with a 301 from the prefetch; this covers
 * client-side navigation and keeps the query string so a PayU return
 * still reaches the payment check.
 */
export default function LegacyLiveTestSlugRedirect() {
  const { liveTestSlug = "" } = useParams<{ liveTestSlug: string }>();
  const { search } = useLocation();
  return <Navigate to={`${liveTestPath(liveTestSlug)}${search}`} replace={true} />;
}
