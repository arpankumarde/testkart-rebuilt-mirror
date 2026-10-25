import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { ExamNewsHubView } from "./ExamNewsHubView";

/*
 * Reads /exam-news[/type/{type}|/{exam-slug}][/page/{n}] from the route and renders the listing.
 * The old /exam-news/exam/{exam-slug} routes arrive with examSlug and move to the current URL.
 */
export const ExamNewsListingRoute: React.FC = () => {
  const params = useParams<{ type?: string; slug?: string; examSlug?: string; page?: string }>();
  const location = useLocation();
  const page = examNewsPublicMeta.parsePage(params.page);
  const type = params.type !== undefined ? examNewsPublicMeta.typeFromSegment(params.type.toLowerCase()) : undefined;
  const examSlug = (params.slug ?? params.examSlug)?.toLowerCase();
  const scope = { type: type ?? undefined, examSlug };
  const legacy = params.examSlug !== undefined;

  // The SSR answers these with a 301.
  if (page !== null && (legacy || (params.page !== undefined && page === 1))) {
    return <Navigate to={`${examNewsPublicMeta.listingPath(scope, page)}${location.search}`} replace />;
  }

  return <ExamNewsHubView scope={scope} page={page ?? 1} invalid={page === null || type === null} />;
};
