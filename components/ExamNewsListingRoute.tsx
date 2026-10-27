import React from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { ExamNewsHubView } from "./ExamNewsHubView";

/* Reads /exam-news[/type/{type}][/page/{n}] from the route and renders the listing. */
export const ExamNewsListingRoute: React.FC = () => {
  const params = useParams<{ type?: string; page?: string }>();
  const location = useLocation();
  const page = examNewsPublicMeta.parsePage(params.page);
  const type = params.type !== undefined ? examNewsPublicMeta.typeFromSegment(params.type.toLowerCase()) : undefined;
  const scope = { type: type ?? undefined };

  // The SSR answers /page/1 with a 301.
  if (page !== null && params.page !== undefined && page === 1) {
    return <Navigate to={`${examNewsPublicMeta.listingPath(scope, page)}${location.search}`} replace />;
  }

  return <ExamNewsHubView scope={scope} page={page ?? 1} invalid={page === null || type === null} />;
};
