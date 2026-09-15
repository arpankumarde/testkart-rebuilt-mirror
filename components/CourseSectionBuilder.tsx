import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Video, FileText, HelpCircle, FileType, Check, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { CourseSectionForm } from './CourseSectionForm';
import { ConsoleConfirmDialog } from './ConsoleConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';
import { useTeacherCourseDetailsQuery, useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import type { OutputType as TeacherCourseDetails } from '../endpoints/teacher/courses/details_GET.schema';
import { toast } from 'sonner';
import styles from './CourseSectionBuilder.module.css';

type Section = TeacherCourseDetails['sections'][number];
type Lesson = Section['lessons'][number];
type Mutations = ReturnType<typeof useTeacherCourseMutations>;
type DeleteTarget = { kind: 'section'; section: Section } | { kind: 'lesson'; lesson: Lesson };

const lessonIcons = {
  video: <Video size={16} />,
  text: <FileText size={16} />,
  pdf: <FileType size={16} />,
  quiz: <HelpCircle size={16} />,
};

const pluralLessons = (count: number) => `${count} ${count === 1 ? 'lesson' : 'lessons'}`;

type CourseSectionBuilderProps = {
  courseId: number;
  onContinue?: () => void;
};

export const CourseSectionBuilder: React.FC<CourseSectionBuilderProps> = ({ courseId, onContinue }) => {
  const { data: courseDetails, isPending } = useTeacherCourseDetailsQuery(courseId);
  const mutations = useTeacherCourseMutations();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Gate on data, not isFetching: every curriculum change refetches in the background.
  if (!courseDetails) {
    if (isPending) {
      return <CourseSectionBuilderSkeleton />;
    }
    return (
      <div className={styles.errorState} role="alert">
        <p>Unable to load course details. Please try again.</p>
      </div>
    );
  }

  const sections = courseDetails.sections || [];
  const isReordering = mutations.reorderSectionsMutation.isPending || mutations.reorderLessonsMutation.isPending;

  const moveSection = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (isReordering || target < 0 || target >= sections.length) return;
    const orderedSectionIds = sections.map((section) => section.id);
    [orderedSectionIds[index], orderedSectionIds[target]] = [orderedSectionIds[target], orderedSectionIds[index]];
    mutations.reorderSectionsMutation.mutate({ courseId, orderedSectionIds });
  };

  const moveLesson = (section: Section, index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (isReordering || target < 0 || target >= section.lessons.length) return;
    const orderedLessonIds = section.lessons.map((lesson) => lesson.id);
    [orderedLessonIds[index], orderedLessonIds[target]] = [orderedLessonIds[target], orderedLessonIds[index]];
    mutations.reorderLessonsMutation.mutate({ courseId, sectionId: section.id, orderedLessonIds });
  };

  const isDeletePending = deleteTarget?.kind === 'section'
    ? mutations.deleteSectionMutation.isPending
    : mutations.deleteLessonMutation.isPending;

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'section') {
      mutations.deleteSectionMutation.mutate(
        { sectionId: deleteTarget.section.id },
        {
          onSuccess: () => {
            toast.success('Section deleted.');
            setDeleteTarget(null);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete section.'),
        }
      );
    } else {
      mutations.deleteLessonMutation.mutate(
        { lessonId: deleteTarget.lesson.id },
        {
          onSuccess: () => {
            toast.success('Lesson deleted.');
            setDeleteTarget(null);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete lesson.'),
        }
      );
    }
  };

  return (
    <div className={styles.builderContainer}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.heading}>Course Curriculum</h2>
          <p className={styles.headerMeta}>
            {sections.length} {sections.length === 1 ? 'section' : 'sections'} ·{' '}
            {pluralLessons(sections.reduce((total, section) => total + section.lessons.length, 0))}
          </p>
        </div>
        <AddSectionDialog courseId={courseId} mutations={mutations} />
      </div>

      {sections.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No sections have been added yet.</p>
          <p>Start building your course curriculum by adding a section.</p>
        </div>
      ) : (
        <div className={styles.sectionsList}>
          {sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              courseId={courseId}
              mutations={mutations}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              onMoveUp={() => moveSection(index, -1)}
              onMoveDown={() => moveSection(index, 1)}
              onMoveLesson={(lessonIndex, offset) => moveLesson(section, lessonIndex, offset)}
              onDeleteSection={() => setDeleteTarget({ kind: 'section', section })}
              onDeleteLesson={(lesson) => setDeleteTarget({ kind: 'lesson', lesson })}
            />
          ))}
        </div>
      )}

      {onContinue && (
        <div className={styles.continueContainer}>
          <Button onClick={onContinue} size="lg">
            Continue to Review
          </Button>
        </div>
      )}

      <ConsoleConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletePending) setDeleteTarget(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title={deleteTarget?.kind === 'section' ? 'Delete this section?' : 'Delete this lesson?'}
        description={
          deleteTarget?.kind === 'section' ? (
            <>
              <strong>{deleteTarget.section.title}</strong>
              {deleteTarget.section.lessons.length > 0
                ? ` and its ${pluralLessons(deleteTarget.section.lessons.length)} will be removed permanently.`
                : ' will be removed permanently.'}{' '}
              This cannot be undone.
            </>
          ) : deleteTarget?.kind === 'lesson' ? (
            <>
              <strong>{deleteTarget.lesson.title}</strong> will be removed permanently. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        isPending={isDeletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

const SectionCard: React.FC<{
  section: Section;
  courseId: number;
  mutations: Mutations;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLesson: (lessonIndex: number, offset: -1 | 1) => void;
  onDeleteSection: () => void;
  onDeleteLesson: (lesson: Lesson) => void;
}> = ({ section, courseId, mutations, isFirst, isLast, onMoveUp, onMoveDown, onMoveLesson, onDeleteSection, onDeleteLesson }) => {
  const isDeletingSection =
    mutations.deleteSectionMutation.isPending && mutations.deleteSectionMutation.variables?.sectionId === section.id;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleContainer}>
          <div className={styles.moveButtons}>
            <Button variant="ghost" size="icon-sm" onClick={onMoveUp} disabled={isFirst} aria-label={`Move section ${section.title} up`}>
              <ChevronUp size={16} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onMoveDown} disabled={isLast} aria-label={`Move section ${section.title} down`}>
              <ChevronDown size={16} />
            </Button>
          </div>
          <h3 className={styles.sectionTitle}>{section.title}</h3>
          <span className={styles.sectionMeta}>{pluralLessons(section.lessons.length)}</span>
        </div>
        <div className={styles.sectionActions}>
          <EditSectionDialog section={section} courseId={courseId} mutations={mutations} />
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.deleteButton}
            onClick={onDeleteSection}
            disabled={isDeletingSection}
            aria-label={`Delete section ${section.title}`}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className={styles.lessonsList}>
        {section.lessons.map((lesson, lessonIndex) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            courseId={courseId}
            mutations={mutations}
            isFirst={lessonIndex === 0}
            isLast={lessonIndex === section.lessons.length - 1}
            onMoveUp={() => onMoveLesson(lessonIndex, -1)}
            onMoveDown={() => onMoveLesson(lessonIndex, 1)}
            onDelete={() => onDeleteLesson(lesson)}
          />
        ))}
        <div className={styles.addLessonContainer}>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/teacher/courses/${courseId}/lessons/new?sectionId=${section.id}`}>
              <Plus size={14} /> Add Lesson
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

const LessonItem: React.FC<{
  lesson: Lesson;
  courseId: number;
  mutations: Mutations;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}> = ({ lesson, courseId, mutations, isFirst, isLast, onMoveUp, onMoveDown, onDelete }) => {
  const hasContent = (() => {
    if (lesson.contentType === 'video' || lesson.contentType === 'pdf') {
      return !!lesson.contentUrl;
    }
    if (lesson.contentType === 'text' || lesson.contentType === 'quiz') {
      return !!lesson.textContent;
    }
    return false;
  })();

  const contentTypeLabel = lesson.contentType.charAt(0).toUpperCase() + lesson.contentType.slice(1);
  const isDeleting =
    mutations.deleteLessonMutation.isPending && mutations.deleteLessonMutation.variables?.lessonId === lesson.id;

  return (
    <div className={styles.lessonItem}>
      <div className={styles.lessonTitleContainer}>
        <div className={styles.moveButtons}>
          <Button variant="ghost" size="icon-sm" onClick={onMoveUp} disabled={isFirst} aria-label={`Move lesson ${lesson.title} up`}>
            <ChevronUp size={16} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onMoveDown} disabled={isLast} aria-label={`Move lesson ${lesson.title} down`}>
            <ChevronDown size={16} />
          </Button>
        </div>
        <div className={styles.lessonIcon} aria-hidden="true">{lessonIcons[lesson.contentType as keyof typeof lessonIcons]}</div>
        <span className={styles.lessonTitle}>{lesson.title}</span>
        {lesson.isPreview && <span className={styles.previewBadge}>Preview</span>}
        {hasContent ? (
          <span className={`${styles.contentBadge} ${styles.contentBadgeHasContent}`}>
            <Check size={12} /> {contentTypeLabel}
          </span>
        ) : (
          <span className={`${styles.contentBadge} ${styles.contentBadgeNoContent}`}>
            <AlertCircle size={12} /> No content
          </span>
        )}
      </div>
      <div className={styles.lessonActions}>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={`/teacher/courses/${courseId}/lessons/${lesson.id}`} aria-label={`Edit lesson ${lesson.title}`}>
            <Edit size={14} />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={styles.deleteButton}
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Delete lesson ${lesson.title}`}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
};

const AddSectionDialog: React.FC<{
  courseId: number;
  mutations: Mutations;
}> = ({ courseId, mutations }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (values: any) => {
    mutations.createSectionMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Section created.');
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'An error occurred.');
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> Add Section
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Section</DialogTitle>
        </DialogHeader>
        <CourseSectionForm
          courseId={courseId}
          onSuccess={() => setIsOpen(false)}
          onSubmit={handleSubmit}
          isSubmitting={mutations.createSectionMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
};

const EditSectionDialog: React.FC<{
  section: Section;
  courseId: number;
  mutations: Mutations;
}> = ({ section, courseId, mutations }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (values: any) => {
    mutations.updateSectionMutation.mutate(values, {
      onSuccess: () => {
        toast.success('Section updated.');
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'An error occurred.');
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit section ${section.title}`}>
          <Edit size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Section</DialogTitle>
        </DialogHeader>
        <CourseSectionForm
          courseId={courseId}
          sectionToEdit={section}
          onSuccess={() => setIsOpen(false)}
          onSubmit={handleSubmit}
          isSubmitting={mutations.updateSectionMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
};

const CourseSectionBuilderSkeleton = () => (
  <div className={styles.builderContainer}>
    <div className={styles.header}>
      <Skeleton style={{ height: '2rem', width: '200px' }} />
      <Skeleton style={{ height: '2.5rem', width: '150px' }} />
    </div>
    <div className={styles.sectionsList}>
      {[...Array(2)].map((_, i) => (
        <div className={styles.section} key={i}>
          <div className={styles.sectionHeader}>
            <Skeleton style={{ height: '1.5rem', width: '60%' }} />
            <Skeleton style={{ height: '1.5rem', width: '80px' }} />
          </div>
          <div className={styles.lessonsList}>
            <Skeleton style={{ height: '2.5rem' }} />
            <Skeleton style={{ height: '2.5rem' }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);
