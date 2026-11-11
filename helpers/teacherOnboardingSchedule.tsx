/**
 * When each teacher onboarding email is due, and which one to send next.
 * Pure, so the rules can be tested without a database.
 *
 * Two tracks, both counted from sign-up (day 0):
 * - Track A, emails 1-4 on days 0, 1, 2 and 4. Publishing ends the track:
 *   emails 2-4 not sent yet are skipped. Email 1 is the welcome and always goes.
 *   Email 3 (profile) is skipped when the saved profile is already at 100%.
 * - Track B, emails 5-8 on days 6, 8, 10 and 13, for every teacher whether
 *   they have published or not. Email 7 (Creator Bonus unlocks the bank
 *   account) is skipped when bank details are already on file.
 *
 * "Published" means the teacher submitted a listing for review or has one live.
 * Delivery rules: one email per run, at least 20 hours between two emails,
 * emails other than the welcome only between 09:00 and 20:00 IST, and an email
 * more than 36 hours overdue is dropped. Teachers who join after sign-up (the
 * launch backfill, or an email added later) get only what was still ahead; the
 * welcome goes only to teachers who join within 45 minutes of signing up, so
 * anyone who got the old sign-up welcome does not get a second one.
 */

export const ONBOARDING_EMAIL_KEYS = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"] as const;
export type OnboardingEmailKey = (typeof ONBOARDING_EMAIL_KEYS)[number];

export type OnboardingSkipReason =
  | "published"
  | "profile_complete"
  | "bank_on_file"
  | "before_start"
  | "expired";

export type OnboardingSendStatus = "sending" | "sent" | "skipped" | "failed";

export type OnboardingSendRecord = {
  emailKey: string;
  status: OnboardingSendStatus;
  attempts: number;
  updatedAt: Date;
};

export type OnboardingState = {
  signedUpAt: Date;
  enrolledAt: Date;
  firstPublishedAt: Date | null;
  profileComplete: boolean;
  hasBankDetails: boolean;
  sends: OnboardingSendRecord[];
};

export type OnboardingPlan = {
  due: Record<OnboardingEmailKey, Date>;
  skip: { key: OnboardingEmailKey; reason: OnboardingSkipReason }[];
  send: OnboardingEmailKey | null;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const ONBOARDING_TIMING = {
  days: { e1: 0, e2: 1, e3: 2, e4: 4, e5: 6, e6: 8, e7: 10, e8: 13 },
  startGraceHours: 2,
  welcomeGraceHours: 0.75,
  expiryHours: 36,
  minGapHours: 20,
  sendWindowIst: { fromHour: 9, toHour: 20 },
  maxAttempts: 3,
} as const;

const ACTIVATION_KEYS: readonly OnboardingEmailKey[] = ["e1", "e2", "e3", "e4"];
const WELCOME_KEY: OnboardingEmailKey = "e1";

const istHour = (date: Date) => Math.floor(((date.getTime() + 5.5 * HOUR) % DAY) / HOUR);

export const isInSendWindow = (now: Date) => {
  const hour = istHour(now);
  return hour >= ONBOARDING_TIMING.sendWindowIst.fromHour && hour < ONBOARDING_TIMING.sendWindowIst.toHour;
};

const isFinal = (record: OnboardingSendRecord | undefined) =>
  !!record &&
  (record.status !== "failed" || record.attempts >= ONBOARDING_TIMING.maxAttempts);

export function onboardingDueDates(state: OnboardingState): Record<OnboardingEmailKey, Date> {
  const signedUp = state.signedUpAt.getTime();
  return Object.fromEntries(
    ONBOARDING_EMAIL_KEYS.map((key) => [key, new Date(signedUp + ONBOARDING_TIMING.days[key] * DAY)])
  ) as Record<OnboardingEmailKey, Date>;
}

export function planOnboarding(state: OnboardingState, now: Date): OnboardingPlan {
  const due = onboardingDueDates(state);
  const records = new Map(state.sends.map((record) => [record.emailKey, record]));
  const nowMs = now.getTime();
  const startFloor = (key: OnboardingEmailKey) =>
    state.enrolledAt.getTime() -
    (key === WELCOME_KEY ? ONBOARDING_TIMING.welcomeGraceHours : ONBOARDING_TIMING.startGraceHours) * HOUR;

  const skipReason = (key: OnboardingEmailKey): OnboardingSkipReason | null => {
    if (state.firstPublishedAt && ACTIVATION_KEYS.includes(key) && key !== WELCOME_KEY) return "published";
    const dueMs = due[key].getTime();
    if (dueMs < startFloor(key)) return "before_start";
    if (dueMs > nowMs) return null;
    if (nowMs - dueMs > ONBOARDING_TIMING.expiryHours * HOUR) return "expired";
    if (key === "e3" && state.profileComplete) return "profile_complete";
    if (key === "e7" && state.hasBankDetails) return "bank_on_file";
    return null;
  };

  const skip: OnboardingPlan["skip"] = [];
  let candidate: OnboardingEmailKey | null = null;

  const byDue = [...ONBOARDING_EMAIL_KEYS].sort((a, b) => due[a].getTime() - due[b].getTime());
  for (const key of byDue) {
    if (isFinal(records.get(key))) continue;
    const reason = skipReason(key);
    if (reason) {
      skip.push({ key, reason });
      continue;
    }
    if (!candidate && due[key].getTime() <= nowMs) candidate = key;
  }

  if (!candidate) return { due, skip, send: null };

  const lastSent = Math.max(
    0,
    ...state.sends
      .filter((record) => record.status === "sent" || record.status === "sending")
      .map((record) => record.updatedAt.getTime())
  );
  const gapOk = nowMs - lastSent >= ONBOARDING_TIMING.minGapHours * HOUR;
  const windowOk = candidate === WELCOME_KEY || isInSendWindow(now);

  return { due, skip, send: gapOk && windowOk ? candidate : null };
}
