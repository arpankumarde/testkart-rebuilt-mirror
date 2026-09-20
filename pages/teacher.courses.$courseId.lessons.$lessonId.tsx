import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, Eye, FolderOpen } from 'lucide-react';
import { useTeacherCourseDetailsQuery, useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import { schema as createSchema } from '../endpoints/teacher/course-lessons/create_POST.schema';
import { LessonContentTypeArrayValues } from '../helpers/schema';
import { useUploadLimits } from '../helpers/useUploadLimits';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/Select';
import { Checkbox } from '../components/Checkbox';
import { VideoUploader } from '../components/VideoUploader';
import { R2FileUploader } from '../components/R2FileUploader';
import { RichTextEditor } from '../components/RichTextEditor';
import { QuizBuilder, QuizData } from '../components/QuizBuilder';
import { ConsoleConfirmDialog } from '../components/ConsoleConfirmDialog';
import { TeacherAssetPicker } from '../components/TeacherAssetPicker';
import { Spinner } from '../components/Spinner';
import type { TeacherAsset } from '../helpers/teacherAssetFiles';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/Breadcrumb';
import styles from './teacher.courses.$courseId.lessons.$lessonId.module.css';

const LazyPdfViewer = React.lazy(() => import('../components/ContentReviewPdfViewer'));

const formSchema = createSchema.omit({ sectionId: true }).merge(z.object({
  durationMinutes: z.coerce.number().int().min(0).optional().nullable(),
}));

type LessonFormValues = z.infer<typeof formSchema>;
type LessonContentType = LessonFormValues['contentType'];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  text: 'Text',
  quiz: 'Quiz',
};

const contentTypeLabel = (type: string) =>
  CONTENT_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);

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

const curriculumPath = (courseId: number) => `/teacher/courses/${courseId}/edit?step=curriculum`;

const LessonEditorForm: React.FC<{
  courseId: number;
  sectionId: number;
  lesson?: any;
  onDone: () => void;
}> = ({ courseId, sectionId, lesson, onDone }) => {
  const isEditMode = !!lesson;
  const limits = useUploadLimits();
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingContentType, setPendingContentType] = useState<LessonContentType | null>(null);
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [libraryKind, setLibraryKind] = useState<'video' | 'pdf' | null>(null);
  const mutations = useTeacherCourseMutations();

  const [initialValues] = useState<LessonFormValues>(() =>
    isEditMode
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
          contentType: 'video',
          contentUrl: null,
          contentFileId: null,
          textContent: null,
          durationMinutes: null,
          isPreview: false,
        }
  );

  const form = useForm({
    schema: formSchema,
    defaultValues: initialValues,
  });

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

    if (isEditMode) {
      mutations.updateLessonMutation.mutate(
        { ...values, lessonId: lesson.id },
        {
          onSuccess: () => {
            toast.success('Lesson updated.');
            onDone();
          },
          onError: (error) => handleError(error, 'An error occurred while updating the lesson.'),
        }
      );
    } else {
      mutations.createLessonMutation.mutate(
        { ...values, sectionId },
        {
          onSuccess: () => {
            toast.success('Lesson created.');
            onDone();
          },
          onError: (error) => handleError(error, 'An error occurred while creating the lesson.'),
        }
      );
    }
  };

  const handleCancel = () => {
    if (isDirty || isUploading) {
      setLeaveConfirmOpen(true);
      return;
    }
    onDone();
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

  const handleContentTypeChange = (value: string) => {
    const next = value as LessonContentType;
    if (next === selectedContentType) return;
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

  let submitLabel = isEditMode ? 'Save Changes' : 'Create Lesson';
  if (isSubmitting) submitLabel = 'Saving...';
  if (isUploading) submitLabel = 'Uploading...';

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className={styles.formLayout}>
        <FormItem name="title">
          <FormLabel>Lesson Title</FormLabel>
          <FormControl>
            <Input
              placeholder="e.g., Introduction to Limits"
              value={form.values.title}
              onChange={(e) => form.setValues((prev) => ({ ...prev, title: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="description">
          <FormLabel>Lesson Description (Optional)</FormLabel>
          <FormControl>
            <Textarea
              placeholder="A short summary of this lesson."
              rows={2}
              value={form.values.description || ''}
              onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="contentType">
          <FormLabel>Content Type</FormLabel>
          <FormControl>
            <Select
              value={selectedContentType}
              onValueChange={handleContentTypeChange}
              disabled={isUploading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                {LessonContentTypeArrayValues.map((type: string) => (
                  <SelectItem key={type} value={type}>
                    {contentTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          {isUploading && <FormDescription>The content type is locked while a file uploads.</FormDescription>}
          <FormMessage />
        </FormItem>

        {selectedContentType === 'video' && (
          <>
            <FormItem name="contentUrl">
              <FormLabel>Video Content</FormLabel>
              <FormControl>
                <VideoUploader
                  folder={`course/${courseId}`}
                  currentVideoUrl={form.values.contentUrl || undefined}
                  onSuccess={(result) => form.setValues((prev) => ({ ...prev, contentUrl: result.url || null, contentFileId: result.videoFileId || null }))}
                  onRemove={clearFile}
                  onUploadingChange={setIsUploading}
                  label="Upload Video"
                  allowYouTube={true}
                  maxSizeInMB={limits.lessonVideoMaxMb}
                />
              </FormControl>
              {libraryButton('video')}
              <FormMessage />
            </FormItem>
            <FormItem name="durationMinutes" className={styles.durationField}>
              <FormLabel>Video Duration (minutes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
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
          <FormItem name="textContent">
            <FormLabel>Text Content</FormLabel>
            <FormControl>
              <RichTextEditor
                placeholder="Write your lesson content here."
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
          <FormItem name="contentUrl">
            <FormLabel>PDF Document</FormLabel>
            <FormControl>
              <R2FileUploader
                folder={`course/${courseId}`}
                currentImageUrl={form.values.contentUrl || undefined}
                onSuccess={(result) => form.setValues((prev) => ({ ...prev, contentUrl: result.url || null, contentFileId: result.fileId || null }))}
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
              <FormDescription>Upload a PDF document for this lesson (max {limits.coursePdfMaxMb}MB).</FormDescription>
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
          <FormItem name="textContent">
            <FormLabel>Quiz Content</FormLabel>
            <FormControl>
              <QuizBuilder
                value={form.values.textContent ? (() => {
                  try {
                    return JSON.parse(form.values.textContent);
                  } catch {
                    return null;
                  }
                })() : null}
                onChange={(quizData: QuizData) =>
                  form.setValues((prev) => ({ ...prev, textContent: JSON.stringify(quizData) }))
                }
              />
            </FormControl>
            <FormDescription>Create multiple choice questions for this quiz.</FormDescription>
            <FormMessage />
          </FormItem>
        )}

        <FormItem name="isPreview">
          <div className={styles.checkboxGroup}>
            <FormControl>
              <Checkbox
                id="isPreview"
                checked={form.values.isPreview}
                onChange={(e) => form.setValues((prev) => ({ ...prev, isPreview: e.target.checked }))}
              />
            </FormControl>
            <FormLabel htmlFor="isPreview" className={styles.checkboxLabel}>
              Allow Free Preview
            </FormLabel>
          </div>
          <FormDescription>If checked, students can view this lesson without enrolling in the course.</FormDescription>
          <FormMessage />
        </FormItem>

        <div className={styles.formActions}>
          {isUploading && (
            <p className={styles.uploadNote} role="status">
              Saving unlocks when the upload finishes.
            </p>
          )}
          <Button variant="outline" type="button" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isUploading}>
            {(isSubmitting || isUploading) && <Spinner size="sm" />}
            {submitLabel}
          </Button>
        </div>
      </form>

      {showPdfPreview && form.values.contentUrl && (
        <React.Suspense fallback={<div className={styles.pdfLoading}><Spinner /></div>}>
          <LazyPdfViewer pdfUrl={form.values.contentUrl} title={form.values.title || 'PDF Preview'} onClose={() => setShowPdfPreview(false)} />
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
        title={`Switch this lesson to ${pendingContentType ? contentTypeLabel(pendingContentType) : ''}?`}
        description={`The current ${contentTypeLabel(selectedContentType).toLowerCase()} content is cleared from this lesson. Nothing changes for students until you save.`}
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
};

export default function TeacherCourseLessonPage() {
  const { courseId: courseIdParam, lessonId: lessonIdParam } = useParams<{courseId: string; lessonId: string}>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = parseInt(courseIdParam || "", 10);
  const isEditMode = lessonIdParam !== "new";
  const lessonId = isEditMode ? parseInt(lessonIdParam || "", 10) : undefined;

  const sectionIdQuery = searchParams.get("sectionId");
  const sectionId = sectionIdQuery ? parseInt(sectionIdQuery, 10) : undefined;

  const { data: courseDetails, isPending, error } = useTeacherCourseDetailsQuery(
    !isNaN(courseId) ? courseId : null
  );

  if (isNaN(courseId) || (isEditMode && isNaN(lessonId as number)) || (!isEditMode && !sectionId)) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Invalid URL Parameters</h2>
        <p className={styles.errorMessage}>The URL provided is not valid for editing or creating a lesson.</p>
        <Button asChild>
          <Link to="/teacher/courses">Go to Courses</Link>
        </Button>
      </div>
    );
  }

  // Only the first load shows a skeleton. A background refetch must not unmount
  // the editor, or unsaved typing and a running upload are lost.
  if (!courseDetails && isPending && !error) {
    return (
      <div className={styles.page}>
        <Skeleton style={{ height: "1.5rem", width: "200px", marginBottom: "var(--spacing-2)" }} />
        <Skeleton style={{ height: "2.5rem", width: "300px", marginBottom: "var(--spacing-4)" }} />
        <Skeleton style={{ height: "500px", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (!courseDetails) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Course Not Found</h2>
        <p className={styles.errorMessage}>
          {error?.message || `We couldn't find a course with the ID ${courseId}.`}
        </p>
        <Button asChild>
          <Link to="/teacher/courses">Go to Courses</Link>
        </Button>
      </div>
    );
  }

  let lessonToEdit;
  let targetSectionId = sectionId;

  if (isEditMode) {
    for (const section of courseDetails.sections || []) {
      const found = section.lessons.find((l: any) => l.id === lessonId);
      if (found) {
        lessonToEdit = found;
        targetSectionId = section.id;
        break;
      }
    }
  }

  const sectionMissing = !isEditMode && !(courseDetails.sections || []).some((s) => s.id === sectionId);

  if ((isEditMode && !lessonToEdit) || sectionMissing) {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={48} className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>{sectionMissing ? 'Section Not Found' : 'Lesson Not Found'}</h2>
        <p className={styles.errorMessage}>
          {sectionMissing
            ? `We couldn't find that section in this course.`
            : `We couldn't find a lesson with the ID ${lessonId} in this course.`}
        </p>
        <Button asChild>
          <Link to={curriculumPath(courseId)}>Back to Course</Link>
        </Button>
      </div>
    );
  }

  const returnToCurriculum = () => {
    navigate(curriculumPath(courseId));
  };

  const pageTitle = isEditMode ? "Edit Lesson" : "Add New Lesson";

  return (
    <>
      <Helmet>
        <title>{`${pageTitle} - ${courseDetails.title} | Testkart`}</title>
        <meta name="description" content={`Manage lesson content for the course ${courseDetails.title}`} />
      </Helmet>

      <div className={styles.page}>
        <Breadcrumb className={styles.breadcrumb}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/teacher/courses">Courses</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={curriculumPath(courseId)}>{courseDetails.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className={styles.header}>
          <h1 className={styles.title}>{pageTitle}</h1>
        </div>

        <div className={styles.formCard}>
          <LessonEditorForm
            key={isEditMode ? `lesson-${lessonId}` : `new-${targetSectionId}`}
            courseId={courseId}
            sectionId={targetSectionId!}
            lesson={lessonToEdit}
            onDone={returnToCurriculum}
          />
        </div>
      </div>
    </>
  );
}
