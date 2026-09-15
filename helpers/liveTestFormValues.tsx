import type { OutputType as LiveTestDetails } from '../endpoints/teacher/live-test/details_GET.schema';
import { liveTestCreationFormSchema, isEmptyRichText, type LiveTestFormValues } from './liveTestCreationFormSchema';
import { resolveLiveTestPrizeTiers, sortPrizeTiers } from './liveTestPrizeTiers';
import { LIVE_TEST_FIELD_LABELS, isLiveTestFieldLocked } from './liveTestLocks';

export type LiveTestStep = 'info' | 'schedule' | 'prizes' | 'review';
export type LiveTestEditableStep = Exclude<LiveTestStep, 'review'>;
export type LiveTestFormField = keyof LiveTestFormValues;

export const LIVE_TEST_STEPS: LiveTestStep[] = ['info', 'schedule', 'prizes', 'review'];

// Every form field in page order, with the step that renders it. Storefront
// fields sit inside the collapsible Storefront section on Basic info.
const FIELD_LAYOUT: { field: LiveTestFormField; step: LiveTestEditableStep; storefront?: boolean }[] = [
  { field: 'title', step: 'info' },
  { field: 'description', step: 'info' },
  { field: 'examName', step: 'info' },
  { field: 'language', step: 'info' },
  { field: 'durationMinutes', step: 'info' },
  { field: 'calculatorEnabled', step: 'info' },
  { field: 'subjectWiseTiming', step: 'info' },
  { field: 'questionWiseTiming', step: 'info' },
  { field: 'price', step: 'info' },
  { field: 'discountPrice', step: 'info' },
  { field: 'maxSeats', step: 'info' },
  { field: 'isFree', step: 'info' },
  { field: 'thumbnailUrl', step: 'info', storefront: true },
  { field: 'thumbnailFileId', step: 'info', storefront: true },
  { field: 'introVideoUrl', step: 'info', storefront: true },
  { field: 'introVideoFileId', step: 'info', storefront: true },
  { field: 'whatYouLearn', step: 'info', storefront: true },
  { field: 'requirements', step: 'info', storefront: true },
  { field: 'registrationDeadline', step: 'schedule' },
  { field: 'startTime', step: 'schedule' },
  { field: 'endTime', step: 'schedule' },
  { field: 'hasPrizes', step: 'prizes' },
  { field: 'prizeTiers', step: 'prizes' },
];

export const LIVE_TEST_FORM_FIELDS: LiveTestFormField[] = FIELD_LAYOUT.map((entry) => entry.field);

export const getLiveTestFieldsForSteps = (steps: LiveTestEditableStep[]): LiveTestFormField[] =>
  FIELD_LAYOUT.filter((entry) => steps.includes(entry.step)).map((entry) => entry.field);

// Fields whose values only make sense together, so an update sends the whole
// group when any member changed and the server validates them as one.
const UPDATE_GROUPS: LiveTestFormField[][] = [
  ['title'],
  ['description'],
  ['examName'],
  ['language'],
  ['durationMinutes', 'subjectWiseTiming', 'questionWiseTiming'],
  ['calculatorEnabled'],
  ['price', 'discountPrice', 'isFree'],
  ['maxSeats'],
  ['thumbnailUrl', 'thumbnailFileId'],
  ['introVideoUrl', 'introVideoFileId'],
  ['whatYouLearn'],
  ['requirements'],
  ['registrationDeadline', 'startTime', 'endTime'],
  ['hasPrizes', 'prizeTiers'],
];

/** Reads a stored jsonb string list that may arrive as an array or as a JSON string. */
export const parseStoredStringList = (value: unknown): string[] => {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
};

const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export const buildLiveTestEditValues = (liveTest: LiveTestDetails): LiveTestFormValues => ({
  title: liveTest.title,
  description: liveTest.description,
  examName: liveTest.mockTest?.examName ?? null,
  language: liveTest.mockTest?.language ?? undefined,
  durationMinutes: liveTest.mockTestItem?.durationMinutes ?? 60,
  calculatorEnabled: liveTest.mockTestItem?.calculatorEnabled ?? false,
  subjectWiseTiming: liveTest.mockTestItem?.subjectWiseTiming ?? false,
  questionWiseTiming: liveTest.mockTestItem?.questionWiseTiming ?? false,
  price: toNumber(liveTest.price),
  discountPrice: liveTest.discountPrice != null ? toNumber(liveTest.discountPrice) : null,
  isFree: liveTest.isFree ?? false,
  whatYouLearn: parseStoredStringList(liveTest.mockTest?.whatYouLearn),
  requirements: parseStoredStringList(liveTest.mockTest?.requirements),
  maxSeats: liveTest.maxSeats,
  thumbnailUrl: liveTest.thumbnailUrl,
  thumbnailFileId: liveTest.thumbnailFileId,
  introVideoUrl: liveTest.introVideoUrl,
  introVideoFileId: liveTest.introVideoFileId,
  registrationDeadline: liveTest.registrationDeadline ? new Date(liveTest.registrationDeadline) : null,
  startTime: liveTest.startTime ? new Date(liveTest.startTime) : null,
  endTime: new Date(liveTest.endTime),
  hasPrizes: liveTest.hasPrizes,
  prizeTiers: resolveLiveTestPrizeTiers(liveTest.prizeTiers, liveTest.firstPrize, liveTest.secondPrize, liveTest.thirdPrize),
});

const cleanList = (list: string[] | null | undefined): string[] | null => {
  const items = (list ?? []).filter((item) => item.trim() !== '');
  return items.length > 0 ? items : null;
};

/** The values as they are persisted: "not set" is always null, blank list rows are
 * dropped, per-section timing zeroes the overall duration and prize tiers only
 * exist while prizes are on. */
export const normalizeLiveTestFormValues = (values: LiveTestFormValues): LiveTestFormValues => {
  const timedPerSection = Boolean(values.subjectWiseTiming || values.questionWiseTiming);
  return {
    ...values,
    description: isEmptyRichText(values.description) ? null : values.description,
    examName: values.examName && values.examName.trim() !== '' ? values.examName : null,
    language: values.language || undefined,
    durationMinutes: timedPerSection ? 0 : values.durationMinutes,
    discountPrice: values.discountPrice ?? null,
    whatYouLearn: cleanList(values.whatYouLearn),
    requirements: cleanList(values.requirements),
    thumbnailUrl: values.thumbnailUrl || null,
    thumbnailFileId: values.thumbnailUrl ? values.thumbnailFileId || null : null,
    introVideoUrl: values.introVideoUrl || null,
    introVideoFileId: values.introVideoUrl ? values.introVideoFileId || null : null,
    registrationDeadline: values.registrationDeadline ?? null,
    startTime: values.startTime ?? null,
    hasPrizes: Boolean(values.hasPrizes),
    prizeTiers: values.hasPrizes ? sortPrizeTiers(values.prizeTiers ?? []) : [],
  };
};

export type LiveTestChanges = { [K in LiveTestFormField]?: LiveTestFormValues[K] | null };

const comparable = (value: unknown): string =>
  JSON.stringify(value instanceof Date ? value.getTime() : value === undefined ? null : value);

/** Only the fields that differ from the last saved values, grouped (see
 * UPDATE_GROUPS), minus anything locked on a published test. */
export const buildLiveTestChanges = (
  saved: LiveTestFormValues,
  current: LiveTestFormValues,
  isPublished: boolean
): LiveTestChanges => {
  const before = normalizeLiveTestFormValues(saved);
  const after = normalizeLiveTestFormValues(current);
  const changes: Record<string, unknown> = {};
  for (const group of UPDATE_GROUPS) {
    const editable = group.filter((field) => !isLiveTestFieldLocked(field, isPublished));
    if (editable.some((field) => comparable(before[field]) !== comparable(after[field]))) {
      for (const field of editable) {
        changes[field] = after[field] === undefined ? null : after[field];
      }
    }
  }
  return changes as LiveTestChanges;
};

export interface LiveTestFieldIssue {
  field: LiveTestFormField;
  step: LiveTestEditableStep;
  storefront: boolean;
  message: string;
}

const describeIssue = (field: LiveTestFormField, message: string): string => {
  const label = LIVE_TEST_FIELD_LABELS[field] ?? field;
  const firstWord = label.split(' ')[0].toLowerCase();
  return message.toLowerCase().startsWith(firstWord) ? message : `${label}: ${message}`;
};

/** Validation problems in page order (step, then position on the step). Locked
 * fields of a published test are skipped because the teacher cannot change them
 * and they are never sent. */
export const findLiveTestIssues = (
  values: LiveTestFormValues,
  options: { isPublished?: boolean; steps?: LiveTestEditableStep[] } = {}
): LiveTestFieldIssue[] => {
  const result = liveTestCreationFormSchema.safeParse(values);
  if (result.success) return [];
  const issues: LiveTestFieldIssue[] = [];
  for (const issue of result.error.issues) {
    const layout = FIELD_LAYOUT.find((entry) => entry.field === issue.path[0]);
    if (!layout) continue;
    if (isLiveTestFieldLocked(layout.field, Boolean(options.isPublished))) continue;
    if (options.steps && !options.steps.includes(layout.step)) continue;
    issues.push({
      field: layout.field,
      step: layout.step,
      storefront: Boolean(layout.storefront),
      message: describeIssue(layout.field, issue.message),
    });
  }
  return issues.sort((a, b) => LIVE_TEST_FORM_FIELDS.indexOf(a.field) - LIVE_TEST_FORM_FIELDS.indexOf(b.field));
};

/** Scrolls to the first rendered field error inside the container and focuses its
 * control. Returns false when no error is on screen yet. */
export const focusFirstFormError = (container: HTMLElement | null): boolean => {
  const message = container?.querySelector<HTMLElement>('[id$="-form-item-message"]');
  if (!message) return false;
  const item = message.parentElement;
  const target =
    item?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    item?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), [contenteditable="true"], button:not([disabled])'
    ) ??
    null;
  (target ?? message).scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  target?.focus({ preventScroll: true });
  return true;
};