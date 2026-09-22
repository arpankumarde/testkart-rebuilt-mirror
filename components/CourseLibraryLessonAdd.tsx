import React, { useState } from "react";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { TeacherAssetPicker } from "./TeacherAssetPicker";
import { useTeacherCourseMutations } from "../helpers/useTeacherCoursesQuery";
import { useTeacherAssetMutations } from "../helpers/useTeacherAssets";
import type { TeacherAsset } from "../helpers/teacherAssetFiles";

const pluralLessons = (count: number) => `${count} ${count === 1 ? "lesson" : "lessons"}`;

/*
 * Adds library videos and PDFs to a course section, one lesson per file, in the
 * order they were picked. Saving the lesson is what sends a DRM teacher's video
 * to secure streaming, exactly as with a freshly uploaded one.
 */
export const CourseLibraryLessonAdd: React.FC<{ sectionId: number; sectionTitle: string }> = ({
  sectionId,
  sectionTitle,
}) => {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { createLessonMutation } = useTeacherCourseMutations();
  const { invalidateAssets } = useTeacherAssetMutations();

  const addLessons = async (assets: TeacherAsset[]) => {
    setIsAdding(true);
    let added = 0;
    const failed: string[] = [];
    for (const asset of assets) {
      try {
        await createLessonMutation.mutateAsync({
          sectionId,
          title: asset.name,
          contentType: asset.kind,
          contentUrl: asset.url,
          contentFileId: asset.key,
          durationMinutes:
            asset.kind === "video" && asset.durationSeconds ? Math.max(1, Math.round(asset.durationSeconds / 60)) : null,
          isPreview: false,
        });
        added += 1;
      } catch {
        failed.push(asset.name);
      }
    }
    setIsAdding(false);
    invalidateAssets();

    if (added > 0) toast.success(`${pluralLessons(added)} added to ${sectionTitle}.`);
    if (failed.length > 0) {
      toast.error(`These files were not added: ${failed.join(", ")}. Try them again.`);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderOpen size={14} /> Add from library
      </Button>
      <TeacherAssetPicker
        open={open}
        onOpenChange={setOpen}
        kinds={["video", "pdf"]}
        multiple
        title="Add lessons from your library"
        description={
          <>
            Each file becomes a lesson in <strong>{sectionTitle}</strong>, named after the file. You can edit the lessons
            afterwards.
          </>
        }
        confirmLabel={(count) => (count > 0 ? `Add ${pluralLessons(count)}` : "Add lessons")}
        isPending={isAdding}
        onConfirm={(assets) => void addLessons(assets)}
      />
    </>
  );
};