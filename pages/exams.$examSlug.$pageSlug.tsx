import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { ExamContentSiloPage } from "../components/ExamContentSiloPage";
import { CUSTOM_PAGE_SLUG_PATTERN, customPageType } from "../helpers/examContentTypes";

// Admin-added custom exam pages (/exams/:examSlug/:pageSlug). The built-in
// pages (syllabus, mock-tests, ...) have their own routes, which win over this
// one. An unknown or unpublished slug falls back to the exam hub.
export default function ExamCustomContentPage() {
  const { examSlug, pageSlug } = useParams<{ examSlug: string; pageSlug: string }>();
  if (!pageSlug || !CUSTOM_PAGE_SLUG_PATTERN.test(pageSlug)) {
    return <Navigate to={`/exams/${examSlug}`} replace />;
  }
  return <ExamContentSiloPage key={pageSlug} pageType={customPageType(pageSlug)} />;
}