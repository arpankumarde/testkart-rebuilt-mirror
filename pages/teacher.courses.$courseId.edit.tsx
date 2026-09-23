import React from "react";
import { useParams } from "react-router-dom";
import { CourseEditorWorkspace } from "../components/CourseEditorWorkspace";

export default function EditCoursePage() {
  const { courseId: courseIdParam } = useParams<{ courseId: string }>();
  const courseId = courseIdParam ? parseInt(courseIdParam, 10) : NaN;
  return <CourseEditorWorkspace courseId={courseId} />;
}