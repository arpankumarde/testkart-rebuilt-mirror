import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, Type } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { Dialog } from './Dialog';
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogHeader } from './ConsoleDialog';
import { ConsoleConfirmDialog } from './ConsoleConfirmDialog';
import { CourseSectionForm } from './CourseSectionForm';
import { CourseBulkVideoUpload } from './CourseBulkVideoUpload';
import { CourseLibraryLessonAdd } from './CourseLibraryLessonAdd';
import { CourseLessonSheet, type LessonSheetTarget } from './CourseLessonSheet';
import { LESSON_TYPE_OPTIONS, lessonTypeLabel, type LessonContentType } from './CourseLessonEditor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { useTeacherCourseDetailsQuery, useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { formatCourseMinutes, lessonHasContent, pluralize, sumLessonMinutes } from '../helpers/courseDraft';
import type { OutputType as TeacherCourseDetails } from '../endpoints/teacher/courses/details_GET.schema';
import styles from './CourseSectionBuilder.module.css';

type Section = TeacherCourseDetails['sections'][number];
type Lesson = Section['lessons'][number];
type Mutations = ReturnType<typeof useTeacherCourseMutations>;
type Sensors = SensorDescriptor<SensorOptions>[];
type DeleteTarget = { kind: 'section'; section: Section } | { kind: 'lesson'; lesson: Lesson };

const EMPTY_LESSON_LABELS: Record<string, string> = {
  video: 'No video yet',
  pdf: 'No PDF yet',
  text: 'No text yet',
  quiz: 'No questions yet',
};

const lessonIcon = (type: string) => LESSON_TYPE_OPTIONS.find((option) => option.value === type)?.icon;

/*
 * The Content tab of the course editor: chapters (course sections) and their
 * lessons as one numbered outline. Chapters are added and renamed in place;
 * lessons open in a side panel. Order changes by dragging the grip or through
 * each row's menu, which is also the keyboard-free path.
 */
export const CourseSectionBuilder: React.FC<{ courseId: number }> = ({ courseId }) => {
  const { data: courseDetails, isPending } = useTeacherCourseDetailsQuery(courseId);
  const mutations = useTeacherCourseMutations();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [sheetTarget, setSheetTarget] = useState<LessonSheetTarget | null>(null);
  const closeSheet = useCallback(() => setSheetTarget(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Gate on data, not isFetching: every curriculum change refetches in the background.
  if (!courseDetails) {
    if (isPending) return <CourseSectionBuilderSkeleton />;
    return (
      <div className={styles.errorState} role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        Could not load this course's chapters. Refresh the page to try again.
      </div>
    );
  }

  const sections = courseDetails.sections || [];
  const isReordering = mutations.reorderSectionsMutation.isPending || mutations.reorderLessonsMutation.isPending;

  const reorderSections = (from: number, to: number) => {
    if (isReordering || from === to || to < 0 || to >= sections.length) return;
    const orderedSectionIds = arrayMove(sections.map((section) => section.id), from, to);
    mutations.reorderSectionsMutation.mutate({ courseId, orderedSectionIds });
  };

  const reorderLessons = (section: Section, from: number, to: number) => {
    if (isReordering || from === to || to < 0 || to >= section.lessons.length) return;
    const orderedLessonIds = arrayMove(section.lessons.map((lesson) => lesson.id), from, to);
    mutations.reorderLessonsMutation.mutate({ courseId, sectionId: section.id, orderedLessonIds });
  };

  const handleSectionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const ids = sections.map((section) => section.id);
    reorderSections(ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
  };

  const isDeletePending =
    deleteTarget?.kind === 'section' ? mutations.deleteSectionMutation.isPending : mutations.deleteLessonMutation.isPending;

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const onError = (fallback: string) => (error: unknown) =>
      toast.error(error instanceof Error && error.message ? error.message : fallback);
    if (deleteTarget.kind === 'section') {
      mutations.deleteSectionMutation.mutate(
        { sectionId: deleteTarget.section.id },
        {
          onSuccess: () => {
            toast.success('Chapter deleted.');
            setDeleteTarget(null);
          },
          onError: onError('Could not delete the chapter. Try again.'),
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
          onError: onError('Could not delete the lesson. Try again.'),
        }
      );
    }
  };

  return (
    <div className={styles.builder}>
      {sections.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.chapters} aria-label="Chapters">
              {sections.map((section, index) => (
                <ChapterItem
                  key={section.id}
                  section={section}
                  number={index + 1}
                  courseId={courseId}
                  mutations={mutations}
                  sensors={sensors}
                  isFirst={index === 0}
                  isLast={index === sections.length - 1}
                  onMove={(offset) => reorderSections(index, index + offset)}
                  onMoveLesson={(from, to) => reorderLessons(section, from, to)}
                  onOpenLesson={(target) => setSheetTarget(target)}
                  onDeleteSection={() => setDeleteTarget({ kind: 'section', section })}
                  onDeleteLesson={(lesson) => setDeleteTarget({ kind: 'lesson', lesson })}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : null}

      <NewChapterForm courseId={courseId} mutations={mutations} isFirst={sections.length === 0} />

      <CourseLessonSheet courseId={courseId} sections={sections} target={sheetTarget} onClose={closeSheet} />

      <ConsoleConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletePending) setDeleteTarget(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title={deleteTarget?.kind === 'section' ? 'Delete this chapter?' : 'Delete this lesson?'}
        description={
          deleteTarget?.kind === 'section' ? (
            <>
              <strong>{deleteTarget.section.title}</strong>
              {deleteTarget.section.lessons.length > 0
                ? ` and its ${pluralize(deleteTarget.section.lessons.length, 'lesson')} will be removed for good.`
                : ' will be removed for good.'}{' '}
              This cannot be undone.
            </>
          ) : deleteTarget?.kind === 'lesson' ? (
            <>
              <strong>{deleteTarget.lesson.title}</strong> will be removed for good. This cannot be undone.
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

const ChapterItem: React.FC<{
  section: Section;
  number: number;
  courseId: number;
  mutations: Mutations;
  sensors: Sensors;
  isFirst: boolean;
  isLast: boolean;
  onMove: (offset: -1 | 1) => void;
  onMoveLesson: (from: number, to: number) => void;
  onOpenLesson: (target: LessonSheetTarget) => void;
  onDeleteSection: () => void;
  onDeleteLesson: (lesson: Lesson) => void;
}> = ({
  section,
  number,
  courseId,
  mutations,
  sensors,
  isFirst,
  isLast,
  onMove,
  onMoveLesson,
  onOpenLesson,
  onDeleteSection,
  onDeleteLesson,
}) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const keepMenuFocus = useRef(false);
  const minutes = sumLessonMinutes(section.lessons);

  const handleLessonDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const ids = section.lessons.map((lesson) => lesson.id);
    onMoveLesson(ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
  };

  const startRename = () => {
    keepMenuFocus.current = true;
    setIsRenaming(true);
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.chapter} ${isDragging ? styles.dragging : ''}`}
    >
      <div className={styles.chapterHead}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={`Drag to reorder chapter ${number}, ${section.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <span className={styles.chapterNumber} aria-hidden="true">
          {number}
        </span>

        {isRenaming ? (
          <ChapterRename section={section} mutations={mutations} onDone={() => setIsRenaming(false)} />
        ) : (
          <button
            type="button"
            className={styles.chapterTitle}
            onClick={startRename}
            aria-label={`Chapter ${number}: ${section.title}. Rename`}
          >
            <span className={styles.chapterTitleText}>{section.title}</span>
            <Pencil size={14} aria-hidden="true" className={styles.renameIcon} />
          </button>
        )}

        <span className={styles.chapterMeta}>
          {pluralize(section.lessons.length, 'lesson')}
          {minutes > 0 ? `, ${formatCourseMinutes(minutes)}` : ''}
        </span>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Chapter ${number} options`} className={styles.menuButton}>
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={styles.menu}
            onCloseAutoFocus={(event) => {
              if (keepMenuFocus.current) {
                event.preventDefault();
                keepMenuFocus.current = false;
              }
            }}
          >
            <DropdownMenuItem onSelect={startRename}>
              <Pencil size={16} /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                keepMenuFocus.current = true;
                setIsDescribing(true);
              }}
            >
              <Type size={16} /> {section.description ? 'Edit description' : 'Add description'}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(-1)}>
              <ArrowUp size={16} /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => onMove(1)}>
              <ArrowDown size={16} /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={styles.dangerItem} onSelect={onDeleteSection}>
              <Trash2 size={16} /> Delete chapter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {section.lessons.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
          <SortableContext items={section.lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles.lessons} aria-label={`Lessons in chapter ${number}`}>
              {section.lessons.map((lesson, index) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  number={`${number}.${index + 1}`}
                  isFirst={index === 0}
                  isLast={index === section.lessons.length - 1}
                  isDeleting={
                    mutations.deleteLessonMutation.isPending &&
                    mutations.deleteLessonMutation.variables?.lessonId === lesson.id
                  }
                  onOpen={() => onOpenLesson({ sectionId: section.id, lessonId: lesson.id })}
                  onMove={(offset) => onMoveLesson(index, index + offset)}
                  onDelete={() => onDeleteLesson(lesson)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className={styles.chapterEmpty}>No lessons yet. Upload videos or add a lesson to start this chapter.</p>
      )}

      <div className={styles.chapterActions}>
        <CourseBulkVideoUpload courseId={courseId} sectionId={section.id} sectionTitle={section.title} />
        <AddLessonMenu onPick={(contentType) => onOpenLesson({ sectionId: section.id, contentType })} />
        <CourseLibraryLessonAdd sectionId={section.id} sectionTitle={section.title} />
      </div>

      <Dialog open={isDescribing} onOpenChange={setIsDescribing}>
        <ConsoleDialogContent size="sm">
          <ConsoleDialogHeader title="Edit chapter" description="Students see the description under the chapter name." />
          <ConsoleDialogBody>
            <CourseSectionForm
              courseId={courseId}
              sectionToEdit={section}
              onSuccess={() => setIsDescribing(false)}
              isSubmitting={mutations.updateSectionMutation.isPending}
              onSubmit={(values) =>
                mutations.updateSectionMutation.mutate(values, {
                  onSuccess: () => {
                    toast.success('Chapter saved.');
                    setIsDescribing(false);
                  },
                  onError: (error) =>
                    toast.error(error instanceof Error && error.message ? error.message : 'Could not save the chapter.'),
                })
              }
            />
          </ConsoleDialogBody>
        </ConsoleDialogContent>
      </Dialog>
    </li>
  );
};

const ChapterRename: React.FC<{ section: Section; mutations: Mutations; onDone: () => void }> = ({
  section,
  mutations,
  onDone,
}) => {
  const [title, setTitle] = useState(section.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const next = title.trim();
    if (!next || next === section.title) {
      onDone();
      return;
    }
    mutations.updateSectionMutation.mutate(
      { sectionId: section.id, title: next, description: section.description },
      {
        onSuccess: () => toast.success('Chapter renamed.'),
        onError: (error) =>
          toast.error(error instanceof Error && error.message ? error.message : 'Could not rename the chapter.'),
      }
    );
    onDone();
  };

  return (
    <form
      className={styles.renameForm}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <Input
        ref={inputRef}
        value={title}
        aria-label="Chapter name"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            committedRef.current = true;
            onDone();
          }
        }}
        className={styles.renameInput}
      />
    </form>
  );
};

const LessonRow: React.FC<{
  lesson: Lesson;
  number: string;
  isFirst: boolean;
  isLast: boolean;
  isDeleting: boolean;
  onOpen: () => void;
  onMove: (offset: -1 | 1) => void;
  onDelete: () => void;
}> = ({ lesson, number, isFirst, isLast, isDeleting, onOpen, onMove, onDelete }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const Icon = lessonIcon(lesson.contentType);
  const hasContent = lessonHasContent(lesson);
  const typeLabel = lessonTypeLabel(lesson.contentType);
  const detail =
    lesson.contentType === 'video' && lesson.durationMinutes ? `${typeLabel}, ${lesson.durationMinutes} min` : typeLabel;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.lesson} ${isDragging ? styles.dragging : ''} ${isDeleting ? styles.deleting : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={styles.handle}
        aria-label={`Drag to reorder lesson ${number}, ${lesson.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <button type="button" className={styles.lessonMain} onClick={onOpen}>
        <span className={styles.lessonNumber}>{number}</span>
        {Icon ? <Icon size={16} aria-hidden="true" className={styles.lessonIcon} /> : null}
        <span className={styles.lessonTitle}>{lesson.title}</span>
        <span className={styles.lessonMeta}>
          {lesson.isPreview ? <span className={styles.freeTag}>Free preview</span> : null}
          {hasContent ? (
            <span className={styles.lessonDetail}>{detail}</span>
          ) : (
            <span className={styles.missing}>
              <AlertCircle size={14} aria-hidden="true" />
              {EMPTY_LESSON_LABELS[lesson.contentType] ?? 'Empty'}
            </span>
          )}
        </span>
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Lesson ${number} options`} className={styles.menuButton}>
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.menu}>
          <DropdownMenuItem onSelect={onOpen}>
            <Pencil size={16} /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(-1)}>
            <ArrowUp size={16} /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onSelect={() => onMove(1)}>
            <ArrowDown size={16} /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={styles.dangerItem} onSelect={onDelete} disabled={isDeleting}>
            <Trash2 size={16} /> Delete lesson
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
};

const AddLessonMenu: React.FC<{ onPick: (contentType: LessonContentType) => void }> = ({ onPick }) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <Plus size={14} /> Add lesson <ChevronDown size={14} aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className={styles.menu}>
      {LESSON_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
        <DropdownMenuItem key={value} onSelect={() => onPick(value)}>
          <Icon size={16} /> {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const NewChapterForm: React.FC<{ courseId: number; mutations: Mutations; isFirst: boolean }> = ({
  courseId,
  mutations,
  isFirst,
}) => {
  const inputId = useId();
  const hintId = useId();
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isPending = mutations.createSectionMutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || isPending) return;
    mutations.createSectionMutation.mutate(
      { courseId, title: next, description: null },
      {
        onSuccess: () => {
          setTitle('');
          window.requestAnimationFrame(() => inputRef.current?.focus());
        },
        onError: (error) =>
          toast.error(error instanceof Error && error.message ? error.message : 'Could not add the chapter. Try again.'),
      }
    );
  };

  return (
    <form className={`${styles.newChapter} ${isFirst ? styles.newChapterFirst : ''}`} onSubmit={handleSubmit}>
      <label htmlFor={inputId} className={styles.newChapterLabel}>
        {isFirst ? 'Name your first chapter' : 'Add a chapter'}
      </label>
      {isFirst ? (
        <p id={hintId} className={styles.newChapterHint}>
          Chapters group your lessons, like "Motion" or "Algebra basics". You can rename and reorder them any time.
        </p>
      ) : null}
      <div className={styles.newChapterRow}>
        <Input
          ref={inputRef}
          id={inputId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={isFirst ? 'e.g., Introduction' : 'Chapter name, then press Enter'}
          aria-describedby={isFirst ? hintId : undefined}
        />
        <Button type="submit" variant={isFirst ? 'primary' : 'outline'} disabled={!title.trim() || isPending}>
          <Plus size={16} /> {isPending ? 'Adding...' : 'Add chapter'}
        </Button>
      </div>
    </form>
  );
};

const CourseSectionBuilderSkeleton = () => (
  <div className={styles.builder}>
    <div className={styles.chapters}>
      {[0, 1].map((i) => (
        <div className={styles.chapter} key={i}>
          <div className={styles.chapterHead}>
            <Skeleton style={{ height: '1.25rem', width: '55%' }} />
          </div>
          <div className={styles.lessons}>
            <Skeleton style={{ height: '2.25rem' }} />
            <Skeleton style={{ height: '2.25rem' }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);
