import React from 'react';
import { z } from 'zod';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { schema as createSchema } from '../endpoints/teacher/course-sections/create_POST.schema';
import styles from './CourseSectionForm.module.css';

type CourseSectionFormProps = {
  courseId: number;
  sectionToEdit?: {
    id: number;
    title: string;
    description: string | null;
  };
  onSuccess: () => void;
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
};

const formSchema = createSchema.omit({ courseId: true });

export const CourseSectionForm: React.FC<CourseSectionFormProps> = ({
  courseId,
  sectionToEdit,
  onSuccess,
  onSubmit,
  isSubmitting,
}) => {
  const isEditMode = !!sectionToEdit;

  const form = useForm({
    schema: formSchema,
    defaultValues: isEditMode
      ? {
          title: sectionToEdit.title,
          description: sectionToEdit.description,
        }
      : {
          title: '',
          description: null,
        },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (isEditMode) {
      onSubmit({ sectionId: sectionToEdit.id, ...values });
    } else {
      onSubmit({ courseId, ...values });
    }
  };

  return (
    <div className={styles.formContainer}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.form}>
          <FormItem name="title">
            <FormLabel>Section Title</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Introduction to the Course"
                value={form.values.title}
                onChange={(e) => form.setValues((prev) => ({ ...prev, title: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="description">
            <FormLabel>Section Description (Optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="A brief description of this section."
                rows={3}
                value={form.values.description || ''}
                onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.formActions}>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isEditMode ? 'Save Changes' : 'Create Section'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};