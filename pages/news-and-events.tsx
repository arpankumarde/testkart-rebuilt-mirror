import { Navigate, useLocation } from "react-router-dom";

/* Retired URL: News & Events became /press. The published app answers it with a 301 from the prefetch; this covers client-side navigation and the preview. */
export default function LegacyNewsAndEventsRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/press${search}${hash}`} replace={true} />;
}