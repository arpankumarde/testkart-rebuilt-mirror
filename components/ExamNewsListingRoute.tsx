import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { ExamNewsHubView } from "./ExamNewsHubView";

/* Reads /exam-news[/type/{type}|/exam/{exam-slug}][/page/{n}] from the route and renders the listing. */
export const ExamNewsListingRoute: React.FC = () => {
  const params = useParams<{ type?: string; examSlug?: string; page?: string }>();
  const page = examNewsPublicMeta.parsePage(params.page);
  const type = params.type !== undefined ? examNewsPublicMeta.typeFromSegment(params.type.toLowerCase()) : undefined;
  const examSlug = params.examSlug?.toLowerCase();
  const scope = { type: type ?? undefined, examSlug };

  // /page/1 is the listing itself; the SSR answers it with a 301.
  if (params.page !== undefined && page === 1) return <Navigate to={examNewsPublicMeta.listingPath(scope)} replace />;

  return <ExamNewsHubView scope={scope} page={page ?? 1} invalid={page === null || type === null} />;
};