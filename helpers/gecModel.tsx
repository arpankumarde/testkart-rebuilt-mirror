import { z } from "zod";
import type {
  GecCategory,
  GecDateStatus,
  GecEventType,
  GecOverride,
  GecRecordType,
  GecStatus,
  GecVerification,
} from "./schema";

/*
 * Government Exams Calendar: shared model for the public page, the admin CMS and the server.
 * Exams and their dated events live in gec_exams / gec_events; page copy lives in gec_page.draft.
 * The database function gec_build_snapshot() turns both into one GecSnapshot, which is what
 * Publish freezes into gec_publications and what the public page renders.
 */

export type { GecCategory, GecDateStatus, GecEventType, GecOverride, GecRecordType, GecStatus, GecVerification };

export const GEC_PATH = "/govt-exams-calendar";
export const GEC_ADMIN_PATH = "/admin/govt-exams-calendar";

export const GEC_CATEGORIES: { value: GecCategory; label: string }[] = [
  { value: "upsc", label: "UPSC" },
  { value: "ssc", label: "SSC" },
  { value: "banking", label: "Banking" },
  { value: "railway", label: "Railway" },
  { value: "state", label: "State exams" },
  { value: "central", label: "Other central bodies" },
];

export const GEC_STATUSES: { value: GecStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "concluded", label: "Concluded" },
  { value: "tba", label: "To be announced" },
  { value: "tentative", label: "Tentative" },
  { value: "revised", label: "Revised" },
  { value: "extended", label: "Extended" },
];

export const GEC_EVENT_TYPES: { value: GecEventType; label: string }[] = [
  { value: "notification", label: "Notification" },
  { value: "application_start", label: "Application start" },
  { value: "application_deadline", label: "Application deadline" },
  { value: "correction_window", label: "Correction window" },
  { value: "exam_city", label: "Exam city slip" },
  { value: "admit_card", label: "Admit card" },
  { value: "prelims", label: "Prelims" },
  { value: "mains", label: "Mains" },
  { value: "exam", label: "Exam / CBT / tier" },
  { value: "skill_test", label: "Skill / physical test" },
  { value: "interview", label: "Interview" },
  { value: "answer_key", label: "Answer key" },
  { value: "result", label: "Result" },
  { value: "other", label: "Other" },
];

/** Event types that are a sitting of the exam itself. Only these feed Next 30 days and Recently concluded. */
export const GEC_STAGE_TYPES: ReadonlySet<GecEventType> = new Set(["prelims", "mains", "exam", "skill_test", "interview"]);

export const GEC_DATE_STATUSES: { value: GecDateStatus; label: string; hint: string }[] = [
  { value: "confirmed", label: "Confirmed", hint: "Date is on an official notice" },
  { value: "tentative", label: "Tentative", hint: "Planned or approximate; shown as tentative" },
  { value: "tba", label: "To be announced", hint: "No date yet; enter a label instead" },
];

export const GEC_VERIFICATIONS: { value: GecVerification; label: string }[] = [
  { value: "unverified", label: "Unverified" },
  { value: "verified", label: "Verified" },
  { value: "needs_update", label: "Needs update" },
];

export const GEC_RECORD_TYPES: { value: GecRecordType; label: string; hint: string }[] = [
  { value: "exam", label: "Exam", hint: "Listed in its category table, plus any date-based section" },
  { value: "recruitment", label: "Recruitment only", hint: "Only appears through its dates, such as Open applications" },
];

export const gecLabel = <T extends string>(list: { value: T; label: string }[], value: T | null | undefined) =>
  list.find((item) => item.value === value)?.label ?? "";

export const GEC_SECTION_IDS = [
  "next-30-days",
  "exam-bodies",
  "upsc-2027",
  "ssc-2026-27",
  "banking-ibps",
  "railway-rrb",
  "state-exams",
  "open-applications",
  "recently-concluded",
  "exam-cycle",
  "faqs",
  "sources",
  "related",
] as const;

export type GecSectionId = (typeof GEC_SECTION_IDS)[number];

/** The category table each category's exam records appear in. "central" has none. */
export const GEC_CATEGORY_SECTION: Record<GecCategory, GecSectionId | null> = {
  upsc: "upsc-2027",
  ssc: "ssc-2026-27",
  banking: "banking-ibps",
  railway: "railway-rrb",
  state: "state-exams",
  central: null,
};

/** Columns of each category table, keyed for per-record cell overrides. */
export const GEC_TABLE_COLUMNS: Record<"upsc" | "ssc" | "banking" | "railway" | "state", { key: string; label: string }[]> = {
  upsc: [
    { key: "exam", label: "Exam" },
    { key: "notification", label: "Notification" },
    { key: "lastDate", label: "Last date to apply" },
    { key: "examDate", label: "Exam date" },
  ],
  ssc: [
    { key: "exam", label: "Exam" },
    { key: "tier", label: "Tier / phase" },
    { key: "window", label: "Application window" },
    { key: "examDate", label: "Exam date" },
  ],
  banking: [
    { key: "exam", label: "Exam" },
    { key: "prelims", label: "Prelims" },
    { key: "mains", label: "Mains" },
  ],
  railway: [
    { key: "exam", label: "Exam" },
    { key: "notice", label: "Notice" },
    { key: "stage", label: "Exam date / stage" },
  ],
  state: [
    { key: "commission", label: "Commission" },
    { key: "exam", label: "Exam" },
    { key: "date", label: "Date" },
    { key: "note", label: "Note" },
  ],
};

export interface GecEvent {
  id: number;
  type: GecEventType;
  title: string | null;
  stage: string | null;
  mode: string | null;
  startDate: string | null;
  endDate: string | null;
  dateStatus: GecDateStatus;
  dateLabel: string | null;
  statusOverride: GecStatus | null;
  listingOverride: GecOverride;
  concludedOverride: GecOverride;
  watchNext: string | null;
  resultStatus: string | null;
  resultUrl: string | null;
  sourceUrl: string | null;
  sortOrder: number;
  /** Admin snapshots only. */
  notes?: string | null;
}

export interface GecExam {
  id: number;
  slug: string;
  recordType: GecRecordType;
  category: GecCategory;
  name: string;
  tableName: string | null;
  shortName: string | null;
  conductingBody: string;
  /** Used only to suggest news stories in the editor; the page no longer links to exam pages. */
  testkartExam: { id: number; name: string; slug: string } | null;
  /** The Exam News story the exam name links to (exam_news_posts.id). */
  newsPostId: number | null;
  /** Filled at read time from Exam News. Null on the public page unless the story is published right now. */
  newsPost?: GecNewsLink | null;
  noticeNumber: string | null;
  postsDescription: string | null;
  vacancies: number | null;
  postName: string | null;
  officialUrl: string | null;
  notificationUrl: string | null;
  applyUrl: string | null;
  statusOverride: GecStatus | null;
  statusLabel: string | null;
  keywords: string | null;
  cellOverrides: Record<string, string>;
  sortOrder: number;
  events: GecEvent[];
  /** Admin snapshots only. */
  isHidden?: boolean;
  verification?: GecVerification;
  verifiedAt?: string | null;
  sourceNote?: string | null;
  reviewNote?: string | null;
  updatedAt?: string;
}

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");
/** Internal paths ("/mock-test") or full http(s) URLs. Empty means no link. */
export const gecLinkSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\/\S+$/i.test(value), "Use a path starting with / or a full https:// URL");

const sectionSettings = z.object({
  title: required(200, "Heading"),
  navLabel: required(60, "Sidebar label"),
  intro: text(1500),
  note: text(600),
  windowDays: z.number().int().min(7).max(90).optional(),
  maxRows: z.number().int().min(1).max(40).optional(),
  urgentDays: z.number().int().min(1).max(14).optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
});

export type GecSectionSettings = z.infer<typeof sectionSettings>;

const itemId = z.string().trim().min(1).max(60);

export const gecPageSchema = z.object({
  version: z.literal(1),
  breadcrumb: z.object({ homeLabel: required(60, "Home label"), currentLabel: required(80, "Page label") }),
  hero: z.object({
    h1: required(160, "H1"),
    overview: z.array(text(1200)).max(4),
    tags: z.array(required(30, "Tag")).max(8),
    searchPlaceholder: text(120),
    seoTitle: required(70, "SEO title"),
    metaDescription: required(320, "Meta description"),
    datePublished: isoDate,
  }),
  chips: z
    .array(z.object({ section: z.enum(GEC_SECTION_IDS), label: required(40, "Chip label"), visible: z.boolean() }))
    .max(13),
  sections: z.object({
    "next-30-days": sectionSettings,
    "exam-bodies": sectionSettings,
    "upsc-2027": sectionSettings,
    "ssc-2026-27": sectionSettings,
    "banking-ibps": sectionSettings,
    "railway-rrb": sectionSettings,
    "state-exams": sectionSettings,
    "open-applications": sectionSettings,
    "recently-concluded": sectionSettings,
    "exam-cycle": sectionSettings,
    faqs: sectionSettings,
    sources: sectionSettings,
    related: sectionSettings,
  }),
  bodies: z
    .array(
      z.object({
        id: itemId,
        name: required(60, "Body name"),
        exams: text(400),
        stages: text(400),
        website: text(120),
        url: gecLinkSchema,
      })
    )
    .max(20),
  cycle: z.array(z.object({ id: itemId, title: required(120, "Step title"), text: text(600) })).min(1).max(8),
  cta: z.object({
    eyebrow: text(40),
    title: required(120, "CTA heading"),
    text: text(400),
    buttonLabel: required(60, "Button text"),
    url: gecLinkSchema,
  }),
  sidebar: z.object({
    title: required(60, "Card title"),
    text: text(240),
    buttonLabel: required(60, "Button text"),
    url: gecLinkSchema,
  }),
  faqs: z
    .array(z.object({ id: itemId, question: required(300, "Question"), answer: required(3000, "Answer"), published: z.boolean() }))
    .max(40),
  sources: z.object({
    items: z
      .array(z.object({ id: itemId, name: required(80, "Source name"), url: gecLinkSchema, description: text(300) }))
      .max(30),
    tail: text(400),
    disclaimer: required(1000, "Disclaimer"),
  }),
  related: z
    .array(z.object({ id: itemId, title: required(60, "Card title"), text: text(200), href: gecLinkSchema }))
    .max(8),
});

export type GecPageContent = z.infer<typeof gecPageSchema>;

export interface GecLogLine {
  date: string;
  text: string;
}

export interface GecSnapshot {
  version: 1;
  page: GecPageContent;
  exams: GecExam[];
  log: GecLogLine[];
}

/** The public page reads one of these: a published snapshot plus the dates it is rendered for. */
export interface GecPublicPayload {
  snapshot: GecSnapshot;
  /** YYYY-MM-DD shown as "Last updated". */
  lastUpdated: string;
  /** YYYY-MM-DD in India, so the server render and hydration derive the same rows. */
  today: string;
}

/** A linked Exam News story. The page links only when `status` is published. */
export interface GecNewsLink {
  id: number;
  slug: string;
  title: string;
  status: "published" | "draft" | "scheduled" | "archived";
}

/** Exam News story URL, the same /exam-news/{slug} rule as helpers/examNewsPublicMeta. */
export const gecNewsPath = (slug: string) => `/exam-news/${slug}`;

/** The 18 blocks of the public page, in page order. `keys` are the parts of the page draft each block owns. */
export const GEC_BLOCKS = [
  { key: "header", n: "1", label: "Header and breadcrumb", keys: ["breadcrumb"] },
  { key: "hero", n: "2", label: "Hero", keys: ["hero"] },
  { key: "chips", n: "3", label: "Category chips", keys: ["chips"] },
  { key: "next-30-days", n: "4", label: "Next 30 days", keys: ["sections.next-30-days"], derived: true },
  { key: "exam-bodies", n: "5", label: "Exam bodies at a glance", keys: ["sections.exam-bodies", "bodies"] },
  { key: "upsc-2027", n: "6", label: "UPSC calendar", keys: ["sections.upsc-2027"], derived: true },
  { key: "ssc-2026-27", n: "7", label: "SSC calendar", keys: ["sections.ssc-2026-27"], derived: true },
  { key: "banking-ibps", n: "8", label: "Banking (IBPS / SBI)", keys: ["sections.banking-ibps"], derived: true },
  { key: "railway-rrb", n: "9", label: "Railway (RRB)", keys: ["sections.railway-rrb"], derived: true },
  { key: "state-exams", n: "10", label: "State exams", keys: ["sections.state-exams"], derived: true },
  { key: "open-applications", n: "11", label: "Open applications", keys: ["sections.open-applications"], derived: true },
  { key: "recently-concluded", n: "12", label: "Recently concluded", keys: ["sections.recently-concluded"], derived: true },
  { key: "exam-cycle", n: "13", label: "How the exam cycle works", keys: ["sections.exam-cycle", "cycle"] },
  { key: "cta", n: "14", label: "CTA band and sidebar card", keys: ["cta", "sidebar"] },
  { key: "faqs", n: "15", label: "FAQs", keys: ["sections.faqs", "faqs"] },
  { key: "sources", n: "16", label: "Sources, disclaimer, update log", keys: ["sections.sources", "sources"] },
  { key: "related", n: "17", label: "Related on Testkart", keys: ["sections.related", "related"] },
  { key: "footer", n: "18", label: "Footer", keys: [] },
] as const;

export type GecBlockKey = (typeof GEC_BLOCKS)[number]["key"];

export const GEC_BLOCK_KEYS = GEC_BLOCKS.map((block) => block.key) as [GecBlockKey, ...GecBlockKey[]];

export const gecBlock = (key: string | null | undefined) => GEC_BLOCKS.find((block) => block.key === key);

/** Copies the parts of `source` that `block` owns onto `target`, leaving every other block as it is. */
export function mergeGecBlock(target: GecPageContent, source: GecPageContent, block: GecBlockKey): GecPageContent {
  const next = structuredClone(target);
  for (const path of gecBlock(block)?.keys ?? []) {
    if (path.startsWith("sections.")) {
      const id = path.slice("sections.".length) as GecSectionId;
      next.sections[id] = structuredClone(source.sections[id]);
    } else {
      const key = path as Exclude<keyof GecPageContent, "version" | "sections">;
      (next as Record<string, unknown>)[key] = structuredClone(source[key]);
    }
  }
  return next;
}

/** Tokens section copy may use; each is filled from the dates the page is rendered for. */
export const GEC_TOKENS: { token: string; meaning: string }[] = [
  { token: "{updated}", meaning: "Last updated date, e.g. 2 November 2026" },
  { token: "{range}", meaning: "Next-30-days window, e.g. 10 November – 9 December 2026" },
  { token: "{from}", meaning: "First day of the window, e.g. 10 November" },
  { token: "{to}", meaning: "Last day of the window, e.g. 9 December 2026" },
  { token: "{urgentDays}", meaning: "Days left that turn a last date red" },
  { token: "{nextNotification}", meaning: "Next UPSC notification due (sentence drops when none)" },
];

export const gecNewId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
