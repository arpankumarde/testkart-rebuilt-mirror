import React, { useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Sparkles, LoaderCircle, AlertTriangle, ChevronLeft } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './Dialog';
import { Button } from './Button';
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Switch } from './Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './Select';
import {
  AIGeneratedQuestionsReview,
  isDraftMissingAnswer,
} from './AIGeneratedQuestionsReview';
import {
  schema as generateAiSchema,
  type GeneratedQuestionDraft,
} from '../endpoints/teacher/questions/generate-ai_POST.schema';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';

import styles from './AIQuestionGeneratorDialog.module.css';

interface AIQuestionGeneratorDialogProps {
  subjectId: number;
  examName: string;
  subjectName: string;
  onSuccess: () => void;
  onGenerationError?: (error: string) => void;
  className?: string;
}

const formSchema = generateAiSchema
  .pick({
    examName: true,
    subjectName: true,
    numberOfQuestions: true,
    customPrompt: true,
    chapterTopic: true,
    syllabus: true,
    questionType: true,
    positiveMarks: true,
    negativeMarks: true,
    language: true,
    includeExplanation: true,
  });

export const AIQuestionGeneratorDialog: React.FC<AIQuestionGeneratorDialogProps> = ({
  subjectId,
  examName,
  subjectName,
  onSuccess,
  onGenerationError,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Generation can outlive the dialog being open (the teacher may close it and
  // carry on), so the async callback reads the live value here rather than the
  // one captured when the mutation was fired.
  const isOpenRef = useRef(false);
  // Generated questions are held here, unsaved, until the teacher accepts them.
  const [drafts, setDrafts] = useState<GeneratedQuestionDraft[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [requestedCount, setRequestedCount] = useState(0);

  const { useGenerateAiQuestionsMutation, useAcceptAiQuestionsMutation } =
    useTeacherTestMutations();
  const generateMutation = useGenerateAiQuestionsMutation();
  const acceptMutation = useAcceptAiQuestionsMutation();

  const defaultFormValues = {
    examName,
    subjectName,
    numberOfQuestions: 5,
    customPrompt: '',
    chapterTopic: '',
    syllabus: '',
    questionType: 'single_correct_mcq' as const,
    positiveMarks: undefined as number | undefined,
    negativeMarks: undefined as number | undefined,
    language: 'english' as const,
    includeExplanation: true,
  };

  const form = useForm({
    schema: formSchema,
    defaultValues: defaultFormValues,
  });

  const isBusy = generateMutation.isPending || acceptMutation.isPending;
  const isReviewing = drafts !== null;

  const openDialog = (open: boolean) => {
    isOpenRef.current = open;
    setIsOpen(open);
  };

  const resetAll = () => {
    form.setValues(defaultFormValues);
    setDrafts(null);
    setSelected(new Set());
    setRequestedCount(0);
  };

  const closeAndReset = () => {
    openDialog(false);
    resetAll();
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const numberOfQuestions = Number(values.numberOfQuestions);
    setRequestedCount(numberOfQuestions);

    generateMutation.mutate(
      {
        subjectId,
        examName: values.examName,
        subjectName: values.subjectName,
        numberOfQuestions,
        customPrompt: values.customPrompt,
        chapterTopic: values.chapterTopic,
        syllabus: values.syllabus,
        questionType: values.questionType,
        positiveMarks: values.positiveMarks,
        negativeMarks: values.negativeMarks,
        language: values.language,
        includeExplanation: values.includeExplanation,
      },
      {
        onSuccess: (data) => {
          // Everything is pre-selected: the common case is "these look fine,
          // add them all", and unticking is cheaper than ticking 20 boxes.
          setDrafts(data.questions);
          setSelected(new Set(data.questions.map((_, i) => i)));
          // Nothing is saved yet, so drafts are lost if the teacher never comes
          // back to them. Say so rather than failing silently.
          if (!isOpenRef.current) {
            toast.info(
              `${data.questions.length} question${data.questions.length === 1 ? '' : 's'} ready — reopen "Generate with AI" to review and add them.`
            );
          }
        },
        onError: (error) => {
          const errorMessage = error instanceof Error
            ? error.message
            : 'An unknown error occurred during question generation.';
          onGenerationError?.(errorMessage);
          toast.error(errorMessage);
          console.error('AI Question Generation Error:', error);
        },
      }
    );
  };

  const handleAccept = () => {
    if (!drafts) return;
    const accepted = drafts.filter((_, i) => selected.has(i));
    if (accepted.length === 0) {
      toast.error('Select at least one question to add.');
      return;
    }

    acceptMutation.mutate(
      { subjectId, questions: accepted },
      {
        onSuccess: (data) => {
          toast.success(
            `Added ${data.questionsAdded} question${data.questionsAdded === 1 ? '' : 's'} to this subject.`
          );
          closeAndReset();
          onSuccess();
        },
        onError: (error) => {
          const errorMessage = error instanceof Error
            ? error.message
            : 'Failed to add the selected questions.';
          toast.error(errorMessage);
          console.error('AI Question Accept Error:', error);
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    // Don't let the dialog be pulled out from under an in-flight save.
    if (!open && acceptMutation.isPending) return;
    if (!open && isReviewing) {
      const confirmed = window.confirm(
        'Discard the generated questions? They have not been added to your test yet.'
      );
      if (!confirmed) return;
    }
    openDialog(open);
    // A generation still running keeps its state: it finishes in the background
    // and the drafts are waiting when the dialog is reopened.
    if (!open && !generateMutation.isPending) resetAll();
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked && drafts ? new Set(drafts.map((_, i) => i)) : new Set());
  };

  const missingAnswerCount = drafts
    ? drafts.filter((q, i) => selected.has(i) && isDraftMissingAnswer(q)).length
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={className}>
          <Sparkles size={16} />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>
            {isReviewing ? 'Review Generated Questions' : 'Generate Questions with AI'}
          </DialogTitle>
          <DialogDescription>
            {isReviewing
              ? 'Nothing has been saved yet. Pick the questions you want and add them to this subject.'
              : 'Leverage AI to quickly create high-quality questions for your test. You will review them before anything is added.'}
          </DialogDescription>
        </DialogHeader>

        {isReviewing ? (
          <div className={styles.reviewStep}>
            {drafts.length < requestedCount && (
              <div className={styles.partialNote}>
                <AlertTriangle size={16} />
                <span>
                  The AI returned {drafts.length} of the {requestedCount} questions you
                  asked for. Add these, then generate again for more.
                </span>
              </div>
            )}

            <AIGeneratedQuestionsReview
              questions={drafts}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              disabled={acceptMutation.isPending}
            />

            {missingAnswerCount > 0 && (
              <div className={styles.partialNote}>
                <AlertTriangle size={16} />
                <span>
                  {missingAnswerCount} selected question
                  {missingAnswerCount === 1 ? ' has' : 's have'} no correct answer marked.
                  You can still add {missingAnswerCount === 1 ? 'it' : 'them'} and fix
                  {missingAnswerCount === 1 ? ' it' : ' them'} in the question list.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={acceptMutation.isPending}
                onClick={() => {
                  setDrafts(null);
                  setSelected(new Set());
                }}
              >
                <ChevronLeft size={16} />
                Back to settings
              </Button>
              <Button
                type="button"
                onClick={handleAccept}
                disabled={acceptMutation.isPending || selected.size === 0}
              >
                {acceptMutation.isPending ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={16} />
                    Adding...
                  </>
                ) : (
                  `Add ${selected.size} Question${selected.size === 1 ? '' : 's'}`
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.grid}>
                <FormItem name="examName">
                  <FormLabel>Exam Name</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.examName}
                      onChange={(e) =>
                        form.setValues((prev) => ({ ...prev, examName: e.target.value }))
                      }
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="subjectName">
                  <FormLabel>Subject Name</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.subjectName}
                      onChange={(e) =>
                        form.setValues((prev) => ({ ...prev, subjectName: e.target.value }))
                      }
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="chapterTopic">
                <FormLabel>Chapter/Topic Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Organic Chemistry - Aldehydes & Ketones"
                    value={form.values.chapterTopic}
                    onChange={(e) =>
                      form.setValues((prev) => ({ ...prev, chapterTopic: e.target.value }))
                    }
                    disabled={isBusy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="syllabus">
                <FormLabel>Syllabus</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., Nomenclature, Reactions, Physical properties..."
                    rows={3}
                    value={form.values.syllabus}
                    onChange={(e) =>
                      form.setValues((prev) => ({ ...prev, syllabus: e.target.value }))
                    }
                    disabled={isBusy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <div className={styles.grid}>
                <FormItem name="numberOfQuestions">
                  <FormLabel>Number of Questions</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={form.values.numberOfQuestions}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          numberOfQuestions: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="questionType">
                  <FormLabel>Question Type</FormLabel>
                  <Select
                    value={form.values.questionType}
                    onValueChange={(value) =>
                      form.setValues((prev) => ({ ...prev, questionType: value as 'single_correct_mcq' | 'multiple_correct_mcq' | 'numerical' }))
                    }
                    disabled={isBusy}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select question type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="single_correct_mcq">Single Correct MCQ</SelectItem>
                      <SelectItem value="multiple_correct_mcq">Multiple Correct MCQ</SelectItem>
                      <SelectItem value="numerical">Numerical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </div>

              <div className={styles.grid}>
                <FormItem name="positiveMarks">
                  <FormLabel>Positive Marks</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="e.g., 4"
                      value={form.values.positiveMarks ?? ''}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          positiveMarks: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        }))
                      }
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="negativeMarks">
                  <FormLabel>Negative Marks</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="e.g., 1"
                      value={form.values.negativeMarks ?? ''}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          negativeMarks: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        }))
                      }
                      disabled={isBusy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              <div className={styles.grid}>
                <FormItem name="language">
                  <FormLabel>Language</FormLabel>
                  <Select
                    value={form.values.language}
                    onValueChange={(value) =>
                      form.setValues((prev) => ({ ...prev, language: value as 'english' | 'hindi' | 'bilingual' }))
                    }
                    disabled={isBusy}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                      <SelectItem value="bilingual">Bilingual (English + Hindi)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>

                <FormItem name="includeExplanation">
                  <FormLabel>Explanation</FormLabel>
                  <div className={styles.switchRow}>
                    <FormControl>
                      <Switch
                        checked={form.values.includeExplanation}
                        onCheckedChange={(checked) =>
                          form.setValues((prev) => ({ ...prev, includeExplanation: checked }))
                        }
                        disabled={isBusy}
                      />
                    </FormControl>
                    <span className={styles.switchLabel}>
                      {form.values.includeExplanation ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              </div>

              <FormItem name="customPrompt">
                <FormLabel>Additional Instructions (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any specific instructions for the AI..."
                    rows={2}
                    value={form.values.customPrompt}
                    onChange={(e) =>
                      form.setValues((prev) => ({ ...prev, customPrompt: e.target.value }))
                    }
                    disabled={isBusy}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <div className={styles.latexNote}>
                <p>
                  Questions will support LaTeX math notation using{' '}
                  <code>\(...\)</code> for inline and <code>\[...\]</code> for display mode.
                </p>
              </div>

              {generateMutation.isPending && (
                <div className={styles.loadingContainer}>
                  <LoaderCircle className={styles.spinner} size={16} />
                  <span>
                    Generating questions... this usually takes 10-30 seconds. Keep this
                    dialog open to review them.
                  </span>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={acceptMutation.isPending}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isBusy}>
                  {generateMutation.isPending ? (
                    <>
                      <LoaderCircle className={styles.spinner} size={16} />
                      Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
