import React from "react";
import { useParams } from "react-router-dom";
import { ExamNewsStoryView } from "../components/ExamNewsStoryView";
import { ExamNewsHubView } from "../components/ExamNewsHubView";
import { useExamNewsDetails } from "../helpers/useExamNewsPublic";

/** /exam-news/{slug}: one story, else the news listing of the exam with that slug. */
const ExamNewsSlugPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const clean = decodeURIComponent(slug).toLowerCase();
  const details = useExamNewsDetails(clean);

  if (details.data === null) return <ExamNewsHubView scope={{ examSlug: clean }} page={1} />;
  return <ExamNewsStoryView slug={clean} />;
};

export default ExamNewsSlugPage;
