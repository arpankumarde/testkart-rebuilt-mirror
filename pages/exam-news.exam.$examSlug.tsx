import React from "react";
import { ExamNewsListingRoute } from "../components/ExamNewsListingRoute";

/** Old /exam-news/exam/{exam-slug} URL: moves to /exam-news/{exam-slug} (a 301 from the SSR). */
const ExamNewsExamPage: React.FC = () => <ExamNewsListingRoute />;

export default ExamNewsExamPage;