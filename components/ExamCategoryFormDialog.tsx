import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type Selectable } from 'kysely';
import { type ExamCategories } from '../helpers/schema';
import { slugify } from '../helpers/slugify';
import { useCreateExamCategoryMutation, useUpdateExamCategoryMutation } from '../helpers/useAdminExamCategories';
import { Dialog, DialogClose } from './Dialog';
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from './ConsoleDialog';
import { Button } from './Button';
import { Input } from './Input';
import { schema as createCategorySchema } from '../endpoints/admin/exam-categories/create_POST.schema';

// Re-using the schema from the endpoint for consistency
import styles from './ExamCategoryFormDialog.module.css';

type ExamCategory = Selectable<ExamCategories>;

const categoryFormSchema = createCategorySchema.extend({
  id: z.number().optional(),
});
type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface ExamCategoryFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category?: ExamCategory;
}

export const ExamCategoryFormDialog: React.FC<ExamCategoryFormDialogProps> = ({ isOpen, onClose, category }) => {
  const isEditMode = !!category;
  const createMutation = useCreateExamCategoryMutation();
  const updateMutation = useUpdateExamCategoryMutation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        id: category?.id,
        categoryName: category?.categoryName || '',
        categorySlug: category?.categorySlug || '',
      });
    }
  }, [isOpen, category, reset]);

  const categoryName = watch('categoryName');

  React.useEffect(() => {
    const currentSlug = watch('categorySlug');
    if (categoryName && (!currentSlug || currentSlug === slugify(category?.categoryName || ''))) {
      setValue('categorySlug', slugify(categoryName), {
        shouldValidate: true,
      });
    }
  }, [categoryName, setValue, watch, category]);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (isEditMode && data.id) {
        await updateMutation.mutateAsync({
          id: data.id,
          categoryName: data.categoryName,
          categorySlug: data.categorySlug,
        });
      } else {
        await createMutation.mutateAsync({
          categoryName: data.categoryName,
          categorySlug: data.categorySlug,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save category:', error);
      // Error toast is handled by the mutation hook
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="sm">
        <ConsoleDialogHeader
          title={isEditMode ? 'Edit category' : 'Add new category'}
          description={
            isEditMode ? 'Update the details for this exam category.' : 'Create a new category to group exams.'
          }
        />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ConsoleDialogBody>
            <div className={styles.field}>
              <label htmlFor="categoryName" className={styles.label}>
                Category name
              </label>
              <Input id="categoryName" {...register('categoryName')} placeholder="e.g., Banking Exams" />
              {errors.categoryName && <p className={styles.errorText}>{errors.categoryName.message}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="categorySlug" className={styles.label}>
                Category slug
              </label>
              <Input id="categorySlug" {...register('categorySlug')} placeholder="e.g., banking-exams" />
              {errors.categorySlug && <p className={styles.errorText}>{errors.categorySlug.message}</p>}
            </div>
          </ConsoleDialogBody>
          <ConsoleDialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save category'}
            </Button>
          </ConsoleDialogFooter>
        </form>
      </ConsoleDialogContent>
    </Dialog>
  );
};