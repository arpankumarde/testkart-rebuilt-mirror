import React from "react";
import { useParams } from "react-router-dom";
import { ExamNewsStoryView } from "../components/ExamNewsStoryView";

/** /exam-news/{slug}: one story. */
const ExamNewsSlugPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  return <ExamNewsStoryView slug={decodeURIComponent(slug).toLowerCase()} />;
};

export default ExamNewsSlugPage;
