/*
 * Teacher campaign rules shared by the server and the teacher and admin screens.
 * No database access here, so pages can import it.
 *
 * The Creator Bonus pays a fixed amount for a test series or course that meets
 * the campaign's size rules. The teacher claims it when submitting for review;
 * approving the content does not pay it. An admin credits it separately, as a
 * call on quality, and only then does it reach the teacher's balance.
 *
 * An Exam Bonus is the same deal as a short campaign for one exam in the news:
 * test series only, with slots shared by all teachers.
 */

export type CampaignContentType = "mock_test" | "course";

export type CampaignKind = "creator" | "exam";

/** Starting values for a new Exam Bonus. An admin can change them per campaign. */
export const EXAM_BONUS_DEFAULTS = {
  totalSlots: 10,
  amount: 100,
  maxPerTeacher: 3,
  days: 7,
  minTests: 10,
  minQuestions: 500,
} as const;

export const examBonusTitle = (examName: string): string => `${examName} Exam Bonus`;

/** A running Exam Bonus a test series is tagged for, as the submit screen shows it. */
export type ExamBonusOption = {
  campaignId: number;
  title: string;
  amount: number;
  slotsLeft: number;
  totalSlots: number;
  endsAt: Date;
  canClaim: boolean;
  /** Why this series cannot claim it now; null when it can. */
  reason: string | null;
};

/** Why a course video does not count toward the bonus. */
export type CourseVideoReason = "no_file" | "external" | "duplicate" | "short";

export type CampaignLesson = {
  title: string;
  /** The minutes that count: the lower of typed and recorded, typed when nothing is recorded. */
  minutes: number;
  typedMinutes: number;
  /** Length recorded when the file was uploaded to the asset library; null when unknown. */
  recordedMinutes: number | null;
  counted: boolean;
  reason: CourseVideoReason | null;
  url: string | null;
};

export type CampaignCriteria =
  | { kind: "mock_test"; tests: number; questions: number }
  | { kind: "course"; videos: number; minutes: number; lessons: CampaignLesson[] };

export type CampaignRequirements = {
  minTests: number;
  minQuestions: number;
  minVideos: number;
  minVideoMinutes: number;
  /** A course video shorter than this does not count. */
  minMinutesPerVideo: number;
};

export type CampaignClaimStatus = "claimed" | "credited" | "declined" | "withdrawn" | "reversed";

export type CampaignProgressItem = { label: string; have: number; need: number };

/** Each size rule with how far the item has got, in the order the screens show them. */
export function campaignProgress(criteria: CampaignCriteria, req: CampaignRequirements): CampaignProgressItem[] {
  if (criteria.kind === "mock_test") {
    return [
      { label: "tests", have: criteria.tests, need: req.minTests },
      { label: "questions", have: criteria.questions, need: req.minQuestions },
    ];
  }
  return [
    { label: "videos", have: criteria.videos, need: req.minVideos },
    { label: "video minutes", have: criteria.minutes, need: req.minVideoMinutes },
  ];
}

export const meetsCampaignCriteria = (criteria: CampaignCriteria, req: CampaignRequirements): boolean =>
  campaignProgress(criteria, req).every((p) => p.have >= p.need);

/** "3 more tests", "1 more test"; labels are plural, so a single one drops the trailing s. */
export const shortfallText = (p: CampaignProgressItem): string => {
  const gap = p.need - p.have;
  return `${gap.toLocaleString("en-IN")} more ${gap === 1 ? p.label.replace(/s$/, "") : p.label}`;
};

/** "3 more tests and 120 more questions", or null when every rule is met. */
export function missingCriteriaText(criteria: CampaignCriteria, req: CampaignRequirements): string | null {
  const missing = campaignProgress(criteria, req)
    .filter((p) => p.have < p.need)
    .map(shortfallText);
  return missing.length === 0 ? null : missing.join(" and ");
}

export const CAMPAIGN_CONTENT_NOUNS: Record<CampaignContentType, string> = {
  mock_test: "test series",
  course: "course",
};

/** Only videos uploaded to Testkart count; links to other sites (YouTube) do not. */
export const UPLOADED_VIDEO_PREFIX = "https://cdn.testkart.in/";

export const videoReasonText = (reason: CourseVideoReason, minMinutesPerVideo: number): string =>
  ({
    no_file: "No video file yet",
    external: "Link to another site, not an upload",
    duplicate: "Same file as an earlier lesson",
    short: `Shorter than ${minMinutesPerVideo} minutes`,
  })[reason];

export type CourseVideoRow = {
  title: string;
  url: string | null;
  typedMinutes: number | null;
  recordedSeconds: number | null;
};

/**
 * Which course videos count. Each counted video is an upload, a file not used by
 * an earlier lesson, and at least minMinutesPerVideo long, where its length is
 * the lower of the typed and the recorded duration. Rows come in course order.
 */
export function evaluateCourseVideos(rows: CourseVideoRow[], minMinutesPerVideo: number): CampaignCriteria {
  const seen = new Set<string>();
  const lessons: CampaignLesson[] = rows.map((row) => {
    const typed = Math.max(0, row.typedMinutes ?? 0);
    const recorded = row.recordedSeconds === null ? null : Math.max(0, Math.round(row.recordedSeconds / 60));
    const minutes = recorded === null ? typed : Math.min(typed, recorded);
    const url = row.url?.trim() || null;
    let reason: CourseVideoReason | null = null;
    if (!url) reason = "no_file";
    else if (!url.startsWith(UPLOADED_VIDEO_PREFIX)) reason = "external";
    else if (seen.has(url)) reason = "duplicate";
    else if (minutes < minMinutesPerVideo) reason = "short";
    if (url) seen.add(url);
    return { title: row.title, minutes, typedMinutes: typed, recordedMinutes: recorded, counted: reason === null, reason, url };
  });
  const counted = lessons.filter((l) => l.counted);
  return {
    kind: "course",
    videos: counted.length,
    minutes: counted.reduce((sum, l) => sum + l.minutes, 0),
    lessons,
  };
}

export const CLAIM_STATUS_LABELS: Record<CampaignClaimStatus, string> = {
  claimed: "Claimed",
  credited: "Credited",
  declined: "Not selected",
  withdrawn: "Withdrawn",
  reversed: "Reversed",
};

export const formatRupees = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;