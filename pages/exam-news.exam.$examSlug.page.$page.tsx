import React from "react";
import { ExamNewsListingRoute } from "../components/ExamNewsListingRoute";

/** Old /exam-news/exam/{exam-slug}/page/{n} URL: moves to /exam-news/{exam-slug}/page/{n} (a 301 from the SSR). */
const ExamNewsExamArchivePage: React.FC = () => <ExamNewsListingRoute />;

export default ExamNewsExamArchivePage;