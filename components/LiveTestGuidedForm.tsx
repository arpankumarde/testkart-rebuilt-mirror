import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Lock, Plus, X } from 'lucide-react';
import { useForm, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './Form';
import { Input } from './Input';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { DatePicker } from './DatePicker';
import { RichTextEditor } from './RichTextEditor';
import { ExamMultiPicker } from './ExamMultiPicker';
import { LanguageMultiPicker } from './LanguageMultiPicker';
import { ThumbnailUploader } from './ThumbnailUploader';
import { VideoUploader } from './VideoUploader';
import { AIRewriteButton } from './AIRewriteButton';
import { AIListGenerateButton } from './AIListGenerateButton';
import { LiveTestPrizesStep } from './LiveTestPrizesStep';
import { TeacherFoldedPanel } from './TeacherFoldedPanel';
import { TeacherFlowTop } from './TeacherFlowTop';
import type { TeacherFlowStep } from './TeacherFlowSteps';
import { useTeacherLiveTestMutations } from '../helpers/useTeacherLiveTestMutations';
import { liveTestCreationFormSchema, type LiveTestFormValues } from '../helpers/liveTestCreationFormSchema';
import { isLiveTestFieldLocked } from '../helpers/liveTestLocks';
import {
  LIVE_TEST_FORM_FIELDS,
  type LiveTestFormField,
  buildLiveTestChanges,
  buildLiveTestEditValues,
  findLiveTestIssues,
  focusFirstFormError,
} from '../helpers/liveTestFormValues';
import type { OutputType as LiveTestDetails } from '../endpoints/teacher/live-test/details_GET.schema';
import type { InputType as UpdateLiveTestInput } from '../endpoints/teacher/live-tests/update_POST.schema';
import styles from './LiveTestGuidedForm.module.css';

export type LiveTestFlowStep = 'questions' | 'details' | 'publish';

const FLOW_ORDER: LiveTestFlowStep[] = ['questions', 'details', 'publish'];
const FLOW_META = {
  questions: { label: 'Questions', hint: 'Build the paper', tone: 'butter' },
  details: { label: 'Details', hint: 'Time, price and seats', tone: 'lavender' },
  publish: { label: 'Publish', hint: 'Check and go live', tone: 'peach' },
} as const;

/** The questions page opens its publish confirmation when it gets this. */
export const liveTestPublishPath = (liveTestId: number) => `/teacher/live-test/${liveTestId}/questions?publish=1`;

/*
 * Go back and the live test step track: Questions, Details, Publish. Once the
 * test exists each step links to its page. The publish confirmation lives on
 * the questions page, so there Publish runs `onPublish`, and elsewhere it links
 * to liveTestPublishPath. `submitted` (live or in review) marks every other
 * step done.
 */
export const LiveTestSteps = ({
  current,
  liveTestId,
  submitted = false,
  back,
  onPublish,
}: {
  current: LiveTestFlowStep;
  liveTestId?: number | null;
  submitted?: boolean;
  back: string | (() => void);
  onPublish?: () => void;
}) => {
  const currentIndex = FLOW_ORDER.indexOf(current);
  const pathFor = (key: LiveTestFlowStep): string | null => {
    if (!liveTestId) return null;
    if (key === 'details') return `/teacher/live-test/${liveTestId}/edit`;
    if (key === 'publish') return liveTestPublishPath(liveTestId);
    return `/teacher/live-test/${liveTestId}/questions`;
  };
  const steps: TeacherFlowStep[] = FLOW_ORDER.map((key, index) => {
    const target = pathFor(key);
    const usePublishAction = key === 'publish' && !!onPublish;
    return {
      key,
      ...FLOW_META[key],
      state: index === currentIndex ? 'current' : submitted || index < currentIndex ? 'done' : 'todo',
      href: usePublishAction || target === pathFor(current) ? null : target,
      onSelect: usePublishAction ? onPublish : undefined,
    };
  });
  return <TeacherFlowTop back={back} label="Live test steps" steps={steps} />;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DURATION_PICKS = [30, 60, 90, 120, 180];

// Fields that live inside each folded panel, so an error there opens it.
const RULE_FIELDS: LiveTestFormField[] = [
  'subjectWiseTiming',
  'questionWiseTiming',
  'calculatorEnabled',
  'registrationDeadline',
  'hasPrizes',
  'prizeTiers',
];
const STOREFRONT_FIELDS: LiveTestFormField[] = [
  'description',
  'thumbnailUrl',
  'thumbnailFileId',
  'introVideoUrl',
  'introVideoFileId',
  'whatYouLearn',
  'requirements',
];

const formatWindow = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

const formatMoment = (date: Date): string =>
  date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const ListField = ({
  name,
  label,
  placeholder,
  items,
  onChange,
  generate,
}: {
  name: string;
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  generate: React.ReactNode;
}) => (
  <FormItem name={name}>
    <div className={styles.labelRow}>
      <FormLabel>{label}</FormLabel>
      {generate}
    </div>
    <div className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.listRow}>
          <FormControl>
            <Input
              placeholder={placeholder}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
          </FormControl>
          <Button
            type="button"
            variant="ghost"
            size="icon-md"
            aria-label="Remove item"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X size={16} />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className={styles.listAdd} onClick={() => onChange([...items, ''])}>
        <Plus size={16} /> Add item
      </Button>
    </div>
    <FormDescription>Leave empty to hide this on the test page.</FormDescription>
    <FormMessage />
  </FormItem>
);

interface LiveTestGuidedFormProps {
  liveTest: LiveTestDetails;
  /** Shown under the step track, e.g. the rejection note. */
  intro?: React.ReactNode;
}

/*
 * The Details step of a live test, after its questions: basics, when it runs,
 * and price and seats, with rules and prizes and the storefront extras folded
 * below. The test is created on pages/teacher.create-live-test with draft
 * defaults, so this always edits. It saves only what changed, and a published
 * test keeps its committed fields locked (helpers/liveTestLocks.tsx, which the
 * update endpoint enforces too). Before submitting, the main action saves and
 * moves on to Publish.
 */
export const LiveTestGuidedForm = ({ liveTest, intro }: LiveTestGuidedFormProps) => {
  const isPublished = !!liveTest.isActive;
  const isSubmitted = !!(liveTest.isActive || liveTest.inReview);
  const questionsPath = `/teacher/live-test/${liveTest.id}/questions`;
  const navigate = useNavigate();
  const { useUpdateLiveTestMutation } = useTeacherLiveTestMutations();
  const updateLiveTest = useUpdateLiveTestMutation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // Seeded once, so a background refetch never overwrites what the teacher is typing.
  const [initial] = useState<LiveTestFormValues>(() => buildLiveTestEditValues(liveTest));
  const [savedValues, setSavedValues] = useState(initial);
  const form = useForm({ schema: liveTestCreationFormSchema, defaultValues: initial });
  const { values, setValues } = form;
  const locked = (field: LiveTestFormField) => isLiveTestFieldLocked(field, isPublished);

  const [rulesOpen, setRulesOpen] = useState(
    () => !!(initial.calculatorEnabled || initial.subjectWiseTiming || initial.questionWiseTiming || initial.registrationDeadline || initial.hasPrizes)
  );
  const [storefrontOpen, setStorefrontOpen] = useState(
    () =>
      !!(
        initial.thumbnailUrl ||
        initial.introVideoUrl ||
        (initial.whatYouLearn ?? []).some((v) => v.trim()) ||
        (initial.requirements ?? []).some((v) => v.trim())
      )
  );

  const changes = useMemo(
    () => buildLiveTestChanges(savedValues, values, isPublished),
    [savedValues, values, isPublished]
  );
  const hasChanges = Object.keys(changes).length > 0;
  const isPending = updateLiveTest.isPending;

  useEffect(() => {
    if (focusRequest === 0 || focusFirstFormError(containerRef.current)) return;
    const frame = requestAnimationFrame(() => focusFirstFormError(containerRef.current));
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  // Shows every error, opens the panel holding the first one, focuses it and names it.
  const checkValues = (): boolean => {
    LIVE_TEST_FORM_FIELDS.filter((field) => !locked(field)).forEach((field) => form.validateField(field));
    const [first] = findLiveTestIssues(values, { isPublished });
    if (!first) return true;
    if (RULE_FIELDS.includes(first.field)) setRulesOpen(true);
    if (STOREFRONT_FIELDS.includes(first.field)) setStorefrontOpen(true);
    setFocusRequest((n) => n + 1);
    toast.error(first.message);
    return false;
  };

  // Before submitting, the main action also moves on to Publish; a saved form goes straight there.
  const handleSave = () => {
    const continueToPublish = !isSubmitted;
    if (!checkValues()) return;
    if (!hasChanges) {
      if (continueToPublish) navigate(liveTestPublishPath(liveTest.id));
      return;
    }
    const submitted = values;
    updateLiveTest.mutate({ id: liveTest.id, ...changes } as UpdateLiveTestInput, {
      onSuccess: () => {
        setSavedValues(submitted);
        if (continueToPublish) navigate(liveTestPublishPath(liveTest.id));
      },
    });
  };

  const languageText = values.languages?.join(', ') || undefined;
  const aiContext = {
    examName: values.examName || undefined,
    language: languageText,
    duration: values.durationMinutes,
    price: values.price,
  };

  const timerMode = values.subjectWiseTiming ? 'subject' : values.questionWiseTiming ? 'question' : 'whole';
  const setTimerMode = (mode: 'whole' | 'subject' | 'question') =>
    setValues((p) => ({
      ...p,
      subjectWiseTiming: mode === 'subject',
      questionWiseTiming: mode === 'question',
      durationMinutes: mode === 'whole' && !p.durationMinutes ? 60 : p.durationMinutes,
    }));

  const hasStart = values.startTime !== null && values.startTime !== undefined;
  const setFixedStart = (fixed: boolean) =>
    setValues((p) => {
      if (!fixed) return { ...p, startTime: null };
      const start = new Date(Date.now() + DAY);
      start.setMinutes(0, 0, 0);
      const endTime =
        p.endTime && p.endTime.getTime() > start.getTime()
          ? p.endTime
          : new Date(start.getTime() + Math.max(p.durationMinutes || 60, 60) * 60000);
      return { ...p, startTime: start, endTime };
    });

  const startPicks: { label: string; at: () => Date }[] = [
    { label: 'In 1 hour', at: () => new Date(Date.now() + HOUR) },
    {
      label: 'Tomorrow, 9:00 AM',
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Tomorrow, 6:00 PM',
      at: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(18, 0, 0, 0);
        return d;
      },
    },
  ];
  const endPicks = hasStart
    ? [
        { label: '+1 hour', ms: HOUR },
        { label: '+2 hours', ms: 2 * HOUR },
        { label: '+1 day', ms: DAY },
      ]
    : [
        { label: 'In 1 day', ms: DAY },
        { label: 'In 3 days', ms: 3 * DAY },
        { label: 'In 7 days', ms: 7 * DAY },
      ];

  const windowMs = values.startTime && values.endTime ? values.endTime.getTime() - values.startTime.getTime() : null;
  const windowInvalid = windowMs !== null && windowMs <= 0;
  const hasDeadline = values.registrationDeadline !== null && values.registrationDeadline !== undefined;

  const setFree = (isFree: boolean) =>
    setValues((p) => ({
      ...p,
      isFree,
      price: isFree ? 0 : p.price,
      discountPrice: isFree ? null : p.discountPrice,
    }));

  return (
    <div ref={containerRef} className={styles.container}>
      <LiveTestSteps
        current="details"
        liveTestId={liveTest.id}
        submitted={isSubmitted}
        back={questionsPath}
      />

      {intro}

      {isPublished && (
        <div className={styles.lockNote} role="note">
          <Lock size={16} aria-hidden="true" />
          <span>
            This live test is live, so its exam, timing, price, seats, schedule and prizes are locked. The title,
            languages and storefront details can still change.
          </span>
        </div>
      )}

      <Form {...form}>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          onKeyDown={(e) => {
            // Enter in a text field must not create or save the test.
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
          }}
        >
          <section className={styles.card} aria-labelledby="live-basics-title">
            <div className={styles.cardHead}>
              <span className={`${styles.marker} ${styles.markerLavender}`} aria-hidden="true" />
              <div className={styles.cardHeadText}>
                <h2 id="live-basics-title" className={styles.cardTitle}>Basics</h2>
                <span className={styles.cardHint}>What students see when they browse.</span>
              </div>
            </div>

            <FormItem name="title">
              <div className={styles.labelRow}>
                <FormLabel>Title</FormLabel>
                <AIRewriteButton
                  field="title"
                  contentType="liveTest"
                  currentValue={values.title}
                  context={aiContext}
                  onAccept={(suggestion) => setValues((p) => ({ ...p, title: suggestion }))}
                />
              </div>
              <FormControl>
                <Input
                  value={values.title}
                  onChange={(e) => setValues((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., SSC CGL Sunday Live Mock"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.row}>
              <FormItem name="examNames">
                <FormLabel>Exams</FormLabel>
                <FormControl>
                  <ExamMultiPicker
                    value={values.examNames ?? []}
                    onChange={(names) => setValues((p) => ({ ...p, examNames: names, examName: names[0] ?? null }))}
                    disabled={locked('examNames')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="languages">
                <FormLabel>Languages</FormLabel>
                <FormControl>
                  <LanguageMultiPicker
                    value={values.languages ?? []}
                    onChange={(languages) => setValues((p) => ({ ...p, languages }))}
                    placeholder="e.g., English, Hindi"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="live-when-title">
            <div className={styles.cardHead}>
              <span className={`${styles.marker} ${styles.markerBlue}`} aria-hidden="true" />
              <div className={styles.cardHeadText}>
                <h2 id="live-when-title" className={styles.cardTitle}>When it runs</h2>
                <span className={styles.cardHint}>Times are in your device&apos;s time zone.</span>
              </div>
            </div>

            {timerMode === 'whole' ? (
              <FormItem name="durationMinutes">
                <FormLabel>Test length (minutes)</FormLabel>
                <div className={styles.inlineRow}>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      className={styles.shortInput}
                      value={values.durationMinutes || ''}
                      disabled={locked('durationMinutes')}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, durationMinutes: e.target.value === '' ? 0 : Number(e.target.value) }))
                      }
                    />
                  </FormControl>
                  <div className={styles.picks} aria-label="Quick picks">
                    {DURATION_PICKS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={styles.pick}
                        aria-pressed={values.durationMinutes === mins}
                        disabled={locked('durationMinutes')}
                        onClick={() => setValues((p) => ({ ...p, durationMinutes: mins }))}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            ) : (
              <p className={styles.timerNote}>
                Timed {timerMode === 'subject' ? 'per subject' : 'per question'}: you set the time on each{' '}
                {timerMode === 'subject' ? 'subject' : 'question'} while adding questions.{' '}
                <button type="button" className={styles.textButton} onClick={() => setRulesOpen(true)}>
                  Change
                </button>
              </p>
            )}

            <FormItem name="startTime">
              <FormLabel>Starts</FormLabel>
              <div className={`${styles.choiceGroup} ${styles.choiceBlue}`} role="radiogroup" aria-label="Start">
                <button
                  type="button"
                  role="radio"
                  aria-checked={hasStart}
                  className={styles.choice}
                  disabled={locked('startTime')}
                  onClick={() => !hasStart && setFixedStart(true)}
                >
                  <span className={styles.choiceTitle}>At a set time</span>
                  <span className={styles.choiceHint}>Everyone starts together</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!hasStart}
                  className={styles.choice}
                  disabled={locked('startTime')}
                  onClick={() => hasStart && setFixedStart(false)}
                >
                  <span className={styles.choiceTitle}>Any time</span>
                  <span className={styles.choiceHint}>Students start whenever, until it ends</span>
                </button>
              </div>
              {hasStart && (
                <div className={styles.dateBlock}>
                  <DatePicker
                    disabled={locked('startTime')}
                    value={values.startTime ?? undefined}
                    onChange={(date) => setValues((p) => ({ ...p, startTime: date ?? null }))}
                  />
                  <div className={styles.picks}>
                    {startPicks.map((pick) => (
                      <button
                        key={pick.label}
                        type="button"
                        className={styles.pick}
                        disabled={locked('startTime')}
                        onClick={() => setValues((p) => ({ ...p, startTime: pick.at() }))}
                      >
                        {pick.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <FormMessage />
            </FormItem>

            <FormItem name="endTime">
              <FormLabel>Ends</FormLabel>
              <div className={styles.dateBlock}>
                <DatePicker
                  disabled={locked('endTime')}
                  value={values.endTime ?? undefined}
                  onChange={(date) => {
                    if (date) setValues((p) => ({ ...p, endTime: date }));
                  }}
                />
                <div className={styles.picks}>
                  {endPicks.map((pick) => (
                    <button
                      key={pick.label}
                      type="button"
                      className={styles.pick}
                      disabled={locked('endTime')}
                      onClick={() =>
                        setValues((p) => ({ ...p, endTime: new Date((p.startTime ?? new Date()).getTime() + pick.ms) }))
                      }
                    >
                      {pick.label}
                    </button>
                  ))}
                </div>
              </div>
              <FormDescription>
                {hasStart ? 'Quick picks count from the start time.' : 'After this, nobody can start the test.'}
              </FormDescription>
              <FormMessage />
            </FormItem>

            {values.startTime && values.endTime && (
              <div className={styles.summary} data-warning={windowInvalid}>
                {windowInvalid ? <AlertTriangle size={16} aria-hidden="true" /> : <CalendarClock size={16} aria-hidden="true" />}
                <span>
                  {windowInvalid
                    ? 'The end must be after the start.'
                    : `Open for ${formatWindow(windowMs as number)}: ${formatMoment(values.startTime)} to ${formatMoment(values.endTime)}`}
                </span>
              </div>
            )}
          </section>

          <section className={styles.card} aria-labelledby="live-price-title">
            <div className={styles.cardHead}>
              <span className={`${styles.marker} ${styles.markerMint}`} aria-hidden="true" />
              <div className={styles.cardHeadText}>
                <h2 id="live-price-title" className={styles.cardTitle}>Price and seats</h2>
                <span className={styles.cardHint}>
                  {isPublished ? 'Locked while the test is live.' : 'You can change this until you publish.'}
                </span>
              </div>
            </div>

            <FormItem name="isFree">
              <div className={`${styles.choiceGroup} ${styles.choiceMint}`} role="radiogroup" aria-label="Pricing">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!values.isFree}
                  className={styles.choice}
                  disabled={locked('isFree')}
                  onClick={() => setFree(false)}
                >
                  <span className={styles.choiceTitle}>Paid</span>
                  <span className={styles.choiceHint}>Students pay to take part</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!!values.isFree}
                  className={styles.choice}
                  disabled={locked('isFree')}
                  onClick={() => setFree(true)}
                >
                  <span className={styles.choiceTitle}>Free</span>
                  <span className={styles.choiceHint}>Good for building an audience</span>
                </button>
              </div>
              <FormMessage />
            </FormItem>

            {!values.isFree && (
              <div className={styles.row}>
                <FormItem name="price">
                  <FormLabel>Price (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 49"
                      value={values.price || ''}
                      disabled={locked('price')}
                      onChange={(e) => setValues((p) => ({ ...p, price: e.target.value === '' ? 0 : Number(e.target.value) }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="discountPrice">
                  <FormLabel>Discounted price (₹)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={values.discountPrice ?? ''}
                      disabled={locked('discountPrice')}
                      onChange={(e) =>
                        setValues((p) => ({ ...p, discountPrice: e.target.value === '' ? null : Number(e.target.value) }))
                      }
                    />
                  </FormControl>
                  <FormDescription>Must be lower than the price.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            )}

            <FormItem name="maxSeats">
              <FormLabel>Seats</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  className={styles.shortInput}
                  value={values.maxSeats || ''}
                  disabled={locked('maxSeats')}
                  onChange={(e) => setValues((p) => ({ ...p, maxSeats: e.target.value === '' ? 0 : Number(e.target.value) }))}
                />
              </FormControl>
              <FormDescription>The most students who can take part.</FormDescription>
              <FormMessage />
            </FormItem>
          </section>

          <TeacherFoldedPanel
            title="Rules and prizes"
            hint="Timer, calculator, registration deadline and prize money. Optional."
            open={rulesOpen}
            onOpenChange={setRulesOpen}
          >
            <FormItem name="subjectWiseTiming">
              <FormLabel>Timer</FormLabel>
              <div className={styles.picks} role="radiogroup" aria-label="Timer">
                {[
                  { mode: 'whole' as const, label: 'Whole test' },
                  { mode: 'subject' as const, label: 'Per subject' },
                  { mode: 'question' as const, label: 'Per question' },
                ].map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={timerMode === option.mode}
                    className={styles.pick}
                    disabled={locked('subjectWiseTiming')}
                    onClick={() => setTimerMode(option.mode)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <FormDescription>Most tests use one timer for the whole test.</FormDescription>
              <FormMessage />
            </FormItem>

            <FormItem name="calculatorEnabled">
              <label className={styles.checkRow}>
                <Checkbox
                  checked={!!values.calculatorEnabled}
                  disabled={locked('calculatorEnabled')}
                  onChange={(e) => setValues((p) => ({ ...p, calculatorEnabled: e.target.checked }))}
                />
                <span>Allow a scientific calculator</span>
              </label>
              <FormMessage />
            </FormItem>

            <FormItem name="registrationDeadline">
              <label className={styles.checkRow}>
                <Checkbox
                  checked={hasDeadline}
                  disabled={locked('registrationDeadline')}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      setValues((p) => ({ ...p, registrationDeadline: null }));
                      return;
                    }
                    setValues((p) => ({
                      ...p,
                      registrationDeadline: p.startTime
                        ? new Date(p.startTime.getTime() - DAY)
                        : new Date(Date.now() + DAY),
                    }));
                  }}
                />
                <span>Close registration early</span>
              </label>
              {hasDeadline ? (
                <div className={styles.dateBlock}>
                  <DatePicker
                    disabled={locked('registrationDeadline')}
                    value={values.registrationDeadline ?? undefined}
                    onChange={(date) => setValues((p) => ({ ...p, registrationDeadline: date ?? null }))}
                  />
                  {hasStart && (
                    <div className={styles.picks}>
                      {[
                        { label: '1 day before start', ms: DAY },
                        { label: '1 hour before start', ms: HOUR },
                      ].map((pick) => (
                        <button
                          key={pick.label}
                          type="button"
                          className={styles.pick}
                          disabled={locked('registrationDeadline')}
                          onClick={() =>
                            setValues((p) => ({
                              ...p,
                              registrationDeadline: p.startTime ? new Date(p.startTime.getTime() - pick.ms) : p.registrationDeadline,
                            }))
                          }
                        >
                          {pick.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <FormDescription>Off: students can register until the test starts.</FormDescription>
              )}
              <FormMessage />
            </FormItem>

            <div className={styles.subBlock}>
              <LiveTestPrizesStep values={values} setValues={setValues} disabled={locked('hasPrizes')} />
            </div>
          </TeacherFoldedPanel>

          <TeacherFoldedPanel
            title="Storefront details"
            hint="Description, thumbnail, intro video and highlights. Optional, editable any time."
            open={storefrontOpen}
            onOpenChange={setStorefrontOpen}
          >
            <FormItem name="description">
              <div className={styles.labelRow}>
                <FormLabel>Description</FormLabel>
                <AIRewriteButton
                  field="description"
                  contentType="liveTest"
                  currentValue={values.description ?? ''}
                  context={{ ...aiContext, title: values.title }}
                  onAccept={(suggestion) => setValues((p) => ({ ...p, description: suggestion }))}
                />
              </div>
              <FormControl>
                <RichTextEditor
                  value={values.description ?? ''}
                  onChange={(html) => setValues((p) => ({ ...p, description: html }))}
                  placeholder="What the test covers and how it works"
                  disableMediaUpload
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="thumbnailUrl">
              <FormLabel>Thumbnail</FormLabel>
              <FormControl>
                <ThumbnailUploader
                  value={values.thumbnailUrl ?? ''}
                  currentFileId={values.thumbnailFileId ?? undefined}
                  onChange={(url, fileId) =>
                    setValues((p) => ({ ...p, thumbnailUrl: url || null, thumbnailFileId: url ? fileId ?? null : null }))
                  }
                  folder="thumbnails/live-tests"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="introVideoUrl">
              <FormLabel>Intro video</FormLabel>
              <FormControl>
                <VideoUploader
                  folder="live-test-videos"
                  onSuccess={({ url, videoFileId }) =>
                    setValues((p) => ({ ...p, introVideoUrl: url || null, introVideoFileId: url ? videoFileId ?? null : null }))
                  }
                  currentVideoUrl={values.introVideoUrl ?? undefined}
                  currentVideoFileId={values.introVideoFileId ?? undefined}
                  maxSizeInMB={500}
                  label="Upload Intro Video"
                  allowYouTube={true}
                />
              </FormControl>
              <FormDescription>Upload a video or paste a YouTube link.</FormDescription>
              <FormMessage />
            </FormItem>

            <ListField
              name="whatYouLearn"
              label="What students will master"
              placeholder="e.g., Master every topic in the syllabus"
              items={values.whatYouLearn ?? []}
              onChange={(next) => setValues((p) => ({ ...p, whatYouLearn: next }))}
              generate={
                <AIListGenerateButton
                  field="whatYouLearn"
                  context={{
                    title: values.title,
                    examName: values.examName ?? undefined,
                    shortDescription: values.description ?? undefined,
                    existingItems: (values.whatYouLearn || []).filter((v) => v.trim() !== ''),
                  }}
                  onGenerate={(items) =>
                    setValues((p) => ({ ...p, whatYouLearn: [...(p.whatYouLearn || []).filter((v) => v.trim() !== ''), ...items] }))
                  }
                />
              }
            />

            <ListField
              name="requirements"
              label="Requirements"
              placeholder="e.g., Basic understanding of the exam syllabus"
              items={values.requirements ?? []}
              onChange={(next) => setValues((p) => ({ ...p, requirements: next }))}
              generate={
                <AIListGenerateButton
                  field="requirements"
                  context={{
                    title: values.title,
                    examName: values.examName ?? undefined,
                    shortDescription: values.description ?? undefined,
                    existingItems: (values.requirements || []).filter((v) => v.trim() !== ''),
                  }}
                  onGenerate={(items) =>
                    setValues((p) => ({ ...p, requirements: [...(p.requirements || []).filter((v) => v.trim() !== ''), ...items] }))
                  }
                />
              }
            />
          </TeacherFoldedPanel>

          <div className={styles.actions}>
            <p className={styles.actionsNote}>
              {hasChanges ? 'You have unsaved changes.' : isSubmitted ? 'All changes saved.' : 'Nothing goes live until you publish it.'}
            </p>
            <Button asChild variant="outline">
              <Link to={questionsPath}>Back to questions</Link>
            </Button>
            {isSubmitted ? (
              <Button type="submit" disabled={isPending || !hasChanges}>
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : hasChanges ? 'Save and continue' : 'Next: Publish'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
