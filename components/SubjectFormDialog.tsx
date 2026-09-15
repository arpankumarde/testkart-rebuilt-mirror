import React, { useEffect } from 'react';
import { z } from 'zod';
import { Selectable } from 'kysely';
import { ExamSubjects } from '../helpers/schema';
import { slugify } from '../helpers/slugify';
import { useCreateExamSubjectMutation, useUpdateExamSubjectMutation } from '../helpers/useAdminExamSubjects';
import { schema as createSchema } from '../endpoints/admin/exam-subjects/create_POST.schema';
import { schema as updateSchema } from '../endpoints/admin/exam-subjects/update_POST.schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './Dialog';
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Switch } from './Switch';

interface SubjectFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  examId: number;
  subject?: Selectable<ExamSubjects>;
}

const formSchema = createSchema.omit({ subjectSlug: true }).merge(updateSchema.omit({ subjectSlug: true, id: true }));

export const SubjectFormDialog: React.FC<SubjectFormDialogProps> = ({ isOpen, onClose, examId, subject }) => {
  const isEditMode = !!subject;

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      examId: examId,
      subjectName: subject?.subjectName || '',
      description: subject?.description || '',
      syllabusTopics: subject?.syllabusTopics || '',
      orderIndex: subject?.orderIndex || 0,
      isActive: subject?.isActive ?? true,
    },
  });

  const { setValues, values } = form;

  useEffect(() => {
    if (isOpen) {
      setValues({
        examId: examId,
        subjectName: subject?.subjectName || '',
        description: subject?.description || '',
        syllabusTopics: subject?.syllabusTopics || '',
        orderIndex: subject?.orderIndex || 0,
        isActive: subject?.isActive ?? true,
      });
    } else {
      // Manually clear values on close
      setTimeout(() => {
        setValues({
          examId: examId,
          subjectName: '',
          description: '',
          syllabusTopics: '',
          orderIndex: 0,
          isActive: true,
        });
      }, 150);
    }
  }, [isOpen, subject, examId, setValues]);

  const createMutation = useCreateExamSubjectMutation();
  const updateMutation = useUpdateExamSubjectMutation();

  const isSaving = isEditMode ? updateMutation.isPending : createMutation.isPending;

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Assert that subjectName exists (validated by schema)
    const subjectName = data.subjectName as string;
    const slug = slugify(subjectName);
    
    if (isEditMode && subject) {
      // Update payload - only include fields that have values
      const payload: z.infer<typeof updateSchema> = {
        id: subject.id,
        ...(data.subjectName !== undefined && { subjectName: data.subjectName }),
        subjectSlug: slug,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.syllabusTopics !== undefined && { syllabusTopics: data.syllabusTopics }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      };
      updateMutation.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    } else {
      // Create payload - ensure required fields and proper types
      const payload: z.infer<typeof createSchema> = {
        examId: data.examId as number,
        subjectName: subjectName,
        subjectSlug: slug,
        isActive: data.isActive ?? true,
        ...(data.description && { description: data.description }),
        ...(data.syllabusTopics && { syllabusTopics: data.syllabusTopics }),
        ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
      };
      createMutation.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for this subject.' : 'Fill in the details for the new subject.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormItem name="subjectName">
              <FormLabel>Subject Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Quantitative Aptitude"
                  value={values.subjectName}
                  onChange={(e) => setValues(prev => ({ ...prev, subjectName: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="description">
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="A brief description of the subject."
                  value={values.description || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, description: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="syllabusTopics">
              <FormLabel>Syllabus / Topics (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter syllabus content and topics for AI generation (one per line or as paragraph)"
                  rows={6}
                  value={values.syllabusTopics || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, syllabusTopics: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
              <FormItem name="orderIndex" style={{ flex: 1 }}>
                <FormLabel>Order Index</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={values.orderIndex}
                    onChange={(e) => setValues(prev => ({ ...prev, orderIndex: parseInt(e.target.value, 10) || 0 }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="isActive" style={{ paddingTop: 'var(--spacing-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <FormControl>
                    <Switch
                      id="isActive"
                      checked={values.isActive}
                      onCheckedChange={(checked: boolean) => setValues(prev => ({ ...prev, isActive: checked }))}
                    />
                  </FormControl>
                  <FormLabel htmlFor="isActive">Is Active</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Subject'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};