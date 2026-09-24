import React from "react";
import { useParams } from "react-router-dom";
import { PdfReaderPage } from "../components/PdfReaderPage";
import { useProtectedDocument } from "../helpers/useProtectedDocument";

const toId = (value: string | undefined): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = parseInt(value, 10);
  return id > 0 ? id : null;
};

export default function StudentCourseReadPage() {
  const { courseId: courseIdParam, lessonId: lessonIdParam } = useParams<{
    courseId: string;
    lessonId: string;
  }>();

  const courseId = toId(courseIdParam);
  const lessonId = toId(lessonIdParam);
  const isLinkValid = courseId !== null && lessonId !== null;

  const { source, title, isLoading, error, refetch } = useProtectedDocument(
    courseId !== null && lessonId !== null ? { type: "lesson", courseId, lessonId } : null,
  );

  let message: string | null = null;
  if (!isLinkValid) {
    message = "This link is not valid. Open the lesson again from your course.";
  } else if (error) {
    message = "This lesson could not be opened. Check that you are signed in to an account enrolled in the course, then try again.";
  }

  return (
    <PdfReaderPage
      title={title ?? "Course lesson"}
      note="Read only"
      source={source}
      loading={isLinkValid && isLoading}
      error={message}
      onRetry={isLinkValid ? refetch : undefined}
      restricted
    />
  );
}