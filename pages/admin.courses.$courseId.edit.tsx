import React from "react";
import { useParams } from "react-router-dom";
import { AdminContentEditShell } from "../components/AdminContentEditShell";
import { CourseEditorWorkspace } from "../components/CourseEditorWorkspace";

export default function AdminEditCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = Number(courseId);
  const validId = Number.isInteger(id) && id > 0 ? id : null;

  return (
    <AdminContentEditShell key={validId ?? "invalid"} type="course" id={validId} listHref="/admin/courses" listLabel="courses">
      {validId !== null && <CourseEditorWorkspace courseId={validId} />}
    </AdminContentEditShell>
  );
}