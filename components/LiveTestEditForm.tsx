import React from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { useForm, Form } from './Form';
import { Button } from './Button';
import { LiveTestStepIndicator } from './LiveTestStepIndicator';
import { LiveTestBasicInfoStep } from './LiveTestBasicInfoStep';
import { LiveTestScheduleStep } from './LiveTestScheduleStep';
import { LiveTestPrizesStep } from './LiveTestPrizesStep';
import { LiveTestReviewStep } from './LiveTestReviewStep';
import { useTeacherLiveTestMutations } from '../helpers/useTeacherLiveTestMutations';
import { liveTestCreationFormSchema } from '../helpers/liveTestCreationFormSchema';
import { LIVE_TEST_PUBLISHED_LOCKED_FIELDS } from '../helpers/liveTestLocks';
import {
  LIVE_TEST_FORM_FIELDS,
  LIVE_TEST_STEPS,
  type LiveTestEditableStep,
  type LiveTestStep,
  buildLiveTestChanges,
  buildLiveTestEditValues,
  findLiveTestIssues,
  focusFirstFormError,
} from '../helpers/liveTestFormValues';
import type { OutputType as LiveTestDetails } from '../endpoints/teacher/live-test/details_GET.schema';
import type { InputType as UpdateLiveTestInput } from '../endpoints/teacher/live-tests/update_POST.schema';
import styles from './LiveTestCreationForm.module.css';

interface LiveTestEditFormProps {
  liveTest: LiveTestDetails;
  className?: string;
}

const LOCKED_STEPS: LiveTestEditableStep[] = ['schedule', 'prizes'];
const LOCKED_FIELDS: string[] = [...LIVE_TEST_PUBLISHED_LOCKED_FIELDS];

export const LiveTestEditForm: React.FC<LiveTestEditFormProps> = ({ liveTest, className }) => {
  const [step, setStep] = React.useState<LiveTestStep>('info');
  const [storefrontOpen, setStorefrontOpen] = React.useState(false);
  const [focusRequest, setFocusRequest] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { useUpdateLiveTestMutation } = useTeacherLiveTestMutations();
  const updateLiveTest = useUpdateLiveTestMutation();
  const isPublished = liveTest.isActive;

  // Seeded once. The page only mounts this with details fetched after it opened,
  // and a later background refetch must not overwrite what the teacher is typing.
  const [initialValues] = React.useState(() => buildLiveTestEditValues(liveTest));
  const [savedValues, setSavedValues] = React.useState(initialValues);
  const form = useForm({ schema: liveTestCreationFormSchema, defaultValues: initialValues });
  const { setValues, values } = form;

  const changes = React.useMemo(
    () => buildLiveTestChanges(savedValues, values, isPublished),
    [savedValues, values, isPublished]
  );
  const hasChanges = Object.keys(changes).length > 0;
  const stepIndex = LIVE_TEST_STEPS.indexOf(step);

  React.useEffect(() => {
    if (focusRequest === 0 || focusFirstFormError(containerRef.current)) return;
    const frame = requestAnimationFrame(() => focusFirstFormError(containerRef.current));
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const goToStep = (next: LiveTestStep, section?: 'storefront') => {
    setStep(next);
    if (section === 'storefront') setStorefrontOpen(true);
  };

  const handleSave = () => {
    const editableFields = isPublished
      ? LIVE_TEST_FORM_FIELDS.filter((field) => !LOCKED_FIELDS.includes(field))
      : LIVE_TEST_FORM_FIELDS;
    editableFields.forEach((field) => form.validateField(field));

    const [firstIssue] = findLiveTestIssues(values, { isPublished });
    if (firstIssue) {
      goToStep(firstIssue.step, firstIssue.storefront ? 'storefront' : undefined);
      setFocusRequest((n) => n + 1);
      toast.error(firstIssue.message);
      return;
    }
    if (!hasChanges) return;

    const submitted = values;
    updateLiveTest.mutate({ id: liveTest.id, ...changes } as UpdateLiveTestInput, {
      onSuccess: () => setSavedValues(submitted),
    });
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
      <LiveTestStepIndicator
        currentStep={step}
        onStepSelect={goToStep}
        lockedSteps={isPublished ? LOCKED_STEPS : []}
      />
      {isPublished && (
        <div className={styles.publishedNotice}>
          <Lock size={14} />
          <span>
            Published, so the schedule, seats, exam, format, pricing and prizes are locked. Title, description,
            language, media and storefront details can still be edited.
          </span>
        </div>
      )}
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
              disabled={isPublished}
              storefrontOpen={storefrontOpen}
              onStorefrontOpenChange={setStorefrontOpen}
            />
          )}
          {step === 'schedule' && <LiveTestScheduleStep values={values} setValues={setValues} disabled={isPublished} />}
          {step === 'prizes' && <LiveTestPrizesStep values={values} setValues={setValues} disabled={isPublished} />}
          {step === 'review' && (
            <LiveTestReviewStep
              values={values}
              onEditStep={goToStep}
              mode="edit"
              lockedSteps={isPublished ? LOCKED_STEPS : []}
              lockedFields={isPublished ? LOCKED_FIELDS : []}
            />
          )}
          <div className={styles.footer}>
            <div className={styles.footerGroup}>
              {stepIndex > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(LIVE_TEST_STEPS[stepIndex - 1])}>
                  Back
                </Button>
              )}
            </div>
            <div className={styles.footerGroup}>
              {!hasChanges && !updateLiveTest.isPending && (
                <span className={styles.saveStatus}>No unsaved changes</span>
              )}
              {step !== 'review' && (
                <Button type="button" variant="outline" onClick={() => setStep(LIVE_TEST_STEPS[stepIndex + 1])}>
                  Next
                </Button>
              )}
              <Button type="button" onClick={handleSave} disabled={updateLiveTest.isPending || !hasChanges}>
                {updateLiveTest.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
