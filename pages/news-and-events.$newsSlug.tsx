import { Navigate, useLocation, useParams } from "react-router-dom";

/*
 * Retired URL: /news-and-events/:slug became /press/:slug. The published app
 * answers it with a 301 from the prefetch; this covers client-side navigation
 * and the preview. A renamed slug is settled by the press page itself.
 */
export default function LegacyNewsArticleRedirect() {
  const { newsSlug = "" } = useParams<{ newsSlug: string }>();
  const { search, hash } = useLocation();
  return <Navigate to={`/press/${encodeURIComponent(newsSlug)}${search}${hash}`} replace={true} />;
}