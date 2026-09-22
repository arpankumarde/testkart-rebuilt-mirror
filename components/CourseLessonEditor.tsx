import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, FileText, FileType, FolderOpen, HelpCircle, Video } from 'lucide-react';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { schema as createSchema } from '../endpoints/teacher/course-lessons/create_POST.schema';
import { useUploadLimits } from '../helpers/useUploadLimits';
import type { TeacherAsset } from '../helpers/teacherAssetFiles';
import { Button } from './Button';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Checkbox } from './Checkbox';
import { SegmentedControl } from './SegmentedControl';
import { VideoUploader } from './VideoUploader';
import { R2FileUploader } from './R2FileUploader';
import { RichTextEditor } from './RichTextEditor';
import { QuizBuilder, QuizData } from './QuizBuilder';
import { ConsoleConfirmDialog } from './ConsoleConfirmDialog';
import { TeacherAssetPicker } from './TeacherAssetPicker';
import { Spinner } from './Spinner';
import styles from './CourseLessonEditor.module.css';

const LazyPdfViewer = React.lazy(() => import('./ContentReviewPdfViewer'));

const formSchema = createSchema.omit({ sectionId: true }).merge(
  z.object({
    durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  })
);

type LessonFormValues = z.infer<typeof formSchema>;
export type LessonContentType = LessonFormValues['contentType'];

export const LESSON_TYPE_OPTIONS: readonly { value: LessonContentType; label: string; icon: React.ElementType }[] = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'pdf', label: 'PDF', icon: FileType },
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'quiz', label: 'Quiz', icon: HelpCircle },
];

export const lessonTypeLabel = (type: string) =>
  LESSON_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type.charAt(0).toUpperCase() + type.slice(1);

// Tiptap reports an empty document as an empty paragraph.
const EMPTY_RICH_TEXT = '<p></p>';

const FIELD_KEYS: (keyof LessonFormValues)[] = [
  'title',
  'description',
  'contentType',
  'contentUrl',
  'contentFileId',
  'textContent',
  'durationMinutes',
  'isPreview',
];

const normalize = (value: unknown) => (value === undefined || value === '' ? null : value);

type EditableLesson = {
  id: number;
  title: string;
  description: string | null;
  contentType: LessonContentType;
  contentUrl: string | null;
  contentFileId: string | null;
  textContent: string | null;
  durationMinutes: number | null;
  isPreview: boolean;
};

export interface CourseLessonEditorHandle {
  /** Closes the editor, asking first when there are unsaved edits or a running upload. */
  requestClose: () => void;
}

interface CourseLessonEditorProps {
  courseId: number;
  sectionId: number;
  lesson?: EditableLesson;
  initialContentType?: LessonContentType;
  /** Called after a save, and when the teacher leaves without saving. */
  onDone: () => void;
  className?: string;
}

/*
 * The lesson form, shared by the course editor's side panel and the standalone
 * lesson page. It owns its own leave guard: requestClose asks before throwing
 * away unsaved edits or a running upload.
 */
export const CourseLessonEditor = forwardRef<CourseLessonEditorHandle, CourseLessonEditorProps>(
  ({ courseId, sectionId, lesson, initialContentType = 'video', onDone, className }, ref) => {
    const isEditMode = !!lesson;
    const limits = useUploadLimits();
    const mutations = useTeacherCourseMutations();
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingContentType, setPendingContentType] = useState<LessonContentType | null>(null);
    const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const [libraryKind, setLibraryKind] = useState<'video' | 'pdf' | null>(null);

    const [initialValues] = useState<LessonFormValues>(() =>
      lesson
        ? {
            title: lesson.title,
            description: lesson.description,
            contentType: lesson.contentType,
            contentUrl: lesson.contentUrl,
            contentFileId: lesson.contentFileId || null,
            textContent: lesson.textContent,
            durationMinutes: lesson.durationMinutes,
            isPreview: lesson.isPreview,
          }
        : {
            title: '',
            description: null,
            contentType: initialContentType,
            contentUrl: null,
            contentFileId: null,
            textContent: null,
            durationMinutes: null,
            isPreview: false,
          }
    );

    const form = useForm({ schema: formSchema, defaultValues: initialValues });

    const selectedContentType = form.values.contentType;
    const isSubmitting = isEditMode ? mutations.updateLessonMutation.isPending : mutations.createLessonMutation.isPending;
    const isDirty = useMemo(
      () => FIELD_KEYS.some((key) => normalize(form.values[key]) !== normalize(initialValues[key])),
      [form.values, initialValues]
    );

    useEffect(() => {
      if (!isDirty && !isUploading) return;
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, isUploading]);

    const requestClose = () => {
      if (isDirty || isUploading) {
        setLeaveConfirmOpen(true);
        return;
      }
      onDone();
    };

    useImperativeHandle(ref, () => ({ requestClose }));

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      // An upload still running would finish after the save and link to nothing.
      if (isSubmitting || isUploading) return;
      if (!form.validateForm()) {
        toast.error('Some lesson details need attention. Check the highlighted fields.');
        return;
      }
      const values = form.values;
      const handleError = (error: unknown, fallback: string) => {
        toast.error(error instanceof Error && error.message ? error.message : fallback);
      };

      if (lesson) {
        mutations.updateLessonMutation.mutate(
          { ...values, lessonId: lesson.id },
          {
            onSuccess: () => {
              toast.success('Lesson saved.');
              onDone();
            },
            onError: (error) => handleError(error, 'Could not save the lesson. Try again.'),
          }
        );
      } else {
        mutations.createLessonMutation.mutate(
          { ...values, sectionId },
          {
            onSuccess: () => {
              toast.success('Lesson added.');
              onDone();
            },
            onError: (error) => handleError(error, 'Could not add the lesson. Try again.'),
          }
        );
      }
    };

    const applyContentType = (contentType: LessonContentType) => {
      form.setValues((prev) => ({
        ...prev,
        contentType,
        contentUrl: null,
        contentFileId: null,
        textContent: null,
        durationMinutes: null,
      }));
    };

    const handleContentTypeChange = (next: LessonContentType) => {
      if (next === selectedContentType || isUploading) return;
      if (form.values.contentUrl || form.values.textContent) {
        setPendingContentType(next);
        return;
      }
      applyContentType(next);
    };

    const clearFile = () => form.setValues((prev) => ({ ...prev, contentUrl: null, contentFileId: null }));

    // A library file is already on storage, so picking it fills the lesson like a finished upload.
    const applyLibraryAsset = (asset: TeacherAsset) => {
      form.setValues((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : asset.name,
        contentUrl: asset.url,
        contentFileId: asset.key,
        durationMinutes:
          asset.kind === 'video' && asset.durationSeconds
            ? Math.max(1, Math.round(asset.durationSeconds / 60))
            : prev.durationMinutes,
      }));
      setLibraryKind(null);
    };

    const libraryButton = (kind: 'video' | 'pdf') => (
      <div className={styles.libraryPick}>
        <Button type="button" variant="outline" size="sm" onClick={() => setLibraryKind(kind)} disabled={isUploading}>
          <FolderOpen size={16} /> Choose from library
        </Button>
        <span className={styles.libraryHint}>Use a {kind === 'video' ? 'video' : 'PDF'} you already uploaded.</span>
      </div>
    );

    let submitLabel = isEditMode ? 'Save lesson' : 'Add lesson';
    if (isSubmitting) submitLabel = 'Saving...';
    if (isUploading) submitLabel = 'Uploading...';

    return (
      <Form {...form}>
        <form onSubmit={handleSubmit} className={`${styles.form} ${className ?? ''}`} noValidate>
          <div className={styles.fields}>
            <FormItem name="title" className={styles.field}>
              <FormLabel>Lesson title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Introduction to limits"
                  value={form.values.title}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, title: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.field}>
              <span className={styles.fieldLabel} aria-hidden="true">
                Lesson type
              </span>
              <SegmentedControl
                aria-label="Lesson type"
                value={selectedContentType}
                onValueChange={handleContentTypeChange}
                options={LESSON_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => ({
                  value,
                  label: (
                    <>
                      <Icon aria-hidden="true" />
                      {label}
                    </>
                  ),
                }))}
                className={styles.typeControl}
              />
              {isUploading ? <p className={styles.hint}>The lesson type is locked while a file uploads.</p> : null}
            </div>

            {selectedContentType === 'video' && (
              <>
                <FormItem name="contentUrl" className={styles.field}>
                  <FormLabel>Video</FormLabel>
                  <FormControl>
                    <VideoUploader
                      folder={`course/${courseId}`}
                      currentVideoUrl={form.values.contentUrl || undefined}
                      onSuccess={(result) =>
                        form.setValues((prev) => ({
                          ...prev,
                          contentUrl: result.url || null,
                          contentFileId: result.videoFileId || null,
                        }))
                      }
                      onRemove={clearFile}
                      onUploadingChange={setIsUploading}
                      label="Upload video"
                      allowYouTube={true}
                      maxSizeInMB={limits.lessonVideoMaxMb}
                    />
                  </FormControl>
                  {libraryButton('video')}
                  <FormMessage />
                </FormItem>
                <FormItem name="durationMinutes" className={`${styles.field} ${styles.durationField}`}>
                  <FormLabel>Length in minutes</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="e.g., 15"
                      value={form.values.durationMinutes ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        form.setValues((prev) => ({ ...prev, durationMinutes: val === '' ? null : parseInt(val, 10) || 0 }));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </>
            )}

            {selectedContentType === 'text' && (
              <FormItem name="textContent" className={styles.field}>
                <FormLabel>Lesson text</FormLabel>
                <FormControl>
                  <RichTextEditor
                    placeholder="Write your lesson here."
                    value={form.values.textContent || ''}
                    onChange={(html) =>
                      form.setValues((prev) => ({ ...prev, textContent: html === EMPTY_RICH_TEXT ? null : html }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}

            {selectedContentType === 'pdf' && (
              <FormItem name="contentUrl" className={styles.field}>
                <FormLabel>PDF</FormLabel>
                <FormControl>
                  <R2FileUploader
                    folder={`course/${courseId}`}
                    currentImageUrl={form.values.contentUrl || undefined}
                    onSuccess={(result) =>
                      form.setValues((prev) => ({ ...prev, contentUrl: result.url || null, contentFileId: result.fileId || null }))
                    }
                    onRemove={clearFile}
                    onUploadingChange={setIsUploading}
                    label="Upload PDF"
                    acceptedTypes="application/pdf"
                    maxSizeInMB={limits.coursePdfMaxMb}
                    aspectRatio="auto"
                    className={styles.pdfUploader}
                  />
                </FormControl>
                {libraryButton('pdf')}
                <div className={styles.pdfMeta}>
                  <FormDescription>Up to {limits.coursePdfMaxMb} MB.</FormDescription>
                  {form.values.contentUrl && !isUploading && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowPdfPreview(true)}>
                      <Eye size={16} /> Preview PDF
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}

            {selectedContentType === 'quiz' && (
              <FormItem name="textContent" className={styles.field}>
                <FormLabel>Quiz questions</FormLabel>
                <FormControl>
                  <QuizBuilder
                    value={
                      form.values.textContent
                        ? (() => {
                            try {
                              return JSON.parse(form.values.textContent);
                            } catch {
                              return null;
                            }
                          })()
                        : null
                    }
                    onChange={(quizData: QuizData) =>
                      form.setValues((prev) => ({ ...prev, textContent: JSON.stringify(quizData) }))
                    }
                  />
                </FormControl>
                <FormDescription>Multiple choice questions students answer in the lesson.</FormDescription>
                <FormMessage />
              </FormItem>
            )}

            <FormItem name="description" className={styles.field}>
              <FormLabel>Short note (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="A line about what this lesson covers."
                  rows={2}
                  value={form.values.description || ''}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="isPreview" className={styles.field}>
              <div className={styles.checkboxGroup}>
                <FormControl>
                  <Checkbox
                    checked={form.values.isPreview}
                    onChange={(e) => form.setValues((prev) => ({ ...prev, isPreview: e.target.checked }))}
                  />
                </FormControl>
                <FormLabel className={styles.checkboxLabel}>Free preview</FormLabel>
              </div>
              <FormDescription>Anyone can open this lesson without enrolling.</FormDescription>
              <FormMessage />
            </FormItem>
          </div>

          <div className={styles.actions}>
            {isUploading && (
              <p className={styles.uploadNote} role="status">
                Saving unlocks when the upload finishes.
              </p>
            )}
            <Button variant="outline" type="button" onClick={requestClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {(isSubmitting || isUploading) && <Spinner size="sm" />}
              {submitLabel}
            </Button>
          </div>
        </form>

        {showPdfPreview && form.values.contentUrl && (
          <React.Suspense
            fallback={
              <div className={styles.pdfLoading}>
                <Spinner />
              </div>
            }
          >
            <LazyPdfViewer
              pdfUrl={form.values.contentUrl}
              title={form.values.title || 'PDF preview'}
              onClose={() => setShowPdfPreview(false)}
            />
          </React.Suspense>
        )}

        <TeacherAssetPicker
          open={libraryKind !== null}
          onOpenChange={(open) => {
            if (!open) setLibraryKind(null);
          }}
          kinds={libraryKind ? [libraryKind] : ['video']}
          title={libraryKind === 'pdf' ? 'Choose a PDF from your library' : 'Choose a video from your library'}
          description="The file is linked to this lesson when you save it."
          confirmLabel={() => 'Use this file'}
          onConfirm={(assets) => {
            if (assets[0]) applyLibraryAsset(assets[0]);
          }}
        />

        <ConsoleConfirmDialog
          open={pendingContentType !== null}
          onOpenChange={(open) => {
            if (!open) setPendingContentType(null);
          }}
          tone="destructive"
          title={`Switch this lesson to ${pendingContentType ? lessonTypeLabel(pendingContentType) : ''}?`}
          description={`The current ${lessonTypeLabel(selectedContentType).toLowerCase()} content is cleared from this lesson. Nothing changes for students until you save.`}
          confirmLabel="Switch type"
          cancelLabel="Keep current content"
          onConfirm={() => {
            if (pendingContentType) applyContentType(pendingContentType);
            setPendingContentType(null);
          }}
        />

        <ConsoleConfirmDialog
          open={isLeaveConfirmOpen}
          onOpenChange={setLeaveConfirmOpen}
          tone="destructive"
          title={isUploading ? 'Leave while the file uploads?' : 'Discard unsaved changes?'}
          description={
            isUploading
              ? 'The upload is still running and will not be attached to this lesson. The saved lesson stays as it was.'
              : 'Your changes to this lesson are not saved. The saved lesson stays as it was.'
          }
          confirmLabel="Discard and leave"
          cancelLabel="Keep editing"
          onConfirm={() => {
            setLeaveConfirmOpen(false);
            onDone();
          }}
        />
      </Form>
    );
  }
);
CourseLessonEditor.displayName = 'CourseLessonEditor';
