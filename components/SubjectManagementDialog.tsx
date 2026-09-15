import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Edit, Plus, X } from 'lucide-react';
import { Selectable } from 'kysely';
import { TestItemSubjects } from '../helpers/schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from './Dialog';
import { Button } from './Button';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { AutoComplete, type Option } from './AutoComplete';
import { Checkbox } from './Checkbox';
import { Badge } from './Badge';
import { Separator } from './Separator';
import { useTestItemSubjectsMutations, useTestItemSubjectsQuery } from '../helpers/useTestItemSubjectsQuery';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useExamSubjectsQuery } from '../helpers/useExamSubjectsQuery';
import { useSubjectSectionsQuery } from '../helpers/useSubjectSections';
import { schema as createSubjectSchema } from '../endpoints/teacher/test-item-subjects/create_POST.schema';
import { SubjectSectionsEditor, type SubjectSectionsEditorHandle } from './SubjectSectionsEditor';
import styles from './SubjectManagementDialog.module.css';

const parseCustomNames = (raw: string, alreadyAdded: readonly string[]): string[] =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !alreadyAdded.includes(s))
    )
  );

// Schema for edit mode - includes subject name, optional maxAttemptsAllowed, and optional durationMinutes
const editFormSchema = createSubjectSchema
  .pick({ subjectName: true })
  .extend({
    description: z.string().nullable().optional(),
    maxAttemptsAllowed: z.number().int().positive().nullable().optional(),
    durationMinutes: z.number().int().positive('Duration must be at least 1 minute').nullable().optional(),
  });

type SubjectManagementDialogProps = {
  testItemId: number;
  packageId: number;
  subjectToEdit?: Selectable<TestItemSubjects>;
  onSuccess: () => void;
  className?: string;
  subjectWiseTiming?: boolean;
};

export const SubjectManagementDialog = ({
  testItemId,
  packageId,
  subjectToEdit,
  onSuccess,
  className,
  subjectWiseTiming = false,
}: SubjectManagementDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [subjectInputValue, setSubjectInputValue] = useState('');

  // State for multi-subject creation
  const [selectedExamSubjects, setSelectedExamSubjects] = useState<Set<string>>(new Set());
  const [customSubjectsInput, setCustomSubjectsInput] = useState('');
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);

  const isEditMode = !!subjectToEdit;

  const { useCreateMultipleSubjectsMutation, useUpdateSubjectMutation } =
    useTestItemSubjectsMutations(testItemId);
  const createMultipleSubjects = useCreateMultipleSubjectsMutation();
  const updateSubject = useUpdateSubjectMutation();

  // Fetch test package to get examId
  const { data: tests, isFetching: isLoadingTests } = useTeacherTestsQuery();
  const currentTest = tests?.find((test) => test.id === packageId);
  const examId = currentTest?.examId ?? null;

  // Fetch exam subjects if examId exists
  const { data: examSubjects, isFetching: isLoadingSubjects } =
    useExamSubjectsQuery(examId);

  // Fetch existing test item subjects to mark already-added ones (create mode)
  const { data: existingSubjects, isFetching: isLoadingExisting } =
    useTestItemSubjectsQuery(testItemId);

  // Fetch sections for the subject being edited (edit mode only)
  const { data: subjectSections } =
    useSubjectSectionsQuery(isEditMode && isOpen ? (subjectToEdit?.id ?? null) : null);

  // Read from data, not isFetching: a section rename refetches the list, and
  // the max-attempts field must not flicker out of the form while it does.
  const hasSections = subjectSections != null && subjectSections.length > 0;

  const existingSubjectNames = new Set(
    existingSubjects?.map((s) => s.subjectName) ?? []
  );

  const form = useForm({
    schema: editFormSchema,
    defaultValues: {
      subjectName: '',
      description: undefined,
      maxAttemptsAllowed: undefined,
      durationMinutes: undefined,
    },
  });

  const sectionsEditorRef = useRef<SubjectSectionsEditorHandle>(null);
  const [isApplyingSections, setIsApplyingSections] = useState(false);

  // Seed when the dialog opens. subjectToEdit is a new object on every subjects
  // refetch, so keying on it would wipe whatever the teacher has typed.
  useEffect(() => {
    if (isEditMode && isOpen && subjectToEdit) {
      form.setValues({
        subjectName: subjectToEdit.subjectName,
        description: subjectToEdit.description ?? undefined,
        maxAttemptsAllowed: subjectToEdit.maxAttemptsAllowed ?? undefined,
        durationMinutes: subjectToEdit.durationMinutes ?? undefined,
      });
      setSubjectInputValue(subjectToEdit.subjectName);
    } else if (!isOpen) {
      form.setValues({ subjectName: '', description: undefined, maxAttemptsAllowed: undefined, durationMinutes: undefined });
      setSubjectInputValue('');
      setSelectedExamSubjects(new Set());
      setCustomSubjectsInput('');
      setCustomSubjects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, subjectToEdit?.id, isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (
      !open &&
      sectionsEditorRef.current?.hasPendingAssignments() &&
      !window.confirm('Your section ranges have not been applied. Close without applying them?')
    ) {
      return;
    }
    setIsOpen(open);
  };

  // Map exam subjects to AutoComplete options (for edit mode)
  const subjectOptions: Option[] =
    examSubjects?.map((subject) => ({
      value: subject.subjectName,
      label: subject.subjectName,
    })) ?? [];

  const handleSubjectValueChange = (option: Option) => {
    const selectedName = option.value;
    form.setValues((prev) => ({
      ...prev,
      subjectName: selectedName,
    }));
    setSubjectInputValue(selectedName);
  };

  const handleSubjectInputChange = (value: string) => {
    setSubjectInputValue(value);
    form.setValues((prev) => ({
      ...prev,
      subjectName: value,
    }));
  };

  // Handle checkbox changes for exam subjects
  const handleExamSubjectToggle = (subjectName: string) => {
    const newSelected = new Set(selectedExamSubjects);
    if (newSelected.has(subjectName)) {
      newSelected.delete(subjectName);
    } else {
      newSelected.add(subjectName);
    }
    setSelectedExamSubjects(newSelected);
  };

  // Parse custom subjects input
  const handleCustomSubjectsInputChange = (value: string) => {
    setCustomSubjectsInput(value);
  };

  const handleAddCustomSubjects = () => {
    if (!customSubjectsInput.trim()) return;

    const newSubjects = parseCustomNames(customSubjectsInput, customSubjects);
    if (newSubjects.length > 0) {
      setCustomSubjects([...customSubjects, ...newSubjects]);
    }
    setCustomSubjectsInput('');
  };

  const handleRemoveCustomSubject = (subject: string) => {
    setCustomSubjects(customSubjects.filter((s) => s !== subject));
  };

  // Handle key press in custom subjects input
  const handleCustomSubjectsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomSubjects();
    }
  };

  const handleEditSubmit = async (values: z.infer<typeof editFormSchema>) => {
    if (!subjectToEdit) return;

    if (subjectWiseTiming && (values.durationMinutes == null || values.durationMinutes < 1)) {
      toast.error('Duration is required and must be at least 1 minute.');
      return;
    }

    // Typed section ranges are part of this save, not a separate step to forget.
    setIsApplyingSections(true);
    const sectionsSaved = await (sectionsEditorRef.current?.applyPendingAssignments() ?? Promise.resolve(true));
    setIsApplyingSections(false);
    if (!sectionsSaved) return;

    const mutationPromise = updateSubject.mutateAsync({
      id: subjectToEdit.id,
      subjectName: values.subjectName,
      description: values.description ?? null,
      maxAttemptsAllowed: values.maxAttemptsAllowed ?? null,
      durationMinutes: values.durationMinutes ?? null,
    });

    toast.promise(mutationPromise, {
      loading: 'Updating subject...',
      success: () => {
        onSuccess();
        setIsOpen(false);
        return 'Subject updated successfully.';
      },
      error: (err) =>
        err instanceof Error ? err.message : 'An unknown error occurred.',
    });
  };

  // A name still in the text box counts as selected, so Add is never disabled
  // while the teacher can see the subject they typed.
  const pendingCustomSubjects = parseCustomNames(customSubjectsInput, customSubjects);
  const allSelectedSubjectNames: string[] = [];
  const seenSubjectKeys = new Set<string>();
  for (const name of [...Array.from(selectedExamSubjects), ...customSubjects, ...pendingCustomSubjects]) {
    if (seenSubjectKeys.has(name.toLowerCase())) continue;
    seenSubjectKeys.add(name.toLowerCase());
    allSelectedSubjectNames.push(name);
  }
  const totalSelectedSubjects = allSelectedSubjectNames.length;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (allSelectedSubjectNames.length === 0) {
      toast.error('Select or type at least one subject.');
      return;
    }

    try {
      const { created, skipped } = await createMultipleSubjects.mutateAsync({
        testItemId,
        subjectNames: allSelectedSubjectNames,
      });
      const skippedText = skipped.join(', ');
      if (created.length === 0) {
        toast.error(`Nothing added: ${skippedText} ${skipped.length === 1 ? 'is' : 'are'} already in this test.`);
        return;
      }
      const addedText = `${created.length} subject${created.length === 1 ? '' : 's'} added.`;
      toast.success(skipped.length > 0 ? `${addedText} Skipped ${skippedText}, already in this test.` : addedText);
      onSuccess();
      setIsOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the subjects.');
    }
  };

  const isPending = createMultipleSubjects.isPending || updateSubject.isPending || isApplyingSections;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEditMode ? (
          <Button variant="ghost" size="icon-sm" className={className}>
            <Edit size={16} />
            <span className={styles.srOnly}>Edit Subject</span>
          </Button>
        ) : (
          <Button className={className}>
            <Plus size={16} /> Add Subject
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Subject' : 'Add Subjects'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the name and settings for this subject.'
              : 'Select from exam subjects or add custom subjects.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={isEditMode ? form.handleSubmit(handleEditSubmit) : handleCreateSubmit}
            className={styles.form}
            id="subject-form"
          >
            {isEditMode ? (
              // Edit mode: subject name + max attempts + duration + sections
              <div className={styles.editContainer}>
                {/* Subject name field */}
                <FormItem name="subjectName">
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    {examId && !isLoadingTests ? (
                      <AutoComplete
                        options={subjectOptions}
                        placeholder="e.g., Physics, Mathematics, General Knowledge"
                        emptyMessage="No subjects found for this exam"
                        value={
                          form.values.subjectName
                            ? {
                                value: form.values.subjectName,
                                label: form.values.subjectName,
                              }
                            : undefined
                        }
                        onValueChange={handleSubjectValueChange}
                        inputValue={subjectInputValue}
                        onInputValueChange={handleSubjectInputChange}
                        disabled={isPending}
                        isLoading={isLoadingSubjects}
                        allowFreeForm={true}
                      />
                    ) : (
                      <div>
                        <Input
                          placeholder="e.g., Physics"
                          value={form.values.subjectName}
                          onChange={(e) =>
                            form.setValues((prev) => ({
                              ...prev,
                              subjectName: e.target.value,
                            }))
                          }
                          disabled={isPending}
                        />
                        {!examId && !isLoadingTests && (
                          <p className={styles.helperText}>
                            Set an exam name in basic info to see suggested subjects.
                          </p>
                        )}
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>

                {/* Description field */}
                <FormItem name="description">
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="e.g., Chapters: Mechanics, Thermodynamics, Optics..."
                      value={form.values.description ?? ''}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          description: e.target.value || undefined,
                        }))
                      }
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe topics or chapters included in this subject.
                  </FormDescription>
                  <FormMessage />
                </FormItem>

                {/* Duration field (only when subjectWiseTiming is enabled) */}
                {subjectWiseTiming && (
                  <FormItem name="durationMinutes">
                    <FormLabel>Duration (minutes) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g., 30"
                        value={
                          form.values.durationMinutes != null
                            ? String(form.values.durationMinutes)
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          form.setValues((prev) => ({
                            ...prev,
                            durationMinutes:
                              raw === '' ? undefined : parseInt(raw, 10),
                          }));
                        }}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Required. Each subject must have at least 1 minute.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}

                {/* Max attempts field (only when no sections exist) */}
                {hasSections ? (
                  <p className={styles.infoNote}>
                    Attempt limits are configured per section below.
                  </p>
                ) : (
                  <FormItem name="maxAttemptsAllowed">
                    <FormLabel>Max Questions to Attempt</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="No limit"
                        value={
                          form.values.maxAttemptsAllowed != null
                            ? String(form.values.maxAttemptsAllowed)
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          form.setValues((prev) => ({
                            ...prev,
                            maxAttemptsAllowed:
                              raw === '' ? undefined : parseInt(raw, 10),
                          }));
                        }}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription>
                      Limit how many questions students must attempt. Leave empty for no limit.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}

                <Separator />

                {/* Sections area */}
                <SubjectSectionsEditor ref={sectionsEditorRef} subjectId={subjectToEdit.id} />
              </div>
            ) : (
              // Create mode: Multi-subject selection
              <div className={styles.multiSubjectContainer}>
                {examId && examSubjects && examSubjects.length > 0 && (
                  <div className={styles.examSubjectsSection}>
                    <div className={styles.sectionLabel}>
                      Select from {currentTest?.examName || 'exam'} subjects:
                    </div>
                    {isLoadingSubjects || isLoadingExisting ? (
                      <div className={styles.loadingText}>Loading subjects...</div>
                    ) : (
                      <div className={styles.checkboxList}>
                        {examSubjects.map((subject) => {
                          const isAlreadyAdded = existingSubjectNames.has(subject.subjectName);
                          const isSelected = selectedExamSubjects.has(subject.subjectName);
                          return (
                            <label
                              key={subject.id}
                              className={`${styles.checkboxItem} ${
                                isAlreadyAdded ? styles.disabled : ''
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={isAlreadyAdded || isPending}
                                onChange={() =>
                                  handleExamSubjectToggle(subject.subjectName)
                                }
                              />
                              <span className={styles.checkboxLabel}>
                                {subject.subjectName}
                                {isAlreadyAdded && (
                                  <Badge variant="outline" className={styles.addedBadge}>
                                    already added
                                  </Badge>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.customSubjectsSection}>
                  <div className={styles.sectionLabel}>Or add custom subject(s):</div>
                  <div className={styles.customSubjectsInput}>
                    <Input
                      placeholder="Enter subject names separated by commas..."
                      value={customSubjectsInput}
                      onChange={(e) => handleCustomSubjectsInputChange(e.target.value)}
                      onKeyDown={handleCustomSubjectsKeyDown}
                      onBlur={handleAddCustomSubjects}
                      disabled={isPending}
                    />
                    <p className={styles.helperText}>
                      e.g., "Reasoning, General Awareness, English"
                    </p>
                  </div>
                  {customSubjects.length > 0 && (
                    <div className={styles.customSubjectsChips}>
                      {customSubjects.map((subject) => (
                        <Badge key={subject} className={styles.customChip}>
                          {subject}
                          <button
                            type="button"
                            className={styles.removeChipButton}
                            onClick={() => handleRemoveCustomSubject(subject)}
                            disabled={isPending}
                            aria-label={`Remove ${subject}`}
                          >
                            <X size={14} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subject-wise timing note in create mode */}
                {subjectWiseTiming && (
                  <p className={styles.infoNote}>
                    You can set per-subject duration after adding subjects by editing each subject.
                  </p>
                )}

                {totalSelectedSubjects > 0 && (
                  <div className={styles.selectedPreview}>
                    <div className={styles.selectedCount}>
                      <strong>Selected:</strong> {totalSelectedSubjects} subject
                      {totalSelectedSubjects > 1 ? 's' : ''}
                    </div>
                    <div className={styles.selectedList}>
                      {allSelectedSubjectNames.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="subject-form"
            disabled={isPending || (!isEditMode && totalSelectedSubjects === 0)}
          >
            {isPending
              ? isEditMode
                ? 'Saving...'
                : 'Adding...'
              : isEditMode
                ? 'Save Changes'
                : totalSelectedSubjects > 0
                  ? `Add ${totalSelectedSubjects} Subject${totalSelectedSubjects > 1 ? 's' : ''}`
                  : 'Add Subjects'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};