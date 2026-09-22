import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Circle, PenLine, RotateCcw, Send, Sparkles } from 'lucide-react';
import { Dialog } from './Dialog';
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from './ConsoleDialog';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { AiRewriteError, postTeacherAIRewrite } from '../endpoints/teacher/ai/rewrite_POST.schema';
import { hasCourseDescription, type CourseReadinessItem, type CourseReadinessKey } from '../helpers/courseDraft';
import { sanitizeHtml } from '../helpers/sanitizeHtml';
import styles from './CourseSubmitDialog.module.css';

export type CourseAiContext = {
  title: string;
  category?: string;
  level?: string;
  language?: string;
  examName?: string;
  chapterTitles: string[];
};

interface CourseSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: CourseReadinessItem[];
  hasUnsavedChanges: boolean;
  isSubmitting: boolean;
  aiContext: CourseAiContext;
  /** Saves the Details tab. Resolves false when something needs fixing there. */
  onSaveDetails: () => Promise<boolean>;
  /** Puts a description into the Details tab without saving it. */
  onUseDescription: (html: string) => void;
  /** Closes the dialog and takes the teacher to the missing piece. */
  onFix: (key: CourseReadinessKey) => void;
  onSubmit: () => void;
}

const FIX_LABELS: Record<CourseReadinessKey, string> = {
  lessons: 'Add lessons',
  cover: 'Add a cover',
  description: 'Write it',
};

type Step = 'save' | 'description' | 'missing';

const aiErrorMessage = (error: unknown) =>
  error instanceof AiRewriteError && error.code === 'OUT_OF_CREDITS'
    ? 'AI writing is not available right now. Write the description yourself for now.'
    : 'AI could not write a description this time. Try again, or write it yourself.';

/*
 * What Submit for review opens when the course is not ready to go straight
 * to the review queue. A missing description gets its own step: AI drafts one
 * from the title and chapters, the teacher reads it, and one button saves it
 * and submits the course.
 */
export const CourseSubmitDialog: React.FC<CourseSubmitDialogProps> = ({
  open,
  onOpenChange,
  readiness,
  hasUnsavedChanges,
  isSubmitting,
  aiContext,
  onSaveDetails,
  onUseDescription,
  onFix,
  onSubmit,
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Held while saving, so the dialog does not jump to another step the moment
  // the new description makes the checklist complete.
  const [lockedStep, setLockedStep] = useState<Step | null>(null);
  const aiMutation = useMutation({ mutationFn: postTeacherAIRewrite });

  useEffect(() => {
    if (open) return;
    setDraft(null);
    setLockedStep(null);
    aiMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const missing = readiness.filter((item) => !item.done);
  const liveStep: Step =
    missing.length === 0 ? 'save' : missing.length === 1 && missing[0].key === 'description' ? 'description' : 'missing';
  const step = lockedStep ?? liveStep;
  const isBusy = isSaving || isSubmitting || aiMutation.isPending;

  const writeWithAi = () => {
    setDraft(null);
    aiMutation.mutate(
      {
        field: 'description',
        contentType: 'course',
        currentValue: '',
        context: {
          title: aiContext.title,
          category: aiContext.category || undefined,
          level: aiContext.level || undefined,
          language: aiContext.language || undefined,
          examName: aiContext.examName || undefined,
          subjects: aiContext.chapterTitles.length > 0 ? aiContext.chapterTitles.slice(0, 30) : undefined,
        },
      },
      { onSuccess: (data) => setDraft(sanitizeHtml(data.suggestion)) }
    );
  };

  const saveAndSubmit = async (description?: string) => {
    setLockedStep(step);
    if (description) onUseDescription(description);
    setIsSaving(true);
    // Let the Details form take the new description before it saves.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const saved = await onSaveDetails();
    setIsSaving(false);
    if (saved) onSubmit();
    else setLockedStep(null);
  };

  const editFirst = () => {
    if (draft) onUseDescription(draft);
    onFix('description');
  };

  const guardedOpenChange = (next: boolean) => {
    if (!next && isBusy) return;
    onOpenChange(next);
  };

  let body: React.ReactNode;
  let footer: React.ReactNode;
  let title: string;
  let description: React.ReactNode = null;

  if (step === 'save') {
    title = 'Save your changes and submit?';
    description = 'Your unsaved edits in Details are saved first. Then the course goes to our team for review.';
    body = null;
    footer = (
      <>
        <Button variant="outline" onClick={() => guardedOpenChange(false)} disabled={isBusy}>
          Keep editing
        </Button>
        <Button onClick={() => void saveAndSubmit()} disabled={isBusy}>
          {isBusy ? <Spinner size="sm" /> : <Send size={16} />}
          {isSaving ? 'Saving...' : isSubmitting ? 'Submitting...' : 'Save and submit'}
        </Button>
      </>
    );
  } else if (step === 'description') {
    title = 'Add a description to submit';
    description =
      'Students read it before they enrol. AI can draft one from your course title and chapters, and you can change it any time.';

    if (aiMutation.isPending) {
      body = (
        <div className={styles.writing} role="status">
          <Spinner size="md" />
          <p>Writing a description for {aiContext.title ? <strong>{aiContext.title}</strong> : 'your course'}...</p>
        </div>
      );
      footer = (
        <Button variant="outline" disabled>
          Please wait
        </Button>
      );
    } else if (draft && hasCourseDescription(draft)) {
      body = (
        <div className={styles.draftBlock}>
          <p className={styles.draftLabel}>AI draft</p>
          <div className={styles.draft} dangerouslySetInnerHTML={{ __html: draft }} />
          {hasUnsavedChanges ? (
            <p className={styles.note}>Your other unsaved edits in Details are saved with it.</p>
          ) : null}
        </div>
      );
      footer = (
        <>
          <Button variant="ghost" onClick={writeWithAi} disabled={isBusy} className={styles.footerStart}>
            <RotateCcw size={16} /> Try again
          </Button>
          <Button variant="outline" onClick={editFirst} disabled={isBusy}>
            <PenLine size={16} /> Edit it first
          </Button>
          <Button onClick={() => void saveAndSubmit(draft)} disabled={isBusy}>
            {isSaving || isSubmitting ? <Spinner size="sm" /> : <Send size={16} />}
            {isSaving ? 'Saving...' : isSubmitting ? 'Submitting...' : 'Use it and submit'}
          </Button>
        </>
      );
    } else {
      body = aiMutation.isError || (draft !== null && !hasCourseDescription(draft)) ? (
        <p className={styles.error} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {aiMutation.isError ? aiErrorMessage(aiMutation.error) : 'The AI draft came back empty. Try again, or write it yourself.'}
        </p>
      ) : null;
      footer = (
        <>
          <Button variant="outline" onClick={() => onFix('description')} disabled={isBusy}>
            <PenLine size={16} /> Write it myself
          </Button>
          <Button onClick={writeWithAi} disabled={isBusy}>
            <Sparkles size={16} /> {aiMutation.isError ? 'Try AI again' : 'Write it with AI'}
          </Button>
        </>
      );
    }
  } else {
    title = 'A few things are missing';
    description = 'Add these, then submit again. Everything you have done so far is kept.';
    body = (
      <ul className={styles.checklist}>
        {readiness.map((item) => (
          <li key={item.key} className={item.done ? styles.done : styles.todo}>
            {item.done ? (
              <CheckCircle2 size={18} aria-label="Done" role="img" />
            ) : (
              <Circle size={18} aria-label="To do" role="img" />
            )}
            <span className={styles.itemLabel}>{item.label}</span>
            {!item.done ? (
              <Button variant="outline" size="sm" onClick={() => onFix(item.key)}>
                {FIX_LABELS[item.key]}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    );
    footer = (
      <Button variant="outline" onClick={() => guardedOpenChange(false)}>
        Close
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={title} description={description} hideClose={isBusy} />
        {body ? <ConsoleDialogBody>{body}</ConsoleDialogBody> : null}
        <ConsoleDialogFooter className={styles.footer}>{footer}</ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};
