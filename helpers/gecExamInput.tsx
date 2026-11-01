import { z } from "zod";
import { gecLinkSchema, type GecExam } from "./gecModel";

/* The record editor's payload, shared by the form, the save endpoint and the importer. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

const optionalLink = gecLinkSchema.nullable().transform((value) => (value ? value : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const gecEventInputSchema = z.object({
  id: z.number().int().positive().optional(),
  type: z.enum([
    "notification",
    "application_start",
    "application_deadline",
    "correction_window",
    "exam_city",
    "admit_card",
    "prelims",
    "mains",
    "exam",
    "skill_test",
    "interview",
    "answer_key",
    "result",
    "other",
  ]),
  title: optionalText(200),
  stage: optionalText(80),
  mode: optionalText(40),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  dateStatus: z.enum(["confirmed", "tentative", "tba"]),
  dateLabel: optionalText(120),
  statusOverride: z.enum(["open", "upcoming", "in_progress", "concluded", "tba", "tentative", "revised", "extended"]).nullable(),
  listingOverride: z.enum(["auto", "include", "exclude"]),
  concludedOverride: z.enum(["auto", "include", "exclude"]),
  watchNext: optionalText(300),
  resultStatus: optionalText(120),
  resultUrl: optionalLink,
  sourceUrl: optionalLink,
  notes: optionalText(1000),
});

export const gecExamInputSchema = z.object({
  id: z.number().int().positive().optional(),
  recordType: z.enum(["exam", "recruitment"]),
  category: z.enum(["upsc", "ssc", "banking", "railway", "state", "central"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  tableName: optionalText(200),
  shortName: optionalText(120),
  conductingBody: z.string().trim().min(1, "Conducting body is required").max(80),
  testkartExamId: z.number().int().positive().nullable(),
  newsPostId: z.number().int().positive().nullable(),
  noticeNumber: optionalText(60),
  postsDescription: optionalText(300),
  vacancies: z.number().int().min(0).max(10_000_000).nullable(),
  postName: optionalText(200),
  officialUrl: optionalLink,
  notificationUrl: optionalLink,
  applyUrl: optionalLink,
  statusOverride: z.enum(["open", "upcoming", "in_progress", "concluded", "tba", "tentative", "revised", "extended"]).nullable(),
  statusLabel: optionalText(60),
  keywords: optionalText(300),
  cellOverrides: z.record(z.string().max(40), z.string().max(300)),
  sortOrder: z.number().int().min(0).max(100_000),
  isHidden: z.boolean(),
  verification: z.enum(["unverified", "verified", "needs_update"]),
  sourceNote: optionalText(1000),
  reviewNote: optionalText(1000),
  events: z.array(gecEventInputSchema).max(40),
});

export type GecEventInput = z.input<typeof gecEventInputSchema>;
export type GecExamInput = z.input<typeof gecExamInputSchema>;
export type GecExamParsed = z.output<typeof gecExamInputSchema>;

export interface GecIssue {
  path: string;
  message: string;
}

/** Rules zod cannot express: dates against their status, ranges and duplicate events. */
export function validateGecExam(input: GecExamParsed | GecExamInput): GecIssue[] {
  const issues: GecIssue[] = [];
  const seen = new Map<string, number>();
  input.events.forEach((event, index) => {
    const at = `events.${index}`;
    if (event.dateStatus === "tba") {
      if (event.startDate) issues.push({ path: `${at}.startDate`, message: "Clear the date, or change the date status from To be announced" });
    } else if (!event.startDate) {
      issues.push({ path: `${at}.startDate`, message: "Add a date, or mark the date as To be announced" });
    }
    if (event.startDate && event.endDate && event.endDate < event.startDate) {
      issues.push({ path: `${at}.endDate`, message: "The end date is before the start date" });
    }
    if (event.endDate && !event.startDate) issues.push({ path: `${at}.endDate`, message: "Add a start date first" });
    const key = [event.type, (event.stage ?? "").trim().toLowerCase(), event.startDate ?? "tba"].join("|");
    if (seen.has(key)) {
      issues.push({ path: `${at}.type`, message: `Duplicate of event ${seen.get(key)! + 1}: same type, stage and date` });
    } else {
      seen.set(key, index);
    }
  });
  if (input.statusLabel && !input.statusOverride) {
    issues.push({ path: "statusOverride", message: "Pick a status for the custom label, or clear the label" });
  }
  return issues;
}

export const emptyGecEvent = (type: GecEventInput["type"] = "exam"): GecEventInput => ({
  type,
  title: null,
  stage: null,
  mode: null,
  startDate: null,
  endDate: null,
  dateStatus: "tba",
  dateLabel: null,
  statusOverride: null,
  listingOverride: "auto",
  concludedOverride: "auto",
  watchNext: null,
  resultStatus: null,
  resultUrl: null,
  sourceUrl: null,
  notes: null,
});

export const emptyGecExam = (): GecExamInput => ({
  recordType: "exam",
  category: "ssc",
  name: "",
  tableName: null,
  shortName: null,
  conductingBody: "",
  testkartExamId: null,
  newsPostId: null,
  noticeNumber: null,
  postsDescription: null,
  vacancies: null,
  postName: null,
  officialUrl: null,
  notificationUrl: null,
  applyUrl: null,
  statusOverride: null,
  statusLabel: null,
  keywords: null,
  cellOverrides: {},
  sortOrder: 0,
  isHidden: false,
  verification: "unverified",
  sourceNote: null,
  reviewNote: null,
  events: [],
});

/** An admin snapshot record as editor input. */
export const gecExamToInput = (exam: GecExam): GecExamInput => ({
  id: exam.id,
  recordType: exam.recordType,
  category: exam.category,
  name: exam.name,
  tableName: exam.tableName,
  shortName: exam.shortName,
  conductingBody: exam.conductingBody,
  testkartExamId: exam.testkartExam?.id ?? null,
  newsPostId: exam.newsPostId ?? null,
  noticeNumber: exam.noticeNumber,
  postsDescription: exam.postsDescription,
  vacancies: exam.vacancies,
  postName: exam.postName,
  officialUrl: exam.officialUrl,
  notificationUrl: exam.notificationUrl,
  applyUrl: exam.applyUrl,
  statusOverride: exam.statusOverride,
  statusLabel: exam.statusLabel,
  keywords: exam.keywords,
  cellOverrides: exam.cellOverrides ?? {},
  sortOrder: exam.sortOrder,
  isHidden: exam.isHidden ?? false,
  verification: exam.verification ?? "unverified",
  sourceNote: exam.sourceNote ?? null,
  reviewNote: exam.reviewNote ?? null,
  events: exam.events.map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    stage: event.stage,
    mode: event.mode,
    startDate: event.startDate,
    endDate: event.endDate,
    dateStatus: event.dateStatus,
    dateLabel: event.dateLabel,
    statusOverride: event.statusOverride,
    listingOverride: event.listingOverride,
    concludedOverride: event.concludedOverride,
    watchNext: event.watchNext,
    resultStatus: event.resultStatus,
    resultUrl: event.resultUrl,
    sourceUrl: event.sourceUrl,
    notes: event.notes ?? null,
  })),
});

/** Editor input as a record, so the editor can show where the record would appear before it is saved. */
export const gecInputToExam = (
  input: GecExamInput,
  testkartExam: GecExam["testkartExam"],
  newsPost: GecExam["newsPost"] = null
): GecExam => ({
  id: input.id ?? -1,
  slug: "",
  recordType: input.recordType,
  category: input.category,
  name: input.name || "Untitled record",
  tableName: input.tableName || null,
  shortName: input.shortName || null,
  conductingBody: input.conductingBody || "-",
  testkartExam,
  newsPostId: input.newsPostId,
  newsPost,
  noticeNumber: input.noticeNumber || null,
  postsDescription: input.postsDescription || null,
  vacancies: input.vacancies,
  postName: input.postName || null,
  officialUrl: input.officialUrl || null,
  notificationUrl: input.notificationUrl || null,
  applyUrl: input.applyUrl || null,
  statusOverride: input.statusOverride,
  statusLabel: input.statusLabel || null,
  keywords: input.keywords || null,
  cellOverrides: input.cellOverrides,
  sortOrder: input.sortOrder,
  isHidden: input.isHidden,
  events: input.events.map((event, index) => ({
    id: event.id ?? -(index + 1),
    type: event.type,
    title: event.title || null,
    stage: event.stage || null,
    mode: event.mode || null,
    startDate: event.dateStatus === "tba" ? null : event.startDate || null,
    endDate: event.dateStatus === "tba" ? null : event.endDate || null,
    dateStatus: event.dateStatus,
    dateLabel: event.dateLabel || null,
    statusOverride: event.statusOverride,
    listingOverride: event.listingOverride,
    concludedOverride: event.concludedOverride,
    watchNext: event.watchNext || null,
    resultStatus: event.resultStatus || null,
    resultUrl: event.resultUrl || null,
    sourceUrl: event.sourceUrl || null,
    sortOrder: (index + 1) * 10,
  })),
});
