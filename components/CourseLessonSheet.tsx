import React, { useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './Sheet';
import {
  CourseLessonEditor,
  lessonTypeLabel,
  type CourseLessonEditorHandle,
  type LessonContentType,
} from './CourseLessonEditor';
import type { OutputType as TeacherCourseDetails } from '../endpoints/teacher/courses/details_GET.schema';
import styles from './CourseLessonSheet.module.css';

type Section = TeacherCourseDetails['sections'][number];

export type LessonSheetTarget = {
  sectionId: number;
  /** Omitted for a new lesson. */
  lessonId?: number;
  contentType?: LessonContentType;
};

interface CourseLessonSheetProps {
  courseId: number;
  sections: Section[];
  target: LessonSheetTarget | null;
  onClose: () => void;
}

/*
 * Opens a lesson beside the chapter list instead of on its own page, so the
 * teacher never loses their place. Closing asks first when the lesson has
 * unsaved edits or an upload still running.
 */
export const CourseLessonSheet: React.FC<CourseLessonSheetProps> = ({ courseId, sections, target, onClose }) => {
  const editorRef = useRef<CourseLessonEditorHandle>(null);
  const sectionIndex = target ? sections.findIndex((section) => section.id === target.sectionId) : -1;
  const section = sectionIndex >= 0 ? sections[sectionIndex] : undefined;
  const lesson = target?.lessonId ? section?.lessons.find((item) => item.id === target.lessonId) : undefined;
  const isMissing = !!target && (!section || (!!target.lessonId && !lesson));

  // The chapter or lesson was deleted while the panel was opening.
  useEffect(() => {
    if (isMissing) onClose();
  }, [isMissing, onClose]);

  const open = !!target && !isMissing;
  const typeLabel = lessonTypeLabel(lesson?.contentType ?? target?.contentType ?? 'video').toLowerCase();

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (editorRef.current) editorRef.current.requestClose();
        else onClose();
      }}
    >
      <SheetContent side="right" className={styles.sheet}>
        {open && section ? (
          <>
            <SheetHeader className={styles.header}>
              <SheetTitle className={styles.title}>{lesson ? 'Edit lesson' : `New ${typeLabel} lesson`}</SheetTitle>
              <SheetDescription className={styles.description}>
                Chapter {sectionIndex + 1}: {section.title}
              </SheetDescription>
            </SheetHeader>
            <div className={styles.body}>
              <CourseLessonEditor
                ref={editorRef}
                key={lesson ? `lesson-${lesson.id}` : `new-${section.id}-${target?.contentType ?? 'video'}`}
                courseId={courseId}
                sectionId={section.id}
                lesson={lesson}
                initialContentType={target?.contentType}
                onDone={onClose}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
