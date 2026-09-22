import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { RichTextEditor } from './RichTextEditor';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { SegmentedControl } from './SegmentedControl';
import { ExamNamePicker } from './ExamNamePicker';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { CourseThumbnailVideo } from './CourseThumbnailVideo';
import { ThumbnailUploader } from './ThumbnailUploader';
import { AIRewriteButton } from './AIRewriteButton';
import { schema as updateSchema } from '../endpoints/teacher/courses/update_POST.schema';
import { useTeacherCourseMutations } from '../helpers/useTeacherCoursesQuery';
import type { TeacherCourseListItem } from '../endpoints/teacher/courses/list_GET.schema';
import styles from './CourseCreationForm.module.css';

const formSchema = updateSchema.omit({ courseId: true, thumbnailUrl: true, thumbnailFileId: true }).extend({
  price: z.coerce.number().min(0, 'Price cannot be negative.'),
});

export type CourseDetailsValues = z.infer<typeof formSchema>;
export type CourseDetailsField = 'title' | 'description' | 'cover' | 'price';

export interface CourseDetailsFormHandle {
  /** Saves the form. Resolves false when a field needs attention or the save failed. */
  save: () => Promise<boolean>;
  focusField: (field: CourseDetailsField) => void;
  /** Puts text into the description without saving it. */
  setDescription: (html: string) => void;
}

interface CourseCreationFormProps {
  course: TeacherCourseListItem;
  /** Chapter names, handed to AI so a drafted description matches the curriculum. */
  chapterTitles?: string[];
  /** Shown above the first field, e.g. after AI filled the course in. */
  notice?: React.ReactNode;
  onValuesChange?: (values: CourseDetailsValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

type PriceMode = 'free' | 'paid';

const LANGUAGES = [
  "English", "Hindi", "Bengali", "Telugu", "Marathi", "Tamil",
  "Gujarati", "Kannada", "Malayalam", "Odia", "Punjabi",
  "Assamese", "Urdu", "Sanskrit", "Konkani", "Dogri",
  "Bodo", "Maithili", "Santali", "Kashmiri", "Nepali",
  "Sindhi", "Manipuri", "Multiple Languages",
];

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

const PRICE_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
] as const;

const toFormValues = (course: TeacherCourseListItem): CourseDetailsValues => ({
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

const FIELD_KEYS: (keyof CourseDetailsValues)[] = [
  'title', 'description', 'category', 'level', 'price', 'introVideoUrl', 'thumbnailImageUrl',
  'introVideoFileId', 'thumbnailImageFileId', 'language', 'examName',
];

const normalize = (value: unknown) => (value === undefined || value === '' ? null : value);

const hasUnsavedChanges = (values: CourseDetailsValues, saved: CourseDetailsValues) =>
  FIELD_KEYS.some((key) => normalize(values[key]) !== normalize(saved[key]));

function useReportToParent<T>(callback: ((value: T) => void) | undefined, value: T, resetValue?: T) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    callbackRef.current?.(value);
  }, [value]);
  useEffect(
    () => () => {
      if (resetValue !== undefined) callbackRef.current?.(resetValue);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}

/*
 * The Details tab of the course editor. It stays mounted while the teacher is
 * on the Content tab, so unsaved edits survive a tab switch, and it reports its
 * live values up so the page's card preview and checklist follow the typing.
 */
export const CourseCreationForm = forwardRef<CourseDetailsFormHandle, CourseCreationFormProps>(
  ({ course, chapterTitles = [], notice, onValuesChange, onDirtyChange, onUploadingChange }, ref) => {
    const { updateCourseMutation } = useTeacherCourseMutations();
    const rootRef = useRef<HTMLDivElement>(null);

    // Seeded once per mount. The editor keys this form by course id, so a
    // background refetch of the same course never overwrites unsaved typing.
    const [seed] = useState(() => toFormValues(course));
    const [savedValues, setSavedValues] = useState<CourseDetailsValues>(seed);
    const [priceMode, setPriceMode] = useState<PriceMode>(seed.price > 0 ? 'paid' : 'free');

    const form = useForm({ schema: formSchema, defaultValues: seed });

    const [uploads, setUploads] = useState({ thumbnail: false, video: false });
    const isUploading = uploads.thumbnail || uploads.video;
    const isSaving = updateCourseMutation.isPending;
    const isDirty = useMemo(() => hasUnsavedChanges(form.values, savedValues), [form.values, savedValues]);

    useReportToParent(onValuesChange, form.values);
    useReportToParent(onDirtyChange, isDirty, false);
    useReportToParent(onUploadingChange, isUploading, false);

    const setField = <K extends keyof CourseDetailsValues>(key: K, value: CourseDetailsValues[K]) =>
      form.setValues((prev) => ({ ...prev, [key]: value }));

    const focusField = (field: CourseDetailsField) => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!target) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      const control = target.querySelector<HTMLElement>(
        'input:not([type="file"]):not([type="hidden"]), textarea, [contenteditable="true"], button'
      );
      control?.focus({ preventScroll: true });
    };

    const save = async (): Promise<boolean> => {
      if (isSaving || isUploading) return false;
      const price = priceMode === 'free' ? 0 : Number(form.values.price);
      if (priceMode === 'paid' && !(price > 0)) {
        form.setFieldError('price', 'Enter a price, or choose Free.');
        focusField('price');
        return false;
      }
      const values: CourseDetailsValues = { ...form.values, price };
      if (!form.validateForm()) {
        toast.error('Some course details need attention. Check the highlighted fields.');
        return false;
      }
      try {
        await updateCourseMutation.mutateAsync({ ...values, courseId: course.id });
        form.setValues(values);
        setSavedValues(values);
        toast.success('Course details saved.');
        return true;
      } catch (error) {
        toast.error(error instanceof Error && error.message ? error.message : 'Could not save the course. Try again.');
        return false;
      }
    };

    const discard = () => {
      form.setValues(savedValues);
      setPriceMode(savedValues.price > 0 ? 'paid' : 'free');
    };

    useImperativeHandle(ref, () => ({
      save,
      focusField,
      setDescription: (html: string) => setField('description', html),
    }));

    const changePriceMode = (mode: PriceMode) => {
      setPriceMode(mode);
      if (mode === 'free') setField('price', 0);
      else window.setTimeout(() => focusField('price'), 0);
    };

    const aiContext = {
      title: form.values.title,
      category: form.values.category || undefined,
      level: form.values.level,
      language: form.values.language || undefined,
      examName: form.values.examName || undefined,
      subjects: chapterTitles.length > 0 ? chapterTitles.slice(0, 30) : undefined,
    };

    const showSaveBar = isDirty || isUploading || isSaving;

    return (
      <div ref={rootRef} className={styles.root}>
        <Form {...form}>
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {notice ? <div className={styles.notice}>{notice}</div> : null}

            <section className={styles.group} aria-labelledby="course-about-heading">
              <h3 id="course-about-heading" className={styles.groupTitle}>About the course</h3>

              <div data-field="title">
                <FormItem name="title" className={styles.field}>
                  <div className={styles.labelRow}>
                    <FormLabel>Title</FormLabel>
                    <AIRewriteButton
                      field="title"
                      contentType="course"
                      currentValue={form.values.title}
                      context={aiContext}
                      onAccept={(suggestion) => setField('title', suggestion)}
                    />
                  </div>
                  <FormControl>
                    <Input
                      placeholder="e.g., Class 10 Physics, full syllabus"
                      value={form.values.title}
                      onChange={(e) => setField('title', e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <div data-field="description">
                <FormItem name="description" className={styles.field}>
                  <div className={styles.labelRow}>
                    <FormLabel>Description</FormLabel>
                    <AIRewriteButton
                      field="description"
                      contentType="course"
                      currentValue={form.values.description ?? ''}
                      context={aiContext}
                      allowEmpty={form.values.title.trim().length >= 3}
                      onAccept={(suggestion) => setField('description', suggestion)}
                    />
                  </div>
                  <FormControl>
                    <RichTextEditor
                      placeholder="What will students learn, and who is this course for?"
                      value={form.values.description ?? ''}
                      onChange={(html) => setField('description', html)}
                    />
                  </FormControl>
                  <FormDescription>Needed before you submit. Students read it before they enrol.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </section>

            <section className={styles.group} aria-labelledby="course-cover-heading">
              <div className={styles.groupHead}>
                <h3 id="course-cover-heading" className={styles.groupTitle}>Cover</h3>
                <p className={styles.groupHint}>Add a cover image, a short intro video, or both. One is needed to submit.</p>
              </div>
              <div className={styles.mediaGrid} data-field="cover">
                <FormItem name="thumbnailImageUrl" className={styles.field}>
                  <FormLabel>Cover image</FormLabel>
                  <FormControl>
                    <ThumbnailUploader
                      folder={`course/${course.id}`}
                      value={form.values.thumbnailImageUrl}
                      currentFileId={form.values.thumbnailImageFileId ?? undefined}
                      onChange={(url, fileId) =>
                        form.setValues((prev) => ({
                          ...prev,
                          thumbnailImageUrl: url || null,
                          thumbnailImageFileId: fileId || null,
                        }))
                      }
                      onRemove={() =>
                        form.setValues((prev) => ({ ...prev, thumbnailImageUrl: null, thumbnailImageFileId: null }))
                      }
                      onUploadingChange={(uploading) => setUploads((prev) => ({ ...prev, thumbnail: uploading }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="introVideoUrl" className={styles.field}>
                  <FormLabel>Intro video (optional)</FormLabel>
                  <FormControl>
                    <CourseThumbnailVideo
                      value={form.values.introVideoUrl ?? null}
                      fileId={form.values.introVideoFileId ?? null}
                      courseId={course.id}
                      onChange={(url, fileId) =>
                        form.setValues((prev) => ({ ...prev, introVideoUrl: url, introVideoFileId: fileId }))
                      }
                      onUploadingChange={(uploading) => setUploads((prev) => ({ ...prev, video: uploading }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            </section>

            <section className={styles.group} aria-labelledby="course-audience-heading">
              <h3 id="course-audience-heading" className={styles.groupTitle}>Price and audience</h3>

              <div className={styles.fieldGrid}>
                <div data-field="price" className={styles.wide}>
                  <FormItem name="price" className={styles.field}>
                    <FormLabel>Price</FormLabel>
                    <div className={styles.priceRow}>
                      <SegmentedControl
                        aria-label="Free or paid"
                        value={priceMode}
                        onValueChange={changePriceMode}
                        options={PRICE_OPTIONS}
                      />
                      {priceMode === 'paid' ? (
                        <div className={styles.rupeeInput}>
                          <span className={styles.rupee} aria-hidden="true">
                            ₹
                          </span>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              placeholder="499"
                              value={form.values.price > 0 ? form.values.price : ''}
                              onChange={(e) => {
                                const next = parseFloat(e.target.value);
                                setField('price', Number.isFinite(next) ? next : 0);
                              }}
                            />
                          </FormControl>
                        </div>
                      ) : null}
                    </div>
                    <FormMessage />
                  </FormItem>
                </div>

                <div className={`${styles.field} ${styles.wide}`}>
                  <span className={styles.fieldLabel} aria-hidden="true">Level</span>
                  <SegmentedControl
                    aria-label="Level"
                    value={form.values.level}
                    onValueChange={(level) => setField('level', level)}
                    options={LEVEL_OPTIONS}
                  />
                </div>

                <FormItem name="language" className={styles.field}>
                  <FormLabel>Language</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.language || '__empty'}
                      onValueChange={(value) => setField('language', value === '__empty' ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty">Not set</SelectItem>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="category" className={styles.field}>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Physics"
                      value={form.values.category}
                      onChange={(e) => setField('category', e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="examName" className={`${styles.field} ${styles.wide}`}>
                  <FormLabel>Exam (optional)</FormLabel>
                  <FormControl>
                    <ExamNamePicker
                      value={form.values.examName || ''}
                      onChange={(examName) => setField('examName', examName)}
                    />
                  </FormControl>
                  <FormDescription>Lists the course on that exam's page too.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </section>

            {showSaveBar ? (
              <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
                <p className={styles.saveText} role="status">
                  {isUploading ? 'Uploading. Save unlocks when it finishes.' : 'You have unsaved changes.'}
                </p>
                <div className={styles.saveActions}>
                  <Button type="button" variant="outline" onClick={discard} disabled={isSaving || isUploading || !isDirty}>
                    Discard
                  </Button>
                  <Button type="submit" disabled={isSaving || isUploading}>
                    {isSaving || isUploading ? <Spinner size="sm" /> : null}
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        </Form>
      </div>
    );
  }
);
CourseCreationForm.displayName = 'CourseCreationForm';
