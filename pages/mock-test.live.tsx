import { Navigate, useLocation } from "react-router-dom";
import { LIVE_TESTS_PATH } from "../helpers/liveTestRoutes";

/* Retired URL. The published app answers it with a 301 from the prefetch; this covers client-side navigation. */
export default function LegacyLiveTestsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${LIVE_TESTS_PATH}${search}`} replace={true} />;
}
