import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useForm, Form } from './Form';
import { Button } from './Button';
import { LiveTestStepIndicator } from './LiveTestStepIndicator';
import { LiveTestBasicInfoStep } from './LiveTestBasicInfoStep';
import { LiveTestScheduleStep } from './LiveTestScheduleStep';
import { LiveTestPrizesStep } from './LiveTestPrizesStep';
import { LiveTestReviewStep } from './LiveTestReviewStep';
import { useTeacherLiveTestMutations } from '../helpers/useTeacherLiveTestMutations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './Dialog';
import { liveTestCreationFormSchema } from '../helpers/liveTestCreationFormSchema';
import {
  LIVE_TEST_FORM_FIELDS,
  LIVE_TEST_STEPS,
  type LiveTestFieldIssue,
  type LiveTestFormField,
  type LiveTestStep,
  findLiveTestIssues,
  focusFirstFormError,
  getLiveTestFieldsForSteps,
  normalizeLiveTestFormValues,
} from '../helpers/liveTestFormValues';
import type { InputType as CreateLiveTestInput } from '../endpoints/teacher/live-tests/create_POST.schema';
import styles from './LiveTestCreationForm.module.css';

interface LiveTestCreationFormProps {
  className?: string;
  initialValues?: {
    title?: string;
    description?: string;
    examName?: string;
    language?: string;
    price?: number;
    durationMinutes?: number;
  } | null;
}

const EMPTY_LIST: string[] = [];

export const LiveTestCreationForm: React.FC<LiveTestCreationFormProps> = ({ className, initialValues }) => {
  const [step, setStep] = useState<LiveTestStep>('info');
  const [storefrontOpen, setStorefrontOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { useCreateLiveTestMutation } = useTeacherLiveTestMutations();
  const createLiveTest = useCreateLiveTestMutation();

  const form = useForm({
    schema: liveTestCreationFormSchema,
    defaultValues: {
      title: initialValues?.title || '',
      description: initialValues?.description || null,
      examName: initialValues?.examName || null,
      language: initialValues?.language || undefined,
      durationMinutes: initialValues?.durationMinutes || 60,
      calculatorEnabled: false,
      subjectWiseTiming: false,
      questionWiseTiming: false,
      price: initialValues?.price || 0,
      discountPrice: null,
      isFree: false,
      whatYouLearn: EMPTY_LIST,
      requirements: EMPTY_LIST,
      maxSeats: 100,
      thumbnailUrl: null,
      thumbnailFileId: null,
      introVideoUrl: null,
      introVideoFileId: null,
      registrationDeadline: null,
      startTime: null,
      endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
      hasPrizes: false,
      prizeTiers: [],
    },
  });

  const { setValues, values } = form;
  const stepIndex = LIVE_TEST_STEPS.indexOf(step);

  useEffect(() => {
    if (focusRequest === 0 || focusFirstFormError(containerRef.current)) return;
    const frame = requestAnimationFrame(() => focusFirstFormError(containerRef.current));
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  // Shows the errors for `fields`, then moves to the step holding the first
  // issue (opening Storefront when it lives there), focuses it and names it.
  const revealIssues = (issues: LiveTestFieldIssue[], fields: LiveTestFormField[]) => {
    fields.forEach((field) => form.validateField(field));
    const [first] = issues;
    if (!first) return;
    setStep(first.step);
    if (first.storefront) setStorefrontOpen(true);
    setFocusRequest((n) => n + 1);
    toast.error(first.message);
  };

  const handleNext = () => {
    if (step === 'review') return;
    const stepFields = getLiveTestFieldsForSteps([step]);
    const issues = findLiveTestIssues(values, { steps: [step] });
    revealIssues(issues, stepFields);
    if (issues.length === 0) setStep(LIVE_TEST_STEPS[stepIndex + 1]);
  };

  const handleCreateClick = () => {
    const issues = findLiveTestIssues(values);
    revealIssues(issues, LIVE_TEST_FORM_FIELDS);
    if (issues.length === 0) setIsCreateDialogOpen(true);
  };

  // Only the dialog's own "Confirm & Create" click creates the live test; the
  // footer button shares a screen position with "Next", which made accidental
  // creation too easy.
  const handleConfirmCreate = () => {
    setIsCreateDialogOpen(false);
    const issues = findLiveTestIssues(values);
    if (issues.length > 0) {
      revealIssues(issues, LIVE_TEST_FORM_FIELDS);
      return;
    }
    const data = normalizeLiveTestFormValues(values);
    const payload: CreateLiveTestInput = {
      ...data,
      language: data.language ?? null,
      calculatorEnabled: data.calculatorEnabled ?? false,
      subjectWiseTiming: data.subjectWiseTiming ?? false,
      questionWiseTiming: data.questionWiseTiming ?? false,
      isFree: data.isFree ?? false,
      hasPrizes: data.hasPrizes ?? false,
      prizeTiers: data.prizeTiers ?? [],
    };
    createLiveTest.mutate(payload, {
      onSuccess: (result) => navigate(`/teacher/live-test/${result.id}/questions`),
    });
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
      <LiveTestStepIndicator currentStep={step} />
      <Form {...form}>
        <form
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            // One <form> wraps every step, so Enter in a field must not submit it.
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
          className={styles.form}
        >
          {step === 'info' && (
            <LiveTestBasicInfoStep
              values={values}
              setValues={setValues}
              storefrontOpen={storefrontOpen}
              onStorefrontOpenChange={setStorefrontOpen}
            />
          )}
          {step === 'schedule' && <LiveTestScheduleStep values={values} setValues={setValues} />}
          {step === 'prizes' && <LiveTestPrizesStep values={values} setValues={setValues} />}
          {step === 'review' && <LiveTestReviewStep values={values} onEditStep={(target, section) => {
            setStep(target);
            if (section === 'storefront') setStorefrontOpen(true);
          }} />}
          <div className={styles.footer}>
            <div className={styles.footerGroup}>
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(LIVE_TEST_STEPS[stepIndex - 1])}>
                  Back
                </Button>
              )}
            </div>
            <div className={styles.footerGroup}>
              {step !== 'review' ? (
                <Button type="button" onClick={handleNext}>Next</Button>
              ) : (
                <Button type="button" disabled={createLiveTest.isPending} onClick={handleCreateClick}>
                  {createLiveTest.isPending ? 'Creating...' : 'Create Live Test'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Live Test?</DialogTitle>
            <DialogDescription>
              This creates your live test as a draft and takes you straight to the question manager. It won&apos;t be
              visible to students until you add questions and publish it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleConfirmCreate} disabled={createLiveTest.isPending}>
              {createLiveTest.isPending ? 'Creating...' : 'Confirm & Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
