import React from "react";
import { useParams } from "react-router-dom";
import { PdfReaderPage } from "../components/PdfReaderPage";
import { useSignedPdfUrl } from "../helpers/useSignedPdfUrl";
import { documentSource } from "../helpers/pdfReaderSources";

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

  const { signedUrl, title, isLoading, error, refetch } = useSignedPdfUrl({
    courseId,
    lessonId,
    enabled: isLinkValid,
  });

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
      source={signedUrl ? documentSource(signedUrl) : null}
      loading={isLinkValid && isLoading}
      error={message}
      onRetry={isLinkValid ? refetch : undefined}
      restricted
    />
  );
}
