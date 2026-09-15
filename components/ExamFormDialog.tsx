import React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type Selectable } from 'kysely';
import { type Exams } from '../helpers/schema';
import { slugify } from '../helpers/slugify';
import { useCreateExamMutation, useUpdateExamMutation } from '../helpers/useAdminExamCategories';
import { useAdminExamContentQuery } from '../helpers/useAdminExamContent';
import { ADMIN_EXAM_SECTION_TYPES } from '../helpers/examContentTypes';
import { Dialog, DialogClose } from './Dialog';
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from './ConsoleDialog';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { DatePicker } from './DatePicker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { AdminOwnerSelect } from './AdminOwnerSelect';
import { Info, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { schema as createExamSchema } from '../endpoints/admin/exams/create_POST.schema';

// Re-using the schema from the endpoint for consistency
import styles from './ExamFormDialog.module.css';

type Exam = Selectable<Exams>;

const examFormSchema = createExamSchema.extend({
  id: z.number().optional(),
});
type ExamFormData = z.infer<typeof examFormSchema>;

interface ExamFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: Exam;
  categoryId: number;
  categories?: { id: number; categoryName: string }[];
}

export const ExamFormDialog: React.FC<ExamFormDialogProps> = ({ isOpen, onClose, exam, categoryId, categories = [] }) => {
  const isEditMode = !!exam;
  const createMutation = useCreateExamMutation();
  const updateMutation = useUpdateExamMutation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormData>({
    resolver: zodResolver(examFormSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        id: exam?.id,
        categoryId: exam?.categoryId || categoryId,
        examName: exam?.examName || '',
        fullName: exam?.fullName || '',
        examSlug: exam?.examSlug || '',
        description: exam?.description || '',
        // Not shown in the UI anymore (removed per admin request), but kept
        // in the form's default value so an edit-save doesn't wipe out
        // whatever was previously stored here.
        aiGenerationPrompt: exam?.aiGenerationPrompt || '',
        ownerTag: exam?.ownerTag ?? null,
        contentDueDate: exam?.contentDueDate ?? undefined,
      });
    }
  }, [isOpen, exam, categoryId, reset]);

  const examName = watch('examName');

  React.useEffect(() => {
    const currentSlug = watch('examSlug');
    if (examName && (!currentSlug || currentSlug === slugify(exam?.examName || ''))) {
      setValue('examSlug', slugify(examName), { shouldValidate: true });
    }
  }, [examName, setValue, watch, exam]);

  const onSubmit = async (data: ExamFormData) => {
    try {
      if (isEditMode && data.id) {
        const ownerChanged = (data.ownerTag || null) !== (exam?.ownerTag || null);
        await updateMutation.mutateAsync({
          id: data.id,
          ...data,
          description: data.description || null,
          aiGenerationPrompt: data.aiGenerationPrompt || null,
          // Sent only when changed, so saving other details cannot undo an owner
          // that a content edit set while this dialog was open.
          ownerTag: ownerChanged ? data.ownerTag || null : undefined,
          contentDueDate: data.contentDueDate || null,
        });
      } else {
        await createMutation.mutateAsync({
          ...data,
          ownerTag: data.ownerTag || null,
          contentDueDate: data.contentDueDate || null,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save exam:', error);
      // Error toast is handled by the mutation hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title={isEditMode ? 'Edit exam' : 'Add new exam'}
          description={isEditMode ? 'Update the details for this exam.' : 'Create a new exam within this category.'}
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ConsoleDialogBody>
            {categories.length > 0 && (
              <div className={styles.field}>
                <label htmlFor="categoryId" className={styles.label}>
                  Category
                </label>
                <Select
                  value={String(watch('categoryId') ?? categoryId)}
                  onValueChange={(value) => setValue('categoryId', Number(value), { shouldValidate: true })}
                >
                  <SelectTrigger id="categoryId">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && <p className={styles.errorText}>{errors.categoryId.message}</p>}
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor="examName" className={styles.label}>
                Exam name
              </label>
              <Input id="examName" {...register('examName')} placeholder="e.g., SSC CGL" />
              {errors.examName && <p className={styles.errorText}>{errors.examName.message}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="fullName" className={styles.label}>
                Exam title
              </label>
              <Input
                id="fullName"
                {...register('fullName')}
                placeholder="e.g., Staff Selection Commission - Combined Graduate Level"
              />
              {errors.fullName && <p className={styles.errorText}>{errors.fullName.message}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="examSlug" className={styles.label}>
                Exam slug
              </label>
              <Input id="examSlug" {...register('examSlug')} placeholder="e.g., ssc-cgl" />
              {errors.examSlug && <p className={styles.errorText}>{errors.examSlug.message}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="description" className={styles.label}>
                Description
              </label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="A brief description of the exam..."
                rows={4}
              />
              {errors.description && <p className={styles.errorText}>{errors.description.message}</p>}
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label htmlFor="ownerTag" className={styles.label}>
                  Owner
                </label>
                <AdminOwnerSelect
                  id="ownerTag"
                  value={watch('ownerTag') ?? null}
                  onChange={(name) => setValue('ownerTag', name)}
                />
                <p className={styles.fieldHint}>Changes to whoever last edits this exam's content.</p>
              </div>
              <div className={styles.field}>
                <span className={styles.label}>Content due date</span>
                <DatePicker
                  value={watch('contentDueDate') ?? undefined}
                  onChange={(date) => setValue('contentDueDate', date ?? null, { shouldValidate: true })}
                  showTime={false}
                />
                <p className={styles.fieldHint}>Shows an overdue/due-soon reminder on the dashboard.</p>
              </div>
            </div>

            {isEditMode && exam && <ExamContentPagesSummary examId={exam.id} />}

            {!isEditMode && (
              <div className={styles.infoMessage}>
                <Info size={16} className={styles.infoIcon} />
                <p>After creating the exam, you'll be able to add subjects and topics.</p>
              </div>
            )}
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save exam'}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

// Compact status summary for the exam's content pages (syllabus, exam
// pattern, eligibility, cutoff + the hub page's own FAQ block), with a link
// through to the full editor. Lives in the dialog so admins have a single
// place to jump from "edit this exam" to "write its SEO content."
const ExamContentPagesSummary: React.FC<{ examId: number }> = ({ examId }) => {
  const { data, isFetching } = useAdminExamContentQuery(examId);
  const publishedCount = data?.pages.filter((p) => p.status === "published").length ?? 0;
  const totalCount = ADMIN_EXAM_SECTION_TYPES.length;

  return (
    <div className={styles.field}>
      <span className={styles.label}>Content pages</span>
      <div className={styles.contentPagesSummary}>
        <div className={styles.contentPagesInfo}>
          <FileText size={18} className={styles.contentPagesIcon} />
          <div>
            <p className={styles.contentPagesStatus}>
              {isFetching && !data ? (
                "Loading status..."
              ) : (
                <>
                  <CheckCircle2 size={13} className={styles.contentPagesCheckIcon} />
                  {publishedCount} of {totalCount} sections published
                </>
              )}
            </p>
            <p className={styles.contentPagesHint}>
              Syllabus, exam pattern, eligibility, cutoff, and FAQs - each with its own draft/publish workflow and AI-assisted writing.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/exam-content/${examId}`}>
            Manage content <ArrowRight size={14} />
          </Link>
        </Button>
      </div>
    </div>
  );
};