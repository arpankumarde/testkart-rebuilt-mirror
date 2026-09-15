import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { ExamNamePicker } from './ExamNamePicker';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { CourseThumbnailVideo } from './CourseThumbnailVideo';
import { ThumbnailUploader } from './ThumbnailUploader';
import { schema as createSchema } from '../endpoints/teacher/courses/create_POST.schema';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import type { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import { CourseLevelArrayValues } from '../helpers/schema';
import { AIRewriteButton } from './AIRewriteButton';
import styles from './CourseCreationForm.module.css';

interface CourseCreationFormProps {
  course?: TeacherCourseListItem;
  onSuccess: (courseId: number) => void;
  /** Reports whether the form holds edits that are not saved yet. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Reports whether the thumbnail or intro video is still uploading. */
  onUploadingChange?: (uploading: boolean) => void;
}

const formSchema = createSchema.merge(z.object({
  price: z.coerce.number().min(0, "Price cannot be negative."),
  introVideoFileId: z.string().nullable().optional(),
  thumbnailImageFileId: z.string().nullable().optional(),
})).superRefine((data, ctx) => {
  if (!data.introVideoUrl && !data.thumbnailImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please upload a course thumbnail image or intro video.",
      path: ["thumbnailImageUrl"],
    });
  }
});

type CourseFormValues = z.infer<typeof formSchema>;

const AI_COURSE_DATA_KEY = 'testkart_ai_course_data';

const LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
  "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
  "Assamese", "Urdu", "Sanskrit", "Konkani", "Dogri",
  "Bodo", "Maithili", "Santali", "Kashmiri", "Nepali",
  "Sindhi", "Manipuri", "Multiple Languages",
];

const EMPTY_VALUES: CourseFormValues = {
  title: '',
  description: '',
  category: '',
  level: 'beginner',
  price: 0,
  introVideoUrl: null,
  thumbnailImageUrl: null,
  introVideoFileId: null,
  thumbnailImageFileId: null,
  language: null,
  examName: '',
};

const FIELD_KEYS = Object.keys(EMPTY_VALUES) as (keyof CourseFormValues)[];

const toFormValues = (course: TeacherCourseListItem): CourseFormValues => ({
  title: course.title,
  description: course.description ?? '',
  category: course.category || '',
  level: course.level,
  price: course.price,
  introVideoUrl: course.introVideoUrl,
  thumbnailImageUrl: course.thumbnailImageUrl,
  introVideoFileId: course.introVideoFileId || null,
  thumbnailImageFileId: course.thumbnailImageFileId || null,
  language: course.language || null,
  examName: course.examName || '',
});

const readAiOverrides = (): Partial<Pick<CourseFormValues, 'description' | 'language'>> => {
  try {
    const raw = sessionStorage.getItem(AI_COURSE_DATA_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return {
      ...(typeof data?.description === 'string' && data.description ? { description: data.description } : {}),
      ...(typeof data?.language === 'string' && data.language ? { language: data.language } : {}),
    };
  } catch (e) {
    console.error("Failed to parse AI course data from sessionStorage", e);
    return {};
  }
};

const normalize = (value: unknown) => (value === undefined || value === '' ? null : value);

const hasUnsavedChanges = (values: CourseFormValues, saved: CourseFormValues) =>
  FIELD_KEYS.some((key) => normalize(values[key]) !== normalize(saved[key]));

function useReportToParent(callback: ((value: boolean) => void) | undefined, value: boolean) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    callbackRef.current?.(value);
  }, [value]);
  useEffect(() => () => callbackRef.current?.(false), []);
}

export const CourseCreationForm: React.FC<CourseCreationFormProps> = ({
  course,
  onSuccess,
  onDirtyChange,
  onUploadingChange,
}) => {
  const isEditMode = !!course;
  const { createCourseMutation, updateCourseMutation } = useTeacherCourseMutations();

  // Seeded once per mount. The edit page keys this form by course id, so a
  // background refetch of the same course never overwrites unsaved typing.
  // Unsaved AI suggestions start the form dirty, since the server does not have them.
  const [seed] = useState(() => {
    const saved = course ? toFormValues(course) : EMPTY_VALUES;
    return { saved, initial: course ? { ...saved, ...readAiOverrides() } : saved };
  });
  const [savedValues, setSavedValues] = useState<CourseFormValues>(seed.saved);

  const form = useForm({
    schema: formSchema,
    defaultValues: seed.initial,
  });

  useEffect(() => {
    if (!isEditMode) return;
    try {
      sessionStorage.removeItem(AI_COURSE_DATA_KEY);
    } catch {
      // Storage can be unavailable; the overrides were already read.
    }
  }, [isEditMode]);

  const [uploads, setUploads] = useState({ thumbnail: false, video: false });
  const isUploading = uploads.thumbnail || uploads.video;
  const isSubmitting = createCourseMutation.isPending || updateCourseMutation.isPending;
  const isDirty = useMemo(() => hasUnsavedChanges(form.values, savedValues), [form.values, savedValues]);

  useReportToParent(onDirtyChange, isDirty);
  useReportToParent(onUploadingChange, isUploading);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || isUploading) return;
    if (!form.validateForm()) {
      toast.error('Some course details need attention. Check the highlighted fields.');
      return;
    }
    const values = form.values;
    const handleError = (error: unknown) => {
      toast.error(
        error instanceof Error && error.message ? error.message : 'Could not save the course. Try again.',
      );
    };

    if (isEditMode && course) {
      updateCourseMutation.mutate(
        { ...values, courseId: course.id },
        {
          onSuccess: (data) => {
            setSavedValues(values);
            toast.success('Course details saved.');
            onSuccess(data.id);
          },
          onError: handleError,
        },
      );
    } else {
      createCourseMutation.mutate(values, {
        onSuccess: (data) => {
          setSavedValues(values);
          onSuccess(data.id);
        },
        onError: handleError,
      });
    }
  };

  let submitLabel = isEditMode ? 'Save Changes' : 'Save and Continue';
  if (isSubmitting) submitLabel = 'Saving...';
  if (isUploading) submitLabel = 'Uploading...';

  return (
    <div className={styles.formContainer}>
      <Form {...form}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <FormItem name="title">
            <div className={styles.labelRow}>
              <FormLabel>Course Title</FormLabel>
              <AIRewriteButton
                field="title"
                contentType="course"
                currentValue={form.values.title}
                context={{ category: form.values.category, level: form.values.level, language: form.values.language || undefined }}
                onAccept={(suggestion) => form.setValues((prev) => ({ ...prev, title: suggestion }))}
              />
            </div>
            <FormControl>
              <Input
                placeholder="e.g., Mastering Advanced Calculus"
                value={form.values.title}
                onChange={(e) => form.setValues((prev) => ({ ...prev, title: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="description">
            <div className={styles.labelRow}>
              <FormLabel>Course Description</FormLabel>
              <AIRewriteButton
                field="description"
                contentType="course"
                currentValue={form.values.description}
                context={{ category: form.values.category, level: form.values.level, language: form.values.language || undefined, title: form.values.title }}
                onAccept={(suggestion) => form.setValues((prev) => ({ ...prev, description: suggestion }))}
              />
            </div>
            <FormControl>
              <RichTextEditor
                placeholder="A brief summary of what students will learn in this course."
                value={form.values.description}
                onChange={(html) => form.setValues((prev) => ({ ...prev, description: html }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.grid}>
            <FormItem name="category">
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Mathematics, Programming"
                  value={form.values.category}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, category: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="level">
              <FormLabel>Difficulty Level</FormLabel>
              <FormControl>
                <Select
                  value={form.values.level}
                  onValueChange={(value) => form.setValues((prev) => ({ ...prev, level: value as typeof prev.level }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                  <SelectContent>
                    {CourseLevelArrayValues.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="language">
              <FormLabel>Language (Optional)</FormLabel>
              <FormControl>
                <Select
                  value={form.values.language || '__empty'}
                  onValueChange={(val) => form.setValues((prev) => ({ ...prev, language: val === '__empty' ? null : val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty">Select language</SelectItem>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="examName">
              <FormLabel>Exam (Optional)</FormLabel>
              <FormControl>
                <ExamNamePicker
                  value={form.values.examName || ''}
                  onChange={(examName) => form.setValues((prev) => ({ ...prev, examName }))}
                />
              </FormControl>
              <FormDescription>Tag this course to an exam so it shows up on that exam's page.</FormDescription>
              <FormMessage />
            </FormItem>
          </div>

          <FormItem name="price">
            <FormLabel>Price (INR)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="Enter 0 for a free course"
                value={form.values.price}
                onChange={(e) => form.setValues((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormDescription>Enter 0 to make the course free for all students.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="thumbnailImageUrl">
            <FormLabel>Course Thumbnail Image</FormLabel>
            <FormControl>
              <ThumbnailUploader
                folder={course ? `course/${course.id}` : "course-thumbnails"}
                value={form.values.thumbnailImageUrl}
                currentFileId={form.values.thumbnailImageFileId ?? undefined}
                onChange={(url, fileId) => {
                  form.setValues((prev) => ({
                    ...prev,
                    thumbnailImageUrl: url || null,
                    thumbnailImageFileId: fileId || null,
                  }));
                }}
                onRemove={() => {
                  form.setValues((prev) => ({ ...prev, thumbnailImageUrl: null, thumbnailImageFileId: null }));
                }}
                onUploadingChange={(uploading) => setUploads((prev) => ({ ...prev, thumbnail: uploading }))}
              />
            </FormControl>
            <FormDescription>Upload a thumbnail image for your course. This will be displayed on course cards and the detail page.</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="introVideoUrl">
            <FormLabel>Course Introduction Video</FormLabel>
            <FormControl>
              <CourseThumbnailVideo
                value={form.values.introVideoUrl ?? null}
                fileId={form.values.introVideoFileId ?? null}
                courseId={course?.id}
                onChange={(url, fileId) => {
                  form.setValues((prev) => ({
                    ...prev,
                    introVideoUrl: url,
                    introVideoFileId: fileId,
                  }));
                }}
                onUploadingChange={(uploading) => setUploads((prev) => ({ ...prev, video: uploading }))}
              />
            </FormControl>
            <FormDescription>Upload a promotional video to showcase your course. This will be displayed on the course card.</FormDescription>
            <FormMessage />
          </FormItem>

          <div className={styles.formActions}>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {(isSubmitting || isUploading) && <Spinner size="sm" />}
              {submitLabel}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
